import { Button, Card, Input } from "@mtkit/ui";
import { useRef, type MouseEvent, type Ref } from "react";
import { ShaderCanvas } from "./ShaderCanvas";
import { imageDemo } from "./imageDemo";
import { shaderPresets, type ShaderPreset } from "./presets";
import { shaderCategoryIcons, shaderGalleryDescription } from "./gallery-content";

type Category = ShaderPreset["group"];
const categories = [...new Set(shaderPresets.map(({ group }) => group))];

function CategoryIcon({ category }: { category: Category | "" }) {
  return <svg className="shader-category-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={shaderCategoryIcons[category]} /></svg>;
}

export function ShaderGallery({ query, category, onQueryChange, onCategoryChange, playing, onTogglePlayback, onOpen, headingRef }: {
  query: string;
  category: Category | "";
  onQueryChange: (query: string) => void;
  onCategoryChange: (category: Category | "") => void;
  playing: boolean;
  onTogglePlayback?: () => void;
  onOpen: (event: MouseEvent<HTMLAnchorElement>, preset: ShaderPreset) => void;
  headingRef: Ref<HTMLHeadingElement>;
}) {
  const searchRef = useRef<HTMLInputElement>(null);
  const term = query.trim().toLocaleLowerCase("ru");
  const matching = shaderPresets.filter(({ name, componentName, group, description }) =>
    `${name} ${componentName} ${group} ${description}`.toLocaleLowerCase("ru").includes(term),
  );
  const visible = category ? matching.filter(({ group }) => group === category) : matching;
  function resetFilters() {
    onQueryChange("");
    onCategoryChange("");
    searchRef.current?.focus();
  }

  return (
    <div className="shader-gallery">
      <header className="shader-gallery-heading">
        <h1 id="shader-gallery-title" tabIndex={-1} ref={headingRef}>Шейдеры</h1>
        <p>{shaderGalleryDescription}</p>
      </header>
      <aside className="shader-sidebar" aria-labelledby="shader-filter-title">
        <div className="shader-filter-heading">
          <h2 id="shader-filter-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M4 7h9m4 0h3M4 17h3m4 0h9M13 4v6M7 14v6" /></svg>Фильтры</h2>
          <Button type="button" variant="ghost" className="shader-filter-reset" aria-label="Сбросить фильтры" disabled={!query && !category} onClick={resetFilters}>Сбросить</Button>
        </div>
        <div className="shader-search">
          <svg className="shader-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>
          <Input ref={searchRef} type="search" aria-label="Поиск шейдеров" value={query} maxLength={100} placeholder="Поиск шейдеров" onChange={(event) => onQueryChange(event.target.value)} />
          {query && <Button type="button" variant="ghost" className="shader-search-clear" aria-label="Очистить поиск" onClick={() => { onQueryChange(""); searchRef.current?.focus(); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="m7 7 10 10M7 17 17 7" /></svg></Button>}
        </div>
        <div className="shader-category">
          <h3 id="shader-category-title">Категории</h3>
          <div className="shader-category-options" role="group" aria-labelledby="shader-category-title">
            {(["", ...categories] as const).map((group) => (
              <Button key={group} type="button" variant="ghost" aria-pressed={category === group} onClick={() => onCategoryChange(group)}>
                <CategoryIcon category={group} />
                <span className="shader-category-label">{group || "Все шейдеры"}</span>
                <span className="shader-category-count" aria-hidden="true">{group ? matching.filter((preset) => preset.group === group).length : matching.length}</span>
              </Button>
            ))}
          </div>
        </div>
      </aside>
      <section className="shader-gallery-main" aria-labelledby="shader-gallery-title">
        <div className="shader-gallery-toolbar">
          <p role="status">Компонентов: {visible.length}</p>
          {onTogglePlayback && visible.length > 0 && (
            <Button type="button" variant="ghost" className="shader-preview-toggle" onClick={onTogglePlayback}>
              <span aria-hidden="true">{playing ? "Ⅱ" : "▸"}</span> {playing ? "Пауза превью" : "Запустить превью"}
            </Button>
          )}
        </div>
        {visible.length ? (
          <ul className="shader-grid">
            {visible.map((preset) => (
              <li key={preset.id}>
                <Card className="shader-card">
                  <a className="shader-card-link" id={`shader-card-${preset.id}`} href={`?shader=${preset.id}`} onClick={(event) => onOpen(event, preset)}>
                    <div className="shader-card-preview" aria-hidden="true">
                      <ShaderCanvas fragment={preset.fragment} colors={preset.palettes[0].colors} speed={1} intensity={1} playing={playing} options={preset.renderer} imageSrc={preset.renderer?.image ? imageDemo.url : undefined} thumbnail />
                    </div>
                    <div className="shader-card-caption">
                      <div>
                        <h2>{preset.name}</h2>
                        <p>{preset.group}</p>
                      </div>
                      <span className="shader-card-arrow" aria-hidden="true">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" focusable="false">
                          <path d="M6 18 18 6M6 6h12v12" />
                        </svg>
                      </span>
                    </div>
                  </a>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <div className="shader-empty">
            <h2>Шейдеры не найдены</h2>
            <p>Попробуйте другое название или снимите фильтры.</p>
            <Button type="button" variant="ghost" onClick={resetFilters}>Сбросить фильтры</Button>
          </div>
        )}
      </section>
    </div>
  );
}
