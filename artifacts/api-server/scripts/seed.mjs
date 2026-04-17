/**
 * Root ProjX — Firestore seed script (Node.js native fetch, no build needed)
 * Run: node artifacts/api-server/scripts/seed.mjs
 *
 * Seeder account: seeder@rootprojx.internal / RootSeed2024!
 *
 * Collections written:
 *   users        — seeder stub + 3 sample supporters
 *   organisations — 6 verified orgs
 *   updates      — 10 impact-feed posts
 *   reviews      — 4 org reviews
 *   resources    — 3 Get-Help directory entries
 */

import { readFileSync } from "fs";

// ── env ─────────────────────────────────────────────────────────────────────
const API_KEY = process.env.FIREBASE_API_KEY;
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? "rootprojx-1111";
if (!API_KEY) {
  console.error("FIREBASE_API_KEY not set — aborting.");
  process.exit(1);
}

const AUTH_BASE = "https://identitytoolkit.googleapis.com/v1";
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const SEED_EMAIL = "seeder@rootprojx.internal";
const SEED_PASS = "RootSeed2024!";

// ── Firebase REST helpers ────────────────────────────────────────────────────
async function post(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw Object.assign(new Error(await r.text()), { status: r.status });
  return r.json();
}

async function signUp(email, password) {
  return post(`${AUTH_BASE}/accounts:signUp?key=${API_KEY}`, {
    email,
    password,
    returnSecureToken: true,
  });
}

async function signIn(email, password) {
  return post(`${AUTH_BASE}/accounts:signInWithPassword?key=${API_KEY}`, {
    email,
    password,
    returnSecureToken: true,
  });
}

async function getToken() {
  try {
    const r = await signIn(SEED_EMAIL, SEED_PASS);
    console.log("  Signed in as seeder.");
    return { idToken: r.idToken, uid: r.localId };
  } catch {
    const r = await signUp(SEED_EMAIL, SEED_PASS);
    console.log("  Created seeder account.");
    return { idToken: r.idToken, uid: r.localId };
  }
}

// ── Firestore value helpers ──────────────────────────────────────────────────
function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number")
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v))
    return { arrayValue: { values: v.map(toFirestoreValue) } };
  if (typeof v === "object")
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(v).map(([k, val]) => [k, toFirestoreValue(val)])
        ),
      },
    };
  return { stringValue: String(v) };
}

function toFields(obj) {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, toFirestoreValue(v)])
  );
}

async function upsert(collection, docId, data, token) {
  const url = `${FS_BASE}/${collection}/${docId}`;
  const r = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ fields: toFields(data) }),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Firestore PATCH ${collection}/${docId} failed: ${err}`);
  }
  return r.json();
}

// ── Seed data ────────────────────────────────────────────────────────────────
const NOW = new Date().toISOString();
const D = (daysAgo) => new Date(Date.now() - daysAgo * 864e5).toISOString();

const ORGANISATIONS = [
  {
    id: "org_001",
    name: "Cornerstone Youth Foundation",
    country: "Jamaica",
    city: "Kingston",
    category: "Youth Empowerment",
    description:
      "Providing mentorship, vocational training, and safe spaces for at-risk youth in the inner-city communities of Kingston.",
    mission:
      "To equip young Jamaicans aged 14–25 with skills, confidence, and purpose to build productive futures.",
    verified: true,
    followerCount: 248,
    totalRaised: 18500,
    impactScore: 94,
    coverImage: null,
    logo: null,
    contact: { email: "info@cornerstoneyouth.org.jm", phone: "+1876-555-0101" },
    socialLinks: { instagram: "@cornerstone_jm", twitter: "@cornerstonejm" },
    createdAt: D(180),
  },
  {
    id: "org_002",
    name: "Mothers in Need Jamaica",
    country: "Jamaica",
    city: "St Ann",
    category: "Maternal Health",
    description:
      "Supporting expectant and new mothers in rural Jamaica with prenatal care access, nutrition packs, and post-natal counselling.",
    mission:
      "No Jamaican mother should face pregnancy alone or without resources.",
    verified: true,
    followerCount: 195,
    totalRaised: 12300,
    impactScore: 91,
    coverImage: null,
    logo: null,
    contact: { email: "hello@mothersineed.jm", phone: "+1876-555-0202" },
    socialLinks: { instagram: "@mothersineed_jm" },
    createdAt: D(210),
  },
  {
    id: "org_003",
    name: "Green Roots Initiative",
    country: "Jamaica",
    city: "Westmoreland",
    category: "Environment",
    description:
      "Reforestation, community farming, and clean water projects protecting Westmoreland's watersheds and coastal communities.",
    mission:
      "Restore Jamaica's natural heritage one root at a time.",
    verified: true,
    followerCount: 143,
    totalRaised: 9200,
    impactScore: 87,
    coverImage: null,
    logo: null,
    contact: { email: "plant@greenroots.jm", phone: "+1876-555-0303" },
    socialLinks: { instagram: "@greenroots_jm", facebook: "GreenRootsJamaica" },
    createdAt: D(150),
  },
  {
    id: "org_004",
    name: "UK-Jamaica Bridge",
    country: "United Kingdom",
    city: "London",
    category: "Diaspora Support",
    description:
      "Connecting the Jamaican diaspora in the UK with verified grassroots organisations back home — channelling skills, funding, and solidarity.",
    mission:
      "Bridge the gap between communities across the Atlantic.",
    verified: true,
    followerCount: 312,
    totalRaised: 34100,
    impactScore: 96,
    coverImage: null,
    logo: null,
    contact: { email: "info@ukjamaicabridge.org", phone: "+44-207-555-0404" },
    socialLinks: { instagram: "@ukjamaicabridge", twitter: "@ukjambridge" },
    createdAt: D(365),
  },
  {
    id: "org_005",
    name: "Kingston Education Trust",
    country: "Jamaica",
    city: "Kingston",
    category: "Education",
    description:
      "Awarding scholarships, building school libraries, and funding teacher training in under-resourced primary and secondary schools across Kingston.",
    mission:
      "Every child in Kingston deserves a world-class education.",
    verified: true,
    followerCount: 221,
    totalRaised: 27600,
    impactScore: 93,
    coverImage: null,
    logo: null,
    contact: { email: "grants@kingstonedu.org.jm", phone: "+1876-555-0505" },
    socialLinks: { instagram: "@kingstonedu", facebook: "KingstonEducationTrust" },
    createdAt: D(270),
  },
  {
    id: "org_006",
    name: "The Healing Place",
    country: "Jamaica",
    city: "Montego Bay",
    category: "Mental Health",
    description:
      "Free and low-cost counselling, crisis support, and community mental-wellness workshops for individuals and families in western Jamaica.",
    mission:
      "Mental health care is not a luxury — it is a right for every Jamaican.",
    verified: true,
    followerCount: 176,
    totalRaised: 8400,
    impactScore: 89,
    coverImage: null,
    logo: null,
    contact: { email: "support@thehealingplace.jm", phone: "+1876-555-0606" },
    socialLinks: { instagram: "@thehealingplace_jm" },
    createdAt: D(120),
  },
];

const UPDATES = [
  {
    id: "upd_001",
    orgId: "org_001",
    orgName: "Cornerstone Youth Foundation",
    type: "milestone",
    title: "50 young people complete our carpentry programme",
    content:
      "We are proud to announce that 50 graduates from our 12-week carpentry and joinery programme received their certificates last Friday. 38 have already secured employment or started their own micro-businesses. Thank you to every donor who made this cohort possible.",
    imageUrl: null,
    likes: 87,
    createdAt: D(3),
  },
  {
    id: "upd_002",
    orgId: "org_002",
    orgName: "Mothers in Need Jamaica",
    type: "update",
    title: "Nutrition packs delivered to 120 rural mothers",
    content:
      "Our volunteers travelled to seven communities in St Ann this week, delivering monthly nutrition packs to 120 expectant and new mothers. Each pack includes iron supplements, folic acid, local produce, and a copy of our prenatal guide. The demand is far exceeding our supply — if you can help, please donate.",
    imageUrl: null,
    likes: 64,
    createdAt: D(5),
  },
  {
    id: "upd_003",
    orgId: "org_004",
    orgName: "UK-Jamaica Bridge",
    type: "campaign",
    title: "Jamaica Flood Relief — match-funded until 31 May",
    content:
      "Following the heavy flooding across St Thomas and Portland, we are match-funding all donations to our emergency relief partners up to £10,000. Every pound you give becomes two on the ground. Funds go directly to food, water, and temporary shelter for displaced families.",
    imageUrl: null,
    likes: 143,
    createdAt: D(7),
  },
  {
    id: "upd_004",
    orgId: "org_003",
    orgName: "Green Roots Initiative",
    type: "milestone",
    title: "10,000 trees planted — one root at a time",
    content:
      "We hit our 10,000 tree milestone! Across 14 sites in Westmoreland, local farmers, school children, and our volunteer crews have restored vital watershed corridors. Restoring these ecosystems protects downstream communities from floods and improves water quality for thousands of residents.",
    imageUrl: null,
    likes: 109,
    createdAt: D(10),
  },
  {
    id: "upd_005",
    orgId: "org_005",
    orgName: "Kingston Education Trust",
    type: "update",
    title: "New library opens at Trench Town Primary School",
    content:
      "After 18 months of fundraising and construction, Trench Town Primary School now has its first dedicated library — 1,200 books, reading nooks, and a laptop station. Headteacher Ms Clarke told us the children arrived two hours early just to read before the official opening.",
    imageUrl: null,
    likes: 198,
    createdAt: D(14),
  },
  {
    id: "upd_006",
    orgId: "org_006",
    orgName: "The Healing Place",
    type: "update",
    title: "Free mental health clinics return to Montego Bay",
    content:
      "Starting next month, our team of volunteer counsellors will run free weekly clinics at two community centres in Montego Bay. No referral needed, completely confidential. We are especially encouraging men to attend — breaking stigma is central to our mission.",
    imageUrl: null,
    likes: 52,
    createdAt: D(18),
  },
  {
    id: "upd_007",
    orgId: "org_001",
    orgName: "Cornerstone Youth Foundation",
    type: "campaign",
    title: "Help us fund the next cohort — 30 spots available",
    content:
      "Applications for our next vocational cohort are open. We have 30 spots across our carpentry, electrical, and digital-skills tracks — but we need £15,000 to cover materials, instructor fees, and certification costs. Can you help fill a spot?",
    imageUrl: null,
    likes: 71,
    createdAt: D(21),
  },
  {
    id: "upd_008",
    orgId: "org_004",
    orgName: "UK-Jamaica Bridge",
    type: "milestone",
    title: "Over £100,000 channelled to Jamaica in 2024",
    content:
      "We are deeply grateful to the UK diaspora community. In 2024, your collective generosity channelled over £100,000 directly to verified grassroots organisations across Jamaica. Every penny is tracked, reported, and accounted for. Impact reports available on request.",
    imageUrl: null,
    likes: 221,
    createdAt: D(28),
  },
  {
    id: "upd_009",
    orgId: "org_005",
    orgName: "Kingston Education Trust",
    type: "update",
    title: "Scholarship applications open for September 2025",
    content:
      "We are accepting scholarship applications for the 2025–26 academic year. Awards cover secondary school fees, uniforms, and school supplies for students from households earning under $500,000 JMD per year. Apply via our website or contact us directly — no application fees.",
    imageUrl: null,
    likes: 88,
    createdAt: D(35),
  },
  {
    id: "upd_010",
    orgId: "org_002",
    orgName: "Mothers in Need Jamaica",
    type: "milestone",
    title: "1,000 mothers supported since our founding",
    content:
      "Four years ago, we started with two volunteers and a WhatsApp group. Today, we have supported over 1,000 mothers across rural St Ann. Some of those first mothers are now our volunteers. This is what community looks like.",
    imageUrl: null,
    likes: 176,
    createdAt: D(42),
  },
];

const REVIEWS = [
  {
    id: "rev_001",
    orgId: "org_001",
    orgName: "Cornerstone Youth Foundation",
    authorId: "supporter_seed_01",
    authorName: "Delroy Campbell",
    rating: 5,
    content:
      "My nephew went through their electrical programme last year. He now has his own business and just hired two apprentices. The change in him is remarkable — the team truly cares.",
    createdAt: D(15),
    verified: true,
  },
  {
    id: "rev_002",
    orgId: "org_004",
    orgName: "UK-Jamaica Bridge",
    authorId: "supporter_seed_02",
    authorName: "Paulette Morrison",
    rating: 5,
    content:
      "I have been donating through UK-Jamaica Bridge for three years. Their transparency is exceptional — I get a full impact report every quarter and can trace exactly where my money went. Absolute trust.",
    createdAt: D(22),
    verified: true,
  },
  {
    id: "rev_003",
    orgId: "org_005",
    orgName: "Kingston Education Trust",
    authorId: "supporter_seed_03",
    authorName: "Simone Hylton",
    rating: 4,
    content:
      "Funded a scholarship for a student in my old community in Kingston. The family sends me updates — she is thriving and wants to become a doctor. Moments like this remind me why giving matters.",
    createdAt: D(30),
    verified: true,
  },
  {
    id: "rev_004",
    orgId: "org_006",
    orgName: "The Healing Place",
    authorId: "supporter_seed_01",
    authorName: "Delroy Campbell",
    rating: 5,
    content:
      "Mental health support in Jamaica is critically underfunded. The Healing Place is filling a massive gap. The free clinics helped a family member through a very difficult time. Deserves far more recognition.",
    createdAt: D(45),
    verified: true,
  },
];

const RESOURCES = [
  {
    id: "res_001",
    title: "Emergency Housing Support — Jamaica",
    category: "Housing",
    country: "Jamaica",
    description:
      "The National Housing Trust (NHT) operates an emergency repair grant programme for low-income homeowners affected by natural disasters or unsafe conditions. Applications are accepted year-round at NHT offices island-wide.",
    contact: {
      phone: "+1876-929-6500",
      email: "info@nht.gov.jm",
      website: "https://www.nht.gov.jm",
    },
    tags: ["housing", "emergency", "grants", "Jamaica"],
    createdAt: D(60),
  },
  {
    id: "res_002",
    title: "Legal Aid Council — Free Legal Assistance (Jamaica)",
    category: "Legal",
    country: "Jamaica",
    description:
      "The Legal Aid Council provides free legal representation and advice to qualifying Jamaican residents in criminal, civil, and family law matters. Offices in Kingston, Spanish Town, and Montego Bay.",
    contact: {
      phone: "+1876-967-3082",
      email: "legalaid@legalaid.gov.jm",
      website: "https://www.legalaid.gov.jm",
    },
    tags: ["legal", "free", "law", "Jamaica"],
    createdAt: D(60),
  },
  {
    id: "res_003",
    title: "Jamaican Diaspora Mental Health UK — Support Line",
    category: "Mental Health",
    country: "United Kingdom",
    description:
      "A confidential support line run by and for members of the Jamaican diaspora in the UK. Specialist counsellors with Caribbean cultural competency available Monday–Saturday 9am–8pm (GMT).",
    contact: {
      phone: "+44-800-555-0111",
      email: "support@jdmhuk.org",
      website: "https://www.jdmhuk.org",
    },
    tags: ["mental health", "diaspora", "UK", "counselling"],
    createdAt: D(60),
  },
];

// Seed supporter stubs (non-auth — just Firestore docs for review authors)
const SUPPORTER_STUBS = [
  {
    id: "supporter_seed_01",
    name: "Delroy Campbell",
    email: "delroy@seed.internal",
    accountType: "supporter",
    avatarInitials: "DC",
    createdAt: D(90),
  },
  {
    id: "supporter_seed_02",
    name: "Paulette Morrison",
    email: "paulette@seed.internal",
    accountType: "supporter",
    avatarInitials: "PM",
    createdAt: D(90),
  },
  {
    id: "supporter_seed_03",
    name: "Simone Hylton",
    email: "simone@seed.internal",
    accountType: "supporter",
    avatarInitials: "SH",
    createdAt: D(90),
  },
];

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Root ProjX — Firestore Seeder");
  console.log("Project:", PROJECT_ID);
  console.log("");

  // Get auth token
  console.log("Authenticating seeder...");
  const { idToken } = await getToken();
  console.log("");

  // Write collections
  const collections = [
    { name: "organisations", items: ORGANISATIONS },
    { name: "updates", items: UPDATES },
    { name: "reviews", items: REVIEWS },
    { name: "resources", items: RESOURCES },
    { name: "users", items: SUPPORTER_STUBS },
  ];

  for (const { name, items } of collections) {
    console.log(`Writing ${name} (${items.length} docs)...`);
    for (const item of items) {
      const { id, ...data } = item;
      await upsert(name, id, data, idToken);
      process.stdout.write("  .");
    }
    console.log(` done (${items.length})`);
  }

  console.log("");
  console.log("Seed complete.");
  console.log(
    `Collections: organisations(${ORGANISATIONS.length}), updates(${UPDATES.length}), ` +
    `reviews(${REVIEWS.length}), resources(${RESOURCES.length}), users(+${SUPPORTER_STUBS.length} stubs)`
  );
}

main().catch((e) => {
  console.error("Seed failed:", e.message ?? e);
  process.exit(1);
});
