#!/bin/sh
# Runs once, when the Postgres volume is empty (docker-entrypoint-initdb.d).
# Schema "receipts" with its own DB user. receipts_svc gets no grants on core-api tables in "public",
# so it cannot read or write them — the local stand-in for the future network policies.
# The receipts tables themselves are created by receipts-api on start (its init.sql), not here.
set -e
psql -v ON_ERROR_STOP=1 -v pw="$RECEIPTS_DB_PASSWORD" --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
CREATE ROLE receipts_svc LOGIN PASSWORD :'pw';
CREATE SCHEMA receipts AUTHORIZATION receipts_svc;
ALTER ROLE receipts_svc SET search_path = receipts;
SQL
