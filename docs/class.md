# UCSSMonitorのクラス図

```mermaid
classDiagram
    %% メインクラス
    class ScraperModule {
        -SELECTORS: Object
        -TIMEOUT: Object
        -URLS: Object
        +logErrorDetails(page, errorMessage): void
        +waitForSelector(page, selector, timeoutMs, errorMessage): Promise
        +isLoggedIn(page): Promise~boolean~
        +login(page, email, password): Promise~void~
        +waitForPostLoginElements(page): Promise~void~
        +getRemainingData(page): Promise~string~
    }

    class UpdateGistModule {
        +updateGist(): Promise~void~
        +fetchGistData(octokit): Promise~Array~
        +saveGistData(octokit, updatedData): Promise~void~
        +generateFiles(): void
    }

    class GenerateGraphModule {
        -CONSTANTS: Object
        -TIMEZONE_MAP: Object
        +fetchAndProcessData(): Promise~void~
        +fetchDataFromGist(gistUrl): Promise~Array~
        +processGitHubActions(data): void
        +filterHourlyData(data): Array
        +getTimezoneInfo(): Object
        +formatDate(dateString, timezone): String
        +formatDateForInput(date, timezone): String
        +prepareChartData(filteredData, timezone): Object
        +calculateYAxisRange(maxValue): Object
        +generateAndSaveHtml(chartData, guidelineData, dateInfo, axisSettings, filteredData, timezone, timezoneDisplay, hasDataIncrease): void
    }

    %% 依存関係
    class Puppeteer {
        <<external>>
    }

    class OctokitREST {
        <<external>>
    }

    class ChartJS {
        <<external>>
    }

    class FileSystem {
        <<external>>
    }

    class NodeFetch {
        <<external>>
    }

    %% 関連クラス
    class GitHubGist {
        <<external>>
        -gistId: String
        -gistUser: String
        -accessToken: String
        +getData(): Object
        +updateData(content): void
    }

    class UCSSWebsite {
        <<external>>
        +login(email, password): void
        +getRemainingData(): String
    }

    %% 関連付け
    ScraperModule ..> Puppeteer : uses
    ScraperModule ..> UCSSWebsite : interacts with
    ScraperModule ..> FileSystem : uses for logging
    
    UpdateGistModule ..> OctokitREST : uses
    UpdateGistModule ..> GitHubGist : interacts with
    UpdateGistModule ..> FileSystem : uses for file generation
    
    GenerateGraphModule ..> NodeFetch : uses
    GenerateGraphModule ..> GitHubGist : fetches data from
    GenerateGraphModule ..> ChartJS : generates chart with
    GenerateGraphModule ..> FileSystem : generates HTML file

    %% データクラス
    class DataPoint {
        +date: String
        +remainingData: String
    }

    class ChartData {
        +timestamps: Array
        +values: Array
        +labels: Array
    }

    UpdateGistModule ..> DataPoint : creates
    GenerateGraphModule ..> DataPoint : processes
    GenerateGraphModule ..> ChartData : generates
```

## クラス説明

### ScraperModule (scraper.js)
Puppeteerを使用してUCSSウェブサイトにログインし、残りのデータ通信量を取得します。

### UpdateGistModule (update_gist.js)
OctokitライブラリでGitHubのGistにデータを保存します。ScraperModuleから取得したデータを時系列で記録します。

### GenerateGraphModule (generate_graph.js)
GitHubのGistからデータを取得し、Chart.jsを使用してインタラクティブな使用量グラフを生成します。

### 外部依存関係
- **Puppeteer**: ヘッドレスブラウザ制御ライブラリ
- **OctokitREST**: GitHub API クライアントライブラリ
- **ChartJS**: グラフ描画ライブラリ
- **FileSystem**: ファイル操作用Node.js組み込みモジュール
- **NodeFetch**: HTTPリクエスト用ライブラリ

### データモデル
- **DataPoint**: 日付と残りデータ量のペア
- **ChartData**: グラフ描画用のデータ構造