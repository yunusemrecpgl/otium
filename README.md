# Otium

Otium is a local-first browser workspace and new-tab extension for Chromium browsers, including Chrome and Brave. Built with React, TypeScript and Vite, it uses Manifest V3.

## Features

- Spatial Home and Folder workspaces for links and Projects.
- Project canvases with pan/zoom, selection, drag, resize and formatting tools.
- Note, Todo, Text / Label, Clip, Resource, Web Data, Compare, RSS, Formula and Page Watch widgets.
- Quick Capture for pages and selected text, bookmark import, reversible Trash and recovery export.

## Development

```sh
npm install
npm run dev
npm run build
```

The build runs TypeScript checks and creates `dist`. To use the extension, enable developer mode on your browser's extensions page and load `dist` as an unpacked extension. Browser APIs require the extension environment; the development server is useful for UI development.

## Privacy and permissions

Workspace data is stored locally using browser extension storage. No cloud account is required. External-source widgets contact the sources you configure. Favicon access and external host access are optional; host access is requested for a specific origin only through an explicit user action. Page-selection capture uses the active tab after popup interaction.

See [Privacy](PRIVACY.md), [Permissions](PERMISSIONS.md) and the short [store submission summary](STORE_SUMMARY.md).

## License

Otium is available under the [MIT License](LICENSE).
