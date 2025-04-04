# update_gist.js 詳細設計書

## 概要
Gistにデータを更新し、グラフ表示のためのHTMLファイルを生成するスクリプト。  
スクレイピングで取得した残りデータ通信量をGistに保存し、更に表示用HTMLを生成します。

## 主な依存関係と環境
- Node.js 実行環境  
- fs, node-fetch, path, @octokit/rest  
- 必要な環境変数:  
  - GH_PAT（GitHub Personal Access Token）
  - GIST_USER
  - GIST_ID
  - REMAINING_DATA（スクレイピングで取得した残りデータ通信量）

## 処理フロー

### Githubへの認証設定
- Octokit インスタンスを作成し、GitHub APIを通じてGistに接続
- GH_PAT環境変数を使用して認証

### Gist更新処理
- 目的: 残りデータ通信量をタイムスタンプと共にGistに追加保存
- 処理:
  1. 環境変数からGistのURLを構築
  2. Octokit APIを使用して既存Gistのデータを取得
  3. データ形式の検証（JSONとして解析可能か確認）
  4. 新しいエントリ（日付と残りデータ量）を既存データに追加
  5. 更新データでGistを更新

### HTML生成処理
- 目的: 閲覧用のHTMLファイルを生成
- 処理:
  1. docsディレクトリの存在確認、なければ作成
  2. 作成対象のHTMLファイル定義
     - chart.html: Chart.jsを使用したデータグラフ表示用
     - index.html: インデックスページ
  3. 定義したファイルをdocsディレクトリに出力

## 関数仕様

### 即時実行関数（メイン処理）
- 目的: Gistデータの取得と更新
- 処理:
  1. Octokitのインポートと初期化
  2. 環境変数のログ出力（デバッグ用）
  3. GistのURL構築
  4. 既存Gistデータの取得
  5. "data.json"ファイルからデータ解析
  6. 新規エントリの作成と既存データへの追加
  7. 更新データでGistの更新
  8. エラー処理

### generateFiles()
- 目的: 表示用HTMLファイルの生成
- 処理:
  1. 出力ディレクトリ（docs）の確認と作成
  2. 生成するファイル定義（名前とコンテンツ）
  3. 定義に従って各ファイルを出力
  4. ログ出力

## エラー処理
- try-catchでGist操作を囲み、エラー発生時は:
  1. エラーメッセージをコンソールに出力
  2. APIレスポンスがある場合は詳細情報も出力

## 実行方法
スクリプトは2つの主要部分で構成:
1. 即時実行関数によるGist更新処理
2. generateFiles()関数による表示HTMLの生成

`node update_gist.js`で実行し、必要な環境変数が設定されていることが前提。

## 考慮点
- Gistのデータ形式は日付と残りデータ量のペアを含む配列形式
- HTMLファイルはグラフ表示用（chart.html）とインデックス（index.html）の2種類を生成
- Chart.jsを使用したグラフ表示はCDNから読み込み
- GitHub認証にはPersonal Access Token（GH_PAT）が必要