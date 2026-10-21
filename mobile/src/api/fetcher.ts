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
  const token = authToken.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(baseUrl + path, { ...options, headers, signal: controller.signal });
  } catch {
    throw new ApiError(0, "network", "no answer from the server");
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  const body = text ? safeJson(text) : null;
  if (!res.ok) {
    if (res.status === 401) authToken.onUnauthorized();
    const err = body && typeof body === "object" && "error" in body ? (body as { error: unknown }).error : null;
    // core-api answers { error: "text" }, receipts-api { error: { code, message } }
    if (err && typeof err === "object") {
      const e = err as { code?: string; message?: string; id?: string };
      throw new ApiError(res.status, e.code ?? `http_${res.status}`, e.message ?? "", e.id);
    }
    throw new ApiError(res.status, res.status === 401 ? "unauthorized" : `http_${res.status}`, typeof err === "string" ? err : "");
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

/** Plain calls to core-api (login, accounts) — core-api has no OpenAPI file yet. */
export const coreFetch = <T>(path: string, options: RequestInit = {}): Promise<T> =>
  request<T>(config.coreApiUrl, path, options);
