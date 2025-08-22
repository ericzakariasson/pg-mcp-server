export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export interface Logger {
  error(message: string, error?: Error | unknown): void;
  warn(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
}

/**
 * Simple console logger implementation
 */
export class ConsoleLogger implements Logger {
  private level: LogLevel;

  constructor(debug: boolean = false) {
    this.level = debug ? LogLevel.DEBUG : LogLevel.INFO;
  }

  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown> | Error,
  ): void {
    if (level > this.level) return;

    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    const prefix = `[${timestamp}] [${levelName}]`;

    if (context instanceof Error) {
      console.error(`${prefix} ${message}`, {
        error: context.message,
        stack: context.stack,
        ...(context as any),
      });
    } else if (context) {
      console.log(`${prefix} ${message}`, context);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  error(message: string, error?: Error | unknown): void {
    this.log(LogLevel.ERROR, message, error as Error);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }
}
