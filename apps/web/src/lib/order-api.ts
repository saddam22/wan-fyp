"use client";

/** Calls the EduKhata API from the browser (same origin, session cookie). Throws the API's message. */
export async function orderApi<T = unknown>(
  path: string,
  method = "GET",
  body?: object,
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    ...(body
      ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
      : {}),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message ?? `Error ${res.status}`);
  return json as T;
}

/**
 * Uploads one order file: ask for a signed URL, PUT the bytes, then let the server check
 * the content (and watermark previews).
 */
export async function uploadOrderFile(
  orderId: string,
  stage: "requirement" | "preview" | "final",
  file: File,
) {
  const start = await orderApi<{
    fileId: string;
    uploadUrl: string;
    headers: Record<string, string>;
  }>(`/orders/${orderId}/files`, "POST", {
    stage,
    name: file.name,
    contentType: file.type,
    byteSize: file.size,
  });
  const put = await fetch(start.uploadUrl, { method: "PUT", headers: start.headers, body: file });
  if (!put.ok) throw new Error(`Upload of ${file.name} failed`);
  await orderApi(`/orders/${orderId}/files/${start.fileId}/complete`, "POST");
  return start.fileId;
}
