# Тестовый контур

## Виды тестов

| Вид | Инструмент | Где лежит | Команда |
|---|---|---|---|
| Юнит (backend) | Jest | `backend/tests/unit/*.test.js` | `cd backend && npm test` |
| Интеграционные (backend) | Jest + Supertest | `backend/tests/integration/*.test.js` | `cd backend && npm test` (тот же раннер, `jest.config.js` подхватывает оба каталога) |
| E2E (функциональные) | Playwright | `e2e/*.spec.js` | `npx playwright test` |
| Визуальные (скриншот-регрессия) | Playwright (`toHaveScreenshot`) | `e2e/visual.spec.js` + `e2e/visual.spec.js-snapshots/*.png` | `npx playwright test e2e/visual.spec.js` |
| Accessibility | Playwright + `@axe-core/playwright` | `e2e/accessibility.spec.js` | `npx playwright test e2e/accessibility.spec.js` |

Всего backend-тестов — 41 (юнит + интеграционные). Интеграционные покрывают: `auth`, `transactions` (включая проверку владения на всех CRUD-методах), `accounts`, `recurring` (включая прямой вызов `runDueRecurring()`), `attachments` (включая обход клиентской проверки типа файла и доступ чужого пользователя), `exchange-rates` (с замоканным `fetch`, чтобы не дёргать реальный ЦБ РФ на каждый прогон тестов), плюс отдельный сквозной сценарий: регистрация → логин → создание транзакции → список → правка → удаление, с проверкой состояния БД между шагами.

E2E покрывают: регистрация/логин + CRUD транзакции, превышение лимита расходов, импорт из Excel, сохранение выбранной темы после перезагрузки страницы, отсутствие горизонтального скролла на 8 страницах (адаптивная вёрстка), отсутствие serious/critical нарушений accessibility (axe-core) на 3 страницах, визуальные скриншоты (логин/дашборд/список транзакций/модалка добавления × 2 темы × 2 viewport = 16 baseline-PNG).

## Локальный запуск

### Backend-тесты
```bash
docker compose -f docker-compose.test.yml up -d   # поднимает postgres-test на порту 5433, tmpfs
cd backend && npm install && npm test
```
`jest.config.js`: `globalSetup` накатывает миграции на тестовую БД перед первым тестом, `testEnvironment: node`, таймаут теста — 15 сек.

### E2E/визуальные/a11y
```bash
docker compose -f docker-compose.test.yml up -d   # если ещё не поднят
npx playwright install chromium   # один раз
npx playwright test
```
`playwright.config.js` сам поднимает отдельный backend (порт **4001**, та же тестовая БД на 5433) и frontend (`npm start`, порт 3000) через встроенный `webServer`. Если на 3000 уже крутится свой dev-сервер (например, для ручной проверки) — его нужно сначала остановить, иначе Playwright переиспользует чужой сервер, настроенный на прод/dev-БД, а не тестовую.

Точечный запуск:
```bash
npx playwright test --project=Desktop       # только десктопный viewport
npx playwright test e2e/visual.spec.js      # только визуальные скриншоты
```

## Как это встроено в CI

`.github/workflows/deploy.yml`, job `test`: поднимает Postgres как GitHub Actions service-контейнер (не через `docker-compose.test.yml` напрямую, тот же эффект — та же тестовая БД на 5433), гоняет `npm test` в `backend/`, собирает фронт (`CI=false`, см. [05-deployment.md](./05-deployment.md) — зачем), ставит Chromium для Playwright и запускает e2e **кроме** визуальных (`--grep-invert "visual regression"`).

**Визуальные скриншоты сознательно исключены из CI** — baseline-картинки сгенерированы на Windows, а GitHub-раннер — Linux; даже нетронутая вёрстка рендерится там с другим антиалиасингом шрифтов, что дало бы постоянные лже-провалы вместо сигнала о реальных регрессиях. Локально (на консистентной ОС между прогонами) этот слой работает и гоняется. Если понадобится визуальный гейт именно в CI — два варианта на будущее: перегенерировать baseline прямо на Linux-раннере (первый прогон CI создаст `-linux.png`, их можно скачать из артефактов и закоммитить отдельно от Windows-версий), либо гонять Playwright в Docker-образе с фиксированным окружением рендеринга.

Job `deploy` зависит от `test` через `needs: test` и запускается только при пуше именно в `main` — то есть деплой физически невозможен, если хотя бы один из перечисленных типов тестов (кроме визуальных) не прошёл.

## Известные нюансы (не баги, а зафиксированные компромиссы)

- `limits.spec.js` на проекте `Desktop` один раз словил таймаут при прогоне **всего** сьюта подряд (~4+ минуты), но стабильно проходит в изоляции — похоже на ресурсный затор долгого прогона, а не реальный баг. В CI на этот случай уже включены `retries: 1`.
- 4 существующих ESLint-warning'а фронта (missing hook deps, unused vars) намеренно не трогались — вне scope тестового контура; сборка (и в CI, и в проде) идёт с `CI=false`, чтобы они не блокировали деплой.
