const path = require("node:path");

const default_conf = {
  running_env: process.env.RUNNING_ENV || "development",
  port: process.env.SERVER_PORT || 5002,
  nlp: {
    /** Directory holding tokenizer.json and tokenizer_config.json. Vendored by default. */
    modelDir:
      process.env.TOKENIZER_MODEL_DIR ||
      path.join(__dirname, "vendor", "tokenizer", "xlm-roberta-base"),
    /** Place names labelled as a proper name. */
    gazetteerPath: process.env.GAZETTEER_PATH || path.join(__dirname, "nlp", "gazetteer.json"),
    /**
     * "subword" (default) mirrors the real RoBERTa analyser and returns SentencePiece pieces.
     * "word" returns the caller's own whitespace tokens, for a consumer that cannot yet
     * re-assemble pieces.
     */
    mode: process.env.NLP_TOKENIZATION_MODE || "subword",
  },
};

module.exports = default_conf;
