export const log = {
  info: (...args: unknown[]) => console.log('[PIPEMANIA INFO]', ...args),
  warn: (...args: unknown[]) => console.warn('[PIPEMANIA WARN]', ...args),
  error: (...args: unknown[]) => console.error('[PIPEMANIA ERROR]', ...args),
};
