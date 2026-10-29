import { describe, expect, it } from "vitest";
import {
  bdt,
  countdown,
  formatMoney,
  fromBnDigits,
  groupDigits,
  isValidTrxId,
  normalizeBdMobile,
  normalizeTrxId,
  splitCommission,
  toBnDigits,
  urgency,
} from "./format";

describe("money", () => {
  it("groups BDT the South Asian way", () => {
    expect(groupDigits(120000)).toBe("1,20,000");
    expect(groupDigits(12345678)).toBe("1,23,45,678");
    expect(groupDigits(999)).toBe("999");
    expect(groupDigits(1200000, "USD")).toBe("1,200,000");
  });
  it("formats money in English and Bengali", () => {
    expect(formatMoney(bdt(1500))).toBe("৳1,500");
    expect(formatMoney(bdt(1500), "bn")).toBe("৳১,৫০০");
    expect(formatMoney({ amountMinor: 12345, currency: "BDT" })).toBe("৳123.45");
    expect(formatMoney({ amountMinor: 500, currency: "USD" }, "en", { decimals: true })).toBe(
      "$5.00",
    );
  });
  it("splits commission so the parts always add up", () => {
    expect(splitCommission(200000, 0.2)).toEqual({ platformMinor: 40000, mentorMinor: 160000 });
    for (const amount of [1, 3, 99, 12345, 77777]) {
      const s = splitCommission(amount, 0.2);
      expect(s.platformMinor + s.mentorMinor).toBe(amount);
    }
    expect(() => splitCommission(-1, 0.2)).toThrow(RangeError);
    expect(() => splitCommission(100, 1.5)).toThrow(RangeError);
    expect(() => splitCommission(10.5, 0.2)).toThrow(RangeError);
  });
});

describe("digits and identifiers", () => {
  it("round-trips Bengali digits", () => {
    expect(toBnDigits("2026")).toBe("২০২৬");
    expect(fromBnDigits("০১৭১২")).toBe("01712");
  });
  it("normalizes TrxIDs like ICTSpark", () => {
    expect(normalizeTrxId(" bkx-92kd ৭১l ")).toBe("BKX92KD71L");
    expect(isValidTrxId("7HG2K9QX1", "bkash")).toBe(true);
    expect(isValidTrxId("12345", "bkash")).toBe(false);
    expect(isValidTrxId("NPSB2026102811", "bank")).toBe(true);
  });
  it("validates Bangladeshi mobiles", () => {
    expect(normalizeBdMobile("+8801712345678")).toBe("01712345678");
    expect(normalizeBdMobile("০১৭১২৩৪৫৬৭৮")).toBe("01712345678");
    expect(normalizeBdMobile("01212345678")).toBeNull();
  });
});

describe("countdown", () => {
  const now = Date.parse("2026-10-28T00:00:00Z");
  it("splits remaining time", () => {
    expect(countdown("2026-10-29T02:03:04Z", now)).toMatchObject({
      overdue: false,
      days: 1,
      hours: 2,
      minutes: 3,
      seconds: 4,
    });
    expect(countdown("2026-10-27T23:00:00Z", now)).toMatchObject({ overdue: true, hours: 1 });
  });
  it("classifies urgency", () => {
    expect(urgency("2026-10-27T00:00:00Z", now)).toBe("overdue");
    expect(urgency("2026-10-28T06:00:00Z", now)).toBe("critical");
    expect(urgency("2026-10-29T06:00:00Z", now)).toBe("soon");
    expect(urgency("2026-11-05T00:00:00Z", now)).toBe("ok");
  });
});
