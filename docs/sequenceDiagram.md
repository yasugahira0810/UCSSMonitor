sequenceDiagram
    participant Developer
    participant GitHub Actions
    participant scrape_and_record
    participant scraper.js
    participant Gist
    participant update_gist.js
    participant update_graph
    participant generate_graph.js
    participant deploy

    Developer->>GitHub Actions: Push to main or Cron triggers
    GitHub Actions->>scrape_and_record: Start job.yml
    scrape_and_record->>scraper.js: Launch Puppeteer / Login
    alt Login success
        scraper.js-->>scrape_and_record: remainingData
    else Login failure
        scraper.js-->>scrape_and_record: Error details
        scrape_and_record-->>GitHub Actions: Exit with error
    end
    scrape_and_record->>update_gist.js: Use remainingData
    update_gist.js->>Gist: Append new entry to data.json
    GitHub Actions->>update_graph: Trigger graph generation
    update_graph->>generate_graph.js: Retrieve data.json from Gist
    generate_graph.js->>generate_graph.js: Build docs/index.html
    GitHub Actions->>deploy: Deploy docs to GitHub Pages
