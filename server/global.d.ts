declare module 'node:path' { const path: any; export default path; }
declare module 'node:os' { const os: any; export default os; }
declare module 'node:fs' { export const promises: any; }
declare const process: { cwd(): string; env: Record<string, string | undefined> };
