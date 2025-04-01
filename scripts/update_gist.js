const fs = require('fs');
const fetch = require('node-fetch'); // Import node-fetch

(async () => {
  const { Octokit } = await import('@octokit/rest');
  const octokit = new Octokit({ 
    auth: process.env.GH_PAT, // Use GH_PAT for authentication
    request: { fetch } // Pass fetch implementation
  });

  // Log the GIST_USER and GIST_ID environment variables
  console.log(`GIST_USER: ${process.env.GIST_USER}`);
  console.log(`GIST_ID: ${process.env.GIST_ID}`);

  // Construct the Gist URL using GIST_USER and GIST_ID
  const gistUrl = `https://gist.github.com/${process.env.GIST_USER}/${process.env.GIST_ID}`;
  console.log(`Updating Gist at: ${gistUrl}`);

  // Fetch existing Gist data
  const gist = await octokit.gists.get({
    gist_id: process.env.GIST_ID // Use GIST_ID from environment variables
  });

  // Add error handling to check if gist.data.files exists
  if (!gist.data.files || Object.keys(gist.data.files).length === 0) {
    throw new Error('No files found in the Gist. Please check the Gist ID or its content.');
  }

  // Dynamically get the file name (assuming there's only one file in the Gist)
  const fileName = Object.keys(gist.data.files)[0];

  // Parse existing data from the Gist
  const existingData = JSON.parse(gist.data.files[fileName].content);

  // Create new data entry
  const newEntry = {
    date: new Date().toISOString(),
    remainingData: Math.floor(Math.random() * 10000) // Example: Random remaining data in MB
  };

  // Append new entry to existing data
  const updatedData = [...existingData, newEntry];

  // Update the Gist with the new data
  await octokit.gists.update({
    gist_id: process.env.GIST_ID, // Use GIST_ID from environment variables
    files: {
      [fileName]: {
        content: JSON.stringify(updatedData, null, 2) // Format JSON with indentation
      }
    }
  });

  console.log('Gist updated successfully with new data:', newEntry);
})();