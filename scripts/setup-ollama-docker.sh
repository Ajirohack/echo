#!/bin/bash

# Ollama Docker Setup Script
# This script sets up Ollama using Docker for the translation app

set -e

echo "🚀 Setting up Ollama with Docker..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

echo "✅ Docker is available and running"

# Stop and remove existing Ollama container if it exists
echo "🧹 Cleaning up existing Ollama containers..."
docker stop ollama-server 2>/dev/null || true
docker rm ollama-server 2>/dev/null || true

# Pull the latest Ollama image
echo "📥 Pulling latest Ollama Docker image..."
docker pull ollama/ollama:latest

# Create Ollama container
echo "🐳 Creating Ollama container..."
docker run -d \
    --name ollama-server \
    -p 11434:11434 \
    -v ollama:/root/.ollama \
    --restart unless-stopped \
    ollama/ollama:latest

# Wait for container to start
echo "⏳ Waiting for Ollama server to start..."
sleep 10

# Check if container is running
if ! docker ps | grep -q ollama-server; then
    echo "❌ Failed to start Ollama container"
    docker logs ollama-server
    exit 1
fi

echo "✅ Ollama container is running"

# Test the API
echo "🧪 Testing Ollama API..."
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "✅ Ollama API is responding"
        break
    fi
    
    attempt=$((attempt + 1))
    echo "⏳ Waiting for API to be ready... (attempt $attempt/$max_attempts)"
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo "❌ Ollama API failed to respond after $max_attempts attempts"
    docker logs ollama-server
    exit 1
fi

# Pull default models
echo "📥 Pulling default models..."

# Pull Llama 2 (7B) - good balance of performance and resource usage
echo "   Pulling llama2 (7B)..."
docker exec ollama-server ollama pull llama2

# Pull Mistral (7B) - good for general tasks
echo "   Pulling mistral (7B)..."
docker exec ollama-server ollama pull mistral

# Pull Code Llama (7B) - good for code-related tasks
echo "   Pulling codellama (7B)..."
docker exec ollama-server ollama pull codellama

echo "✅ Default models pulled successfully"

# List available models
echo "📋 Available models:"
docker exec ollama-server ollama list

# Update configuration
echo "⚙️  Updating configuration..."
cat > config/ai-providers.json << EOF
{
  "ollama": {
    "enabled": true,
    "baseUrl": "http://localhost:11434",
    "defaultModel": "llama2",
    "dockerMode": true,
    "dockerImage": "ollama/ollama",
    "dockerPort": 11434,
    "timeout": 30000,
    "maxRetries": 3
  },
  "openrouter": {
    "enabled": false,
    "apiKey": "",
    "defaultModel": "openai/gpt-3.5-turbo",
    "appName": "Translation App",
    "appUrl": "https://github.com/translation-app",
    "timeout": 30000,
    "maxRetries": 3
  },
  "groq": {
    "enabled": false,
    "apiKey": "",
    "defaultModel": "mixtral-8x7b-32768",
    "timeout": 30000,
    "maxRetries": 3
  },
  "huggingface": {
    "enabled": false,
    "apiKey": "",
    "defaultModel": "google/gemma-7b-it",
    "timeout": 30000,
    "maxRetries": 3
  },
  "defaultProvider": "ollama",
  "fallbackProvider": "huggingface",
  "autoSwitch": true,
  "healthCheckInterval": 30000
}
EOF

echo "✅ Configuration updated"

# Create management scripts
echo "📝 Creating management scripts..."

# Start script
cat > scripts/start-ollama.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting Ollama..."
docker start ollama-server
echo "✅ Ollama started"
EOF

# Stop script
cat > scripts/stop-ollama.sh << 'EOF'
#!/bin/bash
echo "🛑 Stopping Ollama..."
docker stop ollama-server
echo "✅ Ollama stopped"
EOF

# Status script
cat > scripts/ollama-status.sh << 'EOF'
#!/bin/bash
echo "📊 Ollama Status:"
echo "Container:"
docker ps | grep ollama-server || echo "   Not running"
echo ""
echo "Models:"
docker exec ollama-server ollama list 2>/dev/null || echo "   Container not running"
echo ""
echo "API:"
curl -s http://localhost:11434/api/tags > /dev/null && echo "   ✅ Responding" || echo "   ❌ Not responding"
EOF

# Make scripts executable
chmod +x scripts/start-ollama.sh
chmod +x scripts/stop-ollama.sh
chmod +x scripts/ollama-status.sh

echo "✅ Management scripts created"

# Display final information
echo ""
echo "🎉 Ollama setup complete!"
echo ""
echo "📋 Management commands:"
echo "   Start:  ./scripts/start-ollama.sh"
echo "   Stop:   ./scripts/stop-ollama.sh"
echo "   Status: ./scripts/ollama-status.sh"
echo ""
echo "🌐 API endpoint: http://localhost:11434"
echo "📚 Available models: llama2, mistral, codellama"
echo ""
echo "💡 To add more models, run:"
echo "   docker exec ollama-server ollama pull <model-name>"
echo ""
echo "🔗 Model library: https://ollama.ai/library" 