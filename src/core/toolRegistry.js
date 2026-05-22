// ===============================
// File: toolRegistry.js
// Purpose: Central hub for registering, validating, and executing tools.
// ===============================

import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export class ToolRegistry {
    constructor(config = {}) {
        this.tools = new Map(); // Stores executable functions
        this.schemas = [];      // Stores JSON schemas for the LLM API
        this.logger = config.logger;
    }

    /**
     * Register a new tool for the agent to use.
     * @param {string} name - Unique name (e.g., "get_weather").
     * @param {string} description - Description for the LLM.
     * @param {z.ZodObject} parameters - Zod schema defining the arguments.
     * @param {Function} func - The async function to execute.
     */
    register(name, description, parameters, func) {
        if (this.tools.has(name)) {
            console.warn(`[ToolRegistry] Overwriting tool: ${name}`);
        }

        // 1. Store the executable function
        this.tools.set(name, func);

        let properties = {};
        let required = [];

        // 2. Determine if it's a Zod schema or raw JSON schema
        if (parameters && typeof parameters.parse === 'function') {
            // It's a native Zod schema
            const jsonSchema = zodToJsonSchema(parameters);
            properties = jsonSchema.properties || {};
            required = jsonSchema.required || [];
            
            if (Object.keys(properties).length === 0 && Object.keys(parameters.shape || {}).length > 0) {
                console.warn(`[ToolRegistry] WARNING: Schema conversion for '${name}' resulted in empty properties.`);
            }
        } else if (parameters && typeof parameters === 'object') {
            // It's a raw JSON schema
            properties = parameters.properties || {};
            required = parameters.required || [];
        } else {
            console.error(`[ToolRegistry] Error: Tool '${name}' has an invalid schema.`);
            return;
        }

        // 3. Add to API list
        // Note: For tools with no parameters, we omit `properties` entirely.
        // Gemini and some other providers reject empty `properties: {}` and produce
        // malformed tool calls like `toolname{}` when they encounter them.
        const hasProperties = Object.keys(properties).length > 0;
        const parametersSchema = hasProperties
            ? { type: "object", properties, required }
            : { type: "object" };

        this.schemas.push({
            type: "function",
            function: {
                name,
                description,
                parameters: parametersSchema,
            },
        });
    }

    /**
     * Executes a tool by name with provided arguments.
     */
    async execute(name, args) {
        const toolFunc = this.tools.get(name);
        if (!toolFunc) {
            return JSON.stringify({ error: `Tool '${name}' not found.` });
        }

        // Log Start
        if (this.logger) this.logger.toolStart(name, args);

        try {
            // Execute the function
            const result = await toolFunc(args);

            // Log End
            if (this.logger) this.logger.toolEnd(name, result);

            // Ensure result is a string for the LLM
            if (typeof result === 'object') {
                return JSON.stringify(result);
            }
            return String(result);
        } catch (err) {
            if (this.logger) this.logger.error("ToolRegistry", `Execution Error (${name})`, err.stack);
            console.error(`[ToolRegistry] Execution Error (${name}):`, err); // Fallback standard log
            return JSON.stringify({ error: err.message });
        }
    }

    getAPITools() {
        return this.schemas;
    }
}