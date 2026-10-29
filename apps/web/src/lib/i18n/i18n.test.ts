import { describe, expect, it } from "vitest";
import { bn } from "./bn";
import { en } from "./en";

function keys(o: object, prefix = ""): string[] {
  return Object.entries(o).flatMap(([k, v]) =>
    typeof v === "object" && v ? keys(v as object, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe("translations", () => {
  it("Bengali has every English key and no empty strings", () => {
    expect(keys(bn).sort()).toEqual(keys(en).sort());
    for (const k of keys(bn)) {
      const v = k.split(".").reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], bn);
      expect(String(v).trim(), k).not.toBe("");
    }
  });
});
