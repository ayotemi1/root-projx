---
name: Organisation messaging access
description: Why private Inbox membership must use trusted account identities rather than public team cards or profile emails.
---

Private organisation messaging must use server-controlled grants to exact Firebase account UIDs. Public team cards and self-entered profile email addresses are not proof of membership. Platform-administrator content delegation does not grant access to private conversations or financial controls.

**Why:** The organisation team list is presentation content, not a verified login-role system. Existing basic profile creation does not establish ownership of the profile document's email value. Matching that value to an invitation would let a different account claim another person's access.

**How to apply:** Keep messaging access narrowly scoped to the organisation owner and explicitly authorised account identities. A future email invitation flow must verify control of the invited identity rather than trust a profile email. A supporter who also replies for an organisation must explicitly choose their personal or organisation context; do not infer the sender's role from membership alone.

Organisation owners may separately authorise account managers for **content and
Inbox**, but banking, payouts and changing team permissions remain owner-only.
Do not automatically promote existing Inbox-only members into content managers.

**Why:** On 2026-11-23 the user chose “Content and Inbox” as the team-manager
scope. Earlier Inbox permissions were deliberately narrower; silently upgrading
them would give existing members powers the owner never granted.

**How to apply:** Require an explicit owner-controlled grant and an explicit
organisation context. Verify the real actor's current grant on every request,
including private-media access; revocation must not leave an owner-equivalent
session or media credential behind. A temporary service outage should preserve
an already-open editor or chat draft, rather than treating it as revocation.

The intended messaging scope includes supporter-to-supporter, organisation-to-organisation, and organisation-initiated conversations with supporters, as well as existing supporter-to-organisation conversations.

**Why:** The user explicitly confirmed this expanded product scope on 2026-11-23 when requesting Message on supporter profiles.

**How to apply:** Do not keep new conversations limited to a supporter initiator and organisation recipient. Preserve explicit sender identity and trusted organisation membership for every direction.

Preserve older inbox clients when adding participant combinations: historical
message-side names remain stable conversation positions, not the sender's actual
account role. Use the actual participants for authorisation and role labels.

**Why:** Renaming or interpreting those old positions as roles would break
message alignment and misidentify organisations in same-role or reversed threads.

**How to apply:** Keep old supporter–organisation history and request shapes
working, and resolve sender context independently on every request.

Supporter message preferences restrict organisation-initiated contact, not the
supporter's outgoing messages or supporter-to-supporter conversations. An
organisation may reply once the supporter has actually written in that thread;
merely opening an empty conversation is not consent to unsolicited contact.

**Why:** The Settings copy permits messaging any organisation while offering
“Organisations I follow” and “Only replies” for incoming organisation contact.
Blocking all existing threads would also block legitimate replies.

**How to apply:** Evaluate the actual sending organisation, including delegated
team senders, against the recipient's preferences and follow relationship.
Retain private history when a setting prevents further unsolicited messages.
