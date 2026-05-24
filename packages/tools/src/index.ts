import type { AgentTool, AgentTurn, RetrievedDocument, ToolExecutionResult } from "@agent-platform/core";

export interface JiraIssueDraft {
  projectKey: string;
  summary: string;
  description: string;
  issueType: "Task" | "Bug" | "Story";
  priority: "Low" | "Medium" | "High";
}

export interface JiraToolOptions {
  baseUrl?: string;
  email?: string;
  apiToken?: string;
  defaultProjectKey: string;
}

export function createJiraTool(options: JiraToolOptions): AgentTool<JiraIssueDraft> {
  return {
    name: "jira.create_issue",
    description: "Draft and create Jira issues from user requests.",
    mutates: true,
    match: isJiraRequest,
    draft: async (text, docs) => draftJiraIssue(text, docs, options.defaultProjectKey),
    execute: async (input, turn) => executeJiraCreate(input, turn, options),
    summarize: summarizeJiraDraft
  };
}

export function createMockJiraTool(): AgentTool<JiraIssueDraft> {
  return {
    name: "jira.create_issue",
    description: "Mock Jira issue creation for local development.",
    mutates: true,
    match: isJiraRequest,
    draft: async (text, docs) => draftJiraIssue(text, docs, "IT"),
    execute: async (input) => ({
      ok: true,
      message: `Created mock Jira issue IT-123: ${input.summary}`,
      data: { key: "IT-123", input }
    }),
    summarize: summarizeJiraDraft
  };
}

function isJiraRequest(text: string): boolean {
  return /\b(create|open|file|draft)\b.*\b(jira|ticket|issue)\b/i.test(text);
}

function draftJiraIssue(
  text: string,
  docs: RetrievedDocument[],
  defaultProjectKey: string
): JiraIssueDraft {
  const priority = /\b(urgent|blocked|outage|critical|high)\b/i.test(text) ? "High" : "Medium";
  const issueType = /\bbug|broken|error|failed|failure\b/i.test(text) ? "Bug" : "Task";
  const guidance = docs.map((doc) => `- ${doc.title}: ${doc.body}`).join("\n");

  return {
    projectKey: defaultProjectKey,
    summary: normalizeSummary(text),
    issueType,
    priority,
    description: [
      `Requester intent: ${text}`,
      "",
      "Relevant internal guidance:",
      guidance || "- No matching guidance found.",
      "",
      "Acceptance criteria:",
      "- Confirm owner and priority.",
      "- Resolve or route the request.",
      "- Add final notes before closing."
    ].join("\n")
  };
}

function normalizeSummary(text: string): string {
  const cleaned = text
    .replace(/^\s*(please\s+)?(can you|could you|would you)?\s*/i, "")
    .replace(/^(create|open|file|draft)\s+(a\s+)?(jira\s+)?(ticket|issue)\s+(for|about|to)?\s*/i, "")
    .replace(/\s+/g, " ")
    .replace(/[.?!]+$/g, "")
    .trim();

  if (!cleaned) {
    return "Follow up on support request";
  }

  return cleaned.length > 90 ? `${cleaned.slice(0, 87)}...` : cleaned;
}

function summarizeJiraDraft(input: JiraIssueDraft): string {
  return [
    `Jira draft:`,
    `Project: ${input.projectKey}`,
    `Type: ${input.issueType}`,
    `Priority: ${input.priority}`,
    `Summary: ${input.summary}`
  ].join("\n");
}

async function executeJiraCreate(
  input: JiraIssueDraft,
  turn: AgentTurn,
  options: JiraToolOptions
): Promise<ToolExecutionResult> {
  if (!options.baseUrl || !options.email || !options.apiToken) {
    return {
      ok: false,
      message: "Jira credentials are not configured. Add JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN to enable live issue creation."
    };
  }

  const response = await fetch(`${options.baseUrl}/rest/api/3/issue`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${options.email}:${options.apiToken}`).toString("base64")}`,
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      fields: {
        project: { key: input.projectKey },
        summary: input.summary,
        description: toAtlassianDoc(`${input.description}\n\nRequested by: ${turn.userId}`),
        issuetype: { name: input.issueType },
        priority: { name: input.priority }
      }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    return {
      ok: false,
      message: `Jira issue creation failed with ${response.status}: ${body.slice(0, 500)}`
    };
  }

  const payload = (await response.json()) as { key?: string; self?: string };
  return {
    ok: true,
    message: `Created Jira issue ${payload.key ?? "unknown key"}.`,
    data: payload
  };
}

function toAtlassianDoc(text: string) {
  return {
    type: "doc",
    version: 1,
    content: text.split("\n").map((line) => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : []
    }))
  };
}
