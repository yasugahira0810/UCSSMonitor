const axios = require('axios');
const fs = require('fs');

const GIST_ID = 'your-gist-id'; // Replace with your Gist ID
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Set your GitHub token in the environment variables

async function fetchGistData() {
  try {
    const response = await axios.get(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
      },
    });

    const files = response.data.files;
    const data = Object.keys(files).map((fileName) => {
      return {
        name: fileName,
        content: files[fileName].content,
      };
    });

    fs.writeFileSync('public/gist_data.json', JSON.stringify(data, null, 2));
    console.log('Gist data fetched and saved to public/gist_data.json');
  } catch (error) {
    console.error('Error fetching Gist data:', error);
  }
}

fetchGistData();