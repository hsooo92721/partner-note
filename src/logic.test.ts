import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDuration,
  search,
  selectRules,
  validateDB,
  weekdayCodes,
  weekdayColors,
} from "./logic";
import seed from "./seed.json";
import type { Database } from "./model";
const db = seed as unknown as Database;
test("시드 스키마와 중복 ID 및 레시피 연결 검증", () => {
  validateDB(db);
  assert.equal(db.drinks.length, 11);
  for (const d of db.drinks)
    for (const t of d.availableTemperatures) {
      assert.ok(
        db.recipes.some((r) => r.drinkId === d.id && r.temperature === t),
      );
      assert.ok(d.availableSizesByTemperature[t].length);
    }
});
test("음료명·마킹명·별칭 통합 검색", () => {
  assert.equal(search(db, "자바칩 프라푸치노").drinks[0].id, "d2");
  assert.equal(search(db, "TNL").drinks[0].id, "d7");
  assert.equal(search(db, "fr").ingredients[0].name, "프라푸치노 로스트");
  assert.equal(search(db, "막걸리향").ingredients[0].name, "쌀베이스");
  assert.equal(search(db, "없는메뉴ABC").drinks.length, 0);
});
test("코르타도 HOT Short, 더블샷 ICED 7oz 제한", () => {
  assert.deepEqual(db.drinks[5].availableTemperatures, ["HOT"]);
  assert.deepEqual(db.drinks[5].availableSizesByTemperature.HOT, ["S"]);
  assert.deepEqual(db.drinks[6].availableSizesByTemperature.ICED, ["7oz"]);
  assert.deepEqual(db.drinks[6].availableTemperatures, ["ICED"]);
});
test("자몽허니 블랙티 온도별 사이즈, 트렌타 전용 순서", () => {
  const d = db.drinks[4];
  assert.deepEqual(d.availableSizesByTemperature.HOT, ["S", "T", "G", "V"]);
  assert.deepEqual(d.availableSizesByTemperature.ICED, [
    "T",
    "G",
    "V",
    "TRENTA",
  ]);
  const r = db.recipes.find((r) => r.drinkId === d.id && r.size === "TRENTA")!;
  assert.equal(r.orderedSteps.length, 7);
  assert.match(r.orderedSteps[0].description, /G사이즈 2번선/);
  assert.match(r.orderedSteps[1].description, /8회/);
});
test("T/G/V와 S/T/G/V 수량 매핑", () => {
  const java = db.recipes.find((r) => r.drinkId === "d2")!;
  assert.deepEqual(java.orderedSteps[0].quantityBySize, { T: 2, G: 3, V: 4 });
  const hot = db.recipes.find(
    (r) => r.drinkId === "d4" && r.temperature === "HOT",
  )!;
  assert.deepEqual(hot.orderedSteps[0].quantityBySize, {
    S: 1,
    T: 1,
    G: 2,
    V: 2,
  });
});
test("개봉과 제조 기준 독립, 미등록 상태 계산 차단", () => {
  assert.equal(
    selectRules(db.rules, "i6", "개봉 후", "실온", "2026-11-10")[0]
      .durationUnit,
    "개월",
  );
  assert.equal(
    selectRules(db.rules, "i6", "제조 후", "실온", "2026-11-10")[0]
      .durationValue,
    48,
  );
  assert.equal(
    selectRules(db.rules, "i6", "소분 후", "실온", "2026-11-10").length,
    0,
  );
  assert.equal(
    selectRules(db.rules, "i8", "개봉 후", "실온", "2026-11-10").length,
    1,
  );
});
test("시행일 이전·종료일·변경 예정 구분", () => {
  const r = {
    ...db.rules[0],
    effectiveFrom: "2027-01-01",
    effectiveUntil: "2027-02-01",
  };
  assert.equal(
    selectRules(
      [r],
      r.ingredientId,
      r.workState,
      r.storageCondition,
      "2026-12-31",
    ).length,
    0,
  );
  assert.equal(
    selectRules(
      [r],
      r.ingredientId,
      r.workState,
      r.storageCondition,
      "2027-01-01",
    ).length,
    1,
  );
  assert.equal(
    selectRules(
      [r],
      r.ingredientId,
      r.workState,
      r.storageCondition,
      "2027-02-01",
    ).length,
    0,
  );
});
test("월말 보정, 평년·윤년 2월, 연말 경계", () => {
  assert.equal(addDuration(new Date(2026, 0, 31, 10), 1, "개월").getDate(), 28);
  assert.equal(addDuration(new Date(2028, 0, 31), 1, "개월").getDate(), 29);
  assert.equal(addDuration(new Date(2028, 1, 29), 12, "개월").getDate(), 28);
  assert.equal(
    addDuration(new Date(2026, 11, 31), 1, "일").getFullYear(),
    2027,
  );
});
test("자정·시간·기산일 포함과 미포함", () => {
  assert.equal(
    addDuration(new Date(2026, 10, 10, 23), 2, "시간").getDate(),
    11,
  );
  assert.equal(addDuration(new Date(2026, 10, 10), 3, "일").getDate(), 13);
  assert.equal(
    addDuration(new Date(2026, 10, 10), 3, "일", true).getDate(),
    12,
  );
  assert.throws(() => addDuration(new Date("bad"), 2, "일"));
  assert.throws(() => addDuration(new Date(), 0, "일"));
});
test("요일 데모 코드와 색상 설정", () => {
  assert.deepEqual(weekdayCodes, [7, 1, 2, 3, 4, 5, 6]);
  assert.equal(weekdayColors.length, 7);
  assert.equal(weekdayColors[2], "#f1cd46");
});
test("잘못된 JSON 구조·중복·참조 오류 거부", () => {
  assert.throws(() => validateDB({}));
  const a = structuredClone(db);
  a.ingredients.push(a.ingredients[0]);
  assert.throws(() => validateDB(a));
  const b = structuredClone(db);
  b.rules[0].ingredientId = "missing";
  assert.throws(() => validateDB(b));
  const c = structuredClone(db);
  c.rules[0].durationValue = -1;
  assert.throws(() => validateDB(c));
});
