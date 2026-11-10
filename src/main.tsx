import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Search,
  BookOpen,
  Package,
  Tag,
  Settings,
  ArrowUpRight,
  ArrowLeft,
  ChevronRight,
  Plus,
  Clock,
  Check,
  Info,
  Download,
  Upload,
  RotateCcw,
  X,
  Menu,
  Coffee,
  Leaf,
  FlaskConical,
  SlidersHorizontal,
  CheckCircle2,
  Bookmark,
  CalendarDays,
} from "lucide-react";
import seed from "./seed.json";
import type { Database, Drink, Ingredient, Rule, Recipe } from "./model";
import {
  search,
  selectRules,
  addDuration,
  weekdayCodes,
  weekdayColors,
  localInput,
  validateDB,
  applicable,
  labelPrecision,
  formatLabelDate,
} from "./logic";
import "./style.css";
const KEY = "partner-note.v1";
const defaults = seed as unknown as Database;
let loadError = "";
function load() {
  try {
    const s = localStorage.getItem(KEY);
    if (s) {
      const d = JSON.parse(s);
      validateDB(d);
      return d;
    }
  } catch {
    loadError =
      "저장된 데이터가 유효하지 않아 시드 데이터를 표시합니다. 기존 저장값은 덮어쓰지 않습니다.";
  }
  return structuredClone(defaults);
}
const labels: Record<string, string> = {
  S: "Short",
  T: "Tall",
  G: "Grande",
  V: "Venti",
  TRENTA: "Trenta",
  "7oz": "7oz",
};
const states = ["개봉 후", "소분 후", "전량소분 후", "정량소분 후", "제조 후"];
function App() {
  const [db, setDB] = useState<Database>(load);
  const [page, setPage] = useState("home");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("전체");
  const [selected, setSelected] = useState<string | null>(null);
  const [returnDrink, setReturnDrink] = useState<string | null>(null);
  const [choices, setChoices] = useState<
    Record<string, { temp: string; size: string }>
  >({});
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("pn-recent") || "[]");
    } catch {
      return [];
    }
  });
  const [toast, setToast] = useState(loadError);
  const [editor, setEditor] = useState<{ kind: string; text: string } | null>(
    null,
  );
  const [mobile, setMobile] = useState(false);
  const [ice, setIce] = useState(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 6500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  function save(next: Database) {
    try {
      validateDB(next);
      localStorage.setItem(KEY, JSON.stringify(next));
      setDB(next);
      setToast("이 브라우저에 저장했습니다.");
    } catch (e) {
      setToast(String(e));
      throw e;
    }
  }
  function go(id: string) {
    setSelected(id);
    setPage(id.startsWith("d") ? "drink" : "ingredient");
    setExpanded(false);
    const next = [id, ...recent.filter((r) => r !== id)].slice(0, 5);
    setRecent(next);
    localStorage.setItem("pn-recent", JSON.stringify(next));
    window.scrollTo(0, 0);
  }
  function nav(p: string) {
    setPage(p);
    setSelected(null);
    setMobile(false);
    setQ("");
    setFilter("전체");
  }
  const drink = db.drinks.find((d) => d.id === selected);
  const ingredient = db.ingredients.find((i) => i.id === selected);
  const results = search(db, q);
  const choice = drink
    ? choices[drink.id] || {
        temp: drink.availableTemperatures[0],
        size: drink.availableSizesByTemperature[
          drink.availableTemperatures[0]
        ]?.[0],
      }
    : null;
  const recipe =
    drink && choice
      ? db.recipes.find(
          (r) =>
            r.drinkId === drink.id &&
            r.temperature === choice.temp &&
            r.size === choice.size,
        ) ||
        db.recipes.find(
          (r) =>
            r.drinkId === drink.id &&
            r.temperature === choice.temp &&
            r.size === "default",
        )
      : undefined;
  function edit(kind: string, value: unknown) {
    setEditor({ kind, text: JSON.stringify(value, null, 2) });
  }
  function applyEdit() {
    if (!editor) return;
    try {
      const value = JSON.parse(editor.text);
      let next = structuredClone(db);
      if (editor.kind === "all") next = value;
      else if (editor.kind === "drink") {
        const { drink: dr, recipes } = value;
        next.drinks = [...next.drinks.filter((d) => d.id !== dr.id), dr];
        next.recipes = [
          ...next.recipes.filter((r) => r.drinkId !== dr.id),
          ...recipes,
        ];
      } else {
        const { ingredient: ing, rules } = value;
        next.ingredients = [
          ...next.ingredients.filter((i) => i.id !== ing.id),
          ing,
        ];
        next.rules = [
          ...next.rules.filter((r) => r.ingredientId !== ing.id),
          ...rules,
        ];
      }
      save(next);
      setEditor(null);
    } catch (e) {
      setToast("저장 실패: " + (e as Error).message);
    }
  }
  function exportDB() {
    const a = document.createElement("a");
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(db, null, 2)], { type: "application/json" }),
    );
    a.href = url;
    a.download = "partner-note-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  async function importDB(e: React.ChangeEvent<HTMLInputElement>) {
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      const v = JSON.parse(await file.text());
      validateDB(v);
      setEditor({ kind: "all", text: JSON.stringify(v, null, 2) });
      setToast("불러온 데이터를 검토한 후 저장해 주세요.");
    } catch (e) {
      setToast("불러오기 실패: " + (e as Error).message);
    }
  }
  const listDrinks = filter === "전체" || filter === "음료";
  const listIng = filter !== "음료";
  return (
    <div className="shell">
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <a className="brand" onClick={() => nav("home")}>
          <span className="brand-icon">
            <BookOpen size={22} />
          </span>
          <span>
            PARTNER
            <br />
            <b>
              NOTE<span className="brand-dot">.</span>
            </b>
          </span>
        </a>
        <div className="workspace-label">PARTNER WORKSPACE</div>
        <nav>
          {[
            ["home", "워크스페이스", BookOpen],
            ["drinks", "음료 레시피", Coffee],
            ["ingredients", "부재료 라이브러리", Package],
            ["tag", "NOW TAG", Tag],
          ].map(([p, text, Icon]: any) => (
            <button
              key={p}
              className={
                page === p ||
                (p === "drinks" && page === "drink") ||
                (p === "ingredients" && page === "ingredient")
                  ? "nav active"
                  : "nav"
              }
              onClick={() => nav(p)}
            >
              <Icon size={19} />
              {text}
              {p === "tag" && <span className="new">NEW</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-card">
            <span className="online-dot" /> 로컬 데모 모드
            <p>나의 브라우저에 안전하게 저장됩니다.</p>
          </div>
          <button
            className={"nav " + (page === "manage" ? "active" : "")}
            onClick={() => nav("manage")}
          >
            <Settings size={18} />
            데이터 관리
          </button>
          <div className="profile">
            <div className="avatar">P</div>
            <span>
              <b>파트너님</b>
              <small>오늘도 좋은 한 잔을.</small>
            </span>
            <span className="v1">v1.0</span>
          </div>
        </div>
      </aside>
      <div className="main">
        <header>
          <button
            className="mobile-menu"
            onClick={() => setMobile(!mobile)}
            aria-label="메뉴"
          >
            <Menu />
          </button>
          <span>
            워크스페이스 <ChevronRight size={14} />{" "}
            <b>
              {page === "drink"
                ? "음료 레시피"
                : page === "ingredient"
                  ? "부재료 상세"
                  : page === "tag"
                    ? "NOW TAG"
                    : page === "manage"
                      ? "데이터 관리"
                      : page === "drinks"
                        ? "음료 라이브러리"
                        : page === "ingredients"
                          ? "부재료 라이브러리"
                          : "홈"}
            </b>
          </span>
          <div className="header-right">
            <span className="online-dot" />
            모든 변경사항 로컬 저장 <span className="avatar small">P</span>
          </div>
        </header>
        <main>
          {(page === "home" || page === "drinks" || page === "ingredients") && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">YOUR DAILY PARTNER</div>
                  <h1>
                    {page === "home"
                      ? "좋은 한 잔의 시작,"
                      : page === "drinks"
                        ? "음료 레시피"
                        : "부재료 라이브러리"}
                    {page === "home" && (
                      <>
                        <br />
                        <span>필요한 정보를 한곳에서.</span>
                      </>
                    )}
                  </h1>
                  <p>
                    레시피 확인부터 부재료 관리, 라벨 생성까지 자연스럽게
                    연결하세요.
                  </p>
                </div>
                <div className="heading-note">
                  <CalendarDays size={17} />
                  {new Date().toLocaleDateString("ko-KR", {
                    month: "long",
                    day: "numeric",
                    weekday: "long",
                  })}
                  <span>오늘도 함께해요, 파트너님.</span>
                </div>
              </div>
              <section className="search-section">
                <div className="search-input">
                  <Search size={23} />
                  <input
                    aria-label="통합 검색"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="음료명, 마킹명 또는 부재료를 검색해 보세요"
                  />
                  {q && (
                    <button onClick={() => setQ("")} aria-label="검색 지우기">
                      <X size={18} />
                    </button>
                  )}
                  <kbd>검색</kbd>
                </div>
                <div className="search-hints">
                  <span>빠른 검색</span>
                  {[
                    "자바칩 프라푸치노",
                    "FR",
                    "피치망고용과토핑",
                    "코르타도",
                  ].map((t) => (
                    <button key={t} onClick={() => setQ(t)}>
                      {t} <ArrowUpRight size={12} />
                    </button>
                  ))}
                </div>
              </section>
              {page === "home" && !q && (
                <>
                  <div className="section-title">
                    <h2>파트너의 업무를 더 가볍게</h2>
                    <span>하나의 흐름으로 연결되는 업무 도구</span>
                  </div>
                  <div className="tools-grid">
                    <button className="tool-card" onClick={() => nav("drinks")}>
                      <span className="tool-icon">
                        <Coffee />
                      </span>
                      <ArrowUpRight className="corner" size={20} />
                      <h3>음료 레시피</h3>
                      <p>
                        한눈에 보는 제조 순서와
                        <br />
                        사이즈별 정확한 수량
                      </p>
                      <span className="tool-footer">
                        {db.drinks.length}개 음료 <ChevronRight size={16} />
                      </span>
                    </button>
                    <button
                      className="tool-card"
                      onClick={() => nav("ingredients")}
                    >
                      <span className="tool-icon beige">
                        <Package />
                      </span>
                      <ArrowUpRight className="corner" size={20} />
                      <h3>부재료 라이브러리</h3>
                      <p>
                        작업 상태에 맞는 보관 조건과
                        <br />
                        내부품질기한 확인
                      </p>
                      <span className="tool-footer">
                        {db.ingredients.length}개 부재료{" "}
                        <ChevronRight size={16} />
                      </span>
                    </button>
                    <button
                      className="tool-card tag-card"
                      onClick={() => nav("tag")}
                    >
                      <span className="tool-icon">
                        <Tag />
                      </span>
                      <span className="tag-pill">NOW TAG</span>
                      <h3>확인했다면, 바로 라벨링.</h3>
                      <p>
                        작업 시점을 선택하고
                        <br />
                        숫자택 · 날짜택을 만들어 보세요.
                      </p>
                      <span className="tool-footer">
                        택 생성하기 <ArrowUpRight size={17} />
                      </span>
                      <div className="decor-tag">
                        3<span>WED</span>
                      </div>
                    </button>
                  </div>
                </>
              )}
              <div className="library-layout">
                <section>
                  <div className="section-title">
                    <h2>
                      {q
                        ? "검색 결과"
                        : page === "ingredients"
                          ? "부재료 살펴보기"
                          : "라이브러리 살펴보기"}{" "}
                      <small>
                        {(page === "ingredients" ? 0 : results.drinks.length) +
                          (page === "drinks" ? 0 : results.ingredients.length)}
                      </small>
                    </h2>
                    <span>
                      <SlidersHorizontal size={14} /> 실시간 검색
                    </span>
                  </div>
                  <div className="tabs">
                    {["전체", "음료", "원부재료", "제조 부재료"].map((t) => (
                      <button
                        key={t}
                        className={filter === t ? "selected" : ""}
                        onClick={() => setFilter(t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <div className="library-list">
                    {listDrinks &&
                      page !== "ingredients" &&
                      results.drinks.map((d, index) => (
                        <button
                          className="list-item"
                          key={d.id}
                          onClick={() => go(d.id)}
                        >
                          <div className={"item-icon tone" + (index % 4)}>
                            <Coffee size={24} />
                          </div>
                          <div className="item-info">
                            <b>{d.name}</b>
                            <small>{d.englishName}</small>
                          </div>
                          <div className="item-meta">
                            {d.promotion ? (
                              <span className="badge amber">프로모션 이력</span>
                            ) : (
                              <span className="badge">{d.category}</span>
                            )}
                            <small>
                              {d.markingCode ||
                                d.availableTemperatures.join(" / ")}
                            </small>
                          </div>
                          <ChevronRight size={18} />
                        </button>
                      ))}
                    {listIng &&
                      page !== "drinks" &&
                      results.ingredients
                        .filter((i) => filter === "전체" || filter === i.type)
                        .map((i, index) => (
                          <button
                            key={i.id}
                            className="list-item"
                            onClick={() => {
                              setReturnDrink(null);
                              go(i.id);
                            }}
                          >
                            <div className={"item-icon tone" + (index % 4)}>
                              <Package size={23} />
                            </div>
                            <div className="item-info">
                              <b>{i.name}</b>
                              <small>
                                {i.aliases.length
                                  ? i.aliases.join(" · ")
                                  : i.type}
                              </small>
                            </div>
                            <div className="item-meta">
                              <span className="badge neutral">{i.type}</span>
                              <small>
                                {db.rules.some((r) => r.ingredientId === i.id)
                                  ? "관리 기준 등록"
                                  : "기준 확인 필요"}
                              </small>
                            </div>
                            <ChevronRight size={18} />
                          </button>
                        ))}
                    {!(
                      listDrinks &&
                      page !== "ingredients" &&
                      results.drinks.length
                    ) &&
                      !(
                        listIng &&
                        page !== "drinks" &&
                        results.ingredients.some(
                          (i) => filter === "전체" || i.type === filter,
                        )
                      ) && (
                        <div className="empty">
                          <Search />
                          <h3>검색 결과가 없습니다</h3>
                          <p>다른 음료명이나 등록된 별칭으로 검색해 주세요.</p>
                          <button
                            onClick={() => {
                              setQ("");
                              setFilter("전체");
                            }}
                          >
                            검색 초기화
                          </button>
                        </div>
                      )}
                  </div>
                </section>
                <aside className="context-panel">
                  <div className="section-title">
                    <h2>
                      <Clock size={17} /> 최근 확인한 정보
                    </h2>
                  </div>
                  {recent.length ? (
                    recent.map((id) => {
                      const item =
                        db.drinks.find((d) => d.id === id) ||
                        db.ingredients.find((i) => i.id === id);
                      return (
                        item && (
                          <button
                            className="recent"
                            key={id}
                            onClick={() => go(id)}
                          >
                            <span>
                              {item.name}
                              <small>
                                {id.startsWith("d")
                                  ? "음료 레시피"
                                  : "부재료 관리"}
                              </small>
                            </span>
                            <ChevronRight size={15} />
                          </button>
                        )
                      );
                    })
                  ) : (
                    <p className="muted">
                      조회한 음료와 부재료가 여기에 표시됩니다.
                    </p>
                  )}
                  <div className="notice">
                    <Info size={18} />
                    <h3>정보의 기준을 확인해 주세요</h3>
                    <p>
                      이 워크스페이스는 연구용 프로토타입입니다. 제공 자료와
                      공식 검증 상태를 함께 확인하세요.
                    </p>
                    <button onClick={() => nav("verify")}>
                      확인 필요한 항목 보기 <ArrowUpRight size={14} />
                    </button>
                  </div>
                  <div className="flow-note">
                    <span>SEARCH → RECIPE → INGREDIENT → TAG</span>
                    <p>찾고, 확인하고, 바로 준비하세요.</p>
                  </div>
                </aside>
              </div>
            </>
          )}
          {page === "drink" && drink && choice && (
            <>
              <button className="back" onClick={() => nav("drinks")}>
                <ArrowLeft size={16} /> 음료 라이브러리
              </button>
              <div className="detail-heading">
                <div>
                  <span className="eyebrow">
                    DRINK RECIPE{" "}
                    {drink.markingCode && " / " + drink.markingCode}
                  </span>
                  <h1>{drink.name}</h1>
                  <p>{drink.englishName}</p>
                </div>
                <button
                  className="outline"
                  onClick={() =>
                    edit("drink", {
                      drink,
                      recipes: db.recipes.filter((r) => r.drinkId === drink.id),
                    })
                  }
                >
                  <Settings size={16} /> 레시피 편집
                </button>
              </div>
              <div className="provenance">
                <Info size={16} />
                {drink.verificationStatus} · {drink.source}
              </div>
              {drink.promotion && (
                <div className="promo">
                  <b>{drink.promotion.status}</b>
                  <p>{drink.promotion.notes}</p>
                </div>
              )}
              <div className="detail-grid">
                <section className="panel">
                  <div className="section-title">
                    <h2>제조 조건</h2>
                    <span>선택한 사이즈의 수량으로 표시됩니다</span>
                  </div>
                  <div className="conditions">
                    <div>
                      <label>온도</label>
                      <div className="segmented">
                        {["HOT", "ICED"].map((t) => (
                          <button
                            disabled={!drink.availableTemperatures.includes(t)}
                            className={choice.temp === t ? "selected " + t : ""}
                            onClick={() =>
                              setChoices({
                                ...choices,
                                [drink.id]: {
                                  temp: t,
                                  size: drink.availableSizesByTemperature[
                                    t
                                  ].includes(choice.size)
                                    ? choice.size
                                    : drink.availableSizesByTemperature[t][0],
                                },
                              })
                            }
                            key={t}
                          >
                            {t === "HOT" ? "♨" : "❄"} {t}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label>사이즈</label>
                      <div className="sizes">
                        {(
                          drink.availableSizesByTemperature[choice.temp] || []
                        ).map((s) => (
                          <button
                            key={s}
                            className={choice.size === s ? "selected" : ""}
                            onClick={() =>
                              setChoices({
                                ...choices,
                                [drink.id]: { ...choice, size: s },
                              })
                            }
                          >
                            <b>{s}</b>
                            <small>{labels[s] || s}</small>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {drink.id === "d6" && (
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={ice}
                        onChange={(e) => setIce(e.target.checked)}
                      />{" "}
                      얼음 함께 제공{" "}
                      {ice && (
                        <strong>→ Tall 컵 사용 · 정규 Tall 레시피 아님</strong>
                      )}
                    </label>
                  )}
                  <div className="recipe-title">
                    <h2>제조 순서</h2>
                    <span>{recipe?.orderedSteps.length || 0} STEPS</span>
                  </div>
                  {recipe ? (
                    <>
                      <div className="equipment">
                        <FlaskConical size={16} />
                        {recipe.equipment}
                      </div>
                      <ol className="steps">
                        {recipe.orderedSteps.map((s, i) => (
                          <li key={i}>
                            <span className="step-no">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <div>
                              <p>{s.description}</p>
                              {s.ingredientId && (
                                <button
                                  className="ingredient-link"
                                  onClick={() => {
                                    setReturnDrink(drink.id);
                                    go(s.ingredientId!);
                                  }}
                                >
                                  {
                                    db.ingredients.find(
                                      (i) => i.id === s.ingredientId,
                                    )?.name
                                  }
                                  <ArrowUpRight size={13} />
                                </button>
                              )}
                              {s.note && <small>{s.note}</small>}
                            </div>
                            {s.quantityBySize[choice.size] !== undefined && (
                              <div className="quantity">
                                {s.quantityBySize[choice.size]}
                                <small>{s.unit}</small>
                              </div>
                            )}
                          </li>
                        ))}
                      </ol>
                      <div className="serving">
                        <CheckCircle2 size={18} />
                        {recipe.servingInstructions}
                      </div>
                    </>
                  ) : (
                    <div className="empty">
                      레시피 자료가 아직 등록되지 않았습니다.
                    </div>
                  )}
                </section>
                <aside>
                  <section className="panel">
                    <h2>
                      연결된 부재료{" "}
                      <small>{drink.relatedIngredientIds.length}</small>
                    </h2>
                    <p className="muted">
                      부재료를 선택해 관리 기준을 확인하세요.
                    </p>
                    {drink.relatedIngredientIds
                      .slice(0, expanded ? 100 : 5)
                      .map((id) => (
                        <button
                          className="related"
                          key={id}
                          onClick={() => {
                            setReturnDrink(drink.id);
                            go(id);
                          }}
                        >
                          <Package size={17} />
                          <span>
                            {db.ingredients.find((i) => i.id === id)?.name}
                          </span>
                          <ChevronRight size={16} />
                        </button>
                      ))}
                    {drink.relatedIngredientIds.length > 5 && (
                      <button
                        className="text-button"
                        onClick={() => setExpanded(!expanded)}
                      >
                        {expanded ? "접기" : "모든 부재료 보기 +"}
                      </button>
                    )}
                  </section>
                  <section className="panel notes">
                    <h3>제조 메모</h3>
                    <p>{drink.specialInstructions}</p>
                    <h3>영양 · 알레르기</h3>
                    <p>
                      알레르기:{" "}
                      {drink.allergens.join(", ") ||
                        "등록 자료 없음 · 확인 필요"}
                    </p>
                    {Object.keys(drink.nutritionBySize).length ? (
                      <pre>
                        {JSON.stringify(drink.nutritionBySize, null, 2)}
                      </pre>
                    ) : (
                      <p>가격·영양 수치 자료 미등록</p>
                    )}
                  </section>
                </aside>
              </div>
            </>
          )}
          {page === "ingredient" && ingredient && (
            <>
              <button
                className="back"
                onClick={() =>
                  returnDrink ? go(returnDrink) : nav("ingredients")
                }
              >
                <ArrowLeft size={16} />
                {returnDrink ? "선택한 레시피로 돌아가기" : "부재료 라이브러리"}
              </button>
              <div className="detail-heading">
                <div>
                  <div className="eyebrow">
                    INGREDIENT LIBRARY / {ingredient.type}
                  </div>
                  <h1>{ingredient.name}</h1>
                  <p>
                    {ingredient.aliases.length
                      ? "별칭 · " + ingredient.aliases.join(", ")
                      : "보관부터 라벨링까지, 기준을 확인하세요."}
                  </p>
                </div>
                <button
                  className="outline"
                  onClick={() =>
                    edit("ingredient", {
                      ingredient,
                      rules: db.rules.filter(
                        (r) => r.ingredientId === ingredient.id,
                      ),
                    })
                  }
                >
                  <Settings size={16} /> 관리 기준 편집
                </button>
              </div>
              <div className="detail-grid">
                <section>
                  <Quality ingredient={ingredient} db={db} />
                  <section className="panel">
                    <h2>이 부재료를 사용하는 음료</h2>
                    {db.drinks
                      .filter((d) =>
                        d.relatedIngredientIds.includes(ingredient.id),
                      )
                      .map((d) => (
                        <button
                          className="related"
                          onClick={() => go(d.id)}
                          key={d.id}
                        >
                          <Coffee size={18} />
                          <span>{d.name}</span>
                          <ChevronRight size={16} />
                        </button>
                      ))}
                    {!db.drinks.some((d) =>
                      d.relatedIngredientIds.includes(ingredient.id),
                    ) && <p className="muted">연결된 음료가 없습니다.</p>}
                    <h3>연결 원재료</h3>
                    {ingredient.relatedIngredientIds.length ? (
                      ingredient.relatedIngredientIds.map((id) => (
                        <button
                          className="related"
                          key={id}
                          onClick={() => go(id)}
                        >
                          {db.ingredients.find((i) => i.id === id)?.name}
                          <ChevronRight size={16} />
                        </button>
                      ))
                    ) : (
                      <p className="muted">제조 구성 원재료 자료 미등록</p>
                    )}
                  </section>
                </section>
                <TagBuilder
                  key={ingredient.id}
                  db={db}
                  initial={ingredient.id}
                />
              </div>
            </>
          )}
          {page === "tag" && (
            <>
              <div className="eyebrow">FROM PREPARATION TO LABEL</div>
              <h1>확인했다면, NOW TAG.</h1>
              <p className="subtitle">
                작업 조건을 선택하고, 나란히 놓인 택으로 한 번 더 확인하세요.
              </p>
              <TagBuilder db={db} />
            </>
          )}
          {page === "manage" && (
            <>
              <div className="eyebrow">LOCAL DATA STUDIO</div>
              <h1>나의 데이터 관리</h1>
              <p className="subtitle">
                음료와 관리 기준을 편집하고 이 브라우저에 저장합니다.
              </p>
              <div className="provenance">
                <Info size={17} />
                데모용 로컬 편집 환경 · 사용자 수정값은 원본 시드와 별도로
                저장됩니다.
              </div>
              <div className="manage-actions">
                <button
                  className="primary"
                  onClick={() =>
                    edit("drink", {
                      drink: {
                        ...db.drinks[0],
                        id: "d" + Date.now(),
                        name: "새 음료",
                        englishName: "New Drink",
                        relatedIngredientIds: [],
                        promotion: null,
                      },
                      recipes: [],
                    })
                  }
                >
                  <Plus size={18} /> 음료 추가
                </button>
                <button
                  className="outline"
                  onClick={() =>
                    edit("ingredient", {
                      ingredient: {
                        ...db.ingredients[0],
                        id: "i" + Date.now(),
                        name: "새 부재료",
                        aliases: [],
                        relatedIngredientIds: [],
                      },
                      rules: [],
                    })
                  }
                >
                  <Plus size={18} /> 부재료 추가
                </button>
                <button className="outline" onClick={exportDB}>
                  <Download size={17} /> JSON 내보내기
                </button>
                <label className="outline upload">
                  <Upload size={17} /> 불러오기
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={importDB}
                  />
                </label>
                <button
                  className="outline danger"
                  onClick={() => {
                    if (
                      confirm(
                        "로컬 변경 사항을 모두 삭제하고 원본 시드로 초기화할까요? 먼저 백업을 권장합니다.",
                      )
                    ) {
                      save(structuredClone(defaults));
                      setChoices({});
                      setSelected(null);
                    }
                  }}
                >
                  <RotateCcw size={17} /> 초기화
                </button>
              </div>
              <div className="panel">
                <div className="section-title">
                  <h2>음료 · 부재료 · 규칙</h2>
                  <button
                    className="text-button"
                    onClick={() => edit("all", db)}
                  >
                    전체 JSON 편집
                  </button>
                </div>
                <p className="muted">
                  음료 편집에서 온도·사이즈·단계·연결 ID를, 부재료 편집에서
                  작업별 규칙과 시행일을 수정합니다.
                </p>
                {db.drinks.map((d) => (
                  <button
                    className="related"
                    key={d.id}
                    onClick={() =>
                      edit("drink", {
                        drink: d,
                        recipes: db.recipes.filter((r) => r.drinkId === d.id),
                      })
                    }
                  >
                    <Coffee size={17} />
                    <span>{d.name}</span>
                    <small>{d.id}</small>
                    <Settings size={16} />
                  </button>
                ))}
                {db.ingredients.map((i) => (
                  <button
                    className="related"
                    key={i.id}
                    onClick={() =>
                      edit("ingredient", {
                        ingredient: i,
                        rules: db.rules.filter((r) => r.ingredientId === i.id),
                      })
                    }
                  >
                    <Package size={17} />
                    <span>{i.name}</span>
                    <small>
                      {i.id} ·{" "}
                      {db.rules.filter((r) => r.ingredientId === i.id).length}개
                      규칙
                    </small>
                    <Settings size={16} />
                  </button>
                ))}
              </div>
            </>
          )}
          {page === "verify" && (
            <>
              <div className="eyebrow">SOURCE & VERIFICATION</div>
              <h1>공식 확인이 필요한 항목</h1>
              <section className="panel">
                <p>
                  모든 자료는 사용자 제공 현장 메모, 연구 기준표 또는 연도
                  미확인 이미지에서 등록했습니다.
                </p>
                {[
                  "프로모션 연도 및 현재 판매 여부 · 모든 현장 자료의 최신 공식 유효성",
                  "숫자택의 실제 번호 규칙과 요일 색상, 품목별 택 종류",
                  "기산일 포함 여부, 월말·영업시간·내일 오픈 시각의 공식 계산 정책",
                  "제로클래식시럽 14일 → 21일 실제 변경 시행일 및 공식 근거",
                  "윈터 스카치 바닐라 라떼 HOT V 칼로리: 원본 숫자 재확인",
                  "크림향 베이스 투입 수량 단위 및 펌프 용량",
                  "부재료 별칭·제조 구성, 이미지의 흐릿한 표기 및 미등록 상태별 규칙",
                  "새 기준표: 프라푸치노 로스트 원료 개봉 3개월과 믹스 제조 48시간은 별개 상태",
                  "영양·가격·알레르기 수치는 첨부 자료 시점이며 현행 정보 확인 필요",
                ].map((t, i) => (
                  <div className="verify-row" key={t}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    {t}
                    <span className="badge amber">확인 필요</span>
                  </div>
                ))}
              </section>
            </>
          )}
          <footer>
            <span>
              PARTNER NOTE <b>·</b> 더 나은 한 잔을 위한 파트너의 노트
            </span>
            <button onClick={() => nav("verify")}>
              연구용 프로토타입 · 공식 운영 기준 확인 필요{" "}
              <ArrowUpRight size={12} />
            </button>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Info size={18} />
          {toast}
        </div>
      )}
      {editor && (
        <div className="modal-backdrop">
          <section className="modal">
            <div className="section-title">
              <div>
                <h2>로컬 데이터 편집</h2>
                <p className="muted">
                  JSON 구조를 유지해 주세요. 저장 전 연결 ID와 관리 규칙을
                  검증합니다.
                </p>
              </div>
              <button aria-label="편집 닫기" onClick={() => setEditor(null)}>
                <X />
              </button>
            </div>
            <p className="editor-tip">
              단계: orderedSteps · 수량: quantityBySize · 원재료 연결:
              ingredientId · 규칙: rules
              <br />
              시행일 미확인은 null, 기간 끝 effectiveUntil은 해당 날짜
              미포함입니다.
            </p>
            <EditorFields
              editor={editor}
              onChange={(text) => setEditor({ ...editor, text })}
            />
            <textarea
              aria-label="데이터 JSON 편집"
              spellCheck={false}
              value={editor.text}
              onChange={(e) => setEditor({ ...editor, text: e.target.value })}
            />
            <div className="modal-actions">
              <button className="outline" onClick={() => setEditor(null)}>
                취소
              </button>
              <button className="primary" onClick={applyEdit}>
                <Check size={17} /> 검증하고 로컬 저장
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
function EditorFields({
  editor,
  onChange,
}: {
  editor: { kind: string; text: string };
  onChange: (text: string) => void;
}) {
  let value: any;
  try {
    value = JSON.parse(editor.text);
  } catch {
    return null;
  }
  if (editor.kind === "all") return null;
  const entity = editor.kind === "drink" ? value.drink : value.ingredient;
  if (!entity) return null;
  function update(fn: (v: any) => void) {
    const next = structuredClone(value);
    fn(next);
    onChange(JSON.stringify(next, null, 2));
  }
  return (
    <div className="editor-fields">
      <div className="form-row">
        <label>
          이름
          <input
            value={entity.name || ""}
            onChange={(e) =>
              update((v) => ((v.drink || v.ingredient).name = e.target.value))
            }
          />
        </label>
        <label>
          {editor.kind === "drink" ? "마킹명" : "별칭 (쉼표 구분)"}
          <input
            value={
              editor.kind === "drink"
                ? entity.markingCode || ""
                : (entity.aliases || []).join(",")
            }
            onChange={(e) =>
              update((v) => {
                if (v.drink) v.drink.markingCode = e.target.value;
                else
                  v.ingredient.aliases = e.target.value
                    .split(",")
                    .map((a: string) => a.trim())
                    .filter(Boolean);
              })
            }
          />
        </label>
      </div>
      {editor.kind === "drink" &&
        value.recipes?.map((r: Recipe, ri: number) => (
          <details key={ri}>
            <summary>
              {r.temperature} / {r.size} · 제조 단계 편집
            </summary>
            {r.orderedSteps.map((s, si) => (
              <div className="step-edit" key={si}>
                <input
                  aria-label={"제조 단계 " + (si + 1)}
                  value={s.description}
                  onChange={(e) =>
                    update((v) => {
                      v.recipes[ri].orderedSteps[si].description =
                        e.target.value;
                      v.recipes[ri].orderedSteps[si].action = e.target.value;
                    })
                  }
                />
                <button
                  disabled={!si}
                  onClick={() =>
                    update((v) => {
                      const a = v.recipes[ri].orderedSteps;
                      [a[si - 1], a[si]] = [a[si], a[si - 1]];
                      a.forEach((s: any, i: number) => (s.order = i + 1));
                    })
                  }
                >
                  ↑
                </button>
                <button
                  disabled={si === r.orderedSteps.length - 1}
                  onClick={() =>
                    update((v) => {
                      const a = v.recipes[ri].orderedSteps;
                      [a[si + 1], a[si]] = [a[si], a[si + 1]];
                      a.forEach((s: any, i: number) => (s.order = i + 1));
                    })
                  }
                >
                  ↓
                </button>
                <button
                  aria-label="단계 삭제"
                  onClick={() =>
                    update((v) => {
                      v.recipes[ri].orderedSteps.splice(si, 1);
                      v.recipes[ri].orderedSteps.forEach(
                        (s: any, i: number) => (s.order = i + 1),
                      );
                    })
                  }
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <button
              className="text-button"
              onClick={() =>
                update((v) =>
                  v.recipes[ri].orderedSteps.push({
                    order: r.orderedSteps.length + 1,
                    action: "새 단계",
                    description: "새 단계",
                    ingredientId: null,
                    equipment: "",
                    quantityBySize: {},
                    unit: "",
                    note: "",
                  }),
                )
              }
            >
              <Plus size={14} /> 제조 단계 추가
            </button>
          </details>
        ))}
      {editor.kind === "ingredient" && (
        <button
          className="text-button"
          onClick={() =>
            update((v) =>
              v.rules.push({
                id: "r" + Date.now(),
                ingredientId: entity.id,
                workState: "개봉 후",
                storageCondition: "실온",
                durationValue: 1,
                durationUnit: "일",
                effectiveFrom: null,
                effectiveUntil: null,
                verificationStatus: "사용자 입력 · 미검증",
                source: "로컬 사용자 입력",
                updatedAt: localInput(),
                notes: "공식 확인 필요",
                tagType: "both",
                dateFields: ["작업일", "사용기한"],
                dateFormat: "YYYY-MM-DD HH:mm",
                numberCode: null,
                tagNotes: "데모 설정",
              }),
            )
          }
        >
          <Plus size={14} /> 독립 관리 규칙 추가
        </button>
      )}
    </div>
  );
}
function Quality({ ingredient, db }: { ingredient: Ingredient; db: Database }) {
  const now = localInput().slice(0, 10);
  const rules = db.rules.filter((r) => r.ingredientId === ingredient.id);
  return (
    <section className="panel">
      <div className="section-title">
        <h2>작업 상태별 내부품질기한</h2>
        <span className="badge amber">공식 현행 미확인</span>
      </div>
      {!rules.length && (
        <div className="empty">자료 미등록 · 기한을 추정하지 않습니다.</div>
      )}
      {rules
        .filter((r) => r.verificationStatus !== "이전 기준 예시")
        .map((r) => (
          <div className="quality-rule" key={r.id}>
            <div>
              <span className="badge">{r.workState}</span>
              <span className="badge neutral">{r.storageCondition}</span>
              <strong>
                {r.durationValue}
                <small>{r.durationUnit}</small>
              </strong>
            </div>
            <p>
              {r.verificationStatus} · {r.source}
            </p>
            <small>
              {r.effectiveFrom
                ? `${applicable(r, now) ? "적용 기간 내" : r.effectiveFrom > now ? "변경 예정" : "이전 기간"} · ${r.effectiveFrom} – ${r.effectiveUntil || "종료 미정"}`
                : "실제 시행일 확인 필요"}{" "}
              · {r.notes}
            </small>
          </div>
        ))}
      {rules.some((r) => r.verificationStatus === "이전 기준 예시") && (
        <details>
          <summary>변경 이력 보기 · 시행일 미확인</summary>
          {rules
            .filter((r) => r.verificationStatus === "이전 기준 예시")
            .map((r) => (
              <p key={r.id}>
                이전 기준 {r.durationValue}
                {r.durationUnit} → 연구 기준표 21일 · 실제 변경 시행일 확인 필요
              </p>
            ))}
        </details>
      )}
      {ingredient.noRuleStates?.length && (
        <p className="warning">
          원문에 적용 제외로 표시: {ingredient.noRuleStates.join(", ")}
        </p>
      )}
      <p className="muted">
        다른 작업 상태의 규칙은 자동으로 적용되지 않습니다. 자료가 없는 상태는
        계산할 수 없습니다.
      </p>
    </section>
  );
}
function TagBuilder({ db, initial }: { db: Database; initial?: string }) {
  const [id, setId] = useState(initial || "i3");
  const [work, setWork] = useState(
    db.rules.find((r) => r.ingredientId === (initial || "i3"))?.workState ||
      "개봉 후",
  );
  const [storage, setStorage] = useState(
    db.rules.find((r) => r.ingredientId === (initial || "i3"))
      ?.storageCondition || "냉장",
  );
  const [start, setStart] = useState(localInput());
  const [mode, setMode] = useState("현재 작업 시각");
  const [opening, setOpening] = useState("07:00");
  const [inclusive, setInclusive] = useState(false);
  const [demo, setDemo] = useState(true);
  const [result, setResult] = useState<{ end: Date; rule: Rule } | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("pn-tags") || "[]");
    } catch {
      return [];
    }
  });
  const [message, setMessage] = useState("");
  const [precisionOverride, setPrecisionOverride] = useState<
    "date" | "datetime" | null
  >(null);
  const item = db.ingredients.find((i) => i.id === id);
  const rules = selectRules(db.rules, id, work, storage, start.slice(0, 10));
  const precision =
    precisionOverride ??
    labelPrecision(rules.length === 1 ? rules[0] : undefined);
  const precisionText =
    precision === "date" ? "날짜만 기입" : "날짜 + 시간 기입";
  useEffect(() => {
    setPrecisionOverride(null);
  }, [id, work, storage, db]);
  useEffect(() => {
    setResult(null);
    setError("");
    setMessage("");
  }, [id, work, storage, start, mode, opening, inclusive, demo, db, precision]);
  function changeItem(value: string) {
    setId(value);
    const r = db.rules.find(
      (r) =>
        r.ingredientId === value && r.verificationStatus !== "이전 기준 예시",
    );
    setWork(r?.workState || "개봉 후");
    setStorage(r?.storageCondition || "실온");
  }
  function dateMode(m: string) {
    setMode(m);
    const d = new Date();
    if (m === "내일 오픈 준비") {
      d.setDate(d.getDate() + 1);
      setStart(localInput(d).slice(0, 10) + "T" + opening);
    } else if (m === "현재 작업 시각") setStart(localInput(d));
  }
  function generate() {
    setError("");
    if (!demo) {
      setError(
        "공식 계산 정책이 검증되지 않아 운영용 결과를 생성할 수 없습니다. 데모 계산을 선택해 주세요.",
      );
      return;
    }
    if (!start || rules.length !== 1) {
      setError(
        rules.length > 1
          ? "동일 조건의 기준이 충돌합니다. 출처와 시행일을 먼저 정리해 주세요."
          : item?.noRuleStates?.includes(work)
            ? "원문에 해당 작업은 적용하지 않는 것으로 표시되어 있습니다."
            : "선택한 작업·보관 조건과 날짜에 적용할 자료가 없습니다.",
      );
      return;
    }
    try {
      setResult({
        end: addDuration(
          new Date(start),
          rules[0].durationValue,
          rules[0].durationUnit,
          inclusive,
        ),
        rule: rules[0],
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const fmt = (d: Date) =>
    d.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  return (
    <section className="panel tag-builder">
      <div className="section-title">
        <h2>
          <Tag size={20} /> NOW TAG
        </h2>
        <span className="badge">라벨 워크스페이스</span>
      </div>
      <p className="muted">작업 조건을 확인하고 시연용 택을 생성하세요.</p>
      <label>
        부재료
        <select value={id} onChange={(e) => changeItem(e.target.value)}>
          {db.ingredients.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </label>
      <div className="form-row">
        <label>
          작업 상태
          <select value={work} onChange={(e) => setWork(e.target.value)}>
            {states.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          보관 조건
          <select value={storage} onChange={(e) => setStorage(e.target.value)}>
            {["실온", "냉장", "냉동", "기타"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        날짜 선택 모드
        <select value={mode} onChange={(e) => dateMode(e.target.value)}>
          {["현재 작업 시각", "내일 오픈 준비", "직접 날짜·시각 지정"].map(
            (s) => (
              <option key={s}>{s}</option>
            ),
          )}
        </select>
      </label>
      {mode === "내일 오픈 준비" && (
        <>
          <label>
            매장 오픈 참고 시각
            <input
              type="time"
              value={opening}
              onChange={(e) => {
                setOpening(e.target.value);
                setStart(start.slice(0, 10) + "T" + e.target.value);
              }}
            />
          </label>
          <p className="warning">
            내일 오픈 시각은 데모 참고값입니다. 실제 기산 시점 적용은 공식
            확인이 필요합니다.
          </p>
        </>
      )}
      <label>
        작업 시작 날짜 · 시각
        <input
          type="datetime-local"
          value={start}
          onInput={(e) => setStart(e.currentTarget.value)}
          onChange={(e) => setStart(e.target.value)}
        />
      </label>
      <div className="rule-summary">
        <Info size={17} />
        <div>
          {rules.length === 1 ? (
            <>
              <b>
                {rules[0].durationValue}
                {rules[0].durationUnit} · {rules[0].verificationStatus}
              </b>
              <small>{rules[0].source}</small>
            </>
          ) : (
            <b>
              {rules.length
                ? "기준 충돌 · 계산 제한"
                : item?.noRuleStates?.includes(work)
                  ? "원문: 해당 상태 적용 제외"
                  : "선택 조건의 규칙 자료 없음"}
            </b>
          )}
        </div>
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={demo}
          onChange={(e) => setDemo(e.target.checked)}
        />
        데모 계산 모드
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={inclusive}
          onChange={(e) => setInclusive(e.target.checked)}
        />
        일 단위 계산 시 작업일을 첫날로 포함
      </label>
      <details className="policy">
        <summary>데모 날짜 계산 가정 보기</summary>
        <p>
          기본값은 작업 시각에 기간을 더합니다. 일은 달력일 단위, 시간은 경과
          시간, 개월은 같은 날짜로 더하되 말일을 초과하면 월말로 보정합니다.
          작업일 포함 옵션은 일 단위에만 적용합니다. 규칙은 시작 날짜 기준,
          종료일 미포함. 영업시간 예외는 적용하지 않습니다. 숫자 1~7은 월~일
          데모 코드입니다.
        </p>
      </details>
      <div className="label-format-control">
        <label>
          라벨 기입 범위 · 데모 설정
          <select
            aria-label="라벨 기입 범위"
            value={precision}
            onChange={(e) =>
              setPrecisionOverride(e.target.value as "date" | "datetime")
            }
          >
            <option value="date">날짜만 · YYYY.MM.DD</option>
            <option value="datetime">날짜 + 시간 · YYYY.MM.DD HH:mm</option>
          </select>
        </label>
        <p>
          아래 라벨에는 선택한 범위만 표시합니다. 품목별 실제 기입 범위는 공식
          확인이 필요합니다. 표기를 바꿔도 계산 시각은 유지됩니다.
        </p>
      </div>
      <button className="primary generate" onClick={generate}>
        <Tag size={18} /> NOW TAG 생성 <ArrowUpRight size={18} />
      </button>
      {error && (
        <p className="warning" role="alert">
          {error}
        </p>
      )}
      <div className="preview-title">
        <span>LABEL PREVIEW</span>
        <small>{result ? "시연용 계산 결과" : "생성 전 미리보기"}</small>
      </div>
      <div className="tag-preview">
        {!result ? (
          <>
            <div className="number-tag placeholder">
              —<span>요일 · 데모 코드</span>
            </div>
            <div className="date-tag">
              <span>PARTNER NOTE / DEMO</span>
              <h3>{item?.name}</h3>
              <p>
                {work} · {storage}
              </p>
              <span className="label-precision">{precisionText} · 데모</span>
              <dl>
                <dt>{work.replace(" 후", "일")}</dt>
                <dd className="label-date-value">
                  {precision === "date" ? "YYYY.MM.DD" : "YYYY.MM.DD HH:mm"}
                </dd>
                <dt>사용기한</dt>
                <dd className="label-date-value">—</dd>
              </dl>
              <small>NOW TAG 생성 후 날짜가 채워집니다.</small>
            </div>
          </>
        ) : (
          <>
            {["number", "both"].includes(result.rule.tagType) && (
              <div
                className="number-tag"
                style={{ background: weekdayColors[result.end.getDay()] }}
              >
                {result.rule.numberCode ?? weekdayCodes[result.end.getDay()]}
                <span>
                  {
                    ["일", "월", "화", "수", "목", "금", "토"][
                      result.end.getDay()
                    ]
                  }
                  요일 · 데모 표기
                </span>
              </div>
            )}
            {["date", "both", "handwritten"].includes(result.rule.tagType) && (
              <div className="date-tag">
                <span>
                  시연용 계산 결과 ·{" "}
                  {result.rule.tagType === "handwritten"
                    ? "수기 기입 정보"
                    : "날짜택"}
                </span>
                <h3>{item?.name}</h3>
                <p>
                  {work} · {storage}
                </p>
                <span className="label-precision">{precisionText} · 데모</span>
                <dl>
                  <dt>{work.replace(" 후", "일")}</dt>
                  <dd className="label-date-value">
                    {formatLabelDate(new Date(start), precision)}
                  </dd>
                  <dt>사용기한 (데모)</dt>
                  <dd className="label-date-value">
                    <b>{formatLabelDate(result.end, precision)}</b>
                  </dd>
                </dl>
                <small>공식 운영용 라벨이 아닙니다.</small>
              </div>
            )}
          </>
        )}
      </div>
      {result && (
        <>
          <details className="calculation-reference">
            <summary>계산 근거 확인 · 라벨에 옮겨 적는 정보와 별개</summary>
            <dl>
              <dt>계산에 사용한 작업 시작 일시</dt>
              <dd>{fmt(new Date(start))}</dd>
              <dt>계산된 기한 일시</dt>
              <dd>{fmt(result.end)}</dd>
            </dl>
            <p>
              라벨 표기: {precisionText}. 날짜만 표시해도 계산된 기한 시각을
              자정이나 하루 끝으로 변경하지 않습니다.
            </p>
          </details>
          <p className="warning">
            시연용 계산 결과 · 실제 날짜/시간 기입 범위는 공식 기준 확인 필요
          </p>
          <button
            className="outline"
            onClick={() => {
              const entry = {
                item: item?.name,
                work,
                storage,
                start,
                end: localInput(result.end),
                label: "시연용 계산 결과",
                labelPrecision: precision,
                labelStart: formatLabelDate(new Date(start), precision),
                labelEnd: formatLabelDate(result.end, precision),
                source: result.rule.source,
              };
              const next = [entry, ...history].slice(0, 20);
              localStorage.setItem("pn-tags", JSON.stringify(next));
              setHistory(next);
              setMessage("시연용 택을 이 브라우저에 저장했습니다.");
            }}
          >
            <Bookmark size={16} /> 시연 결과 저장
          </button>
          {message && <p role="status">{message}</p>}
        </>
      )}
      {history.length > 0 && (
        <details>
          <summary>저장한 시연 결과 {history.length}개</summary>
          {history.map((h, i) => (
            <div className="saved-tag" key={i}>
              <b>{h.item}</b>
              <p>
                {h.work} · {h.storage} · {h.labelEnd || h.end.replace("T", " ")}
              </p>
              <small>
                {h.label} ·{" "}
                {h.labelPrecision === "date"
                  ? "날짜만 기입"
                  : h.labelPrecision === "datetime"
                    ? "날짜 + 시간 기입"
                    : "이전 저장 결과 · 표기 범위 미기록"}
              </small>
            </div>
          ))}
        </details>
      )}
    </section>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
