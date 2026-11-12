import { addDuration, localInput } from "./logic";
import type { Database, Rule } from "./model";

export interface Hours {
  open: string;
  close: string;
  closed: boolean;
}
export interface Store {
  name: string;
  week: Hours[];
  exceptions: Record<string, Hours>;
}
export const defaultStore: Store = {
  name: "",
  week: Array.from({ length: 7 }, () => ({
    open: "",
    close: "",
    closed: false,
  })),
  exceptions: {},
};
export const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
export function hoursOn(store: Store, date: Date) {
  return (
    store.exceptions[localInput(date).slice(0, 10)] ?? store.week[date.getDay()]
  );
}
export function nextOpening(store: Store, today: Date) {
  const date = new Date(today);
  date.setHours(0, 0, 0, 0);
  for (let offset = 1; offset <= 366; offset++) {
    date.setDate(date.getDate() + 1);
    const hours = hoursOn(store, date);
    if (hours.closed) continue;
    if (!hours.open) return null;
    return new Date(localInput(date).slice(0, 10) + "T" + hours.open);
  }
  return null;
}

export function expiry(start: Date, rule: Rule, floorHour: boolean) {
  const basis = new Date(start);
  if (rule.durationUnit === "시간" && floorHour && !rule.exactMinutes)
    basis.setMinutes(0, 0, 0);
  const end = addDuration(
    basis,
    rule.durationValue,
    rule.durationUnit,
    rule.includeWorkDay ?? true,
  );
  if (
    rule.durationUnit === "개월" &&
    (rule.includeWorkDay ?? true) &&
    end.getDate() === basis.getDate()
  )
    end.setDate(end.getDate() - 1);
  return { basis, end };
}
export interface PrepRecipe {
  ingredients: string[];
  steps: string[];
  notes: string;
}
export const examples: Record<string, PrepRecipe> = {
  i6: {
    ingredients: ["정수 1L", "FR 1봉"],
    steps: ["정수와 FR 혼합"],
    notes: "제공된 제조 예시 · 공식 기준 확인 필요",
  },
};
export function prepFor(db: Database, id: string) {
  const item = db.ingredients.find((i) => i.id === id);
  return item?.prepRecipe ?? examples[id];
}
