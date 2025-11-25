#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

const { SQLExecutor } = require('../src/tools/sqlExecutor');

async function testConnection() {
	console.log('Testing SQL Server connection with current configuration...');
	console.log('');

	// Display configuration (without sensitive data)
	console.log('Configuration:');
	if (process.env.DB_CONNECTION_STRING) {
		console.log('  Using connection string from DB_CONNECTION_STRING');
	} else if (process.env.DB_USER && process.env.DB_PASSWORD) {
		console.log('  Authentication: SQL Server');
		console.log('  Server:', process.env.DB_SERVER || 'localhost');
		console.log('  Database:', process.env.DB_DATABASE);
		console.log('  User:', process.env.DB_USER);
	} else {
		console.log('  Authentication: Windows');
		console.log('  Server:', process.env.DB_SERVER || 'localhost');
		console.log('  Database:', process.env.DB_DATABASE);
		console.log('  Driver:', process.env.DB_DRIVER || 'ODBC Driver 17 for SQL Server');
	}
	console.log('');

	const executor = new SQLExecutor();

	try {
		await executor.connect();
		console.log('✅ Connection successful!');
		console.log('');

		// Get database info
		const result = await executor.getDatabaseInfo();
		const info = JSON.parse(result.content[0].text);

		if (info.success) {
			console.log('Database Information:');
			console.log('  Server:', info.info.server_name);
			console.log('  Database:', info.info.database_name);
			console.log('  Login:', info.info.login_name);
			console.log('  Version:', info.info.version.split('\\n')[0]);
		}

		await executor.close();
		process.exit(0);
	} catch (error) {
		console.error('❌ Connection failed!');
		console.error('Error:', error.message);
		process.exit(1);
	}
}

testConnection();
