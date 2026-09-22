# STATUS — развёртывание k3s-стенда react-money

- [x] k3s кластер работает, нода Ready
- [x] Манифесты созданы и закоммичены в git
- [x] Приложение доступно, регистрация/логин работают
- [x] Baseline MTTR зафиксирован (см. `k8s/experiments-log.md`)
- [x] Chaos Mesh установлен, дашборд доступен (через SSH-туннель, см. ниже)
- [x] Список блокеров/ошибок ниже

## Окружение

- Сервер: `2.26.95.49`, Ubuntu **20.04.6 LTS** (в ТЗ указывалось 22.04/24.04 —
  фактическая версия отличается, не блокер, но стала причиной проблемы №2 ниже).
- k3s v1.36.4+k3s1, containerd 2.3.4-k3s1.36, cgroup v2 (переключено вручную).
- Docker 28.1.1.
- Chaos Mesh v2.6.3.

## Блокеры и ошибки (точный текст)

1. **Sudo без пароля.** Пользователь `deploy` не имел NOPASSWD sudo.
   Решение: пользователь сам добавил `/etc/sudoers.d/deploy-nopasswd`
   (я не запрашивал и не видел пароль).

2. **k3s не стартовал: cgroup v1.**
   ```
   Error: failed to validate kubelet configuration, error: kubelet is
   configured to not run on a host using cgroup v1. cgroup v1 support is
   unsupported and will be removed in a future release
   ```
   Причина: Ubuntu 20.04 по умолчанию грузится с cgroup v1, а k3s v1.36
   требует cgroup v2. Решение: добавлен параметр ядра
   `systemd.unified_cgroup_hierarchy=1` в `/etc/default/grub`
   (бэкап оригинала — `/etc/default/grub.bak`), `update-grub`, перезагрузка
   сервера. После ребута — `stat -fc %T /sys/fs/cgroup/` → `cgroup2fs`,
   k3s поднялся с первой попытки.

3. **Установка Docker: несуществующий пакет.**
   ```
   E: Unable to locate package docker-model-plugin
   ```
   Официальный скрипт `get.docker.com` пытается поставить
   `docker-model-plugin` (AI Model Runner), которого нет в репозитории
   Docker для EOL-дистрибутива (focal). Решение: репозиторий Docker уже был
   подключен скриптом, доставил основные пакеты вручную через
   `apt-get install docker-ce docker-ce-cli containerd.io
   docker-compose-plugin docker-buildx-plugin` (без model-plugin и
   rootless-extras, которые не нужны для этой задачи).

4. **Chaos Mesh install script: permission denied.**
   ```
   error loading config file "/etc/rancher/k3s/k3s.yaml": open
   /etc/rancher/k3s/k3s.yaml: permission denied
   ```
   Установщик по умолчанию читает `/etc/rancher/k3s/k3s.yaml` напрямую
   (root:root, 0600), а не `~/.kube/config`. Решение: экспортировать
   `KUBECONFIG=~/.kube/config` перед запуском инсталлятора.

5. **Публичный port-forward дашборда Chaos Mesh заблокирован моим
   инструментарием (auto mode classifier).** Попытка
   `kubectl port-forward ... --address 0.0.0.0` (как буквально написано в
   ТЗ, "временно, для доступа с браузера") была отклонена как небезопасное
   действие — публичный порт 2333 позволил бы кому угодно в интернете
   запускать хаос-эксперименты на кластере. Сделал правильный вариант сразу:
   `--address 127.0.0.1` (только на сервере) — дашборд проверен и отвечает
   `200 OK`. **Чтобы открыть его в своём браузере:** пробрось порт через SSH
   со своей машины (порт-форвард уже поднят на сервере в фоне):
   ```bash
   ssh -i C:\Users\Серёга\.ssh\id_ed25519 -L 2333:127.0.0.1:2333 deploy@2.26.95.49
   ```
   и открой `http://localhost:2333` в браузере. Публично порт 2333 никогда
   не открывался.

6. **Backend временно падал при первом деплое (не блокер, самовосстановился).**
   Все 3 пода backend ушли в `CrashLoopBackOff` (exit code 1) сразу после
   `kubectl apply`, т.к. стартовали одновременно с postgres, и
   `migrate.js` не мог подключиться к ещё не готовой БД. Через ~25 сек, когда
   postgres стал `Ready`, Kubernetes (restartPolicy: Always) сам поднял все
   поды в стабильное состояние — вмешательство не потребовалось. Подробности
   и вывод для диплома — в `k8s/experiments-log.md`.

7. **ufw оставлен неактивным.** Правила (`22`, `6443`, `80`, `443`/tcp)
   добавлены, но сам firewall не включён (`sudo ufw enable`) — ТЗ прямо не
   просило включать, а включение firewall удалённо без физического доступа
   к консоли несёт риск потери SSH-доступа при ошибке в правилах. Решение —
   на усмотрение пользователя; правила уже готовы к простому `ufw enable`.

## Отклонение от ТЗ (осознанное, в лучшую сторону)

Этап 3, п.3 просил накатить `migrations/init.sql` вручную через `kubectl
exec` в под postgres. Это не потребовалось: `backend/Dockerfile` уже
запускает `node src/migrate.js && node src/index.js` при каждом старте
контейнера — миграции применяются автоматически и идемпотентно (`CREATE
TABLE IF NOT EXISTS`). Проверено: `\dt` в поде `postgres-0` показывает все
3 таблицы (`users`, `transactions`, `limits`).

## Проверка приложения (снаружи, с публичного IP)

```
curl -I http://2.26.95.49/           → 200 OK
curl http://2.26.95.49/api/health    → {"status":"ok"}
POST /api/auth/register + /api/auth/login → успешно, токен и user.id совпадают
```

## Baseline MTTR (см. полностью k8s/experiments-log.md)

| Компонент | MTTR | Downtime сервиса |
|---|---|---|
| backend (3 реплики) | 6.10 сек | 0 (остальные 2 реплики держали трафик) |
| postgres (1 реплика, PVC) | 7.56 сек | ~7.5 сек (единственная реплика) |

Данные после пересоздания postgres-0 не потеряны (проверено логином тестового
пользователя, тот же `user.id`).
