import { describe, expect, it } from "vitest";
import { CODE_LENGTH, formatAccessCode, generateAccessCode, normalizeAccessCode } from "@/lib/codes";

describe("access codes", () => {
  it("are 12 characters from the Crockford alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateAccessCode();
      expect(code).toMatch(/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{12}$/);
    }
  });

  it("do not repeat across many draws", () => {
    const codes = new Set(Array.from({ length: 5000 }, generateAccessCode));
    expect(codes.size).toBe(5000);
  });

  it("accept lower case, dashes, spaces and look-alike letters", () => {
    expect(normalizeAccessCode("k7qf-3mzp-9txa")).toBe("K7QF3MZP9TXA");
    expect(normalizeAccessCode(" K7QF 3MZP 9TXA ")).toBe("K7QF3MZP9TXA");
    expect(normalizeAccessCode("OIL0-0000-0000")).toBe("011000000000");
  });

  it("reject anything that cannot be a code", () => {
    expect(normalizeAccessCode("K7QF3MZP9TX")).toBeNull();
    expect(normalizeAccessCode("K7QF3MZP9TXAB")).toBeNull();
    expect(normalizeAccessCode("U7QF3MZP9TXA")).toBeNull();
    expect(normalizeAccessCode("K7QF3MZP9TX!")).toBeNull();
  });

  it("format in groups of four", () => {
    expect(formatAccessCode("K7QF3MZP9TXA")).toBe("K7QF-3MZP-9TXA");
    expect(formatAccessCode("K7QF3MZP9TXA").replace(/-/g, "")).toHaveLength(CODE_LENGTH);
  });
});
