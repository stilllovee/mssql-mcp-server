# MSSQL MCP Server Docker Build and Deploy Script (PowerShell)

param(
    [Parameter(Position=0)]
    [string]$Command = "help",
    
    [Parameter(Position=1)]
    [string]$Port = "8123",
    
    [Parameter(Position=2)]
    [string]$KeyName = ""
)

# Configuration
$ImageName = "mssql-mcp-server"
$ContainerName = "mssql-mcp-server"
$DefaultPort = "8123"
$EnvFile = ".env.docker.local"

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Function to check if environment file exists
function Test-EnvFile {
    if (-not (Test-Path $EnvFile)) {
        Write-Warning "Environment file $EnvFile not found."
        if (Test-Path ".env.docker") {
            Write-Status "Copying template .env.docker to $EnvFile"
            Copy-Item ".env.docker" $EnvFile
            Write-Warning "Please edit $EnvFile with your actual credentials before continuing."
            exit 1
        } else {
            Write-Error "No environment template found. Please create $EnvFile with required configuration."
            exit 1
        }
    }
}

# Function to build Docker image
function Build-Image {
    Write-Status "Building Docker image: $ImageName"
    docker build -t $ImageName .
    if ($LASTEXITCODE -eq 0) {
        Write-Status "Image built successfully!"
    } else {
        Write-Error "Failed to build image"
        exit 1
    }
}

# Function to stop and remove existing container
function Remove-Container {
    $runningContainer = docker ps -q -f "name=$ContainerName"
    if ($runningContainer) {
        Write-Status "Stopping existing container: $ContainerName"
        docker stop $ContainerName
    }
    
    $existingContainer = docker ps -aq -f "name=$ContainerName"
    if ($existingContainer) {
        Write-Status "Removing existing container: $ContainerName"
        docker rm $ContainerName
    }
}

# Function to run container
function Start-Container {
    param([string]$PortNumber = $DefaultPort)
    
    Write-Status "Starting container: $ContainerName on port $PortNumber"
    docker run -d `
        --name $ContainerName `
        -p "${PortNumber}:8123" `
        --env-file $EnvFile `
        --restart unless-stopped `
        $ImageName
    
    if ($LASTEXITCODE -eq 0) {
        Write-Status "Container started successfully!"
        Write-Status "Server available at: http://localhost:$PortNumber/mcp"
    } else {
        Write-Error "Failed to start container"
        exit 1
    }
}

# Function to use docker-compose
function Start-Compose {
    Write-Status "Starting with Docker Compose"
    docker-compose --env-file $EnvFile up -d
    if ($LASTEXITCODE -eq 0) {
        Write-Status "Services started successfully!"
        Write-Status "Server available at: http://localhost:8123/mcp"
    } else {
        Write-Error "Failed to start with Docker Compose"
        exit 1
    }
}

# Function to show logs
function Show-Logs {
    Write-Status "Showing container logs..."
    docker logs -f $ContainerName
}

# Function to show status
function Show-Status {
    Write-Status "Container status:"
    $runningContainer = docker ps -q -f "name=$ContainerName"
    if ($runningContainer) {
        docker ps -f "name=$ContainerName"
        Write-Host ""
        Write-Status "Health check:"
        $healthStatus = docker inspect --format='{{.State.Health.Status}}' $ContainerName 2>$null
        if ($healthStatus) {
            Write-Host $healthStatus
        } else {
            Write-Host "No health check configured"
        }
    } else {
        Write-Warning "Container $ContainerName is not running"
    }
}

# Function to test the server
function Test-Server {
    param([string]$PortNumber = $DefaultPort)
    Write-Status "Testing server connection..."
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$PortNumber/mcp" -Method GET -TimeoutSec 10 -ErrorAction Stop
        Write-Status "Server is responding!"
    } catch {
        Write-Error "Server is not responding at http://localhost:$PortNumber/mcp"
        Write-Error $_.Exception.Message
        exit 1
    }
}

# Function to manage API keys
function Manage-Keys {
    param(
        [string]$Action,
        [string]$Key
    )
    
    if (-not $Action) {
        Write-Error "Usage: .\docker-deploy.ps1 keys <list|add|delete> [key-name]"
        exit 1
    }
    
    switch ($Action.ToLower()) {
        "list" {
            Write-Status "Listing API keys..."
            docker exec $ContainerName node scripts/manage-api-keys.js list
        }
        "add" {
            if (-not $Key) {
                Write-Error "Please provide a key name: .\docker-deploy.ps1 keys add <key-name>"
                exit 1
            }
            Write-Status "Adding API key: $Key"
            docker exec $ContainerName node scripts/manage-api-keys.js add $Key
        }
        "delete" {
            if (-not $Key) {
                Write-Error "Please provide a key name: .\docker-deploy.ps1 keys delete <key-name>"
                exit 1
            }
            Write-Status "Deleting API key: $Key"
            docker exec $ContainerName node scripts/manage-api-keys.js delete $Key
        }
        default {
            Write-Error "Unknown action: $Action"
            Write-Error "Available actions: list, add, delete"
            exit 1
        }
    }
}

# Function to show help
function Show-Help {
    Write-Host "MSSQL MCP Server Docker Management Script (PowerShell)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\docker-deploy.ps1 <command> [options]" -ForegroundColor White
    Write-Host ""
    Write-Host "Commands:" -ForegroundColor White
    Write-Host "  build                 Build the Docker image"
    Write-Host "  run [port]           Run container (default port: $DefaultPort)"
    Write-Host "  compose              Start with Docker Compose"
    Write-Host "  stop                 Stop the container"
    Write-Host "  restart [port]       Stop, rebuild, and start container"
    Write-Host "  logs                 Show container logs"
    Write-Host "  status               Show container status"
    Write-Host "  test [port]          Test server connection"
    Write-Host "  keys <action> [key]  Manage API keys (list|add|delete)"
    Write-Host "  clean                Stop and remove container and image"
    Write-Host "  help                 Show this help"
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor White
    Write-Host "  .\docker-deploy.ps1 build                    # Build image"
    Write-Host "  .\docker-deploy.ps1 run                      # Run on default port (8123)"
    Write-Host "  .\docker-deploy.ps1 run 3000                 # Run on port 3000"
    Write-Host "  .\docker-deploy.ps1 keys list                # List all API keys"
    Write-Host "  .\docker-deploy.ps1 keys add my-app-key      # Add new API key"
    Write-Host "  .\docker-deploy.ps1 restart                  # Full restart with rebuild"
}

# Main command handler
switch ($Command.ToLower()) {
    "build" {
        Test-EnvFile
        Build-Image
    }
    "run" {
        Test-EnvFile
        Remove-Container
        Build-Image
        Start-Container $Port
    }
    "compose" {
        Test-EnvFile
        Start-Compose
    }
    "stop" {
        Remove-Container
    }
    "restart" {
        Test-EnvFile
        Remove-Container
        Build-Image
        Start-Container $Port
    }
    "logs" {
        Show-Logs
    }
    "status" {
        Show-Status
    }
    "test" {
        Test-Server $Port
    }
    "keys" {
        Manage-Keys $Port $KeyName
    }
    "clean" {
        Remove-Container
        $existingImage = docker images -q $ImageName
        if ($existingImage) {
            Write-Status "Removing Docker image: $ImageName"
            docker rmi $ImageName
        }
        Write-Status "Cleanup complete!"
    }
    { $_ -in @("help", "--help", "-h") } {
        Show-Help
    }
    default {
        Write-Error "Unknown command: $Command"
        Write-Host ""
        Show-Help
        exit 1
    }
}