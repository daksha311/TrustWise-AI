/**
 * TrustWise AI - Single GPT-5.6 Arbitration Agent
 * 
 * Architecture:
 * - All deterministic work (zkTLS verification, evidence extraction, contract validation) is done in the backend
 * - GPT-5.6 is called ONLY ONCE for final arbitration reasoning
 * - No multi-agent pipeline
 * - No Luna, No Terra
 * - Only gpt-5.6-sol
 * 
 * API: GitHub Models Chat Completions API
 * Model: Configurable via GITHUB_MODEL (default: openai/gpt-5)
 */

require('dotenv').config();

const { OpenAI } = require('openai');
const crypto = require('crypto');
const logger = require('../utils/logger');

class CodexArbitrationService {
  constructor() {
    this.apiKey = process.env.GITHUB_TOKEN;
    this.apiUrl = 'https://models.inference.ai.azure.com';
    
    // (1) Handle unprefixed model name configurations safely
    const rawModel = process.env.GITHUB_MODEL || 'gpt-4o';
    this.modelName = rawModel.includes('/') ? rawModel.split('/').pop() : rawModel;
    
    this.totalCalls = 0;
    this.totalTokens = 0;
    this.usageLog = [];
    this.cache = new Map();
    this.pendingRequests = new Map();
    this.CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
    this.MAX_PROMPT_SIZE = 25000; // characters
    this.MAX_RETRIES = 2;
    this.RETRY_DELAY_MS = 1000;
    
    // (2) Execute interval cache cleaning safely using unref() to prevent hanging tests
    this.cacheCleanupInterval = setInterval(() => this.cleanCache(), 5 * 60 * 1000);
    this.cacheCleanupInterval.unref();
    
    // Validate API key; if missing, enable mockMode for local development / token-bypass
    this.mockMode = false;
    try {
      this.validateApiKey();
      this.client = new OpenAI({ apiKey: this.apiKey, baseURL: this.apiUrl });
    } catch (e) {
      // Enable mock mode rather than throwing so the server can run without a token
      this.mockMode = true;
      logger.warn('⚠️ GITHUB_TOKEN missing or invalid: running Codex arbitration in mock mode (token-bypass enabled)');
      this.client = null;
    }
  }

  /**
   * Validate API key on startup
   */
  validateApiKey() {
    if (!this.apiKey || this.apiKey === '' || this.apiKey.includes('your-')) {
      throw new Error('❌ GITHUB_TOKEN is missing or invalid.');
    }
    logger.info('🔑 GitHub Models API Token: ✅ Configured');
    logger.info(`📡 API Endpoint: ${this.apiUrl}`);
    logger.info(`🤖 Model: ${this.modelName} (single arbitration agent via GitHub Models)`);
    logger.info(`⏱️ Cache TTL: ${this.CACHE_TTL_MS / 1000 / 60} minutes`);
    logger.info(`🔄 Max retries: ${this.MAX_RETRIES} with exponential backoff`);
  }

  /**
   * Normalize object by sorting keys for consistent hashing
   */
  normalizeObject(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.normalizeObject(item));
    }
    const sorted = {};
    Object.keys(obj).sort().forEach(key => {
      sorted[key] = this.normalizeObject(obj[key]);
    });
    return sorted;
  }

  /**
   * Generate cache key for a request
   */
  generateCacheKey(verifiedEvidence, buyerClaim, sellerClaim, escrowContext) {
    const data = JSON.stringify({
      evidence: this.normalizeObject(verifiedEvidence),
      buyer: this.normalizeObject(buyerClaim),
      seller: this.normalizeObject(sellerClaim),
      context: this.normalizeObject(escrowContext)
    });
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Clean expired cache entries (called periodically, not on every request)
   */
  cleanCache() {
    const now = Date.now();
    let expiredCount = 0;
    for (const [key, entry] of this.cache) {
      if (now - entry.createdAt > this.CACHE_TTL_MS) {
        this.cache.delete(key);
        expiredCount++;
      }
    }
    if (expiredCount > 0) {
      logger.info(`🧹 Cache cleaned: ${expiredCount} expired entries removed (${this.cache.size} remaining)`);
    }
  }

  /**
   * Log API usage (ONLY called from callArbitrationAPI to avoid double counting)
   */
  logUsage(model, promptLength, evidenceSize, responseLength, tokens, elapsedMs, cached = false, retries = 0) {
    this.totalCalls++;
    this.totalTokens += tokens || 0;
    
    this.usageLog.push({
      model,
      timestamp: new Date().toISOString(),
      prompt_length: promptLength,
      evidence_size: evidenceSize,
      response_length: responseLength,
      tokens_used: tokens || 0,
      elapsed_ms: elapsedMs,
      cumulative_tokens: this.totalTokens,
      total_calls: this.totalCalls,
      cached: cached,
      retries: retries
    });

    logger.info(`📊 Codex Usage: ${model} | Tokens: ${tokens || '?'} | Total: ${this.totalTokens} | Calls: ${this.totalCalls} | ${cached ? '💾 CACHED' : '🌐 API'} | Retries: ${retries}`);
  }

  /**
   * Get usage statistics
   */
  getUsageStats() {
    return {
      total_calls: this.totalCalls,
      total_tokens: this.totalTokens,
      call_log: this.usageLog.slice(-20),
      cache_size: this.cache.size,
      pending_requests: this.pendingRequests.size,
      cache_ttl_minutes: this.CACHE_TTL_MS / 1000 / 60
    };
  }

  /**
   * Clear cache (fixed naming collision to prevent stack overflows during testing)
   */
  resetCache() {
    this.cache.clear();
    logger.info('🧹 Cache cleared');
  }

  /**
   * Validate inputs before calling GPT
   */
  validateInputs(verifiedEvidence, buyerClaim, sellerClaim, escrowContext) {
    const inputs = [
      { name: 'verifiedEvidence', value: verifiedEvidence },
      { name: 'buyerClaim', value: buyerClaim },
      { name: 'sellerClaim', value: sellerClaim },
      { name: 'escrowContext', value: escrowContext }
    ];
    
    for (const { name, value } of inputs) {
      if (!value || typeof value !== 'object') {
        throw new Error(`${name} is required and must be an object`);
      }
      if (Object.keys(value).length === 0) {
        throw new Error(`${name} cannot be empty`);
      }
    }
    
    if (!verifiedEvidence.delivery_status) {
      logger.warn('⚠️ Verified evidence missing delivery_status');
    }
    if (!escrowContext.escrow_id) {
      logger.warn('⚠️ Escrow context missing escrow_id');
    }
    
    return true;
  }

  /**
   * Build system prompt section
   */
  buildSystemPrompt() {
    return `You are the arbitration engine for TrustWise AI.

  ## ⚠️ CRITICAL RULES:
  - Use ONLY the verified evidence provided in the "Verified Evidence" section. Do NOT consult external sources, APIs, or unstated knowledge.
  - Facts from zkTLS are absolute.
  - If user claims conflict with verified evidence, ALWAYS prefer verified evidence.
  - Claims are allegations. Never infer missing facts.
  - Never speculate. Evidence has priority over all claims.
  - Never contradict verified evidence.
  - Never invent facts.
  - If both parties lack sufficient evidence, return "need_more_evidence".
  - Return valid JSON only. No markdown, no extra text.
  - Confidence MUST be an integer between 0-100. Never output decimals.

  ## 🎯 Action Mapping:
  - release_funds → Funds go to seller
  - refund_buyer → Funds returned to buyer
  - split_payment → Funds split 50/50
  - need_more_evidence → Insufficient evidence, request additional proof

  ## 📊 Confidence Scale (integer 0-100):
  - 90-100: Evidence is clear and unambiguous
  - 70-89: Evidence is strong but with minor ambiguity
  - 50-69: Evidence is mixed or unclear
  - Below 50: Evidence is weak or insufficient`;
  }

  /**
   * Build evidence section (only essential fields, no raw proof)
   */
  buildEvidenceSection(verifiedEvidence) {
    const essential = {
      delivery_status: verifiedEvidence.delivery_status || 'unknown',
      tracking_id: verifiedEvidence.tracking_id || 'N/A',
      delivery_date: verifiedEvidence.delivery_date || null,
      proof_hash: verifiedEvidence.proof_hash ? verifiedEvidence.proof_hash.substring(0, 20) + '...' : 'N/A',
      verified: verifiedEvidence.zktls_verified || false,
      domain: verifiedEvidence.source || 'unknown',
      quality_score: verifiedEvidence.confidence_indicators?.quality_score || 50
    };
    
    return `## 🔐 Verified Evidence (zkTLS - Cryptographic Proof):
${JSON.stringify(essential, null, 2)}`;
  }

  /**
   * Build claims section (minimal, only what GPT needs)
   */
  buildClaimsSection(buyerClaim, sellerClaim) {
    const buyerEssential = {
      claim: buyerClaim.claim || 'No claim provided'
    };
    
    const sellerEssential = {
      claim: sellerClaim.claim || 'No claim provided',
      tracking: sellerClaim.tracking || 'N/A'
    };
    
    return `## 🛒 Buyer's Claim:
${JSON.stringify(buyerEssential, null, 2)}

## 📦 Seller's Claim:
${JSON.stringify(sellerEssential, null, 2)}`;
  }

  /**
   * Build escrow context section (minimal)
   */
  buildEscrowSection(escrowContext) {
    const essential = {
      escrow_id: escrowContext.escrow_id || 'N/A',
      amount: escrowContext.amount || '0 ETH'
    };
    
    return `## 📋 Escrow Context:
${JSON.stringify(essential, null, 2)}`;
  }

  /**
   * Build output schema section
   */
  buildOutputSchema() {
    return `## 📤 Output Format (ONLY JSON - NO MARKDOWN):
{
  "action": "release_funds" | "refund_buyer" | "split_payment" | "need_more_evidence",
  "confidence": 85,
  "reasoning": "Step-by-step reasoning of how you reached this conclusion (minimum 30 characters)",
  "explanation": "Clear 1-2 sentence explanation of the decision",
  "key_evidence": ["The zkTLS proof confirms delivery", "Tracking number matches escrow"],
  "risk_score": 15
}`;
  }

  /**
   * Build the complete arbitration prompt
   */
  buildArbitrationPrompt(verifiedEvidence, buyerClaim, sellerClaim, escrowContext) {
    const sections = [
      this.buildSystemPrompt(),
      '',
      this.buildEvidenceSection(verifiedEvidence),
      '',
      this.buildClaimsSection(buyerClaim, sellerClaim),
      '',
      this.buildEscrowSection(escrowContext),
      '',
      this.buildOutputSchema()
    ];
    
    return sections.join('\n');
  }

  /**
   * Extract JSON from response using indexOf (more reliable than regex)
   */
  extractJSON(text) {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error('No valid JSON object found in response');
    }
    
    return text.substring(firstBrace, lastBrace + 1);
  }

  /**
   * Parse and validate the arbitration response
   */
  validateResponse(parsed) {
    const required = ['action', 'confidence', 'reasoning', 'explanation', 'key_evidence', 'risk_score'];
    const missing = required.filter(field => parsed[field] === undefined);
    
    if (missing.length > 0) {
      throw new Error(`Invalid arbitration response: missing ${missing.join(', ')}`);
    }

    const validActions = ['release_funds', 'refund_buyer', 'split_payment', 'need_more_evidence'];
    if (!validActions.includes(parsed.action)) {
      throw new Error(`Invalid action: ${parsed.action}. Must be one of: ${validActions.join(', ')}`);
    }

    if (!Number.isFinite(parsed.confidence) || parsed.confidence < 0 || parsed.confidence > 100) {
      throw new Error(`Confidence must be an integer between 0-100. Got: ${parsed.confidence}`);
    }
    if (!Number.isInteger(parsed.confidence)) {
      parsed.confidence = Math.round(parsed.confidence);
      logger.info(`📊 Rounded confidence to integer: ${parsed.confidence}`);
    }

    if (!Number.isFinite(parsed.risk_score) || parsed.risk_score < 0 || parsed.risk_score > 100) {
      throw new Error(`Risk score must be an integer between 0-100. Got: ${parsed.risk_score}`);
    }
    if (!Number.isInteger(parsed.risk_score)) {
      parsed.risk_score = Math.round(parsed.risk_score);
    }

    if (typeof parsed.reasoning !== 'string' || parsed.reasoning.length < 30) {
      parsed.reasoning = 'Arbitration decision based on verified evidence and escrow rules.';
      logger.warn('⚠️ Reasoning was too short, using fallback');
    }

    if (typeof parsed.explanation !== 'string' || parsed.explanation.length < 10) {
      parsed.explanation = 'Arbitration decision based on verified evidence.';
    }

    if (!Array.isArray(parsed.key_evidence) || parsed.key_evidence.length === 0) {
      parsed.key_evidence = ['Decision based on verified evidence'];
    }

    logger.info(`✅ Response validated: action=${parsed.action}, confidence=${parsed.confidence}, risk=${parsed.risk_score}`);
    return parsed;
  }

  /**
   * Sleep helper for retries
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if status code is retryable
   */
  isRetryableStatus(status) {
    return [429, 500, 502, 503].includes(status);
  }

  /**
   * SINGLE GPT-5.6 ARBITRATION CALL
   */
  async arbitrateDispute(verifiedEvidence, buyerClaim, sellerClaim, escrowContext) {
    const startTime = Date.now();
    
    logger.info(`⚖️ Starting single ${this.modelName} arbitration via GitHub Models...`);
    // Testing hook: allow forcing an AI service failure for integration tests
    if (escrowContext && escrowContext.escrow_id === 'FORCE_AI_FAIL') {
      throw new Error('Simulated AI provider timeout');
    }

    this.validateInputs(verifiedEvidence, buyerClaim, sellerClaim, escrowContext);
    const cacheKey = this.generateCacheKey(verifiedEvidence, buyerClaim, sellerClaim, escrowContext);

    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      logger.info('💾 Returning cached arbitration result');
      return cached.data;
    }

    if (this.pendingRequests.has(cacheKey)) {
      logger.info('⏳ Waiting for pending duplicate request...');
      return await this.pendingRequests.get(cacheKey);
    }

    const prompt = this.buildArbitrationPrompt(
      verifiedEvidence,
      buyerClaim,
      sellerClaim,
      escrowContext
    );

    const promptSize = prompt.length;
    const evidenceSize = JSON.stringify(verifiedEvidence).length;

    if (promptSize > this.MAX_PROMPT_SIZE) {
      logger.error(`❌ Prompt too large: ${promptSize} characters (max: ${this.MAX_PROMPT_SIZE})`);
      throw new Error(`Prompt too large (${promptSize} chars). Consider trimming evidence data.`);
    }

    logger.info(`📝 Prompt size: ${promptSize} chars | Evidence size: ${evidenceSize} chars`);

    let requestPromise = null;
    if (!this.mockMode) {
      requestPromise = this.callArbitrationAPI(prompt, evidenceSize, promptSize);
      this.pendingRequests.set(cacheKey, requestPromise);
    }

    try {
      // If in mock mode, bypass external API and compute deterministic result
      if (this.mockMode) {
        logger.info('🤖 Mock arbitration mode: computing deterministic response without external API');
        const mockResult = this.computeMockArbitration(verifiedEvidence, buyerClaim, sellerClaim, escrowContext);
        this.cache.set(cacheKey, { data: mockResult, createdAt: Date.now() });
        const elapsed = Date.now() - startTime;
        logger.info(`✅ Mock arbitration complete: ${mockResult.action} (${mockResult.confidence}% confidence) in ${elapsed}ms`);
        return mockResult;
      }

      const result = await requestPromise;
      
      this.cache.set(cacheKey, {
        data: result,
        createdAt: Date.now()
      });
      
      this.pendingRequests.delete(cacheKey);
      const elapsed = Date.now() - startTime;
      logger.info(`✅ Arbitration complete: ${result.action} (${result.confidence}% confidence) in ${elapsed}ms`);
      return result;
      
    } catch (error) {
      this.pendingRequests.delete(cacheKey);
      throw error;
    }
  }

  /**
   * Call the GitHub Models Chat Completions API via OpenAI SDK with retry logic
   */
  async callArbitrationAPI(prompt, evidenceSize, promptSize, attempt = 1) {
    try {
      const startTime = Date.now();

      const response = await this.client.chat.completions.create({
        model: this.modelName,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000
      }, {
        timeout: 30000
      });

      const elapsed = Date.now() - startTime;
      const resultText = response.choices?.[0]?.message?.content;

      if (!resultText) {
        throw new Error('No output returned from API');
      }

      const tokensUsed = response.usage?.total_tokens || 0;
      const jsonString = this.extractJSON(resultText);
      const parsed = JSON.parse(jsonString);
      const validated = this.validateResponse(parsed);

      this.logUsage(
        this.modelName,
        promptSize,
        evidenceSize,
        resultText.length,
        tokensUsed,
        elapsed,
        false,
        attempt - 1
      );

      return {
        ...validated,
        model_used: this.modelName,
        timestamp: new Date().toISOString(),
        usage: {
          tokens_used: tokensUsed,
          prompt_tokens: response.usage?.prompt_tokens || 0,
          completion_tokens: response.usage?.completion_tokens || 0
        }
      };

    } catch (error) {
      const status = error.status || error.response?.status;
      
      if (this.isRetryableStatus(status) && attempt <= this.MAX_RETRIES) {
        const delay = this.RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        logger.warn(`🔄 Retry ${attempt}/${this.MAX_RETRIES} for status ${status} in ${delay}ms...`);
        await this.sleep(delay);
        return this.callArbitrationAPI(prompt, evidenceSize, promptSize, attempt + 1);
      }
      
      if (status) {
        const errorMsg = error.message || 'API processing failure';
        logger.error(`❌ API Error ${status}: ${errorMsg}`);
        
        if (status === 429) {
          throw new Error(`API Quota Exceeded: ${errorMsg}`);
        }
        if (status === 401) {
          throw new Error('API Authentication Failed: Invalid GITHUB_TOKEN');
        }
        if (status === 400) {
          throw new Error(`Bad Request: ${errorMsg}`);
        }
        
        throw new Error(`Codex API Error (${status}): ${errorMsg}`);
      } else if (error.name === 'OpenAITimeoutError' || error.code === 'ECONNABORTED') {
        if (attempt <= this.MAX_RETRIES) {
          const delay = this.RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          logger.warn(`🔄 Retry ${attempt}/${this.MAX_RETRIES} for timeout in ${delay}ms...`);
          await this.sleep(delay);
          return this.callArbitrationAPI(prompt, evidenceSize, promptSize, attempt + 1);
        }
        logger.error('❌ API timeout after retries');
        throw new Error('Codex API timeout - please try again');
      } else {
        logger.error(`❌ API call failed: ${error.message}`);
        throw error;
      }
    }
  }

  /**
   * Deterministic mock arbitration used when API token is not configured.
   * Returns the same schema as a real arbitration result.
   */
  computeMockArbitration(verifiedEvidence, buyerClaim, sellerClaim, escrowContext) {
    // Simple heuristics: if delivery confirmed, favor seller; if not delivered, favor buyer
    const status = (verifiedEvidence.delivery_status || '').toLowerCase();
    let action = 'need_more_evidence';
    let confidence = 50;
    let key_evidence = [];

    if (status.includes('delivered') || status === 'delivered') {
      action = 'release_funds';
      confidence = 90;
      key_evidence.push('Verified zkTLS proof indicates delivery');
    } else if (status.includes('not delivered') || status.includes('failed') || status.includes('returned')) {
      action = 'refund_buyer';
      confidence = 90;
      key_evidence.push('Verified zkTLS proof indicates non-delivery');
    } else if (verifiedEvidence.quality_score && verifiedEvidence.quality_score > 75) {
      action = 'release_funds';
      confidence = 80;
      key_evidence.push('High-quality evidence score');
    } else {
      action = 'need_more_evidence';
      confidence = 40;
      key_evidence.push('Insufficient verified evidence');
    }

    return {
      action: action,
      confidence: confidence,
      reasoning: `Mock arbitration based on delivery_status='${verifiedEvidence.delivery_status}' and quality_score=${verifiedEvidence.quality_score || 'N/A'}`,
      explanation: action === 'need_more_evidence' ? 'Not enough verified evidence to make a decision.' : (action === 'release_funds' ? 'Evidence supports release to seller.' : 'Evidence supports refund to buyer.'),
      key_evidence: key_evidence,
      risk_score: action === 'need_more_evidence' ? 50 : 10,
      timestamp: new Date().toISOString(),
      usage: { mocked: true }
    };
  }
}

module.exports = new CodexArbitrationService();