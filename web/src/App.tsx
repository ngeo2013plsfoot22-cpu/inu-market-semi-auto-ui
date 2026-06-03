import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from './api';
import type { Batch, CopyText, Settings, StockItem, StepKey, Templates } from './types';
import './styles.css';

const stepKeys: StepKey[] = ['step0','step1','step2','step3','step4','step5','step6'];
const stepNames: Record<StepKey,string> = { step0:'買い目判定', step1:'X記事作成', step2:'英語Xポスト作成', step3:'note記事作成', step4:'日本語Xポスト作成', step5:'note画像指示書', step6:'X画像指示書' };
const chatLabels: Record<StepKey,string> = { step0:'買い目判定チャット', step1:'X記事作成チャット', step2:'英語Xポスト作成チャット', step3:'note記事作成チャット', step4:'日本語Xポスト作成チャット', step5:'note画像指示書チャット', step6:'X画像指示書チャット' };
const fieldByStep: Record<StepKey, keyof StockItem> = { step0:'rawJudgmentText', step1:'xArticle', step2:'overseasXPost', step3:'noteArticle', step4:'japaneseXPostMain', step5:'noteImagePrompt', step6:'xImagePrompt' };
const inputSourceByStep: Record<StepKey,string> = { step0:'実行コード', step1:'rawJudgmentText', step2:'rawJudgmentText', step3:'rawJudgmentText', step4:'noteArticle', step5:'noteArticle', step6:'noteArticle' };
const templateLabels: Record<keyof Templates,string> = {
  step0_buyJudgmentPrompt:'工程0：買い目判定プロンプト', step1_xArticlePrompt:'工程1：X記事作成プロンプト', step2_overseasXPostPrompt:'工程2：X英語ポスト作成プロンプト', step3_noteArticlePrompt:'工程3：note記事作成プロンプト',
  step4_japaneseXPostPrompt:'工程4：X日本語ポスト作成プロンプト', step5_noteImagePrompt:'工程5：note画像指示書プロンプト', step6_xImagePrompt:'工程6：X画像指示書プロンプト'
};
const basicCommands = ['ランダム　実行','ランダムヨシ　実行','ランダム高配当　実行','ランダム期待先行　実行','ランダムテーマ株　実行','ランダムモメンタム　実行','ランダム待て　実行'];
const sectorCommands = ['ランダム半導体　実行','ランダムAI　実行','ランダムAI・データセンター　実行','ランダム量子コンピュータ　実行','ランダム防衛　実行','ランダム電力・インフラ　実行','ランダム商社　実行','ランダム金融　実行','ランダム銀行　実行','ランダム保険　実行','ランダム通信　実行','ランダム内需　実行','ランダム輸出　実行','ランダムグロース　実行','ランダム小型株　実行','ランダム小型テーマ株　実行','ランダム資源・素材　実行','ランダム医薬・ヘルスケア　実行','ランダム食品・小売　実行','ランダム不動産　実行','ランダム不動産株　実行','ランダム建設　実行','ランダム機械　実行','ランダム化学　実行','ランダム鉄鋼　実行','ランダム非鉄　実行','ランダム電機　実行','ランダム精密　実行','ランダム自動車　実行','ランダムインバウンド　実行','ランダム物流　実行','ランダムDX　実行','ランダムサイバーセキュリティ　実行','ランダム医療ロボット　実行','ランダムバイオ　実行','ランダム宇宙　実行','ランダム暗号資産関連　実行','ランダムデータセンター　実行','ランダム電線　実行','ランダム高配当銀行　実行','ランダム高配当商社　実行','ランダム高配当通信　実行'];
const waitCommands = ['ランダム待て半導体　実行','ランダム待てAI　実行','ランダム待てAI・データセンター　実行','ランダム待て量子コンピュータ　実行','ランダム待て防衛　実行','ランダム待て電力・インフラ　実行','ランダム待て金融　実行','ランダム待てグロース　実行','ランダム待て小型テーマ株　実行','ランダム待て不動産　実行'];

function extractCodeBlock(text: string) {
  const matches = [...text.matchAll(/```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g)].map((m) => m[1].trim()).filter(Boolean);
  return matches.length ? matches.join('\n\n') : text.trim();
}

function App() {
  const [health, setHealth] = useState<any>();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selected, setSelected] = useState<Batch>();
  const [settings, setSettings] = useState<Settings>();
  const [templates, setTemplates] = useState<Templates>();
  const [manualText, setManualText] = useState('');
  const [customCommand, setCustomCommand] = useState('');
  const [toast, setToast] = useState('');
  const [view, setView] = useState<'home'|'settings'|'templates'|'logs'>('home');
  async function refresh(id = selected?.batchId) { const [h, bs] = await Promise.all([api.health(), api.batches()]); setHealth(h); setBatches(bs); if (id) setSelected(await api.batch(id)); else setSelected(bs[0]); }
  useEffect(() => { refresh().catch((e) => notify(e.message)); api.settings().then(setSettings).catch((e)=>notify(e.message)); api.templates().then(setTemplates).catch((e)=>notify(e.message)); }, []);
  function notify(msg:string) { setToast(msg); window.setTimeout(()=>setToast(''), 3000); }
  async function copyText(text:string, label='コピーしました') { if (!text.trim()) return notify('入力文が空のためコピーできません。'); await navigator.clipboard.writeText(text); notify(label); }
  async function copyCommand(command: string) { await copyText(command, `「${command}」をコピーしました。\n買い目判定チャットへ貼り付けてください。`); }
  function openStepChat(step: StepKey) { const url = settings?.chatUrlsByStep?.[step] || settings?.projectUrlsByStep?.[step] || ''; if (!url) return notify('この工程のチャットURLが未設定です。\n設定画面で、プロンプトを設置済みのChatGPTチャットURLを登録してください。'); window.open(url, '_blank', 'noopener,noreferrer'); }
  async function importManual(batchId?: string) { try { const b = await api.manualImport(extractCodeBlock(manualText), '手動取り込み', batchId); setSelected(b); setManualText(''); await refresh(b.batchId); notify(batchId ? '既存バッチに追加しました。' : '3行判定を取り込みました。'); } catch(e:any) { notify(e.message); } }
  async function saveSettingsPatch(patch: Partial<Settings>) { if (!settings) return; const saved = await api.saveSettings({ ...settings, ...patch }); setSettings(saved); return saved; }
  return <div className="app">
    <header><h1>イヌ式市場|手動コピペ支援UI</h1><p className="subtitle">静的Webアプリ・工程チャット固定運用版</p><div className="status"><span>Mode: {health?.mode ?? '静的Webアプリ'}</span><span>保存先: このブラウザ内</span></div><nav><button onClick={()=>setView('home')}>ホーム</button><button onClick={()=>setView('settings')}>設定</button><button onClick={()=>setView('templates')}>プロンプト管理</button><button onClick={()=>setView('logs')}>ログ</button></nav></header>
    {toast && <div className="alert" onClick={()=>setToast('')}>{toast}</div>}
    {view==='settings' && settings && <SettingsView settings={settings} setSettings={setSettings} notify={notify} copyText={copyText} refresh={refresh} />}
    {view==='templates' && templates && <TemplatesView templates={templates} setTemplates={setTemplates} notify={notify} copyText={copyText} refresh={refresh} />}
    {view==='logs' && selected && <Logs batch={selected} />}
    {view==='home' && <main>
      <section className="card hero"><h2>工程0：買い目判定</h2><p className="hint">プロンプト設置済みの買い目判定チャットを開き、実行コードを貼ってください。返ってきた3行判定を下の欄に貼り戻すと、作業バッチを作成できます。</p><div className="actions"><button onClick={()=>openStepChat('step0')}>買い目判定チャットを開く</button></div><CommandSection title="基本" commands={basicCommands} onCopy={copyCommand}/><CommandSection title="セクター・テーマ" commands={sectorCommands} onCopy={copyCommand}/><CommandSection title="待て系" commands={waitCommands} onCopy={copyCommand}/>{settings && <FavoritesSection settings={settings} saveSettingsPatch={saveSettingsPatch} copyCommand={copyCommand} notify={notify} />}<section className="mini"><h3>カスタム</h3><label>カスタム実行コード</label><input value={customCommand} onChange={(e)=>setCustomCommand(e.target.value)} placeholder="ランダム水処理　実行 / ソフトバンク 実行"/><div className="actions"><button onClick={()=>copyCommand(customCommand)}>カスタム実行コードをコピー</button><button onClick={async()=>{ const command = customCommand.trim(); if (!command || !settings) return notify('追加する実行コードが空です。'); await saveSettingsPatch({ favoriteCommands: Array.from(new Set([...settings.favoriteCommands, command])) }); notify('よく使うコードに追加しました。'); }}>よく使うコードに追加</button></div>{customCommand.trim()==='ランダム実行' && <p className="warn">「ランダム実行」は旧形式です。「ランダム　実行」を使用してください。</p>}</section></section>
      <section className="card"><h2>3行判定結果貼り戻し</h2><textarea className="big" value={manualText} onChange={(e)=>setManualText(e.target.value)} placeholder={'ChatGPTから返った3行判定、またはコードブロックを貼り付けます。\n\nソフトバンク 9434\n216.5 (低値圏)/-1.1/-0.51%\nヨシ(盤石)╰( Ｕ ・ω・)'} /><div className="actions"><button onClick={()=>setManualText(extractCodeBlock(manualText))}>コードブロックだけ抽出</button><button onClick={()=>importManual()}>解析して新規バッチ作成</button><button disabled={!selected} onClick={()=>selected && importManual(selected.batchId)}>既存バッチに追加</button></div></section>
      <BatchList batches={batches} selected={selected} setSelected={setSelected} />
      {selected && <BatchDetail batch={selected} setBatch={setSelected} refresh={refresh} copyText={copyText} notify={notify} openStepChat={openStepChat} />}
    </main>}
  </div>;
}

function CommandSection({ title, commands, onCopy }:{ title:string; commands:string[]; onCopy:(c:string)=>void }) { return <section className="mini"><h3>{title}</h3><div className="grid command-grid">{commands.map((c)=><button key={c} onClick={()=>onCopy(c)}>{c}</button>)}</div></section>; }

function FavoritesSection({ settings, saveSettingsPatch, copyCommand, notify }:{ settings:Settings; saveSettingsPatch:(p:Partial<Settings>)=>Promise<Settings|undefined>; copyCommand:(c:string)=>void; notify:(m:string)=>void }) {
  const [renaming, setRenaming] = useState('');
  async function update(list:string[]) { await saveSettingsPatch({ favoriteCommands: list }); }
  function move(i:number, dir:-1|1) { const next = [...settings.favoriteCommands]; const j = i + dir; if (j < 0 || j >= next.length) return; [next[i], next[j]] = [next[j], next[i]]; update(next); }
  return <section className="mini"><h3>お気に入り</h3>{settings.favoriteCommands.length===0 && <p className="hint">よく使う実行コードはまだありません。</p>}<div className="favorite-list">{settings.favoriteCommands.map((c,i)=><div className="favorite-row" key={`${c}-${i}`}>{renaming===c ? <input defaultValue={c} autoFocus onBlur={(e)=>{ const v=e.target.value.trim(); update(settings.favoriteCommands.map((x,idx)=>idx===i && v ? v : x)); setRenaming(''); }} onKeyDown={(e)=>{ if(e.key==='Enter') (e.currentTarget as HTMLInputElement).blur(); }} /> : <button onClick={()=>copyCommand(c)}>{c}</button>}<button onClick={()=>move(i,-1)}>↑</button><button onClick={()=>move(i,1)}>↓</button><button onClick={()=>setRenaming(c)}>名前変更</button><button className="danger" onClick={()=>update(settings.favoriteCommands.filter((_,idx)=>idx!==i))}>削除</button></div>)}</div></section>;
}

function BatchList({ batches, selected, setSelected }:{ batches:Batch[]; selected?:Batch; setSelected:(b:Batch)=>void }) { return <section className="card"><h2>バッチ一覧</h2>{batches.length===0 && <p className="hint">まだバッチがありません。</p>}{batches.map((b)=><button key={b.batchId} className={b.batchId===selected?.batchId?'selected':''} onClick={()=>setSelected(b)}>{new Date(b.createdAt).toLocaleString()} / {b.command} / {b.stocks.length}銘柄</button>)}</section>; }

function BatchDetail({ batch, setBatch, refresh, copyText, notify, openStepChat }:{ batch:Batch; setBatch:(b:Batch)=>void; refresh:(id?:string)=>Promise<void>; copyText:(t:string,l?:string)=>void; notify:(m:string)=>void; openStepChat:(s:StepKey)=>void }) {
  const [bulkStep, setBulkStep] = useState<StepKey>('step1');
  const pending = useMemo(()=>batch.stocks.filter((s)=>s.statusByStep[bulkStep] !== 'done'), [batch, bulkStep]);
  return <section className="card"><h2>バッチ詳細</h2><div className="progress"><span>作成: {new Date(batch.createdAt).toLocaleString()}</span><span>コマンド: {batch.command}</span><span>{batch.stocks.length}銘柄</span><span>Status: {batch.status}</span></div><h3>投稿準備ダッシュボード</h3><p className="hint">工程別の完了状況を確認し、未完了の銘柄を投稿キューとしてまとめて処理できます。</p><h3>投稿キュー・一括コピー支援</h3><div className="actions"><select value={bulkStep} onChange={(e)=>setBulkStep(e.target.value as StepKey)}>{stepKeys.filter((s)=>s!=='step0').map((s)=><option value={s} key={s}>工程{s.replace('step','')}：{stepNames[s]}（入力: {inputSourceByStep[s]}）</option>)}</select><button onClick={()=>openStepChat(bulkStep)}>工程チャットを開く</button></div>{pending.length ? <div className="bulk-list">{pending.slice(0, 5).map((stock)=><div className="bulk" key={stock.stockId}><strong>{stock.name} {stock.code}</strong><CopyControls batch={batch} stock={stock} step={bulkStep} setBatch={setBatch} refresh={refresh} copyText={copyText} notify={notify} openStepChat={openStepChat} compact /></div>)}</div> : <p className="hint">この工程は全件完了しています。</p>}<h3>銘柄カード</h3>{batch.stocks.map((stock)=><div key={stock.stockId}><StockCard batch={batch} stock={stock} setBatch={setBatch} refresh={refresh} copyText={copyText} notify={notify} openStepChat={openStepChat}/></div>)}</section>;
}

function StockCard({ batch, stock, setBatch, refresh, copyText, notify, openStepChat }:{ batch:Batch; stock:StockItem; setBatch:(b:Batch)=>void; refresh:(id?:string)=>Promise<void>; copyText:(t:string,l?:string)=>void; notify:(m:string)=>void; openStepChat:(s:StepKey)=>void }) {
  const [step, setStep] = useState<StepKey>('step1');
  const [draft, setDraft] = useState(String(stock[fieldByStep[step]] ?? ''));
  const [paste, setPaste] = useState('');
  const field = fieldByStep[step];
  useEffect(()=>{ setDraft(String(stock[fieldByStep[step]] ?? '')); setPaste(''); }, [stock.stockId, step]);
  async function save(value = draft, move?: 'stock'|'step') { const b = await api.saveStock(stock.stockId, { batchId: batch.batchId, field, value, step }); setBatch(b); await refresh(batch.batchId); notify(move === 'stock' ? '保存しました。次の銘柄へ進んでください。' : move === 'step' ? '保存しました。次工程へ進んでください。' : '貼り戻し保存しました。'); if (move === 'step') { const i=stepKeys.indexOf(step); if (i < stepKeys.length - 1) setStep(stepKeys[i+1]); } }
  return <article className="stock"><h3>{stock.name} {stock.code}</h3><p className="hint">{stock.rawJudgmentText}</p><div className="badges">{stepKeys.map((s)=><span key={s} className={stock.statusByStep[s]}>{s.replace('step','')}: {stock.statusByStep[s]}</span>)}</div><div className="tabs">{stepKeys.map((s)=><button key={s} className={s===step?'selected':''} onClick={()=>setStep(s)}>工程{s.replace('step','')} {stepNames[s]}</button>)}</div><CopyControls batch={batch} stock={stock} step={step} setBatch={setBatch} refresh={refresh} copyText={copyText} notify={notify} openStepChat={openStepChat} onPaste={()=>setPaste(draft)} /><label>保存済み/編集内容</label><textarea value={draft} onChange={(e)=>setDraft(e.target.value)} /><div className="actions"><button onClick={()=>copyText(draft, '保存済み内容をコピーしました')}>保存済み内容をコピー</button><button onClick={()=>save()}>編集内容を保存</button><button className="danger" onClick={()=>{setDraft(''); save('');}}>クリア</button></div>{paste!=='' && <div className="paste"><h4>出力貼り戻し</h4><textarea value={paste} onChange={(e)=>setPaste(e.target.value)} placeholder="ChatGPT出力を貼り戻してください。"/><details><summary>コードブロックだけ抽出</summary><pre>{extractCodeBlock(paste)}</pre></details><div className="actions"><button onClick={async()=>setPaste(await navigator.clipboard.readText())}>クリップボードから貼り付け</button><button onClick={()=>setPaste(extractCodeBlock(paste))}>コードブロックだけ抽出</button><button onClick={()=>save(paste)}>貼り戻し保存</button><button onClick={()=>save(paste, 'stock')}>保存して次の銘柄へ</button><button onClick={()=>save(paste, 'step')}>保存して次工程へ</button><button className="danger" onClick={()=>setPaste('')}>内容をクリア</button></div></div>}{stock.errorByStep[step] && <p className="error">{stock.errorByStep[step]}</p>}</article>;
}

function CopyControls({ batch, stock, step, setBatch, refresh, copyText, notify, openStepChat, onPaste, compact=false }:{ batch:Batch; stock:StockItem; step:StepKey; setBatch:(b:Batch)=>void; refresh:(id?:string)=>Promise<void>; copyText:(t:string,l?:string)=>void; notify:(m:string)=>void; openStepChat:(s:StepKey)=>void; onPaste?:()=>void; compact?:boolean }) {
  const [copy, setCopy] = useState<CopyText>();
  async function load(){ const c = await api.buildCopyText({ step, stockId: stock.stockId }); setCopy(c); return c; }
  useEffect(()=>{ load().catch(()=>undefined); }, [stock.stockId, step]);
  async function copyInput(){ const c = copy ?? await load(); if (c.warning) return notify(c.warning); await copyText(c.inputText, `${inputSourceByStep[step]}をコピーしました`); if (step !== 'step0') { const b = await api.saveStock(stock.stockId, { batchId: batch.batchId, field: fieldByStep[step], value: String(stock[fieldByStep[step]] ?? ''), step, markCopied: true }); setBatch(b); await refresh(batch.batchId); } }
  return <div className={compact?'actions compact':'actions'}><button onClick={()=>openStepChat(step)}>工程チャットを開く</button><button onClick={copyInput}>入力文をコピー</button>{onPaste && <button onClick={onPaste}>出力貼り戻し欄を開く</button>}{copy?.warning && <span className="warn">{copy.warning}</span>}</div>;
}

function SettingsView({ settings, setSettings, notify, copyText, refresh }:{ settings:Settings; setSettings:(s:Settings)=>void; notify:(m:string)=>void; copyText:(t:string,l?:string)=>void; refresh:(id?:string)=>Promise<void> }) {
  const [draft,setDraft]=useState(settings);
  async function save(){ const normalized = { ...draft, projectUrlsByStep: draft.chatUrlsByStep, projectNamesByStep: draft.chatNamesByStep }; setSettings(await api.saveSettings(normalized)); notify('設定を保存しました'); }
  function setUrl(step:StepKey, value:string) { setDraft({ ...draft, chatUrlsByStep:{...draft.chatUrlsByStep,[step]:value}, projectUrlsByStep:{...draft.projectUrlsByStep,[step]:value}, [`${step}ChatUrl`]: value } as Settings); }
  return <section className="card"><h2>設定</h2><p className="hint">工程ごとの「固定チャットURL」を保存します。各チャットの冒頭には、プロンプト管理画面からコピーしたプロンプト全文をあらかじめ設置してください。</p><label><input type="checkbox" checked={draft.appendOutputRulesToInput} onChange={(e)=>setDraft({...draft, appendOutputRulesToInput:e.target.checked})}/> 入力文末尾にUI貼り戻し用出力ルールを付ける（デフォルトOFF）</label>{stepKeys.map((k)=><div key={k} className="settings-row"><label>工程{k.replace('step','')}：{chatLabels[k]}</label><input value={draft.chatNamesByStep[k]} onChange={(e)=>setDraft({...draft,chatNamesByStep:{...draft.chatNamesByStep,[k]:e.target.value},projectNamesByStep:{...draft.projectNamesByStep,[k]:e.target.value}})}/><label>{chatLabels[k]} URL</label><input value={draft.chatUrlsByStep[k]} onChange={(e)=>setUrl(k,e.target.value)} placeholder="https://chatgpt.com/c/..."/><button onClick={()=>copyText(`このプロンプトを${chatLabels[k]}の冒頭に貼ってください。`, '工程チャット作成用メモをコピーしました')}>新しい工程チャット作成用メモをコピー</button></div>)}<p className="hint">保存場所：この端末のブラウザ内ストレージです。別端末移行はJSONエクスポート/インポートを使います。PCとスマホは自動同期しません。</p><button onClick={save}>設定を保存</button><ExportImport notify={notify} refresh={refresh}/></section>;
}

function TemplatesView({ templates, setTemplates, notify, copyText, refresh }:{ templates:Templates; setTemplates:(t:Templates)=>void; notify:(m:string)=>void; copyText:(t:string,l?:string)=>void; refresh:(id?:string)=>Promise<void> }) {
  const [draft,setDraft]=useState(templates);
  async function save(){setTemplates(await api.saveTemplates(draft)); notify('プロンプトを保存しました。');}
  async function reset(){ const fresh = await api.templates(); setDraft(fresh); notify('保存済みテンプレートを読み直しました。'); }
  return <section className="card"><h2>プロンプト管理</h2><p className="hint">このプロンプトを工程チャット冒頭に貼ってください。通常作業ではプロンプト全文を毎回貼らず、工程チャットを開いて入力文だけをコピーします。</p>{(Object.keys(draft) as Array<keyof Templates>).map((k)=><div key={k} className="settings-row"><label>{templateLabels[k]}</label><textarea className="prompt" value={draft[k]} onChange={(e)=>setDraft({...draft,[k]:e.target.value})}/><div className="actions"><button onClick={()=>copyText(draft[k], `${templateLabels[k]}をコピーしました`)}>このプロンプトをコピー</button><button onClick={()=>copyText(`このチャットでは以下のプロンプトに従い、以後ユーザーが入力コードまたは本文を送信したら、このプロンプトのルールに従って出力してください。\n\n${draft[k]}`, '初期化文をコピーしました')}>初期化文をコピー</button><button onClick={()=>copyText(`${draft[k]}\n\nUI貼り戻し用出力ルール：完成した出力だけを返し、余計な説明を追加しないでください。`, '出力ルール付きプロンプトをコピーしました')}>UI貼り戻し用出力ルール付きでコピー</button></div></div>)}<div className="actions"><button onClick={save}>プロンプトを保存</button><button onClick={reset}>初期値/保存済みに戻す</button></div><ExportImport notify={notify} refresh={refresh}/></section>;
}

function ExportImport({ notify, refresh }:{ notify:(m:string)=>void; refresh:(id?:string)=>Promise<void> }){ const [text,setText]=useState(''); const [mode,setMode]=useState<'append'|'overwrite'>('append'); const [batchConflictMode,setBatchConflictMode]=useState<'overwrite'|'skip'|'duplicate'>('overwrite'); async function exp(kind:string){setText(JSON.stringify(await api.export(kind),null,2)); notify('エクスポートJSONを作成しました。');} async function imp(){await api.import({ ...JSON.parse(text), importMode: mode, batchConflictMode }); await refresh(); notify('インポートしました。別端末で同じバッチを同時編集しないでください。');} return <div><h3>JSONエクスポート/インポート</h3><p className="hint">全体JSONには batches / stocks / settings / promptTemplates(templates) / favoriteCommands / project/chat URLs / postStatus が含まれます。別端末へ移す場合は、書き出したJSONを移行先で読み込んでください。</p><div className="grid"><button onClick={()=>exp('all')}>全体JSONエクスポート</button><button onClick={()=>exp('batches')}>バッチJSON</button><button onClick={()=>exp('settings')}>設定JSON</button><button onClick={()=>exp('templates')}>プロンプトJSON</button></div><label>インポート方式</label><select value={mode} onChange={(e)=>setMode(e.target.value as 'append'|'overwrite')}><option value="append">既存データに追加</option><option value="overwrite">既存データを上書き</option></select><label>同じbatchIdがある場合</label><select value={batchConflictMode} disabled={mode==='overwrite'} onChange={(e)=>setBatchConflictMode(e.target.value as 'overwrite'|'skip'|'duplicate')}><option value="overwrite">インポートJSON側で上書き</option><option value="skip">既存データを残してスキップ</option><option value="duplicate">別batchIdとして複製</option></select><textarea value={text} onChange={(e)=>setText(e.target.value)} placeholder="インポートするJSON、またはエクスポート結果"/><button onClick={imp}>JSONインポート</button></div>}
function Logs({ batch }:{ batch:Batch }) { return <section className="card" id="logs"><h2>ログ</h2>{batch.logs.map((l,i)=><p key={i} className={l.level}>[{new Date(l.time).toLocaleString()}] {l.message}</p>)}</section>; }
createRoot(document.getElementById('root')!).render(<App />);
