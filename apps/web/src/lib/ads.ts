/** WAN Central Ad Platform connection (build-time). Both empty = no ads. */
export const ADS_URL = process.env.NEXT_PUBLIC_ADS_URL ?? "";
export const ADS_APP_KEY = process.env.NEXT_PUBLIC_ADS_APP_KEY ?? "";
export const ADS_ENABLED = !!ADS_URL && !!ADS_APP_KEY;
