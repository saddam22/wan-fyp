import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  createLocalHub,
  diskStorage,
  runLocalHubMigrations,
  type LocalHub,
} from "@local-hub/server";
import type { StaffRole } from "@local-hub/contracts";
import type { Config } from "../config.ts";
import type { Db } from "../db.ts";
import type { Deps } from "../deps.ts";
import type { Hub } from "../lib/hub.ts";
import { currentSession } from "../lib/session.ts";

/** Where the module is mounted inside the API (the web reaches it at /api/local). */
export const JOBS_PREFIX = "/local";

/** The module keeps its own migration history (lh_schema_migrations); FKs point at `users`. */
export const migrateJobs = (db: Db) => runLocalHubMigrations(db);

/**
 * The marketplace-jobs module (Local Hub, jobs only) as EduKhata's jobs and tuition board:
 * employers (coaching centres, schools, families) post jobs, people apply with a private
 * CV. Wired to EduKhata's sessions, users, roles and notifications; files on private disk.
 */
export function createJobsBoard(
  db: Db,
  config: Config,
  hub: Hub,
  notifications: Deps["notifications"],
): LocalHub & { mountFiles(app: FastifyInstance): Promise<void> } {
  const base = `${config.webUrl}/api${JOBS_PREFIX}/storage`;
  // Two stores like the module's demo host: processed images are public, CVs never are.
  const images = diskStorage({
    root: `${config.orderFilesDir}/jobs/public`,
    baseUrl: base,
    secret: config.chatSecret,
    public: true,
  });
  const documents = diskStorage({
    root: `${config.orderFilesDir}/jobs/private`,
    baseUrl: `${base}/private`,
    secret: config.chatSecret,
    public: false,
  });

  const board = createLocalHub({
    pool: db,
    config: {
      features: {
        jobs: true,
        services: false,
        maps: false,
        events: false,
        emergency: false,
        marketplace: false,
      },
      map: { provider: "none" },
      linkBase: "",
    },
    ports: {
      // EduKhata's session (cookie, server-side); people need a role (onboarded).
      authenticate: async (req: FastifyRequest) => {
        const s = await currentSession(db, config, hub, req).catch(() => null);
        return s && s.roles.length ? { id: s.user.id } : null;
      },
      profiles: {
        async getMany(ids) {
          const rows = (
            await db.query<{ id: string; name: string }>(
              "select id, name from users where id = any($1::uuid[])",
              [ids],
            )
          ).rows;
          // Names only: no photos, emails or numbers.
          return new Map(
            rows.map((r) => [r.id, { id: r.id, name: r.name, handle: null, avatarUrl: null }]),
          );
        },
        async exists(id) {
          return !!(
            await db.query("select 1 from users where id::text = $1 and status = 'active'", [id])
          ).rowCount;
        },
      },
      imageStorage: images,
      documentStorage: documents,
      // EduKhata staff moderate the board and verify employers.
      roles: {
        async rolesOf(userId) {
          const roles = (
            await db.query<{ role: string }>("select role from user_roles where user_id = $1", [
              userId,
            ])
          ).rows.map((r) => r.role);
          const out: StaffRole[] = [];
          if (roles.includes("admin") || roles.includes("super_admin"))
            out.push("admin", "moderator");
          else if (roles.includes("supporter")) out.push("moderator");
          return out;
        },
      },
      // Into EduKhata's notification inbox (the module writes ready Bengali text).
      notifications: {
        async notify(messages) {
          for (const m of messages)
            await notifications.service
              .notify({
                type: "jobs.update",
                recipientIds: [m.userId],
                actorId: null,
                // Module links are app-relative (/jobs/…), the same paths as EduKhata's pages.
                payload: { link: m.link ?? "/jobs" },
                data: { title: m.title, body: m.body },
              })
              .catch(() => undefined);
        },
      },
    },
  });

  /** Signed upload and public image routes, as the module's demo host does. */
  async function mountFiles(app: FastifyInstance) {
    await app.register(async (s) => {
      s.removeAllContentTypeParsers();
      for (const type of ["image/jpeg", "image/png", "image/webp", "application/pdf"])
        s.addContentTypeParser(
          type,
          { parseAs: "buffer", bodyLimit: 11 * 1024 * 1024 },
          (_req, body, done) => done(null, body),
        );
      const q = z.object({ key: z.string().max(300), expires: z.string(), sig: z.string() });
      const upload = (store: typeof images) => async (req: FastifyRequest, reply: FastifyReply) => {
        const parsed = q.safeParse(req.query);
        const ct = String(req.headers["content-type"] ?? "");
        if (
          !parsed.success ||
          !store.verifyUpload(parsed.data.key, parsed.data.expires, parsed.data.sig, ct)
        )
          return reply
            .status(403)
            .send({ error: { code: "forbidden", message: "Invalid or expired upload URL" } });
        if (!Buffer.isBuffer(req.body))
          return reply
            .status(415)
            .send({ error: { code: "validation", message: "Unsupported type" } });
        // The module checks the content (magic bytes) and strips EXIF when the upload completes.
        await store.put(parsed.data.key, req.body, ct);
        return reply.status(200).send({ ok: true });
      };
      s.put(`${JOBS_PREFIX}/storage/upload`, upload(images));
      s.put(`${JOBS_PREFIX}/storage/private/upload`, upload(documents));
      s.get(`${JOBS_PREFIX}/storage/files/*`, async (req, reply) => {
        const key = (req.params as { "*": string })["*"];
        // Only processed images are public; raw uploads and documents never are.
        if (!key.startsWith("local/img/") || key.includes("..")) return reply.status(404).send();
        const body = await images.get(key);
        if (!body) return reply.status(404).send();
        return reply
          .header("content-type", "image/webp")
          .header("x-content-type-options", "nosniff")
          .header("cache-control", "public, max-age=31536000, immutable")
          .send(body);
      });
    });
  }

  return { ...board, mountFiles };
}
