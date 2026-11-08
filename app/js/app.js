/* app.js — машина состояний, рендер шагов, навигация, карточка и копирование.
   Правила валидации, хранилище и квалификация — в validation.js, storage.js,
   qualification.js (итерации 2–5). */
(function () {
  "use strict";

  var cfg = App.config;

  /* Состояние машины экранов: welcome | draft | form | review | thanks | card */
  var state = {
    screen: "welcome",
    step: 1,
    editFromReview: false
  };

  /* Единая модель ответов (план §3). Пустые значения при старте/сбросе. */
  var answers = emptyAnswers();

  var SCREEN_IDS = {
    welcome: "screen-welcome",
    draft: "screen-draft",
    form: "screen-form",
    review: "screen-review",
    thanks: "screen-thanks",
    card: "screen-card"
  };

  function $(id) {
    return document.getElementById(id);
  }

  function emptyAnswers() {
    var a = {};
    Object.keys(cfg.fields).forEach(function (id) {
      a[id] = cfg.fields[id].type === "checkbox" ? false : "";
    });
    return a;
  }

  /* Восстановление из сохранённого объекта: гарантирует наличие всех ключей */
  function mergeAnswers(stored) {
    var merged = emptyAnswers();
    Object.keys(merged).forEach(function (id) {
      if (stored && (id in stored)) {
        var expected = cfg.fields[id].type === "checkbox" ? false : "";
        var value = stored[id];
        merged[id] = typeof value === typeof expected ? value : expected;
      }
    });
    return merged;
  }

  function fieldStepIndex(fieldId) {
    for (var i = 0; i < cfg.steps.length; i++) {
      if (cfg.steps[i].fields.indexOf(fieldId) !== -1) {
        return i + 1;
      }
    }
    return 1;
  }

  function displayValue(fieldId) {
    var f = cfg.fields[fieldId];
    if (f.type === "checkbox") {
      return answers[fieldId] ? cfg.texts.consentValue : "";
    }
    return String(answers[fieldId]).trim();
  }

  /* ---------- Экраны ---------- */

  function showScreen(name) {
    state.screen = name;
    Object.keys(SCREEN_IDS).forEach(function (key) {
      var el = $(SCREEN_IDS[key]);
      el.classList.toggle("is-active", key === name);
    });
    window.scrollTo(0, 0);
  }

  /* ---------- Шаги формы (FR-01, FR-03) ---------- */

  function renderStep() {
    var step = cfg.steps[state.step - 1];
    var html = '<h1 class="screen-title">' + step.title + "</h1>";

    step.fields.forEach(function (id) {
      var f = cfg.fields[id];
      html += '<div class="field" data-field="' + id + '">';

      if (f.type === "checkbox") {
        html += '<label class="check" for="field-' + id + '">' +
          '<input type="checkbox" id="field-' + id + '"' + (answers[id] ? " checked" : "") + ">" +
          "<span>" + f.checkboxText + "</span>" +
          "</label>";
      } else {
        html += '<label for="field-' + id + '">' + f.label +
          (f.required ? "" : ' <span class="optional">(необязательно)</span>') +
          "</label>";

        if (f.type === "select") {
          html += '<select id="field-' + id + '">' +
            '<option value="">Выберите вариант</option>';
          f.options.forEach(function (opt) {
            var selected = answers[id] === opt ? " selected" : "";
            html += '<option value="' + opt + '"' + selected + ">" + opt + "</option>";
          });
          html += "</select>";
        } else {
          html += '<input type="text" id="field-' + id + '"' +
            (f.inputmode ? ' inputmode="' + f.inputmode + '"' : "") +
            (f.maxlength ? ' maxlength="' + f.maxlength + '"' : "") +
            ' value="' + escapeAttr(answers[id]) + '">';
        }

        if (f.hint) {
          html += '<p class="hint">' + f.hint + "</p>";
        }
      }

      /* Слот сообщения валидации — наполняется в итерации 2 (FR-02) */
      html += '<p class="error" id="error-' + id + '" hidden></p>';
      html += "</div>";
    });

    $("step-container").innerHTML = html;
    $("progress").textContent = cfg.progressText(state.step);
    $("btn-prev").disabled = state.step === 1 && !state.editFromReview;
  }

  function escapeAttr(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function showForm() {
    renderStep();
    showScreen("form");
  }

  /* ---------- Валидация (FR-02, итерация 2) ---------- */

  function showStepErrors(result) {
    cfg.steps[state.step - 1].fields.forEach(function (id) {
      var el = $("error-" + id);
      if (!el) return;
      if (result.errors[id]) {
        el.textContent = result.errors[id];
        el.hidden = false;
      } else {
        el.textContent = "";
        el.hidden = true;
      }
    });
  }

  function clearFieldError(id) {
    var el = $("error-" + id);
    if (el && !el.hidden) {
      el.textContent = "";
      el.hidden = true;
    }
  }

  /* Проверка обязательных полей текущего шага; при ошибке — сообщения
     и фокус на первом невалидном поле (AC-02) */
  function validateCurrentStep() {
    var result = App.validation.validateStep(state.step, answers);
    showStepErrors(result);
    if (!result.ok && result.firstInvalid) {
      var focusEl = $("field-" + result.firstInvalid);
      if (focusEl) focusEl.focus();
    }
    return result.ok;
  }

  function startForm() {
    state.step = 1;
    state.editFromReview = false;
    showForm();
  }

  function goNext() {
    /* Переход вперёд только после валидации (FR-02) */
    if (!validateCurrentStep()) {
      return;
    }
    /* Возврат с правки — сразу на экран проверки (AC-05) */
    if (state.editFromReview) {
      state.editFromReview = false;
      showReview();
      return;
    }
    if (state.step < cfg.steps.length) {
      state.step += 1;
      showForm();
    } else {
      showReview();
    }
  }

  function goPrev() {
    if (state.editFromReview) {
      state.editFromReview = false;
      showReview();
      return;
    }
    if (state.step > 1) {
      state.step -= 1;
      showForm();
    }
  }

  /* ---------- Проверка ответов (FR-04) ---------- */

  function answerBlock(fieldId) {
    var f = cfg.fields[fieldId];
    var value = displayValue(fieldId);
    return '<button type="button" class="answer" data-field="' + fieldId + '">' +
      '<span class="answer-label">' + f.label + "</span>" +
      '<span class="answer-value">' + escapeAttr(value) + "</span>" +
      "</button>";
  }

  /* Обязательные поля — всегда; необязательные — только если заполнены */
  function collectBlocks() {
    var html = "";
    Object.keys(cfg.fields).forEach(function (id) {
      var f = cfg.fields[id];
      var value = displayValue(id);
      if (!f.required && !value) {
        return;
      }
      html += answerBlock(id);
    });
    return html;
  }

  function showReview() {
    $("review-list").innerHTML = collectBlocks();
    showScreen("review");
  }

  function openAnswer(fieldId) {
    state.editFromReview = true;
    state.step = fieldStepIndex(fieldId);
    showForm();
  }

  /* ---------- Завершение и карточка (FR-05, FR-06) ---------- */

  function submit() {
    /* Страховка: отправка только при валидных обязательных полях (FR-02) */
    var invalidStep = App.validation.validateAll(answers);
    if (invalidStep > 0) {
      state.editFromReview = false;
      state.step = invalidStep;
      showForm();
      validateCurrentStep();
      return;
    }
    state.editFromReview = false;
    /* FR-09 / AC-06: черновик удаляется, результат сохраняется для карточки */
    App.storage.clearDraft();
    App.storage.saveResult(answers);
    showScreen("thanks");
  }

  function openCard() {
    /* Статус вычисляется лениво при открытии карточки (РР-1): FR-07, BR-12 */
    renderCardStatus();
    $("card-list").innerHTML = collectBlocks();
    /* Результат прошлого копирования не должен висеть на новом открытии */
    $("copy-status").hidden = true;
    showScreen("card");
  }

  /* Блок статуса карточки (FR-07, BR-13, §10) */
  function renderCardStatus() {
    var q = App.qualification.qualify(answers);
    var html = '<div class="status">' +
      '<p class="status-label">Предварительный статус</p>' +
      '<p class="status-value">' + escapeAttr(q.status) + "</p>" +
      '<p class="status-reasons-title">Причины статуса:</p>' +
      '<ul class="status-reasons">';
    q.reasons.forEach(function (reason) {
      html += "<li>" + escapeAttr(reason) + "</li>";
    });
    html += "</ul>" +
      '<p class="status-note">Статус — подсказка менеджеру. Решение принимает человек</p>' +
      "</div>";
    $("card-status").innerHTML = html;
  }

  /* ---------- Копирование карточки (FR-08) ---------- */

  /* Текст для буфера: заголовок, статус с причинами и оговоркой,
     поля карточки в формате «поле: значение» (только показанные в карточке) */
  function buildCardText() {
    var q = App.qualification.qualify(answers);
    var lines = [cfg.texts.cardTitle, "",
      "Предварительный статус: " + q.status,
      "Причины статуса:"];
    q.reasons.forEach(function (reason) {
      lines.push("- " + reason);
    });
    lines.push("Статус — подсказка менеджеру. Решение принимает человек", "");
    Object.keys(cfg.fields).forEach(function (id) {
      var f = cfg.fields[id];
      var value = displayValue(id);
      if (!f.required && !value) {
        return;
      }
      lines.push(f.label + ": " + value);
    });
    return lines.join("\n");
  }

  function showCopyStatus(message, isError) {
    var el = $("copy-status");
    el.textContent = message;
    el.hidden = false;
    el.classList.toggle("copy-status--error", isError);
  }

  /* Ручной fallback (S-5, AC-13): выделяем текст карточки целиком —
     от заголовка до последнего блока ответов, без кнопок и сообщения */
  function selectCardText() {
    if (!window.getSelection || !document.createRange) {
      return;
    }
    var range = document.createRange();
    range.setStartBefore($("card-title"));
    range.setEndAfter($("card-list"));
    var selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function copyCard() {
    var text = buildCardText();
    function fallback() {
      showCopyStatus(cfg.texts.copyError, true);
      selectCardText();
    }
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      navigator.clipboard.writeText(text).then(function () {
        showCopyStatus(cfg.texts.copySuccess, false);
      }, fallback);
    } else {
      /* Clipboard API недоступен (S-5, R9) */
      fallback();
    }
  }

  function newForm() {
    answers = emptyAnswers();
    state.step = 1;
    state.editFromReview = false;
    /* FR-09 / AC-15: черновик и результат очищаются, reload ничего не вернёт */
    App.storage.clearDraft();
    App.storage.clearResult();
    showScreen("welcome");
  }

  /* ---------- Черновик (FR-09, AC-14) ---------- */

  function continueDraft() {
    state.editFromReview = false;
    /* answers и step уже восстановлены при загрузке приложения */
    showForm();
  }

  function restartDraft() {
    App.storage.clearDraft();
    answers = emptyAnswers();
    state.step = 1;
    state.editFromReview = false;
    showScreen("welcome");
  }

  /* ---------- Обработчики ---------- */

  function onFieldInput(event) {
    var el = event.target;
    if (!el.id || el.id.indexOf("field-") !== 0) {
      return;
    }
    var id = el.id.slice("field-".length);
    if (!(id in cfg.fields)) {
      return;
    }
    answers[id] = el.type === "checkbox" ? el.checked : el.value;
    /* Исправление значения снимает сообщение об ошибке */
    clearFieldError(id);
    /* FR-09: сохранение черновика при каждом изменении */
    App.storage.saveDraft(answers, state.step);
  }

  function init() {
    /* Ключевые тексты — только из config.js (ТЗ §10) */
    $("welcome-text").textContent = cfg.texts.welcome;
    $("draft-title").textContent = cfg.texts.draftTitle;
    $("review-title").textContent = cfg.texts.reviewTitle;
    $("review-subtitle").textContent = cfg.texts.reviewSubtitle;
    $("thanks-text").textContent = cfg.texts.thanks;
    $("card-title").textContent = cfg.texts.cardTitle;

    $("btn-start").addEventListener("click", startForm);
    $("btn-next").addEventListener("click", goNext);
    $("btn-prev").addEventListener("click", goPrev);
    $("btn-submit").addEventListener("click", submit);
    $("btn-open-card").addEventListener("click", openCard);
    $("btn-copy").addEventListener("click", copyCard);
    $("btn-copy").textContent = cfg.texts.copyBtn;
    $("btn-new-form").addEventListener("click", newForm);
    $("btn-continue").addEventListener("click", continueDraft);
    $("btn-restart").addEventListener("click", restartDraft);

    var stepContainer = $("step-container");
    stepContainer.addEventListener("input", onFieldInput);
    stepContainer.addEventListener("change", onFieldInput);

    $("review-list").addEventListener("click", function (event) {
      var block = event.target.closest("[data-field]");
      if (block) {
        openAnswer(block.getAttribute("data-field"));
      }
    });

    /* Стартовое состояние (FR-09):
       1) есть черновик  → экран «Мы сохранили ваши ответы» (AC-14);
       2) есть результат → экран завершения, карточка доступна после перезагрузки;
       3) иначе          → начальный экран */
    var draft = App.storage.loadDraft();
    if (draft) {
      answers = mergeAnswers(draft.answers);
      state.step = draft.step;
      showScreen("draft");
      return;
    }
    var result = App.storage.loadResult();
    if (result) {
      answers = mergeAnswers(result.answers);
      state.step = cfg.steps.length;
      showScreen("thanks");
      return;
    }
    showScreen("welcome");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  /* Экспозиция для последующих итераций */
  App.state = state;
  App.getAnswers = function () { return answers; };
})();
