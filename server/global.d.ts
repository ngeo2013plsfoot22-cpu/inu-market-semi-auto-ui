declare module 'express' { const express: any; export default express; }
declare module 'vite' { export function createServer(options?: any): Promise<any>; export function defineConfig(config: any): any; }
declare module 'playwright' { export const chromium: any; export type BrowserContext = any; export type Page = any; }
declare module 'react' { const React: any; export default React; export function useEffect(...args:any[]):any; export function useMemo(...args:any[]):any; export function useState<T=any>(initial?:T):[T,(v:any)=>void]; }
declare module 'react-dom/client' { export function createRoot(el: any): { render(node:any): void }; }
declare namespace JSX { interface IntrinsicElements { [elemName: string]: any } }
declare module 'node:fs' { export const promises: any; }
declare module 'node:path' { const path: any; export default path; }
declare module 'node:os' { const os: any; export default os; }
declare const process: any;
declare const console: any;
declare module '*.css';
declare module 'react/jsx-runtime' { export const jsx: any; export const jsxs: any; export const Fragment: any; }
declare module 'react' { namespace React { type Fragment = any; } }
declare namespace JSX { interface IntrinsicAttributes { key?: any } }
