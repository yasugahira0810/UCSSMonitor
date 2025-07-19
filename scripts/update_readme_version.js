// バージョンバッジ自動更新スクリプト
// usage: node scripts/update_readme_version.js v0.3.0

const fs = require('fs');
const path = require('path');

function errorExit(message) {
  console.error(message);
  if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
    throw new Error(message);
  } else {
    process.exit(1);
  }
}

if (process.argv.length < 3) {
  errorExit('Usage: node scripts/update_readme_version.js <tag>');
}

const tag = process.argv[2];
const readmePath = path.resolve(__dirname, '../README.md');

let content = fs.readFileSync(readmePath, 'utf8');
const badgeRegex = /\[!\[Version\]\(https:\/\/img\.shields\.io\/badge\/version-v[0-9a-zA-Z_.-]+-blue\.svg\)\]/g;
const newBadge = `[![Version](https://img.shields.io/badge/version-${tag}-blue.svg)]`;

if (badgeRegex.test(content)) {
  content = content.replace(badgeRegex, newBadge);
  fs.writeFileSync(readmePath, content, 'utf8');
  console.log(`README.mdのバージョンバッジを${tag}に更新しました。`);
} else {
  errorExit('README.mdにバージョンバッジが見つかりませんでした。');
}
