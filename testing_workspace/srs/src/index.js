import { srs } from '../../../src/core/rag.js';

export default {
	async fetch(request, env) {
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		};

		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		if (request.method !== 'POST') {
			return new Response(JSON.stringify({ error: 'Use POST' }), {
				status: 405,
				headers: corsHeaders,
			});
		}

		try {
			const body = await request.json();
			const vectorDBs = {
				installDocs: {
					binding: 'solar-install', // this must match your AutoRAG binding name
					description: 'Solar installation manuals',
				},
			};

			const llmConfig = {
				provider: env.LLM_PROVIDER,
				model: env.LLM_MODEL,
				temperature: 0.7,
				maxOutputTokens: 50,
				estCharsPerToken: 4,
				api_key: env.API_KEY, // secret injected by wrangler
			};

			console.log(body.query);

			const result = await srs({
				query: body.query,
				pipelines: vectorDBs,
				llmConfig,
				env,
			});

			return new Response(JSON.stringify({ output: result.answer }, null, 2), {
				headers: { 'Content-Type': 'application/json', ...corsHeaders },
			});
		} catch (err) {
			return new Response(JSON.stringify({ error: err.message || String(err) }), {
				status: 500,
				headers: corsHeaders,
			});
		}
	},
};
