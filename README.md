# SchemaLens

SchemaLens is a lightweight, zero-backend SQL schema inspector built for developers, students and vibe coders who want a fast structural review without connecting a live database.

**Demo:** `https://schemalens.valron.co.ke`

## What it does

- Parses common `CREATE TABLE` statements directly in the browser.
- Summarizes tables, columns, primary keys and foreign-key relationships.
- Flags selected schema-design heuristics such as unindexed foreign keys and floating-point money columns.
- Displays a compact table map.
- Exports a JSON analysis report.
- Never uploads the supplied SQL anywhere.

## Important scope

SchemaLens is a developer utility and demo, not a replacement for database-specific linting, query-plan analysis, migrations, security review or production DBA work. Its checks are intentionally heuristic.

## Run locally

No build step is required.

1. Download or clone this repository.
2. Open `index.html` in a browser, or serve the folder with any static web server.
3. Paste a schema, load a `.sql` file or use the bundled sample.
4. Click **Run analysis**.

## cPanel / shared-hosting deployment

1. Create the subdomain `schemalens.valron.co.ke`.
2. Set its document root, for example: `public_html/schemalens/`.
3. Upload `index.html` and the `assets/` directory into that root.
4. Enable SSL for the subdomain.
5. Visit the domain. No `.env`, database or API configuration is required.

## GitHub Pages

The project is entirely static, so it can also be published from the repository root using GitHub Pages.

## Project structure

```text
SchemaLens/
├── index.html
├── README.md
├── LICENSE
├── .gitignore
└── assets/
    ├── app.js
    ├── icon.svg
    └── styles.css
```

## Privacy model

The current version uses `FileReader` and JavaScript in the browser. SQL input remains in the local browser session unless the user manually exports a report.

## Roadmap ideas

- PostgreSQL/MySQL dialect-aware parsing.
- ER diagram generation.
- Migration diff mode.
- Duplicate-index detection.
- Naming-convention profiles.
- Schema quality rules configurable through JSON.

## License

MIT.
