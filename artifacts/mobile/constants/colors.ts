/**
 * Root ProjX — exact colour system (do not deviate)
 *
 * --red:         #B50000
 * --red-deep:    #7A0000
 * --red-mid:     #9E0000
 * --gold:        #F5B800
 * --white:       #FFFFFF
 * --white-faint: rgba(255,255,255,0.12)
 * --gold-dim:    rgba(245,184,0,0.55)
 */

const colors = {
  light: {
    // Legacy aliases
    text: "#1A1A1A",
    tint: "#F5B800",

    // Core surfaces
    background: "#FFFFFF",
    foreground: "#1A1A1A",

    // Cards / elevated surfaces
    card: "#F9F6F0",
    cardForeground: "#1A1A1A",

    // Primary action — Red (#B50000)
    primary: "#B50000",
    primaryForeground: "#FFFFFF",

    // Deep red — nav bar background, headers
    navBackground: "#7A0000",
    navForeground: "#FFFFFF",

    // Mid red — hover / pressed states
    redMid: "#9E0000",

    // Gold accent — active tabs, highlights, CTAs
    accent: "#F5B800",
    accentForeground: "#1A1A1A",

    // Dimmed gold — subtle highlights, backgrounds
    goldDim: "rgba(245,184,0,0.55)",

    // White faint — overlay text on dark surfaces
    whiteFaint: "rgba(255,255,255,0.12)",

    // Secondary surfaces
    secondary: "#F2EDE4",
    secondaryForeground: "#1A1A1A",

    // Muted — timestamps, subtitles, placeholders
    muted: "#F2EDE4",
    mutedForeground: "#888888",

    // Destructive actions
    destructive: "#B50000",
    destructiveForeground: "#FFFFFF",

    // Borders and inputs
    border: "#E0D8CC",
    input: "#E0D8CC",

    // Success
    success: "#2E7D32",
    successForeground: "#FFFFFF",

    // Tab bar
    tabBarBackground: "#7A0000",
    tabBarActive: "#F5B800",
    tabBarInactive: "#FFFFFF",

    // Goal tracker
    goalFill: "#F5B800",
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
