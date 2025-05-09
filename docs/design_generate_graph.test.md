# generate_graph.js テスト設計書

## 概要
このドキュメントでは、`generate_graph.js`に対するJestを使用したユニットテストの設計について詳述します。
各テストケースでは、関数の正常動作、エラー処理、境界値条件、およびエッジケースをカバーします。

## テスト対象の関数
- `filterHourlyData`
- `getTimezoneInfo`
- `formatDate`
- `formatDateForInput`
- `prepareChartData`
- `calculateYAxisRange`
- `fetchDataFromGist`（モック必要）
- `processGitHubActions`
- `generateAndSaveHtml`（部分モック必要）
- `fetchAndProcessData`（統合テスト）

## テストケース詳細

### 1. filterHourlyData 関数のテスト

#### 1.1 基本的なフィルタリング
- **目的**: データが1時間ごとに正しくフィルタリングされることを確認する
- **前提条件**: 時間の異なるデータポイントの配列がある
- **入力**: 
  ```javascript
  [
    { date: '2023-01-01T00:00:00Z', remainingData: '100' },
    { date: '2023-01-01T00:30:00Z', remainingData: '90' },
    { date: '2023-01-01T01:00:00Z', remainingData: '80' }
  ]
  ```
- **期待される結果**: 
  ```javascript
  [
    { date: '2023-01-01T00:00:00Z', remainingData: '100' },
    { date: '2023-01-01T01:00:00Z', remainingData: '80' }
  ]
  ```

#### 1.2 日付の変更があるケース
- **目的**: 日付が変わる場合も正しくフィルタリングされることを確認する
- **前提条件**: 日付をまたぐデータポイントの配列がある
- **入力**: 
  ```javascript
  [
    { date: '2023-01-01T23:30:00Z', remainingData: '50' },
    { date: '2023-01-02T00:00:00Z', remainingData: '45' },
    { date: '2023-01-02T00:30:00Z', remainingData: '40' }
  ]
  ```
- **期待される結果**: 
  ```javascript
  [
    { date: '2023-01-01T23:30:00Z', remainingData: '50' },
    { date: '2023-01-02T00:00:00Z', remainingData: '45' }
  ]
  ```

#### 1.3 空の配列
- **目的**: 空の配列を処理できることを確認する
- **前提条件**: 空の配列
- **入力**: `[]`
- **期待される結果**: `[]`

### 2. getTimezoneInfo 関数のテスト

#### 2.1 デフォルトのタイムゾーン
- **目的**: 環境変数が設定されていない場合のデフォルト値を確認する
- **前提条件**: `process.env.UTC_OFFSET`が未設定
- **入力**: なし（環境変数依存）
- **期待される結果**: `{ timezone: 'UTC', timezoneDisplay: 'UTC+0' }`

#### 2.2 数値オフセットのタイムゾーン
- **目的**: 数値オフセットが正しく解析されることを確認する
- **前提条件**: `process.env.UTC_OFFSET = '+9'`
- **入力**: なし（環境変数依存）
- **期待される結果**: `{ timezone: 'Etc/GMT-9', timezoneDisplay: 'UTC+9' }`

#### 2.3 負の数値オフセットのタイムゾーン
- **目的**: 負の数値オフセットが正しく解析されることを確認する
- **前提条件**: `process.env.UTC_OFFSET = '-5'`
- **入力**: なし（環境変数依存）
- **期待される結果**: `{ timezone: 'Etc/GMT+5', timezoneDisplay: 'UTC-5' }`

#### 2.4 名前付きタイムゾーン
- **目的**: 名前付きタイムゾーンが正しく解析されることを確認する
- **前提条件**: `process.env.UTC_OFFSET = 'Asia/Tokyo'`
- **入力**: なし（環境変数依存）
- **期待される結果**: `{ timezone: 'Asia/Tokyo', timezoneDisplay: 'JST (UTC+9)' }`

#### 2.5 マッピングにない名前付きタイムゾーン
- **目的**: マッピングにない名前付きタイムゾーンがそのまま使用されることを確認する
- **前提条件**: `process.env.UTC_OFFSET = 'America/Chicago'`
- **入力**: なし（環境変数依存）
- **期待される結果**: `{ timezone: 'America/Chicago', timezoneDisplay: 'America/Chicago' }`

### 3. formatDate 関数のテスト

#### 3.1 基本的な日付フォーマット
- **目的**: 日付が正しくフォーマットされることを確認する
- **前提条件**: 特定の日付文字列とタイムゾーン
- **入力**: `'2023-01-01T12:30:00Z'`, `'UTC'`
- **期待される結果**: 
  - 日本語ロケールでの月/日 時:分形式（例：`'1/1 12:30'`）

#### 3.2 異なるタイムゾーンでのフォーマット
- **目的**: タイムゾーンの違いによる日付表示の変化を確認する
- **前提条件**: 特定の日付文字列と異なるタイムゾーン
- **入力**: `'2023-01-01T00:00:00Z'`, `'Asia/Tokyo'`
- **期待される結果**: 
  - 東京時間での表示（例：`'1/1 09:00'`）

### 4. formatDateForInput 関数のテスト

#### 4.1 基本的な日付フォーマット
- **目的**: 日付が HTML datetime-local 入力用にフォーマットされることを確認する
- **前提条件**: 特定の日付オブジェクトとタイムゾーン
- **入力**: `new Date('2023-01-01T12:30:00Z')`, `'UTC'`
- **期待される結果**: `'2023-01-01T12:30'`

#### 4.2 異なるタイムゾーンでのフォーマット
- **目的**: タイムゾーンの違いによる日付フォーマットの変化を確認する
- **前提条件**: 特定の日付オブジェクトと異なるタイムゾーン
- **入力**: `new Date('2023-01-01T00:00:00Z')`, `'Asia/Tokyo'`
- **期待される結果**: `'2023-01-01T09:00'`

#### 4.3 年月日時分のパディング
- **目的**: 数値が適切にゼロ埋めされることを確認する
- **前提条件**: 1桁の月、日、時、分を含む日付
- **入力**: `new Date('2023-02-03T04:05:00Z')`, `'UTC'`
- **期待される結果**: `'2023-02-03T04:05'`

### 5. prepareChartData 関数のテスト

#### 5.1 基本的なデータ準備
- **目的**: チャートデータが正しく準備されることを確認する
- **前提条件**: フィルタリングされたデータの配列とタイムゾーン
- **入力**:
  ```javascript
  [
    { date: '2023-01-01T00:00:00Z', remainingData: '10.5' },
    { date: '2023-01-02T00:00:00Z', remainingData: '9.8' }
  ], 'UTC'
  ```
- **期待される結果**:
  ```javascript
  {
    chartData: [
      { x: 1672531200000, y: 10.5 },
      { x: 1672617600000, y: 9.8 }
    ],
    dateInfo: {
      firstDate: new Date('2023-01-01T00:00:00Z'),
      lastDate: new Date('2023-01-02T00:00:00Z'),
      currentDate: /* 現在の日時 */,
      firstDateFormatted: '2023-01-01T00:00',
      lastDateFormatted: '2023-01-02T00:00',
      currentDateFormatted: /* フォーマットされた現在日時 */
    },
    axisSettings: {
      yAxisMin: 0,
      yAxisMax: 50 // デフォルト値
    }
  }
  ```

#### 5.2 空のデータ配列
- **目的**: 空のデータ配列の処理を確認する
- **前提条件**: 空の配列
- **入力**: `[]`, `'UTC'`
- **期待される結果**: エラーまたは適切な初期値

#### 5.3 異なる最大値でのY軸設定
- **目的**: 異なる最大値に基づくY軸設定を確認する
- **前提条件**: 高い値を持つデータの配列
- **入力**:
  ```javascript
  [
    { date: '2023-01-01T00:00:00Z', remainingData: '120.5' },
    { date: '2023-01-02T00:00:00Z', remainingData: '150.8' }
  ], 'UTC'
  ```
- **期待される結果**: axisSettings内のyAxisMaxが適切に調整される（例：150または200）

### 6. calculateYAxisRange 関数のテスト

#### 6.1 最大値が閾値未満の場合
- **目的**: 最大値が最初の閾値未満の場合のレンジを確認する
- **前提条件**: 最大値が CONSTANTS.Y_AXIS.DEFAULT_MAX 未満
- **入力**: `30`
- **期待される結果**: `{ yAxisMin: 0, yAxisMax: 50 }`

#### 6.2 最大値が中間閾値の場合
- **目的**: 最大値が中間閾値の場合のレンジを確認する
- **前提条件**: 最大値が中間閾値（CONSTANTS.Y_AXIS.THRESHOLDS[0]以上CONSTANTS.Y_AXIS.THRESHOLDS[1]未満）
- **入力**: `75`
- **期待される結果**: `{ yAxisMin: 0, yAxisMax: 100 }`

#### 6.3 最大値が大きい場合
- **目的**: 大きな最大値の場合のレンジを確認する
- **前提条件**: 最大値が高い閾値（CONSTANTS.Y_AXIS.THRESHOLDS[1]以上）
- **入力**: `120`
- **期待される結果**: `{ yAxisMin: 0, yAxisMax: 150 }`

#### 6.4 最大値が上限を超える場合
- **目的**: 最大値が上限を超える場合のレンジを確認する
- **前提条件**: 最大値が MAX_LIMIT 以上
- **入力**: `600`
- **期待される結果**: `{ yAxisMin: 0, yAxisMax: 500 }`

### 7. fetchDataFromGist 関数のテスト (モックを使用)

#### 7.1 正常なレスポンス
- **目的**: 正常なレスポンスの処理を確認する
- **前提条件**: fetch関数のモック化
- **入力**: 有効なGist URL
- **モックレスポンス**: 
  ```json
  [
    { "date": "2023-01-01T00:00:00Z", "remainingData": "10.5" }
  ]
  ```
- **期待される結果**: モックデータと同じ値が返される

#### 7.2 HTTPエラー
- **目的**: HTTPエラーの処理を確認する
- **前提条件**: fetch関数のモック化（エラーを返す）
- **入力**: 有効なGist URL
- **モックレスポンス**: `{ ok: false, status: 404 }`
- **期待される結果**: エラーがスローされる

#### 7.3 無効なJSONレスポンス
- **目的**: 無効なJSON形式の処理を確認する
- **前提条件**: fetch関数のモック化（無効なJSONを返す）
- **入力**: 有効なGist URL
- **モックレスポンス**: 非配列値（例：`{}`）
- **期待される結果**: エラーがスローされる

### 8. processGitHubActions 関数のテスト

#### 8.1 GitHub Actions環境での処理
- **目的**: GitHub Actions環境での処理を確認する
- **前提条件**: process.env.GITHUB_ACTIONSをtrue、process.env.GITHUB_OUTPUTを設定、fsモジュールのモック化
- **入力**: `[{ date: '2023-01-01T00:00:00Z', remainingData: '10.5' }]`
- **期待される結果**: fs.appendFileSyncが正しいパラメータで呼び出される

#### 8.2 GitHub Actions環境でない場合
- **目的**: GitHub Actions環境でない場合の処理を確認する
- **前提条件**: process.env.GITHUB_ACTIONSを未設定
- **入力**: `[{ date: '2023-01-01T00:00:00Z', remainingData: '10.5' }]`
- **期待される結果**: fs.appendFileSyncが呼び出されない

### 9. generateAndSaveHtml 関数のテスト (部分モック)

#### 9.1 HTMLファイルの生成と保存
- **目的**: HTMLファイルが生成・保存されることを確認する
- **前提条件**: fs.mkdirSyncとfs.writeFileSyncのモック化
- **入力**: 有効なチャートデータ、日付情報など
- **期待される結果**: fs.mkdirSyncとfs.writeFileSyncが正しいパラメータで呼び出される

#### 9.2 HTMLコンテンツの内容検証
- **目的**: 生成されるHTMLコンテンツが正しい内容を含むことを確認する
- **前提条件**: fs.writeFileSyncのモック化とキャプチャ
- **入力**: 特定のテストデータ
- **期待される結果**: HTML内に正しいデータやスクリプトが含まれている

### 10. fetchAndProcessData 関数のテスト（統合テスト）

#### 10.1 正常処理のフロー
- **目的**: fetchAndProcessDataの全体的な処理フローを確認する
- **前提条件**: 各依存関数のモック化（fetchDataFromGist, filterHourlyData, generateAndSaveHtmlなど）
- **入力**: なし（環境変数に依存）
- **期待される結果**: 各モック関数が正しい順序と引数で呼び出される

#### 10.2 エラー処理
- **目的**: エラー発生時の動作を確認する
- **前提条件**: fetchDataFromGistがエラーをスローするようにモック化
- **入力**: なし（環境変数に依存）
- **期待される結果**: コンソールにエラーが出力され、process.exitが呼び出される

## モック化の方針

### ファイルシステム操作のモック
- `fs.mkdirSync`
- `fs.writeFileSync`
- `fs.appendFileSync`
- Jestの`__mocks__/fs.js`を利用

### 外部APIのモック
- `fetch` (node-fetch)
- Jestの`jest.mock('node-fetch')`を利用

### 環境変数のモック
- `process.env`の各プロパティを一時的に設定
- 各テスト後に元の値に戻すか削除

### 日時関連のモック
- `new Date()`
- Jestの`jest.spyOn(global, 'Date')`または`MockDate`ライブラリを利用

## テスト実行方針

1. 各関数の単体テストを独立させる
2. テスト間の相互干渉を避けるため、テスト前後で環境をリセットする
3. モックオブジェクトを使用して外部依存性を制御
4. 統合テストでは全体的な流れを検証
5. テストカバレッジが高くなるように設計（目標: 80%以上）

## 注意点

- テストでは実際のAPIコールやファイル操作を行わないようにする
- 環境変数に依存するテストでは、テスト前後で環境を適切に管理する
- 日時に依存するテストでは固定の日時を使用する
- エラーケースも確実にテストする