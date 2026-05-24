import "dotenv/config";
import { App } from "@slack/bolt";
import { createAgentRuntime } from "@agent-platform/core";
import { createAuditLogger, createPolicyEngine } from "@agent-platform/governance";
import { createDefaultRetriever } from "@agent-platform/rag";
import { createJiraTool } from "@agent-platform/tools";
import { loadConfig, requireSlackConfig } from "./config.js";

const config = loadConfig();
requireSlackConfig(config);

const audit = createAuditLogger({ level: config.LOG_LEVEL });
const runtime = createAgentRuntime({
  audit,
  policy: createPolicyEngine(),
  retriever: createDefaultRetriever(),
  tools: [
    createJiraTool({
      baseUrl: config.JIRA_BASE_URL,
      email: config.JIRA_EMAIL,
      apiToken: config.JIRA_API_TOKEN,
      defaultProjectKey: config.JIRA_DEFAULT_PROJECT
    })
  ],
  requireConfirmation: config.AGENT_REQUIRE_CONFIRMATION
});

const app = new App({
  token: config.SLACK_BOT_TOKEN,
  signingSecret: config.SLACK_SIGNING_SECRET,
  appToken: config.SLACK_APP_TOKEN,
  socketMode: config.SLACK_SOCKET_MODE
});

app.message(async ({ message, say }) => {
  if (!("text" in message) || !message.text || !("user" in message) || !message.user) {
    return;
  }

  const response = await runtime.handleTurn({
    userId: message.user,
    channelId: "channel" in message ? message.channel : "unknown",
    threadId: "thread_ts" in message ? message.thread_ts : undefined,
    text: message.text,
    source: "slack"
  });

  await say({
    text: response.text,
    thread_ts: "thread_ts" in message ? message.thread_ts : undefined
  });
});

app.event("app_mention", async ({ event, say }) => {
  if (!event.user || !event.text) {
    return;
  }

  const response = await runtime.handleTurn({
    userId: event.user,
    channelId: event.channel,
    threadId: event.thread_ts,
    text: event.text,
    source: "slack"
  });

  await say({ text: response.text, thread_ts: event.thread_ts });
});

await app.start();
audit.info("slack_agent_started", { socketMode: config.SLACK_SOCKET_MODE });
