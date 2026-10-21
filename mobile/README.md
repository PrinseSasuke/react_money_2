# Мобильное приложение «Чеки» (react-money)

Сканирует QR-код кассового чека и отправляет его в сервис чеков (`services/receipts-api`), который создаёт трату в react-money. Требования — в ТЗ «мобильное приложение-сканер чеков для react-money». Сейчас этап **M0 (каркас)**, сборка под **Android**.

Стек: Expo SDK 58 (React Native 0.88, React 19.3), TypeScript, Expo Router, NativeWind 4 (Tailwind 3.4, как на сайте), TanStack Query, клиент API генерируется Orval из `services/receipts-api/openapi.yaml`, токен в `expo-secure-store`, камера — VisionCamera 5 (с этапа M1).

## Где что

```
mobile/
  app.config.ts        конфиг приложения; APP_VARIANT=development — dev-сборка (HTTP до ноутбука разрешён)
  eas.json             профили сборки EAS: development (APK для разработки), preview, production
  orval.config.ts      генерация клиента receipts-api
  src/app/             экраны (Expo Router): sign-in, (tabs)/index — сканер, history, settings
  src/api/fetcher.ts   все HTTP-запросы: адрес, токен, таймаут 10 с, ошибки → коды
  src/api/generated/   сгенерированный клиент (не править руками: pnpm --filter mobile generate:api)
  src/lib/             конфиг адресов, хранение токена, сессия
packages/shared/       разбор строки QR ФНС, типы и схемы чеков, тексты ошибок — общий с сайтом код
```

## pnpm: только с фильтром

Приложение и `packages/shared` — рабочее пространство pnpm (`pnpm-workspace.yaml` в корне). Сайт в корне репозитория остаётся на npm, и прод собирается через `npm install` в корне, поэтому pnpm **всегда запускается с фильтром**:

```bash
pnpm install --filter "mobile..."
pnpm --filter mobile add <пакет>          # или в mobile/: npx expo install <пакет>
```

Раскладка пакетов изолированная (по умолчанию в pnpm): у приложения свой React 19, у сайта свой React 18.

## Запуск для разработки: по USB-кабелю (основной способ)

Кабель обходит Wi-Fi, брандмауэр Windows и запреты связи устройств в рабочей сети. Нужны Android platform-tools (`adb`) и на телефоне «Отладка по USB» (Xiaomi/HyperOS: 7 раз нажать «Версия ОС» в «О телефоне», затем «Расширенные настройки → Для разработчиков»).

1. Сервисы на ноутбуке (из корня репозитория): `docker compose -f deploy/local/docker-compose.yml up -d`
2. `mobile/.env`:
   ```
   EXPO_PUBLIC_CORE_API_URL=http://localhost:4000
   EXPO_PUBLIC_RECEIPTS_API_URL=http://localhost:3100
   ```
3. Порты ноутбука на телефон (после каждого переподключения кабеля):
   ```bash
   adb reverse tcp:8081 tcp:8081
   adb reverse tcp:4000 tcp:4000
   adb reverse tcp:3100 tcp:3100
   ```
4. Сервер разработки (в `mobile/`):
   ```bash
   REACT_NATIVE_PACKAGER_HOSTNAME=localhost npx expo start --dev-client --host lan
   ```
   Не `--localhost`: на Windows он слушает только IPv6 `::1`, а `adb reverse` приходит на `127.0.0.1` — телефон получает «unexpected end of stream». `--host lan` слушает все адреса, а переменная оставляет в ссылках `localhost`.
5. На телефоне в «Чеки (dev)»: `http://localhost:8081` → Connect.

Вход — пользователем **локального** react-money, например тестовым из `deploy/local/.env.example` (`E2E_EMAIL` / `E2E_PASSWORD`).

## Запуск по Wi-Fi (дома)

В `mobile/.env` — адрес ноутбука в сети (`ipconfig` → IPv4) вместо `localhost`, сервер — `npx expo start --dev-client`. Сеть в Windows должна быть «Частной», и Docker и Node.js должны быть разрешены в брандмауэре для частных сетей; в рабочих и гостевых Wi-Fi связь устройств между собой часто запрещена.

## Сборка для телефона (EAS)

VisionCamera не работает в Expo Go, поэтому нужна своя dev-сборка. Собирается в облаке Expo под вашим аккаунтом:

```bash
cd mobile
npx eas-cli login                                       # один раз, логин и пароль вводите сами
npx eas-cli build --profile development --platform android
```

В конце EAS даёт ссылку и QR на APK — открыть на телефоне и установить. Пересобирать нужно только при смене нативных пакетов или `app.config.ts`; изменения в коде приходят по Wi-Fi.

## Проверки

```bash
cd mobile && npx tsc --noEmit && npx expo-doctor
cd packages/shared && node --test "src/**/*.test.ts"
```
