/**
 * Root ProjX — App Store Screenshot Generator
 * Generates 6 screenshots at 1290×2796px (iPhone 6.7" Pro Max)
 */
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "../../artifacts/web/public/screenshots");
mkdirSync(OUT_DIR, { recursive: true });

const W = 1290;
const H = 2796;
const TOP_H = Math.round(H * 0.40); // 1118px
const BOT_H = H - TOP_H;            // 1678px

// Brand colours
const RED       = "#CC0000";
const RED_DARK  = "#A00000";
const RED_DEEP  = "#7A0000";
const GOLD      = "#F5C000";
const WHITE     = "#FFFFFF";
const CARD_BG   = "#F9F6F0";
const BORDER    = "#E0D8CC";
const MUTED     = "#888888";
const DARK      = "#1A1A1A";

// ─── helpers ─────────────────────────────────────────────────────────────────

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function fillRoundRect(ctx, x, y, w, h, r, color) {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();
}

function strokeRoundRect(ctx, x, y, w, h, r, color, lw = 1) {
  roundRect(ctx, x, y, w, h, r);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.stroke();
}

/** Draw top headline section */
function drawHeader(ctx, headline, subheadline, accent) {
  // Background
  ctx.fillStyle = RED;
  ctx.fillRect(0, 0, W, TOP_H);

  // Logo label
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "bold 36px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("ROOT PROJX", W / 2, 120);

  // Headline
  ctx.fillStyle = WHITE;
  ctx.font = "bold 148px sans-serif";
  ctx.textAlign = "center";
  const lines = headline.split("\n");
  let y = 260;
  for (const line of lines) {
    ctx.fillText(line, W / 2, y);
    y += 160;
  }

  // Subheadline
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.font = "bold 72px sans-serif";
  const subLines = subheadline.split("\n");
  for (const line of subLines) {
    ctx.fillText(line, W / 2, y);
    y += 86;
  }

  // Gold accent pill
  const pillW = 800;
  const pillH = 78;
  const pillX = (W - pillW) / 2;
  const pillY = TOP_H - pillH - 60;
  fillRoundRect(ctx, pillX, pillY, pillW, pillH, 39, "rgba(0,0,0,0.22)");
  ctx.fillStyle = GOLD;
  ctx.font = "bold 44px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(accent, W / 2, pillY + 53);
}

/** Draw bottom phone section */
function drawPhoneSection(ctx, drawScreen) {
  // Background
  ctx.fillStyle = RED_DARK;
  ctx.fillRect(0, TOP_H, W, BOT_H);

  // Phone frame dimensions
  const PH = 1400;
  const PW = Math.round(PH * (390 / 844));
  const PX = (W - PW) / 2;
  const PY = TOP_H + (BOT_H - PH) / 2;
  const BR = 90; // border radius

  // Drop shadow
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 80;
  ctx.shadowOffsetY = 40;
  fillRoundRect(ctx, PX, PY, PW, PH, BR, DARK);
  ctx.restore();

  // Phone body
  fillRoundRect(ctx, PX, PY, PW, PH, BR, DARK);

  // Outer bezel highlight
  ctx.save();
  roundRect(ctx, PX, PY, PW, PH, BR);
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  // Inner screen clip
  const PAD = 18;
  const SCX = PX + PAD;
  const SCY = PY + PAD;
  const SCW = PW - PAD * 2;
  const SCH = PH - PAD * 2;
  const SCR = BR - 8;

  ctx.save();
  roundRect(ctx, SCX, SCY, SCW, SCH, SCR);
  ctx.clip();

  // Screen background
  ctx.fillStyle = CARD_BG;
  ctx.fillRect(SCX, SCY, SCW, SCH);

  // Draw app screen content
  drawScreen(ctx, SCX, SCY, SCW, SCH);

  // Status bar (just a dark strip at top)
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.fillRect(SCX, SCY, SCW, 60);

  ctx.restore();

  // Dynamic island
  const DIW = 210;
  const DIH = 54;
  const DIX = SCX + (SCW - DIW) / 2;
  const DIY = SCY + 18;
  fillRoundRect(ctx, DIX, DIY, DIW, DIH, 27, DARK);

  // Side buttons
  ctx.fillStyle = "#333333";
  // Power button (right)
  fillRoundRect(ctx, PX + PW - 4, PY + 260, 8, 80, 4, "#333333");
  // Volume buttons (left)
  fillRoundRect(ctx, PX - 4, PY + 230, 8, 60, 4, "#333333");
  fillRoundRect(ctx, PX - 4, PY + 310, 8, 100, 4, "#333333");
  fillRoundRect(ctx, PX - 4, PY + 430, 8, 100, 4, "#333333");
}

/** Nav bar at top of phone screen */
function drawNavBar(ctx, x, y, w, title, subtitle) {
  ctx.fillStyle = "#B50000";
  ctx.fillRect(x, y, w, 110);
  ctx.fillStyle = WHITE;
  ctx.font = "bold 36px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(title, x + 28, y + 62);
  if (subtitle) {
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.font = "22px sans-serif";
    ctx.fillText(subtitle, x + 28, y + 92);
  }
}

/** Stat block used in org header */
function drawStat(ctx, x, y, value, label) {
  ctx.fillStyle = GOLD;
  ctx.font = "bold 32px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(value, x, y);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "18px sans-serif";
  ctx.fillText(label, x, y + 26);
}

/** Vertical divider */
function vDivider(ctx, x, y, h) {
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.fillRect(x, y, 2, h);
}

/** Progress bar */
function drawProgressBar(ctx, x, y, w, h, pct, fillColor = GOLD) {
  fillRoundRect(ctx, x, y, w, h, h / 2, BORDER);
  fillRoundRect(ctx, x, y, Math.round(w * pct), h, h / 2, fillColor);
}

// ─── Screen renderers ────────────────────────────────────────────────────────

function screenOrgProfile(ctx, sx, sy, sw, sh) {
  // Nav/hero
  ctx.fillStyle = "#B50000";
  ctx.fillRect(sx, sy, sw, 200);

  // Avatar
  fillRoundRect(ctx, sx + 28, sy + 70, 88, 88, 44, GOLD);
  ctx.fillStyle = RED_DEEP;
  ctx.font = "bold 30px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("CY", sx + 72, sy + 123);

  // Org name + location
  ctx.fillStyle = WHITE;
  ctx.font = "bold 32px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Cornerstone Youth Foundation", sx + 130, sy + 100);
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = "22px sans-serif";
  ctx.fillText("Kingston, Jamaica  ·  Youth Empowerment", sx + 130, sy + 132);

  // Verified badge
  fillRoundRect(ctx, sx + sw - 160, sy + 70, 136, 36, 18, GOLD);
  ctx.fillStyle = RED_DEEP;
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("✓  Verified", sx + sw - 92, sy + 93);

  // Stats row
  const statY = sy + 158;
  drawStat(ctx, sx + sw * 0.18, statY, "248", "Followers");
  vDivider(ctx, sx + sw * 0.33, statY - 18, 50);
  drawStat(ctx, sx + sw * 0.5, statY, "£18.5k", "Raised");
  vDivider(ctx, sx + sw * 0.67, statY - 18, 50);
  drawStat(ctx, sx + sw * 0.82, statY, "94", "Impact Score");

  // Description
  ctx.fillStyle = "#444";
  ctx.font = "24px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Providing mentorship, vocational training,", sx + 28, sy + 248);
  ctx.fillText("and safe spaces for at-risk youth.", sx + 28, sy + 280);

  // Donate button
  fillRoundRect(ctx, sx + 28, sy + 320, sw - 56, 80, 18, "#B50000");
  ctx.fillStyle = WHITE;
  ctx.font = "bold 34px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Donate Now", sx + sw / 2, sy + 371);

  // Campaign card
  fillRoundRect(ctx, sx + 28, sy + 430, sw - 56, 130, 16, WHITE);
  strokeRoundRect(ctx, sx + 28, sy + 430, sw - 56, 130, 16, BORDER, 1.5);
  ctx.fillStyle = DARK;
  ctx.font = "bold 26px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Help fund the next cohort", sx + 52, sy + 472);
  drawProgressBar(ctx, sx + 52, sy + 492, sw - 100, 14, 0.62);
  ctx.fillStyle = MUTED;
  ctx.font = "20px sans-serif";
  ctx.fillText("£9,300 raised of £15,000", sx + 52, sy + 538);
}

function screenDonationSuccess(ctx, sx, sy, sw, sh) {
  ctx.fillStyle = CARD_BG;
  ctx.fillRect(sx, sy, sw, sh);

  const cx = sx + sw / 2;

  // Circle
  fillRoundRect(ctx, cx - 72, sy + 80, 144, 144, 72, "#B50000");
  ctx.strokeStyle = WHITE;
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - 32, sy + 155);
  ctx.lineTo(cx - 4, sy + 183);
  ctx.lineTo(cx + 38, sy + 123);
  ctx.stroke();

  ctx.fillStyle = DARK;
  ctx.font = "bold 56px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Thank you!", cx, sy + 280);

  ctx.fillStyle = MUTED;
  ctx.font = "26px sans-serif";
  ctx.fillText("Your donation is on its way to", cx, sy + 324);
  ctx.fillText("Cornerstone Youth Foundation", cx, sy + 360);

  // Breakdown card
  const cardX = sx + 40;
  const cardW = sw - 80;
  fillRoundRect(ctx, cardX, sy + 410, cardW, 240, 20, WHITE);
  strokeRoundRect(ctx, cardX, sy + 410, cardW, 240, 20, BORDER, 1.5);

  ctx.fillStyle = MUTED;
  ctx.font = "bold 22px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("YOUR DONATION", cardX + 32, sy + 455);

  const rows = [
    ["You gave", "£25.00", DARK],
    ["To organisation", "£23.75", "#B50000"],
  ];
  let ry = sy + 495;
  for (const [label, val, col] of rows) {
    ctx.fillStyle = "#555";
    ctx.font = "28px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(label, cardX + 32, ry);
    ctx.fillStyle = col;
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(val, cardX + cardW - 32, ry);
    ry += 48;
  }

  // Divider
  ctx.fillStyle = BORDER;
  ctx.fillRect(cardX + 32, ry - 4, cardW - 64, 1.5);

  ctx.fillStyle = MUTED;
  ctx.font = "22px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Platform fee (5%)", cardX + 32, ry + 38);
  ctx.textAlign = "right";
  ctx.fillText("£1.25", cardX + cardW - 32, ry + 38);

  // 95% bar
  const barX = sx + 40;
  const barY = sy + 700;
  drawProgressBar(ctx, barX, barY, sw - 80, 20, 0.95);
  ctx.fillStyle = MUTED;
  ctx.font = "24px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("95% went directly to the cause", cx, barY + 52);
}

function screenUpdatesFeed(ctx, sx, sy, sw, sh) {
  drawNavBar(ctx, sx, sy, sw, "Updates", "Cornerstone Youth Foundation");
  let cy = sy + 130;

  const posts = [
    { tag: "MILESTONE", tagBg: "#B50000", tagFg: WHITE, title: "50 young people complete our carpentry programme", time: "3 days ago", likes: 87 },
    { tag: "CAMPAIGN", tagBg: GOLD, tagFg: RED_DEEP, title: "Help us fund the next cohort — 30 spots available", time: "21 days ago", likes: 71 },
    { tag: "UPDATE", tagBg: DARK, tagFg: WHITE, title: "New workshop space opens in Kingston", time: "1 month ago", likes: 55 },
  ];

  for (const p of posts) {
    fillRoundRect(ctx, sx + 20, cy, sw - 40, 200, 18, WHITE);
    strokeRoundRect(ctx, sx + 20, cy, sw - 40, 200, 18, BORDER, 1.5);

    // Tag pill
    fillRoundRect(ctx, sx + 40, cy + 22, 160, 38, 19, p.tagBg);
    ctx.fillStyle = p.tagFg;
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(p.tag, sx + 40 + 80, cy + 47);

    // Time
    ctx.fillStyle = MUTED;
    ctx.font = "20px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(p.time, sx + 214, cy + 47);

    // Title
    ctx.fillStyle = DARK;
    ctx.font = "bold 26px sans-serif";
    ctx.fillText(p.title, sx + 40, cy + 110);

    // Likes
    ctx.fillStyle = MUTED;
    ctx.font = "22px sans-serif";
    ctx.fillText(`♥  ${p.likes}`, sx + 40, cy + 162);

    cy += 220;
  }
}

function screenCampaigns(ctx, sx, sy, sw, sh) {
  drawNavBar(ctx, sx, sy, sw, "Campaigns", "Cornerstone Youth Foundation");
  let cy = sy + 130;

  const campaigns = [
    { title: "Vocational Skills Cohort 8", raised: "£9,300", goal: "£15,000", pct: 0.62, days: "18 days left" },
    { title: "New Community Workshop", raised: "£6,200", goal: "£8,000", pct: 0.77, days: "5 days left" },
    { title: "Mentorship Programme 2025", raised: "£3,100", goal: "£10,000", pct: 0.31, days: "42 days left" },
  ];

  for (const c of campaigns) {
    fillRoundRect(ctx, sx + 20, cy, sw - 40, 210, 18, WHITE);
    strokeRoundRect(ctx, sx + 20, cy, sw - 40, 210, 18, BORDER, 1.5);

    ctx.fillStyle = DARK;
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(c.title, sx + 42, cy + 52);

    drawProgressBar(ctx, sx + 42, cy + 74, sw - 82, 16, c.pct);

    ctx.fillStyle = "#B50000";
    ctx.font = "bold 28px sans-serif";
    ctx.fillText(c.raised, sx + 42, cy + 132);
    ctx.fillStyle = MUTED;
    ctx.font = "22px sans-serif";
    ctx.fillText(` of ${c.goal}`, sx + 42 + 130, cy + 132);

    // Days badge
    fillRoundRect(ctx, sx + sw - 200, cy + 110, 160, 36, 18, "rgba(181,0,0,0.1)");
    ctx.fillStyle = "#B50000";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(c.days, sx + sw - 120, cy + 134);

    cy += 230;
  }
}

function screenDiscover(ctx, sx, sy, sw, sh) {
  drawNavBar(ctx, sx, sy, sw, "Discover", null);

  // Search bar
  fillRoundRect(ctx, sx + 20, sy + 118, sw - 40, 58, 12, "rgba(255,255,255,0.18)");
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "24px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("🔍  Search organisations…", sx + 48, sy + 155);

  let cy = sy + 198;
  const orgs = [
    { init: "CY", name: "Cornerstone Youth Foundation", loc: "Kingston, Jamaica", cat: "Youth Empowerment", followers: "248 followers", raised: "£18.5k raised" },
    { init: "MJ", name: "Mothers in Need Jamaica", loc: "St Ann, Jamaica", cat: "Maternal Health", followers: "195 followers", raised: "£12.3k raised" },
    { init: "UJ", name: "UK-Jamaica Bridge", loc: "London, UK", cat: "Diaspora Support", followers: "312 followers", raised: "£34.1k raised" },
  ];

  for (const o of orgs) {
    fillRoundRect(ctx, sx + 20, cy, sw - 40, 190, 18, WHITE);
    strokeRoundRect(ctx, sx + 20, cy, sw - 40, 190, 18, BORDER, 1.5);

    // Avatar
    fillRoundRect(ctx, sx + 44, cy + 28, 76, 76, 38, "#B50000");
    ctx.fillStyle = WHITE;
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(o.init, sx + 82, cy + 72);

    // Name & location
    ctx.fillStyle = DARK;
    ctx.font = "bold 26px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(o.name, sx + 138, cy + 54);
    ctx.fillStyle = MUTED;
    ctx.font = "20px sans-serif";
    ctx.fillText(o.loc, sx + 138, cy + 82);

    // Category pill
    fillRoundRect(ctx, sx + 44, cy + 128, 200, 36, 10, "#F2EDE4");
    ctx.fillStyle = "#555";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(o.cat, sx + 44 + 100, cy + 152);

    // Stats
    ctx.fillStyle = MUTED;
    ctx.font = "20px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${o.followers}  ·  ${o.raised}`, sx + sw - 42, cy + 152);

    cy += 210;
  }
}

function screenHomeFeed(ctx, sx, sy, sw, sh) {
  // Logo nav
  ctx.fillStyle = "#B50000";
  ctx.fillRect(sx, sy, sw, 110);
  ctx.fillStyle = GOLD;
  ctx.font = "bold 44px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Root ProjX", sx + 28, sy + 62);
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = "22px sans-serif";
  ctx.fillText("Impact Feed", sx + 28, sy + 90);

  let cy = sy + 130;
  const posts = [
    { init: "CY", org: "Cornerstone Youth Foundation", time: "3d ago", tag: "MILESTONE", tagBg: "#B50000", tagFg: WHITE, title: "50 young people complete our carpentry programme", likes: 87 },
    { init: "UJ", org: "UK-Jamaica Bridge", time: "7d ago", tag: "CAMPAIGN", tagBg: GOLD, tagFg: RED_DEEP, title: "Jamaica Flood Relief — match-funded until 31 May", likes: 143 },
    { init: "GR", org: "Green Roots Initiative", time: "10d ago", tag: "MILESTONE", tagBg: "#B50000", tagFg: WHITE, title: "10,000 trees planted — one root at a time", likes: 109 },
  ];

  for (const p of posts) {
    fillRoundRect(ctx, sx + 20, cy, sw - 40, 210, 18, WHITE);
    strokeRoundRect(ctx, sx + 20, cy, sw - 40, 210, 18, BORDER, 1.5);

    // Avatar
    fillRoundRect(ctx, sx + 42, cy + 28, 64, 64, 32, "#B50000");
    ctx.fillStyle = WHITE;
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(p.init, sx + 74, cy + 66);

    // Org + time
    ctx.fillStyle = DARK;
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(p.org, sx + 122, cy + 52);
    ctx.fillStyle = MUTED;
    ctx.font = "20px sans-serif";
    ctx.fillText(p.time, sx + 122, cy + 78);

    // Tag
    fillRoundRect(ctx, sx + sw - 184, cy + 28, 148, 36, 18, p.tagBg);
    ctx.fillStyle = p.tagFg;
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(p.tag, sx + sw - 110, cy + 52);

    // Title
    ctx.fillStyle = DARK;
    ctx.font = "bold 26px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(p.title, sx + 42, cy + 126);

    // Likes
    ctx.fillStyle = MUTED;
    ctx.font = "22px sans-serif";
    ctx.fillText(`♥  ${p.likes}`, sx + 42, cy + 178);

    cy += 230;
  }
}

// ─── Screenshot definitions ──────────────────────────────────────────────────

const SCREENSHOTS = [
  {
    filename: "screenshot_1.png",
    headline: "Give Directly.",
    subheadline: "See The Impact.",
    accent: "No middlemen. Ever.",
    screen: screenOrgProfile,
  },
  {
    filename: "screenshot_2.png",
    headline: "No Middlemen.",
    subheadline: "Your donation goes straight\nto the source.",
    accent: "95% reaches the organisation.",
    screen: screenDonationSuccess,
  },
  {
    filename: "screenshot_3.png",
    headline: "Watch Progress",
    subheadline: "In Real Time.",
    accent: "Live updates from the ground.",
    screen: screenUpdatesFeed,
  },
  {
    filename: "screenshot_4.png",
    headline: "See Where",
    subheadline: "Your Money Goes.",
    accent: "Verified. Transparent. Real.",
    screen: screenCampaigns,
  },
  {
    filename: "screenshot_5.png",
    headline: "Follow The Causes",
    subheadline: "You Support.",
    accent: "Discover grassroots organisations worldwide.",
    screen: screenDiscover,
  },
  {
    filename: "screenshot_6.png",
    headline: "For The Diaspora.",
    subheadline: "By The Diaspora.",
    accent: "Restoration. Culture. Access.",
    screen: screenHomeFeed,
  },
];

// ─── Generate ─────────────────────────────────────────────────────────────────

for (const ss of SCREENSHOTS) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  drawHeader(ctx, ss.headline, ss.subheadline, ss.accent);
  drawPhoneSection(ctx, ss.screen);

  const buf = canvas.toBuffer("image/png");
  const outPath = join(OUT_DIR, ss.filename);
  writeFileSync(outPath, buf);
  console.log(`✓ ${ss.filename}  (${(buf.length / 1024).toFixed(0)} KB)`);
}

console.log(`\nAll 6 screenshots saved to:\n  ${OUT_DIR}`);
