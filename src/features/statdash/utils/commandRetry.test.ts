import { withSafeCommandRetry } from './commandRetry';

describe('withSafeCommandRetry', () => {
  it('retries transient failures and resolves', async () => {
    let attempts = 0;
    const result = await withSafeCommandRetry(
      async () => {
        attempts += 1;
        if (attempts < 2) {
          throw new Error('Network error');
        }
        return 'ok';
      },
      { retries: 2, retryDelayMs: 0 },
    );

    expect(result).toBe('ok');
    expect(attempts).toBe(2);
  });

  it('throws for non-retriable failures', async () => {
    await expect(
      withSafeCommandRetry(
        async () => {
          throw new Error('validation failed');
        },
        { retries: 2, retryDelayMs: 0 },
      ),
    ).rejects.toThrow('validation failed');
  });
});
