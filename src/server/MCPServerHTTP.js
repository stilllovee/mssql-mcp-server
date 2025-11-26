const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const {
	CallToolRequestSchema,
	ListToolsRequestSchema,
	InitializeRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const { randomUUID } = require('crypto');

const { SQLExecutor } = require('../tools/sqlExecutor');

const SESSION_ID_HEADER_NAME = 'mcp-session-id';
const JSON_RPC = '2.0';

class MCPServerHTTP {
	constructor(dbConfig = null) {
		this.server = new Server(
			{
				name: 'mssql-mcp-server',
				version: '1.0.0',
			},
			{
				capabilities: {
					tools: {},
					logging: {},
				},
			}
		);

		// To support multiple simultaneous connections
		this.transports = {};

		// Initialize database with optional config
		this.sqlExecutor = new SQLExecutor(dbConfig);

		this.setupToolHandlers();
		this.setupErrorHandling();
	}

	async handleGetRequest(req, res) {
		const sessionId = req.headers['mcp-session-id'];
		if (!sessionId || !this.transports[sessionId]) {
			res.status(400).json(this.createErrorResponse('Bad Request: invalid session ID or method.'));
			return;
		}

		console.log(`[MCP Server] Establishing SSE stream for session ${sessionId}`);
		const transport = this.transports[sessionId];
		await transport.handleRequest(req, res);
		await this.streamMessages(transport);
	}

	async handlePostRequest(req, res) {
		const sessionId = req.headers[SESSION_ID_HEADER_NAME];
		let transport;

		try {
			// Reuse existing transport
			if (sessionId && this.transports[sessionId]) {
				transport = this.transports[sessionId];
				await transport.handleRequest(req, res, req.body);
				return;
			}

			// Create new transport
			if (!sessionId && this.isInitializeRequest(req.body)) {
				transport = new StreamableHTTPServerTransport({
					sessionIdGenerator: () => randomUUID(),
				});

				await this.server.connect(transport);
				await transport.handleRequest(req, res, req.body);

				// Session ID will only be available (if not in Stateless-Mode)
				// after handling the first request
				const newSessionId = transport.sessionId;
				if (newSessionId) {
					this.transports[newSessionId] = transport;
					console.log(`[MCP Server] Created new session: ${newSessionId}`);
				}

				return;
			}

			res.status(400).json(this.createErrorResponse('Bad Request: invalid session ID or method.'));
			return;
		} catch (error) {
			console.error('[MCP Server] Error handling MCP request:', error);
			res.status(500).json(this.createErrorResponse('Internal server error.'));
			return;
		}
	}

	async cleanup() {
		console.log('[MCP Server] Cleaning up...');
		await this.server.close();
		if (this.sqlExecutor) {
			await this.sqlExecutor.close();
		}
	}

	setupToolHandlers() {
		// List available tools
		this.server.setRequestHandler(ListToolsRequestSchema, async () => {
			return {
				tools: [
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
				],
			};
		});

		// Handle tool calls
		this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
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
	}

	// Send streaming messages via SSE
	async streamMessages(transport) {
		try {
			const message = {
				method: 'notifications/message',
				params: { level: 'info', data: 'SSE Connection established' },
			};

			this.sendNotification(transport, message);

			let messageCount = 0;

			const interval = setInterval(async () => {
				messageCount++;

				const data = `Message ${messageCount} at ${new Date().toISOString()}`;

				const message = {
					method: 'notifications/message',
					params: { level: 'info', data: data },
				};

				try {
					this.sendNotification(transport, message);

					if (messageCount === 3) {
						clearInterval(interval);

						const message = {
							method: 'notifications/message',
							params: { level: 'info', data: 'Streaming complete!' },
						};

						this.sendNotification(transport, message);
					}
				} catch (error) {
					console.error('[MCP Server] Error sending message:', error);
					clearInterval(interval);
				}
			}, 1000);
		} catch (error) {
			console.error('[MCP Server] Error sending message:', error);
		}
	}

	async sendNotification(transport, notification) {
		const rpcNotification = {
			...notification,
			jsonrpc: JSON_RPC,
		};
		await transport.send(rpcNotification);
	}

	createErrorResponse(message) {
		return {
			jsonrpc: '2.0',
			error: {
				code: -32000,
				message: message,
			},
			id: randomUUID(),
		};
	}

	isInitializeRequest(body) {
		const isInitial = (data) => {
			const result = InitializeRequestSchema.safeParse(data);
			return result.success;
		};
		if (Array.isArray(body)) {
			return body.some((request) => isInitial(request));
		}
		return isInitial(body);
	}
}

module.exports = {
	MCPServerHTTP,
};
