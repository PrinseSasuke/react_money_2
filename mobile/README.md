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

## Запуск для разработки

1. Поднять сервисы на ноутбуке: `docker compose -f deploy/local/docker-compose.yml up -d` (из корня репозитория).
2. `cp mobile/.env.example mobile/.env` и вписать адрес ноутбука в Wi-Fi (`ipconfig` → IPv4).
3. Один раз поставить на телефон dev-сборку (ниже), потом: `cd mobile && npx expo start` — телефон подключается к ноутбуку по Wi-Fi и подтягивает код.

Телефон и ноутбук должны быть в одной сети, и в ней не должно быть запрета на связь устройств между собой (в рабочих и гостевых Wi-Fi он часто есть).

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
