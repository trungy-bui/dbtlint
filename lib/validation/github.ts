import z from "zod";

export const githubLintPayload = z.object({
  installationId: z.number().int().positive(),
  repoFullName: z.string().trim().nonempty(),
  prNumber: z.number().int().positive(),
  headSha: z.string().trim().nonempty(),
});

export const githubPullRequestWebhookPayload = z.object({
  action: z.enum(["opened", "synchronize"]),
  installation: z.object({
    id: githubLintPayload.shape.installationId,
  }),
  repository: z.object({
    full_name: githubLintPayload.shape.repoFullName,
  }),
  pull_request: z.object({
    number: githubLintPayload.shape.prNumber,
    head: z.object({
      sha: githubLintPayload.shape.headSha,
    }),
  }),
});

export type GitHubLintPayload = z.infer<typeof githubLintPayload>;
