#!/usr/bin/env node

// Load environment variables from .env file
require('dotenv').config();

const { MCPServer } = require('./src/server');

// Start the server
const server = new MCPServer();
server.run().catch((error) => {
	console.error('[MCP Server] Failed to start server:', error);
	process.exit(1);
});