const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { loadTokenizer } = require("../nlp/tokenizer");
const { analyse, loadGazetteer, findNameSpan, normalize } = require("../nlp/analyser");

const MODEL_DIR = path.join(__dirname, "..", "vendor", "tokenizer", "xlm-roberta-base");
const GAZETTEER = loadGazetteer(path.join(__dirname, "..", "nlp", "gazetteer.json"));
const silent = { warn: () => {}, info: () => {} };

const run = (tokens, mode = "subword") => analyse(tokens, { gazetteer: GAZETTEER, mode, logger: silent });

test.before(async () => {
  await loadTokenizer(MODEL_DIR);
});

// Every expectation below is the measured output of xlm-roberta-base, cross-checked against the
// Rust `tokenizers` reference implementation.
test("returns the real sub-word pieces for a Hebrew name that does not fragment", () => {
  const result = run(["תל", "אביב"]);
  assert.deepEqual(result.tokens, ["▁תל", "▁אביב"]);
  assert.deepEqual(result.prediction, ["name", "name"]);
});

test("labels every piece of a Hebrew name that fragments", () => {
  // פתח תקווה is 2 words but 3 pieces - the case that produced name: "ווה" downstream
  const result = run(["פתח", "תקווה"]);
  assert.deepEqual(result.tokens, ["▁פתח", "▁תק", "ווה"]);
  assert.deepEqual(result.prediction, ["name", "name", "name"]);
});

test("labels a bare word-start marker as part of the word it opens", () => {
  const result = run(["אום", "אל", "פחם"]);
  assert.deepEqual(result.tokens, ["▁אום", "▁אל", "▁", "פח", "ם"]);
  assert.deepEqual(result.prediction, ["name", "name", "name", "name", "name"]);
});

test("separates the essence from the name", () => {
  const result = run(["בית", "ספר", "תל", "אביב"]);
  assert.deepEqual(result.tokens, ["▁בית", "▁ספר", "▁תל", "▁אביב"]);
  assert.deepEqual(result.prediction, ["essence", "essence", "name", "name"]);
});

test("still fragments and labels the english cases", () => {
  const result = run(["new", "york"]);
  assert.deepEqual(result.tokens, ["▁new", "▁yor", "k"]);
  assert.deepEqual(result.prediction, ["name", "name", "name"]);
});

test("labels everything as essence when no place is recognised", () => {
  const result = run(["airport"]);
  assert.deepEqual(result.tokens, ["▁airport"]);
  assert.deepEqual(result.prediction, ["essence"]);
});

test("keeps tokens and prediction the same length for every input", () => {
  const inputs = [["תל", "אביב"], ["airport", "los", "angeles"], ["צהל"], ["בת־ים"], ["القدس"], ["تهران"], ["a"]];
  for (const input of inputs) {
    const result = run(input);
    assert.equal(result.tokens.length, result.prediction.length, `mismatch for ${input.join(" ")}`);
  }
});

test("word mode returns the caller's own tokens, for a consumer that cannot aggregate pieces", () => {
  const result = run(["בית", "ספר", "תל", "אביב"], "word");
  assert.deepEqual(result.tokens, ["בית", "ספר", "תל", "אביב"]);
  assert.deepEqual(result.prediction, ["essence", "essence", "name", "name"]);
});

test("handles an empty token list", () => {
  assert.deepEqual(run([]), { tokens: [], prediction: [] });
});

test("drops empty tokens, which cleanQuery produces from a trailing separator", () => {
  const result = run(["תל", "אביב", ""]);
  assert.deepEqual(result.tokens, ["▁תל", "▁אביב"]);
});

test("findNameSpan prefers the longest match", () => {
  assert.deepEqual(findNameSpan(["תל", "אביב"], GAZETTEER), [0, 2]);
  assert.deepEqual(findNameSpan(["בית", "ספר", "תל", "אביב"], GAZETTEER), [2, 4]);
  assert.equal(findNameSpan(["airport"], GAZETTEER), undefined);
});

test("normalize strips diacritics, markers and case", () => {
  assert.equal(normalize("▁Tel"), "tel");
  assert.equal(normalize("רִאשׁוֹן"), "ראשון");
});
