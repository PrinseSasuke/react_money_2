# React-Money

Учёт личных финансов: транзакции, лимиты, статистика, прогноз бюджета.

Стек: React (фронт) + Express/Node.js (бэк) + PostgreSQL (БД), всё в Docker.

## Быстрый старт (Docker)

```bash
cp .env.example .env
# при желании поменяй JWT_SECRET в .env на свою случайную строку

docker compose up --build
```

- Фронт: http://localhost:3000
- Бэк (API): http://localhost:4000/api
- Postgres: localhost:5432 (user/pass/db: app/app/react_money)

При первом старте бэкенд-контейнер сам накатит схему БД (`backend/migrations/init.sql`).

## Локальная разработка без Docker

**Backend:**
```bash
cd backend
cp .env.example .env   # укажи свой локальный Postgres в DB_HOST и т.д.
npm install
npm run migrate        # применить схему БД
npm run dev
```

**Frontend:**
```bash
cp .env.example .env    # REACT_APP_API_URL=http://localhost:4000/api
npm install
npm start
```

## Структура проекта

```
├── src/                 # React-фронтенд
│   ├── services/api.js  # единая точка обращения к backend API
│   ├── context/          # AuthContext (JWT-авторизация)
│   ├── pages/, components/
├── backend/              # Express API
│   ├── src/routes/       # auth, transactions, limits
│   ├── migrations/       # SQL-схема
├── docker-compose.yml
├── Dockerfile            # фронтенд (multi-stage build + nginx)
└── backend/Dockerfile    # бэкенд
```

## Важно

- Иконки/картинки (`public/img/*.svg`, `src/logo.svg`) из исходного проекта не входили в переданный архив (был только `src` без `public`) — если они у тебя есть, положи их в `public/img/`.
- Авторизация теперь по email/паролю (JWT), а не через Firebase Google-логин — это сознательное решение при переходе на свой бэкенд. Если нужен вход через Google, это добавляется отдельно через `passport-google-oauth20` на бэкенде.
- Лимит расходов и все транзакции теперь реально хранятся в Postgres и не пропадают при перезагрузке страницы (в исходной версии `LimitsPage` лимит хранился только в состоянии компонента).
