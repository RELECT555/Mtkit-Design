import { catalogCounts } from "@mtkit-design/catalog";

export function CatalogSummary() {
  return (
    <aside className="catalog-summary" aria-labelledby="catalog-summary-title">
      <div className="summary-heading">
        <span id="catalog-summary-title">Состав MTKit Design</span>
        <code>mtkit_catalog</code>
      </div>
      <dl>
        <div><dt>Навыки в каталоге</dt><dd>{catalogCounts.skills}</dd></div>
        <div><dt>MCP в плагине Codex</dt><dd>{catalogCounts.bundledMcp}</dd></div>
        <div><dt>MCP с отдельным подключением</dt><dd>{catalogCounts.optional}</dd></div>
      </dl>
    </aside>
  );
}
