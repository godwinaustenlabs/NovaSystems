// ===============================
// File: llm.js (refactored, commented, verbose added)
// ===============================
import 'dotenv/config';
import fetch from 'node-fetch';

/**
 * ChatLLM
 * Lightweight LLM wrapper with Groq-compatible endpoint.
 * Takes 7 Config Variables and 2 Runtime Variables.
 * Use .chat(userInput, options) to chat.
 *
 * @param {string} [provider] - (Config) Provider type ("groq" | "anthropic" | "gemini" | "openai").
 * @param {string} [model] - (Config) Model identifier string.
 * @param {string} [groq_api_key] - (Config) API key for Groq endpoint.
 * @param {number} [temperature=0.7] - (Config) Sampling temperature.
 * @param {number} [maxOutputTokens=1024] - (Config) Max tokens in completion.
 * @param {number} [estCharsPerToken=4] - (Config) Estimate for tokenizer fallback.
 * @param {boolean} [verbose=true] - (Config) Whether to log requests/responses.
 * @param {object} [options] - (Runtime) Additional options for the request. (e.g. temperature, maxOutputTokens, verbose)
 * @param {object} [userInput] - (Runtime) Input object { user, system }.
 * @return {Promise<{ text: string, tokensUsed: number, raw?: Object }>} - LLM's reponse raw and text with tokenUsed
 */
export class ChatLLM {
  constructor(config = {}) {
    /**
     * Keep original fields but add sensible defaults to avoid undefined issues.
     * Added `verbose` flag for debugging payloads and responses.
     */

    this.estCharsPerToken = config.estCharsPerToken || 4; // default fallback used by estimateTokens
    this.temperature = config.temperature || 0.7;
    this.maxOutputTokens = config.maxOutputTokens || 1024;
    this.verbose = config.verbose || false; // 👈 new: toggle verbose logging
    this.apiKey = config.api_key; // original behavior
    this.model = config.model;
    this.provider = config.provider;
    this._lastRawData = null; // store last raw API response
  }
  /**
   * estimateTokens
   * Estimate number of tokens for a given string.
   *
   * @param {string} [str=''] - Input text.
   * @returns {number} Estimated token count.
   */
  estimateTokens(str = '') {
    // Default Tokenizer: simple char/estCharsPerToken heuristic
    const est = Number(this.estCharsPerToken) || 4;
    return Math.ceil((str || '').length / est);
  }
  /**
   * chat
   * Dispatch chat request to selected provider.
   *
   * @param {Object} userInput - Pipeline input { user, system }.
   * @param {Object} [options] - Override settings { temperature, maxOutputTokens, verbose, returnRaw }.
   * @returns {Promise<{ text: string, tokensUsed: number, raw?: Object }>}
   */
  /**
   * Chat dispatcher
   * @param {Object} userInput - expects { user, system } per pipeline
   * @param {Object} options - optional settings
   * @returns {Object} - { text, tokensUsed } or { text, tokensUsed, raw }
   */
  async chat(userInput, options = {}) {
    const messages = [
      { role: 'system', content: userInput.system },
      { role: 'user', content: userInput.user },
    ];

    const body = {
      model: this.model,
      temperature: options.temperature ?? this.temperature,
      max_tokens: options.maxOutputTokens ?? this.maxOutputTokens,
      messages,
    };

    // 🔍 Verbose: log the outgoing request
    if (this.verbose || options.verbose) {
      console.log('\n================ VERBOSE: LLM REQUEST ================');
      console.log(JSON.stringify(body, null, 2));
      console.log('======================================================\n');
    }

    const provider = this.provider; // default to llama if not set
    if (provider === 'groq') return this._callGroq(messages, options);
    if (provider === 'anthropic') return this._callANTHROPIC(messages, options);
    if (provider === 'gemini') return this._callGEMINI(messages, options);
    if (provider === 'openai') return this._callGPT(messages, options);
    throw new Error(`Unsupported provider: ${provider}`);
  }

  /**
   * _postToGroq
   * Internal helper to POST request to Groq endpoint.
   *
   * @param {Array<Object>} messages - OpenAI-style messages [{ role, content }, ...].
   * @param {Object} options - Request options (temperature, maxOutputTokens, verbose).
   * @returns {Promise<{ text: string, tokensUsed: number, raw: Object }>}
   * @throws {Error} If API key missing or request fails.
   */
  async _postToGroq(messages, options) {
    if (!this.apiKey) {
      // Keep original env var name & error semantics
      throw new Error('Missing api.key in config variables');
    }

    const body = {
      model: this.model,
      temperature: options.temperature ?? this.temperature,
      max_tokens: options.maxOutputTokens ?? this.maxOutputTokens,
      messages,
    };

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Groq API error: ${res.status} - ${errText}`);
    }

    const data = await res.json();
    this._lastRawData = data; // store internally

    // 🔍 Verbose: log the raw response
    if (this.verbose || options.verbose) {
      console.log('\n================ VERBOSE: LLM RESPONSE ================');
      console.log(JSON.stringify(data, null, 2));
      console.log('=======================================================\n');
    }

    const text =
      data.choices?.[0]?.message?.content || data.choices?.[0]?.text || '';
    const tokensUsed =
      data.usage?.total_tokens ?? this.estimateTokens(JSON.stringify(body));

    return { text, tokensUsed, raw: data };
  }

  async _callGroq(messages, options) {
    // Preserve original message order (user then system)
    const res = await this._postToGroq(messages, options);
    const out = { res, text: res.text, tokensUsed: res.tokensUsed };
    return out;
  }
}
