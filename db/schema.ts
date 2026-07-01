import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

type SqlfluffViolationJson = {
  code?: string;
  description?: string;
  line_no?: number;
  line_pos?: number;
  [key: string]: unknown;
};

type LintFileResultJson = {
  filePath: string;
  errors: number;
  warnings: number;
  violations: SqlfluffViolationJson[];
};

type LintCategoryReportJson = {
  folderPath: string | null;
  files: LintFileResultJson[];
  skipped: boolean;
  statusMessage?: string;
};

export type LintReportJson = {
  categories: {
    models: LintCategoryReportJson;
    tests: LintCategoryReportJson;
    macros: LintCategoryReportJson;
  };
  totals: {
    files: number;
    lines: number;
    errors: number;
    warnings: number;
  };
  score: number;
};

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  fullName: text("full_name"),
  avatarUrl: text("avatar_url"),
  stripeCustomerId: text("stripe_customer_id"),
  stripePlan: text("stripe_plan").default("free"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const scans = pgTable(
  "scans",
  {
    id: uuid("id").notNull().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    project: text("project").notNull(),
    scanId: text("scan_id").notNull(),
    scanPath: text("scan_path").notNull(),
    status: text("status").notNull().default("processing"),
    score: integer("score").notNull().default(0),
    errors: integer("errors").notNull().default(0),
    warnings: integer("warnings").notNull().default(0),
    report: jsonb("report").$type<LintReportJson | null>().default(null),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [
    index("scans_user_id_created_at_idx").on(
      table.userId,
      table.createdAt.desc(),
    ),
  ],
);
