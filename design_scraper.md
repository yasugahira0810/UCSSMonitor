# scraper.js 詳細設計書

## 概要
Puppeteer を用いて特定サイトにログインし、残りデータ通信量を取得するためのスクリプト。  
ログイン可否やデータ取得状況をログ・ファイル出力し、エラー時には詳細を JSON 形式で記録。

## 主な依存関係と環境
- Node.js 実行環境  
- puppeteer, fs  
- 必要な環境変数:  
  - UCSS_EMAIL  
  - UCSS_PASSWORD  

## 定数
- `SELECTORS` :
  - emailInput: メールアドレス入力フィールド
  - passwordInput: パスワード入力フィールド
  - loginButton: ログインボタン
  - serviceDetailsButton: サービス詳細ボタン
  - remainingDataText: 残りデータ通信量テキスト
  - loginErrorMessage: ログインエラーメッセージセレクタ
- `TIMEOUT` :
  - short: 短い待機時間 (5000ms)
  - medium: 中程度の待機時間 (10000ms)
- `URLS` :
  - login: ログインページURL

## 関数仕様

### logErrorDetails(page, errorMessage)
- 目的: エラー時に詳細を JSON 形式で出力  
- 引数:  
  - page: Puppeteer のページオブジェクト  
  - errorMessage: 例外発生時のメッセージ  
- 処理:  
  1. 日付、ステータス、エラーメッセージ、URLを含むオブジェクトを作成
  2. `error_details.json` に書き込み  

### waitForSelector(page, selector, timeoutMs, errorMessage)
- 目的: セレクタが利用可能になるまで待機する
- 引数:
  - page: Puppeteerのページオブジェクト
  - selector: 待機対象のセレクタ
  - timeoutMs: タイムアウト時間（デフォルトはTIMEOUT.short）
  - errorMessage: エラー時のメッセージ（オプション）
- 戻り値: 成功時はtrue、失敗時はfalse（エラーメッセージが無い場合）
- 処理:
  1. 指定されたセレクタが表示されるまで待機
  2. エラー発生時にエラーメッセージがあれば、logErrorDetailsを呼び出してエラーをスロー
  3. エラーメッセージがなければfalseを返す

### isLoggedIn(page)
- 目的: ログインが成功しているか確認  
- 引数: page  
- 戻り値: serviceDetailsButtonセレクタが存在するかどうかの真偽値
- 処理:
  1. waitForSelectorを使用してserviceDetailsButtonの有無を確認

### login(page, email, password)
- 目的: ログイン処理全般 (ページ遷移/入力/ボタン押下/ログイン成否の判定)  
- 引数:  
  - page  
  - email, password  
- 処理:  
  1. メールとパスワードが設定されているか確認
  2. ログインページに遷移
  3. 必要な要素（メールフィールド、パスワードフィールド、ログインボタン）が表示されるまで待機
  4. 資格情報入力してログインボタン押下
  5. ページ遷移の完了を待機
  6. ログインエラーメッセージがあるか確認
  7. isLoggedIn()を使用してログイン成功したか確認
  8. 結果をログ出力

### waitForPostLoginElements(page)
- 目的: ログイン後の特定ボタン (serviceDetailsButton) が表示されるまで待機  
- 引数: page  
- 処理:
  1. waitForSelectorを使用してserviceDetailsButtonが表示されるまで待機
  2. 表示されない場合、指定されたエラーメッセージでエラーをスロー

### getRemainingData(page)
- 目的: 残りデータ通信量をクリック操作で取得 & コンソール出力  
- 引数: page
- 戻り値: 残りデータ通信量の文字列
- 処理:  
  1. 「サービスの詳細」ボタンをクリック
  2. 残りデータ通信量の表示要素を待機
  3. 要素からテキストを取得してコンソールに出力
  4. 取得したデータを返す

## エラー・ログ処理
- logErrorDetails: JSON でエラー情報をファイル出力  
- コンソールへのログには成功/エラーをまとめて出力  

## メイン処理
1. Puppeteer でブラウザ/ページを起動  
2. 環境変数からemailとpasswordを取得
3. login, waitForPostLoginElements, getRemainingData の実行  
4. エラー時は catch でエラーメッセージを出力し、終了コードを1に設定
5. 最終的に browser.close() で終了
6. unhandledRejection ハンドラで未処理のPromise拒否を捕捉し、エラー出力してプロセス終了

## 考慮点
- セレクタ変更や UI 変更に際し、SELECTORS の更新のみで対応可能  
- タイムアウト値はTIMEOUT定数で管理され、短時間と中程度の2種類の待機時間を設定
- 処理失敗時のリトライ戦略は現状未導入
- エラー発生時は詳細な情報をJSONファイルに記録し、トラブルシューティングを容易にする

