import { describe, expect, it } from "vitest";

import en from "./en.json";
import hi from "./hi.json";
import mr from "./mr.json";

type Json = Record<string, unknown>;

const flat = (o: Json, p = ""): string[] =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === "object" ? flat(v as Json, `${p}${k}.`) : [`${p}${k}`],
  );

const enKeys = new Set(flat(en as Json));

describe.each([
  ["hi", hi],
  ["mr", mr],
] as const)("%s locale parity with en.json", (_name, msgs) => {
  const localeKeys = new Set(flat(msgs as Json));

  it("contains every key present in en.json (D-19: en is source of truth)", () => {
    expect([...enKeys].filter((k) => !localeKeys.has(k))).toEqual([]);
  });

  it("has no stray keys absent from en.json", () => {
    expect([...localeKeys].filter((k) => !enKeys.has(k))).toEqual([]);
  });
});
