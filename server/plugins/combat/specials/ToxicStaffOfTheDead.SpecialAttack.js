module.exports = function registerToxicStaffOfTheDeadSpecialAttack(api) {
  require("./PowerOfDeath.SpecialAttack")(api, {
    id: "toxic_staff_of_the_dead",
    itemId: api.core.ItemIdentifiers.TOXIC_STAFF_OF_THE_DEAD,
    animation: 1719,
    graphic: 1228,
  });
};
