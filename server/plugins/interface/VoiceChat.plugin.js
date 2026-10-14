"use strict";

module.exports = {
  name: "VoiceChat",
  enabled: false,
  register(api) {
    require("./voice/VoiceChat")(api);
  },
};
