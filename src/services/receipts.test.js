import { splitEvents } from "./receipts";

describe("splitEvents", () => {
  test("готовые события — из data:, служебные строки пропускаются", () => {
    const text =
      "retry: 3000\n\n" +
      ": ping\n\n" +
      'event: receipt\ndata: {"receiptId":"r1","status":"accepted"}\n\n' +
      'event: receipt\ndata: {"receiptId":"r1","status":"parsed"}\n\n';
    const { events, rest } = splitEvents(text);
    expect(events).toEqual([
      { receiptId: "r1", status: "accepted" },
      { receiptId: "r1", status: "parsed" },
    ]);
    expect(rest).toBe("");
  });

  test("событие, пришедшее частями, собирается из хвоста", () => {
    const first = splitEvents('event: receipt\ndata: {"receiptId":"r2",');
    expect(first.events).toEqual([]);
    const second = splitEvents(first.rest + '"status":"parsed"}\n\n');
    expect(second.events).toEqual([{ receiptId: "r2", status: "parsed" }]);
  });

  test("переводы строк \\r\\n и битый JSON не ломают поток", () => {
    const { events } = splitEvents('data: {oops\r\n\r\ndata: {"receiptId":"r3","status":"error"}\r\n\r\n');
    expect(events).toEqual([{ receiptId: "r3", status: "error" }]);
  });
});
