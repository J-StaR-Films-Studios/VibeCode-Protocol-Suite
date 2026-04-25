import type { EligibleAccount, RoutingPolicyName } from "./types.ts";

function sortStable(accounts: EligibleAccount[]): EligibleAccount[] {
  return [...accounts].sort((a, b) => {
    if (a.account.createdAt !== b.account.createdAt) return a.account.createdAt - b.account.createdAt;
    return a.account.id.localeCompare(b.account.id);
  });
}

function expandByWeight(accounts: EligibleAccount[]): EligibleAccount[] {
  return sortStable(accounts).flatMap((entry) => Array.from({ length: Math.max(1, entry.account.weight || 1) }, () => entry));
}

export function chooseEligibleAccount(
  policy: RoutingPolicyName,
  eligible: EligibleAccount[],
  cursor: number,
): { selected?: EligibleAccount; nextCursor: number } {
  if (eligible.length === 0) return { selected: undefined, nextCursor: 0 };

  const ordered = policy === "weighted-round-robin" ? expandByWeight(eligible) : sortStable(eligible);
  const index = ((cursor % ordered.length) + ordered.length) % ordered.length;
  return {
    selected: ordered[index],
    nextCursor: (index + 1) % ordered.length,
  };
}
