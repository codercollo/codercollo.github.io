# Collins Kimani — Personal Portfolio

A simple, content-focused personal homepage. Inspired by early-web academic
pages. No frameworks, no build step, no noise.

## Project Structure

```
collins/
├── index.html              # The entire website — one file
├── css/
│   └── style.css           # Custom styles (animations, typography, character)
├── js/
│   └── main.js             # Minimal JS (progressive enhancement only)
├── partials/
│   ├── more-projects.html  # HTMX partial: additional projects
│   └── more-writing.html   # HTMX partial: additional writing entries
└── README.md
```

## Running Locally

The site is a static HTML file. Any local server will work.

### Option 1 — Python (no install needed)

```bash
# Python 3
python -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080).

### Option 2 — Node.js (`npx serve`)

```bash
npx serve .
```

### Option 3 — Go (`go run`)

```bash
# If you have Go installed
go run -v golang.org/x/tools/cmd/present@latest
# or simply:
go run . # if you add a small main.go file server
```

### Option 4 — VS Code Live Server

Install the **Live Server** extension and click "Go Live" in the status bar.

> **Note:** The HTMX "show more" buttons require a local HTTP server
> because they fetch `partials/*.html` via XHR. Opening `index.html`
> directly as `file://` will cause those requests to fail (CORS).
> The rest of the page works perfectly without a server.

## Customising

### Adding a project

In `index.html`, find the `<ul class="project-list" id="projects-visible">` block
and add a new `<li class="project-item">` entry following the existing pattern.

For extra projects behind the "show more" button, edit
`partials/more-projects.html`.

### Adding a photo

Replace the initials placeholder `<div>` inside `.profile-photo` with an `<img>`:

```html
<img
  src="photo.jpg"
  alt="Collins Kimani"
  class="w-full h-full object-cover"
/>
```

### Adding a writing entry

Add a new `<li class="writing-item">` to the writing list in `index.html`.
Older entries go in `partials/more-writing.html`.

### Changing the colour palette

Edit the CSS custom properties at the top of `css/style.css` (`:root` block).
The Tailwind theme extension in `index.html` (`tailwind.config`) mirrors these
for utility classes.

## Dependencies

| Dependency | Version | Purpose         | CDN (no install) |
|------------|---------|-----------------|------------------|
| Tailwind   | 3.x     | Utility classes | ✓                |
| HTMX       | 1.9.12  | Partials / XHR  | ✓                |

No npm, no bundler, no build step.

## License

Personal use. Not for redistribution.
