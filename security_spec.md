# Security Spec for 汉末群雄传 v1.0

## 1. Data Invariants
- **Identity Bound**: Every `games/{userId}` document and its subcollections (history, npcs, logs) are strictly owned by and accessible only to the user whose UID matches `{userId}`.
- **Relational Integrity**: Game history messages and NPCs must exist within a valid game session.
- **Immutability**: Log entries, once written, cannot be modified (`allow update: if false`).
- **Temporal Integrity**: All `lastUpdated` or `timestamp` fields must match `request.time`.
- **Administrative Control**: Only a bootstrap admin (e.g., `lastry-thone@hotmail.com`) or a user with a verified `admin` role in `/admins/{userId}` can perform cross-user reads or administrative management.

## 2. The "Dirty Dozen" Payloads
1. **Identity Spoofing**: Attempting to create a game under another user's UID.
2. **Ghost Field Injection**: Adding `isVerified: true` or `isAdmin: true` to a user profile or game state.
3. **Log Alteration**: Attempting to edit technical details in an existing game log.
4. **Time Travel**: Providing a client-side timestamp for `lastUpdated` instead of `serverTimestamp()`.
5. **NPC Scraping**: Attempting to list all NPC profiles across all games without ownership.
6. **ID Poisoning**: Using a 1MB string as a game ID to bloat the database.
7. **Role Escalation**: Self-assigning 'admin' status in a user document.
8. **Resource Exhaustion**: Sending a massive 1MB string in the `content` field of a message.
9. **Invalid Character Selection**: Initializing a character with stats exceeding the cap (100) or an illegal lineage ID.
10. **State Skipping**: Trying to set game status to "OVER" directly from "NEW".
11. **Negative Resources**: Setting `money` or `grain` in `gaiaState` to a negative value.
12. **Anonymous Access**: Attempting to read a game state without being signed in.

## 3. The Test Runner (Conceptual)
All tests must verify `PERMISSION_DENIED` for the above payloads.
