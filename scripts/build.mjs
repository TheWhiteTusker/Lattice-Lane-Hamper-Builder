import { execSync } from "node:child_process";

// When OpenNext triggers the build, it sets NEXT_PRIVATE_STANDALONE=true.
// In that case, run standard `next build`.
// When called by Cloudflare Workers Builds (or directly), run `opennextjs-cloudflare build`.
if (process.env.NEXT_PRIVATE_STANDALONE === "true") {
  execSync("next build", { stdio: "inherit" });
} else {
  execSync("opennextjs-cloudflare build", { stdio: "inherit" });
}
