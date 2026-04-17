/**
 * Root ProjX — exact colour system (do not deviate from these values)
 *
 * Deep red background, gold accent, clean whites and greys.
 * This is the perfected colour system — match it on every screen, every component.
 */

const colors = {
  light: {
    // Legacy aliases
    text: "#1A1A1A",
    tint: "#C9A84C",

    // Core surfaces
    background: "#FFFFFF",
    foreground: "#1A1A1A",

    // Cards / elevated surfaces
    card: "#F9F6F0",
    cardForeground: "#1A1A1A",

    // Primary action — Deep Red (nav bars, primary buttons)
    primary: "#8B1A1A",
    primaryForeground: "#FFFFFF",

    // Gold accent — active tabs, highlights, badges, CTA secondary
    accent: "#C9A84C",
    accentForeground: "#1A1A1A",

    // Secondary surfaces
    secondary: "#F2EDE4",
    secondaryForeground: "#1A1A1A",

    // Muted — timestamps, subtitles, placeholders
    muted: "#F2EDE4",
    mutedForeground: "#888888",

    // Destructive actions
    destructive: "#C0392B",
    destructiveForeground: "#FFFFFF",

    // Borders and inputs
    border: "#E0D8CC",
    input: "#E0D8CC",

    // Success
    success: "#2E7D32",
    successForeground: "#FFFFFF",

    // Tab bar
    tabBarBackground: "#8B1A1A",
    tabBarActive: "#C9A84C",
    tabBarInactive: "#FFFFFF",

    // Nav
    navBackground: "#8B1A1A",
    navForeground: "#FFFFFF",

    // Goal tracker
    goalFill: "#C9A84C",
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

  // No separate dark mode — app uses light only
  radius: 10,
};

export default colors;
