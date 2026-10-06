import { describe, expect, it } from "vitest";
import { CODE_LENGTH, expiryFromDays, generateCode, validateAlias, validateUrl } from "../src/links.js";

describe("generateCode", () => {
  it("produces base62 codes of the right length", () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateCode()));
    for (const c of codes) expect(c).toMatch(new RegExp(`^[0-9A-Za-z]{${CODE_LENGTH}}$`));
    expect(codes.size).toBe(500);
  });
});

describe("validateUrl", () => {
  it("accepts http(s) and normalises", () => {
    expect(validateUrl("https://Example.com/a?b=1")).toEqual({ url: "https://example.com/a?b=1" });
  });
  it.each([undefined, "", "not a url", "javascript:alert(1)", "ftp://x.com", "https://" + "a".repeat(2050)])(
    "rejects %s",
    (input) => expect(validateUrl(input)).toHaveProperty("error"),
  );
});

describe("validateAlias", () => {
  it("accepts safe aliases", () => expect(validateAlias("my-launch_2026")).toBeNull());
  it("rejects bad or reserved aliases", () => {
    expect(validateAlias("a")).not.toBeNull();
    expect(validateAlias("has space")).not.toBeNull();
    expect(validateAlias("Links")).toBe("Alias is reserved");
  });
});

describe("expiryFromDays", () => {
  it("converts days to an epoch-seconds TTL", () => {
    expect(expiryFromDays(1, 1_000_000)).toBe(1000 + 86_400);
    expect(expiryFromDays(undefined)).toBeUndefined();
    expect(expiryFromDays(0)).toHaveProperty("error");
  });
});
