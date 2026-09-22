const { app, request, registerUser } = require("../helpers");
const {
  fetchAndStoreRates,
  getLatestRates,
} = require("../../src/services/exchangeRates");

const SAMPLE_CBR_XML = `<?xml version="1.0" encoding="windows-1251"?>
<ValCurs Date="16.09.2026" name="Foreign Currency Market">
<Valute ID="R01235">
<NumCode>840</NumCode>
<CharCode>USD</CharCode>
<Nominal>1</Nominal>
<Name>Доллар США</Name>
<Value>93,4432</Value>
<VunitRate>93,4432</VunitRate>
</Valute>
<Valute ID="R01239">
<NumCode>978</NumCode>
<CharCode>EUR</CharCode>
<Nominal>1</Nominal>
<Name>Евро</Name>
<Value>101,2345</Value>
<VunitRate>101,2345</VunitRate>
</Valute>
</ValCurs>`;

describe("exchange rates", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("parses the CBR XML feed (comma decimals) and caches rates", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => SAMPLE_CBR_XML,
    });

    await fetchAndStoreRates();

    expect(global.fetch).toHaveBeenCalledWith(
      "https://www.cbr.ru/scripts/XML_daily.asp"
    );

    const rates = await getLatestRates();
    expect(rates.RUB).toBe(1);
    expect(rates.USD).toBeCloseTo(93.4432, 4);
    expect(rates.EUR).toBeCloseTo(101.2345, 4);
  });

  it("GET /api/exchange-rates returns the cached rates to an authenticated user", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => SAMPLE_CBR_XML,
    });
    await fetchAndStoreRates();

    const { token } = await registerUser();
    const res = await request(app)
      .get("/api/exchange-rates")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.RUB).toBe(1);
    expect(res.body.USD).toBeGreaterThan(0);
  });

  it("requires auth", async () => {
    const res = await request(app).get("/api/exchange-rates");
    expect(res.status).toBe(401);
  });
});
