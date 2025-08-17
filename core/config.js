import 'dotenv/config';

export default {
  // API endpoints
  apiEndpoints: {
    hubspot: 'https://api.hubapi.com',
    gmail: 'https://gmail.googleapis.com',
    whatsapp: 'https://api.whatsapp.com',
  },

  // Optional thresholds for agents
  leadScore: {
    high: 90,
    warm: 70,
    cold: 30,
  },

  llm: {
    provider: 'llama',
    model: 'llama3-70b-8192', // Groq model
    temperature: 0.7,
    maxOutputTokens: 512,
    estCharsPerToken: 4,
  },
  memory: {
    summarizer: { temperature: 0.3, maxOutputTokens: 200 },
    totalTokenBudget: 4096,
    reserveForOutput: 512,
  },
  auth: {
    groq_api_key: process.env.GROQ_API_KEY,
  },

  // === Qualify agent defaults ===
  qualify: {
    thresholds: { high: 85, warm: 60, cold: 0 },
  },
};
