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

    // Sort data by date to ensure chronological order
    dataContent.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Format dates for better readability
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('ja-JP', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    const labels = dataContent.map(item => formatDate(item.date));
    const values = dataContent.map(item => parseFloat(item.remainingData));

    // Calculate statistics
    const latestValue = values[values.length - 1];
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const averageValue = values.reduce((sum, val) => sum + val, 0) / values.length;

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UCSS Monitor Chart</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
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
        .stats-container {
            display: flex;
            justify-content: space-around;
            margin: 20px 0;
            flex-wrap: wrap;
        }
        .stat-box {
            background-color: #f5f5f5;
            border-radius: 8px;
            padding: 15px;
            margin: 10px;
            min-width: 200px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .stat-value {
            font-size: 24px;
            font-weight: bold;
            color: #2c3e50;
        }
        .stat-label {
            font-size: 14px;
            color: #7f8c8d;
        }
        .updated-time {
            text-align: center;
            margin-top: 20px;
            color: #7f8c8d;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <h1>UCSS データ使用量モニター</h1>
    
    <div class="stats-container">
        <div class="stat-box">
            <div class="stat-label">最新残量</div>
            <div class="stat-value">${latestValue.toFixed(2)} GB</div>
        </div>
        <div class="stat-box">
            <div class="stat-label">最大値</div>
            <div class="stat-value">${maxValue.toFixed(2)} GB</div>
        </div>
        <div class="stat-box">
            <div class="stat-label">最小値</div>
            <div class="stat-value">${minValue.toFixed(2)} GB</div>
        </div>
        <div class="stat-box">
            <div class="stat-label">平均値</div>
            <div class="stat-value">${averageValue.toFixed(2)} GB</div>
        </div>
    </div>
    
    <div class="chart-container">
        <canvas id="myChart"></canvas>
    </div>
    
    <div class="updated-time">
        最終更新: ${new Date().toLocaleString('ja-JP')}
        (データポイント数: ${dataContent.length})
    </div>
    
    <script>
        const ctx = document.getElementById('myChart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ${JSON.stringify(labels)},
                datasets: [
                    {
                        label: '残りデータ量 (GB)',
                        data: ${JSON.stringify(values)},
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
                        display: true,
                        text: 'UCSS データ使用量の推移',
                        font: {
                            size: 18
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `残りデータ量: ${context.parsed.y.toFixed(2)} GB`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
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
                        title: {
                            display: true,
                            text: '日時'
                        }
                    }
                }
            }
        });
    </script>
</body>
</html>`;

    const outputPath = './docs/index.html';
    fs.mkdirSync('./docs', { recursive: true });
    fs.writeFileSync(outputPath, htmlContent);
    console.log('Chart HTML generated successfully at:', outputPath);
    console.log(`Generated chart with ${labels.length} data points`);

  } catch (error) {
    console.error('Error occurred:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
})();