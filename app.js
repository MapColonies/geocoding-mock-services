const config = require("./config");
const express = require("express");

const { loadTokenizer } = require("./nlp/tokenizer");
const { analyse, loadGazetteer } = require("./nlp/analyser");

const app = express();
app.set("port", config.port);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

let gazetteer = null;

/**
 * Loads the tokenizer vocabulary and the gazetteer. Call before listening so that a missing or
 * unreadable model fails at startup rather than on the first search.
 */
const init = async () => {
  gazetteer = loadGazetteer(config.nlp.gazetteerPath);

  if (config.nlp.mode !== "word") {
    const started = Date.now();
    await loadTokenizer(config.nlp.modelDir);
    console.info(
      "loaded tokenizer from %s in %dms (mode=%s)",
      config.nlp.modelDir,
      Date.now() - started,
      config.nlp.mode
    );
  } else {
    console.warn("NLP_TOKENIZATION_MODE=word - returning whitespace tokens, not real sub-word pieces");
  }
};

app.get("/liveness", (req, res) => res.status(200).json({ status: "ok" }));

app.get("/data/:userid", (req, res) => {
  console.info("new request", req.params, req.query);
  const { userid } = req.params;
  const users = {
    "avi@mapcolonies.net": {
      firstName: "avi",
      lastName: "map",
      displayName: "mapcolonies/avi",
      mail: "avi@mapcolonies.net",
      domains: ["USA", "FRANCE"],
    },
  };
  const user = users[userid] ? users[userid] : { [userid]: null };
  return res.status(200).json(user);
});

app.post("/NLP_ANALYSES", (req, res) => {
  console.info(req.body);

  const tokens = req.body?.tokens;

  if (!Array.isArray(tokens)) {
    return res.status(400).json({ message: "tokens must be an array of strings" });
  }

  if (gazetteer === null) {
    return res.status(503).json({ message: "analyser not initialised" });
  }

  return res.status(200).json([analyse(tokens, { gazetteer, mode: config.nlp.mode })]);
});

module.exports = app;
module.exports.init = init;
