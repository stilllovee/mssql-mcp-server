#!/usr/bin/env node

require('dotenv').config();
const { SQLExecutor } = require('../src/tools/sqlExecutor');

async function getSchema() {
	console.log('=== Database Schema Information ===\n');

	const executor = new SQLExecutor();

	try {
		await executor.connect();

		// Get database info
		const dbInfo = await executor.getDatabaseInfo();
		const info = JSON.parse(dbInfo.content[0].text);

		if (info.success) {
			console.log('Database:', info.info.database_name);
			console.log('Server:', info.info.server_name);
			console.log('Version:', info.info.version.split('\n')[0]);
			console.log('\n' + '='.repeat(80) + '\n');
		}

		// Discover all tables
		const tablesResult = await executor.discoverTables();
		const tables = JSON.parse(tablesResult.content[0].text);

		if (tables.success) {
			console.log(`Found ${tables.tableCount} tables:\n`);

			// Group tables by schema
			const schemas = {};
			for (const table of tables.tables) {
				if (!schemas[table.TABLE_SCHEMA]) {
					schemas[table.TABLE_SCHEMA] = [];
				}
				schemas[table.TABLE_SCHEMA].push(table);
			}

			// Display tables grouped by schema
			for (const [schema, schemaTables] of Object.entries(schemas)) {
				console.log(`\n📁 Schema: ${schema}`);
				console.log('-'.repeat(80));

				for (const table of schemaTables) {
					console.log(`  📋 ${table.TABLE_NAME} (${table.TABLE_TYPE})`);
				}
			}

			console.log('\n' + '='.repeat(80));
			console.log('\nTo get detailed info about a table, run:');
			console.log('  node tests/get-table-info.js <schema> <table_name>');
		}

		await executor.close();
		process.exit(0);
	} catch (error) {
		console.error('❌ Error:', error.message);
		await executor.close();
		process.exit(1);
	}
}

getSchema();
