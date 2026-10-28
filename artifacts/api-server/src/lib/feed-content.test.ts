import assert from "node:assert/strict";
import test from "node:test";
import { normaliseContentLink } from "./feed-content.ts";

test("content links are optional and require no Instagram account connection", () => {
  for (const value of [undefined, null, "", "  "]) assert.equal(normaliseContentLink(value), null);
  assert.equal(normaliseContentLink("https://www.instagram.com/reel/ABC_123/?igsh=tracking"),
    "https://www.instagram.com/reel/ABC_123/");
  assert.equal(normaliseContentLink("https://instagram.com/p/ABC-123/"), "https://instagram.com/p/ABC-123/");
});

test("public YouTube and Vimeo video links retain their video identity without tracking", () => {
  assert.equal(normaliseContentLink("https://www.youtube.com/watch?v=abcdefghijk&si=tracking"),
    "https://www.youtube.com/watch?v=abcdefghijk");
  assert.equal(normaliseContentLink("https://youtu.be/abcdefghijk?si=tracking"), "https://youtu.be/abcdefghijk");
  assert.equal(normaliseContentLink("https://youtube.com/shorts/abcdefghijk"), "https://youtube.com/shorts/abcdefghijk");
  assert.equal(normaliseContentLink("https://vimeo.com/123456"), "https://vimeo.com/123456");
});

test("content links reject unsafe schemes, spoofed hosts and unsupported pages", () => {
  for (const value of [
    "javascript:alert(1)", "http://instagram.com/p/abc/", "<iframe src=x>", 123,
    "https://instagram.com.evil.com/p/abc/", "https://evil.com/?instagram.com",
    "https://user:password@instagram.com/p/abc/", "https://instagram.com:444/p/abc/",
    "https://instagram.com/some-profile/", "https://youtube.com/watch?v=invalid",
    "https://vimeo.com/some-profile", "https://youtube.com/embed/abcdefghijk",
  ]) assert.throws(() => normaliseContentLink(value), Error);
});
