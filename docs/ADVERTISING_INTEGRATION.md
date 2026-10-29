# Advertising Integration — Central Ad Platform

Status: **Phase 3 done** for the public site. The SDK is wired into the three placements below. It is switched off until the platform URL and app key are set.

## How it is wired

- `apps/web/src/components/public/AdSlot.tsx` uses `@adp/sdk`'s `<AdSlot>`. The SDK labels every ad "Sponsored", links carry `rel="sponsored"`, and nothing renders on no-fill or error.
- Settings (build-time): `NEXT_PUBLIC_ADS_URL`, `NEXT_PUBLIC_ADS_APP_KEY` (`lib/ads.ts`). Without them, the demo preview shows a labelled placeholder and production shows nothing.
- Sent per request: app key, placement, a random device id (frequency capping) and a page-view id. No personal data.
- EduKhata uses the SDK's compiled entry points `@adp/sdk/dist`, an additive upstream change in `central-ad-platform` (branch `ccr-5992ee5d-65mqhc`). Turbopack can't map the sources' NodeNext `.js` imports; `pnpm build:modules` builds it.
- Live placements: `home-native` (homepage), `blog-list` (blog index), `blog-end` (article end). `mentor-list` and `help-sidebar` are not placed yet. No ads in dashboards, sign-in, orders or payments.
- Verified against an intercepted ad server: a filled ad renders labelled, no-fill renders nothing, and no request is made without settings. The impression beacon (≥50% visible for 1 s) was not exercised in that check.
- Owner setting on the platform: enable **"Students use this app"** for EduKhata. It blocks finance and health categories; gambling, dating, tobacco and alcohol are always blocked.

## What the platform supports (verified in source)

- Placement formats: `text, native, banner_300x250, banner_320x50, video_reel, video_instream`.
- Web SDK `@adp/sdk` (`createAdsClient({ baseUrl, appKey })`, `<AdSlot client placement contentId />`, `InstreamAd`); impressions = ≥50% visible for 1 s; clicks always via the platform's signed link.
- App settings: Ads on/off, "Students use this app" (blocks finance & health categories; gambling/dating/tobacco/alcohol always blocked), max ads per page, per-placement on/off.
- Contextual only — no user data is sent.
- Creator program (`/v1/app-api/content`, server secret `aps_…`) — **not proposed** for EduKhata now: mentors are paid via orders; mixing ad revenue share into mentor earnings needs a separate decision.

## Placements (planned list; three are live)

| Placement slug | Page                                       | Format         | Notes                |
| -------------- | ------------------------------------------ | -------------- | -------------------- |
| `home-native`  | Homepage, between sections                 | native         | max 1                |
| `blog-end`     | Blog article end                           | text / native  |                      |
| `mentor-list`  | Mentor search results, after every 8 cards | native         | labelled "Sponsored" |
| `help-sidebar` | Public sidebars                            | banner_300x250 | desktop only         |

**Never** on: order creation, checkout/payment, work preview, revision, dispute, skill tests, dashboards' financial pages.

## Ads vs. paid boosts vs. verification (three separate things)

| Thing                           | Who pays                               | Where it lives        | Label                  |
| ------------------------------- | -------------------------------------- | --------------------- | ---------------------- |
| Advertisement                   | Advertiser via Ad Platform             | Ad Platform           | "বিজ্ঞাপন / Sponsored" |
| Featured mentor / profile boost | Mentor via EduKhata subscription/boost | EduKhata              | "Featured" (paid)      |
| Verified badge                  | Nobody — earned by review              | EduKhata verification | "Verified"             |

Organic ranking (rating, completion, on-time rate) is computed without any paid input; boosted cards occupy separate, labelled slots.

## Needed from you

- Ad Platform URL for EduKhata environments and an `app_…` key (created by a platform admin).
