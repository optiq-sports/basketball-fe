/** Number of regulation quarters before overtime periods begin. */
export const REGULATION_QUARTERS = 4;

/** "Q3" for regulation, "OT1"/"OT2"/... once past regulation. Shared by StatDash.tsx and gameLogReplay.ts. */
export function formatPeriodLabel(period: number): string {
  return period > REGULATION_QUARTERS ? `OT${period - REGULATION_QUARTERS}` : `Q${period}`;
}
