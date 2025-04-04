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

    // Y軸の最小値をデフォルトで0に設定
    const yAxisMin = 0;

    // 時間範囲の設定用に最初と最後のデータポイントの日時を取得
    const firstDataPoint = filteredData[0];
    const lastDataPoint = filteredData[filteredData.length - 1];
    const firstDate = new Date(firstDataPoint.date);
    const lastDate = new Date(lastDataPoint.date);
    
    // 現在の日時を取得（最終更新時間として使用）
    const currentDate = new Date();
    
    // 日時フォーマット関数（YYYY-MM-DDThh形式に変換）
    const formatDateForInput = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hour = String(date.getHours()).padStart(2, '0');
      return `${year}-${month}-${day}T${hour}`;
    };
    
    const firstDateFormatted = formatDateForInput(firstDate);
    const lastDateFormatted = formatDateForInput(lastDate);
    const currentDateFormatted = formatDateForInput(currentDate);
    
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
        }
        button:hover {
            background-color: #45a049;
        }
    </style>
</head>
<body>
    <h1>UCSS データ使用量モニター</h1>
    
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
                <label for="y-min">最小値</label>
                <input type="range" id="y-min" min="0" max="50" value="${yAxisMin}" step="5">
                <input type="number" id="y-min-value" min="0" max="50" value="${yAxisMin}">
                <span class="value-display" id="y-min-display">${yAxisMin} GB</span>
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
                <label for="x-min">開始日時</label>
                <input type="datetime-local" id="x-min" value="${firstDateFormatted}" min="${firstDateFormatted}" max="${currentDateFormatted}">
            </div>
            <div class="control-item">
                <label for="x-max">終了日時</label>
                <input type="datetime-local" id="x-max" value="${currentDateFormatted}" min="${firstDateFormatted}" max="${currentDateFormatted}">
            </div>
            <div class="control-item">
                <button id="apply-settings">設定を適用</button>
                <button id="reset-settings">リセット</button>
            </div>
        </div>
    </div>
    
    <script>
        let myChart;
        const ctx = document.getElementById('myChart').getContext('2d');
        const chartData = ${JSON.stringify(chartData)};
        const timezone = '${timezone}';
        
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
            const yMinValue = document.getElementById('y-min-value');
            const yMinDisplay = document.getElementById('y-min-display');
            const yMaxSlider = document.getElementById('y-max');
            const yMaxValue = document.getElementById('y-max-value');
            const yMaxDisplay = document.getElementById('y-max-display');
            const xMin = document.getElementById('x-min');
            const xMax = document.getElementById('x-max');
            const applyButton = document.getElementById('apply-settings');
            const resetButton = document.getElementById('reset-settings');
            
            // 最小値スライダーとテキスト入力を同期
            yMinSlider.addEventListener('input', function() {
                yMinValue.value = this.value;
                yMinDisplay.textContent = this.value + ' GB';
                
                // 最小値が最大値を超えないようにする
                if (parseInt(this.value) >= parseInt(yMaxSlider.value)) {
                    yMaxSlider.value = parseInt(this.value) + 10;
                    yMaxValue.value = yMaxSlider.value;
                    yMaxDisplay.textContent = yMaxSlider.value + ' GB';
                }
            });
            
            yMinValue.addEventListener('input', function() {
                yMinSlider.value = this.value;
                yMinDisplay.textContent = this.value + ' GB';
                
                // 最小値が最大値を超えないようにする
                if (parseInt(this.value) >= parseInt(yMaxValue.value)) {
                    yMaxValue.value = parseInt(this.value) + 10;
                    yMaxSlider.value = yMaxValue.value;
                    yMaxDisplay.textContent = yMaxValue.value + ' GB';
                }
            });
            
            // 最大値スライダーとテキスト入力を同期
            yMaxSlider.addEventListener('input', function() {
                yMaxValue.value = this.value;
                yMaxDisplay.textContent = this.value + ' GB';
                
                // 最大値が最小値を下回らないようにする
                if (parseInt(this.value) <= parseInt(yMinSlider.value)) {
                    yMinSlider.value = parseInt(this.value) - 10;
                    if (yMinSlider.value < 0) yMinSlider.value = 0;
                    yMinValue.value = yMinSlider.value;
                    yMinDisplay.textContent = yMinSlider.value + ' GB';
                }
            });
            
            yMaxValue.addEventListener('input', function() {
                yMaxSlider.value = this.value;
                yMaxDisplay.textContent = this.value + ' GB';
                
                // 最大値が最小値を下回らないようにする
                if (parseInt(this.value) <= parseInt(yMinValue.value)) {
                    yMinValue.value = parseInt(this.value) - 10;
                    if (yMinValue.value < 0) yMinValue.value = 0;
                    yMinSlider.value = yMinValue.value;
                    yMinDisplay.textContent = yMinValue.value + ' GB';
                }
            });
            
            // 設定適用ボタン
            applyButton.addEventListener('click', function() {
                chartSettings.yMin = Number(yMinValue.value);
                chartSettings.yMax = Number(yMaxValue.value);
                
                // 日時入力から時間を取得
                const xMinDate = new Date(xMin.value + ':00');
                const xMaxDate = new Date(xMax.value + ':00');
                
                chartSettings.xMin = xMinDate.getTime();
                chartSettings.xMax = xMaxDate.getTime();
                
                // 入力値の検証
                if (chartSettings.xMin >= chartSettings.xMax) {
                    alert('開始日時は終了日時より前にしてください');
                    return;
                }
                
                if (chartSettings.yMin >= chartSettings.yMax) {
                    alert('最小値は最大値より小さくしてください');
                    return;
                }
                
                initChart(chartSettings);
            });
            
            // リセットボタン
            resetButton.addEventListener('click', function() {
                yMinSlider.value = ${yAxisMin};
                yMinValue.value = ${yAxisMin};
                yMinDisplay.textContent = '${yAxisMin} GB';
                yMaxSlider.value = ${yAxisMax};
                yMaxValue.value = ${yAxisMax};
                yMaxDisplay.textContent = '${yAxisMax} GB';
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