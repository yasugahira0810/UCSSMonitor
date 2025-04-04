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

    // GitHub Actionsで使用する値を出力
    if (process.env.GITHUB_ACTIONS) {
      const latestData = dataContent[dataContent.length - 1];
      // GitHub Actionsの出力形式に合わせて文字列として出力
      console.log(`::set-output name=remainingData::${latestData.remainingData.toString()}`);
    }

    const labels = dataContent.map(item => item.date);
    const values = dataContent.map(item => item.remainingData);

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UCSS Monitor Chart</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <canvas id="myChart" width="800" height="600"></canvas>
    <script>
        const ctx = document.getElementById('myChart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ${JSON.stringify(labels)},
                datasets: [
                    {
                        label: 'Remaining Data (GB)',
                        data: ${JSON.stringify(values)},
                        borderColor: 'rgba(75, 192, 192, 1)',
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        borderWidth: 2,
                        tension: 0.1,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'UCSS Data Usage Monitor'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Remaining Data (GB)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Date'
                        }