import { Button, Input } from "@mtkit/ui";
import type { RefObject } from "react";
import { galleryFilterIcons } from "./gallery-filter-icons";

export type GalleryCategory<Id extends string = string> = { id: Id; label: string; icon: string; count: number };

function FilterIcon({ path, className }: { path: string; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>;
}

export function GalleryFilters<Id extends string>({ id, searchLabel, query, category, categories, searchRef, onQueryChange, onCategoryChange, onReset }: {
  id: string;
  searchLabel: string;
  query: string;
  category: Id;
  categories: readonly GalleryCategory<Id>[];
  searchRef: RefObject<HTMLInputElement | null>;
  onQueryChange: (query: string) => void;
  onCategoryChange: (category: Id) => void;
  onReset: () => void;
}) {
  return (
    <aside className="gallery-sidebar" aria-labelledby={`${id}-filter-title`}>
      <div className="gallery-filter-heading">
        <h2 id={`${id}-filter-title`}><FilterIcon path={galleryFilterIcons.filters} />Фильтры</h2>
        <Button type="button" variant="ghost" className="gallery-filter-reset" aria-label="Сбросить фильтры" disabled={!query && !category} onClick={onReset}>Сбросить</Button>
      </div>
      <div className="gallery-search">
        <FilterIcon className="gallery-search-icon" path={galleryFilterIcons.search} />
        <Input ref={searchRef} type="search" aria-label={searchLabel} placeholder={searchLabel} value={query} maxLength={100} onChange={(event) => onQueryChange(event.target.value)} />
        {query && <Button type="button" variant="ghost" className="gallery-search-clear" aria-label="Очистить поиск" onClick={() => { onQueryChange(""); searchRef.current?.focus(); }}><FilterIcon path={galleryFilterIcons.clear} /></Button>}
      </div>
      <div className="gallery-category">
        <h3 id={`${id}-category-title`}>Категории</h3>
        <div className="gallery-category-options" role="group" aria-labelledby={`${id}-category-title`}>
          {categories.map(({ id: option, label, icon, count }) => (
            <Button key={option} type="button" variant="ghost" aria-pressed={category === option} onClick={() => onCategoryChange(option)}>
              <FilterIcon className="gallery-category-icon" path={icon} />
              <span className="gallery-category-label">{label}</span>
              <span className="gallery-category-count" aria-hidden="true">{count}</span>
            </Button>
          ))}
        </div>
      </div>
    </aside>
  );
}
