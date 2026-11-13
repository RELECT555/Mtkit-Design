import { Button } from "@mtkit/ui";
import type { ReactNode } from "react";
import "./site-navigation.css";

const navigation = {
  home: { href: "/", label: "О плагине", icon: "M3 10.5 12 3l9 7.5V21H3z M9 21v-7h6v7" },
  catalog: { href: "/catalog/", label: "Каталог", icon: "M4 5h16v4H4z M4 11h16v4H4z M4 17h16v3H4z" },
  shaders: { href: "/shaders/", label: "Шейдеры", icon: "M3 7c3-5 6-5 9 0s6 5 9 0 M3 12c3-5 6-5 9 0s6 5 9 0 M3 17c3-5 6-5 9 0s6 5 9 0" },
  components: { href: "/shaders/components/", label: "Компоненты", icon: "M8 3l5 5-5 5-5-5z M15 4h5v5h-5z M4 15h5v5H4z M13 13h7v7h-7z" },
  logo: { href: "/logo/", label: "Логотип", icon: "M12 3 3.5 7.5v9L12 21l8.5-4.5v-9L12 3Z M3.5 7.5 12 12l8.5-4.5 M12 12v9" },
} as const;

export function Layout({ page, children }: { page: keyof typeof navigation; children: ReactNode }) {
  return (
    <div className="site-layout">
      <a className="skip-link" href="#main">К содержанию</a>
      <header className="site-header">
        <div className="site-header-inner">
          <a className="wordmark" href="/" aria-label="MTKit Design, главная">
            <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
            <span>MTKit <strong>Design</strong></span>
          </a>
          <nav aria-label="Основная навигация">
            <ul className="site-nav">
              {Object.entries(navigation).map(([id, { href, label, icon }]) => (
                <li key={id}>
                  <a href={href} aria-current={id === page ? "page" : undefined}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icon} /></svg>
                    {label}
                  </a>
                </li>
              ))}
              <li className="site-nav-connect">
                <Button asChild variant="outline" className="site-connect">
                  <a href="/#connect">Подключить <span aria-hidden="true">↗</span></a>
                </Button>
              </li>
            </ul>
          </nav>
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
