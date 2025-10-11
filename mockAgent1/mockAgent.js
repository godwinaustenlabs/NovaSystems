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
    clientId: 'testClient1',
    agentId: 'CaptureAgent1',

    systemPrompt: `You are a chatbot working on the webiste of Highnoon Solar, a solar energy solutions provider. Your task is to assist users with information about solar energy, products, and services offered by Highnoon Solar. Provide accurate and helpful responses based on the information you get from the srs tool. You will use srs everytime to get information regarding user query and then answer the user query based on that information. If you are unable to find the information, politely inform the user that you do not have the answer at the moment.`,
    userPrompt: input,

    useScratchpad: true,
    memoryType: 'dynamic',
    limitTurns: 4,

    adapter: {
      kvNamespace: 'KV_NAMESPACE',
      namespaceId: '',
      aiBinding: 'AI_BINDING',
      accountId: 'ec758d282b2c89b4a1a147b64f445849',
      apiToken: 'NhQdSUiyJY2UFErA3xkcEsPN_IwWB4Z1hPx-KWXV',
    },

    summarizer: {
      maxOutputTokens: 200,
      totalTokenBudget: 712,
      reserveForOutput: 700,
      llmConfig: {
        // llmConfig is used in ctxmanager to configure llm for SRS calls
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        verbose: true,
        api_keys: {
          groq: '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',
          openai:
            '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',
          gemini: 'AIzaSyCCrKHwXB40VqR9TfsjZb7mdav0Pp0forc',
        },
        // cloudflare: { accountId: env.CF_ACCOUNT_ID, gatewayId: env.CF_GATEWAY_NAME, cfAIGToken: env.CF_API_KEY },
      },
    },

    tools: {},

    // provider: env.LLM_PROVIDER,
    llmConfig: {
      // llmConfig is used in ctxmanager to configure llm for SRS calls
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      maxOutputTokens: 512,
      estCharsPerToken: 4,
      verbose: true,
      api_keys: {
        groq: '',
        openai: '',
        gemini: '',
      },
      // cloudflare: { accountId: env.CF_ACCOUNT_ID, gatewayId: env.CF_GATEWAY_NAME, cfAIGToken: env.CF_API_KEY },
    },
    ragProvider: null,
    RAGPrecontext: null,
    pipelines: {
      solarInstall: {
        binding: 'solar-install',
        description: 'Docs about installing solar systems',
      },
    },

    maxToolLoop: 6,
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
    // const result = JSON.stringify(await pipeline.run(), null, 2);
    const result = await pipeline.run();
    console.log({ result });

    rl.prompt();
  });
}

main();
