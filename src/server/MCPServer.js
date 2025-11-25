const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

const { SQLExecutor } = require('../tools/sqlExecutor');

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
      if (name === 'sql_execute_query') {
        return await this.sqlExecutor.executeQuery(args.query, args.params || {});
      }

      if (name === 'sql_execute_dql') {
        return await this.sqlExecutor.executeDQL(args.query, args.params || {});
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