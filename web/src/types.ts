export type StepKey = 'step0'|'step1'|'step2'|'step3'|'step4'|'step5'|'step6';
export type LogItem = { time: string; level: 'info'|'warn'|'error'; message: string };
export type Step0Status = 'pending'|'done'|'manual'|'error';
export type StepStatus = 'pending'|'copied'|'done'|'error';
export type StockItem = { stockId:string; name:string; code:string; priceLine:string; judgment:string; rawJudgmentText:string; xArticle:string; overseasXPost:string; noteArticle:string; japaneseXPostMain:string; noteImagePrompt:string; xImagePrompt:string; statusByStep:{ step0:Step0Status; step1:StepStatus; step2:StepStatus; step3:StepStatus; step4:StepStatus; step5:StepStatus; step6:StepStatus }; errorByStep:Partial<Record<StepKey,string>>; updatedAt:string };
export type Batch = { batchId:string; createdAt:string; command:string; status:'draft'|'partial'|'done'|'error'; stocks:StockItem[]; logs:LogItem[] };
export type Settings = {
  defaultProjectUrl:string;
  projectUrlsByStep:Record<StepKey,string>;
  projectNamesByStep:Record<StepKey,string>;
  chatUrlsByStep:Record<StepKey,string>;
  chatNamesByStep:Record<StepKey,string>;
  step0ChatUrl:string; step1ChatUrl:string; step2ChatUrl:string; step3ChatUrl:string; step4ChatUrl:string; step5ChatUrl:string; step6ChatUrl:string;
  appendOutputRulesToInput:boolean;
  favoriteCommands:string[];
};
export type Templates = Record<'step0_buyJudgmentPrompt'|'step1_xArticlePrompt'|'step2_overseasXPostPrompt'|'step3_noteArticlePrompt'|'step4_japaneseXPostPrompt'|'step5_noteImagePrompt'|'step6_xImagePrompt', string>;
export type CopyText = { initializationText:string; inputText:string; projectUrl:string; projectName:string; warning?:string };
