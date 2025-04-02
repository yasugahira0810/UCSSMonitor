import fs from 'fs';
import Chart from 'chart.js/auto';

// Read Gist data from a local file (replace with actual Gist fetching logic if needed)
const gistDataPath = './scripts/gist_data.json';

if (!fs.existsSync(gistDataPath)) {
    console.error('Gist data file not found. Please ensure the file exists at:', gistDataPath);
    process.exit(1);
}

const gistData = JSON.parse(fs.readFileSync(gistDataPath, 'utf-8'));

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