import { promises as fs } from 'node:fs';
import path from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { Settings, StepKey } from './types.js';

type LogFn = (level: 'info'|'warn'|'error', message: string) => void;
let browser: Browser | undefined;
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
  const page = await openPage(settings, log);
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

async function openPage(settings: Settings, log: LogFn) {
  const browserMode = normalizeBrowserMode(settings.runner.browserMode);
  const userDataDir = playwrightChromeProfileDir;
  const nextContextKey = browserMode === 'chromePersistent' ? `${browserMode}:${userDataDir}` : browserMode;

  log('info', `Browser mode: ${browserMode}`);

  if (context && contextKey !== nextContextKey) {
    await closeManagedBrowserContext();
  }

  if (!context) {
    if (browserMode === 'connectExistingChrome') {
      log('info', 'Connecting to existing Chrome at http://127.0.0.1:9222');
      browser = await chromium.connectOverCDP('http://127.0.0.1:9222').catch((error) => {
        throw new Error(`既存Chromeへ接続できません。
先にすべてのChromeを終了し、以下のコマンドでChromeを起動してください。

open -na "Google Chrome" --args --remote-debugging-port=9222

そのChromeでChatGPTにログインした後、再度実行してください。

詳細: ${error instanceof Error ? error.message : String(error)}`);
      });
      context = browser.contexts()[0] ?? await browser.newContext();
    } else if (browserMode === 'chromePersistent') {
      log('info', `Launching Google Chrome with persistent Playwright profile: ${userDataDir}`);
      await fs.mkdir(userDataDir, { recursive: true });
      context = await chromium.launchPersistentContext(userDataDir, {
        channel: 'chrome',
        chromiumSandbox: true,
        headless: false,
        viewport: { width: 1280, height: 900 }
      });
    } else {
      log('info', 'Launching bundled Playwright Chromium');
      browser = await chromium.launch({
        chromiumSandbox: true,
        headless: settings.runner.headless
      });
      context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    }
    contextKey = nextContextKey;
  }
  return context.pages()[0] ?? await context.newPage();
}

async function closeManagedBrowserContext() {
  if (contextKey === 'connectExistingChrome') {
    // Do not close the user's manually launched Chrome; just drop Playwright's references.
  } else if (contextKey?.startsWith('chromePersistent')) {
    await context?.close().catch(() => undefined);
  } else {
    await browser?.close().catch(() => undefined);
  }
  browser = undefined;
  context = undefined;
  contextKey = undefined;
}

function normalizeBrowserMode(browserMode: Settings['runner']['browserMode'] | 'chrome' | undefined) {
  if (browserMode === 'chromePersistent' || browserMode === 'chromium') return browserMode;
  return 'connectExistingChrome';
}

async function ensureLoggedIn(page: Page) {
  const login = page.getByRole('button', { name: /log in|ログイン/i }).first();
  if (await login.isVisible().catch(() => false)) throw new Error('ChatGPTにログインしていません。Googleログインで拒否される場合は、READMEの手順でChromeを手動起動してChatGPTへログインし、設定画面で browserMode を connectExistingChrome にしてください。');
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
