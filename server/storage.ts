import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Batch, PromptTemplates, Settings } from './types.js';
import { defaultPrompts, defaultSettings } from './defaults.js';

const root = process.cwd();
const dataDir = path.join(root, 'data');
const promptsDir = path.join(root, 'prompts');
const files = {
  batches: path.join(dataDir, 'batches.json'),
  settings: path.join(dataDir, 'settings.json'),
  templates: path.join(dataDir, 'promptTemplates.json')
};

async function ensureDir() { await fs.mkdir(dataDir, { recursive: true }); await fs.mkdir(promptsDir, { recursive: true }); }
async function exists(file: string) { try { await fs.access(file); return true; } catch { return false; } }
async function writeJsonAtomic(file: string, value: unknown) { const tmp = `${file}.tmp`; await fs.writeFile(tmp, JSON.stringify(value, null, 2), 'utf8'); await fs.rename(tmp, file); }
async function readJson<T>(file: string, fallback: T): Promise<T> { await ensureDir(); if (!(await exists(file))) { await writeJsonAtomic(file, fallback); return fallback; } return JSON.parse(await fs.readFile(file, 'utf8')) as T; }

export async function initializeStorage() {
  await ensureDir();
  if (!(await exists(files.batches))) await writeJsonAtomic(files.batches, []);
  if (!(await exists(files.settings))) await writeJsonAtomic(files.settings, defaultSettings);
  if (!(await exists(files.templates))) await writeJsonAtomic(files.templates, defaultPrompts);
  await writePromptFiles(defaultPrompts, false);
}

async function writePromptFiles(templates: PromptTemplates, overwrite: boolean) {
  const mapping: Array<[keyof PromptTemplates, string]> = [
    ['step0_buyJudgmentPrompt','step0_buyJudgment.txt'], ['step1_xArticlePrompt','step1_xArticle.txt'], ['step2_overseasXPostPrompt','step2_overseasXPost.txt'],
    ['step3_noteArticlePrompt','step3_noteArticle.txt'], ['step4_japaneseXPostPrompt','step4_japaneseXPost.txt'], ['step5_noteImagePrompt','step5_noteImage.txt'], ['step6_xImagePrompt','step6_xImage.txt']
  ];
  for (const [key, name] of mapping) {
    const file = path.join(promptsDir, name);
    if (overwrite || !(await exists(file))) await fs.writeFile(file, templates[key], 'utf8');
  }
}

export async function getBatches(): Promise<Batch[]> { return readJson<Batch[]>(files.batches, []); }
export async function saveBatches(batches: Batch[]) { await writeJsonAtomic(files.batches, batches); }
export async function getBatch(batchId: string) { return (await getBatches()).find((b) => b.batchId === batchId); }
export async function upsertBatch(batch: Batch) { const batches = await getBatches(); const idx = batches.findIndex((b) => b.batchId === batch.batchId); if (idx >= 0) batches[idx] = batch; else batches.unshift(batch); await saveBatches(batches); }
function normalizeSettings(settings: Partial<Settings> & Record<string, unknown>): Settings {
  return {
    ...defaultSettings,
    ...settings,
    projectUrlsByStep: { ...defaultSettings.projectUrlsByStep, ...(settings.projectUrlsByStep ?? {}) },
    projectNamesByStep: { ...defaultSettings.projectNamesByStep, ...(settings.projectNamesByStep ?? {}) }
  };
}

export async function getSettings(): Promise<Settings> { return normalizeSettings(await readJson<Settings>(files.settings, defaultSettings)); }
export async function saveSettings(settings: Partial<Settings> & Record<string, unknown>) { await writeJsonAtomic(files.settings, normalizeSettings(settings)); }
export async function getTemplates(): Promise<PromptTemplates> { return { ...defaultPrompts, ...(await readJson<PromptTemplates>(files.templates, defaultPrompts)) }; }
export async function saveTemplates(templates: PromptTemplates) { await writeJsonAtomic(files.templates, templates); await writePromptFiles(templates, true); }
export async function importData(payload: { batches?: Batch[]; settings?: Settings; templates?: PromptTemplates }) { if (payload.batches) await saveBatches(payload.batches); if (payload.settings) await saveSettings(payload.settings as Partial<Settings> & Record<string, unknown>); if (payload.templates) await saveTemplates(payload.templates); }
