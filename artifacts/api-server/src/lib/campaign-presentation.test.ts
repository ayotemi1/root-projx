import assert from "node:assert/strict";
import test from "node:test";
import { campaignPresentation, campaignCounter } from "./campaign-presentation.ts";

test("only Out of Many Hands has a wall and hand language", () => {
  const wall = { _id: "hov_out_of_many_hands", name: "Out of Many Hands" };
  assert.deepEqual(campaignPresentation(wall), {
    icon: "hand", symbolColour: "#CA0813", confirmationLine: "and your hand is on the wall",
    counterLabel: "Your hand · No. {n}", hasWall: true,
  });
  assert.equal(campaignCounter(wall, 4), "Your hand · No. 4");
  const drum = { name: "Drum Life", amountRaised: 301 };
  assert.equal(campaignPresentation(drum).icon, "drum");
  assert.equal(campaignPresentation(drum).hasWall, false);
  assert.equal(campaignPresentation(drum).confirmationLine, "and you're helping light up a drum");
  assert.equal(campaignCounter(drum, 99), "Drum 3 of 50");
  assert.equal(campaignCounter({ ...drum, amountRaised: 99999 }), "Drum 50 of 50");
  const fallback = campaignPresentation({ name: "A different campaign", theme: { unit: { singular: "hand" } } } as any);
  assert.equal(fallback.icon, "heart");
  assert.equal(fallback.confirmationLine, "");
  assert.equal(fallback.hasWall, false);
  assert.equal(campaignCounter({ name: "Other" }, 12), "Supporter no. 12");
});

test("saved presentation settings are used without allowing a hand on another campaign", () => {
  const c = { name: "Other", donationPresentation: {
    icon: "drum", symbolColour: "#123456", counterLabel: "Backer {n}", confirmationLine: "thank you for your support",
  } };
  assert.equal(campaignPresentation(c).icon, "drum");
  assert.equal(campaignPresentation(c).symbolColour, "#123456");
  assert.equal(campaignPresentation(c).confirmationLine, "thank you for your support");
  assert.equal(campaignPresentation(c).counterLabel, "Backer {n}");
  const invalid = campaignPresentation({ name: "Other", donationPresentation: {
    icon: "hand", hasWall: true, confirmationLine: "your hand is on the wall", counterLabel: "Hand {n}",
  } });
  assert.equal(invalid.icon, "heart");
  assert.equal(invalid.hasWall, false);
  assert.equal(invalid.confirmationLine, "");
});
