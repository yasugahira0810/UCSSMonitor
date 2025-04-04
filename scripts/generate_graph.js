import fs from 'fs';
import fetch from 'node-fetch';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

// モジュールパスの設定
const __dirname = dirname(fileURLToPath(import.meta.url));

// 定数定義
const CONSTANTS = {
    OUTPUT_PATH: './docs/index.html',
    DOCS_DIR: './docs',
    Y_AXIS: {
        DEFAULT_MIN: 0,
        DEFAULT_MAX: 50,
        MIN_LIMIT: 0,
        MAX_LIMIT: 500,
        THRESHOLDS: [50, 100]
    }
};

// Ensure the minimum value doesn't go below MIN_LIMIT
function enforceMinLimit(value) {
    return Math.max(value, CONSTANTS.Y_AXIS.MIN_LIMIT);
}

// タイムゾーンマッピング
const TIMEZONE_MAP = {
  'Asia/Tokyo': 'JST (UTC+9)',
  'Asia/Shanghai': 'CST (UTC+8)',
  'America/New_York': 'EST (UTC-5)',
  'America/Los_Angeles': 'PST (UTC-8)',
  'Europe/London': 'GMT (UTC+0)',
  'Europe/Paris': 'CET (UTC+1)'
};

// データ取得と処理の主要関数
async function fetchAndProcessData() {
  try {
    // Gistからデータを取得
    const gistUrl = `https://gist.github.com/${process.env.GIST_USER}/${process.env.GIST_ID}`;
    console.log(`Fetching Gist data from: ${gistUrl}`);
    const data = await fetchDataFromGist(gistUrl);
    
    // GitHub Actionsのための処理
    processGitHubActions(data);
    
    // データの前処理
    const filteredData = filterHourlyData(data);
    console.log(`Filtered to ${filteredData.length} data points (approx. hourly)`);
    
    // タイムゾーン情報の取得
    const { timezone, timezoneDisplay } = getTimezoneInfo();
    console.log(`Using timezone: ${timezone} (Display: ${timezoneDisplay})`);
    
    // グラフ描画のためにデータを準備
    const { chartData, dateInfo, axisSettings } = prepareChartData(filteredData, timezone);
    
    // HTMLコンテンツの作成と保存
    generateAndSaveHtml(chartData, dateInfo, axisSettings, filteredData, timezone, timezoneDisplay);
  } catch (error) {
    console.error('Error occurred:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Gistからデータを取得
async function fetchDataFromGist(gistUrl) {
  const response = await fetch(`${gistUrl}/raw/data.json`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const dataContent = await response.json();
  if (!Array.isArray(dataContent)) {
    throw new Error('Invalid data format: expected an array');
  }
  
  console.log(`Retrieved ${dataContent.length} data points from the gist`);
  return dataContent;
}

// GitHub Actionsのための処理
function processGitHubActions(data) {
  if (process.env.GITHUB_ACTIONS) {
    const latestData = data[data.length - 1];
    const remainingValue = parseFloat(latestData.remainingData).toFixed(1);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `remainingData=${remainingValue}\n`);
  }
}

// 1時間ごとにデータをフィルタリング
function filterHourlyData(data) {
  const filteredData = [];
  let lastHour = null;
  
  data.forEach(item => {
    const date = new Date(item.date);
    const currentHour = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
    
    // 新しい時間またはデータの先頭の場合
    if (currentHour !== lastHour) {
      filteredData.push(item);
      lastHour = currentHour;
    }
  });
  
  return filteredData;
}

// タイムゾーン情報の取得
function getTimezoneInfo() {
  let timezone = 'UTC';
  let timezoneDisplay = 'UTC+0';
  
  if (process.env.UTC_OFFSET) {
    if (/^[+-]\d+$/.test(process.env.UTC_OFFSET)) {
      // 数値オフセットの場合
      const offset = parseInt(process.env.UTC_OFFSET);
      const offsetHours = Math.abs(offset);
      const offsetSign = offset >= 0 ? '+' : '-';
      
      timezoneDisplay = `UTC${offsetSign}${offsetHours}`;
      timezone = `Etc/GMT${offset >= 0 ? '-' : '+'}${offsetHours}`;
    } else {
      // 名前付きタイムゾーンの場合
      timezone = process.env.UTC_OFFSET;
      timezoneDisplay = TIMEZONE_MAP[timezone] || timezone;
    }
  }
  
  return { timezone, timezoneDisplay };
}

// 日付のフォーマット関数
function formatDate(dateString, timezone) {
  const date = new Date(dateString);
  return date.toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone
  });
}

// YYYY-MM-DDThh:mm形式へのフォーマット関数
function formatDateForInput(date, timezone) {
  const dateInTimezone = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  
  const year = dateInTimezone.getFullYear();
  const month = String(dateInTimezone.getMonth() + 1).padStart(2, '0');
  const day = String(dateInTimezone.getDate()).padStart(2, '0');
  const hour = String(dateInTimezone.getHours()).padStart(2, '0');
  const minute = String(dateInTimezone.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

// グラフデータの準備
function prepareChartData(filteredData, timezone) {
  // 時間スケール用データの準備
  const chartData = filteredData.map(item => ({
    x: new Date(item.date).getTime(),
    y: parseFloat(item.remainingData)
  }));
  
  // Y軸設定の計算
  const values = filteredData.map(item => parseFloat(item.remainingData));
  const maxValue = Math.max(...values);
  const yAxisSettings = calculateYAxisRange(maxValue);
  
  // 時間範囲の設定
  const firstDataPoint = filteredData[0];
  const lastDataPoint = filteredData[filteredData.length - 1];
  const firstDate = new Date(firstDataPoint.date);
  const lastDate = new Date(lastDataPoint.date);
  const currentDate = new Date();
  
  const dateInfo = {
    firstDate,
    lastDate,
    currentDate,
    firstDateFormatted: formatDateForInput(firstDate, timezone),
    lastDateFormatted: formatDateForInput(lastDate, timezone),
    currentDateFormatted: formatDateForInput(currentDate, timezone)
  };
  
  return {
    chartData,
    dateInfo,
    axisSettings: yAxisSettings
  };
}

// Y軸の範囲を計算
function calculateYAxisRange(maxValue) {
  let yAxisMax;
  
  if (maxValue < CONSTANTS.Y_AXIS.DEFAULT_MAX) {
    yAxisMax = CONSTANTS.Y_AXIS.DEFAULT_MAX;
  } else if (maxValue < CONSTANTS.Y_AXIS.THRESHOLDS[1]) {
    yAxisMax = CONSTANTS.Y_AXIS.THRESHOLDS[1];
  } else {
    yAxisMax = Math.ceil(maxValue / 50) * 50;
  }
  
  // Ensure the maximum value doesn't exceed the MAX_LIMIT
  yAxisMax = Math.min(yAxisMax, CONSTANTS.Y_AXIS.MAX_LIMIT);
  
  return {
    yAxisMin: CONSTANTS.Y_AXIS.DEFAULT_MIN,
    yAxisMax
  };
}

// HTMLファイルの生成と保存
function generateAndSaveHtml(chartData, dateInfo, axisSettings, filteredData, timezone, timezoneDisplay) {
  const { firstDate, lastDate, currentDate, firstDateFormatted, currentDateFormatted } = dateInfo;
  const { yAxisMin, yAxisMax } = axisSettings;
  
const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UCSS Monitor Chart</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns"></script>
    <style>
            /* Styles omitted for brevity */
    </style>
</head>
<body>
    <h1 style="text-align: center;">UCSS Monitor</h1>
    
    <div class="chart-container">
            <canvas id="myChart"></canvas>
    </div>
    
    <div class="updated-time">
            最終更新: ${new Date().toLocaleString('ja-JP', { timeZone: timezone })}
            (データポイント数: ${filteredData.length})
    </div>
    <div class="timezone-info">
            タイムゾーン: ${timezoneDisplay}
    </div>
    
    <div class="controls-container">
            <div class="control-group">
                    <h3>縦軸の設定</h3>
                    <div class="control-item">
                            <label for="y-axis-range">データ量範囲</label>
                            <div class="dual-slider-container">
                                    <div class="range-track"></div>
                                    <div id="range-selected" class="range-selected"></div>
                                    <input type="range" id="y-min-range" class="dual-slider" min="${CONSTANTS.Y_AXIS.DEFAULT_MIN}" max="${CONSTANTS.Y_AXIS.MAX_LIMIT}" step="5" value="${yAxisMin}">
                                    <input type="range" id="y-max-range" class="dual-slider" min="${CONSTANTS.Y_AXIS.DEFAULT_MIN}" max="${CONSTANTS.Y_AXIS.MAX_LIMIT}" step="5" value="${yAxisMax}">
                            </div>
                            <div class="range-values">
                                    <span>${CONSTANTS.Y_AXIS.DEFAULT_MIN}</span>
                                    <span>${CONSTANTS.Y_AXIS.MAX_LIMIT}</span>
                            </div>
                            <div class="y-axis-inputs">
                                    <div class="y-axis-input-group">
                                            <label for="y-min-input">最小値:</label>
                                            <input type="number" id="y-min-input" min="${CONSTANTS.Y_AXIS.DEFAULT_MIN}" max="${CONSTANTS.Y_AXIS.MAX_LIMIT}" step="5" value="${yAxisMin}">
                                    </div>
                                    <div class="y-axis-input-group">
                                            <label for="y-max-input">最大値:</label>
                                            <input type="number" id="y-max-input" min="${CONSTANTS.Y_AXIS.DEFAULT_MIN}" max="${CONSTANTS.Y_AXIS.MAX_LIMIT}" step="5" value="${yAxisMax}">
                                    </div>
                            </div>
                    </div>
            </div>
            
            <div class="control-group">
                    <h3>横軸の設定</h3>
                    <div class="datetime-controls">
                            <div class="datetime-control-item">
                                    <label for="x-min">開始日時 (${timezoneDisplay})</label>
                                    <input type="datetime-local" id="x-min" value="${firstDateFormatted}" min="${firstDateFormatted}" max="${currentDateFormatted}">
                            </div>
                            <div class="datetime-control-item">
                                    <label for="x-max">終了日時 (${timezoneDisplay})</label>
                                    <input type="datetime-local" id="x-max" value="${currentDateFormatted}" min="${firstDateFormatted}" max="${currentDateFormatted}">
                            </div>
                    </div>
            </div>
            
            <div class="buttons-group">
                    <button id="apply-settings">設定を適用</button>
                    <button id="reset-settings">リセット</button>
            </div>
    </div>
    
    <script>
            let myChart;
            const ctx = document.getElementById('myChart').getContext('2d');
            const chartData = ${JSON.stringify(chartData)};
            const timezone = '${timezone}';
            const timezoneDisplay = '${timezoneDisplay}';
            
            // 最初のデータポイントと現在の日時のタイムスタンプ
            const firstTimestamp = ${firstDate.getTime()};
            const lastTimestamp = ${lastDate.getTime()};
            const currentTimestamp = ${currentDate.getTime()};
            
            // スケール設定の初期値
            let chartSettings = {
                    yMin: ${yAxisMin},
                    yMax: ${yAxisMax},
                    xMin: firstTimestamp,
                    xMax: currentTimestamp
            };
            // 定数値
            const Y_AXIS_MIN_LIMIT = ${CONSTANTS.Y_AXIS.DEFAULT_MIN};
            const Y_AXIS_MAX_LIMIT = ${CONSTANTS.Y_AXIS.MAX_LIMIT};
            
            // グラフの初期化関数
            function initChart(settings) {
                    if (myChart) {
                            myChart.destroy();
                    }
                    
                    myChart = new Chart(ctx, {
                            type: 'line',
                            data: {
                                    datasets: [
                                            {
                                                    label: '残りデータ量 (GB)',
                                                    data: chartData,
                                                    borderColor: 'rgba(75, 192, 192, 1)',
                                                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                                                    borderWidth: 2,
                                                    tension: 0.1,
                                                    fill: true,
                                                    pointRadius: 3,
                                                    pointHoverRadius: 5
                                            }
                                    ]
                            },
                            options: {
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                            legend: {
                                                    position: 'top',
                                            },
                                            title: {
                                                    display: false,
                                            },
                                            tooltip: {
                                                    callbacks: {
                                                            label: function(context) {
                                                                    return "残りデータ量: " + context.parsed.y.toFixed(2) + " GB";
                                                            },
                                                            title: function(tooltipItems) {
                                                                    const date = new Date(tooltipItems[0].parsed.x);
                                                                    return date.toLocaleString('ja-JP', {
                                                                            year: 'numeric',
                                                                            month: 'numeric',
                                                                            day: 'numeric',
                                                                            hour: '2-digit',
                                                                            minute: '2-digit',
                                                                            timeZone: timezone
                                                                    });
                                                            }
                                                    }
                                            }
                                    },
                                    scales: {
                                            y: {
                                                    min: settings.yMin,
                                                    max: settings.yMax,
                                                    title: {
                                                            display: true,
                                                            text: '残りデータ量 (GB)'
                                                    },
                                                    ticks: {
                                                            callback: function(value) {
                                                                    return value.toFixed(1);
                                                            }
                                                    }
                                            },
                                            x: {
                                                    type: 'time',
                                                    min: settings.xMin,
                                                    max: settings.xMax,
                                                    time: {
                                                            unit: 'hour',
                                                            displayFormats: {
                                                                    hour: 'MM/dd HH:mm'
                                                            },
                                                            tooltipFormat: 'yyyy/MM/dd HH:mm'
                                                    },
                                                    title: {
                                                            display: true,
                                                            text: 'Date/Time (' + timezoneDisplay + ')'
                                                    },
                                                    ticks: {
                                                            maxRotation: 45,
                                                            minRotation: 45
                                                    },
                                                    adapters: {
                                                            date: {
                                                                    zone: timezone
                                                            }
                                                    }
                                            }
                                    }
                            }
                    });
            }
            
            // スライダーのレンジビジュアルを更新する
            function updateSelectedRange() {
                    const minRange = document.getElementById('y-min-range');
                    const maxRange = document.getElementById('y-max-range');
                    const selectedRange = document.getElementById('range-selected');
                    
                    const rangeMax = parseInt(minRange.max);
                    const minVal = parseInt(minRange.value);
                    const maxVal = parseInt(maxRange.value);
                    
                    // パーセンテージを計算して選択範囲のスタイルを設定
                    const minPercent = (minVal / rangeMax) * 100;
                    const maxPercent = (maxVal / rangeMax) * 100;
                    
                    selectedRange.style.left = minPercent + '%';
                    selectedRange.style.width = (maxPercent - minPercent) + '%';
            }
            
            // UIイベントリスナー設定
            function setupEventListeners() {
                    const xMin = document.getElementById('x-min');
                    const xMax = document.getElementById('x-max');
                    const yMinRange = document.getElementById('y-min-range');
                    const yMaxRange = document.getElementById('y-max-range');
                    const yMinInput = document.getElementById('y-min-input');
                    const yMaxInput = document.getElementById('y-max-input');
                    const applyButton = document.getElementById('apply-settings');
                    const resetButton = document.getElementById('reset-settings');
                    
                    // Y軸の最小値スライダーの更新時
                    yMinRange.addEventListener('input', function() {
                            const minValue = parseInt(this.value);
                            const maxValue = parseInt(yMaxRange.value);
                            
                            // 最小値が最大値を超えないようにする
                            if (minValue >= maxValue) {
                                    this.value = maxValue - 5;
                            }
                            
                            // 設定を更新
                            chartSettings.yMin = parseInt(this.value);
                            yMinInput.value = this.value;
                            updateSelectedRange();
                    });
                    
                    // Y軸の最大値スライダーの更新時
                    yMaxRange.addEventListener('input', function() {
                            const minValue = parseInt(yMinRange.value);
                            const maxValue = parseInt(this.value);
                            
                            // 最大値が最小値より小さくならないようにする
                            if (maxValue <= minValue) {
                                    this.value = minValue + 5;
                            }
                            
                            // 設定を更新
                            chartSettings.yMax = parseInt(this.value);
                            yMaxInput.value = this.value;
                            updateSelectedRange();
                    });
                    
                    // Y軸の最小値入力フィールドの更新時
                    yMinInput.addEventListener('input', function() {
                            const minValue = parseInt(this.value);
                            const maxValue = parseInt(yMaxInput.value);
                            
                            // 空の入力や不正な値の場合は処理しない
                            if (isNaN(minValue)) return;
                            
                            let validValue = minValue;
                            
                            // 最小値と最大値の制約
                            if (validValue < Y_AXIS_MIN_LIMIT) validValue = Y_AXIS_MIN_LIMIT;
                            if (validValue > Y_AXIS_MAX_LIMIT) validValue = Y_AXIS_MAX_LIMIT;
                            
                            // 最小値が最大値を超えないようにする
                            if (validValue >= maxValue) {
                                    validValue = maxValue - 5;
                            }
                            
                            // 有効な値に更新
                            this.value = validValue;
                            chartSettings.yMin = validValue;
                            
                            // スライダーも更新
                            yMinRange.value = validValue;
                            updateSelectedRange();
                    });
                    
                    // Y軸の最大値入力フィールドの更新時
                    yMaxInput.addEventListener('input', function() {
                            const minValue = parseInt(yMinInput.value);
                            const maxValue = parseInt(this.value);
                            
                            // 空の入力や不正な値の場合は処理しない
                            if (isNaN(maxValue)) return;
                            
                            let validValue = maxValue;
                            
                            // 最小値と最大値の制約
                            if (validValue < Y_AXIS_MIN_LIMIT) validValue = Y_AXIS_MIN_LIMIT;
                            if (validValue > Y_AXIS_MAX_LIMIT) validValue = Y_AXIS_MAX_LIMIT;
                            
                            // 最大値が最小値を下回らないようにする
                            if (validValue <= minValue) {
                                    validValue = minValue + 5; // 最小でも5の差をつける
                            }
                            
                            // 有効な値に更新
                            this.value = validValue;
                            chartSettings.yMax = validValue;
                            
                            // スライダーも更新
                            yMaxRange.value = validValue;
                            updateSelectedRange();
                    });
                    
                    // 設定適用ボタン
                    applyButton.addEventListener('click', function() {
                            // 日時入力から新しい値を取得
                            const xMinDate = new Date(xMin.value);
                            const xMaxDate = new Date(xMax.value);
                            
                            // タイムスタンプを設定
                            chartSettings.xMin = xMinDate.getTime();
                            chartSettings.xMax = xMaxDate.getTime();
                            
                            // 入力値の検証
                            if (chartSettings.xMin >= chartSettings.xMax) {
                                    alert('開始日時は終了日時より前にしてください');
                                    return;
                            }
                            
                            if (chartSettings.yMin >= chartSettings.yMax) {
                                    alert('Y軸の最小値は最大値より小さくしてください');
                                    return;
                            }
                            
                            // グラフを更新
                            initChart(chartSettings);
                    });
                    
                    // リセットボタン
                    resetButton.addEventListener('click', function() {
                            // 入力フィールドをリセット
                            xMin.value = '${firstDateFormatted}';
                            xMax.value = '${currentDateFormatted}';
                            yMinRange.value = Y_AXIS_MIN_LIMIT;
                            yMaxRange.value = Y_AXIS_DEFAULT_MAX;
                            yMinInput.value = Y_AXIS_MIN_LIMIT;
                            yMaxInput.value = Y_AXIS_DEFAULT_MAX;
                            
                            // 設定をリセット
                            chartSettings = {
                                    yMin: Y_AXIS_MIN_LIMIT,
                                    yMax: Y_AXIS_DEFAULT_MAX,
                                    xMin: firstTimestamp,
                                    xMax: currentTimestamp
                            };
                            
                            // 選択範囲とグラフを更新
                            updateSelectedRange();
                            initChart(chartSettings);
                    });
                    
                    // 初期化時にも選択範囲を表示
                    updateSelectedRange();
            }
            
            // DOMロード時の初期化
            document.addEventListener('DOMContentLoaded', function() {
                    setupEventListeners();
                    initChart(chartSettings);
            });
    </script>
</body>
</html>`;
  // ディレクトリの作成とファイル保存
  fs.mkdirSync(CONSTANTS.DOCS_DIR, { recursive: true });
  fs.writeFileSync(CONSTANTS.OUTPUT_PATH, htmlContent);
  console.log('Chart HTML generated successfully at:', CONSTANTS.OUTPUT_PATH);
  console.log(`Generated chart with ${chartData.length} data points`);
}

// メイン処理の実行
fetchAndProcessData();