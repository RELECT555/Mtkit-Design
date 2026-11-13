import { Button } from "@mtkit/ui";
import type { ReactNode } from "react";
import { navigation, type PageId } from "./navigation";

export function Layout({ page, children }: { page: PageId; children: ReactNode }) {
  return (
    <div className="site-layout">
      <a className="skip-link" href="#main">К содержанию</a>
      <header className="site-header">
        <div className="site-header-inner">
          <a className="wordmark" href="/" aria-label="MTKit Design, главная">
            <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
            <span>MTKit <strong>Design</strong></span>
          </a>
          <nav className="site-navigation" aria-label="Основная навигация">
            <ul className="site-nav">
              {Object.entries(navigation).map(([id, { href, label, icon }]) => (
                <li key={id}>
                  <a href={href} aria-current={id === page ? "page" : undefined}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icon} /></svg>
                    <span>{label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <Button asChild className="site-connect">
            <a href="/#connect">Подключить <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10" /></svg></a>
          </Button>
        </div>
      </header>
      <div className="site-content">
        <main id="main" data-page={page} tabIndex={-1}>{children}</main>
        <footer className="footer">
          <div className="page-container footer-inner">
            <span>MTKit Design <span className="footer-divider">/</span> Medipal</span>
            <a href="/catalog/">Открыть каталог <span aria-hidden="true">→</span></a>
          </div>
        </footer>
      </div>
    </div>
  );
}
