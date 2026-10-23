#!/bin/sh
# SeaweedFS on prod: one process (master + volume + filer + S3 gateway), S3 API on :8333 inside the compose network.
# Same as deploy/local/seaweedfs/start.sh, with smaller volumes for the 25 GB disk of the VPS.
# The S3 key pair comes from .env; the identity file is written at start so it never lands in git.
set -e
cat > /tmp/s3.json <<EOF
{"identities":[{"name":"receipts","credentials":[{"accessKey":"${S3_ACCESS_KEY}","secretKey":"${S3_SECRET_KEY}"}],"actions":["Admin","Read","Write","List","Tagging"]}]}
EOF
exec weed server -dir=/data -ip=seaweedfs -ip.bind=0.0.0.0 \
  -master.volumeSizeLimitMB=256 -volume.max=8 \
  -s3 -s3.port=8333 -s3.config=/tmp/s3.json
