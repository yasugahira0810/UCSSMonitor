import fs from 'fs';
import Chart from 'chart.js/auto';
import fetch from 'node-fetch';

(async () => {
  const gistUrl = `https://gist.github.com/${process.env.GIST_USER}/${process.env.GIST_ID}`;
  console.log(`Fetching Gist data from: ${gistUrl}`);

  try {
    // Fetch Gist data
    const response = await fetch(gistUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch Gist data: ${response.statusText}`);
    }

    const gistData = await response.json();

    // Process the Gist data in memory
    console.log('Gist data fetched successfully:', gistData);

    // Extract data for the chart (example assumes gistData is an array of objects with "label" and "value" keys)
    const labels = gistData.map(item => item.label);
    const values = gistData.map(item => item.value);

    // Create a chart in a canvas element
    const { createCanvas } = require('canvas');
    const canvas = createCanvas(800, 600);
    const ctx = canvas.getContext('2d');

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Gist Data',
                    data: values,
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: false,
            plugins: {
                legend: {
                    position: 'top',
                },
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    // Save the chart as an image
    const outputPath = './public/chart.png';
    const out = fs.createWriteStream(outputPath);
    const stream = canvas.createPNGStream();
    stream.pipe(out);
    out.on('finish', () => console.log('Chart image saved to', outputPath));

  } catch (error) {
    console.error('Error fetching or processing Gist data:', error.message);
  }
})();