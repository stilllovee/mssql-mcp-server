#!/bin/bash

# MSSQL MCP Server Docker Build and Deploy Script

set -e

# Configuration
IMAGE_NAME="mssql-mcp-server"
CONTAINER_NAME="mssql-mcp-server"
DEFAULT_PORT="8123"
ENV_FILE=".env.docker.local"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if environment file exists
check_env_file() {
    if [ ! -f "$ENV_FILE" ]; then
        print_warning "Environment file $ENV_FILE not found."
        if [ -f ".env.docker" ]; then
            print_status "Copying template .env.docker to $ENV_FILE"
            cp .env.docker "$ENV_FILE"
            print_warning "Please edit $ENV_FILE with your actual credentials before continuing."
            exit 1
        else
            print_error "No environment template found. Please create $ENV_FILE with required configuration."
            exit 1
        fi
    fi
}

# Function to build Docker image
build_image() {
    print_status "Building Docker image: $IMAGE_NAME"
    docker build -t "$IMAGE_NAME" .
    print_status "Image built successfully!"
}

# Function to stop and remove existing container
cleanup_container() {
    if docker ps -q -f name="$CONTAINER_NAME" | grep -q .; then
        print_status "Stopping existing container: $CONTAINER_NAME"
        docker stop "$CONTAINER_NAME"
    fi
    
    if docker ps -aq -f name="$CONTAINER_NAME" | grep -q .; then
        print_status "Removing existing container: $CONTAINER_NAME"
        docker rm "$CONTAINER_NAME"
    fi
}

# Function to run container
run_container() {
    local port=${1:-$DEFAULT_PORT}
    
    print_status "Starting container: $CONTAINER_NAME on port $port"
    docker run -d \
        --name "$CONTAINER_NAME" \
        -p "$port:8123" \
        --env-file "$ENV_FILE" \
        --restart unless-stopped \
        "$IMAGE_NAME"
    
    print_status "Container started successfully!"
    print_status "Server available at: http://localhost:$port/mcp"
}

# Function to use docker-compose
run_compose() {
    print_status "Starting with Docker Compose"
    docker-compose --env-file "$ENV_FILE" up -d
    print_status "Services started successfully!"
    print_status "Server available at: http://localhost:8123/mcp"
}

# Function to show logs
show_logs() {
    print_status "Showing container logs..."
    docker logs -f "$CONTAINER_NAME"
}

# Function to show status
show_status() {
    print_status "Container status:"
    if docker ps -q -f name="$CONTAINER_NAME" | grep -q .; then
        docker ps -f name="$CONTAINER_NAME"
        echo ""
        print_status "Health check:"
        docker inspect --format='{{.State.Health.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo "No health check configured"
    else
        print_warning "Container $CONTAINER_NAME is not running"
    fi
}

# Function to test the server
test_server() {
    local port=${1:-$DEFAULT_PORT}
    print_status "Testing server connection..."
    
    if curl -s "http://localhost:$port/mcp" > /dev/null; then
        print_status "Server is responding!"
    else
        print_error "Server is not responding at http://localhost:$port/mcp"
        exit 1
    fi
}

# Function to manage API keys
manage_keys() {
    local action=$1
    local key=$2
    
    if [ -z "$action" ]; then
        print_error "Usage: $0 keys <list|add|delete> [key-name]"
        exit 1
    fi
    
    case $action in
        list)
            print_status "Listing API keys..."
            docker exec "$CONTAINER_NAME" node scripts/manage-api-keys.js list
            ;;
        add)
            if [ -z "$key" ]; then
                print_error "Please provide a key name: $0 keys add <key-name>"
                exit 1
            fi
            print_status "Adding API key: $key"
            docker exec "$CONTAINER_NAME" node scripts/manage-api-keys.js add "$key"
            ;;
        delete)
            if [ -z "$key" ]; then
                print_error "Please provide a key name: $0 keys delete <key-name>"
                exit 1
            fi
            print_status "Deleting API key: $key"
            docker exec "$CONTAINER_NAME" node scripts/manage-api-keys.js delete "$key"
            ;;
        *)
            print_error "Unknown action: $action"
            print_error "Available actions: list, add, delete"
            exit 1
            ;;
    esac
}

# Function to show help
show_help() {
    echo "MSSQL MCP Server Docker Management Script"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  build                 Build the Docker image"
    echo "  run [port]           Run container (default port: $DEFAULT_PORT)"
    echo "  compose              Start with Docker Compose"
    echo "  stop                 Stop the container"
    echo "  restart [port]       Stop, rebuild, and start container"
    echo "  logs                 Show container logs"
    echo "  status               Show container status"
    echo "  test [port]          Test server connection"
    echo "  keys <action> [key]  Manage API keys (list|add|delete)"
    echo "  clean                Stop and remove container and image"
    echo "  help                 Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 build                    # Build image"
    echo "  $0 run                      # Run on default port (8123)"
    echo "  $0 run 3000                 # Run on port 3000"
    echo "  $0 keys list                # List all API keys"
    echo "  $0 keys add my-app-key      # Add new API key"
    echo "  $0 restart                  # Full restart with rebuild"
}

# Main command handler
case ${1:-help} in
    build)
        check_env_file
        build_image
        ;;
    run)
        check_env_file
        cleanup_container
        build_image
        run_container "$2"
        ;;
    compose)
        check_env_file
        run_compose
        ;;
    stop)
        cleanup_container
        ;;
    restart)
        check_env_file
        cleanup_container
        build_image
        run_container "$2"
        ;;
    logs)
        show_logs
        ;;
    status)
        show_status
        ;;
    test)
        test_server "$2"
        ;;
    keys)
        manage_keys "$2" "$3"
        ;;
    clean)
        cleanup_container
        if docker images -q "$IMAGE_NAME" | grep -q .; then
            print_status "Removing Docker image: $IMAGE_NAME"
            docker rmi "$IMAGE_NAME"
        fi
        print_status "Cleanup complete!"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac