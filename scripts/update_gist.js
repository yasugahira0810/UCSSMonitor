const fs = require('fs');
(async () => {
  const { Octokit } = await import('@octokit/rest');
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
  const gist = await octokit.gists.get({
    gist_id: 'yourgistid'
  });
  const existingData = JSON.parse(gist.data.files['data.json'].content);
  existingData.push(data);
  await octokit.gists.update({
    gist_id: 'yourgistid',
    files: {
      'data.json': {
        content: JSON.stringify(existingData, null, 2)
      }
    }
  });
})();