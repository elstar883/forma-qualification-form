/* config.js — единственный источник текстов, словарей и шагов (ТЗ_MVP.md §7, §8, §10).
   Никакие строки интерфейса не дублируются в других файлах. */
window.App = window.App || {};

App.config = (function () {
  "use strict";

  /* Словари значений — дословно по ТЗ §8.1 и §8.2 */
  var OPTIONS = {
    objectType: ["Квартира", "Дом", "Другое"],
    location: [
      "Москва",
      "Московская область, до 30 км от МКАД",
      "Московская область, дальше 30 км от МКАД",
      "Другой город",
      "Пока не знаю"
    ],
    service: [
      "Полный дизайн-проект",
      "Дизайн-проект и комплектация",
      "Авторский надзор к проекту",
      "Разовая консультация",
      "Пока не знаю"
    ],
    startTiming: [
      "В течение 3 месяцев",
      "Через 3–6 месяцев",
      "Через 6–9 месяцев",
      "Через 9–24 месяца",
      "Более чем через 24 месяца",
      "Пока не знаю"
    ],
    budget: [
      "До 90 тыс.",
      "90–120 тыс.",
      "120–180 тыс.",
      "Более 180 тыс.",
      "Пока не знаю"
    ],
    source: ["Сайт", "Рекомендация", "Telegram", "WhatsApp", "Instagram", "Другое"]
  };

  /* Поля: label — из ТЗ §8, hint — требование FR-11 / AC-16 */
  var fields = {
    name: {
      label: "Имя",
      type: "text",
      required: true,
      maxlength: 50
    },
    contact: {
      label: "Контакт",
      type: "text",
      required: true,
      hint: "Например: +7 900 000-00-00 или @username"
    },
    objectType: {
      label: "Тип объекта",
      type: "select",
      required: true,
      options: OPTIONS.objectType
    },
    area: {
      label: "Площадь, м²",
      type: "text",
      required: true,
      hint: "В квадратных метрах, например 70",
      inputmode: "decimal"
    },
    location: {
      label: "Локация",
      type: "select",
      required: true,
      options: OPTIONS.location
    },
    district: {
      label: "Район или населённый пункт",
      type: "text",
      required: false,
      maxlength: 100
    },
    service: {
      label: "Услуга",
      type: "select",
      required: true,
      options: OPTIONS.service
    },
    startTiming: {
      label: "Когда начнётся ремонт",
      type: "select",
      required: true,
      options: OPTIONS.startTiming
    },
    budget: {
      label: "Бюджет на реализацию, ₽/м²",
      type: "select",
      required: true,
      hint: "На реализацию интерьера, за квадратный метр",
      options: OPTIONS.budget
    },
    decisionMaker: {
      label: "Кто принимает решение о заказе",
      type: "text",
      required: false,
      maxlength: 100
    },
    source: {
      label: "Откуда узнали о студии",
      type: "select",
      required: false,
      options: OPTIONS.source
    },
    consent: {
      label: "Согласие",
      type: "checkbox",
      required: true,
      checkboxText: "Я подтверждаю, что указал(а) корректные данные"
    }
  };

  /* Шаги формы (план §5: 6 шагов заполнения + экран проверки) */
  var steps = [
    { title: "Контакты", fields: ["name", "contact"] },
    { title: "Объект", fields: ["objectType", "area"] },
    { title: "Локация", fields: ["location", "district"] },
    { title: "Проект", fields: ["service", "startTiming"] },
    { title: "Бюджет", fields: ["budget"] },
    { title: "Дополнительно", fields: ["decisionMaker", "source", "consent"] }
  ];

  return {
    fields: fields,
    steps: steps,
    options: OPTIONS,
    /* Прогресс (FR-03): «Шаг N из 6» */
    progressText: function (n) {
      return "Шаг " + n + " из " + steps.length;
    },
    /* Ключевые тексты — дословно по ТЗ §10 */
    texts: {
      welcome: "Анкета для будущего проекта. Ответьте на вопросы — менеджер соберёт карточку и свяжется с вами. Ответы можно проверить перед отправкой",
      draftTitle: "Мы сохранили ваши ответы",
      reviewTitle: "Проверка ответов",
      reviewSubtitle: "Нажмите на блок, чтобы изменить ответ",
      thanks: "Спасибо, менеджер свяжется с вами",
      cardTitle: "Карточка обращения FORMA",
      /* Отображаемое значение отмеченного согласия в карточке («поле: значение») */
      consentValue: "Да",
      /* Копирование карточки (FR-08): кнопка и результаты, дословно по ТЗ §10 */
      copyBtn: "Копировать карточку",
      copySuccess: "Карточка скопирована",
      copyError: "Не удалось скопировать автоматически. Выделите текст карточки и скопируйте вручную"
    },
    /* Сообщения валидации — дословно по ТЗ §10. optionalLength выводится только
       при превышении лимита из ТЗ §8.2 (достигнуть нельзя: есть maxlength) */
    messages: {
      name: "Укажите имя — минимум 2 символа",
      contact: "Укажите телефон (например, +7 900 000-00-00) или Telegram (@username)",
      select: "Выберите один из вариантов",
      area: "Укажите число от 1 до 10 000",
      consent: "Отметьте подтверждение, чтобы отправить",
      optionalLength: "Не более 100 символов"
    }
  };
})();
