import { Button, Card } from "@mtkit/ui";
import { Layout } from "../app/Layout";
import { guideExamples } from "../features/guide/examples";
import { CopyButton } from "../shared/Command";
import "./guide.css";

export function GuidePage() {
  return (
    <Layout page="guide">
      <div className="page-container guide-page">
        <header className="guide-intro">
          <div>
            <h1>Как работать с MTKit Design<span>.</span></h1>
            <p>Опишите задачу обычными словами. MTKit Catalog подберёт навыки и MCP, а агент применит те, что ему доступны.</p>
          </div>
          <Button asChild variant="outline" className="guide-connect">
            <a href="/#connect">Подключить агента <span aria-hidden="true">↗</span></a>
          </Button>
        </header>

        <nav className="guide-jump" aria-label="Сценарии">
          <ul>
            {guideExamples.map(({ id, title }) => <li key={id}><a href={`#${id}`}>{title}</a></li>)}
            <li><a href="#troubleshooting">Диагностика</a></li>
          </ul>
        </nav>

        <div className="guide-examples">
          {guideExamples.map(({ id, title, description, prompt, links }) => (
            <section id={id} key={id} aria-labelledby={`${id}-title`}>
              <Card className="guide-example">
                <header className="guide-example-heading">
                  <h2 id={`${id}-title`}>{title}</h2>
                  <p>{description}</p>
                </header>
                <blockquote className="guide-prompt">{prompt}</blockquote>
                <div className="guide-actions">
                  <CopyButton value={prompt} label={`Копировать промпт «${title}»`} />
                  {links?.map(({ href, label }) => <a key={href} className="inline-link" href={href}>{label} <span aria-hidden="true">↗</span></a>)}
                </div>
              </Card>
            </section>
          ))}
        </div>

        <section id="troubleshooting" className="guide-troubleshooting" aria-labelledby="guide-troubleshooting-title">
          <h2 id="guide-troubleshooting-title">Если агент не обратился к каталогу</h2>
          <ol>
            <li>Добавьте к задаче «Используй MTKit Design». В истории инструментов ищите ответ <code>recommend_tools</code> с рекомендациями.</li>
            <li>Если ответа нет, проверьте подключение MCP и откройте новый чат. Попросите каталог показать категории через <code>list_categories</code>.</li>
            <li>Для командного адреса проверьте доступ через корпоративную сеть или VPN и наличие <code>MTKIT_MCP_TOKEN</code> в окружении клиента.</li>
            <li>Если каталог отвечает, а навык или браузер недоступен, запросите план подключения. В Codex основной набор доступен через плагин.</li>
          </ol>
        </section>
      </div>
    </Layout>
  );
}
