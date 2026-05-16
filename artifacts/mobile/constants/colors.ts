/**
 * Root ProjX — exact brand colour system from replit.md
 *
 * --red:         #B50000  primary buttons, destructive
 * --red-deep:    #7A0000  nav bar bg, tab bar bg
 * --red-mid:     #9E0000  hover/pressed states
 * --gold:        #F5B800  active tab, highlights, CTAs, goal fill
 * --white:       #FFFFFF  backgrounds, inactive tab
 */

const colors = {
  light: {
    text: "#1A1A1A",
    tint: "#F5B800",

    background: "#FFFFFF",
    foreground: "#1A1A1A",

    card: "#F9F6F0",
    cardForeground: "#1A1A1A",

    primary: "#B50000",
    primaryForeground: "#FFFFFF",

    navBackground: "#7A0000",
    navForeground: "#FFFFFF",

    redMid: "#9E0000",

    accent: "#F5B800",
    accentForeground: "#1A1A1A",

    goldDim: "rgba(245,184,0,0.20)",

    whiteFaint: "rgba(255,255,255,0.12)",

    secondary: "#F2EDE4",
    secondaryForeground: "#1A1A1A",

    muted: "#F2EDE4",
    mutedForeground: "#888888",

    destructive: "#B50000",
    destructiveForeground: "#FFFFFF",

    border: "#E0D8CC",
    input: "#E0D8CC",

    success: "#2E7D32",
    successForeground: "#FFFFFF",

    tabBarBackground: "#7A0000",
    tabBarActive: "#F5B800",
    tabBarInactive: "#FFFFFF",

    goalFill: "#F5B800",
    goalTrack: "#E0D8CC",

    verified: "#2E7D32",
    verifiedForeground: "#FFFFFF",

    tagBefore: "#E8F4E8",
    tagBeforeForeground: "#2E7D32",
    tagDuring: "#FFF8E1",
    tagDuringForeground: "#F57F17",
    tagAfter: "#E3F2FD",
    tagAfterForeground: "#1565C0",

    overlay: "rgba(0,0,0,0.5)",
    shadow: "rgba(0,0,0,0.08)",
  },

  radius: 10,
};

export default colors;
