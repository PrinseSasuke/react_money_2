const { normalizeCurrency, convert, toRub } = require("../../src/services/currency");

const rates = { RUB: 1, USD: 90, EUR: 100 };

describe("currency", () => {
  it("normalizes the spellings stored in transactions", () => {
    expect(normalizeCurrency("Рубль")).toBe("RUB");
    expect(normalizeCurrency("rub")).toBe("RUB");
    expect(normalizeCurrency("usd")).toBe("USD");
    expect(normalizeCurrency("EUR")).toBe("EUR");
    expect(normalizeCurrency(null)).toBe("RUB");
  });

  it("converts through rubles", () => {
    expect(toRub(10, "usd", rates)).toBe(900);
    expect(convert(900, "Рубль", "USD", rates)).toBe(10);
    expect(convert(10, "EUR", "USD", rates)).toBeCloseTo(11.11, 2);
  });

  it("keeps the amount when a rate is unknown instead of zeroing it", () => {
    expect(toRub(10, "USD", { RUB: 1 })).toBe(10);
  });
});
