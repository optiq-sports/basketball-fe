export function assertExpectedVersion(expectedVersion: unknown): number {
  if (typeof expectedVersion !== 'number' || !Number.isInteger(expectedVersion) || expectedVersion < 0) {
    throw new Error('Expected version must be a non-negative integer.');
  }

  return expectedVersion;
}

export function shouldApplyIncomingVersion(
  currentVersion: number,
  incomingVersion: number,
): boolean {
  return incomingVersion > currentVersion;
}
