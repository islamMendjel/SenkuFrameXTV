<div align="center">

<img src="https://senkuframextv.space-z.ai/_next/image?url=%2Flogo.png&w=96&q=75" alt="Senku-frameXTV Logo" width="80" />

# Senku-frameXTV

**Cinematic streaming · Arabic-first subtitles · Multi-server failover**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-senkuframextv.space--z.ai-blue?style=for-the-badge&logo=vercel)](https://senkuframextv.space-z.ai)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com)
[![Bun](https://img.shields.io/badge/Runtime-Bun-fbf0df?style=for-the-badge&logo=bun)](https://bun.sh)

</div>

---

## ✨ What is Senku-frameXTV?

**Senku-frameXTV** is a cinematic streaming web app built for the Arab world. It surfaces trending movies, series, anime, and regional Arab content with a beautiful dark UI, Arabic-first subtitle priority, and seamless multi-server video playback powered by [FrameXTV](https://framextv.cc/).

> No files are hosted. Senku-frameXTV streams via third-party providers.

---

## 🖼️ Preview

| Home | Search | Watch |
|------|--------|-------|
| Trending now · Arab World · Anime sections | Full-text search in English or Arabic | Embedded player with server failover |

---

## 🚀 Features

- 🎬 **Cinematic homepage** — trending movies, series, anime & Arab World curated rows
- 🔍 **Bilingual search** — find content in English or Arabic
- 🌐 **Multi-server failover** — automatic fallback if the primary stream drops
- 📋 **Personal watchlist** — save titles, persisted per user
- 🌍 **Arabic-first subtitles** — Arabic subtitles loaded by default when available
- 🌙 **Dark-only UI** — `#09090b` base, designed for cinema comfort
- 📱 **Installable PWA** — add to Android home screen for a native-like experience
- ⌨️ **Command palette** — `K` shortcut to jump anywhere in the app
- 🔐 **Auth** — user accounts via NextAuth.js
- 🗃️ **Persistent DB** — Prisma + SQLite/Postgres for watchlists & user data
- 🌏 **i18n** — Arabic / English toggle via next-intl

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router, standalone output) |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS v4 + shadcn/ui + Radix UI |
| **Runtime** | Bun |
| **Database** | Prisma ORM (SQLite / Postgres) |
| **Auth** | NextAuth.js v4 |
| **State** | Zustand · TanStack Query |
| **Animations** | Framer Motion |
| **Forms** | React Hook Form + Zod |
| **Streaming** | FrameXTV iframe embed |
| **Reverse Proxy** | Caddy (Caddyfile included) |
| **Internationalization** | next-intl |
| **UI Components** | shadcn/ui · Radix UI · Lucide icons · Embla Carousel |

---

## 📁 Project Structure

```
SenkuFrameXTV/
├── src/                  # App source (Next.js App Router)
├── prisma/               # Database schema & migrations
├── db/                   # DB seed / helpers
├── public/               # Static assets (logo, icons, manifest)
├── mini-services/        # Standalone micro-utilities
├── examples/websocket/   # WebSocket usage examples
├── tests/                # Test suite
├── Caddyfile             # Caddy reverse proxy config
├── next.config.ts        # Next.js config
├── tailwind.config.ts    # Tailwind config
└── .env                  # Environment variables (see below)
```

---

## ⚙️ Getting Started

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.3
- Node.js ≥ 20 (for tooling)
- A running database (SQLite works out of the box)

### 1. Clone the repo

```bash
git clone https://github.com/islamMendjel/SenkuFrameXTV.git
cd SenkuFrameXTV
```

### 2. Install dependencies

```bash
bun install
```

### 3. Configure environment

Copy `.env` and fill in your values:

```bash
cp .env .env.local
```

Key variables:

```env
DATABASE_URL="file:./dev.db"          # or postgres://...
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"
```

### 4. Set up the database

```bash
bun run db:push       # push schema (dev)
# or
bun run db:migrate    # run migrations
```

### 5. Run the dev server

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 🏗️ Building for Production

```bash
bun run build
bun run start
```

The build uses Next.js standalone output — the entire server is bundled into `.next/standalone/server.js` for minimal deployment size.

### With Caddy (reverse proxy)

A `Caddyfile` is included. To serve on a domain:

```bash
caddy run --config Caddyfile
```

---

## 🌐 Deployment

The live instance runs at **[senkuframextv.space-z.ai](https://senkuframextv.space-z.ai)** on a self-hosted setup behind Caddy.

You can deploy to any VPS or container host that supports Bun + Node.js:

- Copy `.next/standalone` to the server
- Set env variables
- Run `bun .next/standalone/server.js`
- Point Caddy / Nginx at the port

---

## 📜 Legal

Senku-frameXTV **does not host, store, or distribute** any media files. All video content is embedded from third-party providers via [FrameXTV](https://framextv.cc/). This project is for educational and personal use only.

---

## 🤝 Contributing

Pull requests are welcome. For major changes, open an issue first to discuss what you'd like to change.

```bash
# lint before submitting
bun run lint
```

---

<div align="center">

Built with ❤️ by [islamMendjel](https://github.com/islamMendjel) · Powered by [FrameXTV](https://framextv.cc/)

</div>
