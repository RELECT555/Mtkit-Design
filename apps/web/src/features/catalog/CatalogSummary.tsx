import { catalogCounts } from "@mtkit-design/catalog";
import { catalogSummaryRows } from "./content";

export function CatalogSummary() {
  return (
    <aside className="catalog-summary" aria-labelledby="catalog-summary-title">
      <div className="summary-heading">
        <span id="catalog-summary-title">Состав MTKit Design</span>
        <code>mtkit_catalog</code>
      </div>
      <dl>
        {catalogSummaryRows.map(([label, count]) => <div key={count}><dt>{label}</dt><dd>{catalogCounts[count]}</dd></div>)}
      </dl>
    </aside>
  );
}
