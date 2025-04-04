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
    DEFAULT_MAX: 100,
    MAX_LIMIT: 500,
    THRESHOLDS: [50, 100]
  }
};

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
    // Validate environment variables
    if (!process.env.GIST_USER || !process.env.GIST_ID) {
      throw new Error('GIST_USER or GIST_ID environment variable is not defined');
    }

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
  // 空のデータ配列の場合は早期リターン
  if (!data || data.length === 0) {
    return [];
  }
  const filteredData = [];
  let lastHour = null;
  
  // データを日付順にソート（念のため）
  const sortedData = [...data].sort((a, b) => {
    return new Date(a.date) - new Date(b.date);
  });
  
  sortedData.forEach(item => {
    const date = new Date(item.date);
    const currentHour = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
    
    // 新しい時間またはデータの先頭の場合は追加
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
  // If date is passed as a string, convert it to a Date object
  if (typeof date === 'string') {
    date = new Date(date);
  }

  // Direct manual formatting to avoid timezone issues in tests
  // This is more reliable than using toLocaleString which can cause issues in tests
  try {
    // Get date parts in the target timezone
    const options = { timeZone: timezone };
    const parts = new Intl.DateTimeFormat('en-US', {
      ...options,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(date);

    // Create a map of the parts
    const mapped = {};
    parts.forEach(part => {
      if (part.type !== 'literal') {
        mapped[part.type] = part.value;
      }
    });

    // Format the string
    return `${mapped.year}-${mapped.month}-${mapped.day}T${mapped.hour}:${mapped.minute}`;
  } catch (error) {
    // Fallback method if Intl methods fail
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hour}:${minute}`;
  }
}

// グラフデータの準備
function prepareChartData(filteredData, timezone) {
  if (!filteredData || filteredData.length === 0) {
    throw new Error('No data available to prepare chart');
  }

  // null値をフィルタリングして、有効なデータポイントのみをChartJSに渡す
  // ただし、nullの値は配列からは除外せず、スキップする形でマッピングする
  const chartData = [];
  filteredData.forEach(item => {
    // nullまたは定義されていない値はスキップするが、グラフは連続して描画される
    if (item.remainingData !== null && item.remainingData !== undefined) {
      chartData.push({
        x: new Date(item.date).getTime(),
        y: parseFloat(item.remainingData)
      });
    }
  });
  
  // Y軸設定の計算（nullでない値のみで計算）
  const values = filteredData
    .filter(item => item.remainingData !== null && item.remainingData !== undefined)
    .map(item => parseFloat(item.remainingData));
  
  if (values.length === 0) {
    throw new Error('No valid data points available for chart preparation');
  }
  
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
  // maxValueに基づいて最大値を計算（50GBごとに区切る）
  let yAxisMax = 50 * (Math.floor(maxValue / 50) + 1);
  
  // 最大値が50より小さい場合は50を使用
  if (yAxisMax < 50) {
    yAxisMax = 50;
  }
  
  // 最大値が上限を超えないようにする
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
  
  // この値を実際のY軸設定から取得したものに置き換える
  const defaultYAxisMax = yAxisMax;
  
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UCSS Monitor Chart</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns"></script>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        .chart-container {
            position: relative;
            height: 60vh;
            width: 100%;
        }
        .updated-time {
            text-align: center;
            margin-top: 20px;
            color: #7f8c8d;
            font-size: 14px;
        }
        .timezone-info {
            text-align: center;
            margin-top: 10px;
            color: #7f8c8d;
            font-size: 14px;
        }
        .controls-container {
            display: flex;
            justify-content: space-between;
            flex-wrap: wrap;
            margin: 20px 0;
            padding: 15px;
            background-color: #f8f9fa;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .control-group {
            flex: 1;
            min-width: 250px;
            margin: 10px;
        }
        .control-item {
            margin-bottom: 15px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        input[type="range"] {
            width: 100%;
        }
        .range-slider {
            position: relative;
            margin-top: 30px;
            margin-bottom: 40px;
        }
        .dual-slider-container {
            position: relative;
            width: 100%;
            height: 40px;
            margin-top: 20px;
        }
        .range-track {
            position: absolute;
            width: 100%;
            height: 5px;
            background-color: #ddd;
            top: 50%;
            transform: translateY(-50%);
            border-radius: 3px;
            z-index: 1;
        }
        .range-selected {
            position: absolute;
            height: 5px;
            background-color: rgba(75, 192, 192, 0.8);
            top: 50%;
            transform: translateY(-50%);
            border-radius: 3px;
            z-index: 2;
        }
        input[type="range"].dual-slider {
            position: absolute;
            -webkit-appearance: none;
            appearance: none;
            width: 100%;
            background: transparent;
            top: 0;
            height: 40px;
            margin: 0;
            pointer-events: none; /* デフォルトではイベントを無効に */
        }
        input[type="range"].dual-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            cursor: pointer;
            margin-top: -7px;
            pointer-events: auto; /* つまみのイベントのみ有効に */
            z-index: 5;
        }
        input[type="range"].dual-slider::-moz-range-thumb {
            width: 18px;
            height: 18px;
            border-radius: 50%;
            cursor: pointer;
            pointer-events: auto; /* つまみのイベントのみ有効に */
            z-index: 5;
            border: none;
        }
        #y-min-range::-webkit-slider-thumb {
            background: #2196F3;
        }
        #y-max-range::-webkit-slider-thumb {
            background: #4CAF50;
        }
        #y-min-range::-moz-range-thumb {
            background: #2196F3;
        }
        #y-max-range::-moz-range-thumb {
            background: #4CAF50;
        }
        .range-values {
            display: flex;
            justify-content: space-between;
            margin-top: 10px;
        }
        input[type="number"] {
            width: 60px;
            padding: 5px;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        input[type="datetime-local"] {
            padding: 5px;
            border: 1px solid #ddd;
            border-radius: 4px;
            width: 180px;
        }
        select {
            padding: 5px;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        .value-display {
            display: inline-block;
            margin-left: 10px;
            font-size: 14px;
            color: #555;
        }
        button {
            padding: 8px 16px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            margin-top: 10px;
            margin-right: 10px;
        }
        button:hover {
            background-color: #45a049;
        }
        button#reset-settings {
            background-color: #7f8c8d;
        }
        button#reset-settings:hover {
            background-color: #6c7a7a;
        }
        .datetime-controls {
            display: flex;
            justify-content: space-between;
        }
        .datetime-control-item {
            flex: 1;
            margin-right: 10px;
        }
        .datetime-control-item:last-child {
            margin-right: 0;
        }
        .buttons-group {
            display: flex;
            justify-content: center;
            margin-top: 15px;
            width: 100%;
        }
        .y-axis-inputs {
            display: flex;
            justify-content: space-between;
            margin-top: 10px;
            align-items: center;
        }
        .y-axis-input-group {
            display: flex;
            align-items: center;
        }
        .y-axis-input-group label {
            margin-right: 5px;
            font-weight: normal;
        }
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
                <label for="y-min-range">データ量範囲</label>
                <div class="dual-slider-container">
                    <div class="range-track"></div>
                    <div id="range-selected" class="range-selected"></div>
                    <input type="range" id="y-min-range" class="dual-slider" min="0" max="${CONSTANTS.Y_AXIS.MAX_LIMIT}" step="5" value="${yAxisMin}">
                    <input type="range" id="y-max-range" class="dual-slider" min="0" max="${CONSTANTS.Y_AXIS.MAX_LIMIT}" step="5" value="${yAxisMax}">
                </div>
                <div class="range-values">
                    <span>0</span>
                    <span>${CONSTANTS.Y_AXIS.MAX_LIMIT}</span>
                </div>
                <div class="y-axis-inputs">
                    <div class="y-axis-input-group">
                        <label for="y-min-input">最小値:</label>
                        <input type="number" id="y-min-input" min="0" max="${CONSTANTS.Y_AXIS.MAX_LIMIT}" step="5" value="${yAxisMin}">
                    </div>
                    <div class="y-axis-input-group">
                        <label for="y-max-input">最大値:</label>
                        <input type="number" id="y-max-input" min="0" max="${CONSTANTS.Y_AXIS.MAX_LIMIT}" step="5" value="${yAxisMax}">
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
        
        // 定数値 - 動的に算出されたデフォルト最大値を使用
        const Y_AXIS_MAX_LIMIT = ${CONSTANTS.Y_AXIS.MAX_LIMIT};
        const Y_AXIS_DEFAULT_MIN = ${CONSTANTS.Y_AXIS.DEFAULT_MIN};
        const Y_AXIS_DEFAULT_MAX = ${defaultYAxisMax}; // 固定値ではなく、データから計算された最大値を使用
        
        // スケール設定の初期値
        let chartSettings = {
            yMin: ${yAxisMin},
            yMax: ${yAxisMax},
            xMin: firstTimestamp,
            xMax: currentTimestamp  // 初期値を現在の時刻に設定
        };
        
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
            const minPercent = (parseInt(minRange.value) / rangeMax) * 100;
            const maxPercent = (parseInt(maxRange.value) / rangeMax) * 100;
            
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
                let minValue = parseInt(this.value);
                const maxValue = parseInt(yMaxRange.value);
                
                // 最小値と最大値の制約
                if (minValue < 0) minValue = 0;
                if (minValue > Y_AXIS_MAX_LIMIT) minValue = Y_AXIS_MAX_LIMIT;
                
                // 最小値が最大値を超えないようにする
                if (minValue >= maxValue) {
                    minValue = maxValue;
                }
                
                this.value = minValue;
                chartSettings.yMin = minValue;
                
                // 数値入力フィールドも更新
                yMinInput.value = minValue;
                updateSelectedRange();
            });
            
            // Y軸の最大値スライダーの更新時
            yMaxRange.addEventListener('input', function() {
                let maxValue = parseInt(this.value);
                const minValue = parseInt(yMinRange.value);
                
                // 最小値と最大値の制約
                if (maxValue < 0) maxValue = 0;
                if (maxValue > Y_AXIS_MAX_LIMIT) maxValue = Y_AXIS_MAX_LIMIT;
                
                // 最大値が最小値を下回らないようにする
                if (maxValue <= minValue) {
                    maxValue = minValue + 5; // 最小でも5の差をつける
                    if (maxValue > Y_AXIS_MAX_LIMIT) {
                        maxValue = Y_AXIS_MAX_LIMIT;
                        // 最大値が上限に達した場合は最小値を調整
                        yMinRange.value = maxValue - 5;
                        yMinInput.value = maxValue - 5;
                        chartSettings.yMin = maxValue - 5;
                    }
                }
                
                this.value = maxValue;
                chartSettings.yMax = maxValue;
                
                // 数値入力フィールドも更新
                yMaxInput.value = maxValue;
                updateSelectedRange();
            });
            
            // Y軸の最小値入力フィールドの更新時
            yMinInput.addEventListener('input', function() {
                let minValue = parseInt(this.value);
                const maxValue = parseInt(yMaxInput.value);
                
                // 空の入力や不正な値の場合は処理しない
                if (isNaN(minValue)) return;
                
                // 最小値と最大値の制約
                if (minValue < 0) minValue = 0;
                if (minValue > Y_AXIS_MAX_LIMIT) minValue = Y_AXIS_MAX_LIMIT;
                
                // 最小値が最大値を超えないようにする
                if (minValue >= maxValue) {
                    minValue = maxValue;
                }
                
                this.value = minValue;
                chartSettings.yMin = minValue;
                
                // スライダーも更新
                yMinRange.value = minValue;
                updateSelectedRange();
            });
            
            // Y軸の最大値入力フィールドの更新時
            yMaxInput.addEventListener('input', function() {
                let maxValue = parseInt(this.value);
                const minValue = parseInt(yMinInput.value);
                
                // 空の入力や不正な値の場合は処理しない
                if (isNaN(maxValue)) return;
                
                // 最小値と最大値の制約
                if (maxValue < 0) maxValue = 0;
                if (maxValue > Y_AXIS_MAX_LIMIT) maxValue = Y_AXIS_MAX_LIMIT;
                
                // 最大値が最小値を下回らないようにする
                if (maxValue <= minValue) {
                    maxValue = minValue + 5; // 最小でも5の差をつける
                    if (maxValue > Y_AXIS_MAX_LIMIT) {
                        maxValue = Y_AXIS_MAX_LIMIT;
                    }
                }
                
                this.value = maxValue;
                chartSettings.yMax = maxValue;
                
                // スライダーも更新
                yMaxRange.value = maxValue;
                updateSelectedRange();
            });
            
            // 設定適用ボタン
            applyButton.addEventListener('click', function() {
                // 安全な方法で日時を取得
                let xMinValue, xMaxValue;
                try {
                    xMinValue = new Date(xMin.value).getTime();
                    xMaxValue = new Date(xMax.value).getTime();
                    
                    // NaNチェック
                    if (isNaN(xMinValue) || isNaN(xMaxValue)) {
                        alert('日付が正しく入力されていません。');
                        return;
                    }
                    
                    chartSettings.xMin = xMinValue;
                    chartSettings.xMax = xMaxValue;
                } catch (error) {
                    console.error('日付解析エラー:', error);
                    alert('日付形式が正しくありません。');
                    return;
                }
                
                // 入力値の検証
                if (chartSettings.xMin >= chartSettings.xMax) {
                    alert('開始日時は終了日時より前にしてください');
                    return;
                }
                
                if (chartSettings.yMin >= chartSettings.yMax) {
                    alert('Y軸の最小値は最大値より小さくしてください');
                    return;
                }
                
                initChart(chartSettings);
            });
            
            // リセットボタン
            resetButton.addEventListener('click', function() {
                // 初期値に戻す
                xMin.value = '${firstDateFormatted}';
                xMax.value = '${currentDateFormatted}';
                yMinRange.value = Y_AXIS_DEFAULT_MIN;
                yMaxRange.value = Y_AXIS_DEFAULT_MAX;
                yMinInput.value = Y_AXIS_DEFAULT_MIN;
                yMaxInput.value = Y_AXIS_DEFAULT_MAX;
                
                chartSettings = {
                    yMin: Y_AXIS_DEFAULT_MIN,
                    yMax: Y_AXIS_DEFAULT_MAX,
                    xMin: firstTimestamp,
                    xMax: currentTimestamp
                };
                
                updateSelectedRange();
                initChart(chartSettings);
            });
            
            // 初期化時にも選択範囲を表示
            updateSelectedRange();
        }
        
        // DOMロード時の初期化
        document.addEventListener('DOMContentLoaded', function() {
            // 初期値を確実に設定
            const yMinRange = document.getElementById('y-min-range');
            const yMaxRange = document.getElementById('y-max-range');
            const yMinInput = document.getElementById('y-min-input');
            const yMaxInput = document.getElementById('y-max-input');
            
            // 初期値の数値を直接設定する（テンプレート変数の代わりに定数を使用）
            const defaultYMin = Y_AXIS_DEFAULT_MIN;
            const defaultYMax = Y_AXIS_DEFAULT_MAX;
            
            // 初期値を明示的に設定
            yMinRange.value = defaultYMin;
            yMaxRange.value = defaultYMax;
            yMinInput.value = defaultYMin;
            yMaxInput.value = defaultYMax;
            
            // チャート設定も更新
            chartSettings.yMin = defaultYMin;
            chartSettings.yMax = defaultYMax;
            
            setupEventListeners();
            updateSelectedRange(); // 初期スライダー範囲を設定
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
// Only run in non-test environment
if (process.env.NODE_ENV !== 'test') {
  fetchAndProcessData();
}

// Export functions for testing purposes
export {
  fetchAndProcessData,
  fetchDataFromGist,
  filterHourlyData,
  getTimezoneInfo,
  prepareChartData,
  calculateYAxisRange,
  formatDate,
  formatDateForInput,
  generateAndSaveHtml,
  processGitHubActions // Added explicit export for processGitHubActions
};