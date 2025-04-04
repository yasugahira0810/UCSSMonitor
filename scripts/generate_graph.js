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
  
  if (maxValue < CONSTANTS.Y_AXIS.THRESHOLDS[0]) {
    yAxisMax = CONSTANTS.Y_AXIS.THRESHOLDS[0];
  } else if (maxValue < CONSTANTS.Y_AXIS.THRESHOLDS[1]) {
    yAxisMax = CONSTANTS.Y_AXIS.THRESHOLDS[1];
  } else {
    yAxisMax = Math.ceil(maxValue / 50) * 50;
  }
  
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
        .double-range {
            position: absolute;
            width: 100%;
            pointer-events: none;
        }
        .range-track {
            position: absolute;
            width: 100%;
            height: 5px;
            background-color: #ddd;
            top: 50%;
            transform: translateY(-50%);
            border-radius: 3px;
        }
        .range-selected {
            position: absolute;
            height: 5px;
            background-color: rgba(75, 192, 192, 0.8);
            top: 50%;
            transform: translateY(-50%);
            border-radius: 3px;
        }
        input[type="range"].range-min,
        input[type="range"].range-max {
            position: absolute;
            width: 100%;
            pointer-events: all;
            -webkit-appearance: none;
            appearance: none;
            background: transparent;
            margin: 0;
            top: 0;
        }
        input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 15px;
            height: 15px;
            border-radius: 50%;
            background: #4CAF50;
            cursor: pointer;
            position: relative;
            z-index: 1;
        }
        input[type="range"]::-moz-range-thumb {
            width: 15px;
            height: 15px;
            border-radius: 50%;
            background: #4CAF50;
            cursor: pointer;
            position: relative;
            z-index: 1;
            border: none;
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
        
        // UIイベントリスナー設定
        function setupEventListeners() {
            const xMin = document.getElementById('x-min');
            const xMax = document.getElementById('x-max');
            const applyButton = document.getElementById('apply-settings');
            const resetButton = document.getElementById('reset-settings');
            
            // 設定適用ボタン
            applyButton.addEventListener('click', function() {
                const xMinDate = new Date(xMin.value);
                const xMaxDate = new Date(xMax.value);
                
                chartSettings.xMin = xMinDate.getTime();
                chartSettings.xMax = xMaxDate.getTime();
                
                // 入力値の検証
                if (chartSettings.xMin >= chartSettings.xMax) {
                    alert('開始日時は終了日時より前にしてください');
                    return;
                }
                
                initChart(chartSettings);
            });
            
            // リセットボタン
            resetButton.addEventListener('click', function() {
                xMin.value = '${firstDateFormatted}';
                xMax.value = '${currentDateFormatted}';
                
                chartSettings = {
                    yMin: ${yAxisMin},
                    yMax: ${yAxisMax},
                    xMin: firstTimestamp,
                    xMax: currentTimestamp
                };
                
                initChart(chartSettings);
            });
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