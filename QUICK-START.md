# Quick Start Guide for MSSQL MCP Server Docker Deployment

## Prerequisites

1. **Docker and Docker Compose**
   ```bash
   # Install Docker Desktop (Windows/Mac) or Docker Engine (Linux)
   # Windows: Download from https://docker.com/products/docker-desktop
   # Linux: Follow your distribution's Docker installation guide
   
   # Verify installation
   docker --version
   docker-compose --version
   ```

2. **Azure Table Storage Account** (for API key mapping)
   - Create an Azure Storage Account
   - Get the connection string from Azure Portal
   - Create a table named "ApiKeyMappings" (or use any custom name)

## Quick Deployment

### Option 1: Using Docker Compose (Recommended)

1. **Set up environment:**
   ```bash
   # Copy template and edit with your credentials
   cp .env.docker .env.docker.local
   
   # Edit .env.docker.local with:
   # - Your Azure Storage connection string
   # - Your database connection string
   ```

2. **Deploy with one command:**
   ```bash
   # Windows PowerShell
   .\docker-deploy.ps1 compose
   
   # Linux/Mac
   ./docker-deploy.sh compose
   ```

3. **Test the deployment:**
   ```bash
   # Windows PowerShell
   .\docker-deploy.ps1 test
   
   # Linux/Mac
   ./docker-deploy.sh test
   ```

### Option 2: Manual Docker Commands

1. **Build and run:**
   ```bash
   # Build the image
   docker build -t mssql-mcp-server .
   
   # Run with environment file
   docker run -d \
     --name mssql-mcp-server \
     -p 8123:8123 \
     --env-file .env.docker.local \
     --restart unless-stopped \
     mssql-mcp-server
   ```

## API Key Management

Once deployed, manage API keys using the container:

```bash
# List all API keys
docker exec mssql-mcp-server node scripts/manage-api-keys.js list

# Add a new API key with database configuration
docker exec -it mssql-mcp-server node scripts/manage-api-keys.js add my-api-key

# Delete an API key
docker exec mssql-mcp-server node scripts/manage-api-keys.js delete my-api-key
```

## Usage Examples

### Claude Desktop Configuration

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "mssql": {
      "type": "http",
      "url": "http://localhost:8123/mcp",
      "headers": {
        "x-api-key": "your-api-key-here"
      }
    }
  }
}
```

### API Testing

```bash
# Initialize connection
curl -X POST http://localhost:8123/mcp \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    }
  }'

# List available tools
curl -X POST http://localhost:8123/mcp \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list"
  }'

# Execute a SQL query
curl -X POST http://localhost:8123/mcp \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "sql_execute_dql",
      "arguments": {
        "query": "SELECT TOP 10 * FROM sys.tables"
      }
    }
  }'
```

## Monitoring and Troubleshooting

### Check container status:
```bash
docker ps -f name=mssql-mcp-server
docker logs mssql-mcp-server
```

### Health check:
```bash
curl http://localhost:8123/mcp
# Should return HTTP 400 (expected for GET request)
```

### View container health:
```bash
docker inspect --format='{{.State.Health.Status}}' mssql-mcp-server
```

## Security Notes

1. **Never commit .env.docker.local** to version control
2. **Use strong, unique API keys** for each client
3. **Restrict Azure Storage access** to only required operations
4. **Use HTTPS in production** with a reverse proxy (nginx, Traefik)
5. **Regularly rotate credentials** and API keys
6. **Monitor access logs** for unauthorized usage

## Production Deployment

For production environments, consider:

1. **Container Orchestration**: Kubernetes, Docker Swarm, or Azure Container Instances
2. **Load Balancing**: Multiple container instances behind a load balancer
3. **Secret Management**: Azure Key Vault, Kubernetes secrets, or Docker secrets
4. **Monitoring**: Application insights, Prometheus, or similar monitoring solutions
5. **SSL/TLS**: Terminate SSL at a reverse proxy or load balancer
6. **Network Security**: VNets, security groups, and proper firewall configuration

## Support

For issues and questions:
1. Check container logs: `docker logs mssql-mcp-server`
2. Verify environment configuration in `.env.docker.local`
3. Test Azure Storage connectivity independently
4. Ensure database connectivity from the container
5. Check the main project README.md for additional documentation