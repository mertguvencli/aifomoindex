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
};

export default nextConfig;
