#!/bin/sh
# Creates the JetStream streams and the worker's consumer described in the ТЗ (section 5).
# Safe to re-run: anything that already exists is left as it is.
set -e

if ! nats stream info RECEIPTS >/dev/null 2>&1; then
  nats stream add RECEIPTS --subjects receipts.parse --storage file --retention work \
    --max-age 7d --dupe-window 2m --replicas 1 --discard old --defaults
fi

if ! nats stream info RECEIPTS_DLQ >/dev/null 2>&1; then
  nats stream add RECEIPTS_DLQ --subjects receipts.dlq --storage file --retention limits \
    --replicas 1 --defaults
fi

if ! nats consumer info RECEIPTS receipts-worker >/dev/null 2>&1; then
  nats consumer add RECEIPTS receipts-worker --pull --filter receipts.parse --ack explicit \
    --wait 30s --max-deliver 5 --deliver all --replay instant --defaults
fi

nats stream ls
nats consumer ls RECEIPTS
