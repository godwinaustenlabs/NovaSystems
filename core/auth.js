// shared/auth.js
import config from './config.js';

// Example in-memory token storage (can be replaced with KV / env variables)
const tokens = {
  hubspot: process.env.HUBSPOT_API_KEY || 'your-hubspot-api-key',
  gmail: process.env.GMAIL_API_KEY || 'your-gmail-api-key',
  whatsapp: process.env.WHATSAPP_API_KEY || 'your-whatsapp-api-key',
};

/**
 * Returns the API token for a given service
 * @param {string} service - e.g., "hubspot", "gmail"
 * @returns {string} - API key or token
 */
export function getAuthToken(service) {
  if (!tokens[service]) {
    throw new Error(`No API token found for service: ${service}`);
  }
  return tokens[service];
}

/**
 * Optional: refresh token logic per service (stub for now)
 */
export async function refreshToken(service) {
  // Implement real refresh logic if API supports it
  console.log(`Refreshing token for ${service}`);
  return tokens[service];
}
