/** @type {import('next').NextConfig} */
const nextConfig = {
  // Links shared from the first version of the site keep working.
  async redirects() {
    return [
      { source: "/live", destination: "/schedule", permanent: false },
      { source: "/live/:id", destination: "/games/:id", permanent: false },
      { source: "/live/:id/:tab", destination: "/games/:id", permanent: false },
      { source: "/operator/live", destination: "/operator", permanent: false },
      { source: "/operator/live/:id", destination: "/operator/:id", permanent: false },
      { source: "/athletes/:slug", destination: "/players/:slug", permanent: false },
      { source: "/announcements/:path*", destination: "/news/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
