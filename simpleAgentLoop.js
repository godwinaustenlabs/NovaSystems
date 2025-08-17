// agents/nova-capture/agent.js
import { Pipeline } from './core/pipeline.js';
import readline from 'node:readline/promises';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("Nova Agent Chat started. Type 'exit' to quit.\n");

async function chatLoop() {
  while (true) {
    const input = await rl.question('You: ');

    if (input.toLowerCase() === 'exit') {
      console.log('Exiting chat.');
      rl.close();
      break;
    }

    try {
      const pipeline = new Pipeline({
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
      });

      const result = await pipeline.run();

      console.log('RAW LLM Output:\n', result.raw);
      console.log('PARSED NAS:\n', result.parsed);
    } catch (err) {
      console.error('Error in agent:', err);
    }
  }
}

chatLoop();
