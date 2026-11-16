const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.wikimedia.org" },
      { protocol: "https", hostname: "**.wikipedia.org" },
      { protocol: "https", hostname: "covers.openlibrary.org" },
    ],
  },
};
export default nextConfig;
