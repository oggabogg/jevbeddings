import { AppError, assert, number, object } from './validation.js';

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const MODEL_PATTERN = /^jev-(?:\d+\.\d+\.\d+|latest|preview)$/;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Only the official JEV host is used. No alternative model, provider, or fallback.
export class JevClient {
  constructor({ apiKey = process.env.TYPESAFE_API_KEY || process.env.JEV_API_KEY,
    model = process.env.JEV_MODEL || 'jev-1.13.0', fetchImpl = fetch,
    sleepImpl = sleep, retries = 3, timeoutMs = 30000,
    inputPrice = process.env.JEV_INPUT_USD_PER_MILLION, onCall = () => {} } = {}) {
    assert(MODEL_PATTERN.test(model), 'Only JEV model identifiers are allowed');
    this.apiKey = apiKey; this.model = model; this.fetch = fetchImpl;
    this.sleep = sleepImpl; this.retries = retries; this.timeoutMs = timeoutMs; this.onCall = onCall;
    this.inputPrice = inputPrice === undefined || inputPrice === '' ? null : Number(inputPrice);
    if (this.inputPrice !== null) number(this.inputPrice, 0, 10000, 'input token price');
  }

  async evaluate(state, questions, purpose) {
    assert(this.apiKey, 'Set TYPESAFE_API_KEY in .env or the server environment to use JEV.', 503, 'jev_not_configured');
    assert(Object.keys(questions).length > 0, 'At least one question is required');
    const started = performance.now();
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      let response;
      try {
        response = await this.fetch(ENDPOINT, {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(this.timeoutMs),
          headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ state, model: this.model, questions }),
        });
      } catch {
        if (attempt < this.retries) { await this.sleep(this.backoff(attempt)); continue; }
        this.onCall({ purpose, success: false, attempts: attempt + 1, latency_ms: performance.now() - started, estimated_cost_usd: null });
        throw new AppError('JEV connection failed or timed out. No features were saved.', 502, 'jev_unavailable');
      }
      if (!response.ok) {
        const retryable = [408, 429, 500, 502, 503, 504, 529].includes(response.status);
        if (retryable && attempt < this.retries) {
          const retryAfter = response.headers.get('retry-after');
          const seconds = Number(retryAfter);
          const wait = retryAfter ? (Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now()) : 0;
          await response.arrayBuffer();
          if (wait > 60000) break; // Surface long throttles rather than retrying before the provider permits.
          await this.sleep(Math.max(this.backoff(attempt), Number.isFinite(wait) ? wait : 0)); continue;
        }
        this.onCall({ purpose, success: false, attempts: attempt + 1, http_status: response.status,
          latency_ms: performance.now() - started, estimated_cost_usd: null });
        throw new AppError(`JEV returned HTTP ${response.status}. ${response.status === 401 ? 'Check the configured API key.' : 'Check request limits and service availability.'}`,
          502, 'jev_http_error');
      }
      let payload;
      try {
        payload = await response.json();
        validateAnswers(payload, questions);
      } catch {
        this.onCall({ purpose, success: false, attempts: attempt + 1, latency_ms: performance.now() - started, estimated_cost_usd: null });
        throw new AppError('JEV returned an invalid typed response. No features were saved.', 502, 'jev_invalid_response');
      }
      const input = payload.usage?.input_tokens;
      const metadata = {
        purpose, success: true, model: payload.model, usage: payload.usage,
        attempts: attempt + 1, latency_ms: performance.now() - started,
        estimated_cost_usd: this.inputPrice === null ? null : input * this.inputPrice / 1e6,
        cost_note: attempt > 0 ? 'Successful response only; earlier attempts may also have been billed.' : 'Estimate from configured input price; not an invoice.',
        processing_timestamp: new Date().toISOString(),
      };
      this.onCall(metadata);
      return { answers: payload.answers, metadata };
    }
    this.onCall({ purpose, success: false, latency_ms: performance.now() - started, estimated_cost_usd: null });
    throw new AppError('JEV requested a long retry delay. Try again later.', 503, 'jev_rate_limited');
  }

  backoff(attempt) { return Math.min(10000, 400 * 2 ** attempt) + Math.floor(Math.random() * 150); }
}

export function validateAnswers(payload, questions) {
  object(payload, 'JEV response'); object(payload.answers, 'answers');
  assert(typeof payload.model === 'string' && MODEL_PATTERN.test(payload.model), 'Non-JEV response model');
  assert(Object.keys(payload.answers).length === Object.keys(questions).length, 'Unexpected answer count');
  for (const [id, question] of Object.entries(questions)) {
    const answer = object(payload.answers[id], `answer ${id}`);
    assert(answer.type === question.type, `Incorrect answer type for ${id}`);
    if (question.type === 'noul') number(answer.noul, 0, 1, `${id}.noul`);
    else if (question.type === 'choice') {
      assert(Object.hasOwn(question.criteria, answer.choice), `Unknown choice for ${id}`);
      number(answer.confidence, 0, 1, `${id}.confidence`);
      object(answer.probabilities, `${id}.probabilities`);
      assert(Object.keys(answer.probabilities).length === Object.keys(question.criteria).length, 'Invalid choice probability keys');
      let total = 0;
      for (const key of Object.keys(question.criteria)) total += number(answer.probabilities[key], 0, 1, `${id}.${key}`);
      assert(Math.abs(total - 1) < 0.02, 'Invalid probability distribution');
    } else throw new Error('Unsupported question type');
  }
  object(payload.usage, 'usage');
  for (const key of ['input_tokens', 'output_tokens']) {
    number(payload.usage[key], 0, Number.MAX_SAFE_INTEGER, `usage.${key}`);
    assert(Number.isInteger(payload.usage[key]), 'Token counts must be integers');
  }
}
