import webChatboxAgent from './web_chatbox_agent.js';

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
};
// Export Durable Object classes so Wrangler knows about them
export default {
	async fetch(request, env) {
		const url = new URL(request.url);

		// ================================
		// CORS
		// ================================
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		// ================================
		// WEB CHATBOX
		// ================================
		if (url.pathname === '/web') {
			if (request.method !== 'POST') {
				return new Response('Method Not Allowed', {
					status: 405,
					headers: corsHeaders,
				});
			}

			let body;
			try {
				body = await request.json();
			} catch {
				return new Response(
					JSON.stringify({ error: 'Invalid JSON body' }),
					{
						status: 400,
						headers: {
							...corsHeaders,
							'Content-Type': 'application/json',
						},
					}
				);
			}

			try {
				const result = await webChatboxAgent(body, env);

				return new Response(
					JSON.stringify(result.content),
					{
						status: 200,
						headers: {
							...corsHeaders,
							'Content-Type': 'application/json',
						},
					}
				);
			} catch (err) {
				return new Response(
					JSON.stringify({ error: err.status }),
					{
						status: 500,
						headers: {
							...corsHeaders,
							'Content-Type': 'application/json',
						},
					}
				);
			}
		}

		// ================================
		// FALLBACK
		// ================================
		return new Response('Not Found', { status: 404, headers: corsHeaders });
	},
};