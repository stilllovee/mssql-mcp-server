const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

const { SQLExecutor } = require('../tools/sqlExecutor');
const { TOOL_DEFINITIONS } = require('../tools/toolDefinitions');

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

		// Store config for lazy initialization
		this.dbConfig = dbConfig;
		this.sqlExecutor = null;

		this.setupToolHandlers();
		this.setupErrorHandling();
	}

	/**
	 * Lazily initialize SQLExecutor on first tool call
	 * This prevents timeout issues during server startup
	 */
	async getSQLExecutor() {
		if (!this.sqlExecutor) {
			this.sqlExecutor = new SQLExecutor(this.dbConfig);
		}
		return this.sqlExecutor;
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
				// Lazy initialization of SQLExecutor on first tool call
				const executor = await this.getSQLExecutor();

				if (name === 'sql_execute_query') {
					return await executor.executeQuery(args.query, args.params || {});
				}

				if (name === 'sql_execute_dql') {
					return await executor.executeDQL(args.query, args.params || {});
				}

				if (name === 'sql_execute_dml') {
					return await executor.executeDML(args.query, args.params || {});
				}

				if (name === 'sql_execute_ddl') {
					return await executor.executeDDL(args.query, args.params || {});
				}

				if (name === 'sql_execute_procedure') {
					return await executor.executeProcedure(args.procedure_name, args.params || {});
				}

				if (name === 'sql_get_database_info') {
					return await executor.getDatabaseInfo();
				}

				if (name === 'sql_discover_tables') {
					return await executor.discoverTables(args.schema || null);
				}

				if (name === 'sql_get_table_info') {
					return await executor.getTableInfo(args.table_name, args.schema || 'dbo');
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

	async run() {
		const transport = new StdioServerTransport();
		await this.server.connect(transport);
		console.error('[MCP Server] MCP Server running on stdio');
	}
}

module.exports = {
	MCPServer: MCPServer,
};