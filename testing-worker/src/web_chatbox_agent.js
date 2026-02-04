
import { Pipeline } from '../../src/core/pipeline'; // Adjust path if needed
import { z } from 'zod';

async function webChatboxAgent(body, env) {
    // 1. Define a Custom External Tool (Calculator)
    const calculatorTool = {
        name: "family-tree",
        description: "A useful tool for knowing the relative name",
        // Zod Schema defines the shape of the JSON the LLM must send
        schema: z.object({
            relation: z.enum(["mother", "father", "sister", "brother"]).describe("relation with the user"),
        }),
        // The actual JavaScript logic to execute
        func: async ({ relation }) => {
            console.log(`[Tool:Calculator] Executing: ${relation}`);
            switch (relation) {
                case "mother": return "mother is farha";
                case "father": return "father is talha";
                case "sister": return "sister is maryam";
                case "brother": return "brother is saad";
                default: return "Error: Unknown operation";
            }
        }
    };

    // 2. Define Weather Tool
    const weatherTool = {
        name: "get_weather",
        description: "Get the current weather for a specific city.",
        schema: z.object({
            city: z.string().describe("The city name, e.g. London, New York"),
        }),
        func: async ({ city }) => {
            console.log(`[Tool:Weather] Checking weather for: ${city}`);
            const conditions = ["Sunny", "Cloudy", "Rainy", "Snowy"];
            const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];
            const temp = Math.floor(Math.random() * 30) + 10; // 10-40 celsius
            return JSON.stringify({
                city,
                temperature: `${temp}°C`,
                condition: randomCondition,
                humidity: "50%"
            });
        }
    };

    // 3. Define Flight Search Tool
    const flightSearchTool = {
        name: "search_flights",
        description: "Search for available flights. Returns a list of flights with IDs.",
        schema: z.object({
            departure: z.string().describe("Departure city code (e.g. LHR)"),
            destination: z.string().describe("Destination city code (e.g. JFK)"),
            date: z.string().describe("Date of travel (YYYY-MM-DD)")
        }),
        func: async ({ departure, destination, date }) => {
            console.log(`[Tool:FlightSearch] Searching for ${departure} -> ${destination} on ${date}`);
            // Mock Data
            return JSON.stringify({
                available_flights: [
                    { id: "FL-101", airline: "NovaAir", time: "10:00 AM", price: "$500" },
                    { id: "FL-202", airline: "TechJet", time: "02:00 PM", price: "$450" },
                    { id: "FL-303", airline: "CloudWings", time: "08:00 PM", price: "$600" }
                ]
            });
        }
    };

    // 4. Define Flight Booking Tool
    const flightBookingTool = {
        name: "book_ticket",
        description: "Book a flight using a flight ID. REQUIRES flight_id from search_flights.",
        schema: z.object({
            flight_id: z.string().describe("The ID of the flight to book (e.g. FL-101)"),
            passenger_name: z.string().describe("Name of the passenger")
        }),
        func: async ({ flight_id, passenger_name }) => {
            console.log(`[Tool:FlightBooking] Booking ${flight_id} for ${passenger_name}`);
            if (!flight_id.startsWith("FL-")) {
                return "Error: Invalid Flight ID. Please search for flights first.";
            }
            return JSON.stringify({
                status: "CONFIRMED",
                booking_reference: `BK-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
                flight: flight_id,
                passenger: passenger_name,
                message: "Your ticket has been booked successfully sent to your email."
            });
        }
    };


    // 2. Setup and Run

    // Check for API Keys
    if (!env.OPENAI_API_KEY && !env.GROQ_API_KEY) {
        console.error("❌ Error: Please set OPENAI_API_KEY or GROQ_API_KEY in your .env file.");
        throw new Error("Missing API Keys");
    }

    // 3. Initialize the Pipeline
    const agent = new Pipeline({
        verbose: env.VERBOSE === 'true',
        // Context Manager Config (Memory)
        ctxManagerConfig: {
            clientId: "test-user-01",
            agentId: "nova-math-agent",
            memory: {
                memoryType: "buffer", // Use simple in-memory buffer for testing (no DB needed)
                limitTurns: 10,
                kvNamespace: env.KV_NAMESPACE,
            },
            srs: {
                env,
                pipelines: {
                    nova: {
                        binding: 'testing-rag',
                        description: 'Technical docs'
                    }
                },
                llmConfig: {
                    model: env.LLM_MODEL,
                    temperature: 0.7,
                    cloudflare: {
                        accountId: env.CF_ACCOUNT_ID,
                        gatewayId: env.CF_GATEWAY_NAME,
                        cfAIGToken: env.CF_AIG_TOKEN
                    },

                }
            }

        },

        // LLM Config (Provider: OpenAI or Groq)
        llmConfig: {
            model: env.LLM_MODEL,
            verbose: env.VERBOSE === 'true',
            api_keys: {
                openai: env.OPENAI_API_KEY,
                groq: env.GROQ_API_KEY,
                gemini: env.GEMINI_API_KEY
            },
            cloudflare: {
                accountId: env.CF_ACCOUNT_ID,
                gatewayId: env.CF_GATEWAY_NAME,
                cfAIGToken: env.CF_AIG_TOKEN
            },
        },

        // Prompt Builder Config
        promptBuilderConfig: {
            systemPrompt: "You are a helpful AI agent with access to several tools. Use 'family-tree' for relations, 'get_weather' for weather, and 'search_flights'/'book_ticket' for travel. Always use the appropriate tool for the user's request."
        },

        // 4. Inject External Tools 
        tools: [calculatorTool, weatherTool, flightSearchTool, flightBookingTool]
    });

    // 5. Run the "Thinking" Loop
    const userQuery = body.userPrompt;

    console.log(`👤 User: "${userQuery}"`);
    console.log("🤖 Agent: Thinking...");

    try {
        const response = await agent.run(userQuery);

        console.log("\n✅ Final Response:");
        console.log("-----------------------------------");
        console.log(response);
        console.log("-----------------------------------");

        // Return object to match index.js expectation (result.content)
        return { content: response };

    } catch (error) {
        console.error("\n❌ Pipeline Failed:", error);
        throw error;
    }
}

export default webChatboxAgent;