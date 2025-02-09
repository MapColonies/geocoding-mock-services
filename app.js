const config = require("./config");
const express = require("express");

const app = express();
app.set("port", config.port);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

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
  if (
    !req.body.tokens?.find(
      (token) =>
        token.toUpperCase() === "USA" ||
        token.toUpperCase() === "NEW" ||
        token.toUpperCase() === "LOS" ||
        token.toUpperCase() === "PARIS" ||
        token.toUpperCase() === "FRANCE"
    )
  ) {
    return res.status(200).json([
      {
        tokens: req.body.tokens,
        prediction: req.body.tokens.map((_) => "essence"),
      },
    ]);
  }
  return res.status(200).json([
    {
      tokens: req.body.tokens,
      prediction: req.body.tokens.map((_, index) => {
        if (index + 1 === req.body.tokens.length) return "name";
        else return "essence";
      }),
    },
  ]);
});

module.exports = app;
