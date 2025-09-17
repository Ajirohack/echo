/**
 * Ollama AI Provider
 * Local AI model provider using Ollama
 */

const BaseAIProvider = require('./base-provider');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class OllamaProvider extends BaseAIProvider {
  constructor(config = {}) {
    super({
      name: 'ollama',
      baseUrl: config.baseUrl || 'http://localhost:11434',
      defaultModel: config.defaultModel || 'llama2',
      dockerImage: config.dockerImage || 'ollama/ollama',
      dockerPort: config.dockerPort || 11434,
      ...config,
    });

    this.dockerContainer = null;
    this.isDockerMode = config.dockerMode || false;
  }

  /**
   * Validate Ollama configuration
   */
  async validateConfig() {
    // Check if Ollama is accessible
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`);
      if (!response.ok) {
        throw new Error(`Ollama server not accessible: ${response.status}`);
      }
    } catch (error) {
      console.warn('Ollama server not accessible, attempting to start...');
      try {
        await this.startOllamaServer();
        // Verify server started by checking again
        const response = await fetch(`${this.config.baseUrl}/api/tags`);
        if (!response.ok) {
          throw new Error(`Failed to start Ollama server: ${response.status}`);
        }
      } catch (startError) {
        throw new Error(`Failed to start Ollama server: ${startError.message}`);
      }
    }
  }

  /**
   * Start Ollama server (local or Docker)
   */
  async startOllamaServer() {
    if (this.isDockerMode) {
      await this.startDockerContainer();
    } else {
      await this.startLocalServer();
    }
  }

  /**
   * Start local Ollama server
   */
  async startLocalServer() {
    return new Promise((resolve, reject) => {
      console.log('Starting local Ollama server...');

      const ollama = spawn('ollama', ['serve'], {
        stdio: 'pipe',
        detached: false,
      });

      ollama.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Listening on')) {
          console.log('Ollama server started successfully');
          resolve();
        }
      });

      ollama.stderr.on('data', (data) => {
        console.error('Ollama error:', data.toString());
      });

      ollama.on('error', (error) => {
        console.error('Failed to start Ollama:', error);
        reject(error);
      });

      // Wait for server to be ready
      setTimeout(() => {
        resolve();
      }, 3000);
    });
  }

  /**
   * Start Ollama Docker container
   */
  async startDockerContainer() {
    return new Promise((resolve, reject) => {
      console.log('Starting Ollama Docker container...');

      const docker = spawn(
        'docker',
        [
          'run',
          '-d',
          '--name',
          'ollama-server',
          '-p',
          `${this.config.dockerPort}:11434`,
          '--rm',
          this.config.dockerImage,
        ],
        {
          stdio: 'pipe',
        }
      );

      docker.stdout.on('data', (data) => {
        this.dockerContainer = data.toString().trim();
        console.log('Ollama Docker container started:', this.dockerContainer);
      });

      docker.stderr.on('data', (data) => {
        const error = data.toString();
        if (error.includes('already in use')) {
          console.log('Ollama container already running');
          resolve();
        } else {
          console.error('Docker error:', error);
        }
      });

      docker.on('close', (code) => {
        if (code === 0) {
          // Wait for container to be ready
          setTimeout(() => {
            resolve();
          }, 5000);
        } else {
          reject(new Error(`Docker failed with code ${code}`));
        }
      });
    });
  }

  /**
   * Load available models from Ollama
   */
  async loadAvailableModels() {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`);
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const data = await response.json();
      this.availableModels = data.models || [];

      // Store model information
      this.availableModels.forEach((model) => {
        this.modelInfo[model.name] = {
          name: model.name,
          size: model.size,
          modified_at: model.modified_at,
          digest: model.digest,
          details: model.details,
        };
      });

      console.log(`Loaded ${this.availableModels.length} Ollama models`);
    } catch (error) {
      console.error('Failed to load Ollama models:', error);
      this.availableModels = [];
    }
  }

  /**
   * Pull a model from Ollama library
   * @param {string} modelName - Model name to pull
   */
  async pullModel(modelName) {
    return new Promise((resolve, reject) => {
      console.log(`Pulling Ollama model: ${modelName}`);

      const ollama = spawn('ollama', ['pull', modelName], {
        stdio: 'pipe',
      });

      ollama.stdout.on('data', (data) => {
        console.log(data.toString());
      });

      ollama.stderr.on('data', (data) => {
        console.error(data.toString());
      });

      ollama.on('close', (code) => {
        if (code === 0) {
          console.log(`Successfully pulled model: ${modelName}`);
          this.loadAvailableModels(); // Refresh model list
          resolve();
        } else {
          reject(new Error(`Failed to pull model ${modelName}`));
        }
      });
    });
  }

  /**
   * Generate text completion using Ollama
   * @param {string} prompt - Input prompt
   * @param {object} options - Generation options
   */
  async generateText(prompt, options = {}) {
    const model = options.model || this.config.defaultModel;

    try {
      const response = await fetch(`${this.config.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: options.temperature || 0.7,
            top_p: options.top_p || 0.9,
            top_k: options.top_k || 40,
            num_predict: options.max_tokens || 1024,
            ...options,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      return {
        text: data.response,
        model: model,
        usage: {
          prompt_tokens: data.prompt_eval_count,
          completion_tokens: data.eval_count,
          total_tokens: data.prompt_eval_count + data.eval_count,
        },
        finish_reason: data.done ? 'stop' : 'length',
      };
    } catch (error) {
      console.error('Ollama text generation error:', error);
      throw error;
    }
  }

  /**
   * Generate chat completion using Ollama
   * @param {Array} messages - Array of message objects
   * @param {object} options - Generation options
   */
  async generateChat(messages, options = {}) {
    const model = options.model || this.config.defaultModel;

    try {
      const response = await fetch(`${this.config.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          stream: false,
          options: {
            temperature: options.temperature || 0.7,
            top_p: options.top_p || 0.9,
            top_k: options.top_k || 40,
            num_predict: options.max_tokens || 1024,
            ...options,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      return {
        message: {
          role: 'assistant',
          content: data.message.content,
        },
        model: model,
        usage: {
          prompt_tokens: data.prompt_eval_count,
          completion_tokens: data.eval_count,
          total_tokens: data.prompt_eval_count + data.eval_count,
        },
        finish_reason: data.done ? 'stop' : 'length',
      };
    } catch (error) {
      console.error('Ollama chat generation error:', error);
      throw error;
    }
  }

  /**
   * Stream chat completion
   * @param {Array} messages - Array of message objects
   * @param {object} options - Generation options
   * @param {Function} onChunk - Callback for each chunk
   */
  async streamChat(messages, options = {}, onChunk) {
    const model = options.model || this.config.defaultModel;

    try {
      const response = await fetch(`${this.config.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          stream: true,
          options: {
            temperature: options.temperature || 0.7,
            top_p: options.top_p || 0.9,
            top_k: options.top_k || 40,
            num_predict: options.max_tokens || 1024,
            ...options,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (onChunk) {
              onChunk(data);
            }
          } catch (e) {
            // Skip invalid JSON lines
          }
        }
      }
    } catch (error) {
      console.error('Ollama streaming error:', error);
      throw error;
    }
  }

  /**
   * Health check for Ollama
   */
  async healthCheck() {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Stop Ollama server
   */
  async stopServer() {
    if (this.isDockerMode && this.dockerContainer) {
      return new Promise((resolve) => {
        const docker = spawn('docker', ['stop', 'ollama-server']);
        docker.on('close', () => {
          this.dockerContainer = null;
          resolve();
        });
      });
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    super.destroy();
    this.stopServer();
  }
}

module.exports = OllamaProvider;
