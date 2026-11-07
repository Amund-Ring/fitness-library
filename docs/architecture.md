# Architecture

## Small, deliberate data model

Domain records and mutation rules live in `src/domain`, separate from components and `src/firebase.ts`.

Firestore stores one private versioned document at `users/{uid}/workspaces/main`, containing arrays of exercises, placements, membership episodes, and events. This is intentionally simple for one person's small program: a swap and its history are saved together in one transaction. Larger arrays are exempted from indexing because the app reads the workspace as a whole.

Each write increments `revision`. A transaction checks the expected server revision before writing; another device's changes cause a useful conflict message rather than silent overwrite. An editor opened before a newer change must be closed and reopened. Cloud listeners update the current state across signed-in devices.

Firestore has a document-size limit; the app applies a conservative **750 KB serialized-state guard** and record-count bounds. It refuses oversized imports/writes instead of trimming history. If the library eventually outgrows that, move older events/episodes to subcollections. This is not a general-purpose sync framework.

Original membership start dates are `null`, with `observedActiveAt: "2026-11-07"`. Moving between A–D does not restart membership. Removing closes the episode; returning starts a new one. Archive preserves identities and historical references. Undo is scoped to the latest local change and becomes unavailable if a different device advances the revision.

## Offline and privacy behavior

Firestore is authoritative. Previously loaded state is cached in browser localStorage under a UID-scoped key for viewing only. Cloud mutations use transactions, require connectivity, and are never queued offline. A cache is optional: blocked or full local storage does not prevent cloud use, but offline data viewing is then unavailable.

Firebase Authentication remembers the sign-in on the device. The service worker caches the static app shell, not Firebase API responses. Signing out clears the application viewing copy. Use this on personal, trusted devices; sign out on shared computers. Clearing browser data removes the local cache, while the cloud library remains.
