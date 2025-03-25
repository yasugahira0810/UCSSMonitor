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
- 実行環境: GitHub Actions
- データ保存: Gist（JSONフォーマット）
- 認証情報管理: GitHub ActionのSecrets
- グラフの表示先: GitHub Pages
- スクレイピング: Puppeteer

### 必要な機能：
- メールアドレスとパスワードをGitHub ActionsのSecretsで安全に管理
- GitHub Actionsで1時間ごとにジョブを実行し、PuppeteerでUCSSにログイン
- ログインしたらログインしたページのURLをログに出力
- ログインページに「サービスも詳細」という文字列が表示されるまで待つ
- UCSSの「サービスの詳細」ページへ遷移してデータ通信量を取得
- Gistの更新を契機に次のGitHub Actionsを動かしてグラフを再生成
- 再生成したグラフをGitHub Pagesへデプロイ

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

### UCSSのURLやCSSセレクタやXPath
- [ログインページ](https://my.undercurrentss.biz/index.php?rp=/login)
- ログインページのログインボタンのCSSセレクタ #login
- ログインページのメールアドレス入力欄のCSSセレクタ #inputEmail
- ログインページのパスワード入力欄のCSSセレクタ #inputPassword
- ログインページから「サービス詳細」ページへのリンクのCSSセレクタ　#ClientAreaHomePagePanels-Active_Products_Services-0 > div > div.list-group-item-actions > button
- 「サービス詳細」ページの残りデータ通信量を示すテキストのCSSセレクタ #traffic-header > p.free-traffic > span.traffic-number