CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Пользователи
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Транзакции (доход/расход)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('Доход', 'Расход')),
  source TEXT NOT NULL DEFAULT 'Остальное',
  description TEXT DEFAULT '',
  summ NUMERIC(14, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'Рубль',
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date);

-- Лимит расходов на пользователя
CREATE TABLE IF NOT EXISTS limits (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(14, 2) NOT NULL DEFAULT 50000,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

