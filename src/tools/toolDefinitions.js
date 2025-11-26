// Shared tool definitions for both Stdio and HTTP transports
const TOOL_DEFINITIONS = [
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

module.exports = {
	TOOL_DEFINITIONS,
};
