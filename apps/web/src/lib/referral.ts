/** Same cookie the API reads at onboarding (apps/api/src/routes/referrals.ts). */
export const REF_COOKIE = "ek_ref";
export const REF_DAYS = 30;
/** Codes look like EDK-ARIF-7K2M; anything else is ignored. */
export const REF_PATTERN = /^[A-Za-z0-9-]{6,30}$/;
