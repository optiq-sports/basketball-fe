export interface CommandRetryOptions {
  retries?: number;
  retryDelayMs?: number;
  isRetriableError?: (error: unknown) => boolean;
}

const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 500;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export async function withSafeCommandRetry<T>(
  operation: () => Promise<T>,
  options: CommandRetryOptions = {},
): Promise<T> {
  const retries = options.retries ?? DEFAULT_RETRIES;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const isRetriableError =
    options.isRetriableError ??
    ((error: unknown) => {
      if (!(error instanceof Error)) {
        return false;
      }
      return /network|timeout|failed to fetch/i.test(error.message);
    });

  let attempt = 0;
  while (attempt <= retries) {
    try {
      return await operation();
    } catch (error) {
      const canRetry = attempt < retries && isRetriableError(error);
      if (!canRetry) {
        throw error;
      }

      const jitter = Math.floor(Math.random() * 100);
      await wait(retryDelayMs + jitter);
      attempt += 1;
    }
  }

  throw new Error('Retry loop exited unexpectedly.');
}
