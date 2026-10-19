/**
 * Construction: the shared `api.core`, filled in by the plugin before the other construction
 * files load. The files destructure what they need from it at load time.
 */
module.exports = {
  init(api) {
    Object.assign(module.exports, api.core);
  },
};
