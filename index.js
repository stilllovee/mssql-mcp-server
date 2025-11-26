#!/usr/bin/env node

// Load environment variables from .env file
require('dotenv').config();

const { MCPServer } = require('./src/server');

// Parse command line arguments
const args = process.argv.slice(2);
let mode = process.env.MCP_TRANSPORT || 'stdio';
let port = parseInt(process.env.MCP_PORT || '3000', 10);

// Parse --sse and --port arguments
for (let i = 0; i < args.length; i++) {
	if (args[i] === '--sse') {
		mode = 'sse';
	} else if (args[i] === '--port' && args[i + 1]) {
		port = parseInt(args[i + 1], 10);
		i++;
	} else if (args[i].startsWith('--port=')) {
		port = parseInt(args[i].split('=')[1], 10);
	}
}

// Start the server
const server = new MCPServer();
server.run(mode, port).catch((error) => {
	console.error('[MCP Server] Failed to start server:', error);
	process.exit(1);
});