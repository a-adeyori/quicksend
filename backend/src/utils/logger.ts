import winston from 'winston';
import { config } from '../config/env';

const { combine, timestamp, colorize, printf, errors, json } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}] ${message}${metaStr}${stack ? `\n${stack}` : ''}`;
  })
);

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

export const logger = winston.createLogger({
  level: config.logLevel,
  format: config.isDev ? devFormat : prodFormat,
  transports: [new winston.transports.Console()],
});
