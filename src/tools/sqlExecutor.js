const sql = require('mssql/msnodesqlv8');

/**
 * SQL Server executor functionality
 */
class SQLExecutor {
  constructor(config = null) {
    // If config is a string, treat it as a connection string
    if (typeof config === 'string') {
      this.config = {
        connectionString: config
      };
    } else if (config && typeof config === 'object') {
      // Use provided config object
      this.config = config;
    } else {
      // Build config from environment variables or use defaults
      this.config = this.buildConfigFromEnv();
    }
    
    this.pool = null;
  }

  /**
   * Build database configuration from environment variables
   */
  buildConfigFromEnv() {
    // Check if a full connection string is provided
    if (process.env.DB_CONNECTION_STRING) {
      return {
        connectionString: process.env.DB_CONNECTION_STRING
      };
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
    try {
      if (this.pool && this.pool.connected) {
        console.log('[SQL Executor] Already connected to database');
        return this.pool;
      }

      console.log('[SQL Executor] Connecting to SQL Server...');
      this.pool = await sql.connect(this.config);
      console.log('[SQL Executor] ✅ Connected to SQL Server successfully');
      
      return this.pool;
    } catch (err) {
      console.error('[SQL Executor] ❌ Database connection failed:', err.message);
      throw err;
    }
  }

  /**
   * Execute a SQL query
   */
  async executeQuery(query, params = {}) {
    try {
      console.log('[SQL Executor] Executing query:', query.substring(0, 100) + '...');

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
              success: true,
              rowsAffected: result.rowsAffected,
              recordCount: result.recordset ? result.recordset.length : 0,
              data: result.recordset || [],
              message: 'Query executed successfully'
            }, null, 2),
          },
        ],
      };

    } catch (error) {
      console.error('[SQL Executor] Error executing query:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
              query: query.substring(0, 200)
            }, null, 2),
          },
        ],
      };
    }
  }

  /**
   * Execute a stored procedure
   */
  async executeProcedure(procedureName, params = {}) {
    try {
      console.log('[SQL Executor] Executing procedure:', procedureName);

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
              success: true,
              rowsAffected: result.rowsAffected,
              recordCount: result.recordset ? result.recordset.length : 0,
              data: result.recordset || [],
              returnValue: result.returnValue,
              message: 'Stored procedure executed successfully'
            }, null, 2),
          },
        ],
      };

    } catch (error) {
      console.error('[SQL Executor] Error executing procedure:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
              procedure: procedureName
            }, null, 2),
          },
        ],
      };
    }
  }

  /**
   * Get database version and connection info
   */
  async getDatabaseInfo() {
    try {
      console.log('[SQL Executor] Getting database info');

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
              success: true,
              info: result.recordset[0]
            }, null, 2),
          },
        ],
      };

    } catch (error) {
      console.error('[SQL Executor] Error getting database info:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message
            }, null, 2),
          },
        ],
      };
    }
  }

  /**
   * Close the database connection
   */
  async close() {
    try {
      if (this.pool) {
        await this.pool.close();
        this.pool = null;
        console.log('[SQL Executor] Connection closed');
      }
    } catch (err) {
      console.error('[SQL Executor] Error closing connection:', err.message);
    }
  }
}

module.exports = {
  SQLExecutor,
};
