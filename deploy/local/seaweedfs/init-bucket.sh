#!/bin/sh
# Creates the "receipts" bucket (ТЗ, section 3). Safe to re-run: an existing bucket is left as it is.
set -e
SHELL_ARGS="-master=seaweedfs:9333 -filer=seaweedfs:8888"

if ! echo "s3.bucket.list" | weed shell $SHELL_ARGS 2>/dev/null | grep -qw receipts; then
  echo "s3.bucket.create -name receipts" | weed shell $SHELL_ARGS
fi

echo "s3.bucket.list" | weed shell $SHELL_ARGS
