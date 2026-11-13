import { Button, Input } from "@mtkit/ui";
import { catalogCategories, catalogCounts, getEntry, queryCatalog, type EntryAvailability, type EntryKind } from "@mtkit-design/catalog";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { EntryDialog } from "../features/catalog/EntryDialog";
import { ToolCard } from "../features/catalog/ToolCard";
import { CatalogSummary } from "../features/catalog/CatalogSummary";
import { catalogIntro, catalogKinds, catalogPageSize } from "../features/catalog/content";

type CatalogView = {
  query: string;
  kind: EntryKind | "";
  category: string;
  availability: EntryAvailability | "";
  page: number;
};

const emptyView: CatalogView = { query: "", kind: "", category: "", availability: "", page: 0 };

function readView(): CatalogView {
  const params = new URLSearchParams(location.search);
  const kind = params.get("kind");
  const category = params.get("category");
  const availability = params.get("availability");
  const page = Number(params.get("page"));
  return {
    query: (params.get("q") ?? "").slice(0, 250),
    kind: kind === "skill" || kind === "mcp" ? kind : "",
    category: catalogCategories.find((name) => name === category) ?? "",
    availability: availability === "bundled" || availability === "optional" ? availability : "",
    page: Number.isSafeInteger(page) && page > 0 ? page - 1 : 0,
  };
}

function readEntry() {
  return getEntry(new URL(location.href).searchParams.get("entry") ?? "");
}

export function CatalogPage() {
  const [view, setView] = useState(readView);
  const { query, kind, category, availability } = view;
  const [pageDirection, setPageDirection] = useState<"next" | "previous">();
  const [selection, setSelection] = useState(() => ({ entry: readEntry(), animate: false }));
  const searchRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLHeadingElement>(null);
  const focusResults = useRef(false);
  const filters = {
    query,
    kind: kind || undefined,
    category: category || undefined,
    availability: availability || undefined,
    limit: catalogPageSize,
  };
  const results = queryCatalog({ ...filters, offset: view.page * catalogPageSize });
  const { total } = results;
  const pages = Math.max(1, Math.ceil(total / catalogPageSize));
  const page = Math.min(view.page, pages - 1);
  const entries = page === view.page ? results.entries : queryCatalog({ ...filters, offset: page * catalogPageSize }).entries;
  const hasFilters = Boolean(query || kind || category || availability);

  useEffect(() => {
    const sync = () => {
      setView(readView());
      setPageDirection(undefined);
      setSelection({ entry: readEntry(), animate: false });
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  useLayoutEffect(() => {
    if (!focusResults.current) return;
    focusResults.current = false;
    resultsRef.current?.focus();
  }, [page]);

  function selectEntry(id?: string, animate = false) {
    const url = new URL(location.href);
    if (id) {
      url.searchParams.set("entry", id);
      history.pushState({ catalogEntry: true }, "", url);
    } else {
      if (history.state?.catalogEntry === true) {
        history.back();
        return;
      }
      url.searchParams.delete("entry");
      history.replaceState(null, "", url);
      resultsRef.current?.focus();
    }
    setSelection({ entry: id ? getEntry(id) : undefined, animate });
  }

  function saveView(next: CatalogView, addHistory: boolean) {
    const url = new URL(location.href);
    const params = {
      q: next.query,
      kind: next.kind,
      category: next.category,
      availability: next.availability,
      page: next.page ? String(next.page + 1) : "",
    };
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    if (url.href !== location.href) {
      if (addHistory) history.pushState(null, "", url);
      else history.replaceState(history.state, "", url);
    }
    setView(next);
  }

  function updateFilters(update: Partial<Omit<CatalogView, "page">>) {
    setPageDirection(undefined);
    saveView({ ...view, ...update, page: 0 }, false);
  }

  function reset() {
    updateFilters(emptyView);
    searchRef.current?.focus();
  }

  function changePage(value: number, animate: boolean) {
    if (value < 0 || value >= pages || value === page) return;
    focusResults.current = true;
    setPageDirection(animate ? (value > page ? "next" : "previous") : undefined);
    saveView({ ...view, page: value }, true);
  }

  return (
    <>
      <div className="catalog-intro-surface">
        <div className="page-container catalog-intro">
          <div>
            <a className="inline-link breadcrumb" href="/">← О MTKit Design</a>
            <h1>{catalogIntro.title}<span>.</span></h1>
            <p>{catalogIntro.description}</p>
          </div>
          <CatalogSummary />
        </div>
      </div>
      <section className="page-container directory" aria-labelledby="results-title">
        <div className="catalog-filters" role="search" aria-label="Фильтры каталога">
          <label className="search-field">
            <span className="search-icon" aria-hidden="true" />
            <span className="sr-only">Поиск по каталогу</span>
            <Input ref={searchRef} type="search" value={query} maxLength={250} placeholder={catalogIntro.searchPlaceholder} onChange={(event) => updateFilters({ query: event.target.value })} />
          </label>
          <label className="category-field">
            <span className="sr-only">Категория</span>
            <select value={category} onChange={(event) => updateFilters({ category: event.target.value })}>
              <option value="">Все категории</option>
              {catalogCategories.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="category-field availability-field">
            <span className="sr-only">Способ подключения</span>
            <select value={availability} onChange={(event) => updateFilters({ availability: event.target.value as EntryAvailability | "" })}>
              <option value="">Любое подключение</option>
              <option value="bundled">В плагине Codex</option>
              <option value="optional">Подключаются отдельно</option>
            </select>
          </label>
        </div>
        <div className="results-bar">
          <div className="switcher" role="group" aria-label="Тип инструмента">
            {catalogKinds.map(({ value, label }) => (
              <Button key={value} type="button" aria-pressed={kind === value} onClick={() => updateFilters({ kind: value })}>{label}</Button>
            ))}
          </div>
          <div className="results-meta">
            {hasFilters && <Button type="button" className="reset-filters" variant="ghost" onClick={reset}>Сбросить</Button>}
            <h2 id="results-title" ref={resultsRef} tabIndex={-1}><span role="status">Найдено {total} из {catalogCounts.total}</span></h2>
          </div>
        </div>
        {entries.length ? (
          <div key={page} className="card-grid" data-page-direction={pageDirection}>
            {entries.map((entry) => <ToolCard key={entry.id} entry={entry} open={(event) => selectEntry(entry.id, event.detail > 0)} />)}
          </div>
        ) : (
          <div className="empty">
            <h3>Ничего не найдено</h3>
            <p>Попробуйте другое название или сбросьте фильтры.</p>
            <Button type="button" onClick={reset}>Сбросить фильтры</Button>
          </div>
        )}
        {pages > 1 && (
          <div className="pagination" role="group" aria-label="Страницы каталога">
            <Button type="button" disabled={page === 0} onClick={(event) => changePage(page - 1, event.detail > 0)}>← Назад</Button>
            <span role="status">Страница {page + 1} из {pages}</span>
            <Button type="button" disabled={page + 1 >= pages} onClick={(event) => changePage(page + 1, event.detail > 0)}>Далее →</Button>
          </div>
        )}
      </section>
      {selection.entry && <EntryDialog key={selection.entry.id} entry={selection.entry} animate={selection.animate} close={() => selectEntry()} />}
    </>
  );
}
