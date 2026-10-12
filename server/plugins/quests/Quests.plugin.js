/**
 * Quests. Each quest lives in ./quests/<Name>.Quest.js and registers its own
 * logic, handlers and (for transcript-driven quests) variant/condition answers
 * through `api.core`; add each quest to QUESTS (and F2P_QUESTS if free-to-play).
 *
 * Shield of Arrav is registered last so the shared Varrock NPCs it finishes on
 * (King Roald, Reldo, ...) fall back to it after the other quests' handlers.
 */
const QUESTS = [
  "RecipeForDisaster",
  "ANightAtTheTheatre",
  "WhileGuthixSleeps",
