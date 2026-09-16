CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Пользователи
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_link_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_limit_notified_month TEXT;

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

-- Вложения к транзакциям (фото чеков, PDF-квитанции)
CREATE TABLE IF NOT EXISTS transaction_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attachments_transaction_id ON transaction_attachments(transaction_id);

-- Лимит расходов на пользователя
CREATE TABLE IF NOT EXISTS limits (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(14, 2) NOT NULL DEFAULT 50000,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Счета пользователя
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'card' CHECK (type IN ('cash', 'card', 'savings')),
  currency TEXT NOT NULL DEFAULT 'RUB',
  initial_balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);

-- Курсы валют к рублю (кэш ежедневного фида ЦБ РФ)
CREATE TABLE IF NOT EXISTS exchange_rates (
  currency_code TEXT NOT NULL,
  rate_to_rub NUMERIC(14, 6) NOT NULL,
  fetched_at DATE NOT NULL,
  PRIMARY KEY (currency_code, fetched_at)
);

-- Повторяющиеся транзакции (шаблоны, из которых крон создаёт реальные)
CREATE TABLE IF NOT EXISTS recurring_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('Доход', 'Расход')),
  source TEXT NOT NULL DEFAULT 'Остальное',
  description TEXT DEFAULT '',
  summ NUMERIC(14, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RUB',
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  next_run_date DATE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recurring_user_id ON recurring_transactions(user_id);

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_auto_generated BOOLEAN NOT NULL DEFAULT false;

