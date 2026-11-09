import { describe, expect, it } from "vitest";
import { MAX_UNITS_PER_ADD, normalizeLotNumber, unitIdsFromList, unitIdsFromRange } from "@/lib/units";

describe("lot numbers", () => {
  it("are trimmed and upper-cased", () => {
    expect(normalizeLotNumber(" nb260001 ")).toBe("NB260001");
  });
  it("refuse spaces and symbols", () => {
    expect(normalizeLotNumber("NB 260001")).toBeNull();
    expect(normalizeLotNumber("NB260001/2")).toBeNull();
    expect(normalizeLotNumber("")).toBeNull();
  });
});

describe("unit IDs from a range", () => {
  it("pad numbers to four digits like the tracker", () => {
    expect(unitIdsFromRange("NB260001", 1, 3)).toEqual({
      ok: true,
      unitIds: ["NB260001-0001", "NB260001-0002", "NB260001-0003"],
    });
  });
  it("refuse a reversed, zero or oversized range", () => {
    expect(unitIdsFromRange("NB260001", 5, 2).ok).toBe(false);
    expect(unitIdsFromRange("NB260001", 0, 2).ok).toBe(false);
    expect(unitIdsFromRange("NB260001", 1, 10000).ok).toBe(false);
    expect(unitIdsFromRange("NB260001", 1, MAX_UNITS_PER_ADD + 1).ok).toBe(false);
  });
});

describe("unit IDs from a pasted list", () => {
  it("accept lines, commas and short numbers", () => {
    expect(unitIdsFromList("NB260001", "nb260001-0001\nNB260001-2, NB260001-0010")).toEqual({
      ok: true,
      unitIds: ["NB260001-0001", "NB260001-0002", "NB260001-0010"],
    });
  });
  it("refuse IDs from another lot", () => {
    const result = unitIdsFromList("NB260001", "NB260001-0001\nNB260002-0001");
    expect(result).toEqual({ ok: false, error: expect.stringContaining("NB260002-0001") });
  });
  it("refuse the same unit twice, however it is written", () => {
    const result = unitIdsFromList("NB260001", "NB260001-0001\nNB260001-1");
    expect(result).toEqual({ ok: false, error: expect.stringContaining("NB260001-0001") });
  });
  it("refuse unit 0000 and an empty paste", () => {
    expect(unitIdsFromList("NB260001", "NB260001-0000").ok).toBe(false);
    expect(unitIdsFromList("NB260001", "  \n ").ok).toBe(false);
  });
});
