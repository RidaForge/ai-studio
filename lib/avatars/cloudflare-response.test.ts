import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
const { decodeCloudflareImage, inspectCloudflareResponse, validateCloudflareImage } = await import("./cloudflare-response" + ".ts");

test("keeps HTTP status and Cloudflare codes without exposing raw response messages", () => {
  const result = inspectCloudflareResponse(500, {
    success: false,
    errors: [{ code: 3007, message: "upstream diagnostic" }],
    result: { image: "private image data" },
  });
  assert.deepEqual(result, {
    ok: false,
    status: 500,
    code: "http_500_cf_3007",
    message: "Cloudflare Workers AI could not generate this image. Cloudflare error: upstream diagnostic",
  });
});

test("classifies malformed non-2xx JSON as an HTTP failure", () => {
  const result = inspectCloudflareResponse(502, null, false);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 502);
    assert.equal(result.code, "http_502");
  }
});

test("distinguishes daily quota exhaustion from temporary capacity", () => {
  const quota = inspectCloudflareResponse(429, { success: false, errors: [{ code: 3036 }] });
  const paymentQuota = inspectCloudflareResponse(402, { success: false, errors: [{ code: 3036 }] });
  const capacity = inspectCloudflareResponse(429, { success: false, errors: [{ code: 3040 }] });
  assert.equal(quota.ok ? null : quota.code, "quota_exhausted_cf_3036");
  assert.equal(paymentQuota.ok ? null : paymentQuota.code, "quota_exhausted_cf_3036");
  assert.equal(capacity.ok ? null : capacity.code, "rate_limited_cf_3040");
});

test("classifies Cloudflare failure envelopes and paid plan errors", () => {
  const failed = inspectCloudflareResponse(200, { success: false, errors: [{ code: "5004" }] });
  const paidPlan = inspectCloudflareResponse(403, { success: false, errors: [{ code: 5035 }] });
  assert.equal(failed.ok ? null : failed.code, "cloudflare_error_cf_5004");
  assert.equal(paidPlan.ok ? null : paidPlan.code, "paid_plan_required_cf_5035");
});

test("preserves every Cloudflare error message while redacting sensitive values", () => {
  const privatePrompt = "custom private prompt text";
  const privateImage = Buffer.from("private image bytes ".repeat(20)).toString("base64");
  const result = inspectCloudflareResponse(400, {
    success: false,
    errors: [
      { code: 3030, message: `Prompt was rejected: ${privatePrompt}` },
      { code: 3031, message: `Image payload was invalid: ${privateImage}` },
    ],
    result: {},
  }, true, [privatePrompt]);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "http_400_cf_3030_3031");
    assert.match(result.message, /Prompt was rejected: \[redacted input\]/);
    assert.match(result.message, /Image payload was invalid: \[base64 data redacted\]/);
    assert.equal(result.message.includes(privatePrompt), false);
    assert.equal(result.message.includes(privateImage), false);
  }
});

test("classifies the confirmed output safety rejection without hiding the upstream message", () => {
  const result = inspectCloudflareResponse(400, {
    success: false,
    errors: [{
      code: 3030,
      message: "AiError: AiError: Your output has been flagged. Please choose another prompt / input image combination (92916909-42b5-40a8-a031-40262df47f3c)",
    }],
    result: {},
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 400);
    assert.equal(result.code, "content_safety_rejected_cf_3030");
    assert.match(result.message, /Cloudflare content safety rejected the generated output/);
    assert.match(result.message, /Your output has been flagged/);
    assert.match(result.message, /92916909-42b5-40a8-a031-40262df47f3c/);
  }
});

test("distinguishes malformed structures, missing image, and invalid Base64", () => {
  assert.equal(getFailureCode(inspectCloudflareResponse(200, { result: { image: "AAAA" } })), "malformed_response_structure");
  assert.equal(getFailureCode(inspectCloudflareResponse(200, { success: true, errors: [], result: {} })), "missing_image_data");
  assert.equal(getFailureCode(inspectCloudflareResponse(200, { success: true, errors: [], result: { image: "not base64" } })), "invalid_base64_image");
});

test("decodes canonical Base64 and rejects undecodable payloads", () => {
  const valid = decodeCloudflareImage(Buffer.from("png bytes").toString("base64"));
  const invalid = decodeCloudflareImage("AB==");
  assert.equal(valid.ok, true);
  assert.equal(invalid.ok, false);
});

test("distinguishes image decoding failures from unsupported formats", async () => {
  const corrupt = await validateCloudflareImage(Buffer.from("not an image"), Buffer.alloc(0));
  const gif = await sharp({ create: { width: 1, height: 1, channels: 3, background: "white" } })
    .gif().toBuffer();
  const unsupported = await validateCloudflareImage(gif, Buffer.alloc(0));
  assert.equal(corrupt.ok ? null : corrupt.code, "image_validation_failed");
  assert.equal(unsupported.ok ? null : unsupported.code, "unsupported_image_format");
});

test("accepts a validated PNG image", async () => {
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "white" } })
    .png().toBuffer();
  const result = await validateCloudflareImage(png, Buffer.alloc(0));
  assert.deepEqual(result, { ok: true, mimeType: "image/png" });
});

test("rejects a PNG with corrupted image data during full validation", async () => {
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "white" } })
    .png().toBuffer();
  const corruptedPng = Buffer.from(png);
  corruptedPng[corruptedPng.length - 16] ^= 0xff;
  const result = await validateCloudflareImage(corruptedPng, Buffer.alloc(0));
  assert.equal(getFailureCode(result), "image_validation_failed");
});

function getFailureCode(result: { ok: true } | { ok: false; code: string }) {
  return result.ok ? null : result.code;
}
