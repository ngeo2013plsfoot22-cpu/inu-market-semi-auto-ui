import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from './api';
import type { Batch, Settings, StockItem, StepKey, Templates } from './types';
import './styles.css';

const stepKeys: StepKey[] = ['step0','step1','step2','step3','step4','step5','step6'];
const stepNames: Record<StepKey,string> = { step0:'買い目判定', step1:'X記事', step2:'海外X', step3:'note記事', step4:'日本語X', step5:'note画像指示', step6:'X画像指示' };
const fieldByTab = [
  ['判定','rawJudgmentText','step0'], ['X記事','xArticle','step1'], ['海外Xポスト','overseasXPost','step2'], ['note記事','noteArticle','step3'], ['日本語Xポスト','japaneseXPostMain','step4'], ['note画像指示','noteImagePrompt','step5'], ['X画像指示','xImagePrompt','step6']
] as const;
const fixedCommands = ['ランダム　実行','ランダムヨシ　実行','ランダム高配当　実行','ランダム期待先行　実行','ランダムテーマ株　実行','ランダムモメンタム　実行','ランダム待て　実行'];

function App() {
  const [health, setHealth] = useState<any>(); const [batches, setBatches] = useState<Batch[]>([]); const [selected, setSelected] = useState<Batch>(); const [settings, setSettings] = useState<Settings>(); const [templates, setTemplates] = useState<Templates>();
  const [manualText, setManualText] = useState(''); const [customCommand, setCustomCommand] = useState(''); const [message, setMessage] = useState(''); const [view, setView] = useState<'home'|'settings'|'templates'|'logs'>('home');
  async function refresh(id = selected?.batchId) { const [h, bs] = await Promise.all([api.health(), api.batches()]); setHealth(h); setBatches(bs); if (id) setSelected(await api.batch(id)); else setSelected(bs[0]); }
  useEffect(() => { refresh().catch(e => setMessage(e.message)); api.settings().then(setSettings); api.templates().then(setTemplates); }, []);
  const selectedId = selected?.batchId;
  async function runStep(step: number, stockId?: string, regenerate=false) { try { if (regenerate && !confirm('全件再生成します。よろしいですか？')) return; const b = await api.run({ step, batchId: selectedId, stockId, regenerate }); setSelected(b); await refresh(b.batchId); } catch(e:any) { setMessage(e.message); } }
  async function runCommand(command: string) { try { if (!command.trim()) return setMessage('実行コマンドが空欄です。'); if (command.trim()==='ランダム実行') return setMessage('「ランダム実行」は旧形式です。「ランダム　実行」を使ってください。'); if (!command.includes('実行')) return setMessage('実行コマンドに「実行」を含めてください。'); const b = await api.run({ step:0, command }); setSelected(b); await refresh(b.batchId); } catch(e:any) { setMessage(e.message); } }
  async function importManual() { try { const b = await api.manualImport(manualText); setSelected(b); setManualText(''); await refresh(b.batchId); } catch(e:any) { setMessage(e.message); } }
  return <div className="app">
    <header><h1>イヌ式市場|半自動化UI</h1><div className="status"><span>PCランナー: {health?.ok?'接続中':'確認中'}</span><span>スマホURL: http://{health?.localIp || '192.168.x.x'}:5173</span></div><nav><button onClick={()=>setView('home')}>ホーム</button><button onClick={()=>setView('settings')}>設定</button><button onClick={()=>setView('templates')}>プロンプト</button><button onClick={()=>setView('logs')}>ログ</button></nav></header>
    {message && <div className="alert" onClick={()=>setMessage('')}>{message}</div>}
    {view==='settings' && settings && <SettingsView settings={settings} setSettings={setSettings} />}
    {view==='templates' && templates && <TemplatesView templates={templates} setTemplates={setTemplates} />}
    {view==='logs' && selected && <Logs batch={selected} />}
    {view==='home' && <main>
      <section className="card"><h2>新規バッチ作成</h2><p>固定コマンド（「ランダム実行」は旧形式のため未搭載）</p><div className="grid">{fixedCommands.map(c=><button key={c} onClick={()=>runCommand(c)}>{c}</button>)}</div><label>カスタム実行コマンド</label><input value={customCommand} onChange={e=>setCustomCommand(e.target.value)} placeholder="ランダム半導体　実行 または メタプラネット 実行"/><button onClick={()=>runCommand(customCommand)}>カスタムコマンドで工程0実行</button></section>
      <section className="card"><h2>手動取り込み</h2><textarea className="big" value={manualText} onChange={e=>setManualText(e.target.value)} placeholder={'3行判定コードを貼り付け\n銘柄名 証券コード\n株価 (低値圏)/前日比/前日比率\nヨシ(盤石)╰( Ｕ ・ω・)'} /><button onClick={importManual}>解析してバッチ作成</button></section>
      <section className="card"><h2>バッチ一覧</h2>{batches.map(b=><button className={b.batchId===selectedId?'selected':''} key={b.batchId} onClick={()=>setSelected(b)}>{new Date(b.createdAt).toLocaleString()} / {b.command} / {b.stocks.length}銘柄</button>)}</section>
      {selected && <BatchDetail batch={selected} setBatch={setSelected} runStep={runStep}/>} </main>}
  </div>;
}

function BatchDetail({ batch, setBatch, runStep }: { batch:Batch; setBatch:(b:Batch)=>void; runStep:(s:number,id?:string,r?:boolean)=>void }) {
  const counts = useMemo(() => stepKeys.map(k => `${stepNames[k]} ${batch.stocks.filter(s=>s.statusByStep[k]==='done'||s.statusByStep[k]==='manual').length}/${batch.stocks.length}`).join(' / '), [batch]);
  return <section className="card"><h2>現在選択中のバッチ</h2><p>{new Date(batch.createdAt).toLocaleString()} / {batch.command}</p><p>進捗: {batch.status}</p><p>{counts}</p><button onClick={()=>document.querySelector('#logs')?.scrollIntoView()}>実行ログへ</button><h3>一括実行</h3><div className="grid">{[1,2,3,4,5,6].map(n=><React.Fragment key={n}><button onClick={()=>runStep(n)}>工程{n}：{stepNames[`step${n}` as StepKey]}を未生成分だけ生成</button><button className="danger" onClick={()=>runStep(n, undefined, true)}>工程{n}：全件再生成</button></React.Fragment>)}</div><h3>銘柄カード</h3>{batch.stocks.map(s=><StockCard key={s.stockId} batchId={batch.batchId} stock={s} setBatch={setBatch} runStep={runStep}/>)}</section>
}
function StockCard({ batchId, stock, setBatch, runStep }: { batchId:string; stock:StockItem; setBatch:(b:Batch)=>void; runStep:(s:number,id?:string,r?:boolean)=>void }) {
  const [tab, setTab] = useState(0); const [draft, setDraft] = useState<Record<string,string>>({}); const [copied, setCopied] = useState(''); const [label, field, step] = fieldByTab[tab]; const value = draft[field] ?? (stock as any)[field] ?? '';
  async function save(val=value) { const b = await api.saveStock(stock.stockId, { batchId, field, value: val }); setBatch(b); }
  async function copy() { await navigator.clipboard.writeText(value); setCopied('コピーしました'); setTimeout(()=>setCopied(''),1200); }
  return <article className="stock"><h3>{stock.name} <span>{stock.code}</span></h3><p>{stock.priceLine}</p><p>{stock.judgment}</p><div className="badges">{stepKeys.map(k=><span key={k} className={stock.statusByStep[k]}>{stepNames[k]}:{stock.statusByStep[k]}</span>)}</div><div className="tabs">{fieldByTab.map((t,i)=><button className={i===tab?'selected':''} key={t[0]} onClick={()=>setTab(i)}>{t[0]}</button>)}</div><textarea value={value} onChange={e=>setDraft({...draft,[field]:e.target.value})}/><div className="actions"><button onClick={copy}>コピー</button><button onClick={()=>save()}>保存</button>{step!=='step0' && <button onClick={()=>runStep(Number(step.replace('step','')), stock.stockId, true)}>再生成</button>}<button onClick={()=>{setDraft({...draft,[field]:''}); save('');}}>クリア</button>{copied && <span>{copied}</span>}</div>{stock.errorByStep[step] && <p className="error">{stock.errorByStep[step]}</p>}</article>
}
function SettingsView({ settings, setSettings }: { settings:Settings; setSettings:(s:Settings)=>void }) { const [draft,setDraft]=useState(settings); async function save(){setSettings(await api.saveSettings(draft)); alert('設定を保存しました');} return <section className="card"><h2>設定</h2><label>defaultProjectUrl</label><input value={draft.defaultProjectUrl} onChange={e=>setDraft({...draft,defaultProjectUrl:e.target.value})}/>{stepKeys.map(k=><div key={k}><label>{k}：{draft.projectNamesByStep[k]}</label><input value={draft.projectUrlsByStep[k]} onChange={e=>setDraft({...draft,projectUrlsByStep:{...draft.projectUrlsByStep,[k]:e.target.value}})}/></div>)}<label>timeoutMs</label><input type="number" value={draft.runner.timeoutMs} onChange={e=>setDraft({...draft,runner:{...draft.runner,timeoutMs:Number(e.target.value)}})}/><label><input type="checkbox" checked={draft.runner.headless} onChange={e=>setDraft({...draft,runner:{...draft.runner,headless:e.target.checked}})}/> headless</label><p>sendMode: twoStep / newChatPerStep: true</p><button onClick={save}>設定を保存</button><ExportImport /></section> }
function TemplatesView({ templates, setTemplates }: { templates:Templates; setTemplates:(t:Templates)=>void }) { const [draft,setDraft]=useState(templates); async function save(){setTemplates(await api.saveTemplates(draft)); alert('プロンプトを保存しました。次回実行から新規チャットで反映されます。');} return <section className="card"><h2>プロンプトテンプレート編集</h2>{Object.keys(draft).map(k=><div key={k}><label>{k}</label><textarea className="prompt" value={(draft as any)[k]} onChange={e=>setDraft({...draft,[k]:e.target.value})}/></div>)}<button onClick={save}>プロンプトを保存</button><ExportImport /></section> }
function ExportImport(){ const [text,setText]=useState(''); async function exp(kind:string){setText(JSON.stringify(await api.export(kind),null,2));} async function imp(){await api.import(JSON.parse(text)); alert('インポートしました');} return <div><h3>エクスポート/インポート</h3><div className="grid"><button onClick={()=>exp('all')}>全体JSONエクスポート</button><button onClick={()=>exp('batches')}>バッチJSON</button><button onClick={()=>exp('settings')}>設定JSON</button><button onClick={()=>exp('templates')}>プロンプトJSON</button></div><textarea value={text} onChange={e=>setText(e.target.value)} placeholder="インポートするJSON、またはエクスポート結果"/><button onClick={imp}>JSONインポート</button></div>}
function Logs({ batch }: { batch:Batch }) { return <section className="card" id="logs"><h2>実行ログ</h2>{batch.logs.map((l,i)=><p key={i} className={l.level}>[{new Date(l.time).toLocaleTimeString()}] {l.message}</p>)}</section> }
createRoot(document.getElementById('root')!).render(<App />);
