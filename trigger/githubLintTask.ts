import { schemaTask } from "@trigger.dev/sdk";
import { githubLintPayload } from "@/lib/validation/github";

export const githubLintTask = schemaTask({
  id: "github-lint",
  schema: githubLintPayload,
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1_000,
    maxTimeoutInMs: 10_000,
    factor: 2,
    randomize: true,
  },
  run: async ({ installationId, repoFullName, prNumber, headSha }) => {
    console.log("GitHub lint task dispatched", {
      installationId,
      repoFullName,
      prNumber,
      headSha,
    });

    return { installationId, repoFullName, prNumber, headSha };
  },
});
