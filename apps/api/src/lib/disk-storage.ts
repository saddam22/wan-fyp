import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { ChatStorage } from "@chat-module/server";

/**
 * Private files on local disk, uploaded through a signed, short-lived URL on the API
 * (the same contract as an S3/R2 pre-signed PUT). Files are never public: whoever owns
 * the file record checks access and serves it. `purpose` keeps signatures of different
 * stores apart. Single-instance only; use S3-compatible storage before scaling out.
 */
export function diskStorage(root: string, secret: string, uploadBase: string, purpose: string) {
  const base = resolve(root);
  const path = (key: string) => {
    const full = resolve(join(base, key));
    if (!full.startsWith(`${base}/`)) throw new Error("bad key");
    return full;
  };
  const mac = (key: string, exp: number, size: number, type: string) =>
    createHmac("sha256", `edukhata-${purpose}-upload:${secret}`)
      .update(`${key}\n${exp}\n${size}\n${type}`)
      .digest("base64url");

  return {
    async presignPut(key, contentType, byteSize) {
      const exp = Date.now() + 10 * 60_000;
      const q = new URLSearchParams({
        exp: String(exp),
        size: String(byteSize),
        sig: mac(key, exp, byteSize, contentType),
      });
      return { url: `${uploadBase}/${key}?${q}`, headers: { "content-type": contentType } };
    },
    verifyUpload(key: string, exp: number, size: number, type: string, sig: string) {
      const expected = Buffer.from(mac(key, exp, size, type));
      const given = Buffer.from(sig);
      return (
        exp > Date.now() && expected.length === given.length && timingSafeEqual(expected, given)
      );
    },
    async get(key) {
      return readFile(path(key)).catch(() => null);
    },
    async put(key, body) {
      await mkdir(dirname(path(key)), { recursive: true });
      await writeFile(path(key), body, { flag: "w" });
    },
    async delete(key) {
      await rm(path(key), { force: true });
    },
  } satisfies ChatStorage & { verifyUpload: unknown };
}
export type DiskStorage = ReturnType<typeof diskStorage>;
