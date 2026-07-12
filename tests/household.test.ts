import { describe, it, expect } from "vitest";
import { FAMILY_SHARED, memberOptions, isBuiltInMember } from "../src/lib/household";

describe("memberOptions", () => {
  it("always offers Family Shared first", () => {
    expect(memberOptions([])).toEqual([FAMILY_SHARED]);
    expect(memberOptions(["Me", "Partner"])).toEqual([FAMILY_SHARED, "Me", "Partner"]);
  });
  it("trims, drops blanks, and de-dupes case-insensitively", () => {
    expect(memberOptions([" Me ", "me", "", "Partner", "family shared"])).toEqual([
      FAMILY_SHARED,
      "Me",
      "Partner",
    ]);
  });
});

describe("isBuiltInMember", () => {
  it("flags only the built-in", () => {
    expect(isBuiltInMember("Family Shared")).toBe(true);
    expect(isBuiltInMember("family shared")).toBe(true);
    expect(isBuiltInMember("Me")).toBe(false);
  });
});
