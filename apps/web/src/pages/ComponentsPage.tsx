import { Button, Card } from "@mtkit/ui";
import { useRef, useState, type ReactNode } from "react";
import { LikeBurst } from "../features/components/LikeBurst";
import { WheelPicker } from "../features/components/WheelPicker";
import { ShaderLoaderCard } from "../features/components/loader/ShaderLoaderCard";
import { componentCategories, componentDemos, componentGalleryDescription, type ComponentCategory } from "../features/components/content";
import { GalleryFilters } from "../shared/GalleryFilters";
import wheelLicense from "../features/components/WHEEL-PICKER-LICENSE.txt?url&no-inline";
import "../shared/gallery.css";
import "../features/components/like-burst.css";
import "../features/components/wheel-picker.css";
import "../features/components/loader/loader-demo.css";

function DemoCard({ demo, children, link }: { demo: { id: string; title: string; description: string }; children: ReactNode; link?: ReactNode }) {
  return (
    <Card className="component-preview" id={demo.id}>
      <div className="component-preview-stage">{children}</div>
      <div className="component-preview-caption">
        <h2>{demo.title}</h2>
        <p>{demo.description}</p>
        {link}
      </div>
    </Card>
  );
}

const demos = Object.values(componentDemos);
const categoryLabels = new Map(componentCategories(demos).map(({ id, label }) => [id, label]));
const previews: Record<typeof demos[number]["id"], ReactNode> = {
  "shader-loader": <ShaderLoaderCard />,
  "like-burst": <DemoCard demo={componentDemos.like}><LikeBurst /></DemoCard>,
  "wheel-picker": <DemoCard demo={componentDemos.wheel} link={<a className="inline-link" href={wheelLicense}>Лицензия MIT</a>}><WheelPicker /></DemoCard>,
};

export function ComponentsPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ComponentCategory>("");
  const searchRef = useRef<HTMLInputElement>(null);
  const term = query.trim().toLocaleLowerCase("ru");
  const matching = demos.filter(({ title, id, description, category: group }) =>
    `${title} ${id} ${description} ${categoryLabels.get(group)}`.toLocaleLowerCase("ru").includes(term),
  );
  const visible = category ? matching.filter((demo) => demo.category === category) : matching;

  function resetFilters() {
    setQuery("");
    setCategory("");
    searchRef.current?.focus();
  }

  return (
    <div className="page-container gallery-container">
      <div className="gallery-layout">
        <header className="gallery-heading">
          <h1 id="component-library-title">Компоненты</h1>
          <p>{componentGalleryDescription}</p>
        </header>
        <GalleryFilters id="component" searchLabel="Поиск компонентов" query={query} category={category} categories={componentCategories(matching)} searchRef={searchRef} onQueryChange={setQuery} onCategoryChange={setCategory} onReset={resetFilters} />
        <section className="gallery-results" aria-labelledby="component-library-title">
          <div className="gallery-toolbar"><p role="status">Компонентов: {visible.length}</p></div>
          {visible.length ? (
            <ul className="gallery-grid">{visible.map(({ id }) => <li key={id}>{previews[id]}</li>)}</ul>
          ) : (
            <div className="gallery-empty">
              <h2>Компоненты не найдены</h2>
              <p>Попробуйте другое название или снимите фильтры.</p>
              <Button type="button" variant="ghost" onClick={resetFilters}>Сбросить фильтры</Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
