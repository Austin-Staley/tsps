/** Solo Entry Mode, the playable raid required by A Night at the Theatre. */
module.exports = {
  name: "TheatreOfBlood",
  members: true,
  register(api) {
    require("./tob/Entry.TheatreOfBlood")(api);
  },
};
