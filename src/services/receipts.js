// Сервис чеков (receipts-api): список чеков, повтор и поток событий для живого обновления сайта.
// Тот же токен, что у core-api: оба сервиса проверяют один JWT.
const RECEIPTS_URL = process.env.REACT_APP_RECEIPTS_API_URL || "http://localhost:3100/api";

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

async function request(path, options = {}) {
  const response = await fetch(`${RECEIPTS_URL}${path}`, { ...options, headers: { ...authHeaders(), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // receipts-api отвечает { error: { code, message } }
    const error = new Error(data.error?.message || "Сервис чеков недоступен");
    error.status = response.status;
    error.code = data.error?.code;
    throw error;
  }
  return data;
}

export const listReceipts = (limit = 100) => request(`/receipts?limit=${limit}`);
export const retryReceipt = (id) => request(`/receipts/${id}/retry`, { method: "POST" });

const RECONNECT_MS = [1000, 3000, 10000, 30000];

/**
 * Подписка на события чеков (SSE). EventSource не умеет заголовок Authorization, поэтому поток читается
 * через fetch. Обрыв → переподключение с паузами 1 → 3 → 10 → 30 с; onStatus(true/false) сообщает,
 * есть ли поток, чтобы без него сайт обновлялся по таймеру. Возвращает функцию отписки.
 */
export function subscribeReceiptEvents(onEvent, onStatus = () => {}) {
  let stopped = false;
  let controller = null;
  let attempt = 0;

  const run = async () => {
    while (!stopped) {
      controller = new AbortController();
      try {
        const response = await fetch(`${RECEIPTS_URL}/receipts/events`, { headers: authHeaders(), signal: controller.signal });
        if (response.status === 401) return onStatus(false); // токен истёк: сайт сам отправит на вход
        if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
        attempt = 0;
        onStatus(true);
        await readEvents(response.body, onEvent);
      } catch {
        // сеть, сервис перезапустился или вкладку закрыли — ниже решаем, переподключаться ли
      }
      if (stopped) return;
      onStatus(false);
      const pause = RECONNECT_MS[Math.min(attempt, RECONNECT_MS.length - 1)];
      attempt += 1;
      await new Promise((r) => setTimeout(r, pause));
    }
  };
  run();

  return () => {
    stopped = true;
    controller?.abort();
  };
}

// text/event-stream: события разделены пустой строкой, строки «data: …» несут JSON
async function readEvents(body, onEvent) {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    const { events, rest } = splitEvents(buffer + value);
    buffer = rest;
    events.forEach(onEvent);
  }
}

/** Накопленный текст потока → готовые события (JSON из «data:») и недочитанный хвост. */
export function splitEvents(text) {
  const normalized = text.replace(/\r\n/g, "\n");
  const blocks = normalized.split("\n\n");
  const rest = blocks.pop(); // после последней пустой строки — начало следующего события
  const events = [];
  for (const block of blocks) {
    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("\n");
    if (!data) continue; // «retry:» и «: ping»
    try {
      events.push(JSON.parse(data));
    } catch {
      // битое событие пропускаем: следующее всё равно вызовет обновление
    }
  }
  return { events, rest };
}
