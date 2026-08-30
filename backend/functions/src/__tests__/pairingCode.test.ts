import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {
  PAIRING_ALPHABET,
  PAIRING_CODE_LENGTH,
  canonicalizePairingCode,
  generatePairingCode,
  isExpired,
  nextPairingExpiry,
  pairingQrPayload,
} from "../pairingCode";

describe("generatePairingCode", () => {
  it("returns 6 characters from the safe alphabet", () => {
    const code = generatePairingCode();
    assert.equal(code.length, PAIRING_CODE_LENGTH);
    for (const ch of code) {
      assert.equal(PAIRING_ALPHABET.includes(ch), true, `unexpected ${ch}`);
    }
  });

  it("maps supplied bytes onto the alphabet", () => {
    const raw = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    const code = generatePairingCode(() => Buffer.from(raw));
    assert.equal(code, "ABCDEF");
  });

  it("produces distinct codes across many draws", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 80; i++) {
      seen.add(generatePairingCode());
    }
    assert.ok(seen.size > 60);
  });
});

describe("canonicalizePairingCode", () => {
  it("accepts lowercase and hyphenated input", () => {
    assert.equal(canonicalizePairingCode("ab-c2-3x"), "ABC23X");
  });

  it("rejects lookalikes that are not in the alphabet", () => {
    assert.equal(canonicalizePairingCode("ABC10X"), null);
    assert.equal(canonicalizePairingCode("ABCOIX"), null);
  });

  it("rejects the wrong length", () => {
    assert.equal(canonicalizePairingCode("ABC"), null);
    assert.equal(canonicalizePairingCode("ABCDEFG"), null);
  });
});

describe("pairingQrPayload", () => {
  it("uses the parentlock pair URL scheme", () => {
    assert.equal(pairingQrPayload("ABC23X"), "parentlock://pair?code=ABC23X");
  });
});

describe("expiry", () => {
  it("expires at the 24h boundary", () => {
    const start = 1_700_000_000_000;
    const expires = nextPairingExpiry(start);
    assert.equal(expires - start, 24 * 60 * 60 * 1000);
    assert.equal(isExpired(expires, expires - 1), false);
    assert.equal(isExpired(expires, expires), true);
  });
});
