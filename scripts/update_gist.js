import fs from 'fs';
import fetch from 'node-fetch';
import path from 'path';
import { Octokit } from '@octokit/rest';

const REMAINING_DATA = process.env.REMAINING_DATA;
const GIST_USER = process.env.GIST_USER;
const GIST_ID = process.env.GIST_ID;
const GH_PAT = process.env.GH_PAT;
const FILENAME = 'data.json';

/**
 * Main function to update the Gist with new data
 */
async function updateGist() {
  try {
    const octokit = new Octokit({ 
      auth: GH_PAT,
      request: { fetch }
    });

    console.log(`Updating Gist at: https://gist.github.com/${GIST_USER}/${GIST_ID}`);
    
    // Get existing Gist data
    const existingData = await fetchGistData(octokit);
    
    // Create new entry
    const newEntry = {
      date: new Date().toISOString(),
      remainingData: parseFloat(REMAINING_DATA)
    };

    // Update Gist
    const updatedData = [...existingData, newEntry];
    await saveGistData(octokit, updatedData);
    
    console.log('Gist updated successfully with new data:', newEntry);
  } catch (error) {
    console.error('Error updating Gist:', error.message);
    if (error.response) {
      console.error('Full error response:', JSON.stringify(error.response, null, 2));
    } else {
      console.error('Full error:', error);
    }
    process.exit(1); // エラーでプロセスを終了
  }
}

/**
 * Fetch existing data from the Gist
 */
async function fetchGistData(octokit) {
  if (!GIST_ID) {
    throw new Error('GIST_ID is not defined in the environment variables.');
  }

  const response = await octokit.gists.get({
    gist_id: GIST_ID
  });

  if (!response || !response.data) {
    console.error('Raw response from Octokit:', response);
    throw new Error('No data returned from Gist API');
  }
  const gistData = response.data;

  // Validate Gist data
  if (!gistData.files || Object.keys(gistData.files).length === 0) {
    throw new Error('No files found in the Gist. Please check the Gist ID or its content.');
  }

  // Parse existing data from the Gist
  try {
    return JSON.parse(gistData.files[FILENAME]?.content || '[]');
  } catch (parseError) {
    console.error('Error parsing Gist content:', parseError);
    throw new Error('Failed to parse Gist content as JSON. Please check the Gist content.');
  }
}

/**
 * Save updated data to the Gist
 */
async function saveGistData(octokit, updatedData) {
  await octokit.gists.update({
    gist_id: GIST_ID,
    files: {
      [FILENAME]: {
        content: JSON.stringify(updatedData, null, 2)
      }
    }
  });
}

/**
 * Generate HTML files in the docs directory
 */
function generateFiles() {
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
}

// Execute main functions
(async () => {
  await updateGist();
  generateFiles();
})();

// Export functions for testing purposes
export {
  updateGist,
  fetchGistData,
  saveGistData,
  generateFiles
};