#!/usr/bin/env bash
# Build backend/frontend from the current checkout and roll them out to the k3s stand.
# Usage: bash k8s/deploy-stand.sh <git-sha>
set -euo pipefail

SHA="${1:?usage: deploy-stand.sh <git-sha>}"
TAG="${SHA:0:12}"
NS=react-money
KEEP=3
HISTORY="$HOME/.stand-deploy-history"
export KUBECONFIG="$HOME/.kube/config"

cd "$(dirname "$0")/.."

if ! kubectl get secret react-money-secrets -n "$NS" >/dev/null 2>&1; then
  echo "!! secret $NS/react-money-secrets is missing (JWT_SECRET) — create it on the server first" >&2
  exit 1
fi

echo "==> build backend:$TAG"
docker build -t "react-money-backend:$TAG" -t react-money-backend:local ./backend

echo "==> build frontend:$TAG"
docker build -t "react-money-frontend:$TAG" -t react-money-frontend:local \
  --build-arg REACT_APP_API_URL=/api .

# k3s runs its own containerd, it does not see images from the docker daemon.
echo "==> import images into k3s containerd"
docker save "react-money-backend:$TAG" react-money-backend:local \
            "react-money-frontend:$TAG" react-money-frontend:local \
  | sudo k3s ctr images import -

echo "==> apply manifests"
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/hpa-backend.yaml
sed "s|react-money-backend:local|react-money-backend:$TAG|" k8s/backend.yaml | kubectl apply -f -
sed "s|react-money-frontend:local|react-money-frontend:$TAG|" k8s/frontend.yaml | kubectl apply -f -

echo "==> wait for rollout"
if ! kubectl rollout status deploy/backend -n "$NS" --timeout=180s \
   || ! kubectl rollout status deploy/frontend -n "$NS" --timeout=180s; then
  echo "!! rollout failed, rolling back backend and frontend" >&2
  kubectl rollout undo deploy/backend -n "$NS" || true
  kubectl rollout undo deploy/frontend -n "$NS" || true
  exit 1
fi

# Keep images of the last $KEEP deploys so `kubectl rollout undo` still has something to go back to.
echo "$TAG" >> "$HISTORY"
tac "$HISTORY" | awk '!seen[$0]++' | tac > "$HISTORY.tmp" && mv "$HISTORY.tmp" "$HISTORY"
if [ "$(wc -l < "$HISTORY")" -gt "$KEEP" ]; then
  head -n -"$KEEP" "$HISTORY" | while read -r old; do
    echo "==> remove old images :$old"
    docker rmi "react-money-backend:$old" "react-money-frontend:$old" >/dev/null 2>&1 || true
    sudo k3s ctr images rm "docker.io/library/react-money-backend:$old" \
                           "docker.io/library/react-money-frontend:$old" >/dev/null 2>&1 || true
  done
  tail -n "$KEEP" "$HISTORY" > "$HISTORY.tmp" && mv "$HISTORY.tmp" "$HISTORY"
fi
docker image prune -f >/dev/null

echo "==> stand is on $TAG"
kubectl get pods -n "$NS" -o wide
