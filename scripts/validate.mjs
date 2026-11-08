#!/usr/bin/env node
/*
 * Проверка целостности статического приложения «FORMA — анкета квалификации
 * обращений».
 *
 * Скрипт не запускает браузер и не требует зависимостей:
 *  - проверяет обязательные файлы и метаданные репозитория;
 *  - проверяет разметку, стили и отсутствие внешних ресурсов;
 *  - исполняет validation.js, qualification.js и storage.js в изолированном
 *    контексте и прогоняет контрольные примеры L-001…L-008;
 *  - проверяет синтаксис всех файлов приложения.
 */

import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import vm from "node:vm";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path) => readFile(join(root, path), "utf8");

const errors = [];
const check = (condition, message) => {
  if (!condition) errors.push(message);
};

const readJson = async (path) => JSON.parse(await read(path));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const includesText = (source, text) => source.includes(text);

/* ---------- Обязательные файлы ---------- */

const requiredFiles = [
  "app/index.html",
  "app/css/styles.css",
  "app/js/config.js",
  "app/js/validation.js",
  "app/js/qualification.js",
  "app/js/storage.js",
  "app/js/app.js",
  "references/README.md",
  "references/requirements.md",
  "references/acceptance-report.md",
  "references/source/01-client-request.md",
  "references/source/02-company.md",
  "references/source/03-interview.md",
  "references/source/04-current-process.md",
  "references/source/05-sample-leads.csv",
  "references/source/06-constraints.md",
  "references/source/07-client-answers.md",
  "docs/ARCHITECTURE.md",
  "docs/DATA-MODEL.md",
  "docs/QUALIFICATION-RULES.md",
  "docs/QA-CHECKLIST.md",
  "docs/images/welcome-desktop.png",
  "docs/images/form-step-1.png",
  "docs/images/validation-error.png",
  "docs/images/review-desktop.png",
  "docs/images/card-priority.png",
  "docs/images/card-clarify.png",
  "docs/images/card-format.png",
  "docs/images/welcome-mobile.png",
  "docs/images/card-mobile.png",
  "README.md",
  "LICENSE",
  "AGENTS.md",
  "CONTRIBUTING.md",
  "Makefile",
  "package.json",
  "scripts/validate.mjs",
  ".editorconfig",
  ".gitattributes",
  ".gitignore",
  ".github/workflows/tests.yml",
  "opencode.json",
  ".opencode/skills/forma-qualification-form/SKILL.md",
  ".opencode/commands/forma-plan.md",
  ".opencode/commands/forma-build.md",
  ".opencode/commands/forma-qa.md",
];

for (const file of requiredFiles) {
  try {
    await read(file);
  } catch {
    check(false, `нет обязательного файла: ${file}`);
  }
}

/* ---------- Метаданные репозитория ---------- */

const packageJson = await readJson("package.json");
check(packageJson.name === "forma-qualification-form", "неожиданное имя пакета");
check(packageJson.type === "module", 'в package.json должно быть "type": "module"');
check(packageJson.version === "1.0.0", "версия package.json должна быть 1.0.0");
check(packageJson.license === "MIT", "лицензия в package.json должна быть MIT");
check(
  !packageJson.dependencies && !packageJson.devDependencies,
  "у приложения не должно быть npm-зависимостей",
);
check(
  packageJson.scripts?.check === "node scripts/validate.mjs",
  "в package.json должен быть скрипт check",
);

const gitignore = await read(".gitignore");
for (const pattern of [".DS_Store", ".env", "*.zip", "*.pdf"]) {
  check(gitignore.includes(pattern), `.gitignore должен исключать ${pattern}`);
}

/* ---------- Артефакты ---------- */

const ignoredDirectories = new Set([".git", "node_modules", ".playwright-mcp", "02_Рабочие_шаблоны"]);
const artifacts = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(absolute);
    } else {
      const path = relative(root, absolute);
      if (
        entry.name === ".DS_Store" ||
        entry.name === ".env" ||
        /\.(zip|pdf)$/i.test(entry.name)
      ) {
        artifacts.push(path);
      }
    }
  }
}
await walk(root);
check(artifacts.length === 0, `в репозитории не должно быть артефактов: ${artifacts.join(", ")}`);

/* ---------- Разметка ---------- */

const html = await read("app/index.html");
const requiredIds = [
  "screen-welcome",
  "welcome-text",
  "btn-start",
  "screen-draft",
  "draft-title",
  "btn-continue",
  "btn-restart",
  "screen-form",
  "progress",
  "step-container",
  "btn-prev",
  "btn-next",
  "screen-review",
  "review-title",
  "review-subtitle",
  "review-list",
  "btn-submit",
  "screen-thanks",
  "thanks-text",
  "btn-open-card",
  "screen-card",
  "card-title",
  "card-status",
  "card-list",
  "btn-copy",
  "btn-new-form",
  "copy-status",
];

for (const id of requiredIds) {
  check(html.includes(`id="${id}"`), `в app/index.html нет элемента #${id}`);
}

check(html.includes('lang="ru"'), 'app/index.html должен быть на русском языке');
check(html.includes('name="viewport"'), "app/index.html должен содержать viewport");
check(html.includes("styles.css"), "app/index.html должен подключать styles.css");
for (const script of ["config.js", "validation.js", "qualification.js", "storage.js", "app.js"]) {
  check(html.includes(`src="js/${script}"`), `app/index.html должен подключать js/${script}`);
}
check(
  !/<script(?![^>]*\bsrc=)/i.test(html),
  "app/index.html не должен содержать встроенных скриптов",
);

const externalRefs = [...html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)]
  .map((match) => match[1])
  .filter((value) => /^(?:https?:)?\/\//i.test(value));
check(externalRefs.length === 0, `app/index.html загружает внешние ресурсы: ${externalRefs.join(", ")}`);

const screens = [...html.matchAll(/<section\b[^>]*\bclass="screen(?:\s[^"]*)?"/g)];
check(screens.length === 6, `app/index.html должен содержать шесть экранов, найдено ${screens.length}`);
check(
  html.includes('aria-live="polite"'),
  "app/index.html должен содержать aria-live у динамических сообщений",
);

/* ---------- Стили ---------- */

const css = await read("app/css/styles.css");
check(!/@import/i.test(css), "app/css/styles.css не должен использовать @import");
check(
  !/url\(\s*["']?(?:https?:)?\/\//i.test(css),
  "app/css/styles.css не должен загружать внешние ресурсы",
);
check(css.includes("--accent: #C86B4A"), "акцент бренда должен быть #C86B4A");
check(css.includes("--bg: #FAF9F7"), "светлый фон должен быть #FAF9F7");
check(css.includes("min-height: 44px"), "интерактивные элементы должны быть не меньше 44 px");
check(css.includes("font-size: 16px"), "основной текст должен быть не меньше 16 px");
check(css.includes("@media (max-width: 480px)"), "нужен мобильный медиазапрос до 480 px");
check(css.includes(".status-reasons"), "в стилях должен быть блок причин статуса");
check(css.includes(".copy-status"), "в стилях должно быть сообщение о копировании");

/* ---------- Исполнение чистых модулей ---------- */

const store = new Map();
const localStorageStub = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => {
    store.set(key, String(value));
  },
  removeItem: (key) => {
    store.delete(key);
  },
  clear: () => store.clear(),
};

const namespace = {};
const context = vm.createContext({
  window: { App: namespace, localStorage: localStorageStub },
  App: namespace,
  console,
});

for (const file of ["config.js", "validation.js", "qualification.js", "storage.js"]) {
  const source = await read(`app/js/${file}`);
  try {
    vm.runInContext(source, context, { filename: `app/js/${file}` });
  } catch (error) {
    check(false, `не удалось исполнить app/js/${file}: ${error.message}`);
  }
}

const App = namespace;
const config = App.config;
const validation = App.validation;
const qualification = App.qualification;
const storage = App.storage;

check(Boolean(config), "config.js не создал App.config");
check(Boolean(validation), "validation.js не создал App.validation");
check(Boolean(qualification), "qualification.js не создал App.qualification");
check(Boolean(storage), "storage.js не создал App.storage");

if (config && validation && qualification && storage) {
  /* ---------- Конфигурация ---------- */

  const fieldIds = Object.keys(config.fields);
  const required = fieldIds.filter((id) => config.fields[id].required);
  const optional = fieldIds.filter((id) => !config.fields[id].required);

  check(fieldIds.length === 12, `должно быть 12 полей, получено ${fieldIds.length}`);
  check(required.length === 9, `должно быть 9 обязательных полей, получено ${required.length}`);
  check(optional.length === 3, `должно быть 3 необязательных поля, получено ${optional.length}`);
  check(config.steps.length === 6, `должно быть 6 шагов, получено ${config.steps.length}`);

  const stepFields = config.steps.flatMap((step) => step.fields);
  check(stepFields.length === 12, "каждое из 12 полей должно входить ровно в один шаг");
  check(new Set(stepFields).size === 12, "поля не должны повторяться в шагах");
  check(
    fieldIds.every((id) => stepFields.includes(id)),
    "все поля из config.fields должны присутствовать в шагах",
  );

  check(includesText(config.progressText(1), "Шаг 1 из 6"), "прогресс шага 1 должен быть «Шаг 1 из 6»");
  check(includesText(config.progressText(6), "Шаг 6 из 6"), "прогресс шага 6 должен быть «Шаг 6 из 6»");

  const expectedOptions = {
    objectType: ["Квартира", "Дом", "Другое"],
    location: [
      "Москва",
      "Московская область, до 30 км от МКАД",
      "Московская область, дальше 30 км от МКАД",
      "Другой город",
      "Пока не знаю",
    ],
    service: [
      "Полный дизайн-проект",
      "Дизайн-проект и комплектация",
      "Авторский надзор к проекту",
      "Разовая консультация",
      "Пока не знаю",
    ],
    startTiming: [
      "В течение 3 месяцев",
      "Через 3–6 месяцев",
      "Через 6–9 месяцев",
      "Через 9–24 месяца",
      "Более чем через 24 месяца",
      "Пока не знаю",
    ],
    budget: ["До 90 тыс.", "90–120 тыс.", "120–180 тыс.", "Более 180 тыс.", "Пока не знаю"],
    source: ["Сайт", "Рекомендация", "Telegram", "WhatsApp", "Instagram", "Другое"],
  };
  for (const [key, options] of Object.entries(expectedOptions)) {
    check(same(config.options[key], options), `словарь ${key} не совпадает с требованиями`);
  }

  const expectedTexts = {
    welcome:
      "Анкета для будущего проекта. Ответьте на вопросы — менеджер соберёт карточку и свяжется с вами. Ответы можно проверить перед отправкой",
    draftTitle: "Мы сохранили ваши ответы",
    reviewTitle: "Проверка ответов",
    reviewSubtitle: "Нажмите на блок, чтобы изменить ответ",
    thanks: "Спасибо, менеджер свяжется с вами",
    cardTitle: "Карточка обращения FORMA",
    consentValue: "Да",
    copyBtn: "Копировать карточку",
    copySuccess: "Карточка скопирована",
    copyError:
      "Не удалось скопировать автоматически. Выделите текст карточки и скопируйте вручную",
  };
  for (const [key, value] of Object.entries(expectedTexts)) {
    check(config.texts[key] === value, `текст config.texts.${key} не совпадает с ТЗ §10`);
  }

  const expectedMessages = {
    name: "Укажите имя — минимум 2 символа",
    contact: "Укажите телефон (например, +7 900 000-00-00) или Telegram (@username)",
    select: "Выберите один из вариантов",
    area: "Укажите число от 1 до 10 000",
    consent: "Отметьте подтверждение, чтобы отправить",
    optionalLength: "Не более 100 символов",
  };
  for (const [key, value] of Object.entries(expectedMessages)) {
    check(config.messages[key] === value, `сообщение config.messages.${key} не совпадает с ТЗ §10`);
  }

  /* ---------- Валидация ---------- */

  const emptyAnswers = () => {
    const answers = {};
    for (const id of fieldIds) {
      answers[id] = config.fields[id].type === "checkbox" ? false : "";
    }
    return answers;
  };

  const validPriority = {
    name: "Ольга",
    contact: "+7 900 000-00-00",
    objectType: "Квартира",
    area: "96",
    location: "Москва",
    district: "",
    service: "Полный дизайн-проект",
    startTiming: "В течение 3 месяцев",
    budget: "Более 180 тыс.",
    decisionMaker: "",
    source: "",
    consent: true,
  };

  check(validation.isPhone("+7 900 000-00-00") === true, "телефон +7 900 000-00-00 должен проходить");
  check(validation.isPhone("8 (900) 000-00-00") === true, "телефон 8 (900) 000-00-00 должен проходить");
  check(validation.isPhone("abc") === false, "текст abc не должен проходить как телефон");
  check(validation.isPhone("+7 900 000-00-0") === false, "короткий телефон не должен проходить");

  check(validation.isTelegram("@username") === true, "Telegram @username должен проходить");
  check(validation.isTelegram("username") === false, "Telegram без @ не должен проходить");
  check(validation.isTelegram("@abc") === false, "Telegram из трёх символов не должен проходить");
  check(
    validation.isTelegram("@" + "a".repeat(33)) === false,
    "Telegram длиннее 32 символов не должен проходить",
  );

  check(validation.isArea("1") === true, "площадь 1 должна проходить");
  check(validation.isArea("70") === true, "площадь 70 должна проходить");
  check(validation.isArea("70,5") === true, "площадь 70,5 должна проходить");
  check(validation.isArea("70.5") === true, "площадь 70.5 должна проходить");
  check(validation.isArea("10000") === true, "площадь 10 000 должна проходить");
  check(validation.isArea("0") === false, "площадь 0 не должна проходить");
  check(validation.isArea("10001") === false, "площадь 10 001 не должна проходить");
  check(validation.isArea("70.55") === false, "два знака после запятой не должны проходить");

  const emptyStep = validation.validateStep(1, emptyAnswers());
  check(emptyStep.ok === false, "пустой шаг 1 должен быть невалидным");
  check(emptyStep.firstInvalid === "name", "первым невалидным полем должно быть имя");
  check(emptyStep.errors.name === config.messages.name, "сообщение об имени не совпадает");

  check(
    validation.validateStep(1, { ...emptyAnswers(), name: "Ольга", contact: "@username" }).ok === true,
    "шаг 1 с валидными именем и Telegram должен проходить",
  );

  check(
    validation.validateStep(6, { ...validPriority, consent: false }).ok === false,
    "шаг 6 без согласия должен быть невалидным",
  );
  check(
    validation.validateStep(6, { ...validPriority, consent: false }).errors.consent ===
      config.messages.consent,
    "сообщение о согласии не совпадает",
  );

  check(validation.validateAll(validPriority) === 0, "полная приоритетная анкета должна быть валидной");
  check(
    validation.validateAll({ ...validPriority, area: "0" }) === 2,
    "ошибка площади должна возвращать шаг 2",
  );
  check(
    validation.validateField("district", { district: "x".repeat(101) }).ok === false,
    "необязательное поле длиннее 100 символов не должно проходить",
  );
  check(
    validation.validateField("district", { district: "" }).ok === true,
    "пустое необязательное поле должно проходить",
  );
  check(
    validation.validateField("name", { name: "Анна-Мария" }).ok === true,
    "имя с дефисом должно проходить",
  );
  check(
    validation.validateField("name", { name: "Ольга1" }).ok === false,
    "имя с цифрой не должно проходить",
  );

  /* ---------- Квалификация ---------- */

  const base = emptyAnswers();
  const qualify = (answers) => qualification.qualify({ ...base, ...answers });

  check(
    same(Object.values(qualification.STATUS).sort(), ["Не наш формат", "Нужно уточнить", "Приоритетная"].sort()),
    "набор статусов не совпадает с ТЗ",
  );

  const cases = [
    {
      id: "L-001",
      answers: {
        area: "82",
        location: "Москва",
        service: "Полный дизайн-проект",
        startTiming: "Через 3–6 месяцев",
        budget: "120–180 тыс.",
      },
      expected: "Приоритетная",
      reason: "Все ключевые параметры проходят",
    },
    {
      id: "L-002",
      answers: {
        area: "36",
        location: "Москва",
        service: "Разовая консультация",
        startTiming: "Пока не знаю",
        budget: "Пока не знаю",
      },
      expected: "Не наш формат",
      reason: "Запрошена только разовая консультация",
    },
    {
      id: "L-003",
      answers: {
        area: "210",
        location: "Московская область, дальше 30 км от МКАД",
        service: "Полный дизайн-проект",
        startTiming: "Через 6–9 месяцев",
        budget: "120–180 тыс.",
      },
      expected: "Нужно уточнить",
      reason: "География объекта требует уточнения",
    },
    {
      id: "L-004",
      answers: {
        area: "64",
        location: "Москва",
        service: "Полный дизайн-проект",
        startTiming: "Через 9–24 месяца",
        budget: "90–120 тыс.",
      },
      expected: "Нужно уточнить",
      reason: "Срок старта ремонта вне приоритетного окна",
    },
    {
      id: "L-005",
      answers: {
        area: "57",
        location: "Москва",
        service: "Полный дизайн-проект",
        startTiming: "В течение 3 месяцев",
        budget: "Пока не знаю",
      },
      expected: "Нужно уточнить",
      reason: "Бюджет не подтверждён",
    },
    {
      id: "L-006",
      answers: {
        area: "145",
        location: "Другой город",
        service: "Полный дизайн-проект",
        startTiming: "Через 3–6 месяцев",
        budget: "Более 180 тыс.",
      },
      expected: "Нужно уточнить",
      reason: "География объекта требует уточнения",
    },
    {
      id: "L-007",
      answers: {
        area: "48",
        location: "Москва",
        service: "Пока не знаю",
        startTiming: "Через 6–9 месяцев",
        budget: "120–180 тыс.",
      },
      expected: "Нужно уточнить",
      reason: "Состав услуги не определён",
    },
    {
      id: "L-008",
      answers: {
        area: "96",
        location: "Москва",
        service: "Полный дизайн-проект",
        startTiming: "В течение 3 месяцев",
        budget: "Более 180 тыс.",
      },
      expected: "Приоритетная",
      reason: "Все ключевые параметры проходят",
    },
  ];

  for (const testCase of cases) {
    const result = qualify(testCase.answers);
    check(
      result.status === testCase.expected,
      `${testCase.id}: ожидался статус «${testCase.expected}», получен «${result.status}»`,
    );
    check(
      result.reasons.some((reason) => reason.includes(testCase.reason)),
      `${testCase.id}: нет причины «${testCase.reason}»`,
    );
  }

  const priorityResult = qualify(cases[7].answers);
  check(priorityResult.reasons.length === 1, "у приоритетной заявки должна быть одна причина BR-01");

  const withOptional = qualify({
    ...cases[7].answers,
    district: "Хамовники",
    decisionMaker: "Ольга",
    source: "Рекомендация",
  });
  check(
    withOptional.status === priorityResult.status && same(withOptional.reasons, priorityResult.reasons),
    "необязательные поля не должны менять статус и причины",
  );

  const fatal = qualify({
    area: "40",
    location: "Другой город",
    service: "Разовая консультация",
    startTiming: "Более чем через 24 месяца",
    budget: "До 90 тыс.",
  });
  check(fatal.status === "Не наш формат", "несколько исключений должны давать «Не наш формат»");
  check(fatal.reasons.length >= 3, "при нескольких правилах должны быть перечислены все причины");

  const boundary = qualify({
    area: "44,9",
    location: "Москва",
    service: "Полный дизайн-проект",
    startTiming: "В течение 3 месяцев",
    budget: "Более 180 тыс.",
  });
  check(boundary.status === "Нужно уточнить", "площадь 44,9 должна попадать в «Нужно уточнить»");

  const border45 = qualify({
    area: "45",
    location: "Москва",
    service: "Полный дизайн-проект",
    startTiming: "В течение 3 месяцев",
    budget: "Более 180 тыс.",
  });
  check(border45.status === "Приоритетная", "площадь 45 должна проходить как приоритетная");

  const safety = qualify({
    ...cases[7].answers,
    service: "Неизвестная услуга",
  });
  check(
    safety.status === "Нужно уточнить" && safety.reasons.some((reason) => reason.startsWith("Не проходит:")),
    "страховочная ветка BR-10 должна перечислять непройденные критерии",
  );

  /* ---------- Хранилище ---------- */

  storage.clearDraft();
  storage.clearResult();
  check(storage.draftExists() === false, "после очистки черновика не должно быть");

  storage.saveDraft({ name: "Иван", contact: "@ivan_test" }, 2);
  check(storage.draftExists() === true, "черновик должен сохраняться");
  check(
    same(storage.loadDraft(), { answers: { name: "Иван", contact: "@ivan_test" }, step: 2 }),
    "черновик должен восстанавливаться с ответами и шагом",
  );

  storage.saveDraft({ name: "Иван" }, 7);
  check(storage.loadDraft() === null, "черновик с шагом вне диапазона должен игнорироваться");

  store.set("forma.draft", "{bad json");
  check(storage.loadDraft() === null, "повреждённый JSON должен возвращать null");
  check(store.has("forma.draft") === false, "повреждённый черновик должен удаляться");

  store.set("forma.draft", JSON.stringify({ answers: [], step: 1 }));
  check(storage.loadDraft() === null, "черновик с массивом вместо ответов должен игнорироваться");

  storage.saveResult({ name: "Ольга", area: "96" });
  check(
    same(storage.loadResult(), { answers: { name: "Ольга", area: "96" } }),
    "результат должен восстанавливаться",
  );
  storage.clearResult();
  check(storage.loadResult() === null, "после очистки результата не должно быть");

  storage.clearDraft();
  check(storage.draftExists() === false, "clearDraft должен удалять ключ");
}

/* ---------- Исходники приложения ---------- */

const appSource = await read("app/js/app.js");
const allJs = await Promise.all(
  ["config.js", "validation.js", "qualification.js", "storage.js", "app.js"].map((file) =>
    read(`app/js/${file}`),
  ),
);

for (const fn of [
  "showScreen",
  "renderStep",
  "validateCurrentStep",
  "goNext",
  "goPrev",
  "showReview",
  "openAnswer",
  "submit",
  "openCard",
  "renderCardStatus",
  "buildCardText",
  "copyCard",
  "newForm",
  "continueDraft",
  "restartDraft",
  "init",
]) {
  check(appSource.includes(`function ${fn}`), `в app/js/app.js нет функции ${fn}`);
}

for (const screen of ["welcome", "draft", "form", "review", "thanks", "card"]) {
  check(appSource.includes(`"${screen}"`), `в app/js/app.js нет экрана ${screen}`);
}

check(
  appSource.includes("navigator.clipboard.writeText"),
  "app.js должен использовать Clipboard API",
);
check(appSource.includes("selectCardText"), "app.js должен содержать текстовый fallback");
check(appSource.includes("document.createRange"), "fallback должен выделять текст карточки");

const storageSource = await read("app/js/storage.js");
check(storageSource.includes("forma.draft"), "storage.js должен использовать ключ forma.draft");
check(storageSource.includes("forma.result"), "storage.js должен использовать ключ forma.result");
check(storageSource.includes("window.localStorage"), "storage.js должен работать с localStorage");

const forbidden = /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|import\s*\(|\bsessionStorage\b/;
for (const source of allJs) {
  check(!forbidden.test(source), "JavaScript приложения не должен обращаться к сети или sessionStorage");
}

const clientSources = [
  await read("app/index.html"),
  await read("app/js/config.js"),
  await read("app/js/validation.js"),
  await read("app/js/storage.js"),
  appSource,
].join("\n");
for (const word of ["Не наш формат", "отказ", "неподходящий"]) {
  check(!clientSources.includes(word), `клиентские файлы не должны содержать «${word}»`);
}

/* ---------- README и документация ---------- */

const readme = await read("README.md");
for (const heading of [
  "Проблема",
  "Что умеет приложение",
  "Быстрый старт",
  "Скриншоты",
  "Как это устроено",
  "Квалификация",
  "Ограничения",
  "Лицензия",
]) {
  check(readme.includes(heading), `в README.md нет раздела «${heading}»`);
}
check(readme.includes("forma-qualification-form"), "README.md должен содержать имя репозитория");

const imageLinks = [...readme.matchAll(/!\[[^\]]*\]\((docs\/images\/[^)]+)\)/g)].map((match) => match[1]);
check(imageLinks.length >= 5, "README.md должен показывать не меньше пяти скриншотов");
for (const link of imageLinks) {
  try {
    await read(link);
  } catch {
    check(false, `в README.md ссылка на отсутствующий файл: ${link}`);
  }
}

const architecture = await read("docs/ARCHITECTURE.md");
check(architecture.includes("localStorage"), "docs/ARCHITECTURE.md должен описывать localStorage");
check(architecture.includes("qualification.js"), "docs/ARCHITECTURE.md должен описывать qualification.js");
check(architecture.includes("stateDiagram"), "docs/ARCHITECTURE.md должен содержать схему состояний");

const dataModel = await read("docs/DATA-MODEL.md");
check(dataModel.includes("forma.draft"), "docs/DATA-MODEL.md должен описывать forma.draft");
check(dataModel.includes("forma.result"), "docs/DATA-MODEL.md должен описывать forma.result");
check(dataModel.includes("12 полей"), "docs/DATA-MODEL.md должен фиксировать 12 полей");

const rules = await read("docs/QUALIFICATION-RULES.md");
for (const id of ["BR-01", "BR-02", "BR-05", "BR-10", "BR-14"]) {
  check(rules.includes(id), `docs/QUALIFICATION-RULES.md должен описывать ${id}`);
}
for (const lead of ["L-001", "L-002", "L-004", "L-008"]) {
  check(rules.includes(lead), `docs/QUALIFICATION-RULES.md должен содержать пример ${lead}`);
}

const qaChecklist = await read("docs/QA-CHECKLIST.md");
check(qaChecklist.includes("validate.mjs"), "docs/QA-CHECKLIST.md должен ссылаться на validate.mjs");
check(qaChecklist.includes("360"), "docs/QA-CHECKLIST.md должен проверять 360 px");

/* ---------- Синтаксис ---------- */

for (const file of ["config.js", "validation.js", "qualification.js", "storage.js", "app.js"]) {
  const syntax = spawnSync(process.execPath, ["--check", join(root, "app/js", file)], {
    encoding: "utf8",
  });
  check(
    syntax.status === 0,
    `синтаксис app/js/${file} не проходит node --check: ${(syntax.stderr || "").trim()}`,
  );
}

/* ---------- Итог ---------- */

if (errors.length > 0) {
  console.error(`Проверка не пройдена: ${errors.length} ошибок.`);
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log(
  "OK: 12 полей (9 обязательных, 3 необязательных), 6 шагов, 3 статуса, " +
    "8 контрольных лидов, валидация и localStorage.",
);
