import z from "zod";

export const lintPayload = z.object({
  scanId: z.string().nonempty(),
  storageFilePath: z.string().nonempty(),
  dialect: z.string().default("snowflake"),
});

const sqlfluffViolation = z
  .object({
    code: z.string().optional(),
    description: z.string().optional(),
    line_no: z.number().optional(),
    line_pos: z.number().optional(),
  })
  .catchall(z.unknown());

const lintFileResult = z.object({
  filePath: z.string(),
  errors: z.number().int().min(0),
  warnings: z.number().int().min(0),
  violations: z.array(sqlfluffViolation),
});

const lintCategoryReport = z.object({
  folderPath: z.string().nullable(),
  files: z.array(lintFileResult),
  skipped: z.boolean(),
  statusMessage: z.string().optional(),
});

const lintReport = z.object({
  categories: z.object({
    models: lintCategoryReport,
    tests: lintCategoryReport,
    macros: lintCategoryReport,
  }),
  totals: z.object({
    files: z.number().int().min(0),
    lines: z.number().int().min(0),
    errors: z.number().int().min(0),
    warnings: z.number().int().min(0),
  }),
  score: z.number().int().min(0).max(100),
});

export const lintMetadata = z.object({
  statusMessage: z.string().nonempty(),
  status: z.enum(["PROCESSING", "PASSED", "FAILED"]).default("PROCESSING"),
  progress: z.number().min(0),
  report: lintReport.optional(),
});

export type LintPayload = z.infer<typeof lintPayload>;
export type LintMetadata = z.infer<typeof lintMetadata>;
