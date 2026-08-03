export type RuleDefinition = {
  autofixable: boolean;
};

/**
 * Rules in this registry are the only rules DBTLint may offer as automatic
 * fixes. Keep this allowlist deliberately small: a SQLFluff edit is not enough
 * on its own to make a rule safe for one-click application.
 */
export const RULE_DEFINITIONS = {
  LT01: { autofixable: true },
  LT02: { autofixable: true },
  CV03: { autofixable: true },
  CV10: { autofixable: true },
} as const satisfies Record<string, RuleDefinition>;

export function isAutofixableRule(code: string | undefined) {
  if (!code) return false;
  const definition = RULE_DEFINITIONS[
    code.toUpperCase() as keyof typeof RULE_DEFINITIONS
  ] as RuleDefinition | undefined;
  return definition?.autofixable === true;
}
