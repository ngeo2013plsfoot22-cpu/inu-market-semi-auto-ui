import type { PromptTemplates, Settings } from './types.js';

export const defaultSettings: Settings = {
  defaultProjectUrl: '',
  projectUrlsByStep: { step0: '', step1: '', step2: '', step3: '', step4: '', step5: '', step6: '' },
  projectNamesByStep: {
    step0: 'イヌ式市場|買い目判定', step1: 'イヌ式市場|X記事作成', step2: 'イヌ式市場|X英語ポスト作成', step3: 'イヌ式市場|note記事作成',
    step4: 'イヌ式市場|X日本語ポスト作成', step5: 'イヌ式市場|note画像指示書', step6: 'イヌ式市場|X画像指示書'
  },
  runner: { headless: false, timeoutMs: 180000, stopOnError: true, sendMode: 'twoStep', newChatPerStep: true, browserMode: 'chromePersistent' }
};

export const defaultPrompts: PromptTemplates = {
  step0_buyJudgmentPrompt: `イヌ式市場・買い目判定プロンプト 完成版
10銘柄固定・現在値厳格化・ランダムヨシ純化・重複防止強化・52週相対判定・モメンタム対応・待て有望/絶望分岐・実運用安定版

目的：
日本株の候補銘柄を抽出し、短期〜中期で現実的に+5%以上の上昇余地があるかを中心に、52週レンジ位置、トレンド、上値抵抗、支持帯、材料性、流動性、需給、希薄化リスク、リスクリワード、セクター分散を総合して、X投稿用の3行判定を出力する。

対象：
原則として日本の個別株。ETF・ETN・REITは明示的に対象とする指示がない限り含めない。

通常の出力判定：
* ヨシ(盤石)╰( Ｕ ・ω・)
* ヨシ(期待先行)╰( Ｕ ・ω・)
* 待て(有望)╰( Ｕ ・ω・)
* 待て(絶望)╰( Ｕ ・ω・)

使用コマンド：
* ランダム　実行
* ランダムヨシ　実行
* ランダム高配当　実行
* ランダム期待先行　実行
* ランダムテーマ株　実行
* ランダムモメンタム　実行
* ランダム待て　実行
* ランダム〇〇　実行
* 銘柄名 実行

禁止コマンド：
* ランダム実行

最重要原則：
* 株価は必ず現在値ベース
* 最終出力に使う現在値・前日比・前日比率は同一ページまたは同一時点で整合する組み合わせのみ使う
* 52週レンジ位置は必ず計算式で算出する
* ランダムヨシでは待て銘柄を混ぜない
* ランダム待てではヨシ銘柄を混ぜない
* 10銘柄固定を基本にするが、数値整合性・判定条件を満たす銘柄が10件に満たない場合は無理に埋めない

52週レンジ位置 = (現在値 - 52週安値) / (52週高値 - 52週安値) × 100
区分：0%以上40%以下=低値圏、40%超70%未満=中間帯、70%以上100%以下=高値圏

出力形式：理由、補足、注釈、分析文、参考URLは一切書かない。各銘柄ごとに以下の3行のみ。
銘柄名 証券コード
現在値 (52週レンジ位置区分)/前日比/前日比率
判定
銘柄間には1行空行を入れる。
個別銘柄実行で数値整合が取れない場合のみ、3行形式ではなく判定保留を返す。`,
  step1_xArticlePrompt: `イヌ式市場・X記事作成プロンプト
「イヌでも分かる〇〇」企業紹介記事版
投資情報はnote分離・リプ誘導なし版

目的：3行形式の買い目判定結果をもとに、Xの記事機能向けの企業紹介記事を作成する。本文では投資判断を前面に出さず、「この会社が何をしているのか」を読者に知ってもらう入口記事にする。

入力：銘柄名 証券コード / 株価 (52週レンジ位置区分)/前日比/前日比率 / 判定結果
対応判定：ヨシ(盤石)、ヨシ(期待先行)、待て(有望)、待て(絶望)
本文で書かないもの：判定結果、現在株価、株価位置、前日比、+5%目標、上値抵抗、短期売買判断、買い目判定の理由、note誘導、URL欄。

出力形式：
【X記事本文】
イヌでも分かる〇〇｜この会社、何をしているの？
□今回のポイント
1. 〜
2. 〜
3. 〜
□まず、この会社を一言でいうと
本文
□何で稼いでいる会社？
本文
□私たちの生活や社会とどう関係している？
本文
□どこが面白い会社？
本文
□企業理解としてどこを見る？
本文
□まとめ
本文
※ 本記事は情報提供および分析を目的としたものであり、特定の金融商品の売買を推奨・勧誘するものではありません。掲載されている情報の正確性・完全性については保証しておらず、記事内の情報には遅延や誤差が含まれる場合があります。最終的な投資判断はご自身の責任にて行ってください。本記事の利用により生じたいかなる損害についても、一切の責任を負いかねます。
禁止：【リプ用note誘導】、URL、判定結果、株価情報、買い煽り。`,
  step2_overseasXPostPrompt: `海外投資家向け・日本株Xポスト生成プロンプト
買い目判定v3対応版 / Local Japan Insight 強化・待て2分類対応版

目的：買い目判定v3の3行結果をもとに、海外投資家向けの英語Xポストを作成する。
判定変換：ヨシ(盤石)=Good (Solid)、ヨシ(期待先行)=Expectation-Driven、待て(有望)=Wait (Promising)、待て(絶望)=Wait (Low Priority)
Zone変換：低値圏=Lower Zone、中間帯=Middle Zone、高値圏=High Zone
重要：判定・株価・52週レンジ位置・前日比・前日比率を変更しない。Buy now/Strong Buy/You should buy禁止。Not financial adviceで締めない。URL禁止。

出力形式：
🐶 Japan Stock Watch
[Company Name] ([Code])
Signal: [Converted Signal]
[会社概要]
Current setup:
Price: ¥[price]
Zone: [Zone]
Move: [daily change]
[株価位置と判定の関係]
What I’m watching:
□ [Point 1]
□ [Point 2]
□ [Point 3]
Local Japan insight:
[海外投資家が見落としやすい日本独自の文脈]
My view:
Short term: ...
Mid term: ...
Long term: ...
[自然な問いかけ、または余韻]`,
  step3_noteArticlePrompt: `イヌ式市場・Note記事作成プロンプト（現在運用版・引用具体化対応版）

目的：3行形式の銘柄判定結果をもとに、note投稿用の投資記事を作成する。
対応判定：ヨシ(盤石)、ヨシ(期待先行)、待て(有望)、待て(絶望)。判定・株価・52週レンジ位置・前日比・前日比率を変更しない。顔文字を保持する。URLと引用元一覧は禁止。
タイトル形式：銘柄名 証券コード（YYYY/MM/DD_HH:MM）
タイトル直後：セクター：〇〇 / 事業：〇〇

出力構成：
銘柄名 証券コード（YYYY/MM/DD_HH:MM）
セクター：〇〇
事業：〇〇
□今回のポイント
1. 〜
2. 〜
3. 〜
□解説
本文
□投資戦略
長期：〜
中期：〜
短期：〜
□まとめ
本文
※ 本記事は情報提供および分析を目的としたものであり、特定の金融商品の売買を推奨・勧誘するものではありません。掲載されている情報の正確性・完全性については保証しておらず、記事内の情報には遅延や誤差が含まれる場合があります。最終的な投資判断はご自身の責任にて行ってください。本記事の利用により生じたいかなる損害についても、一切の責任を負いかねます。`,
  step4_japaneseXPostPrompt: `Xポスト生成プロンプト（本ポスト単独版）
目的：note記事用の銘柄解説文をもとに、X投稿用の本ポストだけを作成する。
重要：出力は本ポストのみ。【返信ポスト】、note誘導文、URL欄、免責文は禁止。入力された判定、株価、52週レンジ位置、前日比、前日比率、+5%目標、+10%目標は変更しない。顔文字「╰( Ｕ ・ω・)」を保持する。最後は必ず「╰( Ｕ ・ω・)？」で終える。

基本形式：
キャッチーな導入文＋絵文字
興味を引く補足文＋絵文字
銘柄名: 銘柄名 証券コード
判定結果: 判定╰( Ｕ ・ω・)
株価位置と現在の見方を2〜3行で説明。
見るポイントはこの3つ👇
□ ポイント1＋絵文字
□ ポイント2＋絵文字
□ ポイント3＋絵文字
「理由1」
「理由2」
「理由3」
短期は〇〇⚡
中期は〇〇📈
長期は〇〇🌱
最後は読者に聞く形で締める。`,
  step5_noteImagePrompt: `イヌ式市場・note記事 → noteヘッダー画像生成指示書プロンプト 完成版
目的：note記事形式の日本株解説文をもとに、note用ヘッダー画像を生成するための英語プロンプトを作成する。画像生成そのものは行わない。
重要：1銘柄のみ、1280×670 px、noteヘッダー向け横長、黒板風、投資メモ風、英語のみ、可愛い犬キャラクター入り。過去銘柄情報を混ぜない。数値・判定を変更しない。画像内テキストに日本語禁止。
判定変換：ヨシ(盤石)=Good (Solid)、ヨシ(期待先行)=Expectation-Driven、待て(有望)=Wait (Promising)、待て(絶望)=Wait (Low Priority)
Zone変換：低値圏=Lower Zone、中間帯=Middle Zone、高値圏=High-Price Zone

出力フォーマット：
Create a finished 1280×670 px horizontal chalkboard-style stock analysis header.
RESET AND DATA INTEGRITY:
This is a new image. Ignore all previous stock names, codes, prices, chart labels, keywords, judgments, and scenario numbers. Use only the current stock data listed below.
STYLE REFERENCE: deep green chalkboard, warm wooden frame, top-center title, upper-left info block, lower-left chart, right-side keyword list, upper-right judgment ellipse, bottom summary block, bottom scenario line, cute dog on the far right.
DOG REFERENCE: white round face, black droopy ears, simple black line art, light pink cheeks, tiny black nose, soft rounded body, gentle kawaii style. No necktie. No glasses.
CURRENT STOCK DATA ONLY:
Title: [Company Name]
Code: [Code]
Judgment: [Converted Judgment]
Latest Share Price: [Price] yen
52-Week Range: [Low] - [High] yen
Zone: [Zone]
Chart Label: [Short English Label]
Keywords: [Keyword 1] [Keyword 2] [Keyword 3] [Keyword 4]
Bottom Summary: [Short Summary]
Scenario Line: +5%: [Price] yen / +10%: [Price] yen
TEXT RULE: English only. Short, large, readable chalk-style text. No Japanese, no emoji, no kaomoji, no paragraphs.`,
  step6_xImagePrompt: `note記事 → X用画像生成指示書作成プロンプト（現在運用版）
目的：note記事用の銘柄解説文をもとに、X投稿用の正方形サムネ画像に使う英語の画像生成指示書を作成する。画像生成そのものは行わない。英語プロンプトだけを出力する。
重要：出力はコードブロックのみ。1銘柄のみ。過去銘柄情報を混ぜない。株価、+5%目標、判定、株価位置を変更しない。+5%目標が記事中にない場合は無理に作らない。画像内テキストは英語のみ。日本語、絵文字、顔文字、URL、note誘導文、免責文、長文は禁止。
判定変換：ヨシ(盤石)=Good (Solid)、ヨシ(期待先行)=Expectation-Driven、待て(有望)=Wait (Promising)、待て(絶望)=Wait (Low Priority)、待て=Wait
Zone変換：低値圏=Lower Zone、中間帯=Middle Zone、高値圏=High Zone

出力テンプレート：
Create a catchy square X-post stock memo image.
Use the attached dog image as the style reference only.
Purpose:
...
Visual concept:
...
Layout:
...
Text rule:
...
Current stock data only:
Company Name:
Code:
Judgment:
Zone:
Latest Share Price:
+5% Target:
Keywords:
Visual tone:
...
Dog expression:
...
Final output:
...`
};
