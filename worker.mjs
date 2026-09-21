// Worker entry: serves the desktop updates straight from R2, everything else
// goes to the OpenNext handler.
//
// The installer is ~112 MB. Through Next's route handler, OpenNext re-streams it
// without Content-Length and the Worker cut it off partway (12.8 MB, 81.9 MB),
// so apps installed a truncated setup and were left uninstalled. Returning the
// R2 body here streams it natively, with its real length.

// @ts-expect-error: resolved by wrangler build
import openNext from "./.open-next/worker.js";

const FILES = {
  "latest.json": "application/json",
  "Lattice-Lane-Setup.exe": "application/octet-stream",
};

export default {
  async fetch(request, env, ctx) {
    const name = new URL(request.url).pathname.match(/^\/updates\/([^/]+)$/)?.[1];
    const type = name && FILES[name];
    if (!type || (request.method !== "GET" && request.method !== "HEAD")) {
      return openNext.fetch(request, env, ctx);
    }

    const file = await env.DOWNLOADS.get(name);
    if (!file) return new Response("Not found", { status: 404 });

    const headers = {
      "content-type": type,
      "content-length": String(file.size),
      "cache-control": "no-cache",
      etag: file.httpEtag,
    };
    if (type === "application/octet-stream") {
      headers["content-disposition"] = `attachment; filename="${name}"`;
    }
    return new Response(request.method === "HEAD" ? null : file.body, { headers });
  },
};
