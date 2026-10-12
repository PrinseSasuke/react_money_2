FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

ENV NODE_ENV=production
EXPOSE 3101
USER node

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD node -e "fetch('http://localhost:3101/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# docker stop sends SIGTERM and waits; the worker needs up to ~25 s to finish its tasks
STOPSIGNAL SIGTERM
CMD ["node", "src/index.js"]
