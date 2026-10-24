const RETRYABLE_STATUS = new Set([408, 425, 429]);

export async function fetchWithRetry(url, init = {}, { attempts = 3, timeoutMs = 30_000, delayMs = 400, fetchImpl = fetch } = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { ...init, signal: controller.signal });
      const retryable = RETRYABLE_STATUS.has(response.status) || response.status >= 500;
      if (!retryable || attempt === attempts) return response;
      lastError = new Error(`HTTP ${response.status} from ${url}`);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) throw error;
    } finally {
      clearTimeout(timer);
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
  }
  throw lastError ?? new Error(`Could not fetch ${url}`);
}
