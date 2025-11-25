/**
 * Test script for SQL Executor DQL functionality
 * This script tests that executeDQL only allows SELECT queries
 * and properly blocks DML (INSERT, UPDATE, DELETE) and DDL (CREATE, ALTER, DROP) statements
 */

const { SQLExecutor } = require('../src/tools/sqlExecutor');
require('dotenv').config();

async function testDQLExecutor() {
  const sqlExecutor = new SQLExecutor();

  console.log('=== SQL Executor DQL Test Suite ===\n');
  console.log('Testing that executeDQL only allows SELECT queries and blocks DML/DDL statements\n');

  let passedTests = 0;
  let failedTests = 0;

  try {
    // ============================================
    // VALID DQL TESTS (Should Pass)
    // ============================================
    console.log('--- VALID DQL TESTS (Expected to succeed) ---\n');

    // Test 1: Simple SELECT query
    console.log('Test 1: Simple SELECT query');
    try {
      const result = await sqlExecutor.executeDQL('SELECT @@VERSION AS version, GETDATE() AS current_time');
      const parsed = JSON.parse(result.content[0].text);
      if (parsed.success) {
        console.log('✅ PASSED - Simple SELECT executed successfully');
        console.log(`   Returned ${parsed.recordCount} record(s)\n`);
        passedTests++;
      } else {
        console.log('❌ FAILED - Expected success but got error:', parsed.error, '\n');
        failedTests++;
      }
    } catch (error) {
      console.log('❌ FAILED - Exception thrown:', error.message, '\n');
      failedTests++;
    }

    // Test 2: SELECT with WHERE clause
    console.log('Test 2: SELECT with WHERE clause');
    try {
      const result = await sqlExecutor.executeDQL('SELECT 1 AS id WHERE 1=1');
      const parsed = JSON.parse(result.content[0].text);
      if (parsed.success) {
        console.log('✅ PASSED - SELECT with WHERE clause executed successfully');
        console.log(`   Returned ${parsed.recordCount} record(s)\n`);
        passedTests++;
      } else {
        console.log('❌ FAILED - Expected success but got error:', parsed.error, '\n');
        failedTests++;
      }
    } catch (error) {
      console.log('❌ FAILED - Exception thrown:', error.message, '\n');
      failedTests++;
    }

    // Test 3: CTE (Common Table Expression) with WITH clause
    console.log('Test 3: CTE (Common Table Expression) with WITH clause');
    try {
      const result = await sqlExecutor.executeDQL(`
        WITH NumbersCTE AS (
          SELECT 1 AS num
          UNION ALL
          SELECT 2
        )
        SELECT * FROM NumbersCTE
      `);
      const parsed = JSON.parse(result.content[0].text);
      if (parsed.success) {
        console.log('✅ PASSED - CTE query executed successfully');
        console.log(`   Returned ${parsed.recordCount} record(s)\n`);
        passedTests++;
      } else {
        console.log('❌ FAILED - Expected success but got error:', parsed.error, '\n');
        failedTests++;
      }
    } catch (error) {
      console.log('❌ FAILED - Exception thrown:', error.message, '\n');
      failedTests++;
    }

    // Test 4: SELECT with parameters
    console.log('Test 4: SELECT with parameters');
    try {
      const result = await sqlExecutor.executeDQL(
        'SELECT @message AS message, @number AS number',
        { message: 'Test Message', number: 123 }
      );
      const parsed = JSON.parse(result.content[0].text);
      if (parsed.success) {
        console.log('✅ PASSED - Parameterized SELECT executed successfully');
        console.log(`   Returned ${parsed.recordCount} record(s)\n`);
        passedTests++;
      } else {
        console.log('❌ FAILED - Expected success but got error:', parsed.error, '\n');
        failedTests++;
      }
    } catch (error) {
      console.log('❌ FAILED - Exception thrown:', error.message, '\n');
      failedTests++;
    }

    // ============================================
    // INVALID DML TESTS (Should be Blocked)
    // ============================================
    console.log('\n--- INVALID DML TESTS (Expected to be blocked) ---\n');

    // Test 5: INSERT statement (should be blocked)
    console.log('Test 5: INSERT statement (should be blocked)');
    try {
      const result = await sqlExecutor.executeDQL(
        "INSERT INTO TestTable (col1) VALUES ('test')"
      );
      const parsed = JSON.parse(result.content[0].text);
      if (!parsed.success && parsed.error.includes('only supports SELECT')) {
        console.log('✅ PASSED - INSERT statement was correctly blocked');
        console.log(`   Error message: ${parsed.error}\n`);
        passedTests++;
      } else {
        console.log('❌ FAILED - INSERT statement was not blocked as expected\n');
        failedTests++;
      }
    } catch (error) {
      console.log('❌ FAILED - Unexpected exception:', error.message, '\n');
      failedTests++;
    }

    // Test 6: UPDATE statement (should be blocked)
    console.log('Test 6: UPDATE statement (should be blocked)');
    try {
      const result = await sqlExecutor.executeDQL(
        "UPDATE TestTable SET col1 = 'updated' WHERE id = 1"
      );
      const parsed = JSON.parse(result.content[0].text);
      if (!parsed.success && parsed.error.includes('only supports SELECT')) {
        console.log('✅ PASSED - UPDATE statement was correctly blocked');
        console.log(`   Error message: ${parsed.error}\n`);
        passedTests++;
      } else {
        console.log('❌ FAILED - UPDATE statement was not blocked as expected\n');
        failedTests++;
      }
    } catch (error) {
      console.log('❌ FAILED - Unexpected exception:', error.message, '\n');
      failedTests++;
    }

    // Test 7: DELETE statement (should be blocked)
    console.log('Test 7: DELETE statement (should be blocked)');
    try {
      const result = await sqlExecutor.executeDQL(
        "DELETE FROM TestTable WHERE id = 1"
      );
      const parsed = JSON.parse(result.content[0].text);
      if (!parsed.success && parsed.error.includes('only supports SELECT')) {
        console.log('✅ PASSED - DELETE statement was correctly blocked');
        console.log(`   Error message: ${parsed.error}\n`);
        passedTests++;
      } else {
        console.log('❌ FAILED - DELETE statement was not blocked as expected\n');
        failedTests++;
      }
    } catch (error) {
      console.log('❌ FAILED - Unexpected exception:', error.message, '\n');
      failedTests++;
    }

    // Test 8: MERGE statement (should be blocked)
    console.log('Test 8: MERGE statement (should be blocked)');
    try {
      const result = await sqlExecutor.executeDQL(
        "MERGE INTO TestTable USING SourceTable ON TestTable.id = SourceTable.id"
      );
      const parsed = JSON.parse(result.content[0].text);
      if (!parsed.success && parsed.error.includes('only supports SELECT')) {
        console.log('✅ PASSED - MERGE statement was correctly blocked');
        console.log(`   Error message: ${parsed.error}\n`);
        passedTests++;
      } else {
        console.log('❌ FAILED - MERGE statement was not blocked as expected\n');
        failedTests++;
      }
    } catch (error) {
      console.log('❌ FAILED - Unexpected exception:', error.message, '\n');
      failedTests++;
    }

    // ============================================
    // INVALID DDL TESTS (Should be Blocked)
    // ============================================
    console.log('\n--- INVALID DDL TESTS (Expected to be blocked) ---\n');

    // Test 9: CREATE TABLE statement (should be blocked)
    console.log('Test 9: CREATE TABLE statement (should be blocked)');
    try {
      const result = await sqlExecutor.executeDQL(
        "CREATE TABLE TestTable (id INT, name NVARCHAR(100))"
      );
      const parsed = JSON.parse(result.content[0].text);
      if (!parsed.success && parsed.error.includes('only supports SELECT')) {
        console.log('✅ PASSED - CREATE TABLE statement was correctly blocked');
        console.log(`   Error message: ${parsed.error}\n`);
        passedTests++;
      } else {
        console.log('❌ FAILED - CREATE TABLE statement was not blocked as expected\n');
        failedTests++;
      }
    } catch (error) {
      console.log('❌ FAILED - Unexpected exception:', error.message, '\n');
      failedTests++;
    }

    // Test 10: ALTER TABLE statement (should be blocked)
    console.log('Test 10: ALTER TABLE statement (should be blocked)');
    try {
      const result = await sqlExecutor.executeDQL(
        "ALTER TABLE TestTable ADD COLUMN new_col INT"
      );
      const parsed = JSON.parse(result.content[0].text);
      if (!parsed.success && parsed.error.includes('only supports SELECT')) {
        console.log('✅ PASSED - ALTER TABLE statement was correctly blocked');
        console.log(`   Error message: ${parsed.error}\n`);
        passedTests++;
      } else {
        console.log('❌ FAILED - ALTER TABLE statement was not blocked as expected\n');
        failedTests++;
      }
    } catch (error) {
      console.log('❌ FAILED - Unexpected exception:', error.message, '\n');
      failedTests++;
    }

    // Test 11: DROP TABLE statement (should be blocked)
    console.log('Test 11: DROP TABLE statement (should be blocked)');
    try {
      const result = await sqlExecutor.executeDQL(
        "DROP TABLE TestTable"
      );
      const parsed = JSON.parse(result.content[0].text);
      if (!parsed.success && parsed.error.includes('only supports SELECT')) {
        console.log('✅ PASSED - DROP TABLE statement was correctly blocked');
        console.log(`   Error message: ${parsed.error}\n`);
        passedTests++;
      } else {
        console.log('❌ FAILED - DROP TABLE statement was not blocked as expected\n');
        failedTests++;
      }
    } catch (error) {
      console.log('❌ FAILED - Unexpected exception:', error.message, '\n');
      failedTests++;
    }

    // Test 12: TRUNCATE TABLE statement (should be blocked)
    console.log('Test 12: TRUNCATE TABLE statement (should be blocked)');
    try {
      const result = await sqlExecutor.executeDQL(
        "TRUNCATE TABLE TestTable"
      );
      const parsed = JSON.parse(result.content[0].text);
      if (!parsed.success && parsed.error.includes('only supports SELECT')) {
        console.log('✅ PASSED - TRUNCATE TABLE statement was correctly blocked');
        console.log(`   Error message: ${parsed.error}\n`);
        passedTests++;
      } else {
        console.log('❌ FAILED - TRUNCATE TABLE statement was not blocked as expected\n');
        failedTests++;
      }
    } catch (error) {
      console.log('❌ FAILED - Unexpected exception:', error.message, '\n');
      failedTests++;
    }

    // ============================================
    // EDGE CASE TESTS
    // ============================================
    console.log('\n--- EDGE CASE TESTS ---\n');

    // Test 13: SELECT with leading whitespace
    console.log('Test 13: SELECT with leading whitespace and newlines');
    try {
      const result = await sqlExecutor.executeDQL(`
        
        
        SELECT 1 AS test
      `);
      const parsed = JSON.parse(result.content[0].text);
      if (parsed.success) {
        console.log('✅ PASSED - SELECT with leading whitespace executed successfully\n');
        passedTests++;
      } else {
        console.log('❌ FAILED - Expected success but got error:', parsed.error, '\n');
        failedTests++;
      }
    } catch (error) {
      console.log('❌ FAILED - Exception thrown:', error.message, '\n');
      failedTests++;
    }

    // Test 14: Mixed case SELECT
    console.log('Test 14: Mixed case SELECT statement');
    try {
      const result = await sqlExecutor.executeDQL('sElEcT 1 AS test');
      const parsed = JSON.parse(result.content[0].text);
      if (parsed.success) {
        console.log('✅ PASSED - Mixed case SELECT executed successfully\n');
        passedTests++;
      } else {
        console.log('❌ FAILED - Expected success but got error:', parsed.error, '\n');
        failedTests++;
      }
    } catch (error) {
      console.log('❌ FAILED - Exception thrown:', error.message, '\n');
      failedTests++;
    }

    // Test 15: EXEC stored procedure (should be blocked)
    console.log('Test 15: EXEC stored procedure (should be blocked)');
    try {
      const result = await sqlExecutor.executeDQL(
        "EXEC sp_help 'TestTable'"
      );
      const parsed = JSON.parse(result.content[0].text);
      if (!parsed.success && parsed.error.includes('only supports SELECT')) {
        console.log('✅ PASSED - EXEC statement was correctly blocked');
        console.log(`   Error message: ${parsed.error}\n`);
        passedTests++;
      } else {
        console.log('❌ FAILED - EXEC statement was not blocked as expected\n');
        failedTests++;
      }
    } catch (error) {
      console.log('❌ FAILED - Unexpected exception:', error.message, '\n');
      failedTests++;
    }

    // ============================================
    // TEST SUMMARY
    // ============================================
    console.log('\n=== TEST SUMMARY ===');
    console.log(`Total Tests: ${passedTests + failedTests}`);
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    
    if (failedTests === 0) {
      console.log('\n🎉 All tests passed! DQL validation is working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Please review the results above.');
    }

  } catch (error) {
    console.error('❌ Unexpected error during test execution:', error.message);
  } finally {
    // Clean up
    await sqlExecutor.close();
    console.log('\nConnection closed');
  }
}

// Run the tests
testDQLExecutor().catch(console.error);
