import type { PromptTemplates, StepKey } from './types.js';
import { templateKeyByStep } from './types.js';

export const uiPasteBackRules = `

---
UI貼り戻し用出力ルール：
- 完成した本文または指示書だけを出力してください。
- 余計な前置き、説明、確認文、参考URLは追加しないでください。
- コードブロック指定のある工程ではコードブロック内だけに入れてください。`;

export function buildInitializationMessage(step: StepKey, templates: PromptTemplates) {
  const stepPrompt = templates[templateKeyByStep[step]] ?? '';
  return `このプロンプトを工程チャット冒頭に貼ってください。\nこのチャットでは以下のプロンプトに従い、以後ユーザーが入力コードまたは本文を送信したら、このプロンプトのルールに従って出力してください。\n\n${stepPrompt}`;
}

export function buildInputText(step: StepKey, command: string | undefined, stock?: { rawJudgmentText: string; noteArticle: string }, appendOutputRules = false) {
  let input = '';
  if (step === 'step0') input = command?.trim() ?? '';
  else if (stock && (step === 'step1' || step === 'step2' || step === 'step3')) input = stock.rawJudgmentText.trim();
  else if (stock) input = stock.noteArticle.trim();
  if (input && appendOutputRules && step !== 'step0') return `${input}${uiPasteBackRules}`;
  return input;
}
