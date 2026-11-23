import path from "node:path";
import type { NextConfig } from "next";

const browserTest = process.env.DRA_BROWSER_TEST === "true";
if (browserTest && (process.env.APP_ORIGIN !== "http://localhost:3100" || process.env.API_INTERNAL_URL !== "http://127.0.0.1:3101")) {
  throw new Error("Cache de ensaio restrito às portas locais 3100/3101.");
}
const nextConfig: NextConfig = {
  devIndicators: false,
  ...(browserTest ? { distDir: ".next-browser-tests", typescript: { tsconfigPath: "tsconfig.browser-test.json" } } : {}),
  output: "standalone",
  outputFileTracingRoot: path.resolve(__dirname, ".."),
  poweredByHeader: false,
  async rewrites() {
    if (process.env.NODE_ENV === "production") return [];
    return [{ source: "/api/:path*", destination: `${process.env.API_INTERNAL_URL ?? "http://127.0.0.1:3001"}/api/:path*` }];
  },
};

export default nextConfig;
