/**
 * Smithing: the shared `api.core`, filled in when the plugin registers, plus the plugin's own
 * `api`. The unit files read it when they run, not when they load: the bots and the Blast
 * Furnace require the plugin before it registers.
 */
module.exports = {
  init(api) {
    Object.assign(module.exports, api.core, { api });
  },
};
