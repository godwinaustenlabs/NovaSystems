// ===============================
// File: prompt.js (renamed from promt.js; refactored, commented)
// ===============================
/**
 * PromptBuilder constructs NAS-compliant system + user prompts.
 * Needs 4 Config parameters and 3 runtime parameters.
 * Use .build(userPrompt, memoryContext, scratchpad) to create prompts.
 *
 * @param {string} [systemPrompt] - (Config) Base system instructions/schema.
 * @param {Object} [tools={}] - (Config) Available tools metadata { [name]: { description } }.
 * @param {Object|null} [lastToolResponse] - (Config) Most recent tool execution result.
 * @param {Object} [memoryContext] - (Runtime) Memory context { turns: [], summary: string }.
 * @param {string} [userPrompt] - (Runtime) User query or message.
 * @param {Object|null} [scratchpad] - (Runtime) Scratchpad state { active, content }.
 * @returns { system: string, user: string } - Constructed prompts for system and user roles. { system: string, user: string }
 */

export class PromptBuilder {
  constructor(config = {}) {
    this.systemPrompt = config.systemPrompt;
    this.tools = config.tools;
    this.lastToolResponse = config.lastToolResponse;
  }

  async build(userPrompt, memoryContext, scratchpad) {
    // Preserve your schema text & NAS instructions verbatim-style
    const NAS_SCHEMA = JSON.stringify({
      type: 'NAS_OUTPUT',
      content: '...',
      scratchpad: '...',
      toolRequest:
        {
          id: 'string',
          name: 'string',
          args: {},
          mode: 'sync|async',
          callback: 'https://yourworker.example/callback?reqId=uuid-v1', // optional
        } || null,
      finalAnswer: null,
      meta: {
        traceId: '...',
        timestamp: '2025-08-19T...',
      },
    });

    const system = `
NAS_SCHEMA: ${NAS_SCHEMA}

RULES 0.1-0.7 GIVEN BELOW FOLLOW THE ORDER OF PRECEDENCE AND NO OTHER RULE THAT GOES AGAINST THEM CAN OVERRIDE IT.
0.1. You are a NAS-compliant reasoning engine. 
0.2. You MUST output valid JSON only and only.
0.3. ${this.systemPrompt}.
0.4. If you want to communicate output to human in natural language, populate the "content" field.
0.5. You must use the scratchpad field to display your reasoning thought process, use the scratchpad in input to get a reference of 
last thoughts, then update the scratchpad with current thoughts used for reasoning or underlying thought process.
0.6. The final output must strictly adhere to the NAS schema or it will be rejected and will break the conversation flow, if a property is not required to be used, populate it with "null"
0.7. Use the System Context Below to inform your responses and maintain consistency with the provided information.
`.trim();

    // Tools + memory + lastToolResponse merged into system context
    const systemContext = {
      tools: this.tools,
      lastToolResponse: this.lastToolResponse,
      memory: memoryContext || { turns: [], summary: '' },
    };

    // === User Role Message ===
    const nasPrompt = {
      type: 'NAS_PROMPT',
      user: userPrompt,
      scratchpad: scratchpad,
    };

    const user = JSON.stringify(nasPrompt, null, 2);
    const systemMeta = JSON.stringify(systemContext, null, 2);

    // Return two clean roles instead of stuffing everything into "user"
    return {
      system: `${system}\n\nSystem Context:\n${systemMeta}`,
      user,
    };
  }
}
