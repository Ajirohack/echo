/**
 * Translation Quality Assessment
 * Evaluates and scores translations for accuracy, fluency,
 * and cultural appropriateness across different services.
 */

const { OpenAI } = require('openai');
const EventEmitter = require('events');

class TranslationQuality extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      openaiApiKey: config.openaiApiKey || process.env.OPENAI_API_KEY,
      openaiModel: config.openaiModel || 'gpt-4o',
      evaluationMode: config.evaluationMode || 'basic', // 'basic', 'enhanced', 'expert'
      metrics: ['accuracy', 'fluency', 'cultural', 'formality'],
      weightAccuracy: config.weightAccuracy || 0.5,
      weightFluency: config.weightFluency || 0.3,
      weightCultural: config.weightCultural || 0.2,
      enableAIEvaluation: config.enableAIEvaluation !== false,
      confidenceThresholds: {
        high: 0.85,
        medium: 0.7,
        low: 0.5,
      },
      ...config,
    };

    this.openai = null;
    this.isInitialized = false;
    this.serviceBenchmarks = new Map();
    this.languagePairBenchmarks = new Map();
  }

  /**
   * Initialize translation quality assessment service
   *
   * @returns {Promise<object>} Initialization result
   */
  async initialize() {
    try {
      // Initialize OpenAI for enhanced evaluation if enabled
      if (this.config.enableAIEvaluation && this.config.openaiApiKey) {
        this.openai = new OpenAI({
          apiKey: this.config.openaiApiKey,
        });

        // Test OpenAI connection
        await this.testOpenAIConnection();
      }

      this.isInitialized = true;

      return {
        success: true,
        evaluationMode: this.config.evaluationMode,
        aiEvaluationEnabled: !!this.openai,
      };
    } catch (error) {
      console.error('Translation quality assessment initialization failed:', error);
      this.config.enableAIEvaluation = false;
      this.isInitialized = true; // Still mark as initialized, we can fall back to basic evaluation

      return {
        success: true,
        evaluationMode: 'basic',
        aiEvaluationEnabled: false,
        warning: error.message,
      };
    }
  }

  /**
   * Test OpenAI connection
   *
   * @returns {Promise<boolean>} Connection test result
   */
  async testOpenAIConnection() {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.config.openaiModel,
        messages: [{ role: 'user', content: "Respond with 'OK' to test the connection." }],
        max_tokens: 5,
      });

      return response.choices[0].message.content.includes('OK');
    } catch (error) {
      throw new Error(`OpenAI connection test failed: ${error.message}`);
    }
  }

  /**
   * Assess translation quality
   *
   * @param {object} params - Assessment parameters
   * @returns {Promise<object>} Quality assessment result
   */
  async assessTranslation(params) {
    try {
      const {
        original,
        translated,
        fromLanguage,
        toLanguage,
        service,
        context = '',
        domainContext = '',
      } = params;

      // Basic evaluation is always performed
      const basicEvaluation = this.performBasicEvaluation(original, translated);

      // Enhanced evaluation with AI if enabled
      let enhancedEvaluation = null;
      if (this.config.enableAIEvaluation && this.openai && this.config.evaluationMode !== 'basic') {
        try {
          enhancedEvaluation = await this.performEnhancedEvaluation({
            original,
            translated,
            fromLanguage,
            toLanguage,
            service,
            context,
            domainContext,
          });
        } catch (error) {
          console.warn('Enhanced evaluation failed, using basic only:', error);
          enhancedEvaluation = null;
        }
      }

      // Calculate final score
      const evaluation = enhancedEvaluation || basicEvaluation;
      const finalScore = this.calculateFinalScore(evaluation);

      // Update benchmarks
      this.updateBenchmarks(service, fromLanguage, toLanguage, finalScore);

      return {
        score: finalScore,
        metrics: evaluation,
        confidence: this.getConfidenceLevel(finalScore),
        evaluationMode: enhancedEvaluation ? this.config.evaluationMode : 'basic',
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('Translation quality assessment failed:', error);

      // Return a default basic assessment on error
      return {
        score: 0.7, // Default neutral score
        metrics: {
          accuracy: 0.7,
          fluency: 0.7,
          cultural: 0.7,
          formality: 'neutral',
        },
        confidence: 'medium',
        evaluationMode: 'fallback',
        error: error.message,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Perform basic evaluation using heuristics
   *
   * @param {string} original - Original text
   * @param {string} translated - Translated text
   * @returns {object} Basic evaluation metrics
   */
  performBasicEvaluation(original, translated) {
    // Length-based heuristics
    const originalLength = original.length;
    const translatedLength = translated.length;
    const lengthRatio = translatedLength / originalLength;

    // Typical length ratios between languages (very approximate)
    const isReasonableLength = lengthRatio > 0.5 && lengthRatio < 2.0;

    // Check for obvious issues
    const hasNonPrintableChars = /[\x00-\x1F\x7F-\x9F]/.test(translated);
    const hasRepeatedChars = /(.)\1{5,}/.test(translated); // 5+ repeated chars
    const hasCompleteMismatch =
      translatedLength < originalLength * 0.3 || translatedLength > originalLength * 3;

    // Calculate basic scores
    let accuracyScore = isReasonableLength ? 0.8 : 0.5;
    let fluencyScore = 0.7; // Default value without deeper analysis

    // Adjust scores based on basic issues
    if (hasNonPrintableChars) {
      accuracyScore *= 0.8;
      fluencyScore *= 0.8;
    }

    if (hasRepeatedChars) {
      fluencyScore *= 0.7;
    }

    if (hasCompleteMismatch) {
      accuracyScore *= 0.6;
    }

    // We can't really assess cultural appropriateness with basic evaluation
    const culturalScore = 0.75; // Default value

    return {
      accuracy: Math.min(Math.max(accuracyScore, 0.3), 1.0),
      fluency: Math.min(Math.max(fluencyScore, 0.3), 1.0),
      cultural: culturalScore,
      formality: 'neutral', // Default without deeper analysis
    };
  }

  /**
   * Perform enhanced evaluation using AI
   *
   * @param {object} params - Evaluation parameters
   * @returns {Promise<object>} Enhanced evaluation metrics
   */
  async performEnhancedEvaluation(params) {
    const { original, translated, fromLanguage, toLanguage, service, context, domainContext } =
      params;

    // Build prompt for assessment
    const prompt = this.buildEvaluationPrompt({
      original,
      translated,
      fromLanguage,
      toLanguage,
      context,
      domainContext,
      mode: this.config.evaluationMode,
      service,
    });

    // Call OpenAI API
    const response = await this.openai.chat.completions.create({
      model: this.config.openaiModel,
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    });

    // Parse evaluation result
    return this.parseEvaluationResponse(response.choices[0].message.content);
  }

  /**
   * Build evaluation prompt for AI assessment
   *
   * @param {object} params - Prompt parameters
   * @returns {string} Evaluation prompt
   */
  buildEvaluationPrompt(params) {
    const {
      original,
      translated,
      fromLanguage,
      toLanguage,
      context,
      domainContext,
      mode,
      service,
    } = params;

    let depth = '';
    if (mode === 'expert') {
      depth =
        'Perform an expert-level, detailed analysis including nuanced cultural and domain-specific considerations. Examine terminology consistency, cultural appropriateness, and semantic accuracy.';
    } else if (mode === 'enhanced') {
      depth =
        'Perform a thorough evaluation considering accuracy, fluency, and cultural appropriateness.';
    } else {
      depth = 'Perform a basic evaluation focusing on accuracy and fluency.';
    }

    return `You are an expert linguist specializing in translation quality assessment between ${fromLanguage} and ${toLanguage}.

Your task is to evaluate a translation produced by the ${service} service.

ORIGINAL TEXT (${fromLanguage}): "${original}"

TRANSLATION (${toLanguage}): "${translated}"

${context ? `CONTEXT: ${context}` : ''}
${domainContext ? `DOMAIN: ${domainContext}` : ''}

${depth}

Rate each aspect on a scale of 0.0 to 1.0:
1. Accuracy: How well the translation preserves the meaning, intent, and content of the original text
2. Fluency: How natural and grammatically correct the translation sounds in the target language
3. Cultural Appropriateness: How well the translation adapts cultural elements, idioms, and connotations
4. Formality: Indicate the level of formality (formal/neutral/casual)

Also consider:
- Terminology consistency
- Semantic preservation
- Idiomatic expression handling
- Cultural sensitivity

Return your evaluation as valid JSON with this exact structure:
{
  "accuracy": 0.85,
  "fluency": 0.9,
  "cultural": 0.75,
  "formality": "neutral",
  "reasoning": "Brief explanation of your evaluation including specific examples",
  "improvement_suggestions": "Brief suggestions for improving the translation"
}`;
  }

  /**
   * Parse evaluation response from AI
   *
   * @param {string} response - AI response text
   * @returns {object} Parsed evaluation metrics
   */
  parseEvaluationResponse(response) {
    try {
      // Try to parse JSON directly first (with response_format: json_object)
      let evaluation;
      try {
        evaluation = JSON.parse(response);
      } catch (jsonError) {
        // Fallback: try to extract JSON from the response text
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const jsonStr = jsonMatch[0];
          evaluation = JSON.parse(jsonStr);
        } else {
          throw new Error('No valid JSON found in response');
        }
      }

      // Validate and normalize scores
      return {
        accuracy: this.normalizeScore(evaluation.accuracy),
        fluency: this.normalizeScore(evaluation.fluency),
        cultural: this.normalizeScore(evaluation.cultural),
        formality: evaluation.formality || 'neutral',
        reasoning: evaluation.reasoning || '',
        improvement_suggestions: evaluation.improvement_suggestions || '',
      };
    } catch (error) {
      console.warn('Failed to parse evaluation response:', error);

      // Fall back to basic evaluation
      return {
        accuracy: 0.75,
        fluency: 0.75,
        cultural: 0.75,
        formality: 'neutral',
        reasoning: 'Evaluation parsing failed, using default values',
        improvement_suggestions: '',
      };
    }
  }

  /**
   * Calculate final score from evaluation metrics
   *
   * @param {object} evaluation - Evaluation metrics
   * @returns {number} Final weighted score
   */
  calculateFinalScore(evaluation) {
    const weightedAccuracy = evaluation.accuracy * this.config.weightAccuracy;
    const weightedFluency = evaluation.fluency * this.config.weightFluency;
    const weightedCultural = evaluation.cultural * this.config.weightCultural;

    const finalScore = weightedAccuracy + weightedFluency + weightedCultural;
    return this.normalizeScore(finalScore);
  }

  /**
   * Get confidence level from score
   *
   * @param {number} score - Quality score
   * @returns {string} Confidence level (high/medium/low)
   */
  getConfidenceLevel(score) {
    if (score >= this.config.confidenceThresholds.high) {
      return 'high';
    } else if (score >= this.config.confidenceThresholds.medium) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Update benchmarks with new evaluation
   *
   * @param {string} service - Translation service name
   * @param {string} fromLanguage - Source language code
   * @param {string} toLanguage - Target language code
   * @param {number} score - Quality score
   */
  updateBenchmarks(service, fromLanguage, toLanguage, score) {
    // Update service benchmark
    if (!this.serviceBenchmarks.has(service)) {
      this.serviceBenchmarks.set(service, {
        totalScore: score,
        count: 1,
        averageScore: score,
        timestamp: Date.now(),
      });
    } else {
      const benchmark = this.serviceBenchmarks.get(service);
      benchmark.totalScore += score;
      benchmark.count += 1;
      benchmark.averageScore = benchmark.totalScore / benchmark.count;
      benchmark.timestamp = Date.now();
    }

    // Update language pair benchmark
    const langPairKey = `${fromLanguage}-${toLanguage}`;
    if (!this.languagePairBenchmarks.has(langPairKey)) {
      this.languagePairBenchmarks.set(langPairKey, {
        services: {
          [service]: {
            totalScore: score,
            count: 1,
            averageScore: score,
          },
        },
        timestamp: Date.now(),
      });
    } else {
      const benchmark = this.languagePairBenchmarks.get(langPairKey);

      if (!benchmark.services[service]) {
        benchmark.services[service] = {
          totalScore: score,
          count: 1,
          averageScore: score,
        };
      } else {
        const serviceBench = benchmark.services[service];
        serviceBench.totalScore += score;
        serviceBench.count += 1;
        serviceBench.averageScore = serviceBench.totalScore / serviceBench.count;
      }

      benchmark.timestamp = Date.now();
    }
  }

  /**
   * Get benchmark for a specific service
   *
   * @param {string} service - Translation service name
   * @returns {object|null} Service benchmark
   */
  getServiceBenchmark(service) {
    return this.serviceBenchmarks.get(service) || null;
  }

  /**
   * Get benchmark for a language pair
   *
   * @param {string} fromLanguage - Source language code
   * @param {string} toLanguage - Target language code
   * @returns {object|null} Language pair benchmark
   */
  getLanguagePairBenchmark(fromLanguage, toLanguage) {
    const langPairKey = `${fromLanguage}-${toLanguage}`;
    return this.languagePairBenchmarks.get(langPairKey) || null;
  }

  /**
   * Get best service for a language pair based on quality
   *
   * @param {string} fromLanguage - Source language code
   * @param {string} toLanguage - Target language code
   * @returns {string|null} Best service name or null if no data
   */
  getBestServiceForLanguagePair(fromLanguage, toLanguage) {
    const benchmark = this.getLanguagePairBenchmark(fromLanguage, toLanguage);

    if (!benchmark) {
      return null;
    }

    let bestService = null;
    let bestScore = -1;

    for (const [service, data] of Object.entries(benchmark.services)) {
      if (data.averageScore > bestScore && data.count >= 3) {
        // Minimum sample size
        bestScore = data.averageScore;
        bestService = service;
      }
    }

    return bestService;
  }

  /**
   * Get all benchmarks
   *
   * @returns {object} All benchmarks
   */
  getAllBenchmarks() {
    return {
      services: Object.fromEntries(this.serviceBenchmarks),
      languagePairs: Object.fromEntries(this.languagePairBenchmarks),
      timestamp: Date.now(),
    };
  }

  /**
   * Normalize score to be between 0 and 1
   *
   * @param {number} score - Score to normalize
   * @returns {number} Normalized score
   */
  normalizeScore(score) {
    return Math.max(0, Math.min(1, Number(score)));
  }

  /**
   * Reset all benchmarks
   */
  resetBenchmarks() {
    this.serviceBenchmarks.clear();
    this.languagePairBenchmarks.clear();
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.isInitialized = false;
    this.removeAllListeners();
  }
}

module.exports = TranslationQuality;
