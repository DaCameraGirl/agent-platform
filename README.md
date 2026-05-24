# Agent Platform

Production-shaped starter for enterprise Slack agents that combine RAG, tool calling, Jira automation, and governance logging.

## What This MVP Does

- Runs a Slack Bolt app in Socket Mode.
- Answers questions from a small local document corpus.
- Drafts Jira tickets from Slack requests.
- Requires explicit user confirmation before creating a Jira issue.
- Logs every turn, retrieval, and tool decision with a correlation ID.
- Provides a local mock mode so the agent can be exercised without credentials.

## Quick Start

```bash
npm install
npm run mock
```

For Slack:

```bash
cp .env.example .env
npm run dev:slack
```

Required Slack scopes for the first version:

- `app_mentions:read`
- `chat:write`
- `commands`
- `im:history`
- `im:write`

## Project Layout

```txt
apps/slack-agent/       Slack Bolt adapter and local mock runner
packages/agent-core/    Agent runtime, tool planning, confirmation flow
packages/rag/           Document loading, retrieval interfaces, local retriever
packages/tools/         Jira and SaaS tool adapters
packages/governance/    Policy checks and audit logging
tests/                  Runtime tests
docs/                   Architecture and operating notes
```

## Initial Flow

1. User sends a Slack mention or DM.
2. Agent checks policy and logs the request.
3. Agent retrieves relevant internal docs.
4. Agent either answers with citations or drafts a Jira ticket.
5. Jira creation is blocked until the user confirms with `confirm`.

