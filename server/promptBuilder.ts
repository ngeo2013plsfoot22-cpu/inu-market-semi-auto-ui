import type { PromptTemplates, StepKey } from './types.js';

export const promptKeyByStep: Record<StepKey, keyof PromptTemplates> = {
  step0: 'step0_buyJudgmentPrompt', step1: 'step1_xArticlePrompt', step2: 'step2_overseasXPostPrompt', step3: 'step3_noteArticlePrompt',
  step4: 'step4_japaneseXPostPrompt', step5: 'step5_noteImagePrompt', step6: 'step6_xImagePrompt'
};

export function buildInitializationMessage(step: StepKey, templates: PromptTemplates) {
  return `このチャットでは以下のプロンプトに従い、作業を実行してください。\n以後、私が入力コードまたは本文を送信したら、このプロンプトのルールに従って出力してください。\nプロンプト内容の確認だけを行い、まだ本作業は開始しないでください。\n\n${templates[promptKeyByStep[step]]}`;
}
