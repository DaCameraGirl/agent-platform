import { nanoid } from "nanoid";

export type AgentSource = "slack" | "cli" | "api";

export interface AgentTurn {
  userId: string;
  channelId: string;
  threadId?: string;
  text: string;
  source: AgentSource;
}

export interface AgentResponse {
  text: string;
  correlationId: string;
}

export interface RetrievedDocument {
  id: string;
  title: string;
  body: string;
  source: string;
  score: number;
}

export interface Retriever {
  retrieve(query: string, context: AgentTurn): Promise<RetrievedDocument[]>;
}

export interface AuditLogger {
  info(event: string, data: Record<string, unknown>): void;
  warn(event: string, data: Record<string, unknown>): void;
  error(event: string, data: Record<string, unknown>): void;
}

export interface PolicyDecision {
  allowed: boolean;
  reason?: string;
}

export interface PolicyEngine {
  canHandleTurn(turn: AgentTurn): Promise<PolicyDecision>;
  canExecuteTool(toolName: string, input: unknown, turn: AgentTurn): Promise<PolicyDecision>;
}

export interface ToolExecutionResult {
  ok: boolean;
  message: string;
  data?: Record<string, unknown>;
}

export interface AgentTool<TInput = unknown> {
  name: string;
  description: string;
  mutates: boolean;
  match(text: string): boolean;
  draft(text: string, docs: RetrievedDocument[]): Promise<TInput>;
  execute(input: TInput, turn: AgentTurn): Promise<ToolExecutionResult>;
  summarize(input: TInput): string;
}

interface PendingAction {
  tool: AgentTool;
  input: unknown;
  createdAt: number;
}

export interface AgentRuntimeOptions {
  audit: AuditLogger;
  policy: PolicyEngine;
  retriever: Retriever;
  tools: AgentTool[];
  requireConfirmation: boolean;
}

const CONFIRMATION_WINDOW_MS = 10 * 60 * 1000;

export function createAgentRuntime(options: AgentRuntimeOptions) {
  const pendingActions = new Map<string, PendingAction>();

  async function handleTurn(turn: AgentTurn): Promise<AgentResponse> {
    const correlationId = nanoid();
    const trimmedText = turn.text.trim();
    const pendingKey = `${turn.channelId}:${turn.userId}`;

    options.audit.info("agent_turn_received", {
      correlationId,
      source: turn.source,
      userId: turn.userId,
      channelId: turn.channelId
    });

    const turnPolicy = await options.policy.canHandleTurn({ ...turn, text: trimmedText });
    if (!turnPolicy.allowed) {
      options.audit.warn("agent_turn_denied", { correlationId, reason: turnPolicy.reason });
      return {
        correlationId,
        text: `I cannot handle that request: ${turnPolicy.reason ?? "policy denied"}.`
      };
    }

    if (isConfirmation(trimmedText)) {
      return executePendingAction({
        correlationId,
        pendingKey,
        turn: { ...turn, text: trimmedText }
      });
    }

    const docs = await options.retriever.retrieve(trimmedText, turn);
    options.audit.info("rag_retrieval_completed", {
      correlationId,
      documentIds: docs.map((doc) => doc.id)
    });

    const tool = options.tools.find((candidate) => candidate.match(trimmedText));
    if (!tool) {
      return {
        correlationId,
        text: renderAnswer(trimmedText, docs)
      };
    }

    const input = await tool.draft(trimmedText, docs);
    const toolPolicy = await options.policy.canExecuteTool(tool.name, input, turn);
    if (!toolPolicy.allowed) {
      options.audit.warn("tool_draft_denied", {
        correlationId,
        tool: tool.name,
        reason: toolPolicy.reason
      });
      return {
        correlationId,
        text: `I drafted the action, but cannot execute it: ${toolPolicy.reason ?? "policy denied"}.`
      };
    }

    if (tool.mutates && options.requireConfirmation) {
      pendingActions.set(pendingKey, {
        tool,
        input,
        createdAt: Date.now()
      });
      options.audit.info("tool_confirmation_required", { correlationId, tool: tool.name });
      return {
        correlationId,
        text: [
          `I can do that, but I need confirmation before making changes.`,
          "",
          tool.summarize(input),
          "",
          "Reply `confirm` to execute or send a revised request."
        ].join("\n")
      };
    }

    const result = await tool.execute(input, turn);
    options.audit.info("tool_executed", { correlationId, tool: tool.name, ok: result.ok });
    return { correlationId, text: result.message };
  }

  async function executePendingAction(args: {
    correlationId: string;
    pendingKey: string;
    turn: AgentTurn;
  }): Promise<AgentResponse> {
    const pending = pendingActions.get(args.pendingKey);
    if (!pending) {
      return {
        correlationId: args.correlationId,
        text: "I do not have a pending action for you to confirm."
      };
    }

    if (Date.now() - pending.createdAt > CONFIRMATION_WINDOW_MS) {
      pendingActions.delete(args.pendingKey);
      return {
        correlationId: args.correlationId,
        text: "That pending action expired. Please send the request again."
      };
    }

    const policy = await options.policy.canExecuteTool(pending.tool.name, pending.input, args.turn);
    if (!policy.allowed) {
      pendingActions.delete(args.pendingKey);
      return {
        correlationId: args.correlationId,
        text: `I cannot execute that action: ${policy.reason ?? "policy denied"}.`
      };
    }

    const result = await pending.tool.execute(pending.input, args.turn);
    pendingActions.delete(args.pendingKey);
    options.audit.info("confirmed_tool_executed", {
      correlationId: args.correlationId,
      tool: pending.tool.name,
      ok: result.ok
    });

    return {
      correlationId: args.correlationId,
      text: result.message
    };
  }

  return { handleTurn };
}

function isConfirmation(text: string): boolean {
  return /^(confirm|yes|approve)$/i.test(text);
}

function renderAnswer(query: string, docs: RetrievedDocument[]): string {
  if (docs.length === 0) {
    return `I do not have a confident answer for "${query}" yet. I can draft a Jira ticket if this needs follow-up.`;
  }

  const topDocs = docs.slice(0, 3);
  const summary = topDocs
    .map((doc) => `- ${doc.title}: ${doc.body}`)
    .join("\n");
  const citations = topDocs.map((doc) => `[${doc.id}] ${doc.source}`).join("\n");

  return [`Here is what I found:`, "", summary, "", "Sources:", citations].join("\n");
}

