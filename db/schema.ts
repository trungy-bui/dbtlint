import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

type SqlfluffViolationJson = {
  code?: string;
  description?: string;
  line_no?: number;
  line_pos?: number;
  start_line_no?: number;
  start_line_pos?: number;
  sourceLine?: string;
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

export type GitHubInstallationRepository = {
  id: number;
  fullName: string;
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(),
    email: text("email").notNull().unique(),
    fullName: text("full_name"),
    avatarUrl: text("avatar_url"),
    plan: text("plan").notNull().default("free"),
    subscriptionStatus: text("subscription_status"),
    subscriptionRenewsAt: timestamp("subscription_renews_at"),
    lemonsqueezyCustomerId: text("lemonsqueezy_customer_id"),
    lemonsqueezySubscriptionId: text("lemonsqueezy_subscription_id"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    check("users_plan_check", sql`${table.plan} in ('free', 'team')`),
  ],
);

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

export const githubPrScans = pgTable(
  "github_pr_scans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    project: text("project").notNull(),
    scanId: text("scan_id").notNull(),
    status: text("status").notNull().default("processing"),
    score: integer("score").notNull().default(0),
    errors: integer("errors").notNull().default(0),
    warnings: integer("warnings").notNull().default(0),
    report: jsonb("report").$type<LintReportJson | null>().default(null),
    repositoryFullName: text("repository_full_name").notNull(),
    prNumber: integer("pr_number").notNull(),
    headSha: text("head_sha").notNull(),
    installationId: text("installation_id").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("github_pr_scans_scan_id_idx").on(table.scanId),
    uniqueIndex("github_pr_scans_repo_pr_head_idx").on(
      table.repositoryFullName,
      table.prNumber,
      table.headSha,
    ),
    index("github_pr_scans_user_id_created_at_idx").on(
      table.userId,
      table.createdAt.desc(),
    ),
  ],
);

export const githubInstallations = pgTable("github_installations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  installationId: text("installation_id").notNull().unique(),
  accountLogin: text("account_login"),
  repositories: jsonb("repositories")
    .$type<GitHubInstallationRepository[]>()
    .notNull()
    .default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").notNull().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // References back to the scans row
    scanId: uuid("scan_id").references(() => scans.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [
    index("notifications_scan_id_created_at_idx").on(
      table.scanId,
      table.createdAt.desc(),
    ),
  ],
);
