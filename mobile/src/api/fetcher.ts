// One place for every HTTP call of the app: base URL, the react-money token, a deadline,
// and errors turned into codes the screens can translate (see errorText in @react-money/shared).
import { config } from "@/lib/config";
import { authToken } from "@/lib/token";

const TIMEOUT_MS = 10_000;

export class ApiError extends Error {
  constructor(
    /** HTTP status; 0 = no answer (no network, timeout) */
    readonly status: number,
    /** machine code from the service ({ error: { code } }) or "network" */
    readonly code: string,
    message: string,
    /** the receipt id when the service recorded the receipt before failing */
    readonly receiptId?: string,
  ) {
    super(message);
  }
}

async function request<T>(baseUrl: string, path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  options.signal?.addEventListener("abort", () => controller.abort());

  const headers = new Headers(options.headers);
  // Orval's fetch client JSON.stringify()s the body without a Content-Type; express.json() would then ignore it
  if (typeof options.body === "string" && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const token = authToken.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(baseUrl + path, { ...options, headers, signal: controller.signal });
  } catch (e) {
    throw new ApiError(0, "network", `no answer from the server: ${String(e)}`);
  } finally {
    clearTimeout(timer);
  }

  return answer<T>(res.status, await res.text());
}

/** A status and a body → the parsed body, or an ApiError with the service's code. */
function answer<T>(status: number, text: string): T {
  const body = text ? safeJson(text) : null;
  if (status < 200 || status >= 300) {
    if (status === 401) authToken.onUnauthorized();
    const err = body && typeof body === "object" && "error" in body ? (body as { error: unknown }).error : null;
    // core-api answers { error: "text" }, receipts-api { error: { code, message } }
    if (err && typeof err === "object") {
      const e = err as { code?: string; message?: string; id?: string };
      throw new ApiError(status, e.code ?? `http_${status}`, e.message ?? "", e.id);
    }
    throw new ApiError(status, status === 401 ? "unauthorized" : `http_${status}`, typeof err === "string" ? err : "");
  }
  return body as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Mutator used by the Orval-generated receipts-api client. */
export const receiptsFetch = <T>(path: string, options: RequestInit): Promise<T> =>
  request<T>(config.receiptsApiUrl, path, options);

const UPLOAD_TIMEOUT_MS = 60_000;

/**
 * multipart/form-data with a file from the phone. Expo's global fetch rejects React Native's file parts
 * ({ uri, name, type }: "Unsupported FormDataPart implementation"); XMLHttpRequest goes through
 * React Native's own networking, which reads the file from the uri.
 */
export function receiptsUpload<T>(path: string, form: FormData): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", config.receiptsApiUrl + path);
    xhr.timeout = UPLOAD_TIMEOUT_MS;
    const token = authToken.get();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.onload = () => {
      try {
        resolve(answer<T>(xhr.status, xhr.responseText));
      } catch (e) {
        reject(e);
      }
    };
    xhr.onerror = () => reject(new ApiError(0, "network", "no answer from the server"));
    xhr.ontimeout = () => reject(new ApiError(0, "network", "upload timed out"));
    xhr.send(form);
  });
}

/** Plain calls to core-api (login, accounts) — core-api has no OpenAPI file yet. */
export const coreFetch = <T>(path: string, options: RequestInit = {}): Promise<T> =>
  request<T>(config.coreApiUrl, path, options);
