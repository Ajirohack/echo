/**
 * Echo Mobile App - Logger Utility
 * Provides consistent logging functionality across the application
 */

import { Platform } from 'react-native';

// Log levels
const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4,
};

// Log level names
const LogLevelNames = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
};

// ANSI color codes for console output
const Colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

// Log level colors
const LevelColors = {
  [LogLevel.DEBUG]: Colors.gray,
  [LogLevel.INFO]: Colors.blue,
  [LogLevel.WARN]: Colors.yellow,
  [LogLevel.ERROR]: Colors.red,
};

class LoggerService {
  constructor() {
    this.currentLevel = __DEV__ ? LogLevel.DEBUG : LogLevel.WARN;
    this.enableColors = Platform.OS !== 'web';
    this.enableTimestamp = true;
    this.enableContext = true;
    this.maxLogHistory = 1000;
    this.logHistory = [];
    this.listeners = [];
  }

  /**
   * Set the current log level
   */
  setLevel(level) {
    if (typeof level === 'string') {
      const levelKey = level.toUpperCase();
      if (LogLevel[levelKey] !== undefined) {
        this.currentLevel = LogLevel[levelKey];
      } else {
        this.warn('Logger', `Invalid log level: ${level}`);
      }
    } else if (typeof level === 'number' && level >= 0 && level <= 4) {
      this.currentLevel = level;
    } else {
      this.warn('Logger', `Invalid log level: ${level}`);
    }
  }

  /**
   * Get the current log level
   */
  getLevel() {
    return this.currentLevel;
  }

  /**
   * Enable or disable colored output
   */
  setColors(enabled) {
    this.enableColors = enabled;
  }

  /**
   * Enable or disable timestamps
   */
  setTimestamp(enabled) {
    this.enableTimestamp = enabled;
  }

  /**
   * Enable or disable context information
   */
  setContext(enabled) {
    this.enableContext = enabled;
  }

  /**
   * Add a log listener
   */
  addListener(listener) {
    if (typeof listener === 'function') {
      this.listeners.push(listener);
    }
  }

  /**
   * Remove a log listener
   */
  removeListener(listener) {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Clear all listeners
   */
  clearListeners() {
    this.listeners = [];
  }

  /**
   * Format timestamp
   */
  formatTimestamp() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const milliseconds = now.getMilliseconds().toString().padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${milliseconds}`;
  }

  /**
   * Format log message
   */
  formatMessage(level, context, message, ...args) {
    const parts = [];

    // Timestamp
    if (this.enableTimestamp) {
      const timestamp = this.formatTimestamp();
      if (this.enableColors) {
        parts.push(`${Colors.gray}${timestamp}${Colors.reset}`);
      } else {
        parts.push(timestamp);
      }
    }

    // Log level
    const levelName = LogLevelNames[level];
    if (this.enableColors) {
      const color = LevelColors[level] || Colors.white;
      parts.push(`${color}[${levelName}]${Colors.reset}`);
    } else {
      parts.push(`[${levelName}]`);
    }

    // Context
    if (this.enableContext && context) {
      if (this.enableColors) {
        parts.push(`${Colors.cyan}${context}:${Colors.reset}`);
      } else {
        parts.push(`${context}:`);
      }
    }

    // Message
    parts.push(message);

    return {
      formatted: parts.join(' '),
      args,
      raw: {
        level,
        context,
        message,
        args,
        timestamp: new Date(),
      },
    };
  }

  /**
   * Log a message at the specified level
   */
  log(level, context, message, ...args) {
    if (level < this.currentLevel) {
      return;
    }

    const formatted = this.formatMessage(level, context, message, ...args);

    // Add to history
    this.logHistory.push(formatted.raw);
    if (this.logHistory.length > this.maxLogHistory) {
      this.logHistory.shift();
    }

    // Notify listeners
    this.listeners.forEach(listener => {
      try {
        listener(formatted.raw);
      } catch (error) {
        // Ignore listener errors to prevent infinite loops
      }
    });

    // Output to console
    const consoleMethod = this.getConsoleMethod(level);
    if (args.length > 0) {
      consoleMethod(formatted.formatted, ...args);
    } else {
      consoleMethod(formatted.formatted);
    }
  }

  /**
   * Get appropriate console method for log level
   */
  getConsoleMethod(level) {
    switch (level) {
      case LogLevel.DEBUG:
        return console.debug || console.log;
      case LogLevel.INFO:
        return console.info || console.log;
      case LogLevel.WARN:
        return console.warn || console.log;
      case LogLevel.ERROR:
        return console.error || console.log;
      default:
        return console.log;
    }
  }

  /**
   * Debug level logging
   */
  debug(context, message, ...args) {
    this.log(LogLevel.DEBUG, context, message, ...args);
  }

  /**
   * Info level logging
   */
  info(context, message, ...args) {
    this.log(LogLevel.INFO, context, message, ...args);
  }

  /**
   * Warning level logging
   */
  warn(context, message, ...args) {
    this.log(LogLevel.WARN, context, message, ...args);
  }

  /**
   * Error level logging
   */
  error(context, message, ...args) {
    this.log(LogLevel.ERROR, context, message, ...args);
  }

  /**
   * Log an error object with stack trace
   */
  exception(context, error, message = 'Exception occurred') {
    if (error instanceof Error) {
      this.error(context, message, {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    } else {
      this.error(context, message, error);
    }
  }

  /**
   * Create a performance timer
   */
  time(label) {
    const startTime = Date.now();
    return {
      end: (context = 'Timer') => {
        const duration = Date.now() - startTime;
        this.info(context, `${label}: ${duration}ms`);
        return duration;
      },
    };
  }

  /**
   * Log a group of related messages
   */
  group(context, title, callback) {
    if (typeof callback === 'function') {
      this.info(context, `--- ${title} ---`);
      try {
        callback();
      } finally {
        this.info(context, `--- End ${title} ---`);
      }
    }
  }

  /**
   * Log object properties in a formatted way
   */
  inspect(context, object, title = 'Object') {
    this.info(context, `${title}:`);
    if (typeof object === 'object' && object !== null) {
      Object.keys(object).forEach(key => {
        this.info(context, `  ${key}:`, object[key]);
      });
    } else {
      this.info(context, `  ${object}`);
    }
  }

  /**
   * Get log history
   */
  getHistory(level = null, context = null, limit = null) {
    let filtered = this.logHistory;

    if (level !== null) {
      filtered = filtered.filter(entry => entry.level >= level);
    }

    if (context !== null) {
      filtered = filtered.filter(entry => entry.context === context);
    }

    if (limit !== null && limit > 0) {
      filtered = filtered.slice(-limit);
    }

    return filtered;
  }

  /**
   * Clear log history
   */
  clearHistory() {
    this.logHistory = [];
  }

  /**
   * Export logs as JSON string
   */
  exportLogs(options = {}) {
    const {
      level = null,
      context = null,
      limit = null,
      pretty = false,
    } = options;

    const logs = this.getHistory(level, context, limit);

    if (pretty) {
      return JSON.stringify(logs, null, 2);
    } else {
      return JSON.stringify(logs);
    }
  }

  /**
   * Create a child logger with a specific context
   */
  child(context) {
    return {
      debug: (message, ...args) => this.debug(context, message, ...args),
      info: (message, ...args) => this.info(context, message, ...args),
      warn: (message, ...args) => this.warn(context, message, ...args),
      error: (message, ...args) => this.error(context, message, ...args),
      exception: (error, message) => this.exception(context, error, message),
      time: (label) => this.time(label),
      group: (title, callback) => this.group(context, title, callback),
      inspect: (object, title) => this.inspect(context, object, title),
    };
  }

  /**
   * Configure logger with options
   */
  configure(options = {}) {
    const {
      level,
      colors,
      timestamp,
      context,
      maxHistory,
    } = options;

    if (level !== undefined) {
      this.setLevel(level);
    }

    if (colors !== undefined) {
      this.setColors(colors);
    }

    if (timestamp !== undefined) {
      this.setTimestamp(timestamp);
    }

    if (context !== undefined) {
      this.setContext(context);
    }

    if (maxHistory !== undefined && typeof maxHistory === 'number') {
      this.maxLogHistory = Math.max(0, maxHistory);
    }
  }
}

// Export singleton instance
export const Logger = new LoggerService();

// Export log levels for external use
export { LogLevel };

// Export default
export default Logger;