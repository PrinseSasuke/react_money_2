# Сервис разбора чеков

`receipts-api` принимает чек (фото или строку QR), `receipts-worker` в фоне разбирает его и создаёт трату в core-api. Сейчас всё работает только локально, на ноутбуке; стенд, k8s и прод не затрагиваются. Требования — в ТЗ «сервис разбора чеков (локальная версия)».

```
клиент ──POST /api/receipts──► receipts-api ──► S3 (фото) + Postgres (схема receipts) + NATS (receipts.parse)
                                                                                   │
core-api ◄──POST /api/transactions (externalId = фискальный ключ)── receipts-worker ◄┘
```

## Запуск окружения

Нужны Docker Desktop (запущен) и этот репозиторий. Из корня репозитория:

```bash
cp deploy/local/.env.example deploy/local/.env
docker compose -f deploy/local/docker-compose.yml up -d
docker compose -f deploy/local/docker-compose.yml ps -a
```

Готово, когда `postgres`, `nats`, `seaweedfs`, `core-api`, `receipts-api` и `receipts-worker` в состоянии `healthy`, а `nats-init` и `seaweedfs-init` завершились с кодом 0.

| Что | Адрес |
|---|---|
| receipts-api | http://localhost:3100 (`/api/receipts`, `/healthz`, `/readyz`, `/metrics`) |
| receipts-worker | http://localhost:3101 (`/healthz`, `/metrics`) |
| core-api | http://localhost:4000/api/health |
| NATS (клиенты) | nats://localhost:4222 |
| NATS (мониторинг) | http://localhost:8222 |
| S3 API (SeaweedFS) | http://localhost:8333, ключи `S3_ACCESS_KEY` / `S3_SECRET_KEY` из `deploy/local/.env` |
| SeaweedFS: файлы в бакетах | http://localhost:8888/buckets/ |
| SeaweedFS: состояние | http://localhost:9333 |
| Postgres | localhost:5432, база `react_money` |

Хранилище фото — **SeaweedFS** с S3 API, а не MinIO: MinIO перестала публиковать Docker-образы (`minio/minio` и `minio/mc` удалены с Docker Hub). Для сервисов разницы нет, они работают по протоколу S3.

## Что создаётся автоматически

- **Postgres**: схема `receipts` и пользователь `receipts_svc` с доступом только к ней (`deploy/local/db/init/`). Скрипт выполняется один раз, на пустом томе.
- **NATS JetStream**: стримы `RECEIPTS` (`receipts.parse`) и `RECEIPTS_DLQ` (`receipts.dlq`), консьюмер `receipts-worker` (`deploy/local/nats/init-streams.sh`).
- **SeaweedFS**: бакет `receipts` (`deploy/local/seaweedfs/init-bucket.sh`).

## Проверка

```bash
docker compose -f deploy/local/docker-compose.yml logs nats-init seaweedfs-init
docker compose -f deploy/local/docker-compose.yml exec postgres psql -U receipts_svc -d react_money -c "select * from public.users limit 1"
```

Вторая команда должна вернуть `permission denied for table users`: сервис чеков не видит таблицы core-api.

**Путь чека целиком** (QR → `parsed` → трата в core-api; тот же QR ещё раз → `duplicate`, вторая трата не создаётся):

```bash
node scripts/e2e.mjs
```

Скрипт сам регистрирует тестового пользователя в локальном core-api (`E2E_EMAIL` / `E2E_PASSWORD` из `deploy/local/.env.example`).

**Тесты сервисов** (без docker): `npm test` в `services/receipts-api` и `services/receipts-worker`.

## Как worker обрабатывает чек

1. Берёт задачу из консьюмера `receipts-worker`; чек уже в конечном статусе — только `ack` (повторная доставка).
2. `processing`, разбор `StubParser` (строка QR формата ФНС; фото без QR → `error` / `ocr_not_implemented`).
3. Занимает фискальный ключ `fn:i:fp` в `receipts.fiscal_claims`; ключ уже у другого чека → `duplicate`.
4. Создаёт трату в core-api (`externalId` = фискальный ключ, повтор вызова вернёт ту же трату) → `parsed`, затем `ack`.

Временные ошибки (core-api 5xx/429/таймаут, база недоступна) — повтор через 1 с → 5 с → 30 с → 2 мин; после 5 попыток — `error` / `max_attempts` и копия задачи в `receipts.dlq`. Постоянные (QR не разбирается, 4xx от core-api) — сразу `error`.

Для сценариев отказов в `deploy/local/.env`: `PARSER_DELAY_MS` (медленный разбор), `PARSER_FAIL_RATE` (доля временных ошибок, 0–1), `WORKER_CONCURRENCY`.

Если на последней попытке недоступна и база, задача всё равно уходит в DLQ, а в её заголовках `Status-Written: false`: чек остался в `processing`, нужен человек. Такие случаи считает метрика `receipts_dlq_total{status_written="false"}`. Заголовки копии в DLQ: `Receipt-Id`, `Error-Code`, `Deliveries`, `Status-Written`.

## Сценарии отказов

Скрипт сам ломает окружение (останавливает и убивает контейнеры, замедляет разбор) и проверяет ожидаемый результат из ТЗ:

```bash
node scripts/scenarios.mjs all
```

| Сценарий | Что проверяется |
|---|---|
| `worker-stopped` | 50 чеков копятся в очереди, после старта worker все `parsed`, потерь нет |
| `worker-killed` | `docker kill` посреди разбора → повторная доставка после `ack_wait`, трата одна |
| `duplicates` | тот же QR дважды → `duplicate`; повтор задачи с другим `Nats-Msg-Id` ничего не меняет |
| `storage-down` | без SeaweedFS фото → `503` за ≤ 3 с, QR принимается и разбирается |
| `queue-down` | без NATS → `503` за ≤ 3 с, чек в `error` / `queue_unavailable`; после подъёма всё работает само |
| `core-api-down` | core-api лежит минуту → повторы с задержкой, после подъёма `parsed` |
| `core-api-long` | core-api лежит дольше всех попыток → `error` / `max_attempts` и копия в DLQ |
| `slow-parser` | разбор 3 с → очередь растёт (видно в метриках), всё обрабатывается |

Один сценарий: `node scripts/scenarios.mjs worker-killed`. Вся серия ~10 минут.

## Остановить и сбросить

```bash
docker compose -f deploy/local/docker-compose.yml down        # остановить, данные остаются
docker compose -f deploy/local/docker-compose.yml down -v     # остановить и удалить все данные
```

После `down -v` скрипт инициализации Postgres выполнится заново.
