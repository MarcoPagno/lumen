const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.wikimedia.org" },
      { protocol: "https", hostname: "**.wikipedia.org" },
    ],
  },
};
export default nextConfig;
