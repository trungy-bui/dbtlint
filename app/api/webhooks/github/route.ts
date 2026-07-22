import { createHmac, timingSafeEqual } from "node:crypto";
import { tasks } from "@trigger.dev/sdk";
import { z } from "zod";
import { githubPullRequestWebhookPayload } from "@/lib/validation/github";
import type { githubLintTask } from "@/trigger/githubLintTask";

const HANDLED_PULL_REQUEST_ACTIONS = new Set(["opened", "synchronize"]);
const webhookAction = z.object({ action: z.string() });

function isValidSignature(
  rawBody: Buffer,
  signature: string | null,
  secret: string | undefined,
) {
  if (!signature || !secret) return false;

  const expectedSignature = `sha256=${createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex")}`;
  const received = Buffer.from(signature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");

  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}

function noOp(reason: string) {
  return Response.json({ ok: true, dispatched: false, reason });
}

export async function POST(request: Request) {
  const rawBody = Buffer.from(await request.arrayBuffer());
  const signature = request.headers.get("x-hub-signature-256");

  if (
    !isValidSignature(rawBody, signature, process.env.GITHUB_WEBHOOK_SECRET)
  ) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = request.headers.get("x-github-event");
  if (event !== "pull_request") return noOp("unhandled_event");

  let payload: unknown;

  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch (error) {
    console.warn("Ignoring malformed GitHub webhook JSON", { error });
    return noOp("malformed_payload");
  }

  const actionResult = webhookAction.safeParse(payload);
  if (!actionResult.success) {
    console.warn("Ignoring GitHub pull request webhook without an action", {
      issues: actionResult.error.issues,
    });
    return noOp("malformed_payload");
  }

  if (!HANDLED_PULL_REQUEST_ACTIONS.has(actionResult.data.action)) {
    return noOp("unhandled_action");
  }

  const payloadResult = githubPullRequestWebhookPayload.safeParse(payload);
  if (!payloadResult.success) {
    console.warn("Ignoring malformed GitHub pull request webhook", {
      issues: payloadResult.error.issues,
    });
    return noOp("malformed_payload");
  }

  const {
    installation,
    repository,
    pull_request: pullRequest,
  } = payloadResult.data;
  const taskPayload = {
    installationId: installation.id,
    repoFullName: repository.full_name,
    prNumber: pullRequest.number,
    headSha: pullRequest.head.sha,
  };

  await tasks.trigger<typeof githubLintTask>("github-lint", taskPayload);

  return Response.json({ ok: true, dispatched: true });
}
