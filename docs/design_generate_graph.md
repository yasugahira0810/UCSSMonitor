# generate_graph.js 詳細設計書

## 概要
Gistからデータを取得し、残りデータ通信量のグラフを生成するためのスクリプト。  
HTML形式でインタラクティブなチャートを生成し、GitHub Actionsでの実行時には残りデータ量を環境変数として出力します。

## 主な依存関係と環境
- Node.js 実行環境  
- fs, node-fetch, path, url  
- 必要な環境変数:  
  - GIST_USER  
  - GIST_ID  
  - GITHUB_ACTIONS (GitHub Actions実行時のみ)  
  - GITHUB_OUTPUT (GitHub Actions実行時のみ)
  - UTC_OFFSET (タイムゾーン設定・オプション)

## データ期間の選択仕様（2025/07/19追記）
- 横軸（開始日時・終了日時）は、Gistに存在する全期間のデータから自由に選択できること。
- 画面のUIで、最も古いデータの日付から最新データの日付までを範囲として選択可能とする。
- デフォルトでは今月分を表示するが、ユーザーが任意の期間を選択できる。
- 「1ヶ月先まで表示する」チェック時は、終了日時（x-max）のmax属性が1ヶ月後の日付（oneMonthFromNowFormatted）となる。

## 定数
- `CONSTANTS`:
  - OUTPUT_PATH: 出力HTMLファイルのパス ('./docs/index.html')
  - DOCS_DIR: ドキュメントディレクトリのパス ('./docs')
  - Y_AXIS: Y軸の設定（DEFAULT_MIN: 0, DEFAULT_MAX: 100, MAX_LIMIT: 500, THRESHOLDS: [50, 100]）
- `TIMEZONE_MAP`: タイムゾーン名称とその表示名のマッピング

## 関数仕様

### fetchAndProcessData()
- 目的: データの取得と処理の主要フロー
- 処理:
  1. GistのURLを構築してデータを取得
  2. GitHub Actions処理（必要な場合）
  3. データを時間単位でフィルタリング
  4. タイムゾーン情報の取得
  5. グラフ描画のためのデータ準備
  6. HTMLコンテンツの生成と保存

### fetchDataFromGist(gistUrl)
- 目的: GistからJSONデータを取得
- 引数: gistUrl - Gistの完全なURL
- 戻り値: 取得したJSONデータ（配列）
- 処理:
  1. node-fetchを使用してGistのraw URLにアクセス
  2. レスポンスのステータスコードを確認
  3. レスポンスをJSONにパース
  4. 配列形式かチェックしてログ出力後、データを返す

### processGitHubActions(data)
- 目的: GitHub Actions環境での処理
- 引数: data - Gistから取得したデータ
- 処理:
  1. GITHUB_ACTIONS環境変数の有無を確認
  2. 最新のデータを抽出して数値をフォーマット
  3. GITHUB_OUTPUTファイルに出力

### filterHourlyData(data)
- 目的: データを1時間ごとにフィルタリング
- 引数: data - 全データ配列
- 戻り値: 1時間ごとにフィルタリングされたデータ配列
- 処理:
  1. 全データを反復処理
  2. 時間単位でグループ化（年-月-日-時間）
  3. 各時間グループの最初のデータポイントのみを保持

### getTimezoneInfo()
- 目的: タイムゾーン情報の取得
- 戻り値: タイムゾーンとその表示名のオブジェクト
- 処理:
  1. デフォルト値としてUTCを設定
  2. UTC_OFFSET環境変数があれば解析
  3. 数値オフセットか名前付きタイムゾーンかを判定
  4. 適切なタイムゾーン情報と表示名を返す

### formatDate(dateString, timezone)
- 目的: 日付を指定したタイムゾーンでフォーマット
- 引数:
  - dateString: 日付文字列
  - timezone: タイムゾーン
- 戻り値: フォーマットされた日付文字列
- 処理:
  1. 日付オブジェクトを作成
  2. 指定したタイムゾーンで日本語形式にフォーマット

### formatDateForInput(date, timezone)
- 目的: 日付をHTML datetime-local入力用にフォーマット
- 引数:
  - date: 日付オブジェクト
  - timezone: タイムゾーン
- 戻り値: YYYY-MM-DDThh:mm形式の文字列
- 処理:
  1. 指定したタイムゾーンで日付オブジェクトを作成
  2. 年、月、日、時、分を抽出してフォーマット
  3. YYYY-MM-DDThh:mm形式の文字列を返す

### prepareChartData(filteredData, timezone)
- 目的: グラフ描画用のデータ準備
- 引数:
  - filteredData: フィルタリング済みデータ
  - timezone: タイムゾーン
- 戻り値: グラフデータ、日付情報、軸設定を含むオブジェクト
- 処理:
  1. 時間スケール用のデータマッピング（chartDataはGist全期間分を返す。デフォルトの表示範囲は今月分だが、UIで任意の期間を選択した場合はその範囲のみをChart.jsのmin/maxで制御する）
  2. Y軸の範囲計算
  3. 時間範囲の設定（最初と最後のデータポイント、現在日時）
  4. 日付のフォーマット処理
  5. 準備したデータを返す

### calculateYAxisRange(maxValue)
- 目的: Y軸の適切な範囲を計算
- 引数: maxValue - データの最大値
- 戻り値: Y軸の最小値と最大値のオブジェクト
- 処理:
  1. データの最大値が0以上50GB以下なら最大値は50GB
  2. 50GB超100GB以下なら最大値は100GB
  3. 100GB超150GB以下なら最大値は150GB
  4. 以降も同様に50GB刻みで切り上げ
  5. 最小値と計算された最大値を返す

### generateAndSaveHtml(chartData, dateInfo, axisSettings, filteredData, timezone, timezoneDisplay)
- 目的: HTMLコンテンツの生成と保存
- 引数:
  - chartData: チャートデータ
  - dateInfo: 日付情報
  - axisSettings: 軸設定
  - filteredData: フィルタリングされたデータ
  - timezone: タイムゾーン
  - timezoneDisplay: タイムゾーン表示名
- 処理:
  1. インタラクティブなグラフを含むHTMLコンテンツを生成
  2. Chart.jsを使用したグラフ設定
  3. 日付範囲スライダーや軸範囲コントロールなどのUIコンポーネント
  4. 生成したHTMLをファイルに保存

## メイン処理
- fetchAndProcessData関数を呼び出してデータ取得から出力までの一連の処理を実行

## エラー処理
- try-catchで全体を囲み、エラー発生時は:  
  1. エラーメッセージとスタックトレースをコンソールに出力  
  2. プロセスを終了コード1で終了  

## 出力
- docs/index.html - Chart.jsを使用したインタラクティブなグラフページ
  - Y軸: 残りデータ通信量（GB）
  - X軸: 日時（指定したタイムゾーン）
  - フィルタリング: 1時間ごとのデータポイント
  - インタラクティブ要素: 日付範囲選択、軸範囲調整
  - 補助線（ガイドライン）: データ容量が増加したタイミングごとに、（増えた時刻・残りデータ容量）から（1ヶ月後の時刻・0GB）まで直線を描画する。増加が複数回あれば、その都度補助線を描画する。

## 考慮点
- タイムゾーンのカスタマイズにより、異なる地域のユーザーに対応
- データはフィルタリングにより1時間ごとに表示し、グラフの見やすさを向上
- スライダーやコントロールにより、ユーザーがデータ表示をカスタマイズ可能
- Y軸のスケールは「画面に描画される期間（開始日時～終了日時）の最大値」に基づいて自動調整される（全期間の最大値ではない）。
- モバイル対応のレスポンシブデザイン

### Y軸最大値の決定仕様（2025/07/19仕様変更）
- Y軸最大値（yAxisMax）は、グラフの「開始日時～終了日時」内に存在するデータの最大値をもとに決定する。
- 例：全期間の最大値が120GBでも、表示範囲内の最大値が100GBならyAxisMaxは100GBとなる。
- calculateYAxisRange関数は、表示範囲内の最大値を引数として呼び出すこと。

# モジュール形式の運用方針（2025/07/19追記）
- 本スクリプト（generate_graph.js）は、Node.jsのテスト実行環境（Jest等）との互換性を考慮し、CommonJS形式（require/module.exports）で実装する。
- ES Modules（import/export）形式は使用しない。
- これにより、Jestによる単体テスト実行時のimport文エラー（SyntaxError: Cannot use import statement outside a module）を回避する。
- 依存パッケージ（node-fetch等）もrequireで読み込むこと。

# 変更履歴（2025/07/19追記）
- モジュール形式をES Modules（import/export）からCommonJS（require/module.exports）に全面移行。
- Jest等のテスト実行環境でimport文エラーが発生しないようにした。
- 依存パッケージ（fs, node-fetch, path, url）はすべてrequireで読み込む。
- テスト用エクスポートはmodule.exportsで明示的に記述。
- これにより、generate_graph.test.jsのテストが正常に実行可能となる。