import { Button, Card } from "@mtkit/ui";
import { catalogCounts, getEntry } from "@mtkit-design/catalog";
import { Layout } from "../app/Layout";
import { ConnectPanel } from "../features/connect/ConnectPanel";
import { McpWorkflow } from "../features/home/McpWorkflow";
import "./home.css";

const featured = ["design-screen", "context7", "playwright"].flatMap((id) => {
  const entry = getEntry(id);
  return entry ? [entry] : [];
});

export function HomePage() {
  return (
    <Layout page="home">
      <div className="page-container home-container">
        <section className="hero" aria-labelledby="hero-title">
          <h1 id="hero-title">Навыки и MCP<br />для фронтенда<span>.</span></h1>
          <p className="hero-description">Всё для проектирования, разработки и проверки интерфейсов на React, TypeScript и <code>@mtkit/ui</code>.</p>
          <div className="hero-actions">
            <Button asChild>
              <a className="action action-primary" href="#connect">
                Подключить MCP
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M8 3v10m-4-4 4 4 4-4" />
                </svg>
              </a>
            </Button>
            <Button asChild variant="ghost">
              <a className="action action-outline" href="/catalog/">
                Открыть каталог
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 8h10m-4-4 4 4-4 4" />
                </svg>
              </a>
            </Button>
          </div>
        </section>

        <McpWorkflow />

        <section className="featured" id="included" aria-labelledby="featured-title">
          <div className="section-heading">
            <div>
              <h2 id="featured-title">Что входит в плагин Codex</h2>
              <p>{catalogCounts.bundled - catalogCounts.bundledMcp} навыков <span aria-hidden="true">·</span> {catalogCounts.bundledMcp} MCP-сервера</p>
            </div>
            <a className="inline-link" href="/catalog/">Все инструменты <span aria-hidden="true">→</span></a>
          </div>
          <ul className="featured-grid">
            {featured.map((entry) => (
              <li key={entry.id}>
                <Card className="featured-card">
                  <a className="featured-item" href={`/catalog/?entry=${encodeURIComponent(entry.id)}`}>
                    <span className="type-label">{entry.kind === "skill" ? "Навык" : "MCP"}</span>
                    <h3>{entry.title} <span aria-hidden="true">↗</span></h3>
                    <p>{entry.description}</p>
                  </a>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <ConnectPanel />
    </Layout>
  );
}
