/**
 * Classify deploy gate failures using accumulated knowledge patterns.
 */
import { readKnowledge } from "./knowledge-io.mjs";

/**
 * @param {string} errorText
 * @param {string[]} [checkIds]
 */
export function classifyFailure(errorText, checkIds = []) {
  const knowledge = readKnowledge();
  const haystack = errorText.toLowerCase();
  const matches = [];

  for (const pattern of knowledge.patterns) {
    const hit = pattern.match.some((m) => haystack.includes(m.toLowerCase()));
    const checkHit = checkIds.some((c) => pattern.checks?.includes(c));
    if (hit || checkHit) {
      matches.push({
        id: pattern.id,
        category: pattern.category,
        diagnosis: pattern.diagnosis,
        suggestedFix: pattern.suggestedFix,
        priorAttempts: pattern.fixAttempts ?? [],
      });
    }
  }

  if (matches.length === 0) {
    matches.push({
      id: "unknown",
      category: "unknown",
      diagnosis: "Unclassified deploy failure — add pattern via apply-result after fix.",
      suggestedFix: "Read Vercel deployment logs and gate output; run npm run deploy-check:result after fix.",
      priorAttempts: [],
    });
  }

  return matches;
}

/**
 * @param {string} errorText
 */
export function suggestChecks(errorText) {
  const knowledge = readKnowledge();
  const classified = classifyFailure(errorText);
  const checkIds = new Set();
  for (const c of classified) {
    const pattern = knowledge.patterns.find((p) => p.id === c.id);
    for (const id of pattern?.checks ?? []) {
      checkIds.add(id);
    }
  }
  if (checkIds.size === 0) {
    for (const def of knowledge.checkDefinitions ?? []) {
      if (def.required) checkIds.add(def.id);
    }
  }
  return [...checkIds];
}
