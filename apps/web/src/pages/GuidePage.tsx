import { Button, Card } from "@mtkit/ui";
import { guideExamples, guideIntro, guideTroubleshooting } from "../features/guide/examples";
import { CopyButton } from "../shared/Command";
import "./guide.css";

export function GuidePage() {
  return (
    <div className="page-container guide-page">
      <header className="guide-intro">
        <div>
          <h1>{guideIntro.title}<span>.</span></h1>
          <p>{guideIntro.description}</p>
        </div>
        <Button asChild variant="outline" className="guide-connect">
          <a href="/#connect">{guideIntro.connectLabel} <span aria-hidden="true">↗</span></a>
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
        <h2 id="guide-troubleshooting-title">{guideTroubleshooting.title}</h2>
        <ol>
          {guideTroubleshooting.steps.map((step) => (
            <li key={step[0]}>{step.map((part) => typeof part === "string" ? part : <code key={part.code}>{part.code}</code>)}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
