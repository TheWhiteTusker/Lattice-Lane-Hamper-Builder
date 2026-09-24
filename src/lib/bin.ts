export const RETENTION_DAYS = 30;
export const MS_PER_DAY = 1000 * 60 * 60 * 24;

export type ExpiryInfo = {
  expiresAt: string;
  daysRemaining: number;
  isExpired: boolean;
};

/**
 * Calculates retention expiry date and days remaining for an item in the Recycle Bin.
 * Retention period is 30 days from the time it was deleted.
 */
export function calculateExpiry(deletedAtStr: string, referenceTimeMs: number = Date.now()): ExpiryInfo {
  const deletedTime = new Date(deletedAtStr).getTime();
  const expiresTime = deletedTime + RETENTION_DAYS * MS_PER_DAY;
  const msRemaining = expiresTime - referenceTimeMs;
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / MS_PER_DAY));

  return {
    expiresAt: new Date(expiresTime).toISOString(),
    daysRemaining,
    isExpired: msRemaining <= 0,
  };
}
