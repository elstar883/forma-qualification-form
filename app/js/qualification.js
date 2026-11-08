/* qualification.js — дерево правил квалификации BR-01…BR-14 (ТЗ_MVP.md §9).
   Чистая функция: без DOM и без доступа к хранилищу.
   Вызывается ТОЛЬКО при открытии карточки менеджера (проектное решение РР-1),
   поэтому клиентские экраны физически не содержат статуса (FR-10, BR-12). */
window.App = window.App || {};

App.qualification = (function () {
  "use strict";

  var STATUS = {
    PRIORITY: "Приоритетная",
    CLARIFY: "Нужно уточнить",
    FORMAT: "Не наш формат"
  };

  /* Тексты причин — дословно по ТЗ §9.1 */
  var REASON = {
    BR01: "Все ключевые параметры проходят: площадь, география, услуга, сроки, бюджет",
    BR02: "Запрошена только разовая консультация. Менеджер может согласовать консультацию отдельно",
    BR03: "Бюджет ниже типового диапазона студии (от 120 тыс. ₽/м²)",
    BR04: "Старт ремонта более чем через два года",
    BR05: "Площадь меньше типовой для студии (от 45 м²)",
    BR06: "География объекта требует уточнения, включая формат работы",
    BR07: "Состав услуги не определён",
    BR08: "Срок старта ремонта вне приоритетного окна 9 месяцев или не определён",
    BR09: "Бюджет не подтверждён или ниже типового"
  };

  var PROJECT_SERVICES = [
    "Полный дизайн-проект",
    "Дизайн-проект и комплектация",
    "Авторский надзор к проекту"
  ];
  var PRIORITY_LOCATIONS = ["Москва", "Московская область, до 30 км от МКАД"];
  var CLARIFY_LOCATIONS = [
    "Московская область, дальше 30 км от МКАД",
    "Другой город",
    "Пока не знаю"
  ];
  var PRIORITY_STARTS = ["В течение 3 месяцев", "Через 3–6 месяцев", "Через 6–9 месяцев"];
  var CLARIFY_STARTS = ["Через 9–24 месяца", "Пока не знаю"];
  var PRIORITY_BUDGETS = ["120–180 тыс.", "Более 180 тыс."];
  var CLARIFY_BUDGETS = ["90–120 тыс.", "Пока не знаю"];

  function qualify(answers) {
    var fired = [];   /* сработавшие правила в порядке BR-02…BR-09 (BR-11) */

    /* --- Правила «Не наш формат» (BR-02…BR-04) и «Уточнить» (BR-05…BR-09) --- */

    if (answers.service === "Разовая консультация") {
      fired.push({ rule: "BR-02", text: REASON.BR02, fatal: true });
    }
    if (answers.budget === "До 90 тыс.") {
      fired.push({ rule: "BR-03", text: REASON.BR03, fatal: true });
    }
    if (answers.startTiming === "Более чем через 24 месяца") {
      fired.push({ rule: "BR-04", text: REASON.BR04, fatal: true });
    }

    var areaRaw = String(answers.area || "").trim().replace(",", ".");
    var area = parseFloat(areaRaw);
    var areaKnown = areaRaw !== "" && !isNaN(area);
    if (areaKnown && area < 45) {
      fired.push({ rule: "BR-05", text: REASON.BR05, fatal: false });
    }
    if (CLARIFY_LOCATIONS.indexOf(answers.location) !== -1) {
      fired.push({ rule: "BR-06", text: REASON.BR06, fatal: false });
    }
    if (answers.service === "Пока не знаю") {
      fired.push({ rule: "BR-07", text: REASON.BR07, fatal: false });
    }
    if (CLARIFY_STARTS.indexOf(answers.startTiming) !== -1) {
      fired.push({ rule: "BR-08", text: REASON.BR08, fatal: false });
    }
    if (CLARIFY_BUDGETS.indexOf(answers.budget) !== -1) {
      fired.push({ rule: "BR-09", text: REASON.BR09, fatal: false });
    }

    /* --- Критерии BR-01 --- */
    var checks = [
      { name: "площадь", passed: areaKnown && area >= 45 },
      { name: "география", passed: PRIORITY_LOCATIONS.indexOf(answers.location) !== -1 },
      { name: "услуга", passed: PROJECT_SERVICES.indexOf(answers.service) !== -1 },
      { name: "сроки", passed: PRIORITY_STARTS.indexOf(answers.startTiming) !== -1 },
      { name: "бюджет", passed: PRIORITY_BUDGETS.indexOf(answers.budget) !== -1 }
    ];
    var failed = checks.filter(function (c) { return !c.passed; })
                        .map(function (c) { return c.name; });

    /* --- Решение по приоритету BR-11: Не наш > Уточнить > Приоритетная --- */
    var status;
    var reasons = fired.map(function (f) { return f.text; });
    var hasFatal = fired.some(function (f) { return f.fatal; });

    if (hasFatal) {
      status = STATUS.FORMAT;
    } else if (fired.length > 0) {
      status = STATUS.CLARIFY;
    } else if (failed.length > 0) {
      /* BR-10: страховочная ветка — пограничный случай без сработавшего правила */
      status = STATUS.CLARIFY;
      reasons.push("Не проходит: " + failed.join(", "));
    } else {
      status = STATUS.PRIORITY;
      reasons = [REASON.BR01];
    }

    return { status: status, reasons: reasons };
  }

  return {
    STATUS: STATUS,
    qualify: qualify
  };
})();
