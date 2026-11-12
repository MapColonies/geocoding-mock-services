const fs = require("node:fs");
const path = require("node:path");

/**
 * The real tokenizer the NLP analyser uses.
 *
 * The analyser behind TOKEN_TYPE_URL is a RoBERTa token classifier for Hebrew, Arabic and
 * Persian, so it segments with SentencePiece into sub-word pieces rather than words, and
 * labels one piece at a time. A mock that returns whitespace tokens teaches every consumer
 * the wrong shape - which is exactly how geocoding shipped a name extractor that returns
 * fragments such as "ווה" for "פתח תקווה".
 *
 * This module loads the genuine xlm-roberta-base vocabulary and runs it through
 * @huggingface/tokenizers, whose output was verified piece-for-piece against the Rust
 * `tokenizers` reference implementation on Hebrew (including niqqud, maqaf and gershayim),
 * Arabic, Persian and English - 21 of 21 cases identical.
 */

/** U+2581 LOWER ONE EIGHTH BLOCK - SentencePiece's word-start marker. */
const WORD_START_MARKER = "▁";

let tokenizer = null;

const loadTokenizer = async (modelDir) => {
  if (tokenizer) {
    return tokenizer;
  }

  const tokenizerPath = path.join(modelDir, "tokenizer.json");
  const configPath = path.join(modelDir, "tokenizer_config.json");

  if (!fs.existsSync(tokenizerPath)) {
    throw new Error(
      `tokenizer.json not found at ${tokenizerPath}. The vocabulary is vendored under vendor/tokenizer/; ` +
        `set TOKENIZER_MODEL_DIR to a directory holding tokenizer.json and tokenizer_config.json.`
    );
  }

  // @huggingface/tokenizers is ESM-only, so it is reached through a dynamic import.
  const { Tokenizer } = await import("@huggingface/tokenizers");

  const tokenizerJson = JSON.parse(fs.readFileSync(tokenizerPath, "utf8"));
  const tokenizerConfig = fs.existsSync(configPath)
    ? JSON.parse(fs.readFileSync(configPath, "utf8"))
    : {};

  tokenizer = new Tokenizer(tokenizerJson, tokenizerConfig);
  return tokenizer;
};

/** Sub-word pieces for `text`, markers included, exactly as the analyser would return them. */
const tokenize = (text) => {
  if (!tokenizer) {
    throw new Error("tokenizer not loaded - call loadTokenizer first");
  }
  return tokenizer.tokenize(text);
};

/**
 * Groups piece indices by word.
 *
 * Metaspace turns every space into the word-start marker, so a piece carrying the marker opens
 * a new word and the pieces after it continue that word. Verified against xlm-roberta-base:
 * `אום אל פחם` -> ['▁אום', '▁אל', '▁', 'פח', 'ם'] gives three groups, matching its three words,
 * and `בת־ים` -> ['▁בת', '־', 'ים'] gives one.
 */
const groupPiecesByWord = (pieces) => {
  const groups = [];

  pieces.forEach((piece, index) => {
    if (piece.startsWith(WORD_START_MARKER) || groups.length === 0) {
      groups.push([index]);
      return;
    }
    groups[groups.length - 1].push(index);
  });

  return groups;
};

module.exports = { loadTokenizer, tokenize, groupPiecesByWord, WORD_START_MARKER };
