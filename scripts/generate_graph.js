import fs from 'fs';
import Chart from 'chart.js/auto';
import fetch from 'node-fetch';
import { Octokit } from '@octokit/rest';

(async () => {
  const octokit = new Octokit({ 
    auth: process.env.GH_PAT, // Use process.env.GH_PAT for authentication
    request: { fetch } // Pass fetch implementation
  });

  const gistUrl = `https://gist.github.com/${process.env.GIST_USER}/${process.env.GIST_ID}`;
  console.log(`Fetching Gist data from: ${gistUrl}`);
  console.log('GIST_USER:', process.env.GIST_USER);
  console.log('GIST_ID:', process.env.GIST_ID);
  console.log('Constructed Gist URL:', gistUrl);

  try {
    const { data: gistData } = await octokit.gists.get({
      gist_id: process.env.GIST_ID
    });
    console.log('Gist data fetched successfully:', gistData);

    const labels = gistData.files['data.json'].content.map(item => item.label);
    const values = gistData.files['data.json'].content.map(item => item.value);

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

    const outputPath = './public/chart.png';
    const out = fs.createWriteStream(outputPath);
    const stream = canvas.createPNGStream();
    stream.pipe(out);
    out.on('finish', () => console.log('Chart image saved to', outputPath));
  } catch (error) {
    console.error('Error fetching or processing Gist data:', error.message);
  }
})();