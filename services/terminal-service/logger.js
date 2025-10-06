// Simple logger utility with timestamps for terminal service
const logLevel = process.env.LOG_LEVEL || 'info';

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const shouldLog = (level) => {
  return levels[level] <= levels[logLevel];
};

const formatMessage = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  const levelStr = level.toUpperCase().padStart(5);
  const service = 'terminal-service';
  
  let logEntry = `[${timestamp}] ${levelStr} [${service}] ${message}`;
  
  if (Object.keys(meta).length > 0) {
    logEntry += ` ${JSON.stringify(meta)}`;
  }
  
  return logEntry;
};

const logger = {
  error: (message, meta = {}) => {
    if (shouldLog('error')) {
      console.error(formatMessage('error', message, meta));
    }
  },
  
  warn: (message, meta = {}) => {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message, meta));
    }
  },
  
  info: (message, meta = {}) => {
    if (shouldLog('info')) {
      console.log(formatMessage('info', message, meta));
    }
  },
  
  debug: (message, meta = {}) => {
    if (shouldLog('debug')) {
      console.log(formatMessage('debug', message, meta));
    }
  }
};

module.exports = logger;