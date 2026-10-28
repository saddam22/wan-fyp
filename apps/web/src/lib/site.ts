export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200";
/** ICTSpark hosts live classes and exams; EduKhata links out instead of duplicating them (decision Q3). */
export const ICTSPARK_URL = process.env.NEXT_PUBLIC_ICTSPARK_URL ?? "https://ictspark.online";
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";
