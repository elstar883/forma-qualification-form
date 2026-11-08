/* validation.js — чистые функции валидации (ТЗ_MVP.md §8.1, FR-02).
   Без доступа к DOM: принимают идентификатор шага и объект ответов,
   возвращают { ok, errors: {fieldId: message}, firstInvalid }. */
window.App = window.App || {};

App.validation = (function () {
  "use strict";

  var cfg = App.config;
  var msg = cfg.messages;

  /* Имя: буквы (в т.ч. кириллица), пробел, дефис, апостроф — ТЗ §8.1 */
  var NAME_RE = /^[\p{L} \-']+$/u;

  /* Телефон: 11 цифр, начиная с 7 или 8, после удаления всех нецифровых знаков
     (пробелы, скобки, дефисы, «+» из примера +7 900 000-00-00) — ТЗ §8.1 */
  function isPhone(value) {
    var digits = value.replace(/[^0-9]/g, "");
    return /^[0-9]{11}$/.test(digits) && (digits.charAt(0) === "7" || digits.charAt(0) === "8");
  }

  /* Telegram: @ + 4–32 символа [A-Za-z0-9_] — ТЗ §8.1 */
  function isTelegram(value) {
    return /^@[A-Za-z0-9_]{4,32}$/.test(value);
  }

  /* Площадь: целое или дробное с не более одним знаком, от 1 до 10 000 — ТЗ §8.1 */
  function isArea(value) {
    var normalized = value.replace(",", ".");
    if (!/^[0-9]{1,5}(\.[0-9])?$/.test(normalized)) {
      return false;
    }
    var n = parseFloat(normalized);
    return n >= 1 && n <= 10000;
  }

  function hasOption(fieldDef, value) {
    return fieldDef.options.indexOf(value) !== -1;
  }

  /* Валидация одного поля. Для необязательных: пустое значение всегда валидно. */
  function validateField(fieldId, answers) {
    var f = cfg.fields[fieldId];
    var raw = answers[fieldId];

    if (f.type === "checkbox") {
      if (!f.required) return { ok: true };
      return raw === true ? { ok: true } : { ok: false, message: msg.consent };
    }

    if (f.type === "select") {
      var selected = String(raw || "").trim();
      if (!selected) {
        return f.required ? { ok: false, message: msg.select } : { ok: true };
      }
      return hasOption(f, selected) ? { ok: true } : { ok: false, message: msg.select };
    }

    /* Текстовые поля */
    var value = String(raw || "").trim();
    if (!value) {
      if (!f.required) return { ok: true };
      switch (fieldId) {
        case "name": return { ok: false, message: msg.name };
        case "contact": return { ok: false, message: msg.contact };
        case "area": return { ok: false, message: msg.area };
        default: return { ok: false, message: msg.select };
      }
    }

    switch (fieldId) {
      case "name":
        return value.length >= 2 && value.length <= 50 && NAME_RE.test(value)
          ? { ok: true }
          : { ok: false, message: msg.name };
      case "contact":
        return isPhone(value) || isTelegram(value)
          ? { ok: true }
          : { ok: false, message: msg.contact };
      case "area":
        return isArea(value) ? { ok: true } : { ok: false, message: msg.area };
      default:
        /* Необязательные текстовые: ограничение длины (ТЗ §8.2) */
        return value.length <= 100
          ? { ok: true }
          : { ok: false, message: msg.optionalLength };
    }
  }

  /* Блокирует переход только из-за обязательных полей (FR-02, FR-13) */
  function validateStep(stepIndex, answers) {
    var step = cfg.steps[stepIndex - 1];
    var errors = {};
    var firstInvalid = null;

    step.fields.forEach(function (fieldId) {
      if (!cfg.fields[fieldId].required) return;
      var result = validateField(fieldId, answers);
      if (!result.ok) {
        errors[fieldId] = result.message;
        if (firstInvalid === null) firstInvalid = fieldId;
      }
    });

    return {
      ok: firstInvalid === null,
      errors: errors,
      firstInvalid: firstInvalid
    };
  }

  /* Первый шаг с непройденными обязательными полями; 0 — если всё валидно */
  function validateAll(answers) {
    for (var i = 1; i <= cfg.steps.length; i++) {
      if (!validateStep(i, answers).ok) return i;
    }
    return 0;
  }

  return {
    validateField: validateField,
    validateStep: validateStep,
    validateAll: validateAll,
    /* экспортируется для приёмочных проверок */
    isPhone: isPhone,
    isTelegram: isTelegram,
    isArea: isArea
  };
})();
