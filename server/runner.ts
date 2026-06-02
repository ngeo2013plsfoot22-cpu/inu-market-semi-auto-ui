import { promises as fs } from 'node:fs';
import path from 'node:path';
import { chromium, type BrowserContext, type Page } from 'playwright';
import type { Settings, StepKey } from './types.js';

type LogFn = (level: 'info'|'warn'|'error', message: string) => void;
let context: BrowserContext | undefined;
let contextKey: string | undefined;

const playwrightChromeProfileDir = path.join(process.cwd(), 'data', 'playwright-chrome-profile');

export function resolveProjectUrl(settings: Settings, step: StepKey) {
  const url = settings.projectUrlsByStep[step] || settings.defaultProjectUrl;
  if (!url) {
    const name = settings.projectNamesByStep[step];
    throw new Error(`${stepLabel(step)}\n送信先プロジェクト「${name}」のURLが未設定です。\n設定画面でURLを登録してください。`);
  }
  return url;
}

export async function runTwoStepBatch(params: { step: StepKey; inputs: Array<{ label: string; text: string }>; initializationMessage: string; settings: Settings; log: LogFn; }) {
  const { step, inputs, initializationMessage, settings, log } = params;
  const projectUrl = resolveProjectUrl(settings, step);
  const page = await openPage(settings);
  page.setDefaultTimeout(settings.runner.timeoutMs);
  log('info', `${stepLabel(step)}プロジェクトURLを開きました`);
  await page.goto(projectUrl, { waitUntil: 'domcontentloaded', timeout: settings.runner.timeoutMs });
  await ensureLoggedIn(page);
  await startNewChat(page, log, step);
  log('info', `${stepLabel(step)}プロンプト初期化を送信しました`);
  await sendMessage(page, initializationMessage, settings.runner.timeoutMs);
  await waitForAssistant(page, settings.runner.timeoutMs);
  log('info', `${stepLabel(step)}初期化応答を確認しました`);
  const outputs: string[] = [];
  for (const input of inputs) {
    log('info', `${stepLabel(step)}入力送信：${input.label}`);
    await sendMessage(page, input.text, settings.runner.timeoutMs);
    await waitForAssistant(page, settings.runner.timeoutMs);
    const latest = await getLatestAssistantText(page);
    outputs.push(latest);
    log('info', `${stepLabel(step)}完了：${input.label}`);
  }
  return outputs;
}

async function openPage(settings: Settings) {
  const browserMode = settings.runner.browserMode ?? 'chrome';
  const userDataDir = playwrightChromeProfileDir;
  const nextContextKey = `${browserMode}:${userDataDir}`;

  if (context && contextKey !== nextContextKey) {
    await context.close().catch(() => undefined);
    context = undefined;
    contextKey = undefined;
  }

  if (!context) {
    await fs.mkdir(userDataDir, { recursive: true });
    context = await chromium.launchPersistentContext(userDataDir, {
      ...(browserMode === 'chrome' ? { channel: 'chrome' as const } : {}),
      chromiumSandbox: true,
      headless: false,
      viewport: { width: 1280, height: 900 }
    });
    contextKey = nextContextKey;
  }
  return context.pages()[0] ?? await context.newPage();
}

async function ensureLoggedIn(page: Page) {
  const login = page.getByRole('button', { name: /log in|ログイン/i }).first();
  if (await login.isVisible().catch(() => false)) throw new Error('ChatGPTにログインしていません。Playwright専用ChromeでChatGPTへ初回ログインしてください。ログイン状態は data/playwright-chrome-profile に保存されます。');
}

async function startNewChat(page: Page, log: LogFn, step: StepKey) {
  const candidates = [
    page.getByRole('link', { name: /new chat|新しいチャット/i }).first(),
    page.getByRole('button', { name: /new chat|新しいチャット/i }).first(),
    page.locator('a[href="/"]').first(),
    page.locator('[data-testid="create-new-chat-button"]').first()
  ];
  for (const locator of candidates) {
    if (await locator.isVisible().catch(() => false)) {
      await locator.click();
      await waitForComposer(page);
      log('info', `${stepLabel(step)}新規チャットを開始しました`);
      return;
    }
  }
  throw new Error(`${stepLabel(step)}新規チャット開始に失敗しました。ChatGPT画面の新規チャットボタンが見つかりません。`);
}

async function waitForComposer(page: Page) { await composer(page).waitFor({ state: 'visible' }); }
function composer(page: Page) { return page.locator('#prompt-textarea, textarea[placeholder], div[contenteditable="true"][role="textbox"]').first(); }
async function sendMessage(page: Page, text: string, timeoutMs: number) {
  const input = composer(page);
  await input.waitFor({ state: 'visible', timeout: timeoutMs });
  await input.fill(text).catch(async () => { await input.click(); await page.keyboard.insertText(text); });
  const send = page.locator('[data-testid="send-button"], button[aria-label*="Send"], button[aria-label*="送信"]').first();
  await send.waitFor({ state: 'visible', timeout: timeoutMs });
  await send.click();
}
async function waitForAssistant(page: Page, timeoutMs: number) {
  await page.waitForTimeout(1000);
  const stop = page.locator('[data-testid="stop-button"], button[aria-label*="Stop"], button[aria-label*="停止"]').first();
  await stop.waitFor({ state: 'hidden', timeout: timeoutMs }).catch(() => undefined);
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
}
async function getLatestAssistantText(page: Page) {
  const locators = [page.locator('[data-message-author-role="assistant"]').last(), page.locator('.markdown').last(), page.locator('article').last()];
  for (const loc of locators) {
    const text = await loc.innerText().catch(() => '');
    if (text.trim()) return text.trim();
  }
  throw new Error('ChatGPTの最新回答を取得できませんでした。セレクタが変更された可能性があります。');
}
function stepLabel(step: StepKey) { return `工程${step.replace('step','')}`; }
