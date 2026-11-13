import { Button, Card } from "@mtkit/ui";
import { useRef, type MouseEvent, type Ref } from "react";
import { GalleryFilters } from "../../shared/GalleryFilters";
import { ShaderCanvas } from "./ShaderCanvas";
import { imageDemo } from "./imageDemo";
import { shaderPresets, type ShaderPreset } from "./presets";
import { shaderCategoryIcons, shaderGalleryDescription } from "./gallery-content";

type Category = ShaderPreset["group"];
const categories = [...new Set(shaderPresets.map(({ group }) => group))];

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
    <div className="gallery-layout">
      <header className="gallery-heading">
        <h1 id="shader-gallery-title" tabIndex={-1} ref={headingRef}>Шейдеры</h1>
        <p>{shaderGalleryDescription}</p>
      </header>
      <GalleryFilters
        id="shader" searchLabel="Поиск шейдеров" query={query} category={category} searchRef={searchRef}
        categories={(["", ...categories] as const).map((group) => ({
          id: group, label: group || "Все шейдеры", icon: shaderCategoryIcons[group],
          count: group ? matching.filter((preset) => preset.group === group).length : matching.length,
        }))}
        onQueryChange={onQueryChange} onCategoryChange={onCategoryChange} onReset={resetFilters}
      />
      <section className="gallery-results" aria-labelledby="shader-gallery-title">
        <div className="gallery-toolbar">
          <p role="status">Компонентов: {visible.length}</p>
          {onTogglePlayback && visible.length > 0 && (
            <Button type="button" variant="ghost" className="shader-preview-toggle" onClick={onTogglePlayback}>
              <span aria-hidden="true">{playing ? "Ⅱ" : "▸"}</span> {playing ? "Пауза превью" : "Запустить превью"}
            </Button>
          )}
        </div>
        {visible.length ? (
          <ul className="gallery-grid">
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
          <div className="gallery-empty">
            <h2>Шейдеры не найдены</h2>
            <p>Попробуйте другое название или снимите фильтры.</p>
            <Button type="button" variant="ghost" onClick={resetFilters}>Сбросить фильтры</Button>
          </div>
        )}
      </section>
    </div>
  );
}
