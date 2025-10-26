import { Pipeline } from '../../src/core/pipeline.js'; // adjust path

export default {
	async fetch(request, env) {
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		};

		// ✅ Handle preflight
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		// ✅ Validate method
		if (request.method !== 'POST') {
			return new Response(JSON.stringify({ error: 'Use POST' }), {
				status: 405,
				headers: corsHeaders,
			});
		}

		try {
			console.log('🚀 [Worker] Incoming request:', request.method, request.url);

			// ✅ Try reading body safely
			let body;
			try {
				body = await request.json();
			} catch (jsonErr) {
				console.error('❌ JSON parse error:', jsonErr);
				throw new Error(`Invalid JSON body: ${jsonErr.message}`);
			}

			console.log('📦 [Worker] Parsed body:', JSON.stringify(body, null, 2));

			// ✅ Build NAS request config
			const nasRequest = {
				userPrompt: body.userPrompt,

				promptBuilderConfig: {
					systemPrompt: `
You are a customer support agaent of Alaska Bar, an Ice cream shop.
Your tone is friendly and professional, you are designed to answer everything using the srs tool.
Your goal is to help customers with their queries, you'll find all the answers to all the questions using SRS tool.
NEVER SAY YOU DON'T KNOW, NEVER ASK QUESTIONS BACK, ALWAYS USE THE SRS TOOL TO FIND OUT THE QUERY AND ANSWER.`,
				},

				// provider: env.LLM_PROVIDER,
				llmConfig: {
					// llmConfig is used in ctxmanager to configure llm for SRS calls
					model: env.LLM_MODEL,
					temperature: 0.7,
					maxOutputTokens: 512,
					estCharsPerToken: 4,
					verbose: true,
					api_keys: { groq: env.GROQ_KEY, openai: env.OPENAI_KEY, gemini: env.GEMINI_KEY },
					cloudflare: { accountId: env.CF_ACCOUNT_ID, gatewayId: env.CF_GATEWAY_NAME, cfAIGToken: env.CF_AIG_TOKEN },
				},

				ctxManagerConfig: {
					memory: {
						clientId: body.clientID,
						agentId: 'alaska-bar',
						memoryType: 'dynamic',
						limitTurns: 4,
						kvNamespace: env.KV_NAMESPACE,
						summarizer: {
							maxOutputTokens: 200,
							totalTokenBudget: 712,
							reserveForOutput: 700,
							llmConfig: {
								model: env.LLM_MODEL,
								temperature: 0.7,
								verbose: true,
								cloudflare: { accountId: env.CF_ACCOUNT_ID, gatewayId: env.CF_GATEWAY_NAME, cfAIGToken: env.CF_AIG_TOKEN },

								api_keys: { groq: env.GROQ_KEY, openai: env.OPENAI_KEY, gemini: env.GEMINI_KEY },
							},
						},
					},
					scratchpad: {
						clientId: 'alaska-bar',
						agentId: 'alaska-bar',
						useScratchpad: true,
					},
					srs: {
						pipelines: {
							nova: {
								binding: 'alaska-bar',
								description: 'Details about Alaska Bar Products like menu, timings and prices of products.',
							},
						}, // registry of available pipelines for SRS
						env: env || null, // Cloudflare Worker env (for RAG)
						llmConfig: {
							// llmConfig is used in ctxmanager to configure llm for SRS calls
							model: env.LLM_MODEL,
							temperature: 0.7,
							maxOutputTokens: 512,
							estCharsPerToken: 4,
							verbose: true,
							api_keys: { groq: env.GROQ_KEY, openai: env.OPENAI_KEY, gemini: env.GEMINI_KEY },

							cloudflare: { accountId: env.CF_ACCOUNT_ID, gatewayId: env.CF_GATEWAY_NAME, cfAIGToken: env.CF_AIG_TOKEN },
						},
					}, // LLM config for RAG calls
					ragPrecontext: null, // external RAG provider (Pinecone etc)
				},

				maxToolLoop: 6,
			};

			console.log('🧠 [Worker] Starting pipeline with NAS request...');
			const pipeline = new Pipeline(nasRequest, 'parsed');
			const result = await pipeline.run();

			console.log('✅ [Worker] Pipeline completed successfully');
			console.log('🧾 [Worker] Result content:', result);

			return new Response(JSON.stringify({ result: result.content }), {
				status: 200,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		} catch (err) {
			console.error('🔥 [Worker] Uncaught Error');
			console.error('Message:', err.message);
			console.error('Stack:', err.stack);

			// If the error has a response body (like from fetch), log that too
			if (err.response) {
				try {
					const errBody = await err.response.text();
					console.error('📦 Error response body:', errBody);
				} catch {}
			}

			return new Response(
				JSON.stringify({
					error: err.message,
					stack: err.stack,
					hint: 'See Worker logs for detailed stack trace',
				}),
				{
					status: 500,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				},
			);
		}
	},
};
