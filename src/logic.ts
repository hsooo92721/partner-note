import type { Database, Rule } from "./model";
export const weekdayCodes = [7, 1, 2, 3, 4, 5, 6];
export const weekdayColors = [
  "#d34c43",
  "#ed8c34",
  "#f1cd46",
  "#298c59",
  "#8dcde4",
  "#2e447b",
  "#8660a4",
];
export function addDuration(
  start: Date,
  value: number,
  unit: string,
  inclusive = false,
) {
  if (!Number.isFinite(value) || value <= 0 || Number.isNaN(start.getTime()))
    throw Error("유효한 작업 시점과 기한을 입력해 주세요.");
  const end = new Date(start);
  if (unit === "시간") end.setTime(end.getTime() + value * 3600000);
  else if (unit === "일")
    end.setDate(end.getDate() + value - (inclusive ? 1 : 0));
  else if (unit === "개월") {
    const day = end.getDate();
    end.setDate(1);
    end.setMonth(end.getMonth() + value);
    const last = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
    end.setDate(Math.min(day, last));
  } else throw Error("지원하지 않는 기한 단위");
  return end;
}
export function applicable(r: Rule, date: string) {
  return (
    r.verificationStatus !== "이전 기준 예시" &&
    (!r.effectiveFrom || r.effectiveFrom <= date) &&
    (!r.effectiveUntil || date < r.effectiveUntil)
  );
}
export function selectRules(
  rules: Rule[],
  id: string,
  state: string,
  storage: string,
  date: string,
) {
  return rules.filter(
    (r) =>
      r.ingredientId === id &&
      r.workState === state &&
      r.storageCondition === storage &&
      applicable(r, date),
  );
}
export function normalize(s: string) {
  return s.toLowerCase().replace(/\s/g, "");
}
export function validateDB(v: unknown): asserts v is Database {
  const d = v as Database;
  if (
    !d ||
    d.version !== 1 ||
    !["drinks", "recipes", "ingredients", "rules"].every((k) =>
      Array.isArray((d as any)[k]),
    )
  )
    throw Error(
      "버전 1 데이터의 drinks, recipes, ingredients, rules 배열이 필요합니다.",
    );

  const strings = (v: any, keys: string[]) =>
    keys.every((k) => typeof v[k] === "string");
  for (const i of d.ingredients)
    if (
      !i ||
      !strings(i, ["id", "name", "type", "source", "verificationStatus"]) ||
      !Array.isArray(i.aliases) ||
      i.aliases.some((a) => typeof a !== "string") ||
      !Array.isArray(i.relatedIngredientIds) ||
      (i.noRuleStates && !Array.isArray(i.noRuleStates)) ||
      (i.prepRecipe &&
        (!Array.isArray(i.prepRecipe.ingredients) ||
          !Array.isArray(i.prepRecipe.steps) ||
          [...i.prepRecipe.ingredients, ...i.prepRecipe.steps].some(
            (value) => typeof value !== "string",
          ) ||
          typeof i.prepRecipe.notes !== "string"))
    )
      throw Error("부재료 필수 필드 오류");
  for (const item of d.drinks)
    if (
      !item ||
      !strings(item, [
        "id",
        "name",
        "englishName",
        "markingCode",
        "category",
        "specialInstructions",
        "verificationStatus",
        "source",
      ]) ||
      !Array.isArray(item.allergens) ||
      !item.nutritionBySize ||
      typeof item.nutritionBySize !== "object" ||
      (item.promotion &&
        (!strings(item.promotion, ["status", "notes"]) ||
          !Array.isArray(item.promotion.releases)))
    )
      throw Error("음료 필수 필드 오류");
  for (const r of d.rules)
    if (
      !r ||
      !strings(r, [
        "id",
        "ingredientId",
        "workState",
        "storageCondition",
        "verificationStatus",
        "source",
        "updatedAt",
        "notes",
        "tagType",
        "dateFormat",
        "tagNotes",
      ]) ||
      typeof r.durationValue !== "number" ||
      !Number.isFinite(r.durationValue) ||
      (r.numberCode !== null && typeof r.numberCode !== "number") ||
      [r.effectiveFrom, r.effectiveUntil].some(
        (date) =>
          date !== null &&
          (typeof date !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
            Number.isNaN(Date.parse(date))),
      ) ||
      (r.effectiveFrom &&
        r.effectiveUntil &&
        r.effectiveFrom >= r.effectiveUntil)
    )
      throw Error("규칙 필수 필드 또는 적용 기간 오류");
  const recipeKeys = new Set<string>();
  for (const r of d.recipes) {
    const key = r.drinkId + "/" + r.temperature + "/" + r.size;
    if (recipeKeys.has(key))
      throw Error("같은 온도·사이즈 레시피가 중복되었습니다.");
    recipeKeys.add(key);
    if (
      !strings(r, [
        "drinkId",
        "temperature",
        "size",
        "equipment",
        "servingInstructions",
      ]) ||
      !Array.isArray(r.orderedSteps) ||
      r.orderedSteps.some(
        (s) =>
          !strings(s, ["description", "action", "unit", "note", "equipment"]) ||
          !s.quantityBySize ||
          Object.values(s.quantityBySize).some(
            (n) => typeof n !== "number" || !Number.isFinite(n) || n < 0,
          ),
      )
    )
      throw Error("제조 단계 또는 수량 오류");
  }
  const ids = new Set<string>();
  for (const item of [...d.drinks, ...d.ingredients, ...d.rules]) {
    if (!item || typeof item.id !== "string" || ids.has(item.id))
      throw Error("ID가 없거나 중복되었습니다.");
    ids.add(item.id);
  }
  const ingredients = new Set(d.ingredients.map((i) => i.id)),
    drinks = new Set(d.drinks.map((i) => i.id));
  for (const i of d.ingredients)
    if (
      typeof i.name !== "string" ||
      !Array.isArray(i.aliases) ||
      !Array.isArray(i.relatedIngredientIds) ||
      i.relatedIngredientIds.some((id) => !ingredients.has(id))
    )
      throw Error("부재료 구조 또는 연결 ID 오류");
  for (const d1 of d.drinks)
    if (
      typeof d1.name !== "string" ||
      !Array.isArray(d1.availableTemperatures) ||
      !d1.availableSizesByTemperature ||
      !Array.isArray(d1.relatedIngredientIds) ||
      d1.relatedIngredientIds.some((id) => !ingredients.has(id)) ||
      d1.availableTemperatures.some(
        (t) =>
          !["HOT", "ICED"].includes(t) ||
          !Array.isArray(d1.availableSizesByTemperature[t]) ||
          !d1.availableSizesByTemperature[t].length,
      )
    )
      throw Error("음료 구조 또는 제공 조건 오류");
  for (const r of d.rules)
    if (
      !ingredients.has(r.ingredientId) ||
      !(r.durationValue > 0) ||
      !["시간", "일", "개월"].includes(r.durationUnit) ||
      !["number", "date", "both", "handwritten"].includes(r.tagType) ||
      typeof r.workState !== "string" ||
      typeof r.storageCondition !== "string" ||
      !Array.isArray(r.dateFields) ||
      !r.source
    )
      throw Error("관리 규칙 구조, 기한 또는 출처 오류");
  for (const r of d.recipes)
    if (
      !drinks.has(r.drinkId) ||
      !Array.isArray(r.orderedSteps) ||
      r.orderedSteps.some(
        (s) =>
          typeof s.description !== "string" ||
          !s.quantityBySize ||
          (s.ingredientId && !ingredients.has(s.ingredientId)),
      )
    )
      throw Error("레시피 구조 또는 연결 ID 오류");
}
export function search(db: Database, q: string) {
  const query = normalize(q);
  return {
    drinks: db.drinks.filter((d) =>
      normalize(
        [
          d.name,
          d.englishName,
          d.markingCode,
          d.category,
          ...d.relatedIngredientIds.map(
            (id) => db.ingredients.find((i) => i.id === id)?.name || "",
          ),
        ].join(" "),
      ).includes(query),
    ),
    ingredients: db.ingredients.filter((i) =>
      normalize([i.name, ...i.aliases].join(" ")).includes(query),
    ),
  };
}
export function localInput(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Label presentation is independent of expiration arithmetic.
export function labelPrecision(rule: Rule | undefined): "date" | "datetime" {
  return rule?.dateFormat.includes("H") ? "datetime" : "date";
}
export function formatLabelDate(date: Date, precision: "date" | "datetime") {
  const local = localInput(date);
  const day = local.slice(0, 10).replaceAll("-", ".");
  return precision === "datetime" ? day + " " + local.slice(11, 16) : day;
}
