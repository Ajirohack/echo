/**
 * Quality Metrics
 * Calculates and tracks translation quality metrics for each service
 * and language pair, helping optimize service selection and detect
 * quality issues.
 */

const fs = require('fs');
const path = require('path');

class QualityMetrics {
    constructor(config = {}) {
        this.metricsData = {
            services: {},
            languagePairs: {},
            overall: {
                totalTranslations: 0,
                successRate: 0,
                averageLatency: 0,
                confidenceScores: []
            }
        };

        this.config = {
            metricsFilePath: config.metricStoragePath || path.join(__dirname, '../../../logs/translation-metrics.json'),
            logDetailedMetrics: config.logDetailedMetrics !== false,
            saveInterval: config.saveIntervalMs || 5 * 60 * 1000, // 5 minutes
            maxHistoricalDataPoints: config.maxHistoricalDataPoints || 1000
        };

        // Load existing metrics if available
        this.loadMetrics();

        // Set up periodic saving
        if (this.config.saveInterval > 0) {
            this.saveIntervalId = setInterval(() => this.saveMetrics(), this.config.saveInterval);
        }
    }

    /**
     * Record a translation result for metrics calculation
     * 
     * @param {object} result - Translation result with metadata
     */
    recordTranslationResult(result) {
        const {
            service,
            sourceLanguage,
            targetLanguage,
            success,
            latencyMs,
            confidence,
            errorType = null,
            timestamp = Date.now()
        } = result;

        // Initialize service metrics if not exists
        if (!this.metricsData.services[service]) {
            this.metricsData.services[service] = {
                totalTranslations: 0,
                successCount: 0,
                errorCount: 0,
                totalLatency: 0,
                averageLatency: 0,
                successRate: 0,
                confidenceScores: [],
                errors: {},
                languagePairs: {}
            };
        }

        const serviceMetrics = this.metricsData.services[service];

        // Update service metrics
        serviceMetrics.totalTranslations++;
        serviceMetrics.totalLatency += latencyMs;
        serviceMetrics.averageLatency = serviceMetrics.totalLatency / serviceMetrics.totalTranslations;

        if (success) {
            serviceMetrics.successCount++;
            if (confidence !== undefined) {
                serviceMetrics.confidenceScores.push(confidence);

                // Limit array size
                if (serviceMetrics.confidenceScores.length > this.config.maxHistoricalDataPoints) {
                    serviceMetrics.confidenceScores.shift();
                }
            }
        } else {
            serviceMetrics.errorCount++;

            // Track error types
            if (errorType) {
                serviceMetrics.errors[errorType] = (serviceMetrics.errors[errorType] || 0) + 1;
            }
        }

        serviceMetrics.successRate = serviceMetrics.successCount / serviceMetrics.totalTranslations;

        // Language pair key
        const langPairKey = `${sourceLanguage}-${targetLanguage}`;

        // Initialize language pair metrics for this service if not exists
        if (!serviceMetrics.languagePairs[langPairKey]) {
            serviceMetrics.languagePairs[langPairKey] = {
                totalTranslations: 0,
                successCount: 0,
                errorCount: 0,
                totalLatency: 0,
                averageLatency: 0,
                successRate: 0,
                confidenceScores: []
            };
        }

        const langPairMetrics = serviceMetrics.languagePairs[langPairKey];

        // Update language pair metrics for this service
        langPairMetrics.totalTranslations++;
        langPairMetrics.totalLatency += latencyMs;
        langPairMetrics.averageLatency = langPairMetrics.totalLatency / langPairMetrics.totalTranslations;

        if (success) {
            langPairMetrics.successCount++;
            if (confidence !== undefined) {
                langPairMetrics.confidenceScores.push(confidence);

                // Limit array size
                if (langPairMetrics.confidenceScores.length > this.config.maxHistoricalDataPoints) {
                    langPairMetrics.confidenceScores.shift();
                }
            }
        } else {
            langPairMetrics.errorCount++;
        }

        langPairMetrics.successRate = langPairMetrics.successCount / langPairMetrics.totalTranslations;

        // Global language pair metrics (across all services)
        if (!this.metricsData.languagePairs[langPairKey]) {
            this.metricsData.languagePairs[langPairKey] = {
                totalTranslations: 0,
                serviceBreakdown: {},
                bestService: null,
                bestServiceConfidence: 0,
                bestServiceLatency: Infinity
            };
        }

        const globalLangPairMetrics = this.metricsData.languagePairs[langPairKey];

        // Update global language pair metrics
        globalLangPairMetrics.totalTranslations++;

        if (!globalLangPairMetrics.serviceBreakdown[service]) {
            globalLangPairMetrics.serviceBreakdown[service] = 0;
        }

        globalLangPairMetrics.serviceBreakdown[service]++;

        // Update best service for this language pair
        if (success && (
            globalLangPairMetrics.bestService === null ||
            (confidence && confidence > globalLangPairMetrics.bestServiceConfidence) ||
            (confidence === globalLangPairMetrics.bestServiceConfidence && latencyMs < globalLangPairMetrics.bestServiceLatency)
        )) {
            globalLangPairMetrics.bestService = service;
            globalLangPairMetrics.bestServiceConfidence = confidence || 0;
            globalLangPairMetrics.bestServiceLatency = latencyMs;
        }

        // Update overall metrics
        this.metricsData.overall.totalTranslations++;
        this.metricsData.overall.averageLatency =
            (this.metricsData.overall.averageLatency * (this.metricsData.overall.totalTranslations - 1) + latencyMs) /
            this.metricsData.overall.totalTranslations;

        if (success) {
            this.metricsData.overall.successRate =
                (this.metricsData.overall.successRate * (this.metricsData.overall.totalTranslations - 1) + 1) /
                this.metricsData.overall.totalTranslations;

            if (confidence !== undefined) {
                this.metricsData.overall.confidenceScores.push(confidence);

                // Limit array size
                if (this.metricsData.overall.confidenceScores.length > this.config.maxHistoricalDataPoints) {
                    this.metricsData.overall.confidenceScores.shift();
                }
            }
        } else {
            this.metricsData.overall.successRate =
                (this.metricsData.overall.successRate * (this.metricsData.overall.totalTranslations - 1)) /
                this.metricsData.overall.totalTranslations;
        }

        // Log detailed metrics if enabled
        if (this.config.logDetailedMetrics) {
            this.logMetrics(result);
        }

        // Optionally save metrics immediately for important results
        if (this.metricsData.overall.totalTranslations % 100 === 0) {
            this.saveMetrics();
        }
    }

    /**
     * Log metrics to console
     * 
     * @param {object} result - Translation result
     */
    logMetrics(result) {
        const {
            service,
            sourceLanguage,
            targetLanguage,
            success,
            latencyMs,
            confidence
        } = result;

        console.log(`Translation Metrics | ${service} | ${sourceLanguage}-${targetLanguage} | Success: ${success} | Latency: ${latencyMs}ms${confidence !== undefined ? ` | Confidence: ${confidence.toFixed(2)}` : ''}`);
    }

    /**
     * Get the best service for a language pair based on historical metrics
     * 
     * @param {string} sourceLanguage - Source language code
     * @param {string} targetLanguage - Target language code
     * @returns {string|null} - The best service name or null if no data
     */
    getBestServiceForLanguagePair(sourceLanguage, targetLanguage) {
        const langPairKey = `${sourceLanguage}-${targetLanguage}`;

        if (this.metricsData.languagePairs[langPairKey] &&
            this.metricsData.languagePairs[langPairKey].bestService) {
            return this.metricsData.languagePairs[langPairKey].bestService;
        }

        return null;
    }

    /**
     * Get quality score for a service and language pair
     * 
     * @param {string} service - Service name
     * @param {string} sourceLanguage - Source language code
     * @param {string} targetLanguage - Target language code
     * @returns {number} - Quality score (0-1) or 0 if no data
     */
    getQualityScore(service, sourceLanguage, targetLanguage) {
        const langPairKey = `${sourceLanguage}-${targetLanguage}`;

        if (!this.metricsData.services[service] ||
            !this.metricsData.services[service].languagePairs[langPairKey]) {
            return 0;
        }

        const metrics = this.metricsData.services[service].languagePairs[langPairKey];

        // Calculate quality score based on success rate and average confidence
        const successRateWeight = 0.6;
        const confidenceWeight = 0.4;

        let confidenceScore = 0;
        if (metrics.confidenceScores.length > 0) {
            confidenceScore = metrics.confidenceScores.reduce((sum, score) => sum + score, 0) /
                metrics.confidenceScores.length;
        }

        return (metrics.successRate * successRateWeight) + (confidenceScore * confidenceWeight);
    }

    /**
     * Get all metrics data
     * 
     * @returns {object} - Complete metrics data
     */
    getAllMetrics() {
        return {
            ...this.metricsData,
            timestamp: Date.now()
        };
    }

    /**
     * Get metrics for a specific service
     * 
     * @param {string} service - Service name
     * @returns {object|null} - Service metrics or null if not found
     */
    getServiceMetrics(service) {
        return this.metricsData.services[service] || null;
    }

    /**
     * Get metrics for a specific language pair
     * 
     * @param {string} sourceLanguage - Source language code
     * @param {string} targetLanguage - Target language code
     * @returns {object|null} - Language pair metrics or null if not found
     */
    getLanguagePairMetrics(sourceLanguage, targetLanguage) {
        const langPairKey = `${sourceLanguage}-${targetLanguage}`;
        return this.metricsData.languagePairs[langPairKey] || null;
    }

    /**
     * Get overall metrics
     * 
     * @returns {object} - Overall metrics
     */
    getOverallMetrics() {
        return {
            ...this.metricsData.overall,
            timestamp: Date.now()
        };
    }

    /**
     * Reset all metrics
     */
    resetAllMetrics() {
        this.metricsData = {
            services: {},
            languagePairs: {},
            overall: {
                totalTranslations: 0,
                successRate: 0,
                averageLatency: 0,
                confidenceScores: []
            }
        };

        this.saveMetrics();
    }

    /**
     * Load metrics from file
     */
    loadMetrics() {
        try {
            if (fs.existsSync(this.config.metricsFilePath)) {
                const data = fs.readFileSync(this.config.metricsFilePath, 'utf8');
                this.metricsData = JSON.parse(data);
                console.log(`Loaded metrics from ${this.config.metricsFilePath}`);
            }
        } catch (error) {
            console.error('Error loading metrics:', error);
        }
    }

    /**
     * Save metrics to file
     */
    saveMetrics() {
        try {
            // Ensure directory exists
            const dir = path.dirname(this.config.metricsFilePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(
                this.config.metricsFilePath,
                JSON.stringify({
                    ...this.metricsData,
                    lastUpdated: Date.now()
                }, null, 2),
                'utf8'
            );
        } catch (error) {
            console.error('Error saving metrics:', error);
        }
    }

    /**
     * Clean up resources
     */
    destroy() {
        if (this.saveIntervalId) {
            clearInterval(this.saveIntervalId);
        }

        this.saveMetrics();
    }
}

module.exports = QualityMetrics;
