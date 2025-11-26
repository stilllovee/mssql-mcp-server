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

		// Initialize database with optional config
		this.sqlExecutor = new SQLExecutor(dbConfig);

		this.setupToolHandlers();
		this.setupErrorHandling();
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