# update_gist.js 詳細設計書

## 概要
Gistにデータを更新し、グラフ表示のためのHTMLファイルを生成するスクリプト。  
スクレイピングで取得した残りデータ通信量をGistに保存し、更に表示用HTMLを生成します。

## 主な依存関係と環境
- Node.js 実行環境  
- fs, node-fetch, path, @octokit/rest  
- 必要な環境変数: 各関数内で`process.env`オブジェクトから直接読み込まれます。
  - `GH_PAT`: GitHub Personal Access Token
  - `GIST_USER`: GitHubのユーザー名
  - `GIST_ID`: GistのID
  - `REMAINING_DATA`: スクレイピングで取得した残りデータ通信量

## 定数
- FILENAME: Gistに保存するデータのファイル名（'data.json'）

## 関数仕様

### updateGist()
- 目的: Gistにデータを更新する
- 処理:
  1. Octokitをインポートし、GH_PATを使用してOctokitインスタンスを初期化
  2. Gist URLをログ出力
  3. fetchGistDataを呼び出して既存データを取得
  4. 新しいエントリ（日付と`process.env.REMAINING_DATA`から取得した残りデータ量）を作成
  5. 既存データに新しいエントリを追加
  6. saveGistDataを呼び出してGistを更新
  7. エラー処理

### fetchGistData(octokit)
- 目的: Gistから既存データを取得する
- 引数: octokitインスタンス
- 戻り値: Gistから取得したJSONデータ（配列形式）
- 処理:
  1. `process.env.GIST_ID`が存在しない場合はエラーをスロー
  2. octokitを使用してGistデータを取得
  3. Gistにファイルが存在するか検証
  4. JSONパースしてデータを返す

### saveGistData(octokit, updatedData)
- 目的: 更新したデータをGistに保存する
- 引数: 
  - octokit: octokitインスタンス
  - updatedData: 更新するデータ
- 処理:
  1. octokitのgists.updateメソッドを使用してGistを更新
  2. `process.env.GIST_ID`で指定したGistの、FILENAMEで指定したファイルに更新データを書き込み

### generateFiles()
- 目的: 表示用HTMLファイルの生成
- 処理:
  1. 出力ディレクトリ（docs）の存在確認と作成
  2. 生成するファイル定義（chart.htmlとindex.html）
  3. 各ファイルに必要なHTMLコンテンツを定義
  4. 定義に従って各ファイルを出力
  5. ファイル生成のログ出力

## メイン処理
- `process.env.NODE_ENV`が`'test'`でない場合にのみ、即時実行関数で`updateGist()`と`generateFiles()`を非同期で実行します。これにより、テスト実行時に実際のGist更新やファイル生成が行われるのを防ぎます。

## エラー処理
- try-catchでGist操作を囲み、エラー発生時は:
  1. エラーメッセージをコンソールに出力
  2. APIレスポンスがある場合は詳細情報も出力

## 出力ファイル
1. docs/chart.html - Chart.jsを使用したグラフ表示HTMLファイル
2. docs/index.html - シンプルなインデックスページ

## 考慮点
- Gistのデータ形式は日付と残りデータ量のペアを含む配列形式
- HTMLファイルはグラフ表示用（chart.html）とインデックス（index.html）の2種類を生成
- Chart.jsを使用したグラフ表示はCDNから読み込み
- GitHub認証にはPersonal Access Token（GH_PAT）が必要
- 生成されるHTMLはサンプルデータを使用した基本的なChart.js実装