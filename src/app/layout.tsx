import type { Metadata, Viewport } from "next";
import { Inter, Cairo } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { Footer } from "@/components/Footer";
import { InstallPrompt } from "@/components/InstallPrompt";

// ─── Senku-frameXTV · root layout ────────────────────────────────────────────
// English default UI · dark-by-default theme · Arabic-capable typography.

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Senku-frameXTV — Cinematic Streaming",
    template: "%s · Senku-frameXTV",
  },
  description:
    "Stream movies & series in cinema quality. Arabic-first subtitles, multi-server failover, installable Android PWA experience.",
  applicationName: "Senku-frameXTV",
  manifest: "/manifest.json",
  keywords: ["streaming", "movies", "series", "arabic subtitles", "framextv", "senku"],
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: [{ url: "/icons/icon-192.png" }],
  },
  openGraph: {
    title: "Senku-frameXTV",
    description: "Cinematic streaming · Arabic-first subtitles · multi-server failover",
    siteName: "Senku-frameXTV",
    type: "website",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
    { media: "(prefers-color-scheme: light)", color: "#09090b" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning className="dark">
      <body className={`${inter.variable} ${cairo.variable} antialiased`}>
        <Providers>
          <div className="flex min-h-screen flex-col bg-background text-foreground">
            <Navbar />
            <main className="flex-1 pb-20 lg:pb-0">{children}</main>
            <Footer />
            <BottomNav />
            <InstallPrompt />
          </div>
        </Providers>
      </body>
    </html>
  );
}
