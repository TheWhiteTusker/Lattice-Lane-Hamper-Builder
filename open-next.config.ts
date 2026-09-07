import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Defaults are what this app needs: no incremental cache to configure, since
// every page that matters is dynamic (they all read cookies via requireUser).
export default defineCloudflareConfig();
