import { describe, expect, it } from "vitest";
import { summarizeMonth } from "./monthTotal";

describe("summarizeMonth", () => {
  it("adds up only the entries of the given month", () => {
    const entries = [
      { issueDate: "2026-10-01", netCentimes: 10_000 },
      { issueDate: "2026-10-31", netCentimes: 2_550 },
      { issueDate: "2026-09-30", netCentimes: 99_999 },
    ];
    expect(summarizeMonth(entries, "2026-10")).toEqual({ count: 2, totalCentimes: 12_550 });
  });

  it("counts entries whose total cannot be computed but adds nothing for them", () => {
    const entries = [
      { issueDate: "2026-10-05", netCentimes: null },
      { issueDate: "2026-10-06", netCentimes: 500 },
    ];
    expect(summarizeMonth(entries, "2026-10")).toEqual({ count: 2, totalCentimes: 500 });
  });

  it("returns zero for an empty month", () => {
    expect(summarizeMonth([], "2026-10")).toEqual({ count: 0, totalCentimes: 0 });
  });

  it("throws instead of returning an inexact sum", () => {
    const entries = [
      { issueDate: "2026-10-01", netCentimes: Number.MAX_SAFE_INTEGER },
      { issueDate: "2026-10-02", netCentimes: 1 },
    ];
    expect(() => summarizeMonth(entries, "2026-10")).toThrow(RangeError);
  });
});
