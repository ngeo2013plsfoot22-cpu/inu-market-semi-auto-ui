import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from './api';
import type { Batch, CopyText, Settings, StockItem, StepKey, Templates } from './types';
import './styles.css';

const stepKeys: StepKey[] = ['step0','step1','step2','step3','step4','step5','step6'];
const stepNames: Record<StepKey,string> = { step0:'買い目判定', step1:'X記事作成', step2:'海外Xポスト作成', step3:'note記事作成', step4:'日本語Xポスト作成', step5:'note画像指示作成', step6:'X画像指示作成' };
const tabs = [
  ['判定','rawJudgmentText','step0'], ['X記事','xArticle','step1'], ['海外Xポスト','overseasXPost','step2'], ['note記事','noteArticle','step3'], ['日本語Xポスト','japaneseXPostMain','step4'], ['note画像指示','noteImagePrompt','step5'], ['X画像指示','xImagePrompt','step6']
] as const;
const fixedCommands = ['ランダム　実行','ランダムヨシ　実行','ランダム高配当　実行','ランダム期待先行　実行','ランダムテーマ株　実行','ランダムモメンタム　実行','ランダム待て　実行'];

function App() {
  const [health, setHealth] = useState<any>(); const [batches, setBatches] = useState<Batch[]>([]); const [selected, setSelected] = useState<Batch>(); const [settings, setSettings] = useState<Settings>(); const [templates, setTemplates] = useState<Templates>();
  const [manualText, setManualText] = useState(''); const [customCommand, setCustomCommand] = useState(''); const [toast, setToast] = useState(''); const [view, setView] = useState<'home'|'settings'|'templates'|'logs'>('home');
  async function refresh(id = selected?.batchId) { const [h, bs] = await Promise.all([api.health(), api.batches()]); setHealth(h); setBatches(bs); if (id) setSelected(await api.batch(id)); else setSelected(bs[0]); }
  useEffect(() => { refresh().catch(e => notify(e.message)); api.settings().then(setSettings); api.templates().then(setTemplates); }, []);
  function notify(msg:string) { setToast(msg); window.setTimeout(()=>setToast(''), 2600); }
  async function copyText(text:string, label='コピーしました') { if (!text.trim()) return notify('入力文が空のためコピーできません。'); await navigator.clipboard.writeText(text); notify(label); }
  async function createCommandBatch(command: string) { try { const b = await api.createFromCommand(command); setSelected(b); await refresh(b.batchId); notify('工程0コマンド用バッチを作成しました。'); } catch(e:any) { notify(e.message); } }
  async function importManual(batchId?: string) { try { const b = await api.manualImport(manualText, '手動取り込み', batchId); setSelected(b); setManualText(''); await refresh(b.batchId); notify(batchId ? '既存バッチに追加しました。' : '3行判定を取り込みました。'); } catch(e:any) { notify(e.message); } }
  return <div className="app">
    <header><h1>イヌ式市場|半自動化UI</h1><p className="subtitle">ChatGPT手動コピペ支援版</p><div className="status"><span>Mode: {health?.mode ?? 'manual copy-paste support'}</span><span>スマホURL: http://{health?.localIp || '192.168.x.x'}:5173</span></div><nav><button onClick={()=>setView('home')}>ホーム</button><button onClick={()=>setView('settings')}>設定</button><button onClick={()=>setView('templates')}>プロンプト</button><button onClick={()=>setView('logs')}>ログ</button></nav></header>
    {toast && <div className="alert" onClick={()=>setToast('')}>{toast}</div>}
    {view==='settings' && settings && <SettingsView settings={settings} setSettings={setSettings} notify={notify} />}
    {view==='templates' && templates && <TemplatesView templates={templates} setTemplates={setTemplates} notify={notify} />}
    {view==='logs' && selected && <Logs batch={selected} />}
    {view==='home' && <main>
      <section className="card"><h2>新規バッチ作成 / 工程0コマンド作成</h2><p className="hint">工程0は自動送信しません。初期化文と実行コマンドをコピーし、ChatGPTプロジェクトへ手動で貼り付けてください。</p><Step0CopyPanel command={customCommand || fixedCommands[0]} settings={settings} copyText={copyText} notify={notify}/><h3>固定コマンド</h3><div className="grid">{fixedCommands.map(c=><button key={c} onClick={()=>{setCustomCommand(c); createCommandBatch(c);}}>{c}</button>)}</div><label>カスタム実行コマンド</label><input value={customCommand} onChange={e=>setCustomCommand(e.target.value)} placeholder="ランダム半導体　実行 / メタプラネット 実行"/><div className="actions"><button onClick={()=>createCommandBatch(customCommand)}>新規バッチ作成</button><button onClick={()=>copyText(customCommand,'実行コマンドをコピーしました')}>実行コマンドをコピー</button></div>{customCommand.trim()==='ランダム実行' && <p className="warn">「ランダム実行」は旧形式です。「ランダム　実行」を使用してください。</p>}</section>
      <section className="card"><h2>手動3行判定取り込み</h2><textarea className="big" value={manualText} onChange={e=>setManualText(e.target.value)} placeholder={'ソフトバンク 9434\n216.5 (低値圏)/-1.1/-0.51%\nヨシ(盤石)╰( Ｕ ・ω・)\n\nメタプラネット 3350\n298 (低値圏)/-4/-1.32%\n待て(絶望)╰( Ｕ ・ω・)'} /><div className="actions"><button onClick={()=>importManual()}>解析して新規バッチ作成</button><button disabled={!selected} onClick={()=>selected && importManual(selected.batchId)}>既存バッチに追加</button></div></section>
      <section className="card"><h2>バッチ一覧</h2>{batches.length===0 && <p className="hint">まだバッチがありません。</p>}{batches.map(b=><button className={b.batchId===selected?.batchId?'selected':''} key={b.batchId} onClick={()=>setSelected(b)}>{new Date(b.createdAt).toLocaleString()} / {b.command} / {b.stocks.length}銘柄</button>)}</section>
      {selected && <BatchDetail batch={selected} setBatch={setSelected} refresh={refresh} copyText={copyText} notify={notify}/>} </main>}
  </div>;
}

function Step0CopyPanel({ command, settings, copyText, notify }: { command:string; settings?:Settings; copyText:(t:string,l?:string)=>void; notify:(m:string)=>void }) {
  const [copy, setCopy] = useState<CopyText>();
  useEffect(()=>{ api.buildCopyText({ step:'step0', command }).then(setCopy).catch(()=>undefined); }, [command]);
  function openProject(){ const url = copy?.projectUrl || settings?.projectUrlsByStep.step0 || settings?.defaultProjectUrl; if (!url) return notify('工程0：買い目判定\nプロジェクトURLが未設定です。設定画面で登録してください。'); window.open(url, '_blank', 'noopener,noreferrer'); }
  return <div className="mini"><h3>工程0：買い目判定</h3><div className="actions"><button onClick={openProject}>工程0プロジェクトを開く</button><button onClick={()=>copyText(copy?.initializationText ?? '', '工程0初期化文をコピーしました')}>工程0初期化文をコピー</button><button onClick={()=>copyText(command, '実行コマンドをコピーしました')}>実行コマンドをコピー</button></div>{!copy?.projectUrl && <p className="warn">工程0：買い目判定<br/>プロジェクトURLが未設定です。設定画面で登録してください。</p>}</div>
}

function BatchDetail({ batch, setBatch, refresh, copyText, notify }: { batch:Batch; setBatch:(b:Batch)=>void; refresh:(id?:string)=>Promise<void>; copyText:(t:string,l?:string)=>void; notify:(m:string)=>void }) {
  const counts = useMemo(() => stepKeys.map(k => `${stepNames[k]} ${batch.stocks.filter(s=>s.statusByStep[k]==='done'||s.statusByStep[k]==='manual').length}/${batch.stocks.length}`), [batch]);
  return <section className="card"><h2>バッチ詳細</h2><p>作成日時：{new Date(batch.createdAt).toLocaleString()}</p><p>実行コマンド：{batch.command}</p><p>銘柄数：{batch.stocks.length} / 状態：{batch.status}</p><div className="progress">{counts.map(c=><span key={c}>{c}</span>)}</div><h3>一括コピー支援</h3><div className="grid">{stepKeys.slice(1).map(k=><BulkStep key={k} step={k} batch={batch} setBatch={setBatch} refresh={refresh} copyText={copyText} notify={notify}/>)}</div><h3>ログ</h3>{batch.logs.slice(-5).map((l,i)=><p key={i} className={l.level}>[{new Date(l.time).toLocaleTimeString()}] {l.message}</p>)}<h3>銘柄カード</h3>{batch.stocks.map((s,i)=><StockCard key={s.stockId} batch={batch} stock={s} index={i} setBatch={setBatch} refresh={refresh} copyText={copyText} notify={notify}/>)}</section>;
}

function BulkStep({ step, batch, setBatch, refresh, copyText, notify }: { key?: React.Key; step:StepKey; batch:Batch; setBatch:(b:Batch)=>void; refresh:(id?:string)=>Promise<void>; copyText:(t:string,l?:string)=>void; notify:(m:string)=>void }) {
  const pending = batch.stocks.filter(s=>s.statusByStep[step] !== 'done'); const current = pending[0];
  if (!current) return <div className="bulk"><h4>工程{step.replace('step','')}：{stepNames[step]}</h4><p className="info">全件完了しました。</p></div>;
  return <div className="bulk"><h4>工程{step.replace('step','')}：{stepNames[step]}</h4><p>未完了 {pending.length}/{batch.stocks.length}</p><p>現在：{current.name} {current.code}</p><CopyControls batch={batch} stock={current} step={step} setBatch={setBatch} refresh={refresh} copyText={copyText} notify={notify} compact /></div>;
}

function StockCard({ batch, stock, index, setBatch, refresh, copyText, notify }: { key?: React.Key; batch:Batch; stock:StockItem; index:number; setBatch:(b:Batch)=>void; refresh:(id?:string)=>Promise<void>; copyText:(t:string,l?:string)=>void; notify:(m:string)=>void }) {
  const [tab, setTab] = useState(0); const [draft, setDraft] = useState<Record<string,string>>({}); const [paste, setPaste] = useState(''); const [showPaste, setShowPaste] = useState(false); const [nextMode, setNextMode] = useState<'none'|'stock'|'step'>('none');
  const [label, field, step] = tabs[tab]; const value = draft[field] ?? (stock as any)[field] ?? '';
  async function save(val=value, stepOverride:StepKey=step) { if (!String(val).trim() && !confirm('内容が空です。保存してもよろしいですか？')) return; const b = await api.saveStock(stock.stockId, { batchId: batch.batchId, field, value: val, step: stepOverride }); setBatch(b); notify('保存しました。'); }
  async function pasteSave(mode:'none'|'stock'|'step'='none') { if (!paste.trim() && !confirm('貼り戻し内容が空です。保存してもよろしいですか？')) return; const b = await api.saveStock(stock.stockId, { batchId: batch.batchId, field, value: paste, step }); setBatch(b); setDraft({...draft,[field]:paste}); setPaste(''); setShowPaste(false); notify(mode==='stock'?'保存しました。次の未完了銘柄へ進んでください。':mode==='step'?'保存しました。次工程へ進んでください。':'貼り戻し保存しました。'); if (mode !== 'none') await refresh(batch.batchId); }
  async function pasteClipboard(){ const text = await navigator.clipboard.readText(); setPaste(text); notify('クリップボードから貼り付けました。'); }
  return <article className="stock" id={`stock-${stock.stockId}`}><h3>{index+1}. {stock.name} <span>{stock.code}</span></h3><p>{stock.priceLine}</p><p>{stock.judgment}</p><div className="badges">{stepKeys.map(k=><span key={k} className={stock.statusByStep[k]}>{stepNames[k]}:{stock.statusByStep[k]}</span>)}</div><div className="tabs">{tabs.map((t,i)=><button className={i===tab?'selected':''} key={t[0]} onClick={()=>{setTab(i); setShowPaste(false);}}>{t[0]}</button>)}</div>{step !== 'step0' && <CopyControls batch={batch} stock={stock} step={step} setBatch={setBatch} refresh={refresh} copyText={copyText} notify={notify} onPaste={()=>setShowPaste(true)} />}
  <label>現在保存されている内容 / 編集</label><textarea value={value} onChange={e=>setDraft({...draft,[field]:e.target.value})}/><div className="actions"><button onClick={()=>copyText(value, `${label}をコピーしました`)}>成果物をコピー</button><button onClick={()=>save()}>編集内容を保存</button><button onClick={()=>{setDraft({...draft,[field]:''}); save('');}}>クリア</button><button onClick={()=>setShowPaste(!showPaste)}>出力貼り戻し欄を{showPaste?'閉じる':'開く'}</button></div>{showPaste && <div className="paste"><label>ChatGPT出力を貼り戻す</label><textarea className="big" value={paste} onChange={e=>setPaste(e.target.value)} placeholder="ChatGPTの出力をここへ貼り付け"/><details><summary>保存前プレビュー</summary><pre>{paste}</pre></details><div className="actions"><button onClick={pasteClipboard}>クリップボードから貼り付け</button><button onClick={()=>pasteSave('none')}>貼り戻し保存</button><button onClick={()=>pasteSave('stock')}>保存して次の銘柄へ</button><button onClick={()=>pasteSave('step')}>保存して次工程へ</button><button className="danger" onClick={()=>setPaste('')}>内容をクリア</button></div></div>}{stock.errorByStep[step] && <p className="error">{stock.errorByStep[step]}</p>}</article>;
}

function CopyControls({ batch, stock, step, setBatch, refresh, copyText, notify, onPaste, compact=false }: { batch:Batch; stock:StockItem; step:StepKey; setBatch:(b:Batch)=>void; refresh:(id?:string)=>Promise<void>; copyText:(t:string,l?:string)=>void; notify:(m:string)=>void; onPaste?:()=>void; compact?:boolean }) {
  const [copy, setCopy] = useState<CopyText>();
  async function load(){ const c = await api.buildCopyText({ step, stockId: stock.stockId }); setCopy(c); return c; }
  useEffect(()=>{ load().catch(()=>undefined); }, [stock.stockId, step]);
  async function openProject(){ const c = copy ?? await load(); if (!c.projectUrl) return notify(`工程${step.replace('step','')}：${stepNames[step]}\nプロジェクトURLが未設定です。設定画面で登録してください。`); window.open(c.projectUrl, '_blank', 'noopener,noreferrer'); }
  async function copyInput(){ const c = copy ?? await load(); if (c.warning) return notify(c.warning); await copyText(c.inputText, '入力文をコピーしました'); if (step !== 'step0') { const field = tabs.find((t)=>t[2]===step)?.[1]; if (field) { const b = await api.saveStock(stock.stockId, { batchId: batch.batchId, field, value: (stock as any)[field] ?? '', step, markCopied: true }); setBatch(b); await refresh(batch.batchId); } } }
  return <div className={compact?'actions compact':'actions'}><button onClick={openProject}>{stepNames[step]}プロジェクトを開く</button><button onClick={async()=>copyText((copy ?? await load()).initializationText, '初期化文をコピーしました')}>初期化文をコピー</button><button onClick={copyInput}>入力文をコピー</button>{onPaste && <button onClick={onPaste}>出力貼り戻し欄を開く</button>}{copy?.warning && <span className="warn">{copy.warning}</span>}</div>;
}

function SettingsView({ settings, setSettings, notify }: { settings:Settings; setSettings:(s:Settings)=>void; notify:(m:string)=>void }) {
  const [draft,setDraft]=useState(settings);
  async function save(){setSettings(await api.saveSettings(draft)); notify('設定を保存しました');}
  return <section className="card"><h2>設定</h2><p className="hint">残す設定は工程別プロジェクト名・URLのみです。古いブラウザ自動操作設定は保存ファイルに残っていても無視され、UIには表示しません。</p><label>共通デフォルトURL（任意）</label><input value={draft.defaultProjectUrl} onChange={e=>setDraft({...draft,defaultProjectUrl:e.target.value})}/>{stepKeys.map(k=><div key={k} className="settings-row"><label>{k}：プロジェクト名</label><input value={draft.projectNamesByStep[k]} onChange={e=>setDraft({...draft,projectNamesByStep:{...draft.projectNamesByStep,[k]:e.target.value}})}/><label>{draft.projectNamesByStep[k]} URL</label><input value={draft.projectUrlsByStep[k]} onChange={e=>setDraft({...draft,projectUrlsByStep:{...draft.projectUrlsByStep,[k]:e.target.value}})} placeholder="https://chatgpt.com/g/..."/></div>)}<p className="hint">保存場所：data/batches.json / data/settings.json / data/promptTemplates.json</p><button onClick={save}>設定を保存</button><ExportImport notify={notify}/></section>;
}
function TemplatesView({ templates, setTemplates, notify }: { templates:Templates; setTemplates:(t:Templates)=>void; notify:(m:string)=>void }) { const [draft,setDraft]=useState(templates); async function save(){setTemplates(await api.saveTemplates(draft)); notify('プロンプトを保存しました。');} async function reset(){ const fresh = await api.templates(); setDraft(fresh); notify('保存済みテンプレートを読み直しました。'); } return <section className="card"><h2>プロンプトテンプレート編集</h2><p className="hint">工程0〜6の初期化文に入る長文プロンプトを編集できます。保存先：data/promptTemplates.json と prompts/*.txt</p>{Object.keys(draft).map(k=><div key={k}><label>{k}</label><textarea className="prompt" value={(draft as any)[k]} onChange={e=>setDraft({...draft,[k]:e.target.value})}/></div>)}<div className="actions"><button onClick={save}>プロンプトを保存</button><button onClick={reset}>初期値/保存済みに戻す</button></div><ExportImport notify={notify}/></section> }
function ExportImport({ notify }:{ notify:(m:string)=>void }){ const [text,setText]=useState(''); async function exp(kind:string){setText(JSON.stringify(await api.export(kind),null,2)); notify('エクスポートJSONを作成しました。');} async function imp(){await api.import(JSON.parse(text)); notify('インポートしました。画面を更新してください。');} return <div><h3>エクスポート/インポート</h3><div className="grid"><button onClick={()=>exp('all')}>全体JSONエクスポート</button><button onClick={()=>exp('batches')}>バッチJSON</button><button onClick={()=>exp('settings')}>設定JSON</button><button onClick={()=>exp('templates')}>プロンプトJSON</button></div><textarea value={text} onChange={e=>setText(e.target.value)} placeholder="インポートするJSON、またはエクスポート結果"/><button onClick={imp}>JSONインポート</button></div>}
function Logs({ batch }: { batch:Batch }) { return <section className="card" id="logs"><h2>ログ</h2>{batch.logs.map((l,i)=><p key={i} className={l.level}>[{new Date(l.time).toLocaleString()}] {l.message}</p>)}</section> }
createRoot(document.getElementById('root')!).render(<App />);
