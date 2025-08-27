// ===============================
// File: memory.js (extended with pluggable providers)
// ===============================
import { ChatLLM } from './llm.js';

/** Default in-memory store */
const _RAM = new Map();
const _key = (client_id, agent_id) => `${client_id}:${agent_id}`;

// Local helper
const estimateTokensLocal = (str = '', estCharsPerToken = 4) => {
  const est = Number(estCharsPerToken) || 4;
  return Math.ceil(String(str).length / est);
};

/**
 * Memory class for storing/retrieving state across agent runs.
 * Needs 8 Config Parameters and 1 runtime funtion parameters for save function.
 * Use .load() and .save(turn) to interact with memory.
 *
 * @param {String} clientId - (Config) Unique identifier for the client.
 * @param {String} agentId - (Config) Unique identifiers for the client and agent.
 * @param {String} memoryType - (Config) Type of memory to use (buffer, summary, etc.).
 * @param {number} limitTurns - (Config) Options for configuring memory behavior.
 * @param {Object} summarizerCfg - (Config) Configuration for summarization (temperature, maxOutputTokens, totalTokenBudget, reserveForOutput).
 * @param {Object} provider - (Config) LLM Provider (e.g., OpenAI, Groq).
 * @param {string} api_key - (Config) API key for the memory provider.
 * @param {string} model - (Config) Model to use for memory (e.g., 'llama3-70b-8192', 'gpt-4-o-mini').
 * @param {Object} turns - (Runtime) Turns are conversations, you want to save individually for user and assistant, pass in save.
 * @returns { turns: Array, summary: string } - Memory instance with .load() methods.
 */
export class Memory {
  constructor(config = {}) {
    this.clientId = config.clientId;
    this.agentId = config.agentId;
    this.memoryType = String(config.memoryType).toLowerCase();
    this.limitTurns = Number(config.limitTurns);
    this.summarizerCfg = config.summarizer;
    this.provider = config.provider;
    this.API_KEY = config.api_key;
    this.model = config.model;

    this.memory = this._initMemory(this.memoryType);
  }
  _initMemory(type) {
    switch (type) {
      case 'nomemory':
        return new NoMemory();
      case 'summary':
        return new SummaryMemory(this.summarizerCfg, this.limitTurns);
      case 'kv':
        return new KVMemoryExternal(this.provider); // now uses provider
      case 'vector':
        return new VectorMemory(this.provider);
      case 'dynamic':
        return new DynamicMemory(this.summarizerCfg);
      default:
        return new BufferMemory(this.limitTurns);
    }
  }
  /**
   * load
   * Retrieve a value from memory.
   *
   * @param {string} key - Unique identifier for the memory value.
   * @returns {Promise<any>} The stored value, or undefined if not found.
   */
  async load() {
    try {
      return await this.memory.load(this.clientId, this.agentId);
    } catch (err) {
      console.error(`[Memory] Load failed: ${err.message}`);
      return { turns: [], summary: '' };
    }
  }
  /**
   * save
   * Store a value in memory.
   *
   * @param {string} key - Unique identifier for the memory value.
   * @param {any} value - Value to be stored (JSON-serializable).
   * @returns {actualTokensUsed: number, estimatedTokensUsed: number}
   */
  async save(turn) {
    try {
      if (this.memory instanceof DynamicMemory) {
        const tokens =
          (await this.memory.saveAndMaybeSummarize(
            this.clientId,
            this.agentId,
            turn
          )) || {};
        return {
          actualTokensUsed: tokens.actualTokensUsed,
          estimatedTokensUsed: tokens.estimatedTokensUsed,
        };
      }
      if (typeof this.memory.summarizeIfNeeded === 'function') {
        await this.memory.save(this.clientId, this.agentId, turn);
        const summarizerOutput = await this.memory.summarizeIfNeeded(
          this.clientId,
          this.agentId
        ); //memory call to Summary Memory outputs the tokens Used and automatically appends the summary to the map which is later loaded by the load method
        const actualTokensUsed = summarizerOutput?.tokensUsedByMemory;
        return { actualTokensUsed }; //method in-case of Summary Memory returns the amount of tokens used to summarize the conversation
      } else {
        await this.memory.save(this.clientId, this.agentId, turn);
      }
    } catch (err) {
      console.error(`[Memory] Save failed: ${err.message}`);
    }
  }
}

export class NoMemory {
  async load() {
    return { turns: [], summary: '' };
  }
  async save() {
    return null;
  }
}

export class BufferMemory {
  constructor(limitTurns) {
    this.limitTurns = limitTurns;
  }

  async load(clientId, agentId) {
    const k = _key(clientId, agentId);
    const data = _RAM.get(k) || { turns: [], summary: '' };
    return {
      turns: data.turns,
      summary: data.summary || '',
    };
  }

  async save(clientId, agentId, turn) {
    const k = _key(clientId, agentId);
    const data = _RAM.get(k) || { turns: [], summary: '' };

    if (Array.isArray(turn)) {
      for (const t of turn) data.turns.push(t);
    } else if (turn) {
      data.turns.push(turn);
    }

    if (data.turns.length > this.limitTurns) {
      data.turns = data.turns.slice(-this.limitTurns);
    }
    _RAM.set(k, data);
    return { turns: [...data.turns], summary: data.summary || '' };
  }
}

export class SummaryMemory extends BufferMemory {
  constructor(summarizerCfg, limitTurns) {
    super(limitTurns);
    this.summarizerCfg = summarizerCfg;
    this.provider = summarizerCfg.provider;
    this.model = summarizerCfg.model;
    this.api_key = summarizerCfg.api_key;
  }

  async summarizeIfNeeded(clientId, agentId) {
    const k = _key(clientId, agentId);
    const data = _RAM.get(k);
    if (!data || data.turns.length < this.limitTurns) {
      return;
    }

    const text = data.turns.map((t) => `[${t.role}] ${t.content}`).join('\n');
    const messages = [
      {
        role: 'system',
        content:
          'You compress conversation into a very, very concise factual summary, saving token is necessary, make sure you mention the user and ai convo but at the same time use minimum token, output in a paragraph but keep the context.',
      },
      {
        role: 'user',
        content: `Summarize this:\n${text}\n\nKeep under 500 words including previous summary's context "${data.summary}", don't lose any info.`,
      },
    ];
    const llm = new ChatLLM({
      provider: this.provider,
      model: this.model,
      temperature: this.summarizerCfg.temperature,
      maxOutputTokens: this.summarizerCfg.maxOutputTokens,
      estCharsPerToken: 4,
      api_key: this.api_key,
    });

    const res = await llm.chat({
      user: messages[1].content,
      system: messages[0].content,
    });

    data.summary = res.text;
    data.turns = data.turns.slice(-2); // keep last 2 turns for context
    _RAM.set(k, data);
    return { data, tokensUsedByMemory: res.tokensUsed || null };
  }
}

//new dynamic memory
export class DynamicMemory extends BufferMemory {
  constructor(summarizerCfg) {
    super(100);
    this.memoryBudgetTokens =
      summarizerCfg.totalTokenBudget - summarizerCfg.reserveForOutput;
    this.provider = summarizerCfg.provider;
    this.model = summarizerCfg.model;
    this.api_key = summarizerCfg.api_key;
    this.temperature = summarizerCfg.temperature;
    this.maxOutputTokens = summarizerCfg.maxOutputTokens;
  }
  async saveAndMaybeSummarize(clientId, agentId, turn) {
    try {
      // Step 1: Save turn
      await this.save(clientId, agentId, turn);

      // Step 2: Always build context memory after saving
      const context = await this.buildContextMessages(clientId, agentId);

      // Step 3: If we exceed the limit, trigger summarization
      const approx = context.ExpectedUsedTokens;
      if (this.memoryBudgetTokens * 0.95 < approx) {
        console.log('Approx tokens used: ', approx);
        const summarizerOutput = await this.summarizeIfNeededforDynamic(
          clientId,
          agentId
        );
        return (
          {
            actualTokensUsed: summarizerOutput.tokensUsedByMemory,
            estimatedTokensUsed: approx,
          } || 0
        );
      }
      return { estimatedTokensUsed: approx } || 0;
    } catch (err) {
      console.error(
        `[DynamicMemory] saveAndMaybeSummarize failed: ${err.message}`
      );
      return null;
    }
  }
  async summarizeIfNeededforDynamic(clientId, agentId) {
    const k = _key(clientId, agentId);
    const data = _RAM.get(k);

    const text = data.turns.map((t) => `[${t.role}] ${t.content}`).join('\n');
    const messages = [
      {
        role: 'system',
        content:
          'You compress conversation into a very, very concise factual summary, saving token is necessary, make sure you mention the user and ai convo but at the same time use minimum token, output in a paragraph but keep the context.',
      },
      {
        role: 'user',
        content: `Summarize this:\n${text}\n\nKeep under 500 words including previous summary's context "${data.summary}", don't lose any info.`,
      },
    ];
    const llm = new ChatLLM({
      provider: this.provider,
      model: this.model,
      temperature: this.temperature,
      maxOutputTokens: this.maxOutputTokens,
      estCharsPerToken: 4,
      api_key: this.api_key,
    });

    const res = await llm.chat({
      user: messages[1].content,
      system: messages[0].content,
    });

    data.summary = res.text;
    data.turns = data.turns.slice(-2); // keep last 2 turns for context
    _RAM.set(k, data);
    return { tokensUsedByMemory: res.tokensUsed || null };
  }

  async buildContextMessages(clientId, agentId) {
    const { turns, summary } = await this.load(clientId, agentId);
    const messages = [];
    let used = 0;

    if (summary) {
      messages.push({ role: 'system', content: `Memory Summary:\n${summary}` });
      used += estimateTokensLocal(summary);
    }

    for (let i = turns.length - 1; i >= 0; i--) {
      const t = turns[i];
      const tokens = estimateTokensLocal(t.content);
      if (used + tokens > this.memoryBudgetTokens) break;
      messages.unshift({ role: t.role, content: t.content });
      used += tokens;
    }

    return { messages, ExpectedUsedTokens: used };
  }
}
// ===============================
// Provider-backed memories (Stubs)
// ===============================
export class KVMemoryExternal {
  constructor(provider) {
    this.provider = provider; // e.g., Cloudflare KV binding
  }

  async load(clientId, agentId) {
    const key = _key(clientId, agentId);
    return (await this.provider.get(key)) || { turns: [], summary: '' };
  }

  async save(clientId, agentId, turn) {
    const key = _key(clientId, agentId);
    const data = (await this.provider.get(key)) || { turns: [], summary: '' };
    if (Array.isArray(turn)) data.turns.push(...turn);
    else if (turn) data.turns.push(turn);
    await this.provider.set(key, data);
  }
}

export class VectorMemory {
  constructor(provider) {
    this.provider = provider;
  }
  async load(clientId, agentId) {
    return await this.provider.getContext(clientId, agentId);
  }
  async save(clientId, agentId, turn) {
    await this.provider.insert(clientId, agentId, turn);
  }
}
