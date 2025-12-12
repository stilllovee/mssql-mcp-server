
// let sql
// const connectionString = process.env.DB_CONNECTION_STRING;
// function parseConnectionString(connectionString) {
// 	const params = {};
// 	const pairs = connectionString.split(';');

// 	for (const pair of pairs) {
// 		const [key, value] = pair.split('=').map(s => s.trim());
// 		if (key && value) {
// 			params[key.toLowerCase()] = value;
// 		}
// 	}

// 	// Extract server and port
// 	let server = params['server'] || 'localhost';
// 	let port = 1433;

// 	if (server.startsWith('tcp:')) {
// 		server = server.substring(4);
// 	}

// 	if (server.includes(',')) {
// 		[server, port] = server.split(',');
// 		port = parseInt(port);
// 	}

// 	return {
// 		server: server,
// 		port: port,
// 		database: params['database'] || params['initial catalog'],
// 		user: params['user id'] || params['uid'],
// 		password: params['password'] || params['pwd'],
// 		driver: params['driver'],
// 		trustedConnection: params['trusted_connection'] === 'yes' || params['trusted_connection'] === 'Yes',
// 		options: {
// 			encrypt: true,
// 			trustServerCertificate: params['trustservercertificate'] === 'True' || params['trustservercertificate'] === 'true',
// 			enableArithAbort: true
// 		}
// 	};
// }

// function buildConnectionStringForWindowsAuth(parsedConfig) {
// 	const driver = parsedConfig.driver || 'ODBC Driver 17 for SQL Server';
// 	let connStr = `Driver={${driver}};Server=${parsedConfig.server}`;

// 	if (parsedConfig.database) {
// 		connStr += `;Database=${parsedConfig.database}`;
// 	}

// 	connStr += `;Trusted_Connection=yes`;

// 	if (parsedConfig.options.trustServerCertificate) {
// 		connStr += `;TrustServerCertificate=yes`;
// 	}

// 	return connStr;
// }

// sql = require('mssql');
// let isWindowsAuth = false;
// let parsedConfig
// if (connectionString) {
// 	parsedConfig = parseConnectionString(connectionString);
// 	// Check if using Windows Authentication (Trusted_Connection=yes and no user/password)
// 	const isLocalServer = parsedConfig.server.toLowerCase().includes("localhost") ||
// 		parsedConfig.server.toLowerCase().includes("127.0.0.1") ||
// 		parsedConfig.server.includes("\\");
// 	isWindowsAuth = (!parsedConfig.user && !parsedConfig.password) && isLocalServer;

// }

// if (process.env.DB_USE_WINDOWS_AUTH === 'true') {
// 	isWindowsAuth = true;
// }

// if (isWindowsAuth) {
// 	//console.log("using windows auth driver (msnodesqlv8)");
// 	sql = require('mssql/msnodesqlv8');
// }
/**
 * SQL Server executor functionality
 */
class SQLExecutor {
	constructor(config = null) {
		// Initialize sql module per instance - CRITICAL for multiple connections
		this.sql = require('mssql');

		// Check if using Windows Authentication

		// If config is a string, treat it as a connection string
		if (typeof config === 'string') {
			const parsedConfig = this.parseConnectionString(config);
			const isWindowsAuth = !parsedConfig.user && !parsedConfig.password;
			if (isWindowsAuth) {
				// Rebuild connection string with Driver parameter for msnodesqlv8
				this.config = {
					connectionString: this.buildConnectionStringForWindowsAuth(parsedConfig)
				};
				this.sql = require('mssql/msnodesqlv8');
			} else {
				this.config = parsedConfig;
			}
		} else if (config && typeof config === 'object') {
			// Use provided config object
			this.config = config;
		} else {
			//console.log("build config from env");

			// Build config from environment variables or use defaults
			this.config = this.buildConfigFromEnv();
		}

		this.pool = null;
	}

	parseConnectionString(connectionString) {
		const params = {};
		const pairs = connectionString.split(';');

		for (const pair of pairs) {
			const [key, value] = pair.split('=').map(s => s.trim());
			if (key && value) {
				params[key.toLowerCase()] = value;
			}
		}

		// Extract server and port
		let server = params['server'] || 'localhost';
		let port = 1433;

		if (server.startsWith('tcp:')) {
			server = server.substring(4);
		}

		if (server.includes(',')) {
			[server, port] = server.split(',');
			port = parseInt(port);
		}

		return {
			server: server,
			port: port,
			database: params['database'] || params['initial catalog'],
			user: params['user id'] || params['uid'],
			password: params['password'] || params['pwd'],
			driver: params['driver'],
			trustedConnection: params['trusted_connection'] === 'yes' || params['trusted_connection'] === 'Yes',
			options: {
				encrypt: true,
				trustServerCertificate: params['trustservercertificate'] === 'True' || params['trustservercertificate'] === 'true',
				enableArithAbort: true
			}
		};
	}

	buildConnectionStringForWindowsAuth(parsedConfig) {
		const driver = parsedConfig.driver || 'ODBC Driver 17 for SQL Server';
		let connStr = `Driver={${driver}};Server=${parsedConfig.server}`;

		if (parsedConfig.database) {
			connStr += `;Database=${parsedConfig.database}`;
		}

		connStr += `;Trusted_Connection=yes`;

		if (parsedConfig.options.trustServerCertificate) {
			connStr += `;TrustServerCertificate=yes`;
		}

		return connStr;
	}

	/**
	 * Build database configuration from environment variables
	 */
	buildConfigFromEnv() {
		// Check if a full connection string is provided
		if (process.env.DB_CONNECTION_STRING) {
			// Check if using Windows Authentication
			const parsedConfig = this.parseConnectionString(process.env.DB_CONNECTION_STRING);
			const isWindowsAuth = !parsedConfig.user && !parsedConfig.password;
			if (isWindowsAuth) {
				this.sql = require('mssql/msnodesqlv8');
				return {
					connectionString: this.buildConnectionStringForWindowsAuth(parsedConfig)
				};
			}
			return parsedConfig;
		}

		// Validate that DB_DATABASE is provided
		if (!process.env.DB_DATABASE) {
			throw new Error(
				'Database configuration error: DB_DATABASE environment variable is required. ' +
				'Please set DB_DATABASE or DB_CONNECTION_STRING in your .env file or environment variables.'
			);
		}

		// Check if using Windows Authentication
		const useWindowsAuth = process.env.DB_USE_WINDOWS_AUTH === 'true' ||
			(!process.env.DB_USER && !process.env.DB_PASSWORD);

		if (useWindowsAuth) {
			// Build connection string for Windows Authentication
			const server = process.env.DB_SERVER || 'localhost';
			const database = process.env.DB_DATABASE;
			const driver = process.env.DB_DRIVER || 'ODBC Driver 17 for SQL Server';
			this.sql = require('mssql/msnodesqlv8');

			return {
				connectionString: `Server=${server};Database=${database};Trusted_Connection=yes;TrustServerCertificate=yes;Driver={${driver}}`
			};
		} else {
			// Build config object for SQL Authentication
			return {
				server: process.env.DB_SERVER || 'localhost',
				database: process.env.DB_DATABASE,
				user: process.env.DB_USER,
				password: process.env.DB_PASSWORD,
				options: {
					encrypt: process.env.DB_ENCRYPT === 'true',
					trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false',
					enableArithAbort: true
				}
			};
		}
	}

	/**
	 * Connect to SQL Server database
	 */
	async connect() {
		if (this.pool && this.pool.connected) {
			//console.log('[SQL Executor] Already connected to database');
			return this.pool;
		}

		// const isWindowsAuth =
		// 	(this.config.connectionString && !this.config.connectionString.includes('User ID') && !this.config.connectionString.includes('Password'))
		// 	|| (!this.config.user && !this.config.password);
		// //console.log("🚀 ~ SQLExecutor ~ connect ~ isWindowsAuth:", isWindowsAuth)
		// if (isWindowsAuth) {
		// 	this.sql = require('mssql/msnodesqlv8');
		// }

		//console.log('[SQL Executor] Connecting to SQL Server...');
		// //console.log("🚀 ~ SQLExecutor ~ connect ~ this.config:", this.config)
		this.pool = await (new this.sql.ConnectionPool(this.config)).connect();
		//console.log('[SQL Executor] ✅ Connected to SQL Server successfully');

		return this.pool;
	}

	/**
	 * Execute a SQL query
	 */
	async executeQuery(query, params = {}) {
		//console.log('[SQL Executor] Executing query:', query.substring(0, 100) + '...');

		// Ensure connection is established
		const pool = await this.connect();

		// Create request
		const request = pool.request();

		// Add parameters if provided
		for (const [key, value] of Object.entries(params)) {
			request.input(key, value);
		}

		// Execute query
		const result = await request.query(query);

		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify({
						// success: true,
						rowsAffected: result.rowsAffected,
						recordCount: result.recordset ? result.recordset.length : 0,
						data: result.recordset || [],
						message: 'Query executed successfully'
					}, null, 2),
				},
			],
		};
	}

	/**
	 * Execute DQL (Data Query Language) statements - specifically SELECT queries
	 * This method is optimized for read-only queries and includes additional validation
	 */
	async executeDQL(query, params = {}) {
		// Validate that the query is a SELECT statement
		const stripLeadingComments = (q) => {
			let s = q.replace(/^\uFEFF/, '');
			while (true) {
				// Trim any leading whitespace/newlines before checking for comments
				s = s.trimStart();
				if (s.startsWith('--')) {
					const nl = s.indexOf('\n');
					if (nl === -1) {
						return '';
					}
					s = s.slice(nl + 1);
					continue;
				}
				if (s.startsWith('/*')) {
					const endIdx = s.indexOf('*/');
					if (endIdx === -1) {
						return '';
					}
					s = s.slice(endIdx + 2);
					continue;
				}
				break;
			}
			return s;
		};

		const effective = stripLeadingComments(query);
		const trimmedQuery = effective.trim().toUpperCase();
		if (!trimmedQuery.startsWith('SELECT') && !trimmedQuery.startsWith('WITH')) {
			throw new Error('DQL executor only supports SELECT queries (queries starting with SELECT or WITH for CTEs)');
		}

		//console.log('[SQL Executor] Executing DQL query:', query.substring(0, 100) + '...');

		// Ensure connection is established
		const pool = await this.connect();

		// Create request
		const request = pool.request();

		// Add parameters if provided
		for (const [key, value] of Object.entries(params)) {
			request.input(key, value);
		}

		// Execute query with read-only intent
		const result = await request.query(query);

		// Get column information
		const columns = result.recordset && result.recordset.columns
			? Object.keys(result.recordset.columns).map(col => {
				const colInfo = result.recordset.columns[col];
				return {
					name: col,
					type: colInfo.type && colInfo.type.declaration ? colInfo.type.declaration : (colInfo.type ? colInfo.type.name || 'unknown' : 'unknown')
				};
			})
			: [];

		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify({
						// success: true,
						recordCount: result.recordset ? result.recordset.length : 0,
						data: result.recordset || [],
						// columns: columns,
						// message: 'DQL query executed successfully'
					}, null, 2),
				},
			],
		};

	}

	/**
	 * Execute DML (Data Manipulation Language) statements - INSERT, UPDATE, DELETE, MERGE
	 * This method is optimized for data modification operations with validation
	 */
	async executeDML(query, params = {}) {
		// Helper to strip leading comments
		const stripLeadingComments = (q) => {
			let s = q.replace(/^\uFEFF/, '');
			while (true) {
				s = s.trimStart();
				if (s.startsWith('--')) {
					const nl = s.indexOf('\n');
					if (nl === -1) return '';
					s = s.slice(nl + 1);
					continue;
				}
				if (s.startsWith('/*')) {
					const endIdx = s.indexOf('*/');
					if (endIdx === -1) return '';
					s = s.slice(endIdx + 2);
					continue;
				}
				break;
			}
			return s;
		};

		// Validate that the query is a DML statement
		const effective = stripLeadingComments(query);
		const trimmedQuery = effective.trim().toUpperCase();
		const isDML = trimmedQuery.startsWith('INSERT') ||
			trimmedQuery.startsWith('UPDATE') ||
			trimmedQuery.startsWith('DELETE') ||
			trimmedQuery.startsWith('MERGE');

		if (!isDML) {
			throw new Error('DML executor only supports INSERT, UPDATE, DELETE, and MERGE statements');
		}

		//console.log('[SQL Executor] Executing DML query:', query.substring(0, 100) + '...');

		// Ensure connection is established
		const pool = await this.connect();

		// Create request
		const request = pool.request();

		// Add parameters if provided
		for (const [key, value] of Object.entries(params)) {
			request.input(key, value);
		}

		// Execute query
		const result = await request.query(query);

		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify({
						// success: true,
						rowsAffected: result.rowsAffected,
						totalRowsAffected: result.rowsAffected.reduce((sum, count) => sum + count, 0),
						recordset: result.recordset || [],
						message: 'DML statement executed successfully'
					}, null, 2),
				},
			],
		};
	}

	/**
	 * Execute DDL (Data Definition Language) statements - CREATE, ALTER, DROP, TRUNCATE, etc.
	 * This method is for schema modifications and database structure changes
	 * WARNING: Use with caution as DDL operations can modify or destroy database structure
	 */
	async executeDDL(query, params = {}) {
		// Helper to strip leading comments
		const stripLeadingComments = (q) => {
			let s = q.replace(/^\uFEFF/, '');
			while (true) {
				s = s.trimStart();
				if (s.startsWith('--')) {
					const nl = s.indexOf('\n');
					if (nl === -1) return '';
					s = s.slice(nl + 1);
					continue;
				}
				if (s.startsWith('/*')) {
					const endIdx = s.indexOf('*/');
					if (endIdx === -1) return '';
					s = s.slice(endIdx + 2);
					continue;
				}
				break;
			}
			return s;
		};

		// Validate that the query is a DDL statement
		const effective = stripLeadingComments(query);
		const trimmedQuery = effective.trim().toUpperCase();
		const isDDL = trimmedQuery.startsWith('CREATE') ||
			trimmedQuery.startsWith('ALTER') ||
			trimmedQuery.startsWith('DROP') ||
			trimmedQuery.startsWith('TRUNCATE') ||
			trimmedQuery.startsWith('RENAME') ||
			trimmedQuery.startsWith('COMMENT');

		if (!isDDL) {
			throw new Error('DDL executor only supports CREATE, ALTER, DROP, TRUNCATE, RENAME, and COMMENT statements');
		}

		//console.log('[SQL Executor] ⚠️  Executing DDL query:', query.substring(0, 100) + '...');

		// Ensure connection is established
		const pool = await this.connect();

		// Create request
		const request = pool.request();

		// Add parameters if provided
		for (const [key, value] of Object.entries(params)) {
			request.input(key, value);
		}

		// Execute query
		const result = await request.query(query);

		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify({
						// success: true,
						rowsAffected: result.rowsAffected,
						message: 'DDL statement executed successfully',
						warning: 'DDL operations have modified the database structure'
					}, null, 2),
				},
			],
		};
	}

	/**
	 * Execute a stored procedure
	 */
	async executeProcedure(procedureName, params = {}) {
		//console.log('[SQL Executor] Executing procedure:', procedureName);

		// Ensure connection is established
		const pool = await this.connect();

		// Create request
		const request = pool.request();

		// Add parameters if provided
		for (const [key, value] of Object.entries(params)) {
			request.input(key, value);
		}

		// Execute procedure
		const result = await request.execute(procedureName);

		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify({
						// success: true,
						rowsAffected: result.rowsAffected,
						recordCount: result.recordset ? result.recordset.length : 0,
						data: result.recordset || [],
						returnValue: result.returnValue,
						message: 'Stored procedure executed successfully'
					}, null, 2),
				},
			],
		};
	}

	/**
	 * Get database version and connection info
	 */
	async getDatabaseInfo() {
		//console.log('[SQL Executor] Getting database info');

		// Ensure connection is established
		const pool = await this.connect();

		const result = await pool.request().query(`
			SELECT 
			@@VERSION AS version,
			DB_NAME() AS database_name,
			@@SERVERNAME AS server_name,
			SUSER_SNAME() AS login_name
		`);

		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify({
						// success: true,
						info: result.recordset[0]
					}, null, 2),
				},
			],
		};
	}

	/**
	 * Discover tables in the database
	 */
	async discoverTables(schema = null) {
		//console.log('[SQL Executor] Discovering tables', schema ? `in schema: ${schema}` : '');

		// Ensure connection is established
		const pool = await this.connect();

		const request = pool.request();

		let query = `
			SELECT 
			TABLE_SCHEMA,
			TABLE_NAME,
			TABLE_TYPE
			FROM INFORMATION_SCHEMA.TABLES
		`;

		if (schema) {
			query += ` WHERE TABLE_SCHEMA = @schema`;
			request.input('schema', schema);
		}

		query += ` ORDER BY TABLE_SCHEMA, TABLE_NAME`;

		const result = await request.query(query);

		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify({
						// success: true,
						tableCount: result.recordset.length,
						tables: result.recordset,
						// message: 'Tables discovered successfully'
					}, null, 2),
				},
			],
		};
	}

	/**
	 * Get detailed information about a specific table
	 */
	async getTableInfo(tableName, schema = 'dbo') {
		//console.log(`[SQL Executor] Getting table info for ${schema}.${tableName}`);

		// Ensure connection is established
		const pool = await this.connect();

		const request = pool.request();
		request.input('tableName', tableName);
		request.input('schema', schema);

		// Get column information
		const columnsQuery = `
			SELECT 
			c.COLUMN_NAME,
			c.DATA_TYPE,
			c.CHARACTER_MAXIMUM_LENGTH,
			c.NUMERIC_PRECISION,
			c.NUMERIC_SCALE,
			c.IS_NULLABLE,
			c.COLUMN_DEFAULT,
			CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 'YES' ELSE 'NO' END AS IS_PRIMARY_KEY
			FROM INFORMATION_SCHEMA.COLUMNS c
			LEFT JOIN (
			SELECT ku.TABLE_SCHEMA, ku.TABLE_NAME, ku.COLUMN_NAME
			FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
			INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
				ON tc.CONSTRAINT_TYPE = 'PRIMARY KEY' 
				AND tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
				AND tc.TABLE_SCHEMA = ku.TABLE_SCHEMA
				AND tc.TABLE_NAME = ku.TABLE_NAME
			) pk ON c.TABLE_SCHEMA = pk.TABLE_SCHEMA 
			AND c.TABLE_NAME = pk.TABLE_NAME 
			AND c.COLUMN_NAME = pk.COLUMN_NAME
			WHERE c.TABLE_NAME = @tableName AND c.TABLE_SCHEMA = @schema
			ORDER BY c.ORDINAL_POSITION
		`;

		const columnsResult = await request.query(columnsQuery);

		// Get indexes information
		const request2 = pool.request();
		request2.input('tableName', tableName);
		request2.input('schema', schema);

		const indexesQuery = `
			SELECT 
			i.name AS INDEX_NAME,
			i.type_desc AS INDEX_TYPE,
			i.is_unique AS IS_UNIQUE,
			i.is_primary_key AS IS_PRIMARY_KEY,
			COL_NAME(ic.object_id, ic.column_id) AS COLUMN_NAME
			FROM sys.indexes i
			INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
			INNER JOIN sys.tables t ON i.object_id = t.object_id
			INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
			WHERE t.name = @tableName AND s.name = @schema
			ORDER BY i.name, ic.key_ordinal
		`;

		const indexesResult = await request2.query(indexesQuery);

		// Get foreign keys information
		const request3 = pool.request();
		request3.input('tableName', tableName);
		request3.input('schema', schema);

		const foreignKeysQuery = `
			SELECT 
			fk.name AS FK_NAME,
			COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS COLUMN_NAME,
			OBJECT_SCHEMA_NAME(fk.referenced_object_id) AS REFERENCED_SCHEMA,
			OBJECT_NAME(fk.referenced_object_id) AS REFERENCED_TABLE,
			COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS REFERENCED_COLUMN
			FROM sys.foreign_keys fk
			INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
			INNER JOIN sys.tables t ON fk.parent_object_id = t.object_id
			INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
			WHERE t.name = @tableName AND s.name = @schema
			ORDER BY fk.name
		`;

		const foreignKeysResult = await request3.query(foreignKeysQuery);

		// Get row count
		const request4 = pool.request();
		request4.input('tableName', tableName);
		request4.input('schema', schema);

		const rowCountQuery = `
			SELECT COUNT(*) AS ROW_COUNT 
			FROM [${schema}].[${tableName}]
		`;

		let rowCount = null;
		try {
			const rowCountResult = await request4.query(rowCountQuery);
			rowCount = rowCountResult.recordset[0].ROW_COUNT;
		} catch (err) {
			//console.log('[SQL Executor] Could not get row count:', err.message);
		}

		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify({
						// success: true,
						table: {
							schema: schema,
							name: tableName,
							rowCount: rowCount,
							columns: columnsResult.recordset,
							indexes: indexesResult.recordset,
							foreignKeys: foreignKeysResult.recordset
						},
						// message: 'Table information retrieved successfully'
					}, null, 2),
				},
			],
		};
	}

	/**
	 * Close the database connection
	 */
	async close() {
		try {
			if (this.pool) {
				await this.pool.close();
				this.pool = null;
				//console.log('[SQL Executor] Connection closed');
			}
		} catch (err) {
			console.error('[SQL Executor] Error closing connection:', err.message);
		}
	}
}

module.exports = {
	SQLExecutor,
};
