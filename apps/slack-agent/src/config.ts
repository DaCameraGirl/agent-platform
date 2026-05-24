import { z } from "zod";

const envSchema = z.object({
  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_SIGNING_SECRET: z.string().optional(),
  SLACK_APP_TOKEN: z.string().optional(),
  SLACK_SOCKET_MODE: z
    .string()
    .optional()
    .transform((value) => value !== "false"),
  JIRA_BASE_URL: z.string().url().optional(),
  JIRA_EMAIL: z.string().email().optional(),
  JIRA_API_TOKEN: z.string().optional(),
  JIRA_DEFAULT_PROJECT: z.string().default("IT"),
  LOG_LEVEL: z.string().default("info"),
  AGENT_REQUIRE_CONFIRMATION: z
    .string()
    .optional()
    .transform((value) => value !== "false")
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return envSchema.parse(env);
}

export function requireSlackConfig(config: AppConfig): asserts config is AppConfig & {
  SLACK_BOT_TOKEN: string;
  SLACK_SIGNING_SECRET: string;
  SLACK_APP_TOKEN: string;
} {
  const missing = [
    ["SLACK_BOT_TOKEN", config.SLACK_BOT_TOKEN],
    ["SLACK_SIGNING_SECRET", config.SLACK_SIGNING_SECRET],
    ["SLACK_APP_TOKEN", config.SLACK_APP_TOKEN]
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing Slack configuration: ${missing.join(", ")}`);
  }
}

