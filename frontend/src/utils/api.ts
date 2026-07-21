const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

export interface DisputePayload {
  trackingNumber: string;
  disputeId: string;
  escrowId: string;
  buyer: string;
  seller: string;
  buyerClaim: string;
  sellerClaim: string;
  amount: string;
}

/** Normalized frontend verdict used by DisputeView + MetaMask settlement */
export interface AIVerdictResponse {
  action: "release" | "refund" | "split" | "need_more_evidence";
  decision: string;
  confidence: string;
  reasoning: string;
  evidence: string[];
  riskScore: number | string;
  rawAction: string;
}

/** Backend returns release_funds | refund_buyer | split_payment | need_more_evidence */
type BackendAction = string;

function mapBackendAction(action: BackendAction): AIVerdictResponse["action"] {
  switch (action) {
    case "release_funds":
    case "release":
    case "RELEASE":
      return "release";
    case "refund_buyer":
    case "refund":
    case "REFUND":
      return "refund";
    case "split_payment":
    case "split":
      return "split";
    default:
      return "need_more_evidence";
  }
}

function decisionLabel(action: AIVerdictResponse["action"]): string {
  switch (action) {
    case "release":
      return "RELEASE — Funds to Seller";
    case "refund":
      return "REFUND — Funds to Buyer";
    case "split":
      return "SPLIT — Partial Settlement";
    default:
      return "NEED MORE EVIDENCE";
  }
}

function normalizeVerdict(raw: Record<string, unknown>): AIVerdictResponse {
  const rawAction = String(raw.action ?? "");
  const action = mapBackendAction(rawAction);
  const confidence = raw.confidence;
  const riskScore = raw.risk_score ?? raw.riskScore ?? 0;
  const evidence = (raw.key_evidence ?? raw.evidence ?? []) as string[];
  const reasoning = String(raw.reasoning ?? raw.explanation ?? "");

  return {
    action,
    rawAction,
    decision: decisionLabel(action),
    confidence: typeof confidence === "number" ? `${confidence}%` : String(confidence ?? "—"),
    reasoning,
    evidence: Array.isArray(evidence) ? evidence : [],
    riskScore: riskScore as number | string,
  };
}

export async function resolveDisputeAPI(payload: DisputePayload): Promise<AIVerdictResponse> {
  const response = await fetch(`${BACKEND_BASE_URL}/api/dispute/resolve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.success === false) {
    const message =
      data?.error?.message || data?.message || "Failed to contact AI Arbitration Backend.";
    throw new Error(message);
  }

  return normalizeVerdict(data);
}
