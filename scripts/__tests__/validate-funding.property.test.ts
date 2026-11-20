/**
 * Property-based tests for the funding configuration validator.
 *
 * Encodes **Property 1: Funding URL HTTPS Validation** from the design
 * document:
 *
 *   *For any* URL present in the FUNDING.yml configuration file, the URL SHALL
 *   use the HTTPS protocol. Non-HTTPS URLs SHALL be rejected with a validation
 *   error.
 *
 * **Validates: Requirements 4.2**
 *
 * The tests generate arbitrary funding configurations with fast-check,
 * serialize them to YAML with js-yaml, and feed the result to
 * {@link validateFunding}. Two directions are exercised:
 *
 *   1. Well-formed inputs (at least one recognized platform, every URL — notably
 *      `custom` entries — using HTTPS) MUST be reported as `valid === true`.
 *   2. Inputs seeded with at least one non-HTTPS URL (http://, ftp://, etc.)
 *      MUST be reported as `valid === false` with a corresponding HTTPS error.
 *
 * Run with: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import * as fc from "fast-check";
import * as yaml from "js-yaml";

import {
  validateFunding,
  MAX_GITHUB_USERNAMES,
  MAX_CUSTOM_URLS,
} from "../validate-funding";

/** Number of generated cases per property. */
const NUM_RUNS = 500;

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * A plain funding slug/username that does NOT look like a URL (contains no
 * `://` scheme separator) and survives `.trim()` intact. Used as the value for
 * recognized string platforms (patreon, ko_fi, open_collective, ...) and for
 * the `github` platform, so those entries never trip the URL check and the
 * positive-direction config stays valid.
 */
const slugArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 20 })
  .map((s) => s.replace(/[^A-Za-z0-9_-]/g, "_"))
  .filter((s) => s.length > 0 && !s.includes("://"));

/** A host label built from a URL-safe, non-empty character set. */
const hostLabelArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 12 })
  .map((s) => s.replace(/[^A-Za-z0-9-]/g, "a"))
  .map((s) => s.replace(/^-+|-+$/g, "a"))
  .filter((s) => s.length > 0);

/** An optional URL path segment, URL-safe and possibly empty. */
const pathArb: fc.Arbitrary<string> = fc
  .string({ minLength: 0, maxLength: 20 })
  .map((s) => s.replace(/[^A-Za-z0-9/_-]/g, ""))
  .map((s) => (s.length > 0 ? `/${s.replace(/^\/+/, "")}` : ""));

/** A well-formed HTTPS URL that `new URL()` parses with protocol `https:`. */
const httpsUrlArb: fc.Arbitrary<string> = fc
  .tuple(hostLabelArb, hostLabelArb, pathArb)
  .map(([a, b, path]) => `https://${a}.${b}.com${path}`);

/**
 * A URL whose scheme is NOT https. Covers http, ftp, and a handful of other
 * schemes so the generator exercises the full "non-HTTPS" input space. The
 * resulting string is always a value `new URL()` can parse (so the validator
 * reaches the protocol check rather than an "invalid URL" branch).
 */
const nonHttpsUrlArb: fc.Arbitrary<string> = fc
  .tuple(
    fc.constantFrom("http", "ftp", "ftps", "ws", "mailto+x", "gopher"),
    hostLabelArb,
    hostLabelArb,
    pathArb,
  )
  .map(([scheme, a, b, path]) => `${scheme}://${a}.${b}.com${path}`);

/** Recognized platforms that accept a single plain-string (non-URL) slug. */
const SINGLE_STRING_PLATFORMS = [
  "patreon",
  "open_collective",
  "ko_fi",
  "tidelift",
  "community_bridge",
  "liberapay",
  "issuehunt",
  "lfx_crowdfunding",
  "polar",
  "buy_me_a_coffee",
  "thanks_dev",
  "otechie",
] as const;

/**
 * A plain funding configuration object: at least one recognized platform,
 * `github` kept within its username limit, and `custom` holding HTTPS URLs
 * within its limit. Every URL present uses HTTPS, so this config is otherwise
 * well-formed and should validate as `valid === true`.
 */
const wellFormedConfigArb: fc.Arbitrary<Record<string, unknown>> = fc
  .record(
    {
      // 0..MAX_GITHUB_USERNAMES github usernames (plain slugs, never URLs).
      github: fc.array(slugArb, { minLength: 0, maxLength: MAX_GITHUB_USERNAMES }),
      // A subset of single-string platforms, each with a plain slug value.
      singles: fc.uniqueArray(fc.constantFrom(...SINGLE_STRING_PLATFORMS), {
        minLength: 0,
        maxLength: SINGLE_STRING_PLATFORMS.length,
      }),
      singleValues: fc.array(slugArb, {
        minLength: SINGLE_STRING_PLATFORMS.length,
        maxLength: SINGLE_STRING_PLATFORMS.length,
      }),
      // 0..MAX_CUSTOM_URLS custom URLs, all HTTPS.
      custom: fc.array(httpsUrlArb, { minLength: 0, maxLength: MAX_CUSTOM_URLS }),
    },
    { requiredKeys: ["github", "singles", "singleValues", "custom"] },
  )
  // Guarantee at least one recognized platform is present and non-empty.
  .filter(
    (r) => r.github.length > 0 || r.singles.length > 0 || r.custom.length > 0,
  )
  .map((r) => {
    const config: Record<string, unknown> = {};

    if (r.github.length > 0) {
      config.github = r.github.length === 1 ? r.github[0] : r.github;
    }

    r.singles.forEach((platform, i) => {
      config[platform] = r.singleValues[i];
    });

    if (r.custom.length > 0) {
      config.custom = r.custom.length === 1 ? r.custom[0] : r.custom;
    }

    return config;
  });

/** Serialize a funding config object to the YAML mapping the validator reads. */
function toYaml(config: Record<string, unknown>): string {
  return yaml.dump(config);
}

/** Extract the list of custom URLs currently in a config (0, 1, or many). */
function customUrls(config: Record<string, unknown>): string[] {
  const value = config.custom;
  if (value === undefined) return [];
  return Array.isArray(value) ? [...(value as string[])] : [String(value)];
}

// ---------------------------------------------------------------------------
// Property 1 — positive direction: all-HTTPS configs validate as valid.
// ---------------------------------------------------------------------------

test("Property 1: configs whose URLs all use HTTPS validate as valid", () => {
  fc.assert(
    fc.property(wellFormedConfigArb, (config) => {
      const result = validateFunding(toYaml(config), "FUNDING.yml");
      assert.equal(
        result.valid,
        true,
        `Expected valid=true but got errors: ${JSON.stringify(result.errors)}`,
      );
      assert.equal(result.errors.length, 0);
    }),
    { numRuns: NUM_RUNS },
  );
});

// ---------------------------------------------------------------------------
// Property 1 — negative direction: a non-HTTPS custom URL must be rejected.
// ---------------------------------------------------------------------------

test("Property 1: a config containing a non-HTTPS custom URL is rejected", () => {
  fc.assert(
    fc.property(
      wellFormedConfigArb,
      nonHttpsUrlArb,
      fc.nat(),
      (config, badUrl, pick) => {
        // Inject the non-HTTPS URL into the `custom` list, keeping the total
        // within MAX_CUSTOM_URLS so the only defect is the protocol itself.
        const urls = customUrls(config);
        if (urls.length >= MAX_CUSTOM_URLS) {
          urls[pick % urls.length] = badUrl;
        } else {
          urls.splice(pick % (urls.length + 1), 0, badUrl);
        }
        const corrupted: Record<string, unknown> = {
          ...config,
          custom: urls.length === 1 ? urls[0] : urls,
        };

        const result = validateFunding(toYaml(corrupted), "FUNDING.yml");
        assert.equal(
          result.valid,
          false,
          `Expected valid=false for non-HTTPS URL "${badUrl}"`,
        );
        assert.ok(
          result.errors.some((e) => e.toUpperCase().includes("HTTPS")),
          `Expected an HTTPS error, got: ${JSON.stringify(result.errors)}`,
        );
      },
    ),
    { numRuns: NUM_RUNS },
  );
});

// ---------------------------------------------------------------------------
// Property 1 — negative direction: a non-HTTPS URL on a string platform (which
// only triggers the URL check when the value looks like a URL) is rejected.
// ---------------------------------------------------------------------------

test("Property 1: a non-HTTPS URL on a string platform is rejected", () => {
  fc.assert(
    fc.property(
      wellFormedConfigArb,
      nonHttpsUrlArb,
      fc.constantFrom(...SINGLE_STRING_PLATFORMS),
      (config, badUrl, platform) => {
        // Overwrite one recognized string platform with a non-HTTPS URL value.
        // The validator treats any value containing "://" as a URL and must
        // reject it for not using HTTPS.
        const corrupted: Record<string, unknown> = {
          ...config,
          [platform]: badUrl,
        };

        const result = validateFunding(toYaml(corrupted), "FUNDING.yml");
        assert.equal(
          result.valid,
          false,
          `Expected valid=false for non-HTTPS URL "${badUrl}" on "${platform}"`,
        );
        assert.ok(
          result.errors.some((e) => e.toUpperCase().includes("HTTPS")),
          `Expected an HTTPS error, got: ${JSON.stringify(result.errors)}`,
        );
      },
    ),
    { numRuns: NUM_RUNS },
  );
});
