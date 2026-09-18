import { getCloudflareContext } from "@opennextjs/cloudflare";

type Bucket = {
  get(key: string): Promise<{ body: ReadableStream; size: number } | null>;
};

/**
 * The Windows desktop installer, streamed from R2. The proxy already sends
 * signed-out visitors to /login, so only the team can download it.
 */
export async function GET() {
  const { env } = await getCloudflareContext({ async: true });
  const file = await (env as unknown as { DOWNLOADS?: Bucket }).DOWNLOADS?.get("Lattice-Lane-Setup.exe");
  if (!file) return new Response("The desktop app is not available yet.", { status: 404 });

  return new Response(file.body, {
    headers: {
      "content-type": "application/octet-stream",
      "content-length": String(file.size),
      "content-disposition": 'attachment; filename="Lattice-Lane-Setup.exe"',
    },
  });
}
