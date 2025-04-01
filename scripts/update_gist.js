const fs = require('fs');
(async () => {
  const { Octokit } = await import('@octokit/rest');
  const octokit = new Octokit({ auth: process.env.GH_PAT }); // Use GH_PAT for authentication

  // Load new data to append
  const newData = JSON.parse(fs.readFileSync('data.json', 'utf8'));

  // Fetch existing Gist data
  const gist = await octokit.gists.get({
    gist_id: 'ec00ab4d6ed6cdb4f1b21f65377fc6af' // Replace with actual Gist ID
  });

  // Parse existing data and append new data
  const existingData = JSON.parse(gist.data.files['data.json'].content);
  const updatedData = [...existingData, ...newData];

  // Update the Gist with the new data
  await octokit.gists.update({
    gist_id: 'ec00ab4d6ed6cdb4f1b21f65377fc6af',
    files: {
      'data.json': {
        content: JSON.stringify(updatedData, null, 2) // Format JSON with indentation
      }
    }
  });
})();