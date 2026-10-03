# Collins Kimani — Personal Portfolio

A minimalist, content-focused personal website inspired by classic academic homepages. Built with HTML, Tailwind CSS, and HTMX. No frameworks, build tools, or unnecessary complexity.

## Project Structure

```text
collins/
├── index.html
├── css/style.css
├── js/main.js
├── partials/
│   ├── more-projects.html
│   └── more-writing.html
└── README.md
```

## Running Locally

Start a local server:

```bash
python -m http.server 8080
```

Open http://localhost:8080.

Alternatively, use `npx serve .` or the VS Code Live Server extension.

> **Note:** HTMX features require a local server. Opening `index.html` directly may prevent partials from loading.

## Customizing

- **Projects:** Edit the project list in `index.html` or `partials/more-projects.html`.
- **Writing:** Update the writing list in `index.html` or `partials/more-writing.html`.
- **Profile photo:** Replace the initials placeholder in `.profile-photo` with an image.
- **Colors and typography:** Edit the CSS variables in `css/style.css`.

## Dependencies

- [Tailwind CSS 3.x](https://tailwindcss.com/) — Styling
- [HTMX 1.9.12](https://htmx.org/) — Lightweight interactions

Both are loaded via CDN. No npm, bundler, or build step required.

## License

Personal use. Not for redistribution.
