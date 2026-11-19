import { describe, expect, test } from "vitest";
import { ecoScore } from "./eco-score";

const none = { bulk: false, local: false, plasticFree: false, certified: false };

describe("ecoScore", () => {
  test("0 criterios = sin puntos", () => {
    expect(ecoScore(none)).toBeNull();
  });

  test("1 criterio = C", () => {
    expect(ecoScore({ ...none, local: true })).toBe("C");
    expect(ecoScore({ ...none, certified: true })).toBe("C");
  });

  test("2 criterios = B", () => {
    expect(ecoScore({ ...none, bulk: true, plasticFree: true })).toBe("B");
  });

  test("3 criterios = A", () => {
    expect(ecoScore({ ...none, bulk: true, local: true, plasticFree: true })).toBe("A");
  });

  test("4 criterios = A", () => {
    expect(ecoScore({ bulk: true, local: true, plasticFree: true, certified: true })).toBe("A");
  });
});
