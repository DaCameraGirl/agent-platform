import type { AgentTurn, RetrievedDocument, Retriever } from "@agent-platform/core";

const defaultDocuments: RetrievedDocument[] = [
  {
    id: "it-onboarding-001",
    title: "New Hire Laptop Setup",
    body: "IT needs the hire name, start date, department, manager, location, and hardware profile before provisioning a laptop.",
    source: "docs/it-onboarding.md",
    score: 0
  },
  {
    id: "jira-support-001",
    title: "Jira Support Ticket Requirements",
    body: "Support tickets should include a short summary, business impact, priority, affected system, requester, and acceptance criteria.",
    source: "docs/jira-support.md",
    score: 0
  },
  {
    id: "governance-001",
    title: "AI Agent Change Control",
    body: "Agents must ask for explicit confirmation before creating tickets, updating systems, sending messages, or changing enterprise records.",
    source: "docs/ai-governance.md",
    score: 0
  },
  {
    id: "salesforce-001",
    title: "Salesforce Update Rules",
    body: "Customer account changes require a source-of-truth reference, field-level validation, and audit logging for every changed value.",
    source: "docs/salesforce-updates.md",
    score: 0
  }
];

export function createDefaultRetriever(documents = defaultDocuments): Retriever {
  return {
    async retrieve(query: string, _context: AgentTurn): Promise<RetrievedDocument[]> {
      const terms = tokenize(query);
      return documents
        .map((doc) => ({
          ...doc,
          score: scoreDocument(terms, `${doc.title} ${doc.body}`)
        }))
        .filter((doc) => doc.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);
    }
  };
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((term) => term.length > 2);
}

function scoreDocument(terms: string[], text: string): number {
  const normalized = text.toLowerCase();
  return terms.reduce((score, term) => score + (normalized.includes(term) ? 1 : 0), 0);
}

