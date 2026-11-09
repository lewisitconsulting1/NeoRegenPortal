import { describe, expect, it } from "vitest";
import { parseReport } from "@/lib/report-form";

function form(overrides: Record<string, string | null> = {}): FormData {
  const values: Record<string, string | null> = {
    facilityName: "St. Mary's Hospital",
    facilityCity: "Tampa",
    facilityState: "FL",
    submitterName: "Jane Doe",
    submitterTitle: "OR Nurse",
    submitterEmail: "Jane.Doe@Example.org",
    submitterPhone: "",
    physicianName: "Dr. Smith",
    dateOfUse: "2026-11-02",
    disposition: "IMPLANTED",
    adverseEvent: "no",
    adverseEventDetails: "",
    comments: "",
    attest: "on",
    ...overrides,
  };
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) if (value !== null) data.set(key, value);
  return data;
}

describe("utilization report form", () => {
  it("accepts a complete report and cleans it up", () => {
    const result = parseReport(form());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.submitterEmail).toBe("jane.doe@example.org");
    expect(result.data.submitterPhone).toBeNull();
    expect(result.data.adverseEvent).toBe(false);
    expect(result.data.dateOfUse.toISOString()).toBe("2026-11-02T00:00:00.000Z");
  });

  it("names every missing required field at once", () => {
    const result = parseReport(form({ facilityName: "", submitterEmail: "nope", disposition: null, attest: null }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(["attest", "disposition", "facilityName", "submitterEmail"]);
    expect(result.values.facilityCity).toBe("Tampa");
  });

  it("requires details when an adverse event is reported", () => {
    const result = parseReport(form({ adverseEvent: "yes" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.adverseEventDetails).toBeDefined();
  });

  it("requires a physician only for implanted tissue", () => {
    expect(parseReport(form({ physicianName: "" })).ok).toBe(false);
    expect(parseReport(form({ physicianName: "", disposition: "RETURNED" })).ok).toBe(true);
  });

  it("refuses impossible and future dates", () => {
    expect(parseReport(form({ dateOfUse: "2026-02-30" })).ok).toBe(false);
    expect(parseReport(form({ dateOfUse: "2999-01-01" })).ok).toBe(false);
    expect(parseReport(form({ dateOfUse: "" })).ok).toBe(false);
  });

  it("refuses a disposition that isn't on the list", () => {
    expect(parseReport(form({ disposition: "SOLD" })).ok).toBe(false);
  });
});
