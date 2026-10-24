/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',            // pure static files -> host anywhere, works offline, PWABuilder-ready
  images: { unoptimized: true },
  reactStrictMode: false,
};
export default nextConfig;
