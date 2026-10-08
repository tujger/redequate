# React 19 / Vite: результат после исправлений

Обновлено 8 октября 2026. Реализован согласованный план удаления CRA runner,
переноса существующих тестов и миграции старого example. Node 24.21.0,
npm 11.19.0, Java 17.0.20.1. Framework по-прежнему собирается Rollup.

## Текущий статус

| Проверка | Результат |
| --- | --- |
| Vite migration: build system, scripts, tests и проверенные browser flows | **PASS** |
| React 19: весь ecosystem и legacy peer dependencies | **PARTIAL** |
| Полный production release / PWA upgrade / FCM / реальные OAuth и uploads | **NOT VERIFIED** |

Build-system часть Vite milestone теперь можно закрыть: React Scripts не нужны,
существующие тесты выполняются, сборки и проверенный runtime работают.
Это не закрывает React 19 compatibility milestone и не подтверждает полный
production release. Оставшиеся сценарии перечислены ниже.

## Основные изменения

CRA runner заменён Vitest/jsdom; существующие тесты используют createRoot/React.act,
DOM events и актуальные CSS Modules/component API. Redux Provider/connect
проверяются с настоящим store; UserData работает с локальными Auth/RTDB fixtures.
InputPicker получил aria-expanded/aria-haspopup без изменения логики дат.
Старый framework example перенесён на Vite/React 19 с base /redequate/.
TWT App smoke изолирует remote Firebase initialization.

После проверки добавленных файлов удалены неиспользуемая emulator-конфигурация
потребителя и два однострочных setup-файла; React act-настройка перенесена в
существующие test modules. Инструкции тестирования объединены с README.
Тесты framework/TWT и сборки framework/example повторены после удаления файлов;
все прошли, предупреждений о React act нет, git diff --check — без ошибок.

## Чистая установка, тесты и сборки

Для всех четырёх package roots выполнено
`npm ci --legacy-peer-deps --ignore-scripts --no-audit --no-fund`, exit 0.
Lifecycle install scripts отключены, test/build scripts выполнены отдельно.
Добавлены необходимые dev tools: Vitest 5.0.3, Vite 8.3.3 для framework tests,
jsdom 27.0.1, DOM event helpers и Firebase CLI 13.4.0, совместимый с установленной Java.
Runtime-зависимости основных приложений намеренно не обновлялись.

| Репозиторий | Команда и результат | Подтверждение |
| --- | --- | --- |
| framework | npm test: **114 unit + 38 integration tests PASS**, 30 files, exit 0 | [test log](/private/tmp/redequate-encapsulated-isolated-tests.log) |
| framework | npm run 'build core': **PASS**, Rollup CJS/ESM и отдельные компоненты | [build log](/private/tmp/redequate-encapsulated-build.log) |
| demo | npm run build: **PASS**, Vite + injectManifest | [build log](/private/tmp/10m-final-demo-build.log) |
| TWT | npm test: **1 test PASS**, exit 0 | [test log](/private/tmp/redequate-cleanup-twt-tests.log) |
| TWT | npm run build: **PASS**, Vite + injectManifest | [build log](/private/tmp/10m-final-twt-build.log) |
| example | npm run build: **PASS**, Vite | [build log](/private/tmp/redequate-encapsulated-example-build.log) |

Demo не имеет существующей automated suite; отсутствие тестов не обозначается PASS.
Скан package.json/package-lock.json всех roots на react-scripts — без совпадений.
В текущих test files нет react-dom/test-utils/unmountComponentAtNode/jest calls.

## Emulator: подтверждённые границы

Project ID demo-redequate-tests, RTDB namespace
**demo-redequate-tests-default-rtdb**. runner в src/__tests__ генерирует временную Firebase-конфигурацию
с правилами src/__tests__/fixtures/database.rules.json; SDK и fixture REST endpoints
используют ту же namespace. Соседние приложения не требуются. Эти правила
описывают тестовые условия framework, а не безопасность приложений.
Фактически проверены Auth account creation/logout, invitation/verification
OOB codes, UserData save/fetch/delete, private data access denial/own-user access,
server timestamps, роли и refresh через watchUserChanged.

Auth Emulator предупреждает, что handleCodeInApp не поддержан: OOB codes созданы
локально, реальный email/sign-in-link lifecycle не подтверждён.
Browser Auth internals явно согласованы в test config: смешивание browser compat
с Node Auth exports в jsdom приводило к Expected a class definition.
Production Vite configs для этого не менялись.

Runner очищает credential env variables, требует точные loopback endpoints,
пишет logs во временный каталог и автоматически завершает emulators.
Конфигурация приложения/production variant не переключались, Functions backend
не обновлялся. Подробные команды и prerequisites: [README: Tests](README.md#tests).

## Инкапсуляция тестовой инфраструктуры

Пять раздельных файлов заменены двумя внутри src/__tests__: единый Vitest config
выбирает unit/integration по mode, emulator runner содержит настройки и создаёт
временную Firebase-конфигурацию с копией fixture rules. Firebase CLI 13.4 требует
rules внутри config directory; после изменения rules watch нужно перезапустить.
SDK fixtures получают project ID из CLI GCLOUD_PROJECT, требуют demo identity
и точные loopback endpoints. Конфигурация Vite example остаётся отдельной.

Unit watch явно включён через --watch; выбранный существующий Chip test прошёл
и перешёл в ожидание изменений: [log](/private/tmp/redequate-encapsulated-unit-watch.log).
Integration watch выполнил 38 тестов и перешёл в ожидание; SIGINT освободил порты
и завершил всю группу дочерних процессов: [log](/private/tmp/redequate-encapsulated-integration-watch.log).
Exit code 130 при SIGINT ожидаем. Прямой integration запуск без emulator env
отклонён с явным сообщением: [guard log](/private/tmp/redequate-encapsulated-guard.log).

## Автономность framework

В изолированной копии без соседних приложений повторно прошли чистая установка,
все 152 теста, Rollup CJS/ESM и Vite example build. Dependencies и artifacts
из рабочей копии не копировались. После инкапсуляции test gate повторён
в той же автономной копии с ранее установленными dependencies: 114 + 38 PASS. Подтверждения: [install](/private/tmp/redequate-isolated-install.log),
[tests](/private/tmp/redequate-encapsulated-isolated-tests.log), [Rollup](/private/tmp/redequate-isolated-build.log),
[example install](/private/tmp/redequate-isolated-example-install.log),
[example build](/private/tmp/redequate-isolated-example-build.log).
Команды соответствуют таблице выше; example устанавливается через
`npm --prefix example ci --legacy-peer-deps --ignore-scripts --no-audit --no-fund`.

Consumer сам устанавливает framework и передаёт свой каталог универсальному
link helper. Explicit-path проверка четырёх shared packages прошла:
[link check](/private/tmp/redequate-link-check.log). Полный consumer reinstall
не запускался. Правила безопасности приложений проверяются в их репозиториях.

## Повторная browser и asset проверка

Chrome: demo и TWT проверены в dev/preview, example — в preview /redequate/.
Все приложения отрисовались.
Demo preview: Redux progress aria-valuenow=60, calendar dialog open/select/close,
InputPicker aria-expanded=true при открытии, Uppy Dashboard open/close.
TWT: существующая Discover feed; после закрытия приглашения переход к login.
Example: введено Vite, кнопка Say hello дала **Hello, Vite!**.

Console capture не содержит errors на проверенных экранах; есть приложение-специфическое
warning UserData set current null и предупреждение Google GSI о будущих изменениях
prompt status API/FedCM. [Browser evidence](/private/tmp/10m-vite-browser-console.json),
[example screenshot](/private/tmp/10m-vite-example.png).

Все **23 demo / 64 TWT precache assets** доступны по HTTP и совпадают с файлами
сборки. Test project ID, emulator API key и App shell fixture в production JS
не обнаружены: [assets audit](/private/tmp/10m-final-assets-audit.json).
Сохраняется ранее исправленный demo Hosting SPA rewrite; deploy не выполнялся.

## Оставшиеся предупреждения и риски

- react-redux 8.1.3 и legacy calendar/mask/gallery/lightbox имеют React peers,
  исключающие 19. Сейчас их версии не менялись; успешный smoke не расширяет поддержку.
- TWT сохраняет legacy @mui/styles в UserNameComponent/Chat и вложенный React16
  от неиспользуемого react-googleyolo. Это отдельные React compatibility задачи.
- Rollup игнорирует use client react-intersection-observer; Vite предупреждает
  о больших chunks. Demo имеет ineffective dynamic imports из-за статических
  импортов framework/Widgets. Не блокируют текущие сборки; влияют на загрузку.
- Текущий TWT build использует dev Firebase variant и sourcemaps. Prod variant
  и GENERATE_SOURCEMAP=false должны быть отдельно проверены перед выпуском.
- npm legacy-peer-deps по-прежнему необходим; он не доказывает peer compatibility.
  У CLI/dev stack есть deprecation warnings; обновление backend tools вне задачи.

## NOT VERIFIED

Реальные Google/Facebook/password-login и email delivery; публикации и формы
с persistence; Uppy → Storage upload; FCM token/delivery/delete; service worker
registration/control/offline и upgrade N→N+1/cache cleanup; deployed deep links;
production Firebase variant release; полный StrictMode/concurrent matrix;
Android/WebView. Emulator tests не заменяют эти проверки.

SSR, deploy и изменения production-данных не выполнялись.
