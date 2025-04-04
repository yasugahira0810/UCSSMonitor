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
  - login 画面の入力欄・ボタン、サービス詳細画面のセレクタを定義

## 関数仕様

### logErrorDetails(page, errorMessage)
- 目的: エラー時に詳細を JSON 形式で出力  
- 引数:  
  - page: Puppeteer のページオブジェクト  
  - errorMessage: 例外発生時のメッセージ  
- 処理:  
  1. ページ URL とエラーメッセージをオブジェクト化  
  2. `error_details.json` に書き込み  

### isLoggedIn(page)
- 目的: ログインが成功しているか確認  
- 引数: page  
- 戻り値: 真偽値 (セレクタ有無で判定)

### login(page, email, password)
- 目的: ログイン処理全般 (ページ遷移/入力/ボタン押下/ログイン成否の判定)  
- 引数:  
  - page  
  - email, password  
- 処理:  
  1. ログインページ移動  
  2. 必要な要素の待機  
  3. 資格情報入力してログインボタン押下  
  4. 画面遷移完了後、エラー表示チェック  
  5. isLoggedIn() 結果による判断とログ出力  

### waitForPostLoginText(page)
- 目的: ログイン後の特定ボタン (serviceDetailsButton) が表示されるまで待機  
- 引数: page  
- エラー: 指定時間内に要素が見つからない場合、エラーとして詳細記録  

### logRemainingData(page)
- 目的: 残りデータ通信量をクリック操作で取得 & コンソール出力  
- 引数: page  
- 処理:  
  1. 「サービスの詳細」をクリック  
  2. データ量の表示要素を待機  
  3. 取得したテキストをフォーマットして出力  

## エラー・ログ処理
- logErrorDetails: JSON でエラー情報をファイル出力  
- コンソールへのログには成功/エラーをまとめて出力  

## メイン処理 (即時実行関数)
1. Puppeteer でブラウザ/ページを起動  
2. 環境変数チェック  
3. login, waitForPostLoginText, logRemainingData 実行  
4. エラー時は catch で詳細出力し、最終的に browser.close()  
5. unhandledRejection で予期せぬ非同期エラーに対応  

## 考慮点
- セレクタ変更や UI 変更に際し、SELECTORS の更新のみで対応可能  
- タイムアウト値が適切か検討し、長すぎる待機を避ける  
- 処理失敗時のリトライ戦略は現状未導入  

