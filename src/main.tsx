import { useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { CalendarClock, Coffee, Package, Settings, Search } from "lucide-react";
import seed from "./seed.json";
import type { Database, Drink, Ingredient, Rule } from "./model";
import {
  applicable,
  localInput,
  normalize,
  validateDB,
  weekdayCodes,
  weekdayColors,
} from "./logic";
import {
  dayNames,
  defaultStore,
  expiry,
  hoursOn,
  nextOpening,
  prepFor,
  type Hours,
  type Store,
} from "./operations";
import { displayNote } from "./display-copy";
import { Admin } from "./admin";
import "./style.css";
import "./workspace.css";

const DB_KEY = "partner-note.v1";
function read<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}
function loadDatabase() {
  const value = read<unknown>(DB_KEY, seed);
  try {
    validateDB(value);
    return value;
  } catch {
    return seed as unknown as Database;
  }
}
type Page = "quality" | "prep" | "drinks" | "store" | "admin";
const pages = [
  ["quality", "내품기", CalendarClock],
  ["prep", "부재료 레시피", Package],
  ["drinks", "음료 레시피", Coffee],
  ["store", "매장 설정", Settings],
] as const;
const promotionIds = new Set([
  "i0",
  "i1",
  "i3",
  "i30",
  "i31",
  "i32",
  "i33",
  "i34",
]);
export function ingredientGroup(i: Ingredient) {
  return i.group ?? (promotionIds.has(i.id) ? "프로모션" : "코어");
}
function matches(q: string, values: string[]) {
  return normalize(values.join(" ")).includes(normalize(q));
}
function Filter({
  value,
  change,
  options,
}: {
  value: string;
  change: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <div className="pn-filters">
      {options.map((option) => (
        <button
          key={option}
          aria-pressed={value === option}
          onClick={() => change(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
function SearchBox({
  value,
  change,
  placeholder,
}: {
  value: string;
  change: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="pn-search">
      <Search size={18} />
      <input
        aria-label={placeholder}
        type="search"
        value={value}
        onChange={(e) => change(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
function App() {
  const [db, setDb] = useState(loadDatabase);
  const [store, setStore] = useState(() =>
    read("partner-note.store", defaultStore),
  );
  const [page, setPage] = useState<Page>("quality");
  const [notice, setNotice] = useState("");
  function navigate(next: Page) {
    setPage(next);
    setNotice("");
    window.scrollTo(0, 0);
  }
  return (
    <div className="pn-app">
      <div className="pn-top">
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("quality");
          }}
        >
          <span className="pn-brand-icon">
            <Coffee size={19} />
          </span>{" "}
          PARTNER NOTE
        </a>
        <button
          onClick={() => navigate(page === "admin" ? "quality" : "admin")}
        >
          {page === "admin" ? "업무 화면" : "데이터 관리"}
        </button>
      </div>
      <main className="pn-main">
        {notice && (
          <p role="status" className="pn-note">
            {notice}
          </p>
        )}
        {page === "quality" && (
          <Quality db={db} store={store} openStore={() => navigate("store")} />
        )}
        {page === "prep" && <Recipes db={db} store={store} kind="prep" />}
        {page === "drinks" && <Recipes db={db} store={store} kind="drinks" />}
        {page === "store" && (
          <StoreEditor
            store={store}
            save={(value) => {
              try {
                localStorage.setItem(
                  "partner-note.store",
                  JSON.stringify(value),
                );
                setStore(value);
                setNotice("매장 설정을 저장했습니다.");
              } catch {
                setNotice("저장 공간을 확인해 주세요.");
              }
            }}
          />
        )}
        {page === "admin" && (
          <Admin
            db={db}
            save={(next) => {
              validateDB(next);
              localStorage.setItem(DB_KEY, JSON.stringify(next));
              setDb(next);
            }}
          />
        )}
      </main>
      <nav className="pn-nav" aria-label="핵심 메뉴">
        {pages.map(([id, title, Icon]) => (
          <button
            key={id}
            aria-current={page === id ? "page" : undefined}
            onClick={() => navigate(id)}
          >
            <Icon size={19} />
            {title}
          </button>
        ))}
      </nav>
    </div>
  );
}
const modes = ["오늘 현재", "내일 오픈", "직접 지정"] as const;
function Quality({
  db,
  store,
  ingredient,
  manufactured,
  openStore,
}: {
  db: Database;
  store: Store;
  ingredient?: Ingredient;
  manufactured?: boolean;
  openStore?: () => void;
}) {
  const [now, setNow] = useState(() => new Date());
  const [mode, setMode] = useState<string>(modes[0]);
  const [direct, setDirect] = useState(localInput);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("전체");
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const start =
    mode === modes[1]
      ? nextOpening(store, now)
      : mode === modes[2]
        ? direct
          ? new Date(direct)
          : null
        : now;
  const date = start ? localInput(start).slice(0, 10) : "";
  const hours = start ? hoursOn(store, start) : null;
  const items = (ingredient ? [ingredient] : db.ingredients).filter(
    (i) =>
      !i.hidden &&
      matches(query, [i.name, ...i.aliases]) &&
      (group === "전체" || ingredientGroup(i) === group),
  );
  const groups = items
    .map((item) => ({
      item,
      rules: db.rules.filter(
        (r) =>
          r.ingredientId === item.id &&
          (!manufactured || r.workState === "제조 후") &&
          applicable(r, date || localInput(now).slice(0, 10)),
      ),
    }))
    .filter((x) => x.rules.length);
  return (
    <section className="pn-quality">
      <div className={ingredient ? "pn-calculator embedded" : "pn-calculator"}>
        {!ingredient && (
          <div className="pn-heading pn-hero-heading">
            <div>
              <h1>내품기</h1>
              <p>작업 시점에 맞춰 마감일을 확인하세요.</p>
              {store.name && <span>{store.name}</span>}
            </div>
            <div className="pn-hero-calendar" aria-hidden="true">
              <CalendarClock size={35} strokeWidth={1.7} />
            </div>
          </div>
        )}
        <Filter value={mode} change={setMode} options={modes} />
        {mode === modes[2] && (
          <label className="pn-field">
            작업 날짜 및 시간
            <input
              type="datetime-local"
              required
              value={direct}
              onInput={(e) => setDirect(e.currentTarget.value)}
              onChange={(e) => setDirect(e.target.value)}
            />
          </label>
        )}
        <div className="pn-basis">
          {start ? (
            <>
              <b>
                {localInput(start).replace("T", " ")} (
                {dayNames[start.getDay()]})
              </b>
              {hours?.open && !hours.closed && (
                <span>
                  영업 {hours.open}–{hours.close || "미설정"}
                </span>
              )}
            </>
          ) : (
            <span>
              {mode === modes[1]
                ? "다음 영업일의 오픈 시간을 설정해 주세요."
                : "작업 날짜와 시간을 입력해 주세요."}
            </span>
          )}
          {openStore && mode === modes[1] && !start && (
            <button onClick={openStore}>매장 설정</button>
          )}
        </div>
      </div>
      {!ingredient && (
        <>
          <SearchBox
            value={query}
            change={setQuery}
            placeholder="품목명 또는 약어 검색"
          />
          <Filter
            value={group}
            change={setGroup}
            options={["전체", "코어", "프로모션"]}
          />
        </>
      )}
      {groups.length ? (
        <div className="pn-results">
          {groups.map(({ item, rules }) => (
            <article key={item.id} className="pn-result">
              <div className="pn-item-heading">
                <h2>
                  {item.name}
                  {item.aliases[0] && <small>{item.aliases[0]}</small>}
                </h2>
                <span>{ingredientGroup(item)}</span>
              </div>
              {rules.map((rule) => {
                const conflict = rules.some(
                  (other) =>
                    other.id !== rule.id &&
                    other.workState === rule.workState &&
                    other.storageCondition === rule.storageCondition,
                );
                const note = displayNote(rule.notes);
                return (
                  <div key={rule.id} className="pn-rule">
                    <div className="pn-rule-main">
                      <div className="pn-rule-info">
                        <b>{rule.workState}</b>
                        <span>
                          {rule.durationValue}
                          {rule.durationUnit} · {rule.storageCondition}
                        </span>
                      </div>
                      <div className="pn-rule-end">
                        <small>마감</small>
                        {conflict ? (
                          <strong className="pn-error">기준 충돌</strong>
                        ) : start ? (
                          <Deadline
                            start={start}
                            rule={rule}
                            floorHour={mode === modes[0]}
                          />
                        ) : (
                          "—"
                        )}
                      </div>
                    </div>
                    {note && (
                      <details className="pn-rule-detail">
                        <summary>특이사항</summary>
                        <p>{note}</p>
                      </details>
                    )}
                  </div>
                );
              })}
            </article>
          ))}
        </div>
      ) : (
        <p className="pn-empty">
          {ingredient
            ? "등록된 제조 후 내품기가 없습니다."
            : "일치하는 품목이 없습니다."}
        </p>
      )}
    </section>
  );
}
function Deadline({
  start,
  rule,
  floorHour,
}: {
  start: Date;
  rule: Rule;
  floorHour: boolean;
}) {
  try {
    const { basis, end } = expiry(start, rule, floorHour);
    const exact = localInput(end);
    const hour = rule.durationUnit === "시간";
    const period = rule.durationUnit === "개월";
    const label = exact.slice(5, 10).replace("-", ".");
    const nextYear = end.getFullYear() !== basis.getFullYear();
    return (
      <div
        className="pn-deadline"
        title={`계산 기준 ${localInput(basis).replace("T", " ")} · 마감 ${exact.replace("T", " ")}`}
      >
        {!period && ["number", "both"].includes(rule.tagType) && (
          <span
            className="pn-weekday"
            aria-label={dayNames[end.getDay()] + "요일"}
            style={{
              background: weekdayColors[end.getDay()],
              color: [2, 4].includes(end.getDay()) ? "#142b23" : "white",
            }}
          >
            {weekdayCodes[end.getDay()]}
          </span>
        )}
        <strong>
          {nextYear ? exact.slice(0, 10).replaceAll("-", ".") : label}
          {hour && " " + exact.slice(11)}
        </strong>
        {period && (
          <small>
            {localInput(basis).slice(5, 10).replace("-", ".")}부터 ·{" "}
            {rule.tagType === "handwritten" ? "수기" : "날짜택"}
          </small>
        )}
      </div>
    );
  } catch {
    return <span>기준 확인</span>;
  }
}

function Recipes({
  db,
  store,
  kind,
}: {
  db: Database;
  store: Store;
  kind: "prep" | "drinks";
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("전체");
  const drinks = db.drinks.filter((d) => !d.hidden);
  const categories =
    kind === "prep"
      ? ["전체", "코어", "프로모션"]
      : [
          "전체",
          ...new Set(
            drinks.map((d) => (d.promotion ? "프로모션" : d.category)),
          ),
        ];
  const items =
    kind === "prep"
      ? db.ingredients.filter(
          (i) =>
            !i.hidden &&
            i.type === "제조 부재료" &&
            (category === "전체" || ingredientGroup(i) === category) &&
            matches(query, [i.name, ...i.aliases]),
        )
      : drinks.filter(
          (d) =>
            (category === "전체" ||
              (d.promotion ? "프로모션" : d.category) === category) &&
            matches(query, [d.name, d.markingCode, d.englishName]),
        );
  return (
    <section>
      <div className="pn-heading">
        <h1>{kind === "prep" ? "부재료 레시피" : "음료 레시피"}</h1>
      </div>
      <SearchBox
        value={query}
        change={setQuery}
        placeholder={
          kind === "prep"
            ? "부재료명 또는 약어 검색"
            : "음료명 또는 마킹명 검색"
        }
      />
      <Filter options={categories} value={category} change={setCategory} />
      <div className="pn-recipes">
        {items.map((item) => (
          <details className="pn-accordion" key={item.id}>
            <summary>
              {item.name}
              <small>
                {"markingCode" in item
                  ? item.markingCode
                  : item.aliases.join(" · ")}
              </small>
            </summary>
            {"markingCode" in item ? (
              <DrinkRecipe db={db} store={store} drink={item} />
            ) : (
              <Prep db={db} store={store} item={item} />
            )}
          </details>
        ))}
        {!items.length && <p className="pn-empty">검색 결과가 없습니다.</p>}
      </div>
    </section>
  );
}
function Flow({ children }: { children: ReactNode[] }) {
  return (
    <ol className="pn-flow">
      {children.map((child, index) => (
        <li key={index} className="pn-flow-part">
          <span aria-hidden="true" className="pn-step-number">
            {index + 1}
          </span>
          <div className="pn-step">{child}</div>
        </li>
      ))}
    </ol>
  );
}
function Prep({
  db,
  store,
  item,
}: {
  db: Database;
  store: Store;
  item: Ingredient;
}) {
  const recipe = prepFor(db, item.id);
  return (
    <div className="pn-recipe-body">
      {recipe ? (
        <>
          <p className="pn-materials">{recipe.ingredients.join(" + ")}</p>
          <Flow>{recipe.steps}</Flow>
          {displayNote(recipe.notes) && (
            <p className="pn-caption">{displayNote(recipe.notes)}</p>
          )}
        </>
      ) : (
        <p className="pn-caption">제조법 자료 확인 중</p>
      )}
      <details className="pn-related">
        <summary>제조 후 내품기 확인</summary>
        <Quality db={db} store={store} ingredient={item} manufactured />
      </details>
    </div>
  );
}
function DrinkRecipe({
  db,
  store,
  drink,
}: {
  db: Database;
  store: Store;
  drink: Drink;
}) {
  const [ice, setIce] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<string>();
  const recipes = db.recipes
    .filter(
      (r) =>
        r.drinkId === drink.id &&
        drink.availableTemperatures.includes(r.temperature),
    )
    .sort(
      (a, b) =>
        Number(b.temperature === "HOT") - Number(a.temperature === "HOT"),
    );
  const variants = recipes.map((recipe) =>
    recipe.size === "default"
      ? recipe.temperature
      : `${recipe.temperature} · ${recipe.size}`,
  );
  const currentVariant = selectedVariant ?? variants[0];
  const linked = db.ingredients.filter(
    (i) =>
      !i.hidden &&
      i.type === "제조 부재료" &&
      prepFor(db, i.id) &&
      drink.relatedIngredientIds.includes(i.id),
  );
  return (
    <div className="pn-recipe-body">
      {variants.length > 1 && (
        <div className="pn-recipe-switch">
          <Filter
            value={currentVariant}
            change={setSelectedVariant}
            options={[...variants, "모두 보기"]}
          />
        </div>
      )}
      <div className="pn-recipe-columns">
        {recipes.map((recipe, index) => (
          <section
            key={recipe.temperature + recipe.size}
            className="pn-temperature"
            data-inactive={
              currentVariant !== "모두 보기" &&
              currentVariant !== variants[index]
            }
          >
            <b className={recipe.temperature === "HOT" ? "pn-hot" : "pn-iced"}>
              {recipe.temperature}
            </b>
            <span className="pn-caption">
              {recipe.size === "default"
                ? (
                    drink.availableSizesByTemperature[recipe.temperature] ?? []
                  ).join(" / ")
                : recipe.size}
            </span>
            <Flow>
              {recipe.orderedSteps.map((step, index) => (
                <div key={index}>
                  {step.description || step.action}
                  {!!Object.keys(step.quantityBySize).length && (
                    <div className="pn-size-values">
                      {Object.entries(step.quantityBySize).map(
                        ([size, qty]) => (
                          <span key={size}>
                            <b>{size}</b> {qty}
                            {step.unit}
                          </span>
                        ),
                      )}
                    </div>
                  )}
                  {displayNote(step.note) && (
                    <small>{displayNote(step.note)}</small>
                  )}
                </div>
              ))}
            </Flow>
            {(recipe.equipment || recipe.servingInstructions) && (
              <p className="pn-caption">
                {[recipe.equipment, recipe.servingInstructions]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </section>
        ))}
      </div>
      {!recipes.length && <p className="pn-caption">제조법 자료 확인 중</p>}
      {drink.id === "d6" && (
        <label className="pn-choice">
          <input
            type="checkbox"
            checked={ice}
            onChange={(e) => setIce(e.target.checked)}
          />
          얼음 함께 제공 {ice && <strong> → Tall 컵 사용</strong>}
        </label>
      )}
      {displayNote(drink.specialInstructions) && (
        <p className="pn-caption">{displayNote(drink.specialInstructions)}</p>
      )}
      {linked.map((i) => (
        <details key={i.id} className="pn-related">
          <summary>{i.name} 제조법</summary>
          <Prep db={db} store={store} item={i} />
        </details>
      ))}
    </div>
  );
}

function StoreEditor({
  store,
  save,
}: {
  store: Store;
  save: (store: Store) => void;
}) {
  const [draft, setDraft] = useState(() => structuredClone(store));
  const [date, setDate] = useState("");
  const [error, setError] = useState("");
  return (
    <section>
      <div className="pn-heading">
        <h1>매장 설정</h1>
      </div>
      <form
        className="pn-form"
        onSubmit={(e) => {
          e.preventDefault();
          const incomplete = [
            ...draft.week,
            ...Object.values(draft.exceptions),
          ].some((h) => !h.closed && Boolean(h.open) !== Boolean(h.close));
          if (incomplete) {
            setError("오픈·마감 시간을 함께 입력해 주세요.");
            return;
          }
          setError("");
          save(draft);
        }}
      >
        <label className="pn-field">
          매장명
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <h2>요일별 영업시간</h2>
        {[1, 2, 3, 4, 5, 6, 0].map((day) => (
          <HoursRow
            key={day}
            label={dayNames[day] + "요일"}
            value={draft.week[day]}
            change={(hours) =>
              setDraft({
                ...draft,
                week: draft.week.map((h, i) => (i === day ? hours : h)),
              })
            }
          />
        ))}
        <h2>공휴일·임시 영업시간</h2>
        <div className="pn-inline">
          <label className="pn-field">
            예외 날짜
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={!date || !!draft.exceptions[date]}
            onClick={() => {
              setDraft({
                ...draft,
                exceptions: {
                  ...draft.exceptions,
                  [date]: { open: "", close: "", closed: true },
                },
              });
              setDate("");
            }}
          >
            날짜 추가
          </button>
        </div>
        {Object.entries(draft.exceptions)
          .sort()
          .map(([day, hours]) => (
            <div key={day}>
              <HoursRow
                label={day}
                value={hours}
                change={(h) =>
                  setDraft({
                    ...draft,
                    exceptions: { ...draft.exceptions, [day]: h },
                  })
                }
              />
              <button
                type="button"
                onClick={() => {
                  const exceptions = { ...draft.exceptions };
                  delete exceptions[day];
                  setDraft({ ...draft, exceptions });
                }}
              >
                예외 삭제
              </button>
            </div>
          ))}
        {error && <p role="alert">{error}</p>}
        <button className="pn-primary" type="submit">
          매장 설정 저장
        </button>
      </form>
    </section>
  );
}
function HoursRow({
  label,
  value,
  change,
}: {
  label: string;
  value: Hours;
  change: (h: Hours) => void;
}) {
  return (
    <div className="pn-hours">
      <b>{label}</b>
      <label>
        오픈
        <input
          aria-label={label + " 오픈"}
          type="time"
          disabled={value.closed}
          value={value.open}
          onChange={(e) => change({ ...value, open: e.target.value })}
        />
      </label>
      <label>
        마감
        <input
          aria-label={label + " 마감"}
          type="time"
          disabled={value.closed}
          value={value.close}
          onChange={(e) => change({ ...value, close: e.target.value })}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={value.closed}
          onChange={(e) => change({ ...value, closed: e.target.checked })}
        />{" "}
        휴무
      </label>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
