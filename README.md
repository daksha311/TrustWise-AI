# TrustWise-AI
A decentralized escrow protocol that combines GPT-5.6-powered arbitration with cryptographic evidence verification via zkTLS. Users submit mathematically verifiable proofs of web data (delivery status, receipts) instead of fakeable screenshots. Smart contracts hold funds; AI adjudicates disputes fairly, privately, and instantly—no KYC required.

## Backend: /api/dispute/resolve

Endpoint: `POST /api/dispute/resolve`

Request body (JSON) — two supported formats:
- Provide a `proof` object (preferred):
	- `proof` should contain `content`, `url`, `proof_hash`, `notary_signature`, `timestamp`, and `tracking_id` when available.
- Or provide a `trackingNumber` (frontend-only): the backend will generate a deterministic zkTLS proof by fetching the carrier tracking page.

Required fields (when not using `proof` alone):
- `disputeId`, `escrowId`, `buyer`, `seller`, `buyerClaim`, `sellerClaim`, `amount`.

Success response (200):
```
{
	"success": true,
	"dispute_id": "...",
	"escrow_id": "...",
	"action": "release_funds|refund_buyer|split_payment|need_more_evidence",
	"confidence": 85,
	"explanation": "...",
	"reasoning": "...",
	"key_evidence": [...],
	"risk_score": 15,
	"timestamp": "...",
	"usage": { }
}
```

Standardized error format (all non-2xx responses):
```
{
	"success": false,
	"error": {
		"code": "TRACKING_NOT_FOUND|INVALID_REQUEST|TLS_VERIFICATION_FAILED|AI_SERVICE_UNAVAILABLE|INTERNAL_ERROR",
		"message": "Human-readable explanation"
	}
}
```

Common status codes used:
- `200` — success
- `400` — invalid request / missing fields
- `404` — tracking number not found / carrier page unavailable
- `422` — proof verification failed (cryptographic mismatch)
- `503` — AI provider or carrier verifier unavailable
- `500` — internal server error

Architecture notes:
- Flow: trackingNumber → trackingFetcher.generateProof → tlsnotary.verifyProof → buildArbitrationContext → codex.arbitrateDispute → JSON response
- `tlsnotary` performs only deterministic cryptographic verification and returns verified facts + quality scores.
- `codex-real` (arbitration) receives a compact, evidence-only prompt and must return JSON-only responses with a fixed schema.

Logging & middleware:
- Requests are logged (request id, method, route, disputeId, escrowId, response time).
- Centralized error handler ensures consistent JSON error responses.

