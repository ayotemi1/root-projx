/**
 * Root ProjX — colour system derived from official logo
 *
 * --red:         #E31C23  (bright candy red — logo background)
 * --red-deep:    #C1181E  (15% darker — nav headers)
 * --red-mid:     #D11A20  (8% darker  — card surfaces / hover)
 * --gold:        #F5C200  (bright warm yellow-gold — logo script)
 * --white:       #FFFFFF
 * --white-faint: rgba(255,255,255,0.12)
 * --gold-dim:    rgba(245,194,0,0.55)
 */

const colors = {
  light: {
    // Legacy aliases
    text: "#1A1A1A",
    tint: "#F5C200",

    // Core surfaces
    background: "#FFFFFF",
    foreground: "#1A1A1A",

    // Cards / elevated surfaces
    card: "#F9F6F0",
    cardForeground: "#1A1A1A",

    // Primary action — Candy Red (#E31C23)
    primary: "#E31C23",
    primaryForeground: "#FFFFFF",

    // Deep red — nav bar background, headers (15% darker)
    navBackground: "#C1181E",
    navForeground: "#FFFFFF",

    // Mid red — hover / pressed states (8% darker)
    redMid: "#D11A20",

    // Gold accent — active tabs, highlights, CTAs
    accent: "#F5C200",
    accentForeground: "#1A1A1A",

    // Dimmed gold — subtle highlights, backgrounds
    goldDim: "rgba(245,194,0,0.55)",

    // White faint — overlay text on dark surfaces
    whiteFaint: "rgba(255,255,255,0.12)",

    // Secondary surfaces
    secondary: "#F2EDE4",
    secondaryForeground: "#1A1A1A",

    // Muted — timestamps, subtitles, placeholders
    muted: "#F2EDE4",
    mutedForeground: "#888888",

    // Destructive actions
    destructive: "#E31C23",
    destructiveForeground: "#FFFFFF",

    // Borders and inputs
    border: "#E0D8CC",
    input: "#E0D8CC",

    // Success
    success: "#2E7D32",
    successForeground: "#FFFFFF",

    // Tab bar
    tabBarBackground: "#C1181E",
    tabBarActive: "#F5C200",
    tabBarInactive: "#FFFFFF",

    // Goal tracker
    goalFill: "#F5C200",
    goalTrack: "#E0D8CC",

    // Verified badge
    verified: "#2E7D32",
    verifiedForeground: "#FFFFFF",

    // Tag colours
    tagBefore: "#E8F4E8",
    tagBeforeForeground: "#2E7D32",
    tagDuring: "#FFF8E1",
    tagDuringForeground: "#F57F17",
    tagAfter: "#E3F2FD",
    tagAfterForeground: "#1565C0",

    // Overlay
    overlay: "rgba(0,0,0,0.5)",

    // Shadow
    shadow: "rgba(0,0,0,0.08)",
  },

  radius: 10,
};

export default colors;
