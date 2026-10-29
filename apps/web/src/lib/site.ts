export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200";
/** ICTSpark hosts live classes and exams; EduKhata links out instead of duplicating them (decision Q3). */
export const ICTSPARK_URL = process.env.NEXT_PUBLIC_ICTSPARK_URL ?? "https://ictspark.online";
/** Demo data banner (all marketplace data is still demo data until Phase 4). */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";
/** WAN Identity Hub, for "manage your WAN ID" links (password, 2FA, access requests). */
export const WAN_HUB_URL = process.env.NEXT_PUBLIC_WAN_HUB_URL ?? "http://localhost:4100";
