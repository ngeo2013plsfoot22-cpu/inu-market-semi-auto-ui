# イヌ式市場|半自動化UI

**ChatGPT手動コピペ支援版**です。イヌ式市場の投稿・note・画像指示書作成作業を、ChatGPTプロジェクトへの手動コピペ前提で整理するローカル管理アプリです。

## この版で行わないこと

- ChatGPT Webの自動操作は行いません。
- Playwrightは使いません。
- OpenAI APIは使いません。
- Xやnoteへ直接投稿しません。
- 画像生成は行いません。
- ChatGPTへの貼り付け、送信、出力コピーはユーザーが手動で行います。

UIは、プロンプト、ChatGPTに貼る入力文、ChatGPTから戻した成果物、銘柄ごとの進捗をローカルJSONで管理します。

## 起動方法

```bash
npm install
npm run dev -- --host 0.0.0.0
```

起動時に以下のような表示が出ます。

```text
イヌ式市場|半自動化UI is running.
Mode: manual copy-paste support

PC:
http://localhost:5173

Smartphone:
http://192.168.x.x:5173
```

スマホから操作する場合は、PCと同じWi-Fiに接続し、起動ログに出た `http://192.168.x.x:5173` へアクセスしてください。

> `npx playwright install` は不要です。

## 基本ワークフロー

1. UIで工程と銘柄を選ぶ。
2. UIが「ChatGPTに貼る文章」を生成する。
3. 「初期化文をコピー」または「入力文をコピー」を押す。
4. ユーザーが該当するChatGPTプロジェクトを手動で開く。
5. ユーザーがChatGPTへ貼り付けて送信する。
6. ChatGPTの出力をユーザーがコピーする。
7. UIの貼り戻し欄に貼る。
8. 「貼り戻し保存」または「保存して次へ」を押す。
9. UIが銘柄ごと・工程ごとに成果物と進捗を保存する。

## 工程0〜6

| 工程 | 対応プロジェクト | 入力 | 出力 | 保存先 |
|---|---|---|---|---|
| 工程0：買い目判定 | イヌ式市場\|買い目判定 | 実行コマンド | 買い目判定v3の3行コード | `rawJudgmentText` |
| 工程1：X記事作成 | イヌ式市場\|X記事作成 | `rawJudgmentText` | X記事本文 | `xArticle` |
| 工程2：海外向けXポスト作成 | イヌ式市場\|X英語ポスト作成 | `rawJudgmentText` | 海外投資家向け英語Xポスト | `overseasXPost` |
| 工程3：note記事作成 | イヌ式市場\|note記事作成 | `rawJudgmentText` | note記事本文 | `noteArticle` |
| 工程4：日本語Xポスト作成 | イヌ式市場\|X日本語ポスト作成 | `noteArticle` | 日本語X本ポスト | `japaneseXPostMain` |
| 工程5：note画像指示作成 | イヌ式市場\|note画像指示書 | `noteArticle` | noteヘッダー画像生成用英語指示書 | `noteImagePrompt` |
| 工程6：X画像指示作成 | イヌ式市場\|X画像指示書 | `noteArticle` | X用正方形画像生成用英語指示書 | `xImagePrompt` |

工程1〜3は `rawJudgmentText` があれば準備できます。工程4〜6は `noteArticle` がない場合、UIが「note記事がありません。先に工程3を作成・保存してください。」と警告します。

## 2段階コピー方式

### 第1段階：プロンプト初期化文コピー

各工程で「初期化文をコピー」を押すと、次の形式の文章を生成します。

```text
このチャットでは以下のプロンプトに従い、作業を実行してください。
以後、私が入力コードまたは本文を送信したら、このプロンプトのルールに従って出力してください。
プロンプト内容の確認だけを行い、まだ本作業は開始しないでください。

{{stepPrompt}}
```

ユーザーは対応するChatGPTプロジェクトを手動で開き、この初期化文を貼って送信します。

### 第2段階：入力文コピー

ChatGPT側でプロンプト確認返答を受けた後、UIで「入力文をコピー」を押します。

- 工程0: 実行コマンド
- 工程1〜3: `rawJudgmentText`
- 工程4〜6: `noteArticle`

ChatGPTへの送信は必ずユーザーが手動で行います。

## 工程0：コマンド作成と手動取り込み

### 固定コマンド

トップ画面から以下を選べます。

- ランダム　実行
- ランダムヨシ　実行
- ランダム高配当　実行
- ランダム期待先行　実行
- ランダムテーマ株　実行
- ランダムモメンタム　実行
- ランダム待て　実行

`ランダム実行` は旧形式のため警告されます。

### 手動3行判定取り込み

ChatGPTから得た3行判定コードをトップ画面の大きなテキストエリアへ貼り付け、「解析して新規バッチ作成」を押します。既存バッチ選択中は「既存バッチに追加」も使えます。

例：

```text
ソフトバンク 9434
216.5 (低値圏)/-1.1/-0.51%
ヨシ(盤石)╰( Ｕ ・ω・)

メタプラネット 3350
298 (低値圏)/-4/-1.32%
待て(絶望)╰( Ｕ ・ω・)
```

対応判定は以下です。

- ヨシ(盤石)╰( Ｕ ・ω・)
- ヨシ(期待先行)╰( Ｕ ・ω・)
- 待て(有望)╰( Ｕ ・ω・)
- 待て(絶望)╰( Ｕ ・ω・)

旧形式の `待て╰( Ｕ ・ω・)` と `判定保留` は銘柄カード化せず、ログに警告として残します。証券コードは4桁数字のほか、`285A` のような英数字も扱えます。

## バッチ詳細と銘柄カード

バッチ詳細では以下を確認できます。

- バッチ作成日時
- 実行コマンド
- 銘柄数
- 工程別進捗
- ログ
- 銘柄カード一覧

銘柄カードには、判定、X記事、海外Xポスト、note記事、日本語Xポスト、note画像指示、X画像指示のタブがあります。各タブで以下を行えます。

- 現在保存されている内容表示
- コピー
- 編集
- 保存
- クリア
- 出力貼り戻し欄を開く
- 貼り戻し保存
- 保存して次の銘柄へ
- 保存して次工程へ

## 一括コピー支援

工程1〜6には一括コピー支援があります。これは自動送信ではありません。

- 未完了銘柄一覧から次に処理すべき銘柄を表示します。
- 1件ずつ「入力文をコピー」できます。
- 保存後は未完了状況が更新され、完了済みはスキップされます。
- 全件完了すると完了表示になります。

## プロジェクトURL設定

設定画面で工程別にChatGPTプロジェクト名とURLを保存できます。

- `step0`: イヌ式市場\|買い目判定
- `step1`: イヌ式市場\|X記事作成
- `step2`: イヌ式市場\|X英語ポスト作成
- `step3`: イヌ式市場\|note記事作成
- `step4`: イヌ式市場\|X日本語ポスト作成
- `step5`: イヌ式市場\|note画像指示書
- `step6`: イヌ式市場\|X画像指示書

URLが未設定の工程で「プロジェクトを開く」を押すと、設定画面で登録するように警告します。

## プロンプトテンプレート編集

プロンプト画面で工程0〜6のテンプレートを表示・編集・保存できます。

- `step0_buyJudgmentPrompt`
- `step1_xArticlePrompt`
- `step2_overseasXPostPrompt`
- `step3_noteArticlePrompt`
- `step4_japaneseXPostPrompt`
- `step5_noteImagePrompt`
- `step6_xImagePrompt`

保存先は以下です。

- `data/promptTemplates.json`
- `prompts/*.txt`

エクスポート/インポート機能でプロンプトJSONをバックアップできます。

## エクスポート/インポート

設定画面またはプロンプト画面から、以下のJSONをエクスポート/インポートできます。

- 全体JSON
- バッチJSON
- 設定JSON
- プロンプトJSON

保存ファイルはPC側ローカルにあります。

- `data/batches.json`
- `data/settings.json`
- `data/promptTemplates.json`

古い `settings.json` にブラウザ自動操作設定が残っていても、この版では無視されます。

## API

主なAPIは以下です。

- `GET /api/health`
- `GET /api/batches`
- `GET /api/batches/:batchId`
- `POST /api/batches/manual-import`
- `POST /api/batches/create-from-command`
- `POST /api/stocks/:stockId/save`
- `GET /api/templates`
- `POST /api/templates/save`
- `GET /api/settings`
- `POST /api/settings/save`
- `POST /api/export`
- `POST /api/import`
- `POST /api/build-copy-text`

`POST /api/run` は互換性のため残していますが、ChatGPT自動実行は無効である旨のエラーを返します。
