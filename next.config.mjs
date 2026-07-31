/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // The Drinks tab used to live at /autofill; keep old bookmarks working.
      // Not permanent so browsers don't cache a 308 against the route.
      { source: "/autofill", destination: "/drinks", permanent: false },
    ];
  },
};

export default nextConfig;
