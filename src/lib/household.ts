// Household members (competitor-parity #21, Layer 1 — people as labels).
// Members are just names: a spender/earner picker feeds the `spender` field on
// transactions and recurring items, and the Distribution view splits by them.
// "Family Shared" is a built-in pseudo-member (their spreadsheet's default), so
// it's always offered even when the user hasn't added anyone.
export const FAMILY_SHARED = "Family Shared";

/** All pickable member labels: the built-in "Family Shared" first, then the
    user's configured members (trimmed, de-duplicated, blanks dropped). */
export function memberOptions(members: string[]): string[] {
  const out = [FAMILY_SHARED];
  for (const m of members) {
    const t = m.trim();
    if (t && !out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  return out;
}

/** Can this member be removed in Settings? The built-in one can't. */
export function isBuiltInMember(name: string): boolean {
  return name.trim().toLowerCase() === FAMILY_SHARED.toLowerCase();
}
