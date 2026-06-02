import express from 'express';
import path from 'node:path';
import os from 'node:os';
import { createServer as createViteServer } from 'vite';
import { initializeStorage, getBatches, getBatch, upsertBatch, getSettings, saveSettings, getTemplates, saveTemplates, importData } from './storage.js';
import { parseJudgmentText, validateCommand } from './parsers.js';
import { buildInitializationMessage, buildInputText } from './promptBuilder.js';
import type { Batch, LogItem, StepKey, StockItem } from './types.js';
import { stepLabels } from './types.js';

const app = express();
const port = Number(process.env.PORT || 5173);
app.use(express.json({ limit: '20mb' }));

type OutputField = 'xArticle'|'overseasXPost'|'noteArticle'|'japaneseXPostMain'|'noteImagePrompt'|'xImagePrompt'|'rawJudgmentText';
const stepToField: Record<Exclude<StepKey, 'step0'>, Exclude<OutputField, 'rawJudgmentText'>> = {
  step1: 'xArticle', step2: 'overseasXPost', step3: 'noteArticle', step4: 'japaneseXPostMain', step5: 'noteImagePrompt', step6: 'xImagePrompt'
};
const editableFields = new Set<OutputField>(['rawJudgmentText','xArticle','overseasXPost','noteArticle','japaneseXPostMain','noteImagePrompt','xImagePrompt']);

function log(batch: Batch, level: LogItem['level'], message: string) { batch.logs.push({ time: new Date().toISOString(), level, message }); }
function makeBatch(command: string, stocks: StockItem[], logs: LogItem[]): Batch { return { batchId: `batch-${Date.now()}`, createdAt: new Date().toISOString(), command, status: stocks.length ? 'draft' : 'error', stocks, logs }; }
function stepKey(input: unknown): StepKey { const n = Number(String(input).replace('step','')); if (n < 0 || n > 6 || !Number.isInteger(n)) throw new Error('step は 0〜6 を指定してください。'); return `step${n}` as StepKey; }
function computeStatus(batch: Batch): Batch['status'] {
  if (!batch.stocks.length) return 'error';
  const statuses = batch.stocks.flatMap((s) => Object.values(s.statusByStep));
  if (statuses.some((s) => s === 'error')) return 'error';
  const done = statuses.filter((s) => s === 'done' || s === 'manual').length;
  if (done === statuses.length) return 'done';
  return done > batch.stocks.length ? 'partial' : 'draft';
}
function normalizeStock(stock: StockItem): StockItem {
  const now = new Date().toISOString();
  const base = {
    xArticle: '', overseasXPost: '', noteArticle: '', japaneseXPostMain: '', noteImagePrompt: '', xImagePrompt: '',
    errorByStep: {}, updatedAt: now, ...stock
  };
  return {
    ...base,
    statusByStep: { step0: 'pending', step1: 'pending', step2: 'pending', step3: 'pending', step4: 'pending', step5: 'pending', step6: 'pending', ...(stock.statusByStep ?? {}) } as StockItem['statusByStep'],
    errorByStep: stock.errorByStep ?? {}
  };
}
function findStockOrThrow(batches: Batch[], stockId: string) {
  for (const batch of batches) {
    const stock = batch.stocks.find((s) => s.stockId === stockId);
    if (stock) return { batch, stock };
  }
  throw new Error('銘柄が見つかりません。');
}
function projectUrl(settings: Awaited<ReturnType<typeof getSettings>>, step: StepKey) { return settings.projectUrlsByStep[step] || settings.defaultProjectUrl || ''; }
function projectName(settings: Awaited<ReturnType<typeof getSettings>>, step: StepKey) { return settings.projectNamesByStep[step] || stepLabels[step]; }

app.get('/api/health', (_req, res) => res.json({ ok: true, appName: 'イヌ式市場|半自動化UI', mode: 'manual copy-paste support', localIp: localIp() }));
app.get('/api/batches', async (_req, res) => res.json((await getBatches()).map((b) => ({ ...b, stocks: b.stocks.map(normalizeStock), status: computeStatus({ ...b, stocks: b.stocks.map(normalizeStock) }) }))));
app.get('/api/batches/:batchId', async (req, res) => { const batch = await getBatch(req.params.batchId); if (!batch) return res.status(404).json({ error: 'バッチが見つかりません。' }); const stocks = batch.stocks.map(normalizeStock); res.json({ ...batch, stocks, status: computeStatus({ ...batch, stocks }) }); });

app.post('/api/batches/create-from-command', async (req, res) => {
  const command = String(req.body.command ?? '');
  const validation = validateCommand(command);
  if (!validation.ok) return res.status(400).json({ error: validation.warning });
  const batch = makeBatch(command.trim(), [], [{ time: new Date().toISOString(), level: 'info', message: '工程0コマンド用バッチを作成しました。ChatGPTへの送信は手動で行ってください。' }]);
  await upsertBatch(batch);
  res.json(batch);
});

app.post('/api/batches/manual-import', async (req, res) => {
  const { text, command = '手動取り込み', batchId } = req.body as { text: string; command?: string; batchId?: string };
  const parsed = parseJudgmentText(text, 'manual');
  if (batchId) {
    const batch = await getBatch(batchId);
    if (!batch) return res.status(404).json({ error: '追加先バッチが見つかりません。' });
    batch.stocks = [...batch.stocks.map(normalizeStock), ...parsed.stocks];
    batch.logs.push(...parsed.logs);
    log(batch, parsed.stocks.length ? 'info' : 'warn', `手動取り込みで${parsed.stocks.length}銘柄を追加しました。`);
    batch.status = computeStatus(batch);
    await upsertBatch(batch);
    return res.json(batch);
  }
  const batch = makeBatch(command, parsed.stocks, parsed.logs);
  if (!parsed.stocks.length) log(batch, 'error', '取り込める3行判定コードがありませんでした。');
  await upsertBatch(batch); res.json(batch);
});

app.post('/api/build-copy-text', async (req, res) => {
  try {
    const step = stepKey(req.body.step);
    const settings = await getSettings();
    const templates = await getTemplates();
    let stock: StockItem | undefined;
    if (req.body.stockId) stock = normalizeStock(findStockOrThrow(await getBatches(), String(req.body.stockId)).stock);
    const inputText = buildInputText(step, String(req.body.command ?? ''), stock);
    const warning = step !== 'step0' && !inputText ? (step === 'step1' || step === 'step2' || step === 'step3' ? '3行判定コードがありません。先に工程0の判定を取り込んでください。' : 'note記事がありません。先に工程3を作成・保存してください。') : '';
    res.json({ initializationText: buildInitializationMessage(step, templates), inputText, projectUrl: projectUrl(settings, step), projectName: projectName(settings, step), warning });
  } catch (e) { res.status(400).json({ error: e instanceof Error ? e.message : String(e) }); }
});

app.post('/api/run', (_req, res) => res.status(410).json({ error: 'このバージョンではChatGPT自動実行は無効です。「入力文をコピー」してChatGPTへ手動で貼り付け、出力をUIへ貼り戻してください。' }));

app.post('/api/stocks/:stockId/save', async (req, res) => {
  try {
    const { batchId, field, value, step, markCopied } = req.body as { batchId?: string; field?: OutputField; value?: string; step?: StepKey; markCopied?: boolean };
    if (!field || !editableFields.has(field)) return res.status(400).json({ error: '保存フィールドが不正です。' });
    const batch = batchId ? await getBatch(batchId) : findStockOrThrow(await getBatches(), req.params.stockId).batch;
    if (!batch) return res.status(404).json({ error: 'バッチが見つかりません。' });
    batch.stocks = batch.stocks.map(normalizeStock);
    const stock = batch.stocks.find((s) => s.stockId === req.params.stockId);
    if (!stock) return res.status(404).json({ error: '銘柄が見つかりません。' });
    (stock as unknown as Record<string, string>)[field] = value ?? '';
    const saveStep = step ?? (field === 'rawJudgmentText' ? 'step0' : (Object.entries(stepToField).find(([, f]) => f === field)?.[0] as StepKey | undefined));
    if (saveStep) {
      if (markCopied && saveStep !== 'step0') {
        (stock.statusByStep as Record<string, string>)[saveStep] = 'copied';
      } else if ((value ?? '').trim()) {
        (stock.statusByStep as Record<string, string>)[saveStep] = saveStep === 'step0' ? 'manual' : 'done';
        delete stock.errorByStep[saveStep];
      } else {
        (stock.statusByStep as Record<string, string>)[saveStep] = 'pending';
      }
    }
    stock.updatedAt = new Date().toISOString();
    batch.status = computeStatus(batch);
    log(batch, 'info', `貼り戻し保存：${stock.name} ${field}`);
    await upsertBatch(batch);
    res.json(batch);
  } catch (e) { res.status(500).json({ error: e instanceof Error ? e.message : String(e) }); }
});

app.get('/api/templates', async (_req, res) => res.json(await getTemplates()));
app.post('/api/templates/save', async (req, res) => { await saveTemplates(req.body); res.json(await getTemplates()); });
app.get('/api/settings', async (_req, res) => res.json(await getSettings()));
app.post('/api/settings/save', async (req, res) => { await saveSettings(req.body); res.json(await getSettings()); });
app.post('/api/export', async (req, res) => { const kind = req.body.kind ?? 'all'; const payload: any = {}; if (kind === 'all' || kind === 'batches') payload.batches = await getBatches(); if (kind === 'all' || kind === 'settings') payload.settings = await getSettings(); if (kind === 'all' || kind === 'templates') payload.templates = await getTemplates(); res.json(payload); });
app.post('/api/import', async (req, res) => { await importData(req.body); res.json({ ok: true }); });

await initializeStorage();
const vite = await createViteServer({ root: path.join(process.cwd(), 'web'), server: { middlewareMode: true }, appType: 'spa' });
app.use(vite.middlewares);
app.listen(port, '0.0.0.0', () => {
  console.log('イヌ式市場|半自動化UI is running.');
  console.log('Mode: manual copy-paste support');
  console.log(`PC:\nhttp://localhost:${port}`);
  console.log(`Smartphone:\nhttp://${localIp()}:${port}`);
});
function localIp() { for (const net of Object.values(os.networkInterfaces()).flat() as any[]) if (net && net.family === 'IPv4' && !net.internal) return net.address; return '192.168.x.x'; }
