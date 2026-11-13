import { catalogEntries } from "./entries.js";
import type { CatalogPage, SearchOptions } from "./types.js";

const stopWords = new Set([
  "a", "an", "and", "for", "find", "i", "install", "of", "please", "skill", "skills", "the", "to", "with",
  "в", "дайте", "для", "и", "мне", "на", "найди", "навык", "навыки", "нужен", "нужны", "покажи", "по", "под", "скилл", "скиллы", "хочу",
]);

function normalize(text: string) {
  return text.toLowerCase().replaceAll("ё", "е").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function termMatches(word: string, term: string) {
  if (word === term || (term.length >= 3 && word.startsWith(term))) return true;
  return term.length >= 5 && word.length >= 5 && /^[а-я]+$/u.test(term) && word.slice(0, -2).startsWith(term.slice(0, -2));
}

const searchable = catalogEntries.map((entry, index) => ({
  entry,
  index,
  identity: normalize(`${entry.id} ${entry.name} ${entry.title}`),
  tags: normalize(entry.tags.join(" ")).split(" "),
  body: normalize(`${entry.description} ${entry.category} ${entry.kind === "mcp" ? "mcp мсп сервер" : "skill навык"}`).split(" "),
}));

function searchScore(item: typeof searchable[number], query: string, terms: string[]) {
  const exactIdentity = normalize(item.entry.id) === query || normalize(item.entry.name) === query;
  if (exactIdentity) return 100;
  const identityWords = item.identity.split(" ");
  const scores = terms.map(term => {
    if (identityWords.some(word => termMatches(word, term))) return 8;
    if (item.tags.some(word => termMatches(word, term))) return 4;
    return item.body.some(word => termMatches(word, term)) ? 2 : 0;
  });
  const matches = scores.filter(Boolean).length;
  if (matches < Math.ceil(terms.length / 2)) return 0;
  return scores.reduce<number>((sum, score) => sum + score, 0) + matches * 2;
}

export function queryCatalog({ query = "", kind, availability, category: group, limit = 24, offset = 0 }: SearchOptions = {}): CatalogPage {
  const phrase = normalize(query);
  const words = phrase.split(" ").filter(Boolean);
  const keywords = [...new Set(words.filter(word => !stopWords.has(word)))];
  const terms = keywords.length ? keywords : words;
  const start = Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0;
  const count = Number.isFinite(limit) ? Math.min(100, Math.max(0, Math.floor(limit))) : 24;
  const groupName = group && normalize(group);
  const eligible = searchable.filter(({ entry }) =>
    (!kind || entry.kind === kind) &&
    (!availability || entry.availability === availability) &&
    (!group || normalize(entry.category) === groupName),
  );
  const matches = terms.length ? eligible
    .map(item => ({ ...item, score: searchScore(item, phrase, terms) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index) : eligible;
  const entries = matches.slice(start, start + count).map(({ entry }) => entry);
  const end = start + entries.length;
  return { entries, total: matches.length, nextOffset: entries.length > 0 && end < matches.length ? end : null };
}

export function searchEntries(options?: SearchOptions) {
  return queryCatalog(options).entries;
}
