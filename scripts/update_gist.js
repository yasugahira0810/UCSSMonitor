import fs from 'fs';
import fetch from 'node-fetch'; // Import node-fetch
import { logRemainingData } from './scraper.js';
import path from 'path';

const remainingData = process.env.REMAINING_DATA;

(async () => {
  const { Octokit } = await import('@octokit/rest');
  const octokit = new Octokit({ 
    auth: process.env.GH_PAT, // Use process.env.GH_PAT for authentication
    request: { fetch } // Pass fetch implementation
  });

  // Log the GIST_USER and GIST_ID environment variables
  console.log(`GIST_USER: ${process.env.GIST_USER}`);
  console.log(`GIST_ID: ${process.env.GIST_ID}`);

  // Construct the Gist URL using environment variables
  const gistUrl = `https://gist.github.com/${process.env.GIST_USER}/${process.env.GIST_ID}`;
  console.log(`Updating Gist at: ${gistUrl}`);

  try {
    // Fetch existing Gist data
    const { data: gistData } = await octokit.gists.get({
      gist_id: process.env.GIST_ID // Use process.env.GIST_ID
    });

    // Validate Gist data
    if (!gistData.files || Object.keys(gistData.files).length === 0) {
      throw new Error('No files found in the Gist. Please check the Gist ID or its content.');
    }

    // Dynamically get the file name (assuming there's only one file in the Gist)
    const [fileName] = Object.keys(gistData.files);

    // Parse existing data from the Gist
    let existingData;
    try {
      existingData = JSON.parse(gistData.files[fileName].content);
    } catch (parseError) {
      throw new Error('Failed to parse Gist content as JSON. Please check the Gist content.');
    }

    const newEntry = {
      date: new Date().toISOString(),
      remainingData: parseFloat(remainingData) // Use the value from the environment variable
    };

    // Append new entry to existing data
    const updatedData = [...existingData, newEntry];

    // Update the Gist with the new data
    await octokit.gists.update({
      gist_id: process.env.GIST_ID, // Use process.env.GIST_ID
      files: {
        [fileName]: {
          content: JSON.stringify(updatedData, null, 2) // Format JSON with indentation
        }
      }
    });

    console.log('Gist updated successfully with new data:', newEntry);
  } catch (error) {
    console.error('Error updating Gist:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
})();

const generateFiles = () => {
  const targetDir = path.join('docs');

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir);
  }

  const filesToGenerate = [
    {
      name: 'chart.html',
      content: `<!DOCTYPE html>
<html>
<head>
  <title>Chart</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  <h1>Chart Page</h1>
  <canvas id="myChart" width="400" height="200"></canvas>
  <script>
    const ctx = document.getElementById('myChart').getContext('2d');
    const myChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['January', 'February', 'March', 'April', 'May', 'June'],
        datasets: [{
          label: 'Sample Data',
          data: [12, 19, 3, 5, 2, 3],
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'top',
          },
        }
      }
    });
  </script>
</body>
</html>`
    },
    {
      name: 'index.html',
      content: `<!DOCTYPE html>
<html>
<head>
  <title>Index</title>
</head>
<body>
  <h1>Index Page</h1>
</body>
</html>`
    }
  ];

  filesToGenerate.forEach(file => {
    const targetFile = path.join(targetDir, file.name);
    fs.writeFileSync(targetFile, file.content);
    console.log(`${file.name} was generated in ${targetDir}`);
  });
};

// Call the function to generate files
generateFiles();