import { Button, Card, Input } from "@mtkit/ui";
import { useRef, type MouseEvent, type Ref } from "react";
import { ShaderCanvas } from "./ShaderCanvas";
import { imageDemo } from "./imageDemo";
import { shaderPresets, type ShaderPreset } from "./presets";

type Category = ShaderPreset["group"];
const categories = [...new Set(shaderPresets.map(({ group }) => group))];

function CategoryIcon({ category }: { category: Category | "" }) {
  const paths: Record<Category | "", string> = {
    "": "M3 3h6v6H3z M15 3h6v6h-6z M3 15h6v6H3z M15 15h6v6h-6z",
    "Космос": "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M3 17C0 12 18 0 21 7S6 24 3 17",
    "Изображения": "M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1 M3 17l5-5 4 4 4-6 5 7 M9 7h.01",
    "Абстракция": "M2 7c5-7 15 7 20 0 M2 12c5-7 15 7 20 0 M2 17c5-7 15 7 20 0",
    "Атмосфера": "M6 18a4 4 0 0 1-1-8 7 7 0 0 1 13-2 5 5 0 0 1 0 10H6",
  };
  return <svg className="shader-category-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[category]} /></svg>;
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
        <p>WebGL-фоны и интерактивные эффекты для React и TypeScript.</p>
      </header>
      <aside className="shader-sidebar" aria-labelledby="shader-filter-title">
        <div className="shader-filter-heading">
          <h2 id="shader-filter-title">Фильтры</h2>
          <Button type="button" variant="ghost" className="shader-filter-reset" disabled={!query && !category} onClick={resetFilters}>Сбросить</Button>
        </div>
        <label className="shader-search">
          <span className="search-icon" aria-hidden="true" />
          <span className="sr-only">Поиск шейдеров</span>
          <Input ref={searchRef} type="search" value={query} maxLength={100} placeholder="Поиск шейдеров" onChange={(event) => onQueryChange(event.target.value)} />
        </label>
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
                  <span className="shader-card-arrow" aria-hidden="true"><span>↗</span></span>
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
