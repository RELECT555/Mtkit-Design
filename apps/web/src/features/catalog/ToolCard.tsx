import { Button, Card, CardHeader, CardTitle } from "@mtkit/ui";
import type { CatalogEntry } from "@mtkit-design/catalog";
import type { MouseEventHandler } from "react";
import { availabilityLabel, kindLabel } from "./labels";

export function ToolCard({ entry, open }: { entry: CatalogEntry; open: MouseEventHandler<HTMLButtonElement> }) {
  return (
    <article className="tool" data-availability={entry.availability}>
      <Card>
        <CardHeader>
          <div className="tool-labels">
            <span className={`type-label type-${entry.kind}`}>{kindLabel[entry.kind]}</span>
            <span className={`availability availability-${entry.availability}`}>{availabilityLabel[entry.availability]}</span>
          </div>
          <CardTitle><h3>{entry.title}</h3></CardTitle>
        </CardHeader>
        <div className="tool-body">
          <p>{entry.description}</p>
          <span className="tool-category">{entry.category}</span>
        </div>
        <div className="tool-actions">
          <Button type="button" aria-label={`Подробнее: ${entry.title}`} onClick={open}>Подробнее <span aria-hidden="true">→</span></Button>
          {entry.sourceUrl && <a className="source-link" aria-label={`Источник: ${entry.title}`} href={entry.sourceUrl} target="_blank" rel="noreferrer">Источник <span aria-hidden="true">↗</span></a>}
        </div>
      </Card>
    </article>
  );
}
