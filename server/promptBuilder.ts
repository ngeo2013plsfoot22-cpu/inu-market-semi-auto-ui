import type { PromptTemplates, StepKey } from './types.js';
import { templateKeyByStep } from './types.js';

export function buildInitializationMessage(step: StepKey, templates: PromptTemplates) {
  const stepPrompt = templates[templateKeyByStep[step]] ?? '';
  return `このチャットでは以下のプロンプトに従い、作業を実行してください。\n以後、私が入力コードまたは本文を送信したら、このプロンプトのルールに従って出力してください。\nプロンプト内容の確認だけを行い、まだ本作業は開始しないでください。\n\n${stepPrompt}`;
}

export function buildInputText(step: StepKey, command: string | undefined, stock?: { rawJudgmentText: string; noteArticle: string }) {
  if (step === 'step0') return command?.trim() ?? '';
  if (!stock) return '';
  if (step === 'step1' || step === 'step2' || step === 'step3') return stock.rawJudgmentText.trim();
  return stock.noteArticle.trim();
}
