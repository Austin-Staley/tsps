/**
 * The Bank PIN (https://oldschool.runescape.wiki/w/Bank_PIN), from plugins/interface/data/
 * bank-pin.json: the settings a Banker opens, the keypad, and the bank's lock. Each lives in
 * ./bankpin/.
 */
const Common = require("./bankpin/Common.BankPin");
const Keypad = require("./bankpin/Keypad.BankPin");
const Settings = require("./bankpin/Settings.BankPin");

module.exports = {
  name: "BankPin",
  register(api) {
    Common.init(api);
    Keypad.attach(api);
    Settings.attach(api);
  },
};
