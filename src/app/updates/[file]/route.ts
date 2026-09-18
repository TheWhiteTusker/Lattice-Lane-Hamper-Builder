import { getCloudflareContext } from "@opennextjs/cloudflare";

type Bucket = {
  get(key: string): Promise<{ body: ReadableStream; size: number } | null>;
};

// Public on purpose (see proxy.ts): the desktop app's updater fetches these
// before anyone signs in. The installer holds only the public anon key.
const FILES: Record<string, string> = {
  "latest.json": "application/json",
  "Lattice-Lane-Setup.exe": "application/octet-stream",
};

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file: name } = await params;
  const type = FILES[name];
  if (!type) return new Response("Not found", { status: 404 });

  const { env } = await getCloudflareContext({ async: true });
  const file = await (env as unknown as { DOWNLOADS?: Bucket }).DOWNLOADS?.get(name);
  if (!file) return new Response("Not found", { status: 404 });

  return new Response(file.body, {
    headers: {
      "content-type": type,
      "content-length": String(file.size),
      "cache-control": "no-cache",
      ...(type === "application/octet-stream" && {
        "content-disposition": `attachment; filename="${name}"`,
      }),
    },
  });
}
