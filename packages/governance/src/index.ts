import pino from "pino";
import type { AgentTurn, PolicyDecision, PolicyEngine } from "@agent-platform/core";

export function createAuditLogger(options: { level: string }) {
  const logger = pino({
    level: options.level,
    redact: {
      paths: ["*.apiToken", "*.authorization", "*.password"],
      censor: "[redacted]"
    }
  });

  return {
    info(event: string, data: Record<string, unknown>) {
      logger.info(data, event);
    },
    warn(event: string, data: Record<string, unknown>) {
      logger.warn(data, event);
    },
    error(event: string, data: Record<string, unknown>) {
      logger.error(data, event);
    }
  };
}

export function createPolicyEngine(): PolicyEngine {
  return {
    async canHandleTurn(turn: AgentTurn): Promise<PolicyDecision> {
      if (!turn.userId || turn.userId === "unknown") {
        return { allowed: false, reason: "missing user identity" };
      }

      if (!turn.text.trim()) {
        return { allowed: false, reason: "empty request" };
      }

      return { allowed: true };
    },

    async canExecuteTool(toolName: string): Promise<PolicyDecision> {
      if (!toolName.trim()) {
        return { allowed: false, reason: "missing tool name" };
      }

      return { allowed: true };
    }
  };
}

