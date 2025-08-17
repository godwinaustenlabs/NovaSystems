// core/prompt.js
import { BufferMemory, SummaryMemory, DynamicMemory } from './memory.js';

export class PromptBuilder {
  constructor({
    systemPrompt = '',
    userPrompt = '',
    useScratchPad = false,
    memoryType = 'buffer', // "buffer" | "summary" | "dynamic"
    tools = {},
    lastToolResponse = null,
    clientId = 'defaultClient',
    agentId = 'defaultAgent',
  } = {}) {
    this.systemPrompt = systemPrompt;
    this.userPrompt = userPrompt;
    this.useScratchPad = useScratchPad;
    this.memoryType = memoryType;
    this.tools = tools;
    this.lastToolResponse = lastToolResponse;
    this.clientId = clientId;
    this.agentId = agentId;

    this.scratchpad = [];
    this.memory = this._initMemory(memoryType);
  }

  _initMemory(memoryType) {
    switch (memoryType) {
      case 'dynamic':
        return new DynamicMemory();
      case 'summary':
        return new SummaryMemory();
      case 'buffer':
      default:
        return new BufferMemory();
    }
  }

  async build() {
    // Load memory context
    const memCtx =
      this.memoryType === 'dynamic'
        ? await this.memory.buildContextMessages(this.clientId, this.agentId)
        : await this.memory.load(this.clientId, this.agentId);

    // Scratchpad (only if enabled)
    const scratchpadSection = this.useScratchPad
      ? { active: true, content: this.scratchpad }
      : { active: false };

    // Tools description
    const toolsSection = Object.keys(this.tools).map((name) => {
      return {
        name,
        description: this.tools[name].description || 'No description provided',
      };
    });

    // NAS compliant JSON input
    const nasPrompt = {
      type: 'NAS_PROMPT',
      system: this.systemPrompt,
      user: this.userPrompt,
      memory: memCtx,
      scratchpad: scratchpadSection,
      tools: toolsSection,
      lastToolResponse: this.lastToolResponse,
      instructions: `
You are a NAS-compliant reasoning engine. 
You MUST output valid JSON only and only,
If you want to communicate output to human in natural language, populate the "content" field.
You must use the scratchpad field to display your reasoning though process, always update the scratchpad in output and use the scratchpad in input to get a refernce of last thoughts, then update the scratchpad with current thoughts used for reasing or whatever underlying thought process.
The JSON MUST this schema:

  "type": "object",
  "properties": {
    "content": { "type": "string" },
    "type": { "type": "string", "enum": ["NAS_OUTPUT"] },
    "scratchpad": { "type": "array", "items": { "type": "string" } },
    "memory": {
      "type": "object",
      "properties": {
        "messages": { "type": "array", "items": { "type": "object" } },
        "usedTokens": { "type": "number" }
      },
      "required": ["messages", "usedTokens"]
    },
    "toolRequest": {
      "anyOf": [
        { "type": "null" },
        {
          "type": "object",
          "properties": {
            "name": { "type": "string" },
            "params": { "type": "object" }
          },
          "required": ["name", "params"]
        }
      ]
    },
    "finalAnswer": {
      "anyOf": [
        { "type": "null" },
        { "type": "string" }
      ]
    }
  },
  "required": ["content", "type", "scratchpad", "memory", "toolRequest", "finalAnswer"]
}
        `.trim(),
    };

    // Return as string for direct LLM input
    return JSON.stringify(nasPrompt, null, 2);
  }

  addToScratchpad(entry) {
    if (this.useScratchPad) {
      this.scratchpad.push(entry);
    }
  }

  async saveTurn(role, content) {
    await this.memory.saveAndMaybeSummarize(this.clientId, this.agentId, {
      role,
      content,
    });
  }
}
