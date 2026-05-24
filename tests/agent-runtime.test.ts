import { describe, expect, it } from "vitest";
import { createAgentRuntime } from "@agent-platform/core";
import { createPolicyEngine } from "@agent-platform/governance";
import { createDefaultRetriever } from "@agent-platform/rag";
import { createMockJiraTool } from "@agent-platform/tools";

const audit = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined
};

describe("agent runtime", () => {
  it("answers from retrieved documents", async () => {
    const runtime = createAgentRuntime({
      audit,
      policy: createPolicyEngine(),
      retriever: createDefaultRetriever(),
      tools: [createMockJiraTool()],
      requireConfirmation: true
    });

    const response = await runtime.handleTurn({
      userId: "U1",
      channelId: "C1",
      text: "What is needed for new hire laptop setup?",
      source: "cli"
    });

    expect(response.text).toContain("New Hire Laptop Setup");
    expect(response.text).toContain("Sources:");
  });

  it("requires confirmation before creating Jira tickets", async () => {
    const runtime = createAgentRuntime({
      audit,
      policy: createPolicyEngine(),
      retriever: createDefaultRetriever(),
      tools: [createMockJiraTool()],
      requireConfirmation: true
    });

    const draft = await runtime.handleTurn({
      userId: "U1",
      channelId: "C1",
      text: "Create a Jira ticket for laptop setup",
      source: "cli"
    });

    expect(draft.text).toContain("Reply `confirm`");

    const confirmed = await runtime.handleTurn({
      userId: "U1",
      channelId: "C1",
      text: "confirm",
      source: "cli"
    });

    expect(confirmed.text).toContain("Created mock Jira issue IT-123");
  });
});

