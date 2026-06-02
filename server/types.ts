export type StepKey = 'step0'|'step1'|'step2'|'step3'|'step4'|'step5'|'step6';
export type StepNumber = 0|1|2|3|4|5|6;
export type BatchStatus = 'draft'|'partial'|'done'|'error';
export type Step0Status = 'pending'|'done'|'error'|'manual';
export type StepWorkStatus = 'pending'|'copied'|'done'|'error';
export type LogItem = { time: string; level: 'info'|'warn'|'error'; message: string };
export type StatusByStep = { step0: Step0Status; step1: StepWorkStatus; step2: StepWorkStatus; step3: StepWorkStatus; step4: StepWorkStatus; step5: StepWorkStatus; step6: StepWorkStatus };
export type ErrorByStep = Partial<Record<StepKey, string>>;
export type StockItem = {
  stockId: string; name: string; code: string; priceLine: string; judgment: string; rawJudgmentText: string;
  xArticle: string; overseasXPost: string; noteArticle: string; japaneseXPostMain: string; noteImagePrompt: string; xImagePrompt: string;
  statusByStep: StatusByStep; errorByStep: ErrorByStep; updatedAt: string;
};
export type Batch = { batchId: string; createdAt: string; command: string; status: BatchStatus; stocks: StockItem[]; logs: LogItem[] };
export type Settings = {
  defaultProjectUrl: string;
  projectUrlsByStep: Record<StepKey, string>;
  projectNamesByStep: Record<StepKey, string>;
};
export type PromptTemplates = {
  step0_buyJudgmentPrompt: string; step1_xArticlePrompt: string; step2_overseasXPostPrompt: string; step3_noteArticlePrompt: string;
  step4_japaneseXPostPrompt: string; step5_noteImagePrompt: string; step6_xImagePrompt: string;
};
export type ExportKind = 'batches'|'settings'|'templates'|'all';
export const stepKeys: StepKey[] = ['step0','step1','step2','step3','step4','step5','step6'];
export const stepLabels: Record<StepKey, string> = {
  step0: '工程0：買い目判定', step1: '工程1：X記事作成', step2: '工程2：海外向けXポスト作成', step3: '工程3：note記事作成',
  step4: '工程4：日本語Xポスト作成', step5: '工程5：note画像指示作成', step6: '工程6：X画像指示作成'
};
export const templateKeyByStep: Record<StepKey, keyof PromptTemplates> = {
  step0: 'step0_buyJudgmentPrompt', step1: 'step1_xArticlePrompt', step2: 'step2_overseasXPostPrompt', step3: 'step3_noteArticlePrompt',
  step4: 'step4_japaneseXPostPrompt', step5: 'step5_noteImagePrompt', step6: 'step6_xImagePrompt'
};
