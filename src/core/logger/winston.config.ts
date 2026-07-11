import {
  WinstonModuleOptions,
  utilities as nestWinstonUtilities,
} from 'nest-winston';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import * as path from 'path';

const isProd = process.env.NODE_ENV === 'production';

// Where log files are written. Defaults to <repo>/logs (gitignored).
const logDir = process.env.LOG_DIR ?? path.join(process.cwd(), 'logs');

// Console/file verbosity. Dev keeps `debug`; prod trims to `info`.
const level = process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug');

// Retention window — daily files older than this are auto-deleted.
// e.g. '15d' = keep 15 days. Override via LOG_MAX_DAYS.
const maxFiles = process.env.LOG_MAX_DAYS ?? '15d';

const rotateDefaults = {
  dirname: logDir,
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true, // gzip rotated files to save space
  maxSize: '20m', // also roll within a day if a file exceeds 20MB
  maxFiles, // <-- 15-day auto-clean
};

// Structured JSON for files (grep/ship friendly), with stack traces preserved.
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

export const winstonConfig: WinstonModuleOptions = {
  level,
  // Never let a logging failure crash the app.
  exitOnError: false,
  transports: [
    // Human-readable, colorized console (mirrors Nest's default look).
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.ms(),
        nestWinstonUtilities.format.nestLike('YouTOP', {
          colors: true,
          prettyPrint: true,
        }),
      ),
    }),
    // All logs at `level`, one file per day, kept 15 days.
    new DailyRotateFile({
      ...rotateDefaults,
      filename: 'application-%DATE%.log',
      format: fileFormat,
    }),
    // Errors-only stream for fast triage, same 15-day retention.
    new DailyRotateFile({
      ...rotateDefaults,
      filename: 'error-%DATE%.log',
      level: 'error',
      format: fileFormat,
    }),
  ],
};
