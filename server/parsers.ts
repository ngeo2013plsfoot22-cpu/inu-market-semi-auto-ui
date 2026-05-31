import type { LogItem, StockItem } from './types.js';

const allowedJudgments = new Set(['ヨシ(盤石)╰( Ｕ ・ω・)', 'ヨシ(期待先行)╰( Ｕ ・ω・)', '待て(有望)╰( Ｕ ・ω・)', '待て(絶望)╰( Ｕ ・ω・)']);

export function validateCommand(command: string): { ok: boolean; warning?: string } {
  const trimmed = command.trim();
  if (!trimmed) return { ok: false, warning: '実行コマンドが空欄です。' };
  if (trimmed === 'ランダム実行') return { ok: false, warning: '「ランダム実行」は旧形式です。「ランダム　実行」を使用してください。' };
  if (!trimmed.includes('実行')) return { ok: false, warning: '実行コマンドに「実行」を含めてください。' };
  return { ok: true };
}

export function parseJudgmentText(text: string, source: 'manual'|'runner' = 'manual'): { stocks: StockItem[]; logs: LogItem[] } {
  const logs: LogItem[] = [];
  const now = new Date().toISOString();
  const blocks = text.replace(/\r\n/g, '\n').split(/\n\s*\n/g).map((b) => b.trim()).filter(Boolean);
  const stocks: StockItem[] = [];
  blocks.forEach((block, index) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.includes('判定保留') || lines[1] === '判定保留') { logs.push({ time: now, level: 'warn', message: `判定保留を取り込み対象外にしました：${lines[0] ?? `ブロック${index + 1}`}` }); return; }
    if (lines.length !== 3) { logs.push({ time: now, level: 'warn', message: `3行形式ではないためスキップしました：ブロック${index + 1}` }); return; }
    const m = lines[0].match(/^(.+)\s+([A-Za-z0-9.\-]+)$/);
    if (!m) { logs.push({ time: now, level: 'warn', message: `銘柄名と証券コードを解析できません：${lines[0]}` }); return; }
    const judgment = lines[2];
    if (judgment === '待て╰( Ｕ ・ω・)') { logs.push({ time: now, level: 'warn', message: `旧形式の判定「待て」をスキップしました：${lines[0]}` }); return; }
    if (!allowedJudgments.has(judgment)) { logs.push({ time: now, level: 'warn', message: `許可されていない判定をスキップしました：${judgment}` }); return; }
    const stockId = `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;
    stocks.push({
      stockId, name: m[1].trim(), code: m[2].trim(), priceLine: lines[1], judgment, rawJudgmentText: lines.join('\n'),
      xArticle: '', overseasXPost: '', noteArticle: '', japaneseXPostMain: '', noteImagePrompt: '', xImagePrompt: '',
      statusByStep: { step0: source === 'manual' ? 'manual' : 'done', step1: 'pending', step2: 'pending', step3: 'pending', step4: 'pending', step5: 'pending', step6: 'pending' },
      errorByStep: {}, updatedAt: now
    });
  });
  return { stocks, logs };
}
