import express from 'express';
import path from 'node:path';
import os from 'node:os';
import { createServer as createViteServer } from 'vite';
import { initializeStorage, getBatches, getBatch, upsertBatch, getSettings, saveSettings, getTemplates, saveTemplates, importData } from './storage.js';
import { parseJudgmentText, validateCommand } from './parsers.js';
import { buildInitializationMessage } from './promptBuilder.js';
import { runTwoStepBatch } from './runner.js';
import type { Batch, LogItem, StepKey, StockItem } from './types.js';

const app = express();
const port = Number(process.env.PORT || 5173);
app.use(express.json({ limit: '20mb' }));

const stepToField: Record<StepKey, keyof Pick<StockItem, 'xArticle'|'overseasXPost'|'noteArticle'|'japaneseXPostMain'|'noteImagePrompt'|'xImagePrompt'>> = {
  step0: 'noteArticle' as never, step1: 'xArticle', step2: 'overseasXPost', step3: 'noteArticle', step4: 'japaneseXPostMain', step5: 'noteImagePrompt', step6: 'xImagePrompt'
};

function log(batch: Batch, level: LogItem['level'], message: string) { batch.logs.push({ time: new Date().toISOString(), level, message }); }
function makeBatch(command: string, stocks: StockItem[], logs: LogItem[]): Batch { return { batchId: `batch-${Date.now()}`, createdAt: new Date().toISOString(), command, status: stocks.length ? 'draft' : 'error', stocks, logs }; }
function stepKey(step: number): StepKey { if (step < 0 || step > 6) throw new Error('step は 0〜6 を指定してください。'); return `step${step}` as StepKey; }
function batchProgress(batch: Batch) { const total = batch.stocks.length * 7; const done = batch.stocks.reduce((n, s) => n + Object.values(s.statusByStep).filter((v) => v === 'done' || v === 'manual').length, 0); return total === done ? 'done' : done > batch.stocks.length ? 'partial' : batch.status; }

app.get('/api/health', (_req, res) => res.json({ ok: true, appName: 'イヌ式市場|半自動化UI', localIp: localIp(), runner: 'ready' }));
app.get('/api/batches', async (_req, res) => res.json(await getBatches()));
app.get('/api/batches/:batchId', async (req, res) => { const batch = await getBatch(req.params.batchId); if (!batch) return res.status(404).json({ error: 'バッチが見つかりません。' }); res.json(batch); });
app.post('/api/batches/manual-import', async (req, res) => {
  const { text, command = '手動取り込み' } = req.body as { text: string; command?: string };
  const parsed = parseJudgmentText(text, 'manual');
  const batch = makeBatch(command, parsed.stocks, parsed.logs);
  if (!parsed.stocks.length) log(batch, 'error', '取り込める3行判定コードがありませんでした。');
  await upsertBatch(batch); res.json(batch);
});

app.post('/api/run', async (req, res) => {
  try {
    const step = stepKey(Number(req.body.step));
    const batchId = req.body.batchId as string | undefined;
    const stockId = req.body.stockId as string | undefined;
    const regenerate = Boolean(req.body.regenerate);
    const settings = await getSettings(); const templates = await getTemplates();
    if (step === 'step0') {
      const command = String(req.body.command ?? ''); const validation = validateCommand(command); if (!validation.ok) return res.status(400).json({ error: validation.warning });
      const tempBatch = makeBatch(command, [], []); log(tempBatch, 'info', `工程0開始：${command}`);
      const [answer] = await runTwoStepBatch({ step, inputs: [{ label: command, text: command }], initializationMessage: buildInitializationMessage(step, templates), settings, log: (l,m) => log(tempBatch,l,m) });
      const parsed = parseJudgmentText(answer, 'runner'); tempBatch.stocks = parsed.stocks; tempBatch.logs.push(...parsed.logs); tempBatch.status = parsed.stocks.length ? 'draft' : 'error'; await upsertBatch(tempBatch); return res.json(tempBatch);
    }
    if (!batchId) return res.status(400).json({ error: 'batchId が必要です。' });
    const batch = await getBatch(batchId); if (!batch) return res.status(404).json({ error: 'バッチが見つかりません。' });
    batch.status = 'running'; log(batch, 'info', `${stepLabel(step)}開始`);
    const targetStocks = batch.stocks.filter((s) => (!stockId || s.stockId === stockId) && (regenerate || s.statusByStep[step] !== 'done'));
    const inputs = targetStocks.map((s) => ({ label: `${s.name} ${s.code}`, text: step === 'step1' || step === 'step2' || step === 'step3' ? s.rawJudgmentText : s.noteArticle }));
    for (const [i, input] of inputs.entries()) {
      if (!input.text.trim()) { const s = targetStocks[i]; const msg = step === 'step1' || step === 'step2' || step === 'step3' ? '3行判定コードがありません。' : 'note記事がありません。先に工程3を実行してください。'; s.statusByStep[step] = 'error'; s.errorByStep[step] = msg; log(batch, 'error', `${stepLabel(step)} ${s.name}：${msg}`); }
    }
    const runnable = targetStocks.filter((s) => s.statusByStep[step] !== 'error');
    runnable.forEach((s) => { s.statusByStep[step] = 'running'; s.updatedAt = new Date().toISOString(); }); await upsertBatch(batch);
    const outputs = runnable.length ? await runTwoStepBatch({ step, inputs: runnable.map((s) => ({ label: `${s.name} ${s.code}`, text: step === 'step1' || step === 'step2' || step === 'step3' ? s.rawJudgmentText : s.noteArticle })), initializationMessage: buildInitializationMessage(step, templates), settings, log: (l,m) => log(batch,l,m) }) : [];
    outputs.forEach((out, i) => { const s = runnable[i]; (s as any)[stepToField[step]] = out; s.statusByStep[step] = 'done'; delete s.errorByStep[step]; s.updatedAt = new Date().toISOString(); });
    batch.status = batchProgress(batch); await upsertBatch(batch); res.json(batch);
  } catch (e) { res.status(500).json({ error: e instanceof Error ? e.message : String(e) }); }
});

app.post('/api/stocks/:stockId/save', async (req, res) => {
  const { batchId, field, value } = req.body as { batchId: string; field: string; value: string };
  const allowed = new Set(['rawJudgmentText','xArticle','overseasXPost','noteArticle','japaneseXPostMain','noteImagePrompt','xImagePrompt']);
  if (!allowed.has(field)) return res.status(400).json({ error: '保存できないフィールドです。' });
  const batch = await getBatch(batchId); if (!batch) return res.status(404).json({ error: 'バッチが見つかりません。' });
  const stock = batch.stocks.find((s) => s.stockId === req.params.stockId); if (!stock) return res.status(404).json({ error: '銘柄が見つかりません。' });
  (stock as any)[field] = value; stock.updatedAt = new Date().toISOString(); log(batch, 'info', `手動保存：${stock.name} ${field}`); await upsertBatch(batch); res.json(batch);
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
  console.log(`PC:\nhttp://localhost:${port}`);
  console.log(`Smartphone:\nhttp://${localIp()}:${port}`);
});
function localIp() { for (const net of Object.values(os.networkInterfaces()).flat() as any[]) if (net && net.family === 'IPv4' && !net.internal) return net.address; return '192.168.x.x'; }
function stepLabel(step: StepKey) { return `工程${step.replace('step','')}`; }
