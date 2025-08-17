// agents/nova-capture/agent.js
import { withNASValidation } from './core/withNASValidation.js';
import { Pipeline } from './core/pipeline.js';

export async function agent(requestBody) {
  const {
    agentId,
    clientId,
    systemPrompt,
    userPrompt,
    useScratchPad,
    memoryType,
    tools,
    lastToolResponse,
  } = requestBody;

  // Initialize pipeline WITH full config
  const pipeline = new Pipeline({
    systemPrompt: systemPrompt || 'You are an AI assistant.',
    userPrompt: userPrompt || '',
    useScratchPad: useScratchPad || false,
    memoryType: memoryType || 'dynamic',
    tools: tools || {},
    clientId: clientId || 'defaultClient',
    agentId: agentId || 'defaultAgent',
  });

  // Run the pipeline
  const result = await pipeline.run();

  console.log('RAW LLM Output:\n', result.raw);
  console.log('PARSED NAS:\n', result.parsed);
  return;
}

// Optional: wrap with NAS validation
export const NovaAgent = withNASValidation(agent);
