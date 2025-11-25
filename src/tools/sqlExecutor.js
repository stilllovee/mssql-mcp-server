const sql = require('mssql/msnodesqlv8');

/**
 * SQL Server executor functionality
 */
class SQLExecutor {
  constructor(connectionString = null) {
    // Default connection string using Windows Authentication
    this.connectionString = connectionString || 
      'Server=localhost;Database=x4;Trusted_Connection=yes;TrustServerCertificate=yes;Driver={ODBC Driver 17 for SQL Server}';
    
    this.config = {
      connectionString: this.connectionString
    };
    
    this.pool = null;
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
