import sources from "../catalog/external-skills.json";

/**
 * Whether this server may hand out a skill's files. Authored MTKit skills are ours; an external
 * skill needs a license recorded in external-skills.json. Without one, agents read its
 * instructions through get_skill and install it from the upstream repository.
 */
export function redistributionLicense(id: string): { allowed: boolean; license: string | null } {
  const source = sources.find(item => Object.hasOwn(item.skills, id));
  if (!source) return { allowed: true, license: null };
  return { allowed: typeof source.license === "string", license: source.license ?? null };
}
