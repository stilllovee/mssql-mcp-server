#!/usr/bin/env node

// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { MCPServerHTTP } = require('./src/server/MCPServerHTTP');
const { AzureTableStorageService } = require('./src/services/azureTableStorage');

// Default port
let PORT = 8123;

// API key mapping mode flag (set to true to enable API key-based connection mapping)
const USE_API_KEY_MAPPING = process.env.USE_API_KEY_MAPPING === 'true' || false;

// Azure Table Storage connection string (required when API key mapping is enabled)
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const AZURE_TABLE_NAME = process.env.AZURE_TABLE_NAME || 'ApiKeyMappings';

// Parse command-line arguments for --port=XXXX and --api-key-mode
for (let i = 2; i < process.argv.length; i++) {
	const arg = process.argv[i];
	if (arg.startsWith('--port=')) {
		const value = parseInt(arg.split('=')[1], 10);
		if (!isNaN(value)) {
			PORT = value;
		} else {
			console.error('Invalid value for --port');
			process.exit(1);
		}
	}
}

// Initialize Azure Table Storage service if using API key mapping
let azureTableService = null;
if (USE_API_KEY_MAPPING) {
	if (!AZURE_STORAGE_CONNECTION_STRING) {
		console.error('[MCP Server] ❌ Error: AZURE_STORAGE_CONNECTION_STRING is required when USE_API_KEY_MAPPING is enabled');
		process.exit(1);
	}
	
	azureTableService = new AzureTableStorageService(AZURE_STORAGE_CONNECTION_STRING, AZURE_TABLE_NAME);
	console.log('[MCP Server] 🔑 API key mapping mode enabled with Azure Table Storage');
	console.log(`[MCP Server] 📊 Using table: ${AZURE_TABLE_NAME}`);
} else {
	console.log('[MCP Server] Single connection mode (using environment config)');
}

// Initialize MCP Server with API key mapping mode and Azure Table Storage service
const mcpServer = new MCPServerHTTP(null, USE_API_KEY_MAPPING, azureTableService);

if (USE_API_KEY_MAPPING) {
	console.log('[MCP Server] 🔑 API key mapping mode enabled');
	console.log('[MCP Server] Each request must include "x-api-key" header');
	console.log('[MCP Server] API keys are validated against Azure Table Storage');
} else {
	console.log('[MCP Server] Single connection mode (using environment config)');
}

const app = express();
app.use(express.json());

const router = express.Router();

// Single endpoint for the client to send messages to
const MCP_ENDPOINT = '/mcp';

router.post(MCP_ENDPOINT, async (req, res) => {
	await mcpServer.handlePostRequest(req, res);
});

router.get(MCP_ENDPOINT, async (req, res) => {
	await mcpServer.handleGetRequest(req, res);
});

app.use('/', router);

app.listen(PORT, () => {
	console.log(`[MCP Server] MCP Streamable HTTP Server listening on port ${PORT}`);
	console.log(`[MCP Server] Endpoint: http://localhost:${PORT}${MCP_ENDPOINT}`);
});

process.on('SIGINT', async () => {
	console.log('\n[MCP Server] Shutting down server...');
	await mcpServer.cleanup();
	process.exit(0);
});
