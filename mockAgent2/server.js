import express from 'express';
import bodyParser from 'body-parser';
import 'dotenv/config.js';
import { Pipeline } from '../index.js';
import { withNASValidation } from '../index.js';

const app = express();
app.use(bodyParser.json());

// Build NAS request dynamically from frontend input
function buildNASRequest(input) {
  return {
    clientId: 'client123',
    agentId: 'novaCaptureAgent',
    systemPrompt:
      'You are a demo AI Assistant developed using Nova Systems, a proprietary framework for developing AI Agents made by Godwin Austen Labs in Pakistan.',
    userPrompt: input,
    useScratchpad: true,
    memoryType: 'dynamic',
    limitTurns: 3,
    summarizer: {
      temperature: 0.3,
      maxOutputTokens: 200,
      totalTokenBudget: 712,
      reserveForOutput: 500,
      provider: 'groq',
      api_key: process.env.API_KEY,
      model: 'llama3-70b-8192',
    },
    tools: {},
    provider: 'groq',
    model: 'llama3-70b-8192',
    temperature: 0.7,
    maxOutputTokens: 512,
    estCharsPerToken: 4,
    verbose: true,
    api_key: process.env.API_KEY,
  };
}

// Chat endpoint
app.post('/chat', async (req, res) => {
  const message = req.body.message;
  console.log('Received message: ', message);

  const request = buildNASRequest(message);

  async function agent(request) {
    const pipeline = new Pipeline(request, 'parsed');
    const result = await pipeline.run();
    return { request, result };
  }

  const finalOutput = await withNASValidation(request, agent)();
  console.log('Final output: ', finalOutput);
  res.json({
    reply:
      finalOutput?.result?.content ??
      `Status: ${finalOutput.status}\nError message: ${finalOutput?.error?.message}` ??
      'No response.',
  });
});

app.use(express.static('public')); // serve index.html from /public

app.listen(3000, '0.0.0.0', () => {
  console.log('Server running on http://0.0.0.0:3000');
});
