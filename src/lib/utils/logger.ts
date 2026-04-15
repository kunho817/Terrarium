/**
 * Structured logging utility with levels and contexts.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: number;
  source?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const CURRENT_LOG_LEVEL: LogLevel = 
  (import.meta.env.VITE_LOG_LEVEL as LogLevel) || 
  (import.meta.env.DEV ? 'debug' : 'warn');

class Logger {
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[CURRENT_LOG_LEVEL];
  }

  private format(entry: LogEntry): string {
    const time = new Date(entry.timestamp).toISOString();
    const context = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
    return `[${time}] [${entry.level.toUpperCase()}]${entry.source ? ` [${entry.source}]` : ''} ${entry.message}${context}`;
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>, source?: string) {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      context,
      timestamp: Date.now(),
      source,
    };

    const formatted = this.format(entry);

    switch (level) {
      case 'debug':
        console.debug(formatted);
        break;
      case 'info':
        console.info(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
        console.error(formatted);
        break;
    }
  }

  debug(message: string, context?: Record<string, unknown>, source?: string) {
    this.log('debug', message, context, source);
  }

  info(message: string, context?: Record<string, unknown>, source?: string) {
    this.log('info', message, context, source);
  }

  warn(message: string, context?: Record<string, unknown>, source?: string) {
    this.log('warn', message, context, source);
  }

  error(message: string, context?: Record<string, unknown>, source?: string) {
    this.log('error', message, context, source);
  }

  /**
   * Create a scoped logger with default context.
   */
  scope(source: string, defaultContext?: Record<string, unknown>) {
    return {
      debug: (msg: string, ctx?: Record<string, unknown>) => 
        this.debug(msg, { ...defaultContext, ...ctx }, source),
      info: (msg: string, ctx?: Record<string, unknown>) => 
        this.info(msg, { ...defaultContext, ...ctx }, source),
      warn: (msg: string, ctx?: Record<string, unknown>) => 
        this.warn(msg, { ...defaultContext, ...ctx }, source),
      error: (msg: string, ctx?: Record<string, unknown>) => 
        this.error(msg, { ...defaultContext, ...ctx }, source),
    };
  }
}

export const logger = new Logger();
