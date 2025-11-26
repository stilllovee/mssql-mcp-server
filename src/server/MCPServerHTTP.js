const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const {
	CallToolRequestSchema,
	ListToolsRequestSchema,
	InitializeRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const { randomUUID } = require('crypto');

const { SQLExecutor } = require('../tools/sqlExecutor');
const { TOOL_DEFINITIONS } = require('../tools/toolDefinitions');

const SESSION_ID_HEADER_NAME = 'mcp-session-id';
const API_KEY_HEADER_NAME = 'x-api-key';
const JSON_RPC = '2.0';

class MCPServerHTTP {
	constructor(dbConfig = null, useApiKeyMapping = false, azureTableService = null) {
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

		// API key mapping mode
		this.useApiKeyMapping = useApiKeyMapping;
		console.log("🚀 ~ MCPServerHTTP ~ constructor ~ useApiKeyMapping:", useApiKeyMapping)
		
		// Azure Table Storage service for API key mappings
		this.azureTableService = azureTableService;
		
		// Store SQL executors per API key
		this.sqlExecutors = {};

		// Initialize database with optional config (only used when API key mapping is disabled)
		if (!useApiKeyMapping) {
			console.log("🚀 ~ MCPServerHTTP ~ constructor ~ dbConfig:", dbConfig)
			this.sqlExecutor = new SQLExecutor(dbConfig);
		}

		this.setupToolHandlers();
		this.setupErrorHandling();
	}

	/**
	 * Validate API key and get or create SQL executor for it
	 */
	async getSQLExecutorForApiKey(apiKey) {
		if (!apiKey) {
			throw new Error('API key is required');
		}

		// Get database configuration from Azure Table Storage
		if (!this.azureTableService) {
			throw new Error('Azure Table Storage service not configured');
		}

		const dbConfig = await this.azureTableService.getConnectionConfig(apiKey);
		if (!dbConfig) {
			throw new Error('Invalid API key');
		}

		// Return existing executor or create new one
		if (!this.sqlExecutors[apiKey]) {
			console.log(`[MCP Server] Creating SQL executor for API key: ${apiKey}`);
			console.log("🚀 ~ MCPServerHTTP ~ getSQLExecutorForApiKey ~ dbConfig:", dbConfig)
			this.sqlExecutors[apiKey] = new SQLExecutor(dbConfig);
		}

		return this.sqlExecutors[apiKey];
	}

	/**
	 * Get the appropriate SQL executor based on mode
	 */
	async getSQLExecutor(req) {
		if (this.useApiKeyMapping) {
			const apiKey = req.headers[API_KEY_HEADER_NAME];
			return await this.getSQLExecutorForApiKey(apiKey);
		}
		return this.sqlExecutor;
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
			// Validate API key if in API key mapping mode
			if (this.useApiKeyMapping) {
				const apiKey = req.headers[API_KEY_HEADER_NAME];
				if (!apiKey) {
					res.status(401).json(this.createErrorResponse('Unauthorized: API key is required'));
					return;
				}

				try {
					await this.getSQLExecutorForApiKey(apiKey);
				} catch (error) {
					res.status(401).json(this.createErrorResponse(`Unauthorized: ${error.message}`));
					return;
				}

				// Store current API key for this request
				this.currentApiKey = apiKey;
			}

			// Reuse existing transport
			if (sessionId && this.transports[sessionId]) {
				transport = this.transports[sessionId];

				// Update current API key from transport if available
				if (this.useApiKeyMapping && transport.apiKey) {
					this.currentApiKey = transport.apiKey;
				}

				await transport.handleRequest(req, res, req.body);
				return;
			}

			// Create new transport
			if (!sessionId && this.isInitializeRequest(req.body)) {
				transport = new StreamableHTTPServerTransport({
					sessionIdGenerator: () => randomUUID(),
				});

				// Store API key in transport for later use
				if (this.useApiKeyMapping) {
					transport.apiKey = req.headers[API_KEY_HEADER_NAME];
				}

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

		// Close single SQL executor if not using API key mapping
		if (this.sqlExecutor) {
			await this.sqlExecutor.close();
		}

		// Close all SQL executors in API key mapping mode
		if (this.useApiKeyMapping) {
			for (const apiKey in this.sqlExecutors) {
				await this.sqlExecutors[apiKey].close();
			}
		}
	}

	setupToolHandlers() {
		// List available tools
		this.server.setRequestHandler(ListToolsRequestSchema, async () => {
			return {
				tools: TOOL_DEFINITIONS,
			};
		});

		// Handle tool calls
		this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
			const { name, arguments: args } = request.params;
			let sqlExecutor;

			try {
				// Get the appropriate SQL executor based on the mode
				if (this.useApiKeyMapping) {
					const apiKey = this.currentApiKey;
					if (!apiKey) {
						throw new Error('No API key found for this request');
					}

					// Get connection config for this API key from Azure Table Storage
					const connectionConfig = await this.azureTableService.getConnectionConfig(apiKey);
					if (!connectionConfig) {
						throw new Error(`No database configuration found for API key: ${apiKey}`);
					}

					// Create a NEW SQL executor for EACH request to ensure proper transport binding
					console.log(`[MCP Server] Creating new SQL executor for API key: ${apiKey}, tool: ${name}`);
					sqlExecutor = new SQLExecutor(connectionConfig);
				} else {
					sqlExecutor = this.sqlExecutor;
				}

				let result;

				if (name === 'sql_execute_query') {
					result = await sqlExecutor.executeQuery(args.query, args.params || {});
				} else if (name === 'sql_execute_dql') {
					result = await sqlExecutor.executeDQL(args.query, args.params || {});
				} else if (name === 'sql_execute_dml') {
					result = await sqlExecutor.executeDML(args.query, args.params || {});
				} else if (name === 'sql_execute_ddl') {
					result = await sqlExecutor.executeDDL(args.query, args.params || {});
				} else if (name === 'sql_execute_procedure') {
					result = await sqlExecutor.executeProcedure(args.procedure_name, args.params || {});
				} else if (name === 'sql_get_database_info') {
					result = await sqlExecutor.getDatabaseInfo();
				} else if (name === 'sql_discover_tables') {
					result = await sqlExecutor.discoverTables(args.schema || null);
				} else if (name === 'sql_get_table_info') {
					result = await sqlExecutor.getTableInfo(args.table_name, args.schema || 'dbo');
				} else {
					throw new Error(`Unknown tool: ${name}`);
				}

				// Close the connection after request when using API key mapping
				if (this.useApiKeyMapping && sqlExecutor) {
					try {
						await sqlExecutor.close();
						console.log(`[MCP Server] Closed SQL executor connection after tool: ${name}`);
					} catch (closeError) {
						console.error('[MCP Server] Error closing SQL executor:', closeError);
					}
				}

				return result;

			} catch (error) {
				console.error(`[MCP Server] Error executing tool ${name}:`, error);

				// Close connection on error too
				if (this.useApiKeyMapping && sqlExecutor) {
					try {
						await sqlExecutor.close();
					} catch (closeError) {
						// Ignore close errors during error handling
					}
				}

				throw new Error(`Tool execution failed: ${error.message}`);
			}
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
