async function json<T>(url: string, init?: RequestInit): Promise<T> { const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers||{}) } }); const data = await res.json(); if (!res.ok) throw new Error(data.error || res.statusText); return data; }
export const api = {
  health: () => json<any>('/api/health'), batches: () => json<any[]>('/api/batches'), batch: (id:string) => json<any>(`/api/batches/${id}`),
  manualImport: (text:string, command?:string) => json<any>('/api/batches/manual-import', { method:'POST', body:JSON.stringify({ text, command }) }),
  run: (body:any) => json<any>('/api/run', { method:'POST', body:JSON.stringify(body) }), saveStock: (stockId:string, body:any) => json<any>(`/api/stocks/${stockId}/save`, { method:'POST', body:JSON.stringify(body) }),
  settings: () => json<any>('/api/settings'), saveSettings: (body:any) => json<any>('/api/settings/save', { method:'POST', body:JSON.stringify(body) }), templates: () => json<any>('/api/templates'), saveTemplates: (body:any) => json<any>('/api/templates/save', { method:'POST', body:JSON.stringify(body) }),
  export: (kind:string) => json<any>('/api/export', { method:'POST', body:JSON.stringify({ kind }) }), import: (body:any) => json<any>('/api/import', { method:'POST', body:JSON.stringify(body) })
};
