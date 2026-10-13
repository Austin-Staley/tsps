"use strict";

/**
 * The player's foundry state survives logouts, and every varbit it holds is re-sent at login
 * (rsprox captures: the login burst carries the commission, mould, crucible and preform
 * varbits, the unlocked moulds and varp 3436 wherever the player logs in).
 */

const Shared = require("./Shared.GiantsFoundry");

function syncOnLogin({ player }) {
  Shared.sync(player);
}

module.exports = function attachState(api) {
  api.persistAttribute(Shared.STATE_ATTRIBUTE);
  api.persistAttribute(Shared.REPUTATION_ATTRIBUTE);
  api.onPlayerLogin(syncOnLogin);
};
