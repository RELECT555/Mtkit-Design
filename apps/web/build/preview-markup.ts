export function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function loadingStatus(label: string) {
  return `<p class="sr-only" role="status">${escapeHtml(label)}</p>
    <p class="loading-retry" hidden>Загрузка занимает больше времени, чем обычно. <a href="">Попробовать снова</a></p>
    <noscript>Для работы страницы включите JavaScript.</noscript>`;
}

export function previewIcon(path: string, className = "", size = 24) {
  return `<svg class="${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"></path></svg>`;
}
