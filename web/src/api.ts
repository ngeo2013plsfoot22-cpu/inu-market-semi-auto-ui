import type { Batch, CopyText, LogItem, Settings, StockItem, StepKey, Templates } from './types';

const stepKeys: StepKey[] = ['step0', 'step1', 'step2', 'step3', 'step4', 'step5', 'step6'];
const emptyUrls: Record<StepKey, string> = { step0: '', step1: '', step2: '', step3: '', step4: '', step5: '', step6: '' };
const chatNames: Record<StepKey, string> = {
  step0: 'イヌ式市場|買い目判定',
  step1: 'イヌ式市場|X記事作成',
  step2: 'イヌ式市場|X英語ポスト作成',
  step3: 'イヌ式市場|note記事作成',
  step4: 'イヌ式市場|X日本語ポスト作成',
  step5: 'イヌ式市場|note画像指示書',
  step6: 'イヌ式市場|X画像指示書'
};
const defaultSettings: Settings = {
  defaultProjectUrl: '',
  projectUrlsByStep: emptyUrls,
  projectNamesByStep: chatNames,
  chatUrlsByStep: emptyUrls,
  chatNamesByStep: chatNames,
  step0ChatUrl: '',
  step1ChatUrl: '',
  step2ChatUrl: '',
  step3ChatUrl: '',
  step4ChatUrl: '',
  step5ChatUrl: '',
  step6ChatUrl: '',
  appendOutputRulesToInput: false,
  favoriteCommands: ['ランダム　実行', 'ランダムヨシ　実行', 'ランダム高配当　実行', 'ランダムテーマ株　実行', 'ランダムモメンタム　実行', 'ランダム半導体　実行', 'ランダムAI　実行', 'ランダム不動産　実行']
};
const defaultTemplates: Templates = {
  step0_buyJudgmentPrompt: '',
  step1_xArticlePrompt: '',
  step2_overseasXPostPrompt: '',
  step3_noteArticlePrompt: '',
  step4_japaneseXPostPrompt: '',
  step5_noteImagePrompt: '',
  step6_xImagePrompt: ''
};
const storageKey = 'inu-market-semi-auto-ui:v3';
const legacyStorageKey = 'inu-market-semi-auto-ui:v2';

type LocalData = { batches: Batch[]; settings: Settings; templates: Templates };
type ImportMode = 'append' | 'overwrite';
type BatchConflictMode = 'overwrite' | 'skip' | 'duplicate';
type ImportPayload = Partial<LocalData> & {
  promptTemplates?: Templates;
  favoriteCommands?: string[];
  chatUrlsByStep?: Record<StepKey, string>;
  projectUrlsByStep?: Record<StepKey, string>;
  importMode?: ImportMode;
  batchConflictMode?: BatchConflictMode;
};

function now() { return new Date().toISOString(); }
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function makeLog(message: string): LogItem { return { time: now(), level: 'info', message }; }

function normalizeSettings(settings: Partial<Settings> & Record<string, unknown> = {}): Settings {
  const urls = { ...defaultSettings.chatUrlsByStep, ...(settings.projectUrlsByStep ?? {}), ...(settings.chatUrlsByStep ?? {}) } as Record<StepKey, string>;
  const names = { ...defaultSettings.chatNamesByStep, ...(settings.projectNamesByStep ?? {}), ...(settings.chatNamesByStep ?? {}) } as Record<StepKey, string>;
  return {
    ...defaultSettings,
    ...settings,
    projectUrlsByStep: urls,
    projectNamesByStep: names,
    chatUrlsByStep: urls,
    chatNamesByStep: names,
    step0ChatUrl: urls.step0,
    step1ChatUrl: urls.step1,
    step2ChatUrl: urls.step2,
    step3ChatUrl: urls.step3,
    step4ChatUrl: urls.step4,
    step5ChatUrl: urls.step5,
    step6ChatUrl: urls.step6,
    favoriteCommands: Array.isArray(settings.favoriteCommands) && settings.favoriteCommands.length ? settings.favoriteCommands.map(String).filter(Boolean) : defaultSettings.favoriteCommands,
    appendOutputRulesToInput: Boolean(settings.appendOutputRulesToInput)
  };
}

function normalizeTemplates(templates: Partial<Templates> = {}): Templates { return { ...defaultTemplates, ...templates }; }

function loadLocal(): LocalData {
  const raw = localStorage.getItem(storageKey) ?? localStorage.getItem(legacyStorageKey);
  if (!raw) return { batches: [], settings: clone(defaultSettings), templates: clone(defaultTemplates) };
  try {
    const parsed = JSON.parse(raw);
    return {
      batches: Array.isArray(parsed.batches) ? parsed.batches : [],
      settings: normalizeSettings(parsed.settings ?? {}),
      templates: normalizeTemplates(parsed.templates ?? parsed.promptTemplates ?? {})
    };
  } catch {
    return { batches: [], settings: clone(defaultSettings), templates: clone(defaultTemplates) };
  }
}

function saveLocal(data: Partial<LocalData>) {
  const current = loadLocal();
  const next = {
    batches: data.batches ?? current.batches,
    settings: data.settings ? normalizeSettings(data.settings) : current.settings,
    templates: data.templates ? normalizeTemplates(data.templates) : current.templates
  };
  localStorage.setItem(storageKey, JSON.stringify(next));
}

function computeBatchStatus(batch: Batch): Batch['status'] {
  if (!batch.stocks.length) return 'draft';
  const statuses = batch.stocks.flatMap((stock) => stepKeys.map((step) => stock.statusByStep[step]));
  if (statuses.some((status) => status === 'error')) return 'error';
  return statuses.every((status) => status === 'done' || status === 'manual') ? 'done' : 'partial';
}

function makeBatch(command: string, stocks: StockItem[] = []): Batch {
  const batch: Batch = { batchId: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: now(), command, status: stocks.length ? 'partial' : 'draft', stocks, logs: [] };
  batch.status = computeBatchStatus(batch);
  return batch;
}

function parseJudgmentText(text: string): StockItem[] {
  const allowed = new Set(['ヨシ(盤石)╰( Ｕ ・ω・)', 'ヨシ(期待先行)╰( Ｕ ・ω・)', '待て(有望)╰( Ｕ ・ω・)', '待て(絶望)╰( Ｕ ・ω・)']);
  return text.replace(/\r\n/g, '\n').split(/\n\s*\n/g).map((block) => block.trim()).filter(Boolean).flatMap((block, index) => {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    const match = lines[0]?.match(/^(.+)\s+([A-Za-z0-9.\-]+)$/);
    if (lines.length !== 3 || !match || !allowed.has(lines[2])) return [];
    return [{
      stockId: `local-stock-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
      name: match[1].trim(),
      code: match[2].trim(),
      priceLine: lines[1],
      judgment: lines[2],
      rawJudgmentText: lines.join('\n'),
      xArticle: '',
      overseasXPost: '',
      noteArticle: '',
      japaneseXPostMain: '',
      noteImagePrompt: '',
      xImagePrompt: '',
      statusByStep: { step0: 'manual', step1: 'pending', step2: 'pending', step3: 'pending', step4: 'pending', step5: 'pending', step6: 'pending' },
      errorByStep: {},
      updatedAt: now()
    } as StockItem];
  });
}

function inputText(step: StepKey, stock?: StockItem, command = '') {
  if (step === 'step0') return command.trim();
  if (!stock) return '';
  return (step === 'step1' || step === 'step2' || step === 'step3') ? stock.rawJudgmentText.trim() : stock.noteArticle.trim();
}

function findStock(data: LocalData, stockId: string) {
  for (const batch of data.batches) {
    const stock = batch.stocks.find((item) => item.stockId === stockId);
    if (stock) return { batch, stock };
  }
  throw new Error('銘柄が見つかりません。');
}

function duplicateBatch(batch: Batch): Batch {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    ...clone(batch),
    batchId: `${batch.batchId}-copy-${suffix}`,
    createdAt: now(),
    stocks: batch.stocks.map((stock, index) => ({ ...stock, stockId: `${stock.stockId}-copy-${suffix}-${index}`, updatedAt: now() })),
    logs: [...(batch.logs ?? []), makeLog(`JSONインポート時に batchId ${batch.batchId} が重複したため複製しました。`)]
  };
}

function importBatches(current: Batch[], incoming: Batch[], importMode: ImportMode, conflictMode: BatchConflictMode) {
  if (importMode === 'overwrite') return incoming;
  const result = [...current];
  for (const batch of incoming) {
    const index = result.findIndex((item) => item.batchId === batch.batchId);
    if (index < 0) result.unshift(batch);
    else if (conflictMode === 'overwrite') result[index] = batch;
    else if (conflictMode === 'duplicate') result.unshift(duplicateBatch(batch));
  }
  return result;
}

function mergeSettings(current: Settings, payload: ImportPayload, importMode: ImportMode) {
  const incoming = payload.settings ? { ...payload.settings } as Partial<Settings> & Record<string, unknown> : {};
  if (payload.favoriteCommands) incoming.favoriteCommands = payload.favoriteCommands;
  if (payload.chatUrlsByStep) incoming.chatUrlsByStep = payload.chatUrlsByStep;
  if (payload.projectUrlsByStep) incoming.projectUrlsByStep = payload.projectUrlsByStep;
  if (!Object.keys(incoming).length) return current;
  return normalizeSettings(importMode === 'overwrite' ? incoming : { ...current, ...incoming });
}

export const api = {
  health: async () => ({ mode: '静的Webアプリ（ブラウザ内保存）', localIp: location.hostname }),
  batches: async () => loadLocal().batches,
  batch: async (id: string) => {
    const batch = loadLocal().batches.find((item) => item.batchId === id);
    if (!batch) throw new Error('バッチが見つかりません。');
    return batch;
  },
  manualImport: async (text: string, command = '手動取り込み', batchId?: string) => {
    const data = loadLocal();
    const stocks = parseJudgmentText(text);
    if (!stocks.length) throw new Error('3行判定を解析できませんでした。銘柄名+コード、価格行、判定行の3行ブロックを貼ってください。');
    let batch: Batch;
    if (batchId) {
      batch = data.batches.find((item) => item.batchId === batchId)!;
      if (!batch) throw new Error('追加先のバッチが見つかりません。');
      batch.stocks = [...batch.stocks, ...stocks];
      batch.status = computeBatchStatus(batch);
      batch.logs = [...(batch.logs ?? []), makeLog(`${stocks.length}件の3行判定を手動取り込みしました。`)];
    } else {
      batch = makeBatch(command, stocks);
      batch.logs = [makeLog(`${stocks.length}件の3行判定からバッチを作成しました。`)];
      data.batches.unshift(batch);
    }
    saveLocal({ batches: data.batches });
    return batch;
  },
  createFromCommand: async (command: string) => {
    const data = loadLocal();
    const batch = makeBatch(command.trim());
    batch.logs = [makeLog('実行コードから空バッチを作成しました。')];
    data.batches.unshift(batch);
    saveLocal({ batches: data.batches });
    return batch;
  },
  buildCopyText: async (body: { step: StepKey; stockId?: string; command?: string }): Promise<CopyText> => {
    const data = loadLocal();
    const stock = body.stockId ? findStock(data, body.stockId).stock : undefined;
    const input = inputText(body.step, stock, body.command);
    const settings = data.settings;
    const needsJudgment = body.step === 'step1' || body.step === 'step2' || body.step === 'step3';
    const warning = body.step !== 'step0' && !input ? (needsJudgment ? '3行判定コードがありません。先に工程0の判定を取り込んでください。' : 'note記事がありません。先に工程3を作成・保存してください。') : '';
    return { initializationText: '', inputText: input, projectUrl: settings.chatUrlsByStep[body.step] || '', projectName: settings.chatNamesByStep[body.step], warning };
  },
  saveStock: async (stockId: string, body: { batchId?: string; field: keyof StockItem; value?: string; step?: StepKey; markCopied?: boolean }) => {
    const data = loadLocal();
    const found = findStock(data, stockId);
    (found.stock[body.field] as string) = body.value ?? '';
    if (body.step) {
      (found.stock.statusByStep as Record<StepKey, string>)[body.step] = body.markCopied ? 'copied' : ((body.value ?? '').trim() ? (body.step === 'step0' ? 'manual' : 'done') : 'pending');
    }
    found.stock.updatedAt = now();
    found.batch.status = computeBatchStatus(found.batch);
    saveLocal({ batches: data.batches });
    return found.batch;
  },
  settings: async () => loadLocal().settings,
  saveSettings: async (body: Partial<Settings> & Record<string, unknown>) => {
    const settings = normalizeSettings(body);
    saveLocal({ settings });
    return settings;
  },
  templates: async () => loadLocal().templates,
  saveTemplates: async (body: Partial<Templates>) => {
    const templates = normalizeTemplates(body);
    saveLocal({ templates });
    return templates;
  },
  export: async (kind: string) => {
    const data = loadLocal();
    const payload: Record<string, unknown> = { exportedAt: now(), app: 'inu-market-semi-auto-ui', schemaVersion: 3 };
    if (kind === 'all' || kind === 'batches') {
      payload.batches = data.batches;
      payload.stocks = data.batches.flatMap((batch) => batch.stocks.map((stock) => ({ ...stock, batchId: batch.batchId })));
      payload.postStatus = data.batches.map((batch) => ({ batchId: batch.batchId, stocks: batch.stocks.map((stock) => ({ stockId: stock.stockId, code: stock.code, statusByStep: stock.statusByStep })) }));
    }
    if (kind === 'all' || kind === 'settings') {
      payload.settings = data.settings;
      payload.favoriteCommands = data.settings.favoriteCommands;
      payload.chatUrlsByStep = data.settings.chatUrlsByStep;
      payload.projectUrlsByStep = data.settings.projectUrlsByStep;
    }
    if (kind === 'all' || kind === 'templates') {
      payload.templates = data.templates;
      payload.promptTemplates = data.templates;
    }
    return payload;
  },
  import: async (body: ImportPayload) => {
    const data = loadLocal();
    const importMode = body.importMode ?? 'append';
    const conflictMode = body.batchConflictMode ?? 'overwrite';
    const incomingBatches = Array.isArray(body.batches) ? body.batches : undefined;
    const incomingTemplates = body.templates ?? body.promptTemplates;
    saveLocal({
      batches: incomingBatches ? importBatches(data.batches, incomingBatches, importMode, conflictMode) : data.batches,
      settings: mergeSettings(data.settings, body, importMode),
      templates: incomingTemplates ? (importMode === 'overwrite' ? normalizeTemplates(incomingTemplates) : normalizeTemplates({ ...data.templates, ...incomingTemplates })) : data.templates
    });
    return { ok: true };
  }
};
