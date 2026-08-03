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
    start_line_no: z.number().optional(),
    start_line_pos: z.number().optional(),
    sourceLine: z.string().optional(),
    fixes: z
      .array(
        z
          .object({
            type: z.string().optional(),
            edit: z.string().optional(),
            start_line_no: z.number().optional(),
            start_line_pos: z.number().optional(),
            end_line_no: z.number().optional(),
            end_line_pos: z.number().optional(),
          })
          .catchall(z.unknown()),
      )
      .optional(),
    autofixable: z.literal(true).optional(),
    fix: z
      .object({
        oldText: z.string(),
        newText: z.string(),
        range: z.object({
          start: z.object({ line: z.number(), column: z.number() }),
          end: z.object({ line: z.number(), column: z.number() }),
        }),
      })
      .optional(),
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
