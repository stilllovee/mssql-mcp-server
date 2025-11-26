# Use Node.js 24 base image (required by Azure packages)
FROM node:24-alpine

# Set working directory
WORKDIR /app

# Install build dependencies for native modules (msnodesqlv8)
# Note: unixodbc is for SQL Server ODBC driver support
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    unixodbc \
    unixodbc-dev \
    && ln -sf python3 /usr/bin/python

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy application source
COPY . .

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcp -u 1001

# Change ownership of app directory to nodejs user
RUN chown -R mcp:nodejs /app

# Switch to non-root user
USER mcp

# Expose the default port (can be overridden with --port flag)
EXPOSE 8123

# Set environment variable to enable API key mapping by default
ENV USE_API_KEY_MAPPING=true
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); \
    const options = { \
      hostname: 'localhost', \
      port: process.env.PORT || 8123, \
      path: '/mcp', \
      method: 'GET', \
      timeout: 5000 \
    }; \
    const req = http.request(options, (res) => { \
      if (res.statusCode === 200 || res.statusCode === 400) process.exit(0); \
      else process.exit(1); \
    }); \
    req.on('error', () => process.exit(1)); \
    req.on('timeout', () => process.exit(1)); \
    req.end();"

# Default command - start in HTTP mode
CMD ["node", "index-http.js"]