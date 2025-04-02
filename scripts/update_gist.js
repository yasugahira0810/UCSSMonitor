import fs from 'fs';
import fetch from 'node-fetch'; // Import node-fetch
import { logRemainingData } from './scraper.js';

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
    const existingData = JSON.parse(gistData.files[fileName].content);

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

    // Removed the local file saving logic
    console.log('Gist updated successfully with new data:', newEntry);
  } catch (error) {
    console.error('Error updating Gist:', error.message);
  }
})();