export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const log = {
  info: (msg: string) => console.log(`[INFO]  ${new Date().toISOString()} — ${msg}`),
  ok:   (msg: string) => console.log(`[✓]     ${new Date().toISOString()} — ${msg}`),
  warn: (msg: string) => console.warn(`[WARN]  ${new Date().toISOString()} — ${msg}`),
  err:  (msg: string) => console.error(`[ERR]   ${new Date().toISOString()} — ${msg}`),
  step: (msg: string) => console.log(`\n${'─'.repeat(60)}\n  ${msg}\n${'─'.repeat(60)}`),
};
