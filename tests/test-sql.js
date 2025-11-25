/**
 * Test script for SQL Executor
 * This script tests the SQL Server connection and basic query execution
 */

const { SQLExecutor } = require('../src/tools/sqlExecutor');

async function testSQLExecutor() {
	const sqlExecutor = new SQLExecutor();

	console.log('=== SQL Executor Test ===\n');

	try {
		// Test 1: Get database info
		console.log('Test 1: Getting database info...');
		const infoResult = await sqlExecutor.getDatabaseInfo();
		console.log('Result:', JSON.parse(infoResult.content[0].text));
		console.log('\n---\n');

		// Test 2: Execute a simple query
		console.log('Test 2: Executing simple query...');
		const queryResult = await sqlExecutor.executeQuery('SELECT @@VERSION AS version, GETDATE() AS current_time');
		console.log('Result:', JSON.parse(queryResult.content[0].text));
		console.log('\n---\n');

		// Test 3: Execute query with parameters
		console.log('Test 3: Executing parameterized query...');
		const paramQuery = await sqlExecutor.executeQuery(
			'SELECT @message AS message, @number AS number',
			{
				message: 'Hello from MCP Server!',
				number: 42
			}
		);
		console.log('Result:', JSON.parse(paramQuery.content[0].text));
		console.log('\n---\n');

		// Test 4: List tables in database (example)
		console.log('Test 4: Listing tables in database...');
		const tablesResult = await sqlExecutor.executeQuery(`
		SELECT 
			TABLE_SCHEMA,
			TABLE_NAME,
			TABLE_TYPE
		FROM INFORMATION_SCHEMA.TABLES
		WHERE TABLE_TYPE = 'BASE TABLE'
		ORDER BY TABLE_SCHEMA, TABLE_NAME
		`);
		console.log('Result:', JSON.parse(tablesResult.content[0].text));
		console.log('\n---\n');

		console.log('✅ All tests completed successfully!');

	} catch (error) {
		console.error('❌ Test failed:', error.message);
	} finally {
		// Clean up
		await sqlExecutor.close();
		console.log('\nConnection closed');
	}
}

// Run the tests
testSQLExecutor();
