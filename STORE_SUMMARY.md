# Otium v0.1 — store submission text

## Short product description

Turn your new tab into a local-first workspace for links, Projects, notes and source widgets.

## Permission justification

Otium uses `storage` for local workspace/settings data, reversible Trash and recovery snapshots. `activeTab` provides temporary access after the user opens the action popup to capture the current page or selected text. `scripting` runs built-in selection and CSS-selector text-reading helpers; Rendered Page Watch also requires access to the configured origin and an already-open matching tab. Optional `favicon` access supplies browser website icons. Optional HTTP/HTTPS host patterns allow explicit, origin-specific access requests for external sources; Otium does not request all-site access at installation or startup. Bookmark import uses a user-selected file and requires no bookmarks permission.

## Privacy summary

Otium stores the workspace and recovery data in `chrome.storage.local`; it currently has no Otium account requirement, cloud sync, analytics or telemetry. External-source widgets can contact user-configured sources, with shared fetches omitting credentials and referrers. Rendered Page Watch reads configured text from an existing matching tab. Quick Capture saves selected plain text and source metadata only when the user chooses a Project. Favicons may use browser or permitted image sources. Workspace/recovery exports are local JSON downloads and may contain private workspace content. See [Privacy](PRIVACY.md) and [Permissions](PERMISSIONS.md) for details.
