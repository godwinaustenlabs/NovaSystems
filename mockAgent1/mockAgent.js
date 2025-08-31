import { Pipeline } from '../src/index.js'; // ✅ adjust relative path if needed

import 'dotenv/config';
import readline from 'readline';

// CLI interface for interacting with the agent
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '>>> ',
});

/**
 * Build a NAS request dynamically from user input.
 * Keeps config consistent with pipeline requirements.
 */
function buildNASRequest(input) {
  return {
    clientId: 'client123',
    agentId: 'novaCaptureAgent',

    // System/User prompts
    systemPrompt:
      'You are an AI assistant. Be short, precise, and save tokens.',
    userPrompt: input,

    // Memory & scratchpad
    useScratchpad: true,
    memoryType: 'dynamic', // could be buffer | summary | dynamic
    limitTurns: 3,
    summarizer: {
      temperature: 0.3,
      maxOutputTokens: 200,
      totalTokenBudget: 712,
      reserveForOutput: 500,
      provider: 'groq',
      api_key: process.env.API_KEY,
      model: 'llama3-70b-8192',
    }, // Summarizer config (for memory reduction if needed)

    // Available tools
    tools: {
      search: { description: 'Search the web for latest information' },
      calculator: { description: 'Do financial calculations' },
    },

    // LLM provider setup
    provider: 'groq',
    model: 'llama3-70b-8192', // Groq model
    temperature: 0.7,
    maxOutputTokens: 512,
    estCharsPerToken: 4,
    verbose: false,
    api_key: process.env.API_KEY,
  };
}

async function main() {
  console.log("🚀 NAS Runner Started. Type 'exit' to quit.\n");
  rl.prompt();

  rl.on('line', async (line) => {
    const trimmed = line.trim();

    if (trimmed.toLowerCase() === 'exit') {
      rl.close();
      return;
    }
    // // Build NAS request from user input
    let request = buildNASRequest(trimmed);

    // async function agent(request) {

    //   // Initialize pipeline
    //   const pipeline = new Pipeline(request, 'parsed');

    //   // Run pipeline
    //   const result = await pipeline.run();

    //   return {
    //     request,
    //     result,
    //   };
    // }
    // const finalOutput = await withNASValidation(request, agent)();
    // // agent(request);

    // // Display results

    // // console.log(JSON.stringify(finalOutput, null, 2));
    // console.log(finalOutput);

    // Initialize pipeline
    const pipeline = new Pipeline(request, 'parsed');

    // Run pipeline
    const result = await pipeline.run();
    console.log(result);

    rl.prompt();
  });
}

main();
