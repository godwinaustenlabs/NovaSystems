// core/pipeline.js
import LLM from './llm.js';
import { PromptBuilder } from './prompt.js';
import { parseNAS } from './parser.js';

export class Pipeline {
  constructor(config = {}) {
    this.config = config;
    this.promptBuilder = new PromptBuilder(config);
  }

  async run() {
    // 1. Build NAS-compliant JSON prompt
    const prompt = await this.promptBuilder.build();

    // 2. Send to LLM
    const response = await LLM.chat([
      { role: 'system', content: 'You are a NAS-compliant reasoning engine.' },
      { role: 'user', content: prompt },
    ]);

    // 3. Parse JSON output
    const parsed = parseNAS(response.text);

    // 4. Save AI turn into memory
    await this.promptBuilder.saveTurn('assistant', response.text);

    return { raw: response.text, parsed };
  }
}
