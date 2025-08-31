// ===============================
// File: pipeline.js (extended with injection)
// ===============================
import 'dotenv/config';

import { ChatLLM } from './llm.js';
import { PromptBuilder } from './prompt.js';
import { parseNAS } from './parser.js';
import { Memory } from './memory.js';
import { Scratchpad } from './scratchpad.js';
/**
 * Pipeline is a class that orchestrates the flow of data and control between various components
 * involved in processing a user request. It automatically configures and runs the flow of chained
 * operations, including prompt building, memory management, tool execution, and LLM interactions.
 *
 * It requires 2 Configuration parameters, and a node configuration object and an output type.
 * Nodes are the several operational stages that the input data passes through and the configuration object configures each node's behavior.
 *
 * @param {Object} [Configuration object] - Configuration object for nodes.
 * @param {String} [outputType] - Output type (e.g., 'parsed', 'raw', 'text').
 * @returns {
 *    content: string,
 *    type: "NAS_OUTPUT",
 *    scratchpad: Object||null,
 *    toolRequest: Object|null,
 *    finalAnswer: string|null,
 *    meta: Object|null,
 *    tokenUsage: number|null,
 *    turns: Array[Object],
 *    summary: string
 *  } - Normalized NAS result:
 *
 */
export class Pipeline {
  constructor(config = {}, outputType) {
    this.config = { ...config };
    this.outputType = outputType || 'parsed'; // whether to return raw LLM output (Own config var)
  }

  async run() {
    //Configuration of Nodes

    //Memory
    const memory = new Memory({
      clientId: this.config.clientId,
      agentId: this.config.agentId,
      memoryType: this.config.memoryType,
      limitTurns: this.config.limitTurns,
      summarizer: this.config.summarizer,
      provider: this.config.provider,
      api_key: this.config.api_key,
      model: this.config.model,
    });

    //Scratchpad
    const scratchpadInstance = new Scratchpad({
      clientId: this.config.clientId,
      agentId: this.config.agentId,
      useScratchpad: this.config.useScratchpad,
    });

    //Prompt
    const promptBuilder = new PromptBuilder({
      systemPrompt: this.config.systemPrompt || "You're a helpful assistant.",
      tools: this.config.tools || {},
      lastToolResponse: this.config.lastToolResponse || null,
    });

    //llm
    const llm = new ChatLLM({
      provider: this.config.provider,
      model: this.config.model,
      temperature: this.config.temperature,
      maxOutputTokens: this.config.maxOutputTokens,
      estCharsPerToken: this.config.estCharsPerToken,
      api_key: this.config.api_key,
      verbose: this.config.verbose,
    });

    //Execution of Nodes

    // 1) Memory (uses injected provider if present)
    const memoryCtx = await memory.load();

    // 2) Scratchpad
    const scratchpad = await scratchpadInstance.build();

    // 3) Build NAS prompt
    const prompt = await promptBuilder.build(
      this.config.userPrompt,
      memoryCtx,
      scratchpad
    );

    // 4) Send to LLM
    const response = await llm.chat(prompt, {});

    // 5) Parse JSON output
    const parsed = { ...parseNAS(response.text) };

    // 6) Save scratchpad
    scratchpadInstance.save(
      typeof parsed.scratchpad === 'string'
        ? parsed.scratchpad
        : (parsed.scratchpad?.content ?? '')
    );

    // 7) Save turns
    const tokensUsedByMemory = await memory.save([
      { role: 'user', content: this.config.userPrompt },
      { role: 'assistant', content: parsed.content },
    ]);
    const snapshot = await memory.load(); //load snapshot

    // 8) If toolRequest exists → call toolRunner
    if (parsed.toolRequest && this.config.toolRunner) {
      const toolRes = await this.config.toolRunner(
        parsed.toolRequest.name,
        parsed.toolRequest.args
      );
      parsed.toolResponse = toolRes;
    }

    // 9) Output
    if (this.outputType.toLowerCase() == 'text') {
      return response.text;
    }
    if (this.outputType.toLowerCase() == 'raw') {
      // Return raw LLM output if configured
      return response.raw;
    }
    if (this.outputType.toLowerCase() == 'parsed') {
      // Return raw LLM output if configured
      return {
        ...parsed,
        agentTokenUsage: response.tokensUsed,
        estTokenUsageBySummarizer: tokensUsedByMemory.estimatedTokensUsed,
        actualTokensUsedBySummarizer: tokensUsedByMemory.actualTokensUsed,
        ...snapshot,
      };
    }
  }
}
