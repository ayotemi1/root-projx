---
name: Firestore collection access
description: New REST query sources need explicit server rules, including empty history collections.
---

An empty Firestore collection is not exempt from read rules. A query on an
unmatched collection returns permission denied, not an empty history.

**Why:** Production dashboard summaries failed for several days because the
legacy disbursements history lacked a server-read rule, despite the organisation
document and other collection queries working. Successful server sign-in does
not mean every collection is permitted.

**How to apply:** When adding a query source, check its collection-specific rule.
Distinguish inaccessible data from confirmed empty data. Independent dashboard
sections should retain confirmed figures; unknown financial values must not
be converted into zero. Follow the existing manual rules-publication boundary.
