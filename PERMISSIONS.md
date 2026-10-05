# Otium permissions — Manifest V3

These permissions match the current manifest. Otium replaces the New Tab page
and provides a browser action popup; neither adds a separate permission.

## Required permissions

| Permission | Why Otium uses it |
| --- | --- |
| `storage` | Store the workspace, settings, reversible Trash and recovery snapshots in `chrome.storage.local`, and synchronize changes between extension contexts. |
| `activeTab` | Obtain temporary access to the current tab when you invoke the action popup, to read its URL/title and selected text for Quick Capture. It does not grant permanent access to every website. |

## Optional permissions

| Permission | Why Otium uses it |
| --- | --- |
| `scripting` | Requested when you explicitly grant Clip capture access or choose Rendered Page Watch. Runs built-in selection/selector text-reading helpers with active-tab access or an approved origin; it does not itself grant website access or run user-supplied JavaScript. |
| `favicon` | Use the browser's favicon endpoint for saved website/source icons. A first-run Website Icons step requests it only when you click Allow; Not now dismisses the step without blocking Otium. You can grant access later from Settings or Widgets. Without it, permitted alternatives or initial badges remain available. |
| Host patterns `https://*/*` and `http://*/*` | Declare which website origins Otium may ask you to approve for external-source widgets and rendered-page reads. These are **optional host permissions**, not required host permissions. |

Broad website access is not granted at installation or requested at startup.
Core widgets are always available. Clip availability follows its actual browser
permission state. Existing widget data is preserved if permissions change.
Clip and Rendered Page Watch details can remove their shared optional page-reading
access; Static/Direct modes remain available. Website Icons has no in-app revoke action.
When a supported feature needs source access, its explicit **Allow access**
action requests the configured origin only, such as
`https://cneos.jpl.nasa.gov/*`, rather than all hosts. This grant covers that
origin's paths, not just one endpoint. Some public sources already work through
CORS without a grant. Rendered Page Watch requires origin access and an
already-open matching page; it does not create hidden tabs.

Direct favicon retrieval uses already-granted access to the image's origin; it
does not automatically request additional origins. Permissions can be declined
or revoked through the browser's extension/site-access controls. Features then
show an access/unavailable state or an icon fallback as applicable.

The current manifest does not request `tabs`, `bookmarks`, clipboard,
`contextMenus`, `webRequest` or `declarativeNetRequest` permissions. Bookmark
import reads a file you choose, rather than the live bookmark database.

See [Privacy](PRIVACY.md) for what is stored and when remote sources are contacted.
