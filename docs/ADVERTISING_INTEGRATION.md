# Advertising Integration — Central Ad Platform

Status: **design only**.

## What the platform supports (verified in source)

- Placement formats: `text, native, banner_300x250, banner_320x50, video_reel, video_instream`.
- Web SDK `@adp/sdk` (`createAdsClient({ baseUrl, appKey })`, `<AdSlot client placement contentId />`, `InstreamAd`); impressions = ≥50% visible for 1 s; clicks always via the platform's signed link.
- App settings: Ads on/off, "Students use this app" (blocks finance & health categories; gambling/dating/tobacco/alcohol always blocked), max ads per page, per-placement on/off.
- Contextual only — no user data is sent.
- Creator program (`/v1/app-api/content`, server secret `aps_…`) — **not proposed** for EduKhata now: mentors are paid via orders; mixing ad revenue share into mentor earnings needs a separate decision.

## Proposed placements

| Placement slug | Page | Format | Notes |
|---|---|---|---|
| `home-native` | Homepage, between sections | native | max 1 |
| `blog-end` | Blog article end | text / native | |
| `mentor-list` | Mentor search results, after every 8 cards | native | labelled "Sponsored" |
| `help-sidebar` | Public sidebars | banner_300x250 | desktop only |

**Never** on: order creation, checkout/payment, work preview, revision, dispute, skill tests, dashboards' financial pages.

## Ads vs. paid boosts vs. verification (three separate things)

| Thing | Who pays | Where it lives | Label |
|---|---|---|---|
| Advertisement | Advertiser via Ad Platform | Ad Platform | "বিজ্ঞাপন / Sponsored" |
| Featured mentor / profile boost | Mentor via EduKhata subscription/boost | EduKhata | "Featured" (paid) |
| Verified badge | Nobody — earned by review | EduKhata verification | "Verified" |

Organic ranking (rating, completion, on-time rate) is computed without any paid input; boosted cards occupy separate, labelled slots.

## Needed from you
- Ad Platform URL for EduKhata environments and an `app_…` key (created by a platform admin).
