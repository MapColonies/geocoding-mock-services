const fs = require("node:fs");

const { tokenize, groupPiecesByWord, WORD_START_MARKER } = require("./tokenizer");

const NAME = "name";
const ESSENCE = "essence";

/** Hebrew points and cantillation marks - stripped so a pointed query still matches the gazetteer. */
const HEBREW_DIACRITICS = /[֑-ׇ]/g;
const MARKER_GLOBAL = /▁/g;

const normalize = (value) =>
  value.normalize("NFC").replace(MARKER_GLOBAL, "").replace(HEBREW_DIACRITICS, "").trim().toLowerCase();

const loadGazetteer = (gazetteerPath) => {
  const raw = JSON.parse(fs.readFileSync(gazetteerPath, "utf8"));
  const places = Array.isArray(raw.places) ? raw.places : [];

  return {
    entries: new Set(places.map(normalize)),
    maxWords: places.reduce((max, place) => Math.max(max, place.split(/\s+/).length), 1),
  };
};

/**
 * The longest contiguous span of `words` present in the gazetteer, as `[start, end)`.
 * Longest first, then leftmost. Returns undefined when nothing matches.
 */
const findNameSpan = (words, gazetteer) => {
  const normalized = words.map(normalize);

  for (let length = Math.min(gazetteer.maxWords, words.length); length >= 1; length--) {
    for (let start = 0; start + length <= words.length; start++) {
      const candidate = normalized.slice(start, start + length).join(" ");
      if (gazetteer.entries.has(candidate)) {
        return [start, start + length];
      }
    }
  }

  return undefined;
};

/**
 * Produces the analyser's response for the whitespace tokens a caller sent.
 *
 * In `subword` mode - the default, and what the real RoBERTa analyser does - the returned
 * tokens are SentencePiece pieces, so a consumer must re-assemble them before reading labels.
 * `word` mode returns the caller's own tokens instead; it exists so this mock can be pointed
 * at a consumer that has not yet learned to aggregate pieces.
 */
const analyse = (tokens, { gazetteer, mode = "subword", logger = console }) => {
  const words = tokens.filter((token) => token.length > 0);

  if (words.length === 0) {
    return { tokens: [], prediction: [] };
  }

  const nameSpan = findNameSpan(words, gazetteer);

  if (mode === "word") {
    return {
      tokens: words,
      prediction: words.map((_, index) => (nameSpan && index >= nameSpan[0] && index < nameSpan[1] ? NAME : ESSENCE)),
    };
  }

  const pieces = tokenize(words.join(" "));
  const wordGroups = groupPiecesByWord(pieces);

  if (wordGroups.length !== words.length) {
    // Metaspace should open exactly one group per whitespace word. If it did not, the piece to
    // word mapping is unsafe, so label nothing rather than invent a span.
    logger.warn(
      `NLP_ANALYSES: ${wordGroups.length} piece groups for ${words.length} words, labelling all as ${ESSENCE}`
    );
    return { tokens: pieces, prediction: pieces.map(() => ESSENCE) };
  }

  const prediction = pieces.map(() => ESSENCE);

  if (nameSpan) {
    for (let word = nameSpan[0]; word < nameSpan[1]; word++) {
      wordGroups[word].forEach((pieceIndex) => {
        prediction[pieceIndex] = NAME;
      });
    }
  }

  return { tokens: pieces, prediction };
};

module.exports = { analyse, loadGazetteer, findNameSpan, normalize, NAME, ESSENCE, WORD_START_MARKER };
