import { describe, expect, it } from "vitest";
import { formatPrice, isOpenNow } from "./bite";

const hours = { wed: { open: "07:00", close: "18:00" }, mon: { closed: true } };

describe("isOpenNow (Winnipeg time)", () => {
  it("is open on Wednesday at noon Winnipeg time", () => {
    // 2026-10-28 is a Wednesday; 17:00 UTC = 12:00 CDT
    expect(isOpenNow(hours, new Date("2026-10-28T17:00:00Z"))).toBe(true);
  });
  it("is closed after closing time", () => {
    expect(isOpenNow(hours, new Date("2026-10-29T00:30:00Z"))).toBe(false);
  });
  it("is closed on a day marked closed", () => {
    expect(isOpenNow(hours, new Date("2026-10-26T17:00:00Z"))).toBe(false);
  });
});

it("formats cents as dollars", () => {
  expect(formatPrice(625)).toBe("$6.25");
});
