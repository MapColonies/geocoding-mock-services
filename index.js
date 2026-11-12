const app = require("./app");
const config = require("./config");

const port = config.port;

app
  .init()
  .then(() => {
    app.listen(port, function () {
      console.info("server running with %s configuration on port %d", config.running_env, port);
    });
  })
  .catch((error) => {
    console.error("failed to start:", error.message);
    process.exit(1);
  });
