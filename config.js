const default_conf = {
  running_env: process.env.RUNNING_ENV || "development",
  port: process.env.SERVER_PORT || 5002,
};

module.exports = default_conf;
