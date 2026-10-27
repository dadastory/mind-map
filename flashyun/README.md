# FlashYun native collaboration integration

Based on upstream tag `0.20.0` (library `0.14.0-fix.3`). The official Vue 2 Web
application is built from source; generated JavaScript is never patched.

`Cooperate.js` remains the binding: `data_change`, `set_data`, `node_active`,
`node_tree_render_end`, `updateChanges`, `onObserve`, the existing node presence
rendering and `beforeCooperateUpdate` hook retain their native roles. It accepts
an already-synchronized external Y.Doc and provider, and owns only its listeners
and local Y.UndoManager. It never seeds an external document or destroys the
provider's document. Native BACK/FORWARD delegates to selective local-origin
Yjs undo, including native metadata transactions. Each synchronized native edit
is an undo boundary.

`cooperateDocument.mjs` extracts the official tree/flat conversion and uses
Y.Map node fields and Y.Array child IDs in the same flat-node model. This fixes
the original parent-object overwrite that lost simultaneous child insertions.
The same helper preserves native root attributes and document metadata for the
server codec; `packages/mind-map-collaboration` packages generated copies of this
source, not another synchronization implementation. Known native theme/config
containers are seeded once, so their first independent field changes can merge.
Text, rich HTML and atomic arrays remain Yjs last-writer values; this is not a
per-character rich text editor or a guarantee of arbitrary semantic conflict
resolution.

The reverse conversion ignores missing references, chooses a deterministic
parent, visits each live node once, and displays unreachable live branches under
the root in UID order. This is a safety supplement to the official conversion,
not a second CRDT. It prevents move-versus-delete or concurrent cyclic moves
from hanging rendering or silently losing surviving content. Projection alone
never writes to the Y.Doc. A later structural edit removes hidden stale edges
only in the edited nodes, so recovery does not redirect that visible edit.

The host's narrow `onDocument` hook sanitizes each native rendering snapshot.
The core has no DOMPurify dependency and does not normalize the stored Y.Doc.
Presence accepts standard public `user`/`mindmap` awareness states while retaining
the original WebRTC shape. FlashYun uses the parent provider's awareness authority
and an iframe transport proxy, with independent Y.Doc client IDs.

Web webpack aliases resolve `simple-mind-map` to this fork's source and Yjs to
the pinned Web dependency. The takeover export exposes this same Cooperate class
and pure codec to the iframe adapter. Historical/thumbnail instances do not
attach the plugin. Build with the official Vue CLI through
`packages/mind-map-editor/build-upstream.mjs` in the enclosing repository.
