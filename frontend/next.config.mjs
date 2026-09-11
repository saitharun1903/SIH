/** @type {import('next').NextConfig} */
const rawBackend = process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_URL || "http://127.0.0.1:8000";
const backendOrigin = rawBackend.replace(/\/api\/v1\/?$/, "").replace(/\/+$/, "");

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendOrigin}/api/v1/:path*`,
      },
    ];
  },
  async redirects() {
    return [
      { source: "/data-ingestion", destination: "/imports", permanent: true },
      { source: "/demand-forecasts", destination: "/predictions", permanent: true },
      { source: "/scenario-compare", destination: "/scenarios", permanent: true },
      { source: "/action-center", destination: "/actions", permanent: true },
      { source: "/audit", destination: "/actions?tab=audit", permanent: true },
      { source: "/settings", destination: "/dashboard", permanent: false },
    ];
  },
};

export default nextConfig;
