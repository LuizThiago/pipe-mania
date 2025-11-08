export const log = {
  info: (...args: any[]) => console.log('[PIPEMANIA INFO]', ...args),
  warn: (...args: any[]) => console.warn('[PIPEMANIA WARN]', ...args),
  error: (...args: any[]) => console.error('[PIPEMANIA ERROR]', ...args),
};
