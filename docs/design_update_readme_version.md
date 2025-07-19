# UCSSMonitor バージョンバッジ自動更新設計

## 概要
GitHubリリースタグ作成時、README.mdのバージョンバッジを自動で最新タグに書き換え、コミット・プッシュするGitHub Actionsワークフローを追加する。

## 処理フロー
1. releaseイベントまたはworkflow_dispatchで起動
2. 最新リリースタグ（例: v0.3.0）を取得
3. README.md内のバージョンバッジ部分（`version-vX.Y.Z`）を最新タグに置換
4. 変更をコミット＆プッシュ

## 仕様
- 対象ファイル: README.md
- バージョンバッジの形式:  
  `[![Version](https://img.shields.io/badge/version-vX.Y.Z-blue.svg)]`
- コミットメッセージ:  
  `Update version badge in README.md to {latest_tag} [skip ci]`
- mainブランチへ直接プッシュ

## 関連ドキュメント
- docs/design.md
- docs/class.md
- docs/design_update_readme_version.md

---

【TODO】
- docs/design_update_readme_version.md の仕様追記
- ワークフローYAML新規作成
- バージョン置換スクリプト新規作成
- テスト仕様追記

# バージョンバッジ自動更新ワークフロー設計追記

## ワークフローYAML例
.github/workflows/update_readme_version.yml を新規作成し、以下の内容とする。

```yaml
name: Update README Version Badge

on:
  push:
    branches:
      - main
  release:
    types: [published]
  workflow_dispatch:

jobs:
  update-readme-version:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v3

      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Get latest tag
        id: get_tag
        run: |
          echo "tag=$(git describe --tags --abbrev=0)" >> $GITHUB_OUTPUT

      - name: Update README version badge
        run: node scripts/update_readme_version.js ${{ steps.get_tag.outputs.tag }}

      - name: Commit and push changes
        run: |
          git config --global user.name "github-actions"
          git config --global user.email "actions@github.com"
          git add README.md
          git commit -m "Update version badge in README.md to ${{ steps.get_tag.outputs.tag }} [skip ci]" || echo "No changes to commit"
          git push origin HEAD:main
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## バージョン置換スクリプト仕様
- scripts/update_readme_version.js を新規作成
- コマンドライン引数でタグ名（例: v0.3.0）を受け取る
- README.md内のバージョンバッジ部分を該当タグに置換する
- 置換対象: `[![Version](https://img.shields.io/badge/version-vX.Y.Z-blue.svg)]`
- 置換後: `[![Version](https://img.shields.io/badge/version-{TAG}-blue.svg)]`

---

# update_readme_version.js テスト仕様

## 概要
README.mdのバージョンバッジ自動更新スクリプト（scripts/update_readme_version.js）のテスト仕様を記載する。

## テスト観点
- 正常系
  - README.mdに既存のバージョンバッジが存在する場合、指定したタグで正しく置換されること
- 異常系
  - README.mdにバージョンバッジが存在しない場合、エラー終了すること
  - コマンドライン引数が不足している場合、エラー終了すること

## テストケース
| No | 前提ファイル内容 | 入力タグ | 期待結果 |
|----|------------------|----------|----------|
| 1  | [![Version](https://img.shields.io/badge/version-v0.2.0-blue.svg)] ... | v0.3.0 | バッジがv0.3.0に置換される |
| 2  | バージョンバッジなし | v0.3.0 | エラー終了（exit 1） |
| 3  | [![Version](https://img.shields.io/badge/version-v0.2.0-blue.svg)] ... | （引数なし） | エラー終了（exit 1） |

## テスト手順
1. テスト用READMEファイルを用意する（例: scripts/__mocks__/README_test.md）
2. スクリプトをテスト用ファイルに対して実行し、出力・終了コードを検証する
3. 必要に応じてjest等で自動テスト化する

## テスト時のエラー終了仕様
- テスト実行時（Jest等でrequireされた場合）は、エラー終了時にprocess.exit(1)の代わりにErrorをthrowすること。
- 本番実行時（nodeコマンドで直接実行）は従来通りprocess.exit(1)で終了する。
- これにより、テストコードのtoThrow()アサーションが正しく動作する。

---

# update_readme_version.js テスト仕様（testファイル設計）

- scripts/update_readme_version.test.js を新規作成し、jestで上記テストケースを自動化する
- fsモジュールは__mocks__でモック化し、ファイル操作を安全に行う

# 追記: pushイベント対応

## 追加仕様
- pushイベント（mainブランチ）でもワークフローを発火させる。
- push時は、mainブランチへのpushのみ対象とする。
- 最新タグ（git describe --tags --abbrev=0）を取得し、README.mdのバージョンバッジを常にそのタグに更新する。
- 既に最新タグと一致していれば何もしない。
- README.mdが更新された場合のみコミット＆プッシュする。

## ワークフローYAML例（push対応）
```yaml
name: Update README Version Badge

on:
  push:
    branches:
      - main
  release:
    types: [published]
  workflow_dispatch:

jobs:
  update-readme-version:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v3

      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Get latest tag
        id: get_tag
        run: |
          echo "tag=$(git describe --tags --abbrev=0)" >> $GITHUB_OUTPUT

      - name: Update README version badge
        run: node scripts/update_readme_version.js ${{ steps.get_tag.outputs.tag }}

      - name: Commit and push changes
        run: |
          git config --global user.name "github-actions"
          git config --global user.email "actions@github.com"
          git add README.md
          git commit -m "Update version badge in README.md to ${{ steps.get_tag.outputs.tag }} [skip ci]" || echo "No changes to commit"
          git push origin HEAD:main
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## タグが存在しない場合の対応
- リポジトリにタグが1つも存在しない場合、`git describe --tags --abbrev=0` はエラーとなる。
- この場合、ワークフローは空文字ではなくデフォルト値（例: `v0.0.0`）を `tag` にセットし、以降の処理を継続すること。
- これにより、初回リリース前やタグ未作成時でもREADMEバージョンバッジ更新処理がエラーで停止しない。
