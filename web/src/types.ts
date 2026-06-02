export type StepKey = 'step0'|'step1'|'step2'|'step3'|'step4'|'step5'|'step6';
export type LogItem = { time: string; level: 'info'|'warn'|'error'; message: string };
export type StockItem = { stockId:string; name:string; code:string; priceLine:string; judgment:string; rawJudgmentText:string; xArticle:string; overseasXPost:string; noteArticle:string; japaneseXPostMain:string; noteImagePrompt:string; xImagePrompt:string; statusByStep:Record<StepKey,string>; errorByStep:Partial<Record<StepKey,string>>; updatedAt:string };
export type Batch = { batchId:string; createdAt:string; command:string; status:string; stocks:StockItem[]; logs:LogItem[] };
export type BrowserMode = 'chromePersistent'|'connectExistingChrome';
export type Settings = { defaultProjectUrl:string; projectUrlsByStep:Record<StepKey,string>; projectNamesByStep:Record<StepKey,string>; runner:{ headless:boolean; timeoutMs:number; stopOnError:boolean; sendMode:'twoStep'; newChatPerStep:boolean; browserMode:BrowserMode } };
export type Templates = Record<'step0_buyJudgmentPrompt'|'step1_xArticlePrompt'|'step2_overseasXPostPrompt'|'step3_noteArticlePrompt'|'step4_japaneseXPostPrompt'|'step5_noteImagePrompt'|'step6_xImagePrompt', string>;
