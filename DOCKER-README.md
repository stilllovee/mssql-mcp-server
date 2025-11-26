# MSSQL MCP Server Docker Deployment

This directory contains Docker configuration for deploying the MSSQL MCP Server with API key mapping enabled.

## Quick Start

1. **Copy and configure environment file:**
   ```bash
   cp .env.docker .env.docker.local
   # Edit .env.docker.local with your actual credentials
   ```

2. **Build and run with Docker Compose:**
   ```bash
   docker-compose --env-file .env.docker.local up -d
   ```

3. **Or build and run manually:**
   ```bash
   # Build the image
   docker build -t mssql-mcp-server .

   # Run the container
   docker run -d \
     --name mssql-mcp-server \
     -p 8123:8123 \
     --env-file .env.docker.local \
     mssql-mcp-server
   ```

## Configuration

### Required Environment Variables

- `USE_API_KEY_MAPPING=true` - Enables API key mapping mode
- `AZURE_STORAGE_CONNECTION_STRING` - Azure Table Storage connection string
- `DB_CONNECTION_STRING` - Default database connection string

### Optional Configuration

- `AZURE_TABLE_NAME` - Name of Azure Table for API key mappings (default: ApiKeyMappings)
- `PORT` - Server port (default: 8123)

## API Key Management

Once the container is running, you can manage API keys:

```bash
# List API keys
docker exec mssql-mcp-server node scripts/manage-api-keys.js list

# Add a new API key
docker exec mssql-mcp-server node scripts/manage-api-keys.js add my-api-key

# Delete an API key
docker exec mssql-mcp-server node scripts/manage-api-keys.js delete my-api-key
```

## Testing the Deployment

1. **Health Check:**
   ```bash
   curl http://localhost:8123/mcp
   ```

2. **Initialize MCP connection:**
   ```bash
   curl -X POST http://localhost:8123/mcp \
     -H "Content-Type: application/json" \
     -H "x-api-key: your-api-key" \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test-client","version":"1.0.0"}}}'
   ```

## Production Considerations

1. **Security:**
   - Use Docker secrets for sensitive environment variables
   - Implement proper network security (firewalls, VPNs)
   - Regularly rotate API keys and database credentials

2. **Monitoring:**
   - Set up log aggregation for container logs
   - Monitor container health and resource usage
   - Set up alerts for application errors

3. **Scaling:**
   - Use container orchestration (Kubernetes, Docker Swarm) for production
   - Implement load balancing for multiple instances
   - Consider using Azure Container Instances or Azure Kubernetes Service

## Troubleshooting

### View container logs:
```bash
docker logs mssql-mcp-server
```

### Access container shell:
```bash
docker exec -it mssql-mcp-server sh
```

### Check container health:
```bash
docker inspect --format='{{.State.Health.Status}}' mssql-mcp-server
```

### Common Issues

1. **Connection refused**: Check if the port is correctly mapped and the container is running
2. **Azure Table Storage errors**: Verify the connection string and table permissions
3. **Database connection issues**: Check the database connection string and network connectivity