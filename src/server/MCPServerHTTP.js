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
				tools: TOOL_DEFINITIONS,
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
