import { describe, expect, it } from "vitest";
import { formatAmount, formatGuaranies } from "./utils";

describe("formatAmount", () => {
  it("separa miles con punto y no lleva moneda", () => {
    expect(formatAmount(400000)).toBe("400.000");
    expect(formatAmount(1250000)).toBe("1.250.000");
    expect(formatAmount(0)).toBe("0");
  });

  it("es el mismo número que formatGuaranies, sin el 'Gs.'", () => {
    const conMoneda = formatGuaranies(530000).replace(/\s/g, " ");
    expect(conMoneda.endsWith(formatAmount(530000))).toBe(true);
  });
});
