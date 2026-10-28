---
name: Organisation deletion policy
description: Public removal must retain payment history and existing settlement capabilities.
---

Deleting an organisation means removing its public presence and owner access,
not erasing financial records or closing payment-provider accounts.

**Why:** Root ProjX may still owe the organisation money or receive an in-flight
payment event after removal. Erasing its payment setup would obstruct settlement.

**How to apply:** Keep retained organisation data available to accounting while
ordinary reads treat it as absent. Require explicit name confirmation. Block
removal while recurring gifts are uncanceled, rather than silently continuing
charges to a removed organisation. Never use a real organisation deletion as a test.
