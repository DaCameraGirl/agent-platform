# Architecture

## Runtime Boundary

The Slack app is only an adapter. It converts Slack events into normalized agent turns and sends agent responses back to Slack. The core runtime owns retrieval, tool selection, confirmation state, and audit logging.

## Agent Flow

```txt
Slack event
  -> normalize user/channel/thread context
  -> governance policy check
  -> retrieve matching docs
  -> decide answer vs. action draft
  -> require confirmation for mutating tools
  -> execute allowed tool
  -> audit every step
```

## RAG

The first retriever is local and deterministic so tests are stable. The package exposes interfaces for adding OpenAI embeddings plus pgvector/Pinecone later without changing the agent runtime.

## Governance

The governance layer is intentionally simple in the MVP:

- deny empty or anonymous requests
- log request metadata and decision metadata
- require confirmation for Jira creates
- keep tool inputs structured for future approval workflows

Future hardening should add tenant-aware document ACLs, PII redaction, retention controls, and SIEM export.

