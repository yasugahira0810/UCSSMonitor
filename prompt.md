GitHub Copilotへ：
新しいWebアプリを開発したいので、設計を手伝ってください。

### 概要：
- VPNサービス「UCSS」の残りのデータ通信量をグラフ化するアプリ「UCSSMonitor」
- UCSSMonitorはユーザーに代わってUCSSにメールアドレスとパスワードを入力して、「サービスの詳細」ページからスクレイピングによってデータ通信量を確認してGistに記録し、グラフ化する（以降、これをジョブと呼ぶ）
- ジョブは1時間毎に実行され、実行結果として記録「日時」と「残りのデータ通信量」を記録する
- ユーザはアプリへのログインなしでグラフを確認できる（GitHubへのログインはしても良い）
- UCSSの費用以外は全て無料で実現する
- 開発者のみがユーザの想定である

### 技術スタック：
- フロントエンド: Vue.js + Chart.js
- バックエンド: node.js
- 初期の開発環境: devcontainer
- 後期の開発環境: GitHub Actions
- データ保存: Gist（JSONフォーマット）
- 認証情報管理: GitHub ActionのSecrets
- グラフの表示先: GitHub Pages
- スクレイピング: Puppeteer

### 必要な機能：
1. メールアドレスとパスワードをGitHub ActionsのSecretsで安全に管理
2. GitHub Actionsで1時間ごとにジョブを実行し、PuppeteerでUCSSにログイン
3. UCSSの「サービスの詳細」ページへ遷移してデータ通信量を取得
4. Gistの更新を契機に次のGitHub Actionsを動かしてグラフを再生成
5. 再生成したグラフをGitHub Pagesへデプロイ

### セキュリティ：

- devcontainerでの開発では.envを使って、メールアドレス(EMAIL)とパスワード(PASSWORD)は環境変数で管理
- .envはGitの管理対象外とすることで安全に管理
- GitHub SecretsでUCSSのメールアドレスとパスワードを安全に管理
- リポジトリはパブリックリポジトリ

### データ保存（Gist）のフォーマット：
- Gistに保存するデータは以下のJSON形式：
```json
[
  {"date": "2025-03-22T12:00:00Z", "remainingData": 50.9},
  {"date": "2025-03-22T13:00:00Z", "remainingData": 50.4}
]
```

### 開発の進め方
1. devcontainer内でPuppeteerを手動実行してUCSSをスクレイピングして、標準出力に時刻と残りのデータ通信量をGistに追記する
2. GitHub Actions内でPuppeteerを手動実行してUCSSをスクレイピングして、標準出力に時刻と残りのデータ通信量をGistに追記する

この仕様をもとに、ディレクトリ構成、データベーススキーマ、GitHub Actionsのワークフローの詳細を提案してください。