// runner.js
import readline from 'readline';
import { agent } from './agent.js';
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '>>> ',
});

// Build NAS request
function buildNASRequest(input) {
  return {
    systemPrompt: 'You are an AI assistant.',
    userPrompt: input, // ✅ now use actual user input, not hardcoded
    useScratchPad: true,
    memoryType: 'dynamic',
    tools: {
      search: { description: 'Search the web for latest information' },
      calculator: { description: 'Do financial calculations' },
    },
    clientId: 'client123',
    agentId: 'solarAgent',
  };
}

async function main() {
  console.log("NAS Runner Started. Type 'exit' to quit.");
  rl.prompt();

  rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (trimmed.toLowerCase() === 'exit') {
      rl.close();
      return;
    }

    try {
      // Build request same as agent.js
      const request = buildNASRequest(trimmed);

      // Run agent
      const response = await agent(request);
    } catch (err) {
      console.error('❌ Error:', err.message);
    }

    rl.prompt();
  });
}

main();
