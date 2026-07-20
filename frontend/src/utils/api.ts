const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

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

export interface AIVerdictResponse {
  action: "release" | "refund";
  decision: string;
  confidence: string;
  reasoning: string;
  evidence: string[];
  riskScore: number | string;
}

export async function resolveDisputeAPI(payload: DisputePayload): Promise<AIVerdictResponse> {
  const response = await fetch(`${BACKEND_BASE_URL}/api/dispute/resolve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to contact AI Arbitration Backend.");
  }

  return response.json();
}