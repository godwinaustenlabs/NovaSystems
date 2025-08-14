// utils/testWithNASValidation.js
import { withNASValidation } from '../../NovaAgents/shared/withNASValidation.js';

// 1️⃣ Example agent logic — just echoes input text back
async function mockAgentLogic(input) {
  return {
    status: 'success',
    agent_id: input.agent_id,
    response: {
      message: `You said: ${input.payload.input_text}`,
    },
    logs: {
      tokens_used: 10,
      processing_time_ms: 50,
    },
  };
}

// 2️⃣ Wrap the logic with validation
const validatedAgent = withNASValidation(mockAgentLogic);

// 3️⃣ Test with valid input
const validInput = {
  client_id: 'client123',
  agent_id: 'nova-qualify',
  context: {
    memory: { last_message: 'Hello' },
    tools: ['hubspot'],
    vector_sources: ['faq_vectors'],
  },
  payload: {
    input_text: "What's your pricing?",
    metadata: {
      channel: 'whatsapp',
      timestamp: new Date().toISOString(),
      language: 'en',
    },
  },
};

// 4️⃣ Test with invalid input
const invalidInput = {
  agent_id: 'nova-qualify',
};

console.log('✅ Valid Input Run:');
validatedAgent(validInput).then(console.log);

console.log('\n❌ Invalid Input Run:');
validatedAgent(invalidInput).then(console.log);
