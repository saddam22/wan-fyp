"use client";

import { useMemo } from "react";
// Compiled entry points (built by `pnpm build:modules`): Turbopack can't map the
// SDK sources' NodeNext ".js" imports.
import { createAdsClient } from "@adp/sdk/dist";
import { AdSlot as SdkAdSlot } from "@adp/sdk/dist/react";
import { ADS_APP_KEY, ADS_URL } from "@/lib/ads";

/**
 * A sponsored slot served by the WAN Central Ad Platform. Renders nothing on no-fill or
 * error, and every ad is labelled "Sponsored" by the SDK. No personal data is sent: only
 * the placement and a random device id for frequency capping.
 */
export function LiveAdSlot({ placement, contentId }: { placement: string; contentId?: string }) {
  const client = useMemo(() => createAdsClient({ baseUrl: ADS_URL, appKey: ADS_APP_KEY }), []);
  return (
    <SdkAdSlot
      client={client}
      placement={placement}
      {...(contentId ? { contentId } : {})}
      className="block w-full"
    />
  );
}
