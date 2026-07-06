# RAF Marketplace — Web (Next.js)

Arabic-first (RTL) customer storefront for the RAF Marketplace, built with
**Next.js 14 (App Router) + TypeScript + Tailwind CSS**. It consumes the live
FastAPI backend.

## Features
- Product browsing with search, sorting (newest/price/rating) and in-stock filter
- Product detail with images, variants, and add-to-cart
- Registration / login (JWT, with optional 2FA code field)
- Cart and checkout (Cash on Delivery) → shows the order number
- Bilingual-ready, RTL layout, Cairo font, responsive

## Configure
Set the API base URL (defaults to the deployed API):

```bash
cp .env.example .env.local
# NEXT_PUBLIC_API_BASE=https://raf-marketplace-api.onrender.com
```

## Run locally
```bash
npm install
npm run dev      # http://localhost:3000
```

## Build
```bash
npm run build && npm start
```
Verified: `next build` compiles all routes cleanly.

## Deploy on Vercel
1. Import the GitHub repo `waleedawadpp/designing-hr-db-main` in Vercel.
2. **Root Directory:** `web`
3. Framework preset: **Next.js** (auto-detected).
4. **Environment Variable:** `NEXT_PUBLIC_API_BASE = https://raf-marketplace-api.onrender.com`
5. Deploy.

> The backend already allows CORS (`RAF_CORS_ORIGINS`). For production, set it to
> your Vercel domain instead of `*`.
