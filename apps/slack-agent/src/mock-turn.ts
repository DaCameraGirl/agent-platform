import "dotenv/config";
import { createAgentRuntime } from "@agent-platform/core";
import { createAuditLogger, createPolicyEngine } from "@agent-platform/governance";
import { createDefaultRetriever } from "@agent-platform/rag";
import { createMockJiraTool } from "@agent-platform/tools";

const audit = createAuditLogger({ level: process.env.LOG_LEVEL ?? "info" });
const runtime = createAgentRuntime({
  audit,
  policy: createPolicyEngine(),
  retriever: createDefaultRetriever(),
  tools: [createMockJiraTool()],
  requireConfirmation: true
});

const userId = "local-user";
const channelId = "local-channel";

const first = await runtime.handleTurn({
  userId,
  channelId,
  text: "Please create a Jira ticket for a laptop setup issue for a new hire starting Monday.",
  source: "cli"
});

console.log(`Agent:\n${first.text}\n`);

const second = await runtime.handleTurn({
  userId,
  channelId,
  text: "confirm",
  source: "cli"
});

console.log(`Agent:\n${second.text}`);

