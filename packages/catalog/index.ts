export * from "./connection.js";
export { catalogCategories, catalogCounts, catalogEntries, getEntry } from "./entries.js";
export { planInstall, startLocalCatalog } from "./install.js";
export { recommendForTask, type TaskRecommendation } from "./recommend.js";
export { queryCatalog, searchEntries } from "./search.js";
export type { CatalogEntry, CatalogPage, EntryAvailability, EntryKind, InstallPlan, InstallStep, SearchOptions } from "./types.js";
