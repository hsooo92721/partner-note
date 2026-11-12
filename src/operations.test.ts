import assert from "node:assert/strict";
import { test } from "node:test";
import seed from "./seed.json";
import type { Database } from "./model";
import { localInput } from "./logic";
import { defaultStore, expiry, nextOpening } from "./operations";

const rule = (seed as unknown as Database).rules[0];
test("현재 시각은 정시부터, 직접 지정과 분 유지 규칙은 실제 시각부터", () => {
  const start = new Date(2026, 10, 11, 6, 50);
  const hours = { ...rule, durationUnit: "시간", durationValue: 12 };
  assert.equal(localInput(expiry(start, hours, true).end), "2026-11-11T18:00");
  assert.equal(localInput(expiry(start, hours, false).end), "2026-11-11T18:50");
  assert.equal(
    localInput(expiry(start, { ...hours, exactMinutes: true }, true).end),
    "2026-11-11T18:50",
  );
});
test("작업일 포함 옵션, 월말과 연도 변경", () => {
  const start = new Date(2026, 10, 11, 7);
  assert.equal(
    localInput(
      expiry(start, { ...rule, durationUnit: "일", durationValue: 2 }, false)
        .end,
    ),
    "2026-11-12T07:00",
  );
  assert.equal(
    localInput(
      expiry(
        start,
        {
          ...rule,
          durationUnit: "일",
          durationValue: 2,
          includeWorkDay: false,
        },
        false,
      ).end,
    ),
    "2026-11-13T07:00",
  );
  const months = { ...rule, durationUnit: "개월", durationValue: 3 };
  assert.equal(
    localInput(expiry(start, months, false).end),
    "2027-02-10T07:00",
  );
  assert.equal(
    localInput(
      expiry(new Date(2028, 0, 31, 7), { ...months, durationValue: 1 }, false)
        .end,
    ),
    "2028-02-29T07:00",
  );
});
test("정기 휴무와 날짜 예외를 반영해 다음 오픈을 선택", () => {
  const store = structuredClone(defaultStore);
  const start = new Date(2026, 10, 13, 22);
  assert.equal(nextOpening(store, start), null);
  store.week[6].closed = true;
  store.exceptions["2026-11-15"] = { open: "", close: "", closed: true };
  store.exceptions["2026-11-16"] = {
    open: "08:30",
    close: "22:30",
    closed: false,
  };
  assert.equal(localInput(nextOpening(store, start)!), "2026-11-16T08:30");
});
