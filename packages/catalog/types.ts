import type { ProjectClient, ProjectConfiguration } from "./connection.js";

export type EntryKind = "skill" | "mcp";
export type EntryAvailability = "bundled" | "optional";

export interface CatalogEntry {
  id: string;
  kind: EntryKind;
  availability: EntryAvailability;
  name: string;
  title: string;
  description: string;
  category: string;
  tags: readonly string[];
  sourceUrl?: string;
  sourcePath?: string;
  prerequisites: readonly string[];
  access: string;
  revision?: string;
}

export interface SearchOptions {
  query?: string;
  kind?: EntryKind;
  availability?: EntryAvailability;
  category?: string;
  limit?: number;
  offset?: number;
}

export interface CatalogPage {
  entries: CatalogEntry[];
  total: number;
  nextOffset: number | null;
}

export interface InstallStep {
  command: string;
  args: readonly string[];
  cwd?: string;
}

export interface SkillCopy {
  from: string;
  to: string;
}

interface InstallPlanDetails {
  entryId: string;
  availability: EntryAvailability;
  steps: readonly InstallStep[];
  prerequisites: readonly string[];
  verification: string;
}


export interface CodexInstallPlan extends InstallPlanDetails, InstallStep {
  client: "codex";
  scope: "user";
  bundledSteps?: readonly InstallStep[];
}

export type InstallPlan = CodexInstallPlan | (InstallPlanDetails & {
  client: ProjectClient;
  scope: "project";
} & ({ configuration: ProjectConfiguration } | { copySkill: SkillCopy; companionSkills?: readonly SkillCopy[] }));
