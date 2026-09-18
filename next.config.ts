import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.BUILD_STANDALONE === "true" ? "standalone" : undefined,
  experimental: {
    // The spreadsheet import posts six parsed CSVs in one server action.
    serverActions: { bodySizeLimit: "15mb" },
  },
};

export default nextConfig;
