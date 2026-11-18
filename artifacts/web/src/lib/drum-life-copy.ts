export const DRUM_LIFE_COPY = {
  storyHeading: "The story",
  budgetHeading: "What your money buys",
  budgetIntro: "Support hands-on drumming through instruments, tuition, workshop spaces and wellbeing support for children.",
  drumIntro: "The drum budget covers 50 drums at US$150 each (US$7,500 total), including the reclaimed-wood centre drum made by Humanity Ova Vanity.",
  budgetCurrencyNote: "All listed amounts are in US dollars (US$).",
} as const;

/** Short, factual summaries for the six current Drum Life budget descriptions. */
export function drumBudgetPurpose(detail: string): string | null {
  const text = detail.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  if (text.includes("50 drums") && text.includes("hands on learning") && text.includes("practice") && text.includes("performance")) {
    return "50 drums";
  }
  if (text.includes("three months") && text.includes("drumming tuition") && text.includes("moustafa reds")) {
    return "Drumming tuition";
  }
  if (text.includes("workshop spaces") && text.includes("learn") && text.includes("rehearse")) {
    return "Workshop spaces";
  }
  if (text.includes("transport and refreshments") && text.includes("attend") && text.includes("workshops")) {
    return "Transport & refreshments";
  }
  if (text.includes("on site social worker") && text.includes("wellbeing") && text.includes("trusted person")) {
    return "On-site wellbeing support";
  }
  if (text.includes("contingency fund") && text.includes("unforeseen programme costs")) {
    return "Contingency";
  }
  return null;
}
