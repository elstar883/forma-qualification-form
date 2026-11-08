/* storage.js — единственное хранилище приложения: localStorage (FR-09, NFR-04).
   Два ключа:
     forma.draft  — черновик заполнения, удаляется при отправке (AC-06)
     forma.result — отправленная анкета для карточки, удаляется при «Новая анкета» (AC-15)
   Никакие данные не отправляются наружу. Все обращения защищены try/catch:
   при недоступности хранилища приложение продолжает работать без черновика. */
window.App = window.App || {};

App.storage = (function () {
  "use strict";

  var DRAFT_KEY = "forma.draft";
  var RESULT_KEY = "forma.result";

  function safeGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function safeSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (e) {
      return false;
    }
  }

  function safeRemove(key) {
    try {
      window.localStorage.removeItem(key);
      return true;
    } catch (e) {
      return false;
    }
  }

  /* JSON.parse с очисткой битого значения */
  function parse(key) {
    var raw = safeGet(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      safeRemove(key);
      return null;
    }
  }

  function isValidShape(payload) {
    return payload !== null &&
      typeof payload === "object" &&
      payload.answers !== null &&
      typeof payload.answers === "object" &&
      !Array.isArray(payload.answers);
  }

  function normalizeStep(step) {
    var n = parseInt(step, 10);
    var max = App.config.steps.length;
    if (n >= 1 && n <= max) return n;
    return max; /* для результата: шаг после отправки — последний */
  }

  return {
    /* Черновик */

    saveDraft: function (answers, step) {
      return safeSet(DRAFT_KEY, JSON.stringify({
        answers: answers,
        step: step,
        savedAt: Date.now()
      }));
    },

    loadDraft: function () {
      var payload = parse(DRAFT_KEY);
      if (!isValidShape(payload)) return null;
      var step = parseInt(payload.step, 10);
      if (!(step >= 1 && step <= App.config.steps.length)) return null;
      return { answers: payload.answers, step: step };
    },

    clearDraft: function () {
      return safeRemove(DRAFT_KEY);
    },

    draftExists: function () {
      return safeGet(DRAFT_KEY) !== null;
    },

    /* Результат отправки (карточка менеджера) */

    saveResult: function (answers) {
      return safeSet(RESULT_KEY, JSON.stringify({
        answers: answers,
        submittedAt: Date.now()
      }));
    },

    loadResult: function () {
      var payload = parse(RESULT_KEY);
      if (!isValidShape(payload)) return null;
      return { answers: payload.answers };
    },

    clearResult: function () {
      return safeRemove(RESULT_KEY);
    }
  };
})();
