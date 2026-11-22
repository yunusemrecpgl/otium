# Otium v0.2.0 — store submission text

## Short product description

Turn your new tab into a local-first workspace for links, Projects, notes and source widgets.

## Permission justification

Otium requires `storage` for local workspace data, settings, Trash, and recovery snapshots. It requires `activeTab` for temporary access to the current page when the user opens the action popup. Optional `scripting` lets Clip and Rendered Page Watch run built-in text-reading helpers with active-tab access or an approved origin. Rendered Page Watch also requires an already-open matching tab. Optional `favicon` access supplies browser website icons. Optional HTTP(S) host access is requested for specific origins through an explicit user action.

Users can copy bookmarks and folders into Otium directly from their browser or from a browser-exported HTML file. Otium requests the optional `bookmarks` permission only when the user explicitly chooses direct import. HTML import requires no bookmark permission. Otium never modifies or continuously synchronizes browser bookmarks.

## Privacy summary

Otium stores the workspace and recovery data in `chrome.storage.local`; it currently has no Otium account requirement, cloud sync, analytics or telemetry. External-source widgets can contact user-configured sources, with shared fetches omitting credentials and referrers. Rendered Page Watch reads configured text from an existing matching tab. Quick Capture saves selected plain text and source metadata only when the user chooses a Project. Favicons may use browser or permitted image sources. Workspace/recovery exports are local JSON downloads and may contain private workspace content. See [Privacy](PRIVACY.md) and [Permissions](PERMISSIONS.md) for details.
