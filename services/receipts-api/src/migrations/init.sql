-- Schema "receipts" (ТЗ, section 5). Idempotent, like core-api's init.sql: runs on every start of receipts-api.
-- The schema and the receipts_svc user are created by deploy/local/db/init (locally) before this runs.

DO $$ BEGIN
  CREATE TYPE receipts.receipt_status AS ENUM ('accepted', 'processing', 'parsed', 'duplicate', 'error');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS receipts.receipts (
  id             UUID PRIMARY KEY,                  -- also the Nats-Msg-Id of its parse task
  user_id        UUID NOT NULL,                     -- owner, from the JWT (core-api users.id)
  account_id     UUID,                              -- core-api account for the expense; null = oldest account
  source         TEXT NOT NULL CHECK (source IN ('qr', 'photo')),
  qr_raw         TEXT,
  image_key      TEXT,                              -- object key in the S3 bucket
  status         receipts.receipt_status NOT NULL DEFAULT 'accepted',
  fiscal_key     TEXT,                              -- fn:i:fp after parsing
  amount         NUMERIC(12, 2),
  purchased_at   TIMESTAMPTZ,
  transaction_id UUID,                              -- expense created in core-api
  error_code     TEXT,
  error_message  TEXT,
  attempts       INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS receipts_user_created_idx ON receipts.receipts (user_id, created_at DESC);

-- One fiscal receipt = one expense per user, whatever arrives twice (ТЗ, section 4).
CREATE TABLE IF NOT EXISTS receipts.fiscal_claims (
  user_id        UUID NOT NULL,
  fiscal_key     TEXT NOT NULL,
  receipt_id     UUID NOT NULL REFERENCES receipts.receipts (id),
  transaction_id UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, fiscal_key)
);
