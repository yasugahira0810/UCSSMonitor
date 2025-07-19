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
- ログインしてログイン後のページに遷移したら、URLとログイン成功のメッセージをログに出力する
- ログイン失敗時にはエラーメッセージが表示されるので、その文字列を検出して、ログイン失敗を伝える
- ログイン後のページに「サービス詳細」ページへのリンクのCSSセレクタが表示されるまで待つ
- UCSSの「サービスの詳細」ページへ遷移して残りデータ通信量を取得
- Gist(https://gist.github.com/(process.env.GIST_USER)/(process.env.GIST_ID))を、データ保存（Gist）のフォーマットに従って、更新
- Gistの更新を契機に次のGitHub Actionsを動かして、横軸がdateで、縦軸がremainingDataの積み上げ折れ線グラフをChart.jsを使ってindex.htmlを生成
- 再生成したグラフをpeaceiris/actions-gh-pages@v4を使って、GitHub Pagesへデプロイ
- 残りデータ容量が増えたときには、（増えた時刻、残りデータ量）の地点から、（1ヶ月後の時刻、0GB）の地点まで、補助線を引く。これにより、ユーザは平均ペースに比べて早くデータ量を消費しているから使用を控えるか、データ量余る見込みだから、積極的に使うかを判断できる。

### セキュリティ：

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
- [ログイン後のページ](https://my.undercurrentss.biz/clientarea.php)
- ログインページのログインボタンのCSSセレクタ #login
- ログインページのメールアドレス入力欄のCSSセレクタ #inputEmail
- ログインページのパスワード入力欄のCSSセレクタ #inputPassword
- ログインページでログイン失敗した時のエラーメッセージのCSSセレクタ body > div.app-main > div.main-body > div > div > div > div > div > div
- ログインページから「サービス詳細」ページへのリンクのCSSセレクタ　#ClientAreaHomePagePanels-Active_Products_Services-0 > div > div.list-group-item-actions > button
- 「サービス詳細」ページの残りデータ通信量を示すテキストのCSSセレクタ #traffic-header > p.free-traffic > span.traffic-number
- [GitHubのユーザ名](yasugahira0810)
- [Gistのパス](https://gist.github.com/yasugahira0810/ec00ab4d6ed6cdb4f1b21f65377fc6af)

### GitHub ActionsのSecrets
- UCSS_EMAIL: UCSSのログイン用メールアドレス
- UCSS_PASSWORD: UCSSのログイン用パスワード
- GH_PAT: Gist更新用のPersonal Access Token。PAT生成時に付与する権限はGistのみでOK。
- GIST_USER: 更新対象のGistファイルを保有するユーザ名
- GIST_ID: 更新対象のGist

## GitHub Pagesの設定
- Build and deploymentのSourceはDeploy from a branch。Branchはgh-pagesの/(root)。

### グラフのデフォルト描画期間
- グラフのデフォルト表示期間は、現在の月の初日から最終日までに設定されています。
- 例えば、7月の場合、開始日は7月1日、終了日は7月31日となります。
- この設定により、ユーザーは現在の月のデータを直感的に確認できます。
