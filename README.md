# UCSSMonitor

[![Version](https://img.shields.io/badge/version-v0.0.0-blue.svg)](https://github.com/yasugahira0810/UCSSMonitor)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen.svg)](https://github.com/yasugahira0810/UCSSMonitor/actions)
[![Node.js](https://img.shields.io/badge/node-%3E%3D%2018-green.svg)](https://nodejs.org)
[![GitHub Actions Workflow Status](https://github.com/yasugahira0810/UCSSMonitor/actions/workflows/job.yml/badge.svg)](https://github.com/yasugahira0810/UCSSMonitor/actions/workflows/job.yml)

UCSSMonitor is a tool that automatically monitors and visualizes the remaining data usage of the UCSS VPN service. It fetches data from the UCSS website, records it to GitHub Gist, and generates interactive charts to track usage over time.

## Sample Visualization

You can see a live sample graph here:
https://yasugahira0810.github.io/UCSSMonitor/

## Features

- Automated data scraping from the UCSS service portal using Puppeteer
- Secure credential management through GitHub Actions Secrets
- Hourly data collection and storage in GitHub Gist
- Interactive data visualization with Chart.js
- Customizable time range and scale for data analysis
- Timezone support for accurate data representation
- Automatic deployment to GitHub Pages

## Installation

### Prerequisites

- Node.js (>= 18)
- GitHub account (for Gist storage and GitHub Pages deployment)

### Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/UCSSMonitor.git
cd UCSSMonitor
```

2. Install dependencies:
```bash
npm install
```

3. Set up a GitHub Gist to store your data:
   - Create a new Gist at https://gist.github.com
   - Name one file `data.json` and initialize it with an empty array: `[]`
   - Note the Gist ID (from the URL)

4. Configure environment variables:
   - For local development, create a `.env` file with the following variables:
   ```
   UCSS_EMAIL=your-ucss-email@example.com
   UCSS_PASSWORD=your-ucss-password
   GIST_USER=your-github-username
   GIST_ID=your-gist-id
   GH_PAT=your-github-personal-access-token
   UTC_OFFSET=Asia/Tokyo  # Optional: Timezone for display
   ```
   - For GitHub Actions, add these as repository secrets

## Usage

### Manual Data Collection

To collect data about your UCSS usage:

```bash
node scripts/scraper.js
```

### Update Gist with new data point

To manually update your Gist with the latest data:

```bash
export REMAINING_DATA=50.5  # Your current data amount in GB
node scripts/update_gist.js
```

### Generate Visualization

To generate the chart visualization:

```bash
node scripts/generate_graph.js
```

The visualization will be created as an HTML file at `docs/index.html`. You can open this file in your browser to view the graph.

### GitHub Actions Workflow

The repository includes GitHub Actions workflows that automate the entire process:
- Data is collected hourly
- The Gist is updated with each new data point
- The graph is regenerated after each update
- The updated graph is automatically deployed to GitHub Pages

## Environment Variables

The following environment variables are required for the application to work:

| Variable | Description |
|----------|-------------|
| `UCSS_EMAIL` | Your UCSS account email address |
| `UCSS_PASSWORD` | Your UCSS account password |
| `GH_PAT` | GitHub Personal Access Token with Gist write permissions |
| `GIST_USER` | GitHub username that owns the Gist |
| `GIST_ID` | ID of the Gist used for data storage |
| `UTC_OFFSET` | (Optional) Timezone for display (e.g., "Asia/Tokyo" or "+9") |

## License

MIT License

Copyright (c) 2023 

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Contributing

Contributions are welcome! Here's how you can contribute:

1. Fork the repository
2. Create a new branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

### Guidelines for contribution:

- Ensure all tests pass before submitting a PR
- Follow the existing code style
- Add appropriate documentation for new features
- Include tests for new functionality

## Disclaimer

This software is provided "as is" without warranty of any kind. The author is not responsible for any damages or liability arising from the use of this software. Use at your own risk.