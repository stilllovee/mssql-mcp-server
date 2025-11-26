const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const express = require('express');

const { SQLExecutor } = require('../tools/sqlExecutor');

// Define tools once to avoid duplication
const TOOLS_DEFINITION = [
	{
		name: 'sql_execute_query',
		description: 'Execute a SQL query against SQL Server database. Returns query results or error details.',
		inputSchema: {
			type: 'object',
			properties: {
				query: {
					type: 'string',
					description: 'The SQL query to execute (SELECT, INSERT, UPDATE, DELETE, etc.)',
				},
				params: {
					type: 'object',
					description: 'Optional parameters for parameterized queries (key-value pairs)',
				},
			},
			required: ['query'],
		},
	},
	{
		name: 'sql_execute_dql',
		description: 'Execute DQL (Data Query Language) statements - specifically SELECT queries. This is optimized for read-only queries and includes validation to ensure only SELECT statements are executed.',
		inputSchema: {
			type: 'object',
			properties: {
				query: {
					type: 'string',
					description: 'The SELECT query to execute. Supports CTEs (WITH clause) and all SELECT variations.',
				},
				params: {
					type: 'object',
					description: 'Optional parameters for parameterized queries (key-value pairs)',
				},
			},
			required: ['query'],
		},
	},
	{
		name: 'sql_execute_dml',
		description: 'Execute DML (Data Manipulation Language) statements - INSERT, UPDATE, DELETE, MERGE. This is optimized for data modification operations and includes validation to ensure only DML statements are executed.',
		inputSchema: {
			type: 'object',
			properties: {
				query: {
					type: 'string',
					description: 'The DML statement to execute (INSERT, UPDATE, DELETE, or MERGE).',
				},
				params: {
					type: 'object',
					description: 'Optional parameters for parameterized queries (key-value pairs)',
				},
			},
			required: ['query'],
		},
	},
	{
		name: 'sql_execute_ddl',
		description: 'Execute DDL (Data Definition Language) statements - CREATE, ALTER, DROP, TRUNCATE, etc. WARNING: Use with extreme caution as these operations modify or destroy database structure and cannot be rolled back easily.',
		inputSchema: {
			type: 'object',
			properties: {
				query: {
					type: 'string',
					description: 'The DDL statement to execute (CREATE, ALTER, DROP, TRUNCATE, RENAME, COMMENT).',
				},
				params: {
					type: 'object',
					description: 'Optional parameters for parameterized queries (key-value pairs)',
				},
			},
			required: ['query'],
		},
	},
	{
		name: 'sql_execute_procedure',
		description: 'Execute a stored procedure in SQL Server database. Returns procedure results or error details.',
		inputSchema: {
			type: 'object',
			properties: {
				procedure_name: {
					type: 'string',
					description: 'The name of the stored procedure to execute',
				},
				params: {
					type: 'object',
					description: 'Parameters for the stored procedure (key-value pairs)',
				},
			},
			required: ['procedure_name'],
		},
	},
	{
		name: 'sql_get_database_info',
		description: 'Get SQL Server database connection information including version, database name, server name, and login name.',
		inputSchema: {
			type: 'object',
			properties: {},
			required: [],
		},
	},
	{
		name: 'sql_discover_tables',
		description: 'Discover all tables in the SQL Server database. Optionally filter by schema name.',
		inputSchema: {
			type: 'object',
			properties: {
				schema: {
					type: 'string',
					description: 'Optional schema name to filter tables (e.g., "dbo", "sales")',
				},
			},
			required: [],
		},
	},
	{
		name: 'sql_get_table_info',
		description: 'Get detailed information about a specific table including columns, data types, constraints, indexes, foreign keys, and row count.',
		inputSchema: {
			type: 'object',
			properties: {
				table_name: {
					type: 'string',
					description: 'The name of the table to get information about',
				},
				schema: {
					type: 'string',
					description: 'Optional schema name (defaults to "dbo")',
				},
			},
			required: ['table_name'],
		},
	},
];

class MCPServer {
	constructor(dbConfig = null) {
		this.server = new Server(
			{
				name: 'mssql-mcp-server',
				version: '1.0.0',
			},
			{
				capabilities: {
					tools: {},
				},
			}
		);

		// Initialize database with optional config
		this.sqlExecutor = new SQLExecutor(dbConfig);

		// Store SSE transports by session ID
		this.transports = {};

		this.setupToolHandlers();
		this.setupErrorHandling();
	}

	setupToolHandlers() {
		this.setupToolHandlersForServer(this.server);
	}

	setupToolHandlersForServer(server) {
		// List available tools
		server.setRequestHandler(ListToolsRequestSchema, async () => {
			return { tools: TOOLS_DEFINITION };
		});

		// Handle tool calls
		server.setRequestHandler(CallToolRequestSchema, async (request) => {
			const { name, arguments: args } = request.params;
			try {
				if (name === 'sql_execute_query') {
					return await this.sqlExecutor.executeQuery(args.query, args.params || {});
				}

				if (name === 'sql_execute_dql') {
					return await this.sqlExecutor.executeDQL(args.query, args.params || {});
				}

				if (name === 'sql_execute_dml') {
					return await this.sqlExecutor.executeDML(args.query, args.params || {});
				}

				if (name === 'sql_execute_ddl') {
					return await this.sqlExecutor.executeDDL(args.query, args.params || {});
				}

				if (name === 'sql_execute_procedure') {
					return await this.sqlExecutor.executeProcedure(args.procedure_name, args.params || {});
				}

				if (name === 'sql_get_database_info') {
					return await this.sqlExecutor.getDatabaseInfo();
				}

				if (name === 'sql_discover_tables') {
					return await this.sqlExecutor.discoverTables(args.schema || null);
				}

				if (name === 'sql_get_table_info') {
					return await this.sqlExecutor.getTableInfo(args.table_name, args.schema || 'dbo');
				}
			} catch (error) {
				console.error(`[MCP Server] Error executing tool ${name}:`, error);
				throw new Error(`Tool execution failed: ${error.message}`);
			}

			throw new Error(`Unknown tool: ${name}`);
		});
	}

	setupErrorHandling() {
		this.server.onerror = (error) => {
			console.error('[MCP Error]', error);
		};

		process.on('SIGINT', async () => {
			await this.server.close();
			if (this.sqlExecutor) {
				await this.sqlExecutor.close();
			}
			process.exit(0);
		});
	}

	async run(mode = 'stdio', port = 3000) {
		if (mode === 'sse') {
			await this.runSSE(port);
		} else {
			await this.runStdio();
		}
	}

	async runStdio() {
		const transport = new StdioServerTransport();
		await this.server.connect(transport);
		console.error('[MCP Server] MCP Server running on stdio');
	}

	async runSSE(port = 3000) {
		const app = express();
		app.use(express.json());

		// Health check endpoint
		app.get('/health', (req, res) => {
			res.json({ status: 'ok', mode: 'sse' });
		});

		// SSE endpoint for establishing the stream
		app.get('/sse', async (req, res) => {
			console.error('[MCP Server] Received GET request to /sse (establishing SSE stream)');
			try {
				// Create a new SSE transport for the client
				const transport = new SSEServerTransport('/messages', res);
				const sessionId = transport.sessionId;
				this.transports[sessionId] = transport;

				// Set up onclose handler to clean up transport when closed
				transport.onclose = () => {
					console.error(`[MCP Server] SSE transport closed for session ${sessionId}`);
					delete this.transports[sessionId];
				};

				// Create a new server instance for this connection
				const server = new Server(
					{
						name: 'mssql-mcp-server',
						version: '1.0.0',
					},
					{
						capabilities: {
							tools: {},
						},
					}
				);

				// Setup handlers for this new server instance
				this.setupToolHandlersForServer(server);

				// Connect the transport to the MCP server
				await server.connect(transport);
				console.error(`[MCP Server] Established SSE stream with session ID: ${sessionId}`);
			} catch (error) {
				console.error('[MCP Server] Error establishing SSE stream:', error);
				if (!res.headersSent) {
					res.status(500).send('Error establishing SSE stream');
				}
			}
		});

		// Messages endpoint for receiving client JSON-RPC requests
		app.post('/messages', async (req, res) => {
			console.error('[MCP Server] Received POST request to /messages');
			const sessionId = req.query.sessionId;

			if (!sessionId) {
				console.error('[MCP Server] No session ID provided in request URL');
				res.status(400).send('Missing sessionId parameter');
				return;
			}

			const transport = this.transports[sessionId];
			if (!transport) {
				console.error(`[MCP Server] No active transport found for session ID: ${sessionId}`);
				res.status(404).send('Session not found');
				return;
			}

			try {
				await transport.handlePostMessage(req, res, req.body);
			} catch (error) {
				console.error('[MCP Server] Error handling request:', error);
				if (!res.headersSent) {
					res.status(500).send('Error handling request');
				}
			}
		});

		// Start the HTTP server
		const httpServer = app.listen(port, () => {
			console.error(`[MCP Server] SSE server listening on port ${port}`);
			console.error(`[MCP Server] Connect to SSE at http://localhost:${port}/sse`);
			console.error(`[MCP Server] Send messages to http://localhost:${port}/messages`);
		});

		// Handle server shutdown
		process.on('SIGINT', async () => {
			console.error('[MCP Server] Shutting down SSE server...');
			for (const sessionId in this.transports) {
				try {
					console.error(`[MCP Server] Closing transport for session ${sessionId}`);
					await this.transports[sessionId].close();
					delete this.transports[sessionId];
				} catch (error) {
					console.error(`[MCP Server] Error closing transport for session ${sessionId}:`, error);
				}
			}
			httpServer.close();
			if (this.sqlExecutor) {
				await this.sqlExecutor.close();
			}
			console.error('[MCP Server] Server shutdown complete');
			process.exit(0);
		});
	}
}

module.exports = {
	MCPServer: MCPServer,
};