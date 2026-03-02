export interface ReviewItem {
  reviewId: string;
  agentId: string;
  nodeId: string;
  agentName: string;
  nodeLabel: string;
  createdAt: string;
  status: "pending" | "reviewed" | "dismissed";
  notes?: string;
  input?: string;
  output?: string;
}

export const DEMO_REVIEW_ITEMS: ReviewItem[] = [
  {
    reviewId: "r1",
    agentId: "agent-sales-001",
    nodeId: "node-sentiment-check",
    agentName: "Sales Call Analyser",
    nodeLabel: "Sentiment Check",
    createdAt: "2026-02-23T09:14:00",
    status: "pending",
    notes: "Sentiment score below threshold — needs human review",
    input: "Q4 call transcript with Acme Corp...",
    output:
      "The call showed signs of customer frustration in the final 10 minutes. Sentiment score: 0.31.",
  },
  {
    reviewId: "r2",
    agentId: "agent-support-001",
    nodeId: "node-pii-detection",
    agentName: "Support Triage",
    nodeLabel: "PII Detection",
    createdAt: "2026-02-23T08:47:00",
    status: "pending",
    notes: "Possible PII detected in output before sending to Slack",
    input: 'Customer message: "My card ending in 4821..."',
    output: "Flagged: potential credit card number detected in message body.",
  },
  {
    reviewId: "r3",
    agentId: "agent-onboarding-001",
    nodeId: "node-quality-check",
    agentName: "Onboarding Assistant",
    nodeLabel: "Quality Check",
    createdAt: "2026-02-22T16:30:00",
    status: "pending",
    notes: "LLM judge score below threshold",
    input: "Draft welcome email for new enterprise customer...",
    output:
      "Response did not meet quality criteria. Missing key onboarding steps.",
  },
  {
    reviewId: "r4",
    agentId: "agent-sales-001",
    nodeId: "node-toxicity-check",
    agentName: "Sales Call Analyser",
    nodeLabel: "Toxicity Check",
    createdAt: "2026-02-22T11:05:00",
    status: "reviewed",
    notes: "Flagged language in call summary",
    input: "Call summary from SDR pipeline...",
    output: "Elevated toxicity score detected: 0.74. Review recommended.",
  },
];
