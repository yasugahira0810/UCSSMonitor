# update_gist.js テスト仕様書

## 概要
この文書では、`update_gist.js`スクリプトに対するユニットテストの仕様を詳細に記述しています。テストはJestフレームワークを使用して実施され、各関数の入力と出力、エラー処理、および境界値ケースをカバーします。

## テスト仕様ID一覧
- TS-01: updateGist関数のテスト
  - TC-01-01: 新しいデータでGistを正常に更新できること
  - TC-01-02: エラーが発生した場合でも例外をスローせずに処理すること
- TS-02: fetchGistData関数のテスト
  - TC-02-01: Gistから既存データを正常に取得・解析できること
  - TC-02-02: Gistにファイルが見つからない場合にエラーをスローすること
  - TC-02-03: Gistの内容が有効なJSONでない場合にエラーをスローすること
- TS-03: saveGistData関数のテスト
  - TC-03-01: 更新したデータをGistに正常に保存できること
- TS-04: generateFiles関数のテスト
  - TC-04-01: ディレクトリが存在しない場合にHTMLファイルを正常に生成できること
  - TC-04-02: ディレクトリが既に存在する場合にHTMLファイルのみを生成すること

## テスト環境と前提条件

### 依存関係
- Jest テストフレームワーク
- ES Modules対応の設定
- Mockモジュール：
  - fs
  - path
  - @octokit/rest

### 環境変数
- GIST_ID (GitHubのGist識別子)
- GIST_USER (GitHubユーザー名)
- GH_PAT (GitHub Personal Access Token)
- REMAINING_DATA (残りデータ通信量)

## テストケース

### TS-01: updateGist関数のテスト

#### TC-01-01: 新しいデータでGistを正常に更新できること
- **目的**: `updateGist`関数が既存のGistデータを取得し、新しいエントリを追加して、更新ができることを確認する
- **前提条件**:
  - 環境変数：GIST_ID, GH_PATが設定されていること
  - `REMAINING_DATA`が`50.5`に設定されていること
  - モックされた`Octokit`が使用可能であること
- **入力**:
  - なし（関数は環境変数から値を取得）
- **Mockデータ**:
  - 既存Gistデータ: `[{ date: '2023-01-01T00:00:00.000Z', remainingData: 100 }]`
- **期待される結果**:
  - `mockGistGet`が`{ gist_id: process.env.GIST_ID }`で呼び出されること
  - `mockGistUpdate`が、正しいgist_idとdata.jsonファイルエントリを含むオブジェクトで呼び出されること

#### TC-01-02: エラーが発生した場合でも例外をスローせずに処理すること
- **目的**: `updateGist`関数がエラー発生時に正常にエラーをハンドリングし、実行を続行できることを確認する
- **前提条件**:
  - 環境変数が設定されていること
  - `mockGistGet`が例外をスローするようにモックされていること
- **入力**:
  - なし
- **Mockデータ**:
  - `mockGistGet`が`'Failed to fetch Gist'`エラーをスローするよう設定
- **期待される結果**:
  - 関数が例外をスローせずに実行を完了すること

### TS-02: fetchGistData関数のテスト

#### TC-02-01: Gistから既存データを正常に取得・解析できること
- **目的**: `fetchGistData`関数が指定されたGistから正常にデータを取得し、JSONとして解析できることを確認する
- **前提条件**:
  - 環境変数：GIST_IDが設定されていること
  - `mockOctokit`が使用可能であること
- **入力**:
  - `mockOctokit`オブジェクト
- **Mockデータ**:
  - `mockGistGet`が`{ data: { files: { 'data.json': { content: JSON.stringify(mockData) } } } }`を返すよう設定
  - `mockData`: `[{ date: '2023-01-01T00:00:00.000Z', remainingData: 100 }]`
- **期待される結果**:
  - 関数が`mockData`と等しいデータを返すこと
  - `mockGistGet`が`{ gist_id: process.env.GIST_ID }`で呼び出されること

#### TC-02-02: Gistにファイルが見つからない場合にエラーをスローすること
- **目的**: `fetchGistData`関数がGistにファイルが存在しない場合に適切なエラーをスローすることを確認する
- **前提条件**:
  - 環境変数：GIST_IDが設定されていること
  - `mockOctokit`が使用可能であること
- **入力**:
  - `mockOctokit`オブジェクト
- **Mockデータ**:
  - `mockGistGet`が`{ data: { files: {} } }`を返すよう設定
- **期待される結果**:
  - 関数が「No files found in the Gist」というエラーメッセージを含む例外をスローすること

#### TC-02-03: Gistの内容が有効なJSONでない場合にエラーをスローすること
- **目的**: `fetchGistData`関数がGistの内容が無効なJSONの場合に適切なエラーをスローすることを確認する
- **前提条件**:
  - 環境変数：GIST_IDが設定されていること
  - `mockOctokit`が使用可能であること
- **入力**:
  - `mockOctokit`オブジェクト
- **Mockデータ**:
  - `mockGistGet`が`{ data: { files: { 'data.json': { content: 'invalid-json' } } } }`を返すよう設定
- **期待される結果**:
  - 関数が「Failed to parse Gist content as JSON」というエラーメッセージを含む例外をスローすること

### TS-03: saveGistData関数のテスト

#### TC-03-01: 更新したデータをGistに正常に保存できること
- **目的**: `saveGistData`関数が更新されたデータをGistに正しく保存できることを確認する
- **前提条件**:
  - 環境変数：GIST_IDが設定されていること
  - `mockOctokit`が使用可能であること
- **入力**:
  - `mockOctokit`オブジェクト
  - `mockUpdatedData`: `[{ date: '2023-01-01T00:00:00.000Z', remainingData: 50 }]`
- **Mockデータ**:
  - `mockGistUpdate`が成功応答を返すよう設定
- **期待される結果**:
  - `mockGistUpdate`が以下の正確なパラメータで呼び出されること:
    ```javascript
    {
        gist_id: process.env.GIST_ID,
        files: {
            'data.json': {
                content: JSON.stringify(mockUpdatedData, null, 2),
            },
        },
    }
    ```

### TS-04: generateFiles関数のテスト

#### TC-04-01: ディレクトリが存在しない場合にHTMLファイルを正常に生成できること
- **目的**: `generateFiles`関数がディレクトリを作成し、必要なHTMLファイルを生成できることを確認する
- **前提条件**:
  - `mockExistSync`、`mockMkdirSync`、`mockWriteFileSync`がモックされていること
- **入力**:
  - なし
- **Mockデータ**:
  - `mockExistSync`が`false`を返すよう設定（ディレクトリが存在しない）
- **期待される結果**:
  - `mockExistSync`が`'docs'`で呼び出されること
  - `mockMkdirSync`が`'docs'`で呼び出されること
  - `mockWriteFileSync`が`'docs/chart.html'`と、`<title>Chart</title>`を含むコンテンツで呼び出されること
  - `mockWriteFileSync`が`'docs/index.html'`と、`<title>Index</title>`を含むコンテンツで呼び出されること

#### TC-04-02: ディレクトリが既に存在する場合にHTMLファイルのみを生成すること
- **目的**: `generateFiles`関数が既存のディレクトリを再作成せず、HTMLファイルのみを生成できることを確認する
- **前提条件**:
  - `mockExistSync`、`mockMkdirSync`、`mockWriteFileSync`がモックされていること
- **入力**:
  - なし
- **Mockデータ**:
  - `mockExistSync`が`true`を返すよう設定（ディレクトリが既に存在する）
- **期待される結果**:
  - `mockMkdirSync`が呼び出されないこと（ディレクトリは既に存在する）
  - HTMLファイルは通常通り生成されること

## モック設計

### fsモジュールモック
- `existsSync`: ディレクトリやファイルの存在確認用
- `mkdirSync`: ディレクトリ作成用
- `writeFileSync`: ファイル書き込み用

### pathモジュールモック
- `join`: パス結合用、`(...parts) => parts.join('/')`として実装

### @octokit/restモジュールモック
- `Octokit`: 認証済みGitHub APIクライアント
  - `gists.get`: Gistデータ取得用
  - `gists.update`: Gistデータ更新用

## テスト準備と後処理

### 各テスト前の準備
- 全てのモックをクリア
- 環境変数をテスト用に設定：`REMAINING_DATA: '50.5'`

## テスト実行方法
```bash
npm test -- update_gist.test.js
```
または
```bash
npx jest update_gist.test.js
```

## 補足事項
- 日付を含むテストでは、日付文字列の正確な一致を期待するのではなく、`expect.any(String)`や部分的な構造チェックを使用して柔軟性を持たせています。
- エラーハンドリングテストでは、関数が例外をスローせずに正常に実行を完了することを期待しています。