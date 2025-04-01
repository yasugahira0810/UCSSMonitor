const fs = require('fs');

(async () => {
  const { Octokit } = await import('@octokit/rest');
  const octokit = new Octokit({ auth: process.env.GH_PAT }); // Use GH_PAT for authentication

  // Fetch existing Gist data
  const gist = await octokit.gists.get({
    gist_id: 'ec00ab4d6ed6cdb4f1b21f65377fc6af' // Replace with actual Gist ID
  });

  // Dynamically get the file name (assuming there's only one file in the Gist)
  const fileName = Object.keys(gist.data.files)[0];

  // Parse existing data from the Gist
  const existingData = JSON.parse(gist.data.files[fileName].content);

  // Create new data entry
  const newEntry = {
    timestamp: new Date().toISOString(),
    remainingData: Math.floor(Math.random() * 10000) // Example: Random remaining data in MB
  };

  // Append new entry to existing data
  const updatedData = [...existingData, newEntry];

  // Update the Gist with the new data
  await octokit.gists.update({
    gist_id: 'ec00ab4d6ed6cdb4f1b21f65377fc6af',
    files: {
      [fileName]: {
        content: JSON.stringify(updatedData, null, 2) // Format JSON with indentation
      }
    }
  });

  console.log('Gist updated successfully with new data:', newEntry);
})();