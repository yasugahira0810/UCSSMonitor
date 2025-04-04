import fs from 'fs';
import Chart from 'chart.js/auto';
import fetch from 'node-fetch';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

(async () => {
  const gistUrl = `https://gist.github.com/${process.env.GIST_USER}/${process.env.GIST_ID}`;
  console.log(`Fetching Gist data from: ${gistUrl}`);

  try {
    // Fetch raw data from gist
    const response = await fetch(`${gistUrl}/raw/data.json`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const dataContent = await response.json();

    if (!Array.isArray(dataContent)) {
      throw new Error('Invalid data format: expected an array');
    }

    console.log(`Retrieved ${dataContent.length} data points from the gist`);

    // GitHub Actionsで使用する値を出力
    if (process.env.GITHUB_ACTIONS) {
      const latestData = dataContent[dataContent.length - 1];
      // 新しいGitHub Actions出力形式を使用
      const remainingValue = parseFloat(latestData.remainingData).toFixed(1);
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `remainingData=${remainingValue}\n`);
    }

    // フィルタリングされたデータを用意
    // 1時間ごとにデータポイントをフィルタリング
    const filteredData = [];
    let lastHour = null;
    
    dataContent.forEach(item => {
      const date = new Date(item.date);
      const currentHour = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
      
      // 新しい時間またはデータの先頭の場合
      if (currentHour !== lastHour) {
        filteredData.push(item);
        lastHour = currentHour;
      }
    });
    
    console.log(`Filtered to ${filteredData.length} data points (approx. hourly)`);

    // 環境変数からUTCオフセットを取得
    let timezone = 'UTC';
    let timezoneDisplay = 'UTC+0';
    
    if (process.env.UTC_OFFSET) {
      // タイムゾーンがUTCからのオフセット（例: +8, +9など）として指定されている場合
      if (/^[+-]\d+$/.test(process.env.UTC_OFFSET)) {
        const offset = parseInt(process.env.UTC_OFFSET);
        const offsetHours = Math.abs(offset);
        const offsetSign = offset >= 0 ? '+' : '-'; // 直感的な設定: +8はUTC+8時間
        
        timezoneDisplay = `UTC${offsetSign}${offsetHours}`;
        
        // 日付オブジェクトのタイムゾーン設定用にUTCオフセット文字列を作成
        // 例: +8 → 'Etc/GMT-8', +9 → 'Etc/GMT-9'
        // 注: Etc/GMTの接頭辞では、標準的な表記とは逆に、プラスは西（マイナス時間）、マイナスは東（プラス時間）を意味する
        timezone = `Etc/GMT${offset >= 0 ? '-' : '+'}${offsetHours}`;
      } 
      // 既存のIANAタイムゾーン識別子（例: Asia/Tokyo, Asia/Shanghai）が指定されている場合
      else {
        timezone = process.env.UTC_OFFSET;
        
        // 一般的なタイムゾーンの表示名
        const timezoneMap = {
          'Asia/Tokyo': 'JST (UTC+9)',
          'Asia/Shanghai': 'CST (UTC+8)',
          'America/New_York': 'EST (UTC-5)',
          'America/Los_Angeles': 'PST (UTC-8)',
          'Europe/London': 'GMT (UTC+0)',
          'Europe/Paris': 'CET (UTC+1)'
        };
        
        timezoneDisplay = timezoneMap[timezone] || timezone;
      }
    }
    
    console.log(`Using timezone: ${timezone} (Display: ${timezoneDisplay})`);

    // Format dates for better readability
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      return date.toLocaleString('ja-JP', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: timezone
      });
    };

    // 時間スケール用のデータ準備
    const chartData = filteredData.map(item => ({
      x: new Date(item.date).getTime(), // タイムスタンプを使用
      y: parseFloat(item.remainingData)
    }));
    
    // 表示用ラベルは依然として必要
    const labels = filteredData.map(item => formatDate(item.date));
    const values = filteredData.map(item => parseFloat(item.remainingData));

    // Calculate statistics
    const latestValue = values[values.length - 1];
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const averageValue = values.reduce((sum, val) => sum + val, 0) / values.length;

    // Determine the max value for Y-axis based on the rule
    let yAxisMax;
    if (maxValue < 50) {
      yAxisMax = 50;
    } else if (maxValue < 100) {
      yAxisMax = 100;
    } else {
      // For values >= 100GB, round up to nearest 50
      yAxisMax = Math.ceil(maxValue / 50) * 50;
    }

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
        input[type="number"] {
            width: 60px;
            padding: 5px;
            border: 1px solid #ddd;
            border-radius: 4px;
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
        }
        button:hover {
            background-color: #45a049;
        }
    </style>
</head>
<body>
    <h1>UCSS データ使用量モニター</h1>
    
    <div class="controls-container">
        <div class="control-group">
            <h3>縦軸の設定</h3>
            <div class="control-item">
                <label for="y-min">最小値</label>
                <input type="range" id="y-min" min="0" max="50" value="0" step="1">
                <input type="number" id="y-min-value" min="0" max="50" value="0">
                <span class="value-display" id="y-min-display">0 GB</span>
            </div>
            <div class="control-item">
                <label for="y-max">最大値</label>
                <input type="range" id="y-max" min="10" max="200" value="${yAxisMax}" step="10">
                <input type="number" id="y-max-value" min="10" max="200" value="${yAxisMax}">
                <span class="value-display" id="y-max-display">${yAxisMax} GB</span>
            </div>
        </div>
        
        <div class="control-group">
            <h3>横軸の設定</h3>
            <div class="control-item">
                <label for="x-unit">時間単位</label>
                <select id="x-unit">
                    <option value="hour">時間</option>
                    <option value="day">日</option>
                    <option value="week">週</option>
                    <option value="month">月</option>
                </select>
            </div>
            <div class="control-item">
                <label for="x-display-format">表示形式</label>
                <select id="x-display-format">
                    <option value="MM/dd HH:mm">MM/dd HH:mm</option>
                    <option value="MM/dd">MM/dd</option>
                    <option value="yyyy/MM/dd">yyyy/MM/dd</option>
                    <option value="HH:mm">HH:mm</option>
                </select>
            </div>
            <div class="control-item">
                <button id="apply-settings">設定を適用</button>
                <button id="reset-settings">リセット</button>
            </div>
        </div>
    </div>
    
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
    
    <script>
        let myChart;
        const ctx = document.getElementById('myChart').getContext('2d');
        const chartData = ${JSON.stringify(chartData)};
        const timezone = '${timezone}';
        
        // スケール設定の初期値
        let chartSettings = {
            yMin: 0,
            yMax: ${yAxisMax},
            xUnit: 'hour',
            xDisplayFormat: 'MM/dd HH:mm'
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
                                    return "Remaining data: " + context.parsed.y.toFixed(2) + " GB";
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
                            beginAtZero: settings.yMin === 0,
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
                            time: {
                                unit: settings.xUnit,
                                displayFormats: {
                                    hour: settings.xDisplayFormat,
                                    day: settings.xDisplayFormat,
                                    week: settings.xDisplayFormat,
                                    month: settings.xDisplayFormat
                                },
                                tooltipFormat: 'yyyy/MM/dd HH:mm'
                            },
                            title: {
                                display: true,
                                text: '日時'
                            },
                            ticks: {
                                maxRotation: 45,
                                minRotation: 45
                            }
                        }
                    }
                }
            });
        }
        
        // UIコントロールとイベントリスナーの設定
        document.addEventListener('DOMContentLoaded', function() {
            // 各要素の参照を取得
            const yMinSlider = document.getElementById('y-min');
            const yMaxSlider = document.getElementById('y-max');
            const yMinValue = document.getElementById('y-min-value');
            const yMaxValue = document.getElementById('y-max-value');
            const yMinDisplay = document.getElementById('y-min-display');
            const yMaxDisplay = document.getElementById('y-max-display');
            const xUnit = document.getElementById('x-unit');
            const xDisplayFormat = document.getElementById('x-display-format');
            const applyButton = document.getElementById('apply-settings');
            const resetButton = document.getElementById('reset-settings');
            
            // スライダーとテキスト入力を同期
            yMinSlider.addEventListener('input', function() {
                yMinValue.value = this.value;
                yMinDisplay.textContent = this.value + ' GB';
            });
            
            yMaxSlider.addEventListener('input', function() {
                yMaxValue.value = this.value;
                yMaxDisplay.textContent = this.value + ' GB';
            });
            
            yMinValue.addEventListener('input', function() {
                yMinSlider.value = this.value;
                yMinDisplay.textContent = this.value + ' GB';
            });
            
            yMaxValue.addEventListener('input', function() {
                yMaxSlider.value = this.value;
                yMaxDisplay.textContent = this.value + ' GB';
            });
            
            // 設定適用ボタン
            applyButton.addEventListener('click', function() {
                chartSettings.yMin = Number(yMinValue.value);
                chartSettings.yMax = Number(yMaxValue.value);
                chartSettings.xUnit = xUnit.value;
                chartSettings.xDisplayFormat = xDisplayFormat.value;
                
                // 入力値の検証
                if (chartSettings.yMin >= chartSettings.yMax) {
                    alert('最小値は最大値より小さくしてください');
                    return;
                }
                
                initChart(chartSettings);
            });
            
            // リセットボタン
            resetButton.addEventListener('click', function() {
                yMinSlider.value = 0;
                yMaxSlider.value = ${yAxisMax};
                yMinValue.value = 0;
                yMaxValue.value = ${yAxisMax};
                yMinDisplay.textContent = '0 GB';
                yMaxDisplay.textContent = '${yAxisMax} GB';
                xUnit.value = 'hour';
                xDisplayFormat.value = 'MM/dd HH:mm';
                
                chartSettings = {
                    yMin: 0,
                    yMax: ${yAxisMax},
                    xUnit: 'hour',
                    xDisplayFormat: 'MM/dd HH:mm'
                };
                
                initChart(chartSettings);
            });
            
            // 初期グラフ描画
            initChart(chartSettings);
        });
    </script>
</body>
</html>`;

    const outputPath = './docs/index.html';
    fs.mkdirSync('./docs', { recursive: true });
    fs.writeFileSync(outputPath, htmlContent);
    console.log('Chart HTML generated successfully at:', outputPath);
    console.log(`Generated chart with ${chartData.length} data points`);

  } catch (error) {
    console.error('Error occurred:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
})();