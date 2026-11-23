---
name: Organisation messaging access
description: Why private Inbox membership must use trusted account identities rather than public team cards or profile emails.
---

Private organisation messaging must use server-controlled grants to exact Firebase account UIDs. Public team cards and self-entered profile email addresses are not proof of membership. Content-administration delegation does not grant access to private conversations or financial controls.

**Why:** The organisation team list is presentation content, not a verified login-role system. Existing basic profile creation does not establish ownership of the profile document's email value. Matching that value to an invitation would let a different account claim another person's access.

**How to apply:** Keep messaging access narrowly scoped to the organisation owner and explicitly authorised account identities. A future email invitation flow must verify control of the invited identity rather than trust a profile email. A supporter who also replies for an organisation must explicitly choose their personal or organisation context; do not infer the sender's role from membership alone.

The intended messaging scope includes supporter-to-supporter, organisation-to-organisation, and organisation-initiated conversations with supporters, as well as existing supporter-to-organisation conversations.

**Why:** The user explicitly confirmed this expanded product scope on 2026-11-23 when requesting Message on supporter profiles.

**How to apply:** Do not keep new conversations limited to a supporter initiator and organisation recipient. Preserve explicit sender identity and trusted organisation membership for every direction.
