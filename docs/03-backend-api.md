# API backend

Базовый путь: `/api`. В проекте нет готовой Postman-коллекции или OpenAPI-спецификации — этот файл написан вручную по фактическому коду роутов (`backend/src/routes/*.js`). Машиночитаемая версия сгенерирована рядом: [openapi.yaml](./openapi.yaml).

Все эндпоинты, кроме `POST /api/auth/register`, `POST /api/auth/login` и `GET /api/health`, требуют заголовок `Authorization: Bearer <JWT>`. При отсутствии или невалидном токене — `401 { "error": "Не авторизован" }` или `401 { "error": "Невалидный или истёкший токен" }`.

Формат тела ошибок везде одинаковый: `{ "error": "человекочитаемое сообщение на русском" }`.

---

## Health

**`GET /api/health`** — без авторизации. Ответ: `{ "status": "ok" }`. Используется как readiness/liveness-проба в Kubernetes-стенде (см. [06-k8s-stand.md](./06-k8s-stand.md)).

---

## `auth` — регистрация и вход

### `POST /api/auth/register`
Без авторизации. При успехе создаёт пользователя + запись в `limits` (лимит по умолчанию 50000₽) + счёт "Основной".

Тело:
```json
{ "email": "user@example.com", "password": "min6chars", "displayName": "Имя (необязательно)" }
```
Ответ `201`:
```json
{ "token": "eyJ...", "user": { "id": "uuid", "email": "user@example.com", "displayName": "Имя" } }
```
Ошибки: `400` — email/пароль не переданы, или пароль короче 6 символов; `409` — email уже занят.

### `POST /api/auth/login`
Без авторизации. Тело: `{ "email": "...", "password": "..." }`. Ответ `200` — та же форма, что у register. Ошибки: `400` — не переданы поля; `401` — неверный email или пароль.

### `GET /api/auth/me`
С авторизацией. Ответ: `{ "user": { "id", "email", "displayName" } }`. `404` если пользователь не найден (токен валиден, но пользователь удалён из БД).

---

## `transactions`

### `GET /api/transactions`
Все транзакции текущего пользователя, отсортированные по `date DESC`, с полем `attachment_count`.

### `GET /api/transactions/:id`
Одна транзакция. `404`, если не найдена или принадлежит другому пользователю.

### `POST /api/transactions`
Тело:
```json
{ "type": "Расход", "source": "Продукты", "description": "", "summ": 1500, "currency": "Рубль", "date": "2026-09-22T10:00:00Z", "account_id": "uuid" }
```
`type` и `summ` обязательны, `account_id` — тоже обязателен (счёт должен принадлежать пользователю). При `type: "Расход"` асинхронно (не блокируя ответ) проверяется превышение месячного лимита — если превышен и Telegram привязан, уходит уведомление (см. [06-features.md](./08-features.md)). Ответ `201` — созданная транзакция. `400` — не хватает полей или счёт не найден.

### `POST /api/transactions/bulk`
Массовое создание (используется при импорте из Excel). Тело: `{ "transactions": [ {...}, {...} ] }`. Для строк без `account_id` подставляется самый старый счёт пользователя. Все строки — в одной БД-транзакции (всё или ничего). Ответ `201` — массив созданных транзакций.

### `PUT /api/transactions/:id`
Тело — любое подмножество полей транзакции (частичное обновление через `COALESCE`). `404`, если не найдена/чужая.

### `DELETE /api/transactions/:id`
Ответ `{ "deleted": true }`. `404`, если не найдена/чужая. Каскадно удаляет вложения (на уровне БД, `ON DELETE CASCADE`) — но не сами файлы с диска (это отдельная забота, если транзакцию удаляют не через `DELETE /attachments/:id`).

### `POST /api/transactions/:id/attachments`
`multipart/form-data`, поле `file`. Только `image/jpeg`, `image/png`, `application/pdf`, до 10MB (см. `middleware/upload.js`). Ответ `201`:
```json
{ "id": "uuid", "transaction_id": "uuid", "file_name": "чек.jpg", "mime_type": "image/jpeg", "file_size": 123456, "uploaded_at": "..." }
```
Ошибки: `400` — неверный тип файла или превышен размер (сообщение от `multer`); `404` — транзакция не найдена/чужая (загруженный файл при этом удаляется с диска, не остаётся сиротой).

### `GET /api/transactions/:id/attachments`
Список вложений транзакции (без содержимого файлов — сами файлы отдаются через `GET /api/attachments/:attachmentId`, см. ниже).

---

## `limits`

### `GET /api/limits`
Ответ: `{ "amount": 50000 }`. Если записи в БД ещё нет — тихо возвращает дефолт `50000`, не `404`.

### `PUT /api/limits`
Тело: `{ "amount": 60000 }` (положительное число). `Upsert` — работает и для первого задания лимита, и для изменения. `400`, если `amount` не число или отрицательное.

---

## `accounts`

### `GET /api/accounts`
Список счетов с вычисленным `balance` (`initial_balance` + сумма транзакций по счёту).
```json
[{ "id": "uuid", "name": "Основной", "type": "card", "currency": "RUB", "initialBalance": 0, "balance": 4500, "createdAt": "..." }]
```

### `POST /api/accounts`
Тело: `{ "name": "Наличные", "type": "cash", "currency": "RUB", "initialBalance": 1000 }`. `type` ∈ `cash`/`card`/`savings`, `currency` ∈ `RUB`/`USD`/`EUR` — иначе `400`. `name` обязателен.

### `PUT /api/accounts/:id`
Частичное обновление (те же поля, что при создании). `404`, если не найден/чужой.

### `DELETE /api/accounts/:id`
```json
{ "reassignTo": "uuid-другого-счёта" }
```
`400` — попытка удалить единственный счёт пользователя (у каждого должен остаться хотя бы один). `409` — у счёта есть транзакции, а `reassignTo` не передан (нужно явно указать, куда их перенести). `404` — счёт не найден, или `reassignTo` указывает на чужой/несуществующий счёт.

---

## `exchange-rates`

### `GET /api/exchange-rates`
Последний закэшированный курс каждой валюты + `RUB: 1`:
```json
{ "RUB": 1, "USD": 93.44, "EUR": 101.12 }
```
Если фид ЦБ ещё ни разу не выполнился (например, только что поднятый контейнер) — вернёт только `{ "RUB": 1 }`, пока не отработает крон/стартовый фетч.

---

## `recurring`

### `GET /api/recurring`
Все шаблоны пользователя, `created_at DESC`.

### `POST /api/recurring`
```json
{ "account_id": "uuid|null", "type": "Расход", "source": "Аренда", "summ": 30000, "currency": "RUB", "frequency": "monthly", "next_run_date": "2026-10-01" }
```
`type`, `summ`, `frequency`, `next_run_date` обязательны. `frequency` ∈ `daily`/`weekly`/`monthly`. Если передан `account_id` — проверяется, что счёт принадлежит пользователю.

### `PUT /api/recurring/:id`
Частичное обновление, включая `active` (способ приостановить шаблон без удаления).

### `DELETE /api/recurring/:id`
`{ "deleted": true }` / `404`.

---

## `export`

### `GET /api/export/excel?from=&to=&accountId=`
Все параметры опциональны (фильтр по датам/счёту). Бинарный ответ `.xlsx` (`Content-Disposition: attachment`).

### `GET /api/export/pdf?from=&to=`
Бинарный `.pdf` с итогами (доход/расход/баланс за период). Кириллица — через шрифт DejaVu Sans, если он установлен в контейнере (в проде — да, через `apk add ttf-dejavu` в `backend/Dockerfile`); если шрифта нет (например, локальный запуск не в Docker) — тихий откат на стандартный Helvetica без кириллицы.

---

## `telegram`

### `GET /api/telegram/status`
`{ "linked": true|false }` — привязан ли Telegram к текущему аккаунту.

### `POST /api/telegram/link-code`
Генерирует одноразовый код (`crypto.randomBytes(4).toString("hex")`), сохраняет его в `users.telegram_link_code`. Ответ: `{ "code": "a1b2c3d4" }`. Дальше пользователь отправляет боту `/link a1b2c3d4` — это уже не HTTP-эндпоинт, а Telegram long-polling обработчик внутри `backend/src/services/telegramBot.js` (см. [08-features.md](./08-features.md)).

**Статус фичи:** код полностью написан и юнит-протестирован, но **живое тестирование с реальным Telegram-ботом не проводилось** — нет заданного `TELEGRAM_BOT_TOKEN` в проде. Без токена бот просто не запускается (backend стартует нормально), эти два HTTP-эндпоинта работают всегда, а сам бот (`bot.onText`, `bot.on("message")`) — только при наличии токена.

---

## `attachments`

### `GET /api/attachments/:attachmentId`
Отдаёт бинарное содержимое файла (`inline`, с корректным `Content-Type`). Владение проверяется через JOIN на `transactions.user_id` — нельзя получить чужое вложение, даже зная его `id`. `404`, если вложение не найдено, не принадлежит пользователю, либо файл почему-то отсутствует на диске.

### `DELETE /api/attachments/:attachmentId`
Удаляет запись из БД и файл с диска. `{ "deleted": true }` / `404`.

---

## Ограничения этого документа

Тела ответов приведены по факту того, что реально возвращает код (`mapRow`-функции в каждом роуте), а не по теоретической полной схеме БД — например, `transactions` не отдаёт `created_at` в JSON, хотя оно есть в таблице.
