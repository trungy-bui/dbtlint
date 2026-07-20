/**
 * Translates raw sqlfluff violations into plain-language explanations
 * for non-technical users.
 *
 * WHERE TO USE THIS:
 * Call `explainViolation()` wherever you render recommendations
 * (report page, "Recommendations" panel, email digest, etc).
 * Keep the raw `code` + `description` around and put them behind a
 * "Show technical details" toggle for power users — don't delete them.
 *
 * WHY NOT DO THIS IN THE TRIGGER.DEV TASK:
 * Wording will need constant iteration as you learn what confuses users.
 * If you bake it into the lint task, every wording change requires a
 * re-scan. Do it at render/format time instead, using the `code` and
 * `description` you already store in LintReportJson.
 */

export type Severity = "error" | "warning";

export type FriendlyExplanation = {
  /** Short, human title shown as the headline (replaces "LT02") */
  title: string;
  /** 1-2 sentence plain-language explanation of what's wrong */
  explanation: string;
  /** Why the user should care / what could go wrong if ignored */
  impact: string;
  /** The category badge shown in the UI, e.g. "Formatting", "Data risk" */
  category:
    | "Formatting"
    | "Readability"
    | "Data risk"
    | "Performance"
    | "Broken query";
};

type Violation = {
  code?: string;
  description?: string;
};

// Static explanations for well-known rule codes.
// `explanation` can be a string OR a function that extracts dynamic
// details (column names, numbers) from the raw sqlfluff description.
const RULE_EXPLANATIONS: Record<
  string,
  {
    title: string;
    category: FriendlyExplanation["category"];
    explanation: string | ((description: string) => string);
    impact: string;
  }
> = {
  // --- Layout / formatting (cosmetic, safe to auto-fix) ---
  LT01: {
    title: "Extra or missing whitespace",
    category: "Formatting",
    explanation: "There's inconsistent spacing around an operator or comma.",
    impact:
      "Purely cosmetic — doesn't affect results, just makes the code harder to scan.",
  },
  LT02: {
    title: "Inconsistent indentation",
    category: "Formatting",
    explanation: (desc) => {
      const match = desc.match(/(\d+) spaces?/);
      const spaces = match ? match[1] : "the expected number of";
      return `This line isn't indented with ${spaces} spaces like the rest of the file.`;
    },
    impact:
      "Purely cosmetic — doesn't affect results, just makes the code harder to read and review.",
  },
  LT03: {
    title: "Operator is on the wrong line",
    category: "Formatting",
    explanation:
      "An operator is placed before or after a line break differently from the configured style.",
    impact:
      "Purely cosmetic, but consistent operator placement makes expressions easier to scan.",
  },
  LT04: {
    title: "Comma placement is inconsistent",
    category: "Formatting",
    explanation:
      "A comma is leading or trailing differently from the configured style.",
    impact:
      "Purely cosmetic, but consistent comma placement makes lists easier to review.",
  },
  LT05: {
    title: "Line is too long",
    category: "Readability",
    explanation: (desc) => {
      const match = desc.match(/\((\d+)\s*>\s*(\d+)\)/);
      if (match) {
        return `This line has ${match[1]} characters, longer than the recommended ${match[2]}.`;
      }
      return "This line is longer than the recommended limit.";
    },
    impact:
      "Long lines are harder to read in code review and on smaller screens. Doesn't affect how the query runs.",
  },
  LT06: {
    title: "Unexpected space before function parentheses",
    category: "Formatting",
    explanation:
      "A function name should be immediately followed by its opening parenthesis.",
    impact:
      "Purely cosmetic — it keeps function calls consistent and recognizable.",
  },
  LT07: {
    title: "CTE closing bracket is misplaced",
    category: "Formatting",
    explanation: "A CTE's closing bracket isn't on the expected line.",
    impact:
      "Doesn't affect results, but consistent CTE layout makes nested queries easier to follow.",
  },
  LT08: {
    title: "CTE needs a separating line break",
    category: "Formatting",
    explanation:
      "A CTE's closing bracket should be followed by a line break before the next clause.",
    impact:
      "Doesn't affect results, but visually separating CTEs makes long queries easier to navigate.",
  },
  LT09: {
    title: "Query structure could be clearer",
    category: "Readability",
    explanation:
      "The SELECT statement isn't organized in the conventional order (e.g. columns, then FROM, then JOINs).",
    impact:
      "Doesn't change results, but an unconventional structure makes the query harder for teammates to follow.",
  },
  LT10: {
    title: "SELECT modifier is separated from SELECT",
    category: "Formatting",
    explanation:
      "A modifier such as DISTINCT should appear on the same line as SELECT.",
    impact:
      "Doesn't affect results, but keeping the modifier visible with SELECT makes query intent clearer.",
  },
  LT11: {
    title: "Set operator needs its own line",
    category: "Formatting",
    explanation:
      "A set operator such as UNION should be surrounded by line breaks.",
    impact:
      "Doesn't affect results, but it makes the boundary between queries much easier to see.",
  },
  LT12: {
    title: "Missing blank line at end of file",
    category: "Formatting",
    explanation:
      "The file should end with a single blank line, per convention.",
    impact: "Purely cosmetic.",
  },
  CP01: {
    title: "Inconsistent capitalization",
    category: "Formatting",
    explanation: (desc) => {
      const match = desc.match(/'([^']+)'/);
      const word = match ? match[1] : "a keyword";
      return `"${word}" isn't capitalized consistently with the rest of the file (e.g. mixing SELECT and select).`;
    },
    impact:
      "Purely cosmetic, but consistent casing makes SQL much easier to scan quickly.",
  },
  CP02: {
    title: "Identifier capitalization is inconsistent",
    category: "Formatting",
    explanation:
      "A table, column, or alias uses different capitalization from other identifiers.",
    impact:
      "Usually cosmetic, but consistent identifier casing reduces visual ambiguity.",
  },
  CP03: {
    title: "Function capitalization is inconsistent",
    category: "Formatting",
    explanation:
      "A function name uses different capitalization from other functions in the query.",
    impact:
      "Purely cosmetic, but consistent casing makes functions easier to spot.",
  },
  CP04: {
    title: "Literal capitalization is inconsistent",
    category: "Formatting",
    explanation:
      "A boolean or NULL literal uses different capitalization from similar literals.",
    impact:
      "Purely cosmetic, but consistent literal casing makes conditions easier to scan.",
  },
  CP05: {
    title: "Data type capitalization is inconsistent",
    category: "Formatting",
    explanation:
      "A data type uses different capitalization from other data types in the query.",
    impact: "Purely cosmetic, but consistent type names improve readability.",
  },

  // --- References (can cause real bugs) ---
  RF01: {
    title: "Unused reference",
    category: "Data risk",
    explanation:
      "A table, CTE, or alias is defined but never actually used in the query.",
    impact:
      "Dead code that can confuse future editors and may signal a mistake — like a JOIN you meant to use but forgot to reference.",
  },
  RF02: {
    title: "Unclear where a column comes from",
    category: "Data risk",
    explanation: (desc) => {
      const match = desc.match(/'([^']+)'/);
      const col = match ? match[1] : "a column";
      return `The column "${col}" is used without saying which table it comes from — and more than one table in this query has a column with that name.`;
    },
    impact:
      "This is a real risk: if two tables both have a column called the same thing, the database picks one for you, and it might not be the one you intended. Prefix it with the table name (e.g. orders.amount) to be explicit.",
  },
  RF03: {
    title: "Column references are qualified inconsistently",
    category: "Readability",
    explanation:
      "Some column names include their table or alias while others in the same query do not.",
    impact:
      "Inconsistent qualification makes it harder to tell where each column comes from.",
  },
  RF04: {
    title: "Column name could be a reserved word",
    category: "Data risk",
    explanation: (desc) => {
      const match = desc.match(/'([^']+)'/);
      const word = match ? match[1] : "This name";
      return `"${word}" is also a special SQL keyword, which can cause confusing errors depending on the database.`;
    },
    impact:
      "Some databases will fail or behave unexpectedly if you use a reserved word as a column name without quoting it.",
  },

  // --- Aliasing ---
  AL01: {
    title: "Table missing a short alias",
    category: "Readability",
    explanation:
      "A table used in a JOIN doesn't have a short alias (like `o` for `orders`).",
    impact:
      "Makes long queries with multiple joins harder to read, but doesn't change the result.",
  },
  AL02: {
    title: "Column missing a clear alias",
    category: "Readability",
    explanation:
      "A calculated column (like a SUM or CASE statement) doesn't have a name, so it'll show up with an auto-generated, hard-to-read name in the output.",
    impact:
      "Whoever queries this model later will see a confusing column name instead of something meaningful.",
  },
  AL03: {
    title: "Expression missing a clear alias",
    category: "Readability",
    explanation:
      "A calculated expression doesn't have an explicit output name.",
    impact: "Downstream users may see a generated or unclear column name.",
  },
  AL04: {
    title: "Duplicate table alias",
    category: "Data risk",
    explanation: "Two tables in the same query are using the same short alias.",
    impact:
      "This is genuinely ambiguous and can cause the wrong table's data to be pulled in — worth fixing before this ships.",
  },
  AL05: {
    title: "Table alias is never used",
    category: "Readability",
    explanation:
      "A table has an alias, but the query continues to reference it without that alias.",
    impact:
      "The unused alias adds noise and can make table references harder to follow.",
  },

  // --- Structure / convention ---
  ST05: {
    title: "Repeated subquery could be a CTE",
    category: "Readability",
    explanation:
      "The same subquery logic is repeated instead of being pulled into a single, named CTE (a `WITH` block).",
    impact:
      "Doesn't change results, but repeated logic is easy to accidentally edit in only one place later, causing the two copies to drift apart.",
  },
  ST06: {
    title: "Using SELECT * instead of naming columns",
    category: "Performance",
    explanation:
      "The query selects all columns with `*` instead of listing exactly which ones are needed.",
    impact:
      "If someone adds a column to the source table later, this model silently starts pulling in extra data — which can break downstream dashboards or slow things down.",
  },
  ST03: {
    title: "CTE is defined but never used",
    category: "Readability",
    explanation: "A named CTE in the WITH block isn't referenced by the query.",
    impact:
      "Unused query logic adds maintenance cost and may indicate an incomplete change.",
  },
  ST08: {
    title: "DISTINCT is written like a function",
    category: "Readability",
    explanation:
      "Parentheses after DISTINCT can misleadingly make it look like a function call.",
    impact:
      "The query may run, but the syntax obscures that DISTINCT applies to the whole selected row.",
  },

  // --- Execution-time failures (from your own TMP_/PRS_ codes) ---
  TMP_TIMEOUT: {
    title: "Linter timed out on this file",
    category: "Broken query",
    explanation: "This file took too long to analyze and was skipped.",
    impact:
      "We couldn't check this file for issues — it may be unusually large or complex. Try simplifying it or splitting it up.",
  },
  TMP_EXEC_ERROR: {
    title: "Couldn't analyze this file",
    category: "Broken query",
    explanation:
      "Something went wrong while checking this file, so we couldn't produce results for it.",
    impact:
      "This usually means there's a syntax problem or an unusual Jinja template that our linter couldn't process.",
  },
  TMP_FILE_READ_ERROR: {
    title: "File couldn't be read as text",
    category: "Broken query",
    explanation:
      "This file isn't valid UTF-8 text SQL, so it couldn't be opened for checking.",
    impact:
      "Double check this file wasn't corrupted or saved with an unusual encoding.",
  },
};

// Fallback wording by rule-code prefix, used when a specific code
// isn't in the dictionary above (sqlfluff has 150+ rules — this keeps
// unmapped ones from showing raw jargon).
const PREFIX_FALLBACKS: Record<
  string,
  { category: FriendlyExplanation["category"]; impact: string }
> = {
  LT: {
    category: "Formatting",
    impact:
      "This is a style/formatting issue — it doesn't change how your query runs.",
  },
  CP: {
    category: "Formatting",
    impact:
      "This is a style/formatting issue — it doesn't change how your query runs.",
  },
  AL: {
    category: "Readability",
    impact:
      "This makes the query harder to read but doesn't change the result.",
  },
  RF: {
    category: "Data risk",
    impact:
      "This can cause the wrong data to be selected — worth double-checking.",
  },
  ST: {
    category: "Readability",
    impact:
      "This is a structural suggestion to make the query easier to maintain.",
  },
  AM: {
    category: "Data risk",
    impact:
      "This is genuinely ambiguous and could produce an unexpected result.",
  },
  CV: {
    category: "Readability",
    impact: "This is a naming/convention suggestion for consistency.",
  },
  PRS: {
    category: "Broken query",
    impact: "Your SQL has a syntax error and won't run until this is fixed.",
  },
  TMP: {
    category: "Broken query",
    impact: "We couldn't fully process this file — see details below.",
  },
};

/**
 * Converts a raw sqlfluff violation into a plain-language explanation.
 * Always returns something usable, even for rule codes we haven't
 * mapped yet.
 */
export function explainViolation(violation: Violation): FriendlyExplanation {
  const code = violation.code?.toUpperCase() ?? "";
  const rawDescription =
    violation.description ??
    "This part of the query doesn't follow best practices.";

  const known = RULE_EXPLANATIONS[code];
  if (known) {
    return {
      title: known.title,
      explanation:
        typeof known.explanation === "function"
          ? known.explanation(rawDescription)
          : known.explanation,
      impact: known.impact,
      category: known.category,
    };
  }

  // Fallback: use the prefix (letters before the number) to at least
  // get the right category and impact framing, and lightly clean up
  // the raw sqlfluff description as the explanation.
  const prefixMatch = code.match(/^[A-Z]+/);
  const prefix = prefixMatch ? prefixMatch[0] : "";
  const fallback = PREFIX_FALLBACKS[prefix] ?? {
    category: "Readability" as const,
    impact: "This is a code quality suggestion — it won't break your project.",
  };

  return {
    title: cleanupDescriptionAsTitle(rawDescription),
    explanation: rawDescription,
    impact: fallback.impact,
    category: fallback.category,
  };
}

/** Turns a full sqlfluff description into a short title-cased headline. */
function cleanupDescriptionAsTitle(description: string): string {
  const firstSentence = description.split(/[.(]/)[0].trim();
  return firstSentence.length > 60
    ? `${firstSentence.slice(0, 57)}...`
    : firstSentence;
}

/**
 * Groups violations by their friendly title so repeated issues collapse
 * into a single recommendation with an occurrence count — matches the
 * "Recommendations" panel pattern already in your UI.
 */
export function summarizeRecommendations(
  violations: Violation[],
): Array<FriendlyExplanation & { occurrences: number }> {
  const byTitle = new Map<
    string,
    FriendlyExplanation & { occurrences: number }
  >();

  for (const violation of violations) {
    const explained = explainViolation(violation);
    const existing = byTitle.get(explained.title);
    if (existing) {
      existing.occurrences += 1;
    } else {
      byTitle.set(explained.title, { ...explained, occurrences: 1 });
    }
  }

  // Surface data-risk / broken-query issues first — those are the ones
  // that actually matter to a non-technical user, formatting can wait.
  const categoryOrder: FriendlyExplanation["category"][] = [
    "Broken query",
    "Data risk",
    "Performance",
    "Readability",
    "Formatting",
  ];

  return Array.from(byTitle.values()).sort(
    (a, b) =>
      categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category),
  );
}
