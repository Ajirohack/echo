/**
 * HTTP Client Service
 * Provides secure HTTP communication with built-in security features
 */

const https = require('https');
const http = require('http');
const url = require('url');
const { EventEmitter } = require('events');
const logger = require('../../utils/logger');

class HttpClient extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      timeout: 30000,
      maxRedirects: 5,
      verifySSL: true,
      userAgent: 'Universal-Translator/1.0.0',
      retryAttempts: 3,
      retryDelay: 1000,
      ...config,
    };

    this.requestCount = 0;
    this.errorCount = 0;
    this.lastRequestTime = null;
  }

  /**
   * Make a secure HTTP request
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response object
   */
  async request(options) {
    const requestId = this._generateRequestId();
    const startTime = Date.now();

    try {
      this.requestCount++;
      this.lastRequestTime = new Date();

      // Validate and prepare options
      const requestOptions = this._prepareRequestOptions(options);

      // Check for SSL stripping if HTTPS is expected
      if (requestOptions.protocol === 'https:' && this.config.verifySSL) {
        await this._verifySSL(requestOptions);
      }

      // Make the request
      const response = await this._makeRequest(requestOptions);

      // Log successful request
      const duration = Date.now() - startTime;
      logger.info(`HTTP request completed`, {
        requestId,
        url: requestOptions.href,
        statusCode: response.statusCode,
        duration,
        size: response.headers['content-length'] || 'unknown',
      });

      this.emit('requestSuccess', {
        requestId,
        url: requestOptions.href,
        statusCode: response.statusCode,
        duration,
      });

      return response;
    } catch (error) {
      this.errorCount++;
      const duration = Date.now() - startTime;

      logger.error(`HTTP request failed`, {
        requestId,
        url: options.url || options.href,
        error: error.message,
        duration,
      });

      this.emit('requestError', {
        requestId,
        url: options.url || options.href,
        error: error.message,
        duration,
      });

      throw error;
    }
  }

  /**
   * Make a GET request
   * @param {string} url - Request URL
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Response object
   */
  async get(url, options = {}) {
    return this.request({
      method: 'GET',
      url,
      ...options,
    });
  }

  /**
   * Make a POST request
   * @param {string} url - Request URL
   * @param {Object} data - Request data
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Response object
   */
  async post(url, data = null, options = {}) {
    return this.request({
      method: 'POST',
      url,
      data,
      ...options,
    });
  }

  /**
   * Make a PUT request
   * @param {string} url - Request URL
   * @param {Object} data - Request data
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Response object
   */
  async put(url, data = null, options = {}) {
    return this.request({
      method: 'PUT',
      url,
      data,
      ...options,
    });
  }

  /**
   * Make a DELETE request
   * @param {string} url - Request URL
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Response object
   */
  async delete(url, options = {}) {
    return this.request({
      method: 'DELETE',
      url,
      ...options,
    });
  }

  /**
   * Verify SSL certificate and connection
   * @param {Object} options - Request options
   * @returns {Promise<void>}
   */
  async _verifySSL(options) {
    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        const cert = res.socket.getPeerCertificate();

        if (!cert || Object.keys(cert).length === 0) {
          reject(new Error('SSL certificate verification failed: No certificate received'));
          return;
        }

        // Check certificate validity
        const now = new Date();
        const validFrom = new Date(cert.valid_from);
        const validTo = new Date(cert.valid_to);

        if (now < validFrom || now > validTo) {
          reject(
            new Error(
              `SSL certificate verification failed: Certificate not valid (${validFrom} to ${validTo})`
            )
          );
          return;
        }

        resolve();
      });

      req.on('error', (error) => {
        reject(new Error(`SSL verification failed: ${error.message}`));
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('SSL verification timeout'));
      });

      req.end();
    });
  }

  /**
   * Detect SSL stripping attempts
   * @param {string} url - Request URL
   * @returns {Promise<boolean>} True if SSL stripping detected
   */
  async detectSSLStripping(url) {
    const parsedUrl = url.parse(url);

    // If URL is HTTPS, check if it redirects to HTTP
    if (parsedUrl.protocol === 'https:') {
      try {
        const response = await this.get(url, { maxRedirects: 0 });
        return false; // No redirect, HTTPS maintained
      } catch (error) {
        if (error.statusCode === 301 || error.statusCode === 302) {
          const location = error.headers.location;
          if (location && location.startsWith('http:')) {
            logger.warn('SSL stripping detected', { originalUrl: url, redirectTo: location });
            return true;
          }
        }
        return false;
      }
    }

    return false;
  }

  /**
   * Safely handle authentication headers
   * @param {Object} headers - Request headers
   * @param {string} authToken - Authentication token
   * @returns {Object} Sanitized headers
   */
  sanitizeAuthHeaders(headers = {}, authToken = null) {
    const sanitized = { ...headers };

    // Remove any existing auth headers
    delete sanitized.authorization;
    delete sanitized['x-api-key'];
    delete sanitized['x-auth-token'];

    // Add secure auth header if token provided
    if (authToken) {
      sanitized.authorization = `Bearer ${authToken}`;
    }

    return sanitized;
  }

  /**
   * Prepare request options
   * @param {Object} options - Raw options
   * @returns {Object} Prepared options
   */
  _prepareRequestOptions(options) {
    const parsedUrl = url.parse(options.url || options.href);

    const requestOptions = {
      protocol: parsedUrl.protocol || 'https:',
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.path,
      method: options.method || 'GET',
      headers: {
        'User-Agent': this.config.userAgent,
        Accept: 'application/json, text/plain, */*',
        'Accept-Encoding': 'gzip, deflate',
        Connection: 'keep-alive',
        ...this.sanitizeAuthHeaders(options.headers, options.authToken),
      },
      timeout: options.timeout || this.config.timeout,
      maxRedirects: options.maxRedirects || this.config.maxRedirects,
      ...options,
    };

    // Add request body for POST/PUT requests
    if (options.data && (requestOptions.method === 'POST' || requestOptions.method === 'PUT')) {
      const contentType = options.contentType || 'application/json';
      requestOptions.headers['Content-Type'] = contentType;

      if (contentType === 'application/json') {
        requestOptions.data = JSON.stringify(options.data);
      } else {
        requestOptions.data = options.data;
      }
    }

    return requestOptions;
  }

  /**
   * Make the actual HTTP request
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response object
   */
  async _makeRequest(options) {
    return new Promise((resolve, reject) => {
      const client = options.protocol === 'https:' ? https : http;

      const req = client.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          // Try to parse JSON response
          let parsedData = data;
          try {
            if (
              res.headers['content-type'] &&
              res.headers['content-type'].includes('application/json')
            ) {
              parsedData = JSON.parse(data);
            }
          } catch (error) {
            // Keep as string if JSON parsing fails
          }

          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: parsedData,
            rawData: data,
          });
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.setTimeout(options.timeout, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      // Send request body if present
      if (options.data) {
        req.write(options.data);
      }

      req.end();
    });
  }

  /**
   * Generate unique request ID
   * @returns {string} Request ID
   */
  _generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get client statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      successRate:
        this.requestCount > 0
          ? ((this.requestCount - this.errorCount) / this.requestCount) * 100
          : 0,
      lastRequestTime: this.lastRequestTime,
      config: this.config,
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.requestCount = 0;
    this.errorCount = 0;
    this.lastRequestTime = null;
  }

  /**
   * Test connection to a URL
   * @param {string} url - URL to test
   * @returns {Promise<boolean>} True if connection successful
   */
  async testConnection(url) {
    try {
      await this.get(url, { timeout: 5000 });
      return true;
    } catch (error) {
      logger.warn('Connection test failed', { url, error: error.message });
      return false;
    }
  }
}

module.exports = HttpClient;
