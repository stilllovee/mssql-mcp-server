# MSSQL MCP Server

Model Context Protocol (MCP) server for Microsoft SQL Server database operations.

## Features

-   Execute SQL queries against SQL Server
-   Execute stored procedures
-   Get database connection information
-   Support for both Windows Authentication and SQL Server Authentication
-   Flexible configuration via environment variables

## Installation

```bash
npm install
```

## Usage

Add to your Claude Desktop configuration:

```json
{
    "mcpServers": {
        "mssql": {
            "command": "node",
            "args": ["/path/to/project"],
            "env": {
                "DB_SERVER": "localhost",
                "DB_DATABASE": "ecommerce",
                "DB_USE_WINDOWS_AUTH": "true"
            }
        }
    }
}
```

Or using a connection string:

```json
{
    "mcpServers": {
        "mssql": {
            "command": "node",
            "args": ["/path/to/project"],
            "env": {
                "DB_CONNECTION_STRING": "Server=localhost;Database=ecommerce;Trusted_Connection=yes;TrustServerCertificate=yes"
            }
        }
    }
}
```

Or run directly with npx:

```json
{
    "mcpServers": {
        "mssql": {
            "command": "npx",
            "args": ["github:stilllovee/mssql-mcp-server"],
            "env": {
                "DB_SERVER": "localhost",
                "DB_DATABASE": "ecommerce",
                "DB_USE_WINDOWS_AUTH": "true"
            }
        }
    }
}
```

### Available Environment Variables

| Variable                      | Description                                           | Default                           |
| ----------------------------- | ----------------------------------------------------- | --------------------------------- |
| `DB_CONNECTION_STRING`        | Full connection string (overrides all other settings) | -                                 |
| `DB_SERVER`                   | SQL Server hostname or IP                             | `localhost`                       |
| `DB_DATABASE`                 | Database name                                         | `ecommerce`                              |
| `DB_USER`                     | Username for SQL Server Authentication                | -                                 |
| `DB_PASSWORD`                 | Password for SQL Server Authentication                | -                                 |
| `DB_USE_WINDOWS_AUTH`         | Use Windows Authentication                            | `true` (if user/password not set) |
| `DB_DRIVER`                   | ODBC driver name                                      | `ODBC Driver 17 for SQL Server`   |
| `DB_ENCRYPT`                  | Enable connection encryption                          | `false`                           |
| `DB_TRUST_SERVER_CERTIFICATE` | Trust server certificate                              | `true`                            |

### Available Tools

1.  **sql_execute_query** - Execute SQL queries

    -   Parameters: `query` (string), `params` (object, optional)

2.  **sql_execute_procedure** - Execute stored procedures

    -   Parameters: `procedure_name` (string), `params` (object, optional)

3.  **sql_get_database_info** - Get database connection information

    -   No parameters required

4.  And more ...

## Requirements

-   Node.js 14 or higher
-   SQL Server with ODBC driver installed
-   For Windows Authentication: Running on Windows with appropriate permissions
