import { DomainError } from "../shared/domain-error";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

export interface ImageVault {
  put(
    projectId: string,
    key: string,
    contentType: string | undefined,
    bytes: ArrayBuffer,
  ): Promise<void>;
  get(projectId: string, key: string): Promise<R2ObjectBody>;
}

export function createImageVault(db: D1Database, bucket: R2Bucket): ImageVault {
  async function isReferenced(projectId: string, key: string): Promise<boolean> {
    const row = await db
      .prepare(
        `SELECT 1 AS allowed FROM snapshots s JOIN builds b ON b.id = s.build_id
       WHERE b.project_id = ?1 AND (?2 = s.actual_key OR ?2 = s.expected_key OR ?2 = s.diff_key)
       UNION SELECT 1 AS allowed FROM baselines WHERE project_id = ?1 AND image_key = ?2 LIMIT 1`,
      )
      .bind(projectId, key)
      .first<{ allowed: number }>();

    return row?.allowed === 1;
  }

  return {
    async put(_projectId, key, contentType, bytes) {
      if (contentType !== "image/png") {
        throw new DomainError("Only PNG images are supported", 400);
      }

      if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) {
        throw new DomainError("Image must be between 1 byte and 20 MB", 400);
      }
      const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");

      if (digest !== key) {
        throw new DomainError("Image key does not match its content", 400);
      }
      await bucket.put(key, bytes, { httpMetadata: { contentType: "image/png" } });
    },

    async get(projectId, key) {
      if (!(await isReferenced(projectId, key))) {
        throw new DomainError("Image not found", 404);
      }
      const object = await bucket.get(key);

      if (!object) {
        throw new DomainError("Image not found", 404);
      }

      return object;
    },
  };
}
