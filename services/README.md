# Сервис разбора чеков

`receipts-api` принимает чек (фото или строку QR), `receipts-worker` в фоне разбирает его и создаёт трату в core-api. Сейчас всё работает только локально, на ноутбуке; стенд, k8s и прод не затрагиваются. Требования — в ТЗ «сервис разбора чеков (локальная версия)».

## Запуск окружения (этап L0)

Нужны Docker Desktop (запущен) и этот репозиторий. Из корня репозитория:

```bash
cp deploy/local/.env.example deploy/local/.env
docker compose -f deploy/local/docker-compose.yml up -d
docker compose -f deploy/local/docker-compose.yml ps -a
```

Готово, когда `postgres`, `nats`, `seaweedfs` и `core-api` в состоянии `healthy`, а `nats-init` и `seaweedfs-init` завершились с кодом 0.

| Что | Адрес |
|---|---|
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

## Остановить и сбросить

```bash
docker compose -f deploy/local/docker-compose.yml down        # остановить, данные остаются
docker compose -f deploy/local/docker-compose.yml down -v     # остановить и удалить все данные
```

После `down -v` скрипт инициализации Postgres выполнится заново.
