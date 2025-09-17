const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const util = require('util');
const { format } = require('date-fns');

// Ensure logs directory exists
const logsDir = path.join(app.getPath('userData'), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFile = path.join(logsDir, `app-${format(new Date(), 'yyyy-MM-dd')}.log`);

// Create a write stream (in append mode)
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const currentLogLevel = process.env.NODE_ENV === 'development' ? 'debug' : 'info';

const logger = {
  log: (level, message, ...args) => {
    if (logLevels[level] <= logLevels[currentLogLevel]) {
      const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
      const formattedMessage = util.format(message, ...args);
      const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${formattedMessage}\n`;

      // Write to console
      if (level === 'error') {
        console.error(logMessage.trim());
      } else if (level === 'warn') {
        console.warn(logMessage.trim());
      } else {
        console.log(logMessage.trim());
      }

      // Write to log file
      logStream.write(logMessage);
    }
  },

  error: (message, ...args) => {
    logger.log('error', message, ...args);
  },

  warn: (message, ...args) => {
    logger.log('warn', message, ...args);
  },

  info: (message, ...args) => {
    logger.log('info', message, ...args);
  },

  debug: (message, ...args) => {
    logger.log('debug', message, ...args);
  },
};

// Handle process exit
process.on('exit', () => {
  if (logStream) {
    logStream.end();
  }
});

module.exports = logger;
