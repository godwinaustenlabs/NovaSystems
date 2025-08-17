// shared/llm.js
import config from './config.js';
import fetch from 'node-fetch';

class ChatLLM {
  constructor() {
    //Constructor Method
    this.cfg = config.llm;
    this.apiKey = config.auth.groq_api_key;
    this._lastRawData = null; // store last raw API response
  }

  estimateTokens(str = '') {
    //Default Tokenizer, although we use it as second option
    return Math.ceil((str || '').length / this.cfg.estCharsPerToken);
  }

  /**
   * Chat with LLM
   * @param {Array} messages - chat messages
   * @param {Object} options - optional settings
   * @param {boolean} options.returnRaw - whether to return raw API data
   * @returns {Object} - { text, tokensUsed } or { text, tokensUsed, raw }
   */
  async chat(messages, options = {}) {
    //Dispatcher Function per LLM
    const provider = this.cfg.provider;
    if (provider === 'llama') {
      return this._callLlama(messages, options);
    }
    throw new Error(`Unsupported provider: ${provider}`);
  }

  async _callLlama(messages, options) {
    //LLM Parser
    if (!this.apiKey) {
      throw new Error('Missing GROQ_API_KEY in environment variables');
    }

    const body = {
      model: this.cfg.model,
      temperature: options.temperature ?? this.cfg.temperature,
      max_tokens: options.maxOutputTokens ?? this.cfg.maxOutputTokens,
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

    const text = data.choices?.[0]?.message?.content || '';
    const tokensUsed =
      data.usage?.total_tokens ?? this.estimateTokens(JSON.stringify(body));

    if (options.returnRaw) {
      return { text, tokensUsed, raw: data };
    }

    return { text, tokensUsed };
  }
}

export default new ChatLLM();
