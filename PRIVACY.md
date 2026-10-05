# Otium privacy — v0.1

## Local workspace data

Otium is a local-first browser extension. Its primary workspace is stored in
`chrome.storage.local`, including links, Projects, Folders, widget configuration
and content, canvas placements, settings and Trash records. A recovery snapshot
is stored there too. A small theme hint is kept in extension-origin
`localStorage` to reduce startup flicker.

Otium does not currently require an Otium account or implement cloud sync,
analytics or telemetry. Workspace data is not uploaded to an Otium service.
This does not mean that no data leaves the browser: external-source features
and opening links can contact other websites.

## External sources

Widgets request sources you configure, manually or at the configured refresh
interval while their components are mounted. There is no background monitoring
service. Shared external fetches use HTTP GET, `credentials: 'omit'` and
`referrerPolicy: 'no-referrer'`; they do not provide an API-key or custom
authentication-header feature. Remote responses have size limits.

- **Web Data** reads public HTTPS JSON endpoints and displays selected values.
- **RSS Feed** reads public RSS/Atom feeds and displays article titles, links
  and dates. Opening an article navigates to its website.
- **Page Watch** reads configured text fields. Static mode extracts text from
  fetched HTML; Direct mode reads JSON values. Rendered mode reads only the
  configured elements' text from an already-open matching browser tab, with
  origin access. That tab may already be signed in; rendered reads are not
  governed by the external-fetch credentials setting. Watched values and
  change/check timestamps are saved locally.
- Page Watch's user-invoked source discovery may also read page/script text
  and check candidate JSON endpoints. It does not execute fetched scripts.

Fetched HTML/feed content is not injected as widget HTML. Source operators
receive external requests and apply their own privacy policies. URLs you enter
may themselves contain identifying query parameters. Opening a source uses
normal browser navigation, including that site's normal session behavior.

## Quick Capture and bookmarks

Opening Otium's action popup reads the active page's URL/title and checks for
selected plain text. It may read short surrounding text to build a source
deep link and obtain a favicon URL. Saving a selection requires choosing a
Project; the resulting Clip stores working text, the original selection,
source URL/title and available deep-link/favicon metadata. Page HTML is not
stored by selection capture. There is no continuous selection monitoring.

Bookmark import processes a browser-exported HTML file you select locally.
Imported titles, URLs and folder structure are saved in the workspace, along
with import summary/fingerprint metadata for repeated-import detection. Otium
does not request access to the browser's live bookmark collection.

## Favicons, recovery and exports

Favicons can use the optional browser favicon API or permitted image sources.
Remote favicon fetches omit credentials and referrers and require existing
access to the image's origin. Displayed icons are static raster snapshots,
cached in memory; failures fall back to an initial badge.

Trash is reversible and retains records. Recovery snapshots can retain earlier
workspace content. Workspace Export and raw recovery export download JSON
locally rather than upload it. Raw recovery exports may include current data,
snapshots, legacy data and data preserved by a restore. Exports can contain
private notes, captured text and full URLs; share them only intentionally.

See [Permissions](PERMISSIONS.md) for access controls and reasons.
