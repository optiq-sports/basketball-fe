/** App role values returned by auth profile (API uses uppercase). */
export const ROLE_STATISTICIAN = 'STATISTICIAN' as const;

export type AppRole = 'SUPER_ADMIN' | 'ADMIN' | typeof ROLE_STATISTICIAN | string;
