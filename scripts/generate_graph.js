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

    // Check if data.json exists in the fetched Gist
    if (!gistData.files || !gistData.files['data.json']) {
      throw new Error('data.json file is missing in the Gist.');
    }

    const dataContent = JSON.parse(gistData.files['data.json'].content);
    const labels = dataContent.map(item => item.label);
    const values = dataContent.map(item => item.value);

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chart</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <canvas id="myChart" width="800" height="600"></canvas>
    <script>
        const ctx = document.getElementById('myChart').getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ${JSON.stringify(labels)},
                datasets: [
                    {
                        label: 'Gist Data',
                        data: ${JSON.stringify(values)},
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
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
    </script>
</body>
</html>`;

    const outputPath = './docs/index.html';
    fs.mkdirSync('./docs', { recursive: true }); // Ensure the docs directory exists
    fs.writeFileSync(outputPath, htmlContent);
    console.log('Chart HTML saved to', outputPath);
  } catch (error) {
    console.error('Error fetching or processing Gist data:', error);
    console.error('Stack trace:', error.stack); // Log full error stack for debugging
  }
})();