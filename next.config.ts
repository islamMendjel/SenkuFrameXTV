import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            // Fullscreen / autoplay / encrypted-media must never be
            // policy-blocked — the stage fullscreen engine and provider
            // playback depend on them. Explicit allow-list also grants the
            // provider iframe (fullscreen steals, native playback).
            key: "Permissions-Policy",
            value:
              "fullscreen=*, autoplay=*, encrypted-media=*, picture-in-picture=*, accelerometer=(), camera=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
          },
          {
            // legacy engine still read by some browsers/shield modes
            key: "Feature-Policy",
            value: "fullscreen *; autoplay *; encrypted-media *",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
