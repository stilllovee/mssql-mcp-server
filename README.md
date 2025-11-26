# MSSQL MCP Server

Model Context Protocol (MCP) server for Microsoft SQL Server database operations.

## Features

-   Execute SQL queries against SQL Server
-   Execute stored procedures
-   Get database connection information
-   Support for both Windows Authentication and SQL Server Authentication
-   Flexible configuration via environment variables
-   **Streamable HTTP transport** for web-based applications and remote connections
-   Support for multiple simultaneous sessions

## Installation

```bash
npm install
```

## Usage

The server supports two transport modes:

### 1. Stdio Transport (Default)

For use with Claude Desktop and other stdio-based MCP clients.

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

### 2. Streamable HTTP Transport

For web applications, remote connections, and environments where HTTP is preferred.

#### Start the HTTP Server

Setup .env file with your database configuration:

```ini
DB_SERVER=localhost
DB_DATABASE=ecommerce
DB_USE_WINDOWS_AUTH=true
# Or use a full connection string
# DB_CONNECTION_STRING=Server=localhost;Database=ecommerce;Trusted_Connection=yes;TrustServerCertificate=yes
```

Run the server:

```bash
# Using default port 8123
node index-http.js

# Or specify a custom port
node index-http.js --port=3000
```

The server will be available at `http://localhost:8123/mcp` (or your custom port).

#### HTTP Transport Features

-   **Session Management**: Supports multiple simultaneous client connections with unique session IDs
-   **Server-Sent Events (SSE)**: Real-time notifications via GET endpoint
-   **Stateful Connections**: Maintains session state across requests
-   **Standard HTTP**: Works with any HTTP client or proxy
-   **API Key-Based Connection Mapping**: Map different API keys to different database connections (see below)

#### API Key-Based Multi-Database Support

The HTTP transport supports API key-based connection mapping, allowing different clients to connect to different databases using unique API keys.

**Enable API Key Mapping:**

```bash
# Set environment variable
USE_API_KEY_MAPPING=true node index-http.js
```

**Using HTTP Mode:**

```json
"mssql": {
    "type": "http",
    "url": "http://localhost:8123/mcp",
    "headers": {
        "x-api-key": "demo-key-uat"//add this if using API key mapping
    }
},
```

**Making Requests with API Keys:**

```bash
curl -X POST http://localhost:8123/mcp \
  -H "Content-Type: application/json" \
  -H "x-api-key: demo-key-1" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize",...}'
```

For detailed information about API key mapping, including mock data configuration and migration to database-backed storage, see [API Key Mapping Documentation](docs/API-KEY-MAPPING.md).

**Available Demo API Keys (for testing):**

-   `demo-key-1` → DemoDB1
-   `demo-key-2` → DemoDB2
-   `demo-key-3` → DemoDB3

#### HTTP Endpoints

-   `POST /mcp` - Send MCP requests and receive responses
-   `GET /mcp` - Establish SSE connection for receiving notifications (requires `mcp-session-id` header)

### Available Environment Variables

| Variable                      | Description                                           | Default                           |
| ----------------------------- | ----------------------------------------------------- | --------------------------------- |
| `DB_CONNECTION_STRING`        | Full connection string (overrides all other settings) | -                                 |
| `DB_SERVER`                   | SQL Server hostname or IP                             | `localhost`                       |
| `DB_DATABASE`                 | Database name                                         | `ecommerce`                       |
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
