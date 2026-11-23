# Post viewer: enabling persistent likes and comments

The API uses the existing Firebase REST server identity. It does not bypass
Firestore rules. Add the block below to the current rules in Firebase Console
→ Firestore Database → Rules, inside
`match /databases/{database}/documents`, immediately before the final
`match /{document=**}` deny-all block. Leave every existing rule intact.

```firestore
// Likes, comments and replies are accessed through the API only.
// The API checks post visibility and the signed-in actor on every request.
match /post_interactions/{interactionId} {
  allow read, create, update, delete: if isServer();
}
```

`isServer()` is the existing function that requires an authenticated Firebase
user whose token email equals `seeder@rootprojx.internal`. This block grants
neither public nor ordinary signed-in browser access to the collection.

The API checks the source post before all reads and writes. Private supporter
posts remain owner-only; follows and saved references do not grant access.
Comment authors and organisation verification are derived on the server.
Retries use idempotent record IDs, so a lost response does not duplicate a
comment or increase a like count twice.

Publishing these database rules does not publish the website.
