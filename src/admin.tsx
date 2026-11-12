import { displayNote } from "./display-copy";
import { useState, type ReactNode } from "react";
import type { Database, Drink, Ingredient, Recipe, Rule, Step } from "./model";
import { normalize, validateDB } from "./logic";
import { prepFor } from "./operations";

type Kind = "quality" | "prep" | "drink";
type Draft =
  | { kind: "quality"; item: Ingredient; rules: Rule[] }
  | { kind: "prep"; item: Ingredient }
  | { kind: "drink"; item: Drink; recipes: Recipe[] };
type Pending = { db: Database; label: string };
const states = ["개봉 후", "소분 후", "전량소분 후", "정량소분 후", "제조 후"];
const sizes = ["S", "T", "G", "V", "TRENTA", "7oz"];
const categories = [
  "에스프레소",
  "티 & 리프레셔",
  "프라푸치노",
  "콜드브루",
  "프로모션",
  "기타",
];
const source = "로컬 관리자 입력";
const newItem = (type: string): Ingredient => ({
  id: crypto.randomUUID(),
  name: "",
  type,
  aliases: [],
  relatedIngredientIds: [],
  group: "코어",
  source,
  verificationStatus: "공식 확인 필요",
});
function newRule(id: string): Rule {
  return {
    id: crypto.randomUUID(),
    ingredientId: id,
    workState: "개봉 후",
    storageCondition: "실온",
    durationValue: 1,
    durationUnit: "일",
    effectiveFrom: null,
    effectiveUntil: null,
    verificationStatus: "공식 확인 필요",
    source,
    updatedAt: new Date().toISOString(),
    notes: "",
    tagType: "both",
    dateFields: ["작업일", "사용기한"],
    dateFormat: "YYYY-MM-DD",
    numberCode: null,
    tagNotes: "",
    includeWorkDay: true,
    exactMinutes: false,
  };
}
const blankStep: Step = {
  order: 1,
  description: "",
  action: "",
  ingredientId: null,
  equipment: "",
  quantityBySize: {},
  unit: "",
  note: "",
};
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="pn-field">
      {label}
      {children}
    </label>
  );
}
function Input({
  label,
  value,
  change,
  required = false,
  type = "text",
}: {
  label: string;
  value: string;
  change: (v: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <Field label={label}>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => change(e.target.value)}
      />
    </Field>
  );
}
function Select({
  label,
  value,
  options,
  change,
}: {
  label: string;
  value: string;
  options: string[];
  change: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => change(e.target.value)}>
        {[...new Set([value, ...options])].map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </Field>
  );
}
function move<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
function Replace<T extends { id: string }>(items: T[], item: T) {
  return items.some((i) => i.id === item.id)
    ? items.map((i) => (i.id === item.id ? item : i))
    : [...items, item];
}

export function Admin({
  db,
  save,
}: {
  db: Database;
  save: (db: Database) => void;
}) {
  const [kind, setKind] = useState<Kind>("quality");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [undo, setUndo] = useState<Database | null>(null);
  const kinds = {
    quality: "내품기",
    prep: "부재료 레시피",
    drink: "음료 레시피",
  };
  function edit(item?: Ingredient | Drink) {
    setError("");
    setMessage("");
    setPending(null);
    if (kind === "drink") {
      const drink = (item as Drink | undefined) ?? {
        id: crypto.randomUUID(),
        name: "",
        englishName: "",
        markingCode: "",
        category: "에스프레소",
        promotion: null,
        availableTemperatures: [],
        availableSizesByTemperature: {},
        nutritionBySize: {},
        allergens: [],
        specialInstructions: "",
        relatedIngredientIds: [],
        verificationStatus: "공식 확인 필요",
        source,
      };
      setDraft({
        kind,
        item: drink,
        recipes: db.recipes.filter((r) => r.drinkId === drink.id),
      });
    } else {
      const ingredient =
        (item as Ingredient | undefined) ??
        newItem(kind === "prep" ? "제조 부재료" : "원부재료");
      if (kind === "prep")
        setDraft({
          kind,
          item: {
            ...ingredient,
            prepRecipe: prepFor(db, ingredient.id) ?? {
              ingredients: [],
              steps: [],
              notes: "",
            },
          },
        });
      else {
        const rules = db.rules.filter((r) => r.ingredientId === ingredient.id);
        setDraft({
          kind,
          item: ingredient,
          rules: rules.length ? rules : [newRule(ingredient.id)],
        });
      }
    }
  }
  function review(next: Database, label: string) {
    validateDB(next);
    setPending({ db: next, label });
    setError("");
  }
  function preview() {
    if (!draft) return;
    const item = { ...draft.item, name: draft.item.name.trim() };
    if (!item.name) throw Error("품목명을 입력해 주세요.");
    if (draft.kind === "drink") {
      const drink = item as Drink;
      if (
        !draft.recipes.length ||
        draft.recipes.some(
          (r) =>
            !r.orderedSteps.length ||
            r.orderedSteps.some((s) => !s.description.trim()),
        )
      )
        throw Error("각 제조법에 제조 단계를 입력해 주세요.");
      const availableSizesByTemperature: Record<string, string[]> = {};
      for (const recipe of draft.recipes) {
        const set = availableSizesByTemperature[recipe.temperature] ?? [];
        const used =
          recipe.size === "default"
            ? Object.keys(
                recipe.orderedSteps.reduce(
                  (result, step) => ({ ...result, ...step.quantityBySize }),
                  {},
                ),
              )
            : [recipe.size];
        const existing =
          drink.availableSizesByTemperature[recipe.temperature] ?? [];
        availableSizesByTemperature[recipe.temperature] = [
          ...new Set([...existing, ...set, ...used]),
        ];
      }
      if (Object.values(availableSizesByTemperature).some((s) => !s.length))
        throw Error("제공 사이즈를 하나 이상 입력해 주세요.");
      review(
        {
          ...db,
          drinks: Replace(db.drinks, {
            ...drink,
            availableSizesByTemperature,
            availableTemperatures: Object.keys(availableSizesByTemperature),
          }),
          recipes: [
            ...db.recipes.filter((r) => r.drinkId !== drink.id),
            ...draft.recipes.map((r) => ({
              ...r,
              orderedSteps: r.orderedSteps.map((s, i) => ({
                ...s,
                order: i + 1,
              })),
            })),
          ],
        },
        drink.name,
      );
    } else {
      const ingredient = item as Ingredient;
      if (
        draft.kind === "prep" &&
        (!ingredient.prepRecipe?.ingredients.length ||
          !ingredient.prepRecipe.steps.length)
      )
        throw Error("재료·수량과 제조 순서를 각각 입력해 주세요.");
      if (draft.kind === "quality" && !draft.rules.length)
        throw Error("내품기 규칙을 하나 이상 입력해 주세요.");
      review(
        {
          ...db,
          ingredients: Replace(db.ingredients, ingredient),
          rules:
            draft.kind === "quality"
              ? [
                  ...db.rules.filter((r) => r.ingredientId !== ingredient.id),
                  ...draft.rules,
                ]
              : db.rules,
        },
        ingredient.name,
      );
    }
  }
  function commit() {
    if (!pending) return;
    try {
      save(pending.db);
      setUndo(db);
      setPending(null);
      setDraft(null);
      setMessage("이 브라우저에 저장했습니다.");
      setError("");
    } catch (e) {
      setError(String(e));
    }
  }
  const items = (
    kind === "drink"
      ? db.drinks
      : db.ingredients.filter(
          (i) => kind === "quality" || i.type === "제조 부재료",
        )
  ).filter((i) => normalize(i.name).includes(normalize(query)));
  return (
    <section>
      <div className="pn-heading">
        <h1>데이터 관리</h1>
      </div>
      <p className="pn-caption">변경 내용은 이 브라우저에 저장됩니다.</p>
      <div className="pn-filters">
        {Object.entries(kinds).map(([id, label]) => (
          <button
            key={id}
            aria-pressed={id === kind}
            onClick={() => {
              setKind(id as Kind);
              setDraft(null);
              setPending(null);
              setQuery("");
              setError("");
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {message && <p role="status">{message}</p>}
      {error && (
        <p className="pn-error" role="alert">
          {error}
        </p>
      )}
      {pending ? (
        <div className="pn-form">
          <h2>저장 전 확인</h2>
          <strong>{pending.label}</strong>
          {draft?.kind === "quality" &&
            draft.rules.map((r) => (
              <div key={r.id}>
                {r.workState} · {r.storageCondition} · {r.durationValue}
                {r.durationUnit} · {r.effectiveFrom || "시행일 미입력"}
              </div>
            ))}
          {draft?.kind === "prep" && (
            <>
              <p>{draft.item.prepRecipe?.ingredients.join(" + ")}</p>
              <p>{draft.item.prepRecipe?.steps.join(" → ")}</p>
            </>
          )}
          {draft?.kind === "drink" &&
            draft.recipes.map((r) => (
              <p key={r.temperature + r.size}>
                {r.temperature} · {r.size} ·{" "}
                {r.orderedSteps.map((s) => s.description).join(" → ")}
              </p>
            ))}
          {draft?.item.hidden && <p>업무 화면에서 숨김</p>}
          <div className="pn-inline">
            <button onClick={() => setPending(null)}>돌아가기</button>
            <button className="pn-primary" onClick={commit}>
              저장 확정
            </button>
          </div>
        </div>
      ) : draft ? (
        <form
          className="pn-form"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              preview();
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          }}
        >
          <Input
            label="품목명"
            value={draft.item.name}
            required
            change={(name) =>
              setDraft({ ...draft, item: { ...draft.item, name } } as Draft)
            }
          />
          <label>
            <input
              type="checkbox"
              checked={!!draft.item.hidden}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  item: { ...draft.item, hidden: e.target.checked },
                } as Draft)
              }
            />{" "}
            업무 화면에서 숨김
          </label>
          {draft.kind === "drink" ? (
            <DrinkFields
              draft={draft}
              change={setDraft}
              ingredients={db.ingredients.filter(
                (i) => i.type === "제조 부재료",
              )}
            />
          ) : (
            <>
              <Input
                label="약어·별칭 (쉼표 구분)"
                value={draft.item.aliases.join(",")}
                change={(v) =>
                  setDraft({
                    ...draft,
                    item: { ...draft.item, aliases: v.split(",") },
                  })
                }
              />
              <Select
                label="분류"
                options={["코어", "프로모션"]}
                value={draft.item.group ?? "코어"}
                change={(v) =>
                  setDraft({
                    ...draft,
                    item: { ...draft.item, group: v as Ingredient["group"] },
                  })
                }
              />
              {draft.kind === "quality" && (
                <>
                  {draft.rules.map((rule, index) => (
                    <RuleFields
                      key={rule.id}
                      value={rule}
                      change={(value) =>
                        setDraft({
                          ...draft,
                          rules: draft.rules.map((r, i) =>
                            i === index ? value : r,
                          ),
                        })
                      }
                      remove={() =>
                        setDraft({
                          ...draft,
                          rules: draft.rules.filter((_, i) => i !== index),
                        })
                      }
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        rules: [...draft.rules, newRule(draft.item.id)],
                      })
                    }
                  >
                    규칙 추가
                  </button>
                </>
              )}
              {draft.kind === "prep" && draft.item.prepRecipe && (
                <PrepFields draft={draft} change={setDraft} />
              )}
            </>
          )}
          <div className="pn-inline">
            <button
              type="button"
              onClick={() => {
                setDraft(null);
                setError("");
              }}
            >
              취소
            </button>
            <button className="pn-primary" type="submit">
              저장 전 미리보기
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="pn-inline pn-admin-actions">
            <input
              type="search"
              aria-label="관리 품목 검색"
              placeholder="품목 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className="pn-primary" onClick={() => edit()}>
              추가
            </button>
          </div>
          <div className="pn-edit-list">
            {items.map((i) => (
              <button key={i.id} onClick={() => edit(i)}>
                {i.name}
                {i.hidden && " · 숨김"}
                <span>편집</span>
              </button>
            ))}
          </div>
          <details className="pn-related">
            <summary>백업 및 복원</summary>
            <div className="pn-inline">
              <button
                onClick={() => {
                  const url = URL.createObjectURL(
                    new Blob([JSON.stringify(db, null, 2)], {
                      type: "application/json",
                    }),
                  );
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "partner-note-backup.json";
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                }}
              >
                백업 저장
              </button>
              <label className="pn-field">
                백업 불러오기
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      review(JSON.parse(await file.text()), "백업 데이터 복원");
                    } catch (e) {
                      setError(String(e));
                    }
                  }}
                />
              </label>
              {undo && (
                <button onClick={() => review(undo, "직전 저장 되돌리기")}>
                  직전 저장 되돌리기
                </button>
              )}
            </div>
          </details>
        </>
      )}
    </section>
  );
}
function RuleFields({
  value: r,
  change,
  remove,
}: {
  value: Rule;
  change: (r: Rule) => void;
  remove: () => void;
}) {
  return (
    <fieldset className="pn-form-grid">
      <legend>내품기 규칙</legend>
      <Select
        label="작업 상태"
        value={r.workState}
        options={states}
        change={(workState) => change({ ...r, workState })}
      />
      <Select
        label="보관 조건"
        value={r.storageCondition}
        options={["실온", "냉장", "냉동", "기타"]}
        change={(storageCondition) => change({ ...r, storageCondition })}
      />
      <Field label="기간">
        <input
          type="number"
          min="1"
          step="1"
          required
          value={r.durationValue || ""}
          onChange={(e) =>
            change({ ...r, durationValue: Number(e.target.value) })
          }
        />
      </Field>
      <Select
        label="기간 단위"
        value={r.durationUnit}
        options={["시간", "일", "개월"]}
        change={(durationUnit) => change({ ...r, durationUnit })}
      />
      <Input
        label="시행일"
        type="date"
        value={r.effectiveFrom ?? ""}
        change={(v) => change({ ...r, effectiveFrom: v || null })}
      />
      <Input
        label="종료일 (미포함)"
        type="date"
        value={r.effectiveUntil ?? ""}
        change={(v) => change({ ...r, effectiveUntil: v || null })}
      />
      <Select
        label="표기 방식"
        value={r.tagType}
        options={["both", "number", "date", "handwritten"]}
        change={(tagType) => change({ ...r, tagType })}
      />
      <Input
        label="특이사항"
        value={displayNote(r.notes)}
        change={(notes) => change({ ...r, notes })}
      />
      <label>
        <input
          type="checkbox"
          checked={r.verificationStatus === "이전 기준 예시"}
          onChange={(e) =>
            change({
              ...r,
              verificationStatus: e.target.checked
                ? "이전 기준 예시"
                : "공식 확인 필요",
            })
          }
        />
        이전 기준으로 보관
      </label>
      {r.durationUnit === "시간" ? (
        <label>
          <input
            type="checkbox"
            checked={!!r.exactMinutes}
            onChange={(e) => change({ ...r, exactMinutes: e.target.checked })}
          />{" "}
          현재 시각의 분 유지
        </label>
      ) : (
        <label>
          <input
            type="checkbox"
            checked={r.includeWorkDay ?? true}
            onChange={(e) => change({ ...r, includeWorkDay: e.target.checked })}
          />{" "}
          작업일 포함
        </label>
      )}
      <button type="button" onClick={remove}>
        이 규칙 제외
      </button>
    </fieldset>
  );
}
function PrepFields({
  draft,
  change,
}: {
  draft: Extract<Draft, { kind: "prep" }>;
  change: (draft: Draft) => void;
}) {
  const recipe = draft.item.prepRecipe!;
  const save = (patch: Partial<typeof recipe>) =>
    change({
      ...draft,
      item: { ...draft.item, prepRecipe: { ...recipe, ...patch } },
    });
  return (
    <>
      <Field label="재료·수량 (한 줄에 하나)">
        <textarea
          required
          value={recipe.ingredients.join("\n")}
          onChange={(e) => save({ ingredients: e.target.value.split("\n") })}
        />
      </Field>
      <Field label="제조 순서 (한 줄에 한 단계)">
        <textarea
          required
          value={recipe.steps.join("\n")}
          onChange={(e) => save({ steps: e.target.value.split("\n") })}
        />
      </Field>
      <Input
        label="특이사항"
        value={displayNote(recipe.notes)}
        change={(notes) => save({ notes })}
      />
    </>
  );
}
function DrinkFields({
  draft,
  change,
  ingredients,
}: {
  draft: Extract<Draft, { kind: "drink" }>;
  change: (draft: Draft) => void;
  ingredients: Ingredient[];
}) {
  const drink = draft.item;
  const item = (patch: Partial<Drink>) =>
    change({ ...draft, item: { ...drink, ...patch } });
  const setRecipe = (i: number, r: Recipe) =>
    change({
      ...draft,
      recipes: draft.recipes.map((old, index) => (index === i ? r : old)),
    });
  return (
    <>
      <div className="pn-form-grid">
        <Input
          label="마킹명"
          value={drink.markingCode}
          change={(markingCode) => item({ markingCode })}
        />
        <Select
          label="카테고리"
          value={drink.category}
          options={categories}
          change={(category) =>
            item({
              category,
              promotion:
                category === "프로모션"
                  ? (drink.promotion ?? {
                      status: "시연",
                      notes: "",
                      releases: [],
                    })
                  : null,
            })
          }
        />
        <Input
          label="특이사항"
          value={displayNote(drink.specialInstructions)}
          change={(specialInstructions) => item({ specialInstructions })}
        />
      </div>
      <fieldset>
        <legend>연결할 제조 부재료</legend>
        {ingredients.map((i) => (
          <label className="pn-choice" key={i.id}>
            <input
              type="checkbox"
              checked={drink.relatedIngredientIds.includes(i.id)}
              onChange={(e) =>
                item({
                  relatedIngredientIds: e.target.checked
                    ? [...drink.relatedIngredientIds, i.id]
                    : drink.relatedIngredientIds.filter((id) => id !== i.id),
                })
              }
            />
            {i.name}
          </label>
        ))}
      </fieldset>
      {draft.recipes.map((r, i) => {
        const currentSizes =
          drink.availableSizesByTemperature[r.temperature] ?? [];
        const setSteps = (orderedSteps: Step[]) =>
          setRecipe(i, { ...r, orderedSteps });
        return (
          <fieldset key={i}>
            <legend>제조법 {i + 1}</legend>
            <div className="pn-form-grid">
              <Select
                label="온도"
                value={r.temperature}
                options={["HOT", "ICED"]}
                change={(temperature) => setRecipe(i, { ...r, temperature })}
              />
              <Select
                label="절차 적용 사이즈"
                value={r.size}
                options={["default", ...sizes]}
                change={(size) => setRecipe(i, { ...r, size })}
              />
              <Input
                label="제조 도구"
                value={r.equipment}
                change={(equipment) => setRecipe(i, { ...r, equipment })}
              />
              <Input
                label="제공 안내"
                value={r.servingInstructions}
                change={(servingInstructions) =>
                  setRecipe(i, { ...r, servingInstructions })
                }
              />
            </div>
            {r.size === "default" && (
              <div className="pn-inline">
                제공 사이즈{" "}
                {[...new Set([...sizes, ...currentSizes])].map((size) => (
                  <label key={size}>
                    <input
                      type="checkbox"
                      checked={currentSizes.includes(size)}
                      onChange={(e) =>
                        item({
                          availableSizesByTemperature: {
                            ...drink.availableSizesByTemperature,
                            [r.temperature]: e.target.checked
                              ? [...currentSizes, size]
                              : currentSizes.filter((s) => s !== size),
                          },
                        })
                      }
                    />
                    {size}
                  </label>
                ))}
              </div>
            )}
            {r.orderedSteps.map((s, j) => {
              const edit = (patch: Partial<Step>) =>
                setSteps(
                  r.orderedSteps.map((old, index) =>
                    index === j ? { ...old, ...patch } : old,
                  ),
                );
              return (
                <div className="pn-admin-step" key={j}>
                  <Input
                    label={`제조 단계 ${j + 1}`}
                    required
                    value={s.description}
                    change={(description) =>
                      edit({ description, action: description })
                    }
                  />
                  <Input
                    label="수량 단위"
                    value={s.unit}
                    change={(unit) => edit({ unit })}
                  />
                  <div className="pn-quantities">
                    {[
                      ...new Set([
                        ...currentSizes,
                        ...Object.keys(s.quantityBySize),
                        ...(r.size === "default" ? [] : [r.size]),
                      ]),
                    ].map((size) => (
                      <Field key={size} label={size}>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={s.quantityBySize[size] ?? ""}
                          onChange={(e) => {
                            const quantityBySize = { ...s.quantityBySize };
                            if (e.target.value === "")
                              delete quantityBySize[size];
                            else quantityBySize[size] = Number(e.target.value);
                            edit({ quantityBySize });
                          }}
                        />
                      </Field>
                    ))}
                  </div>
                  <div className="pn-inline">
                    <button
                      type="button"
                      disabled={j === 0}
                      onClick={() => setSteps(move(r.orderedSteps, j, j - 1))}
                    >
                      위로
                    </button>
                    <button
                      type="button"
                      disabled={j === r.orderedSteps.length - 1}
                      onClick={() => setSteps(move(r.orderedSteps, j, j + 1))}
                    >
                      아래로
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSteps(
                          r.orderedSteps.filter((_, index) => index !== j),
                        )
                      }
                    >
                      단계 제외
                    </button>
                  </div>
                </div>
              );
            })}
            <div className="pn-inline">
              <button
                type="button"
                onClick={() => setSteps([...r.orderedSteps, { ...blankStep }])}
              >
                단계 추가
              </button>
              <button
                type="button"
                onClick={() =>
                  change({
                    ...draft,
                    recipes: draft.recipes.filter((_, index) => index !== i),
                  })
                }
              >
                제조법 제외
              </button>
            </div>
          </fieldset>
        );
      })}
      <button
        type="button"
        onClick={() =>
          change({
            ...draft,
            recipes: [
              ...draft.recipes,
              {
                drinkId: drink.id,
                temperature: draft.recipes.some((r) => r.temperature === "HOT")
                  ? "ICED"
                  : "HOT",
                size: "default",
                equipment: "",
                servingInstructions: "",
                orderedSteps: [{ ...blankStep }],
              },
            ],
          })
        }
      >
        HOT·ICED 제조법 추가
      </button>
    </>
  );
}
