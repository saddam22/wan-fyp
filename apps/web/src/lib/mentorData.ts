/** Demo-only helpers for the mentor area (earnings are derived from fixtures). */
import { fixtures as fx, formatMoney, mockApi } from "@edukhata/contracts";

export const fixtures = {
  ...fx,
  mentorEarnings: {
    availableMinor: 1840000,
    pendingMinor: 288000,
    lifetimeMinor: 61250000,
    paidOutMinor: 59410000,
  },
};
export { formatMoney, mockApi };

export function revenueSeriesFor() {
  return fx.revenueSeries.map((r, i) => ({
    label: r.label,
    values: [Math.round(r.gmv / 60) + i * 900],
  }));
}
