const { TableClient } = require('@azure/data-tables');

/**
 * Azure Table Storage service for managing API key to database connection mappings
 * 
 * Table Schema:
 * - PartitionKey: 'ApiKeyMapping' (all records share the same partition)
 * - RowKey: API key (unique identifier)
 * - config: JSON string containing complete database configuration
 *   {
 *     server: SQL Server hostname/IP,
 *     database: Database name,
 *     user: SQL Server username,
 *     password: SQL Server password (encrypted/secured in production),
 *     port: SQL Server port (default: 1433),
 *     trustedConnection: Use Windows Authentication (default: false),
 *     options: {
 *       encrypt: Enable encryption (default: true),
 *       trustServerCertificate: Trust server certificate (default: true),
 *       enableArithAbort: true
 *     }
 *   }
 * - enabled: Whether this API key is active (default: true)
 */
class AzureTableStorageService {
	constructor(connectionString, tableName = 'ApiKeyMappings') {
		if (!connectionString) {
			throw new Error('Azure Table Storage connection string is required');
		}

		this.tableName = tableName;
		this.tableClient = TableClient.fromConnectionString(connectionString, tableName);
		this.initialized = false;
	}

	/**
	 * Initialize the table storage service (creates table if it doesn't exist)
	 */
	async initialize() {
		if (this.initialized) {
			return;
		}

		try {
			console.log(`[Azure Table Storage] Creating table '${this.tableName}' if not exists...`);
			await this.tableClient.createTable();
			console.log(`[Azure Table Storage] ✅ Table '${this.tableName}' ready`);
			this.initialized = true;
		} catch (error) {
			// Ignore error if table already exists
			if (error.statusCode === 409) {
				console.log(`[Azure Table Storage] Table '${this.tableName}' already exists`);
				this.initialized = true;
			} else {
				console.error('[Azure Table Storage] Error creating table:', error);
				throw error;
			}
		}
	}

	/**
	 * Get database configuration for a given API key
	 * @param {string} apiKey - The API key to lookup
	 * @returns {Object|null} Database configuration or null if not found
	 */
	async getConnectionConfig(apiKey) {
		try {
			await this.initialize();

			const partitionKey = 'ApiKeyMapping';
			const rowKey = apiKey;

			console.log(`[Azure Table Storage] Looking up API key: ${apiKey}`);
			const entity = await this.tableClient.getEntity(partitionKey, rowKey);

			// Check if the API key is enabled
			if (entity.enabled === false) {
				console.log(`[Azure Table Storage] API key ${apiKey} is disabled`);
				return null;
			}

			// Parse the config JSON string
			if (!entity.config) {
				throw new Error(`No configuration found for API key: ${apiKey}`);
			}

			const config = JSON.parse(entity.config);
			console.log(`[Azure Table Storage] ✅ Found configuration for API key: ${apiKey}`);
			return config;

		} catch (error) {
			if (error.statusCode === 404) {
				console.log(`[Azure Table Storage] API key not found: ${apiKey}`);
				return null;
			}
			console.error('[Azure Table Storage] Error retrieving API key:', error);
			throw error;
		}
	}

	/**
	 * Add or update an API key mapping
	 * @param {string} apiKey - The API key
	 * @param {Object} config - Database configuration
	 * @returns {Promise<void>}
	 */
	async upsertConnectionConfig(apiKey, config) {
		try {
			await this.initialize();

			// Prepare the config object without the 'enabled' field
			const configData = {
				server: config.server,
				database: config.database,
				user: config.user || '',
				password: config.password || '',
				port: config.port || 1433,
				trustedConnection: config.trustedConnection || false,
				options: {
					encrypt: config.options?.encrypt !== undefined ? config.options.encrypt : true,
					trustServerCertificate: config.options?.trustServerCertificate !== undefined ? config.options.trustServerCertificate : true,
					enableArithAbort: true
				}
			};

			const entity = {
				partitionKey: 'ApiKeyMapping',
				rowKey: apiKey,
				config: JSON.stringify(configData),
				enabled: config.enabled !== undefined ? config.enabled : true
			};

			await this.tableClient.upsertEntity(entity, 'Replace');
			console.log(`[Azure Table Storage] ✅ API key mapping saved: ${apiKey}`);

		} catch (error) {
			console.error('[Azure Table Storage] Error saving API key mapping:', error);
			throw error;
		}
	}

	/**
	 * Delete an API key mapping
	 * @param {string} apiKey - The API key to delete
	 * @returns {Promise<void>}
	 */
	async deleteConnectionConfig(apiKey) {
		try {
			await this.initialize();

			const partitionKey = 'ApiKeyMapping';
			const rowKey = apiKey;

			await this.tableClient.deleteEntity(partitionKey, rowKey);
			console.log(`[Azure Table Storage] ✅ API key mapping deleted: ${apiKey}`);

		} catch (error) {
			if (error.statusCode === 404) {
				console.log(`[Azure Table Storage] API key not found for deletion: ${apiKey}`);
				return;
			}
			console.error('[Azure Table Storage] Error deleting API key mapping:', error);
			throw error;
		}
	}

	/**
	 * List all API key mappings
	 * @returns {Promise<Array>} Array of all API key mappings
	 */
	async listAllMappings() {
		try {
			await this.initialize();

			const partitionKey = 'ApiKeyMapping';
			const entities = this.tableClient.listEntities({
				queryOptions: { filter: `PartitionKey eq '${partitionKey}'` }
			});

			const mappings = [];
			for await (const entity of entities) {
				const config = entity.config ? JSON.parse(entity.config) : {};
				mappings.push({
					apiKey: entity.rowKey,
					server: config.server || '',
					database: config.database || '',
					user: config.user || '',
					port: config.port || 1433,
					enabled: entity.enabled !== undefined ? entity.enabled : true,
					trustedConnection: config.trustedConnection || false
				});
			}

			console.log(`[Azure Table Storage] Found ${mappings.length} API key mappings`);
			return mappings;

		} catch (error) {
			console.error('[Azure Table Storage] Error listing API key mappings:', error);
			throw error;
		}
	}

	/**
	 * Enable or disable an API key
	 * @param {string} apiKey - The API key
	 * @param {boolean} enabled - Whether to enable or disable the key
	 * @returns {Promise<void>}
	 */
	async setApiKeyEnabled(apiKey, enabled) {
		try {
			await this.initialize();

			const partitionKey = 'ApiKeyMapping';
			const rowKey = apiKey;

			// Get existing entity
			const entity = await this.tableClient.getEntity(partitionKey, rowKey);
			entity.enabled = enabled;

			// Update entity
			await this.tableClient.updateEntity(entity, 'Replace');
			console.log(`[Azure Table Storage] ✅ API key ${apiKey} ${enabled ? 'enabled' : 'disabled'}`);

		} catch (error) {
			if (error.statusCode === 404) {
				console.log(`[Azure Table Storage] API key not found: ${apiKey}`);
				throw new Error(`API key not found: ${apiKey}`);
			}
			console.error('[Azure Table Storage] Error updating API key status:', error);
			throw error;
		}
	}
}

module.exports = {
	AzureTableStorageService
};
