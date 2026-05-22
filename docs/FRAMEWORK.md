# NovaSystems Framework Documentation

NovaSystems is a modular framework designed for building autonomous AI agents with a focus on extensible tool management and context handling.

## Architecture

- **`Core`**: The backbone of the system.
  - **`ContextManager`**: Orchestrates memory, RAG, and tools.
  - **`ToolRegistry`**: Central hub for registering and executing tools.
  - **`McpAdapter`**: Bridges external Model Context Protocol (MCP) servers with the framework.
- **`Memory`**: Handles long-term persistence of conversation history.
- **`Adapters`**: Modules to interface with external systems (e.g., MCP).

## Usage Guide

### 1. Registering Internal Tools
Use `ContextManager.initializeTools(registry)` for internal tools like Semantic Memory Search (SMS).

### 2. Integrating MCP Tools
The framework supports external MCP servers via the `McpAdapter`.

```javascript
import { McpAdapter } from './adapters/mcpAdapter.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

// 1. Initialize MCP Client
const mcpClient = new Client(...);
await mcpClient.connect(...);

// 2. Register tools automatically
await McpAdapter.registerMcpTools(mcpClient, registry);
```

The `McpAdapter` automatically discovers tools from the MCP server and registers them into your `ToolRegistry`, allowing your agent to use them immediately without manual definitions.
