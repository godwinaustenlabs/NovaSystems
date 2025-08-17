import config from './config.js';
import LLM from './llm.js';

/**
 * In-memory store (swap with CF KV/Vectorize later).
 * Keyed by `${client_id}:${agent_id}`
 */
const _RAM = new Map();

function _key(client_id, agent_id) {
  return `${client_id}:${agent_id}`;
}

export class BufferMemory {
  constructor(limitTurns = 20) {
    this.limitTurns = limitTurns;
  }
  async load(client_id, agent_id) {
    const k = _key(client_id, agent_id);
    const data = _RAM.get(k) || { turns: [], summary: '' };
    return {
      turns: data.turns.slice(-this.limitTurns),
      summary: data.summary || '',
    };
  }
  async save(client_id, agent_id, turn) {
    const k = _key(client_id, agent_id);
    const data = _RAM.get(k) || { turns: [], summary: '' };
    data.turns.push(turn);
    if (data.turns.length > this.limitTurns)
      data.turns = data.turns.slice(-this.limitTurns);
    _RAM.set(k, data);
  }
}

export class SummaryMemory extends BufferMemory {
  constructor(limitTurns = 20) {
    super(limitTurns);
  }

  async summarizeIfNeeded(client_id, agent_id) {
    const k = _key(client_id, agent_id);
    const data = _RAM.get(k);
    if (!data || data.turns.length < this.limitTurns) return;

    const text = data.turns.map((t) => `[${t.role}] ${t.content}`).join('\n');
    const messages = [
      {
        role: 'system',
        content:
          'You compress conversation into a concise, factual summary retaining entities, intents, commitments, and outcomes. No flowery prose.',
      },
      {
        role: 'user',
        content: `Summarize this:\n${text}\n\nKeep under 200 words.`,
      },
    ];
    const res = await LLM.chat(messages, config.memory.summarizer);
    // store the model's text as new summary and clear older turns
    data.summary = res.text;
    data.turns = []; // reset buffer after summarization
    _RAM.set(k, data);
  }
}

/**
 * DynamicMemory = token-budgeted memory:
 * - include summary if present
 * - include as many recent turns as fit within memoryBudgetTokens
 * - spillover triggers summarization
 */
export class DynamicMemory extends SummaryMemory {
  constructor() {
    super(100); // internal cap before summarization attempt
    const { totalTokenBudget, reserveForOutput } = config.memory;
    this.memoryBudgetTokens = totalTokenBudget - reserveForOutput;
  }

  async buildContextMessages(client_id, agent_id) {
    const { summary, turns } = await this.load(client_id, agent_id);

    const messages = [];
    let used = 0;

    if (summary) {
      messages.push({ role: 'system', content: `Memory Summary:\n${summary}` });
      used += LLM.estimateTokens(summary);
    }

    // add turns from newest backwards within budget
    for (let i = turns.length - 1; i >= 0; i--) {
      const t = turns[i];
      const tokens = LLM.estimateTokens(t.content);
      if (used + tokens > this.memoryBudgetTokens) break;
      messages.unshift({ role: t.role, content: t.content }); // preserve order
      used += tokens;
    }

    return { messages, usedTokens: used };
  }

  async saveAndMaybeSummarize(client_id, agent_id, turn) {
    await this.save(client_id, agent_id, turn);
    // heuristic: if we exceed ~1.2x budget, summarize
    const { turns } = await this.load(client_id, agent_id);
    const approx = turns.reduce(
      (acc, t) => acc + LLM.estimateTokens(t.content),
      0
    );
    if (approx > this.memoryBudgetTokens * 1.2) {
      await this.summarizeIfNeeded(client_id, agent_id);
    }
  }
}
