import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static HTML export → ./out, served by GitHub Pages.
  output: "export",
  // For project pages (https://<user>.github.io/<repo>) set NEXT_PUBLIC_BASE_PATH
  // to "/<repo>". Leave unset for a user/org page served at the domain root.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  images: {
    unoptimized: true,
  },
  // Read once per build, so every page links the same og.png?v=… and share
  // previews refetch the card instead of serving a cached score.
  env: {
    OG_VERSION: Date.now().toString(36),
  },
};

export default nextConfig;
