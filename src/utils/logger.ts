/**
 * 日志工具
 * 生产环境自动禁用 console.log，仅保留 error 和 warn
 */

const isDev = import.meta.env.DEV;

/**
 * 开发环境日志（生产环境不输出）
 */
export const log = (...args: unknown[]): void => {
  if (isDev) {
    console.log(...args);
  }
};

/**
 * 错误日志（始终输出）
 */
export const error = (...args: unknown[]): void => {
  console.error(...args);
};

/**
 * 警告日志（始终输出）
 */
export const warn = (...args: unknown[]): void => {
  console.warn(...args);
};

/**
 * 信息日志（开发环境输出）
 */
export const info = (...args: unknown[]): void => {
  if (isDev) {
    console.info(...args);
  }
};

/**
 * 调试日志（仅开发环境输出）
 */
export const debug = (...args: unknown[]): void => {
  if (isDev) {
    console.debug(...args);
  }
};

/**
 * 表格日志（仅开发环境输出）
 */
export const table = (data: unknown): void => {
  if (isDev && console.table) {
    console.table(data);
  }
};

// 导出统一的 logger 对象
export const logger = {
  log,
  error,
  warn,
  info,
  debug,
  table,
};

export default logger;
