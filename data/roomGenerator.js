// roomGenerator.js
// Smart procedural room generator for Kalendale

import { monsters } from "./monsters.js";
import { descriptions } from "./rooms.js";
import { itemData } from "./items.js";

export const RoomGenerator = (() => {
  // ---- Configurable parameters ----
  const DUNGEON_EXIT_RANGE = [1, 3];
  const FOREST_EXIT_RANGE  = [2, 3];
  const MAX_VERTICALS_PER_LEVEL = 2;
  const MONSTER_DEPTH_SPREAD = 2;
  
  // === GAME BALANCE CONSTANTS === //
  const MONSTER_SPAWN_CHANCE = 0.3; // 30% of rooms have monsters
  const LOOT_SPAWN_CHANCE    = 0.05; // 5% of rooms have loot
  const MAX_VERTICAL_EXITS   = 2;   // Max up/down exits per dungeon level

  // internal vertical link counter
  let verticalLinks = 0;

  // ---- Helper utilities ----
  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const randomChoice = arr => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);

  // pick a description based on zone
  function randomDescription(zone) {
    const pool = descriptions[zone] || descriptions["forest"];
    return randomChoice(pool);
  }

  function pickMonsterByDepth(zone = "forest", depth = 0) {
    const pool = (monsters && monsters[zone]) ? monsters[zone] : [];
    if (!pool.length) return null;

    // Choose from monsters near current tier with some randomness
    const tier = Math.min(Math.floor(depth / 3), pool.length - 1);
    const candidates = pool.slice(Math.max(0, tier - 1), tier + 2);
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];

    // Deep copy to avoid reusing same reference
    const m = structuredClone ? structuredClone(chosen) : JSON.parse(JSON.stringify(chosen));
    if (m.maxHp && !m.hp) m.hp = m.maxHp;
    return m;
  }

  // --- Random loot generation ---
  function generateRandomLoot(zone = "forest", depth = 0) {
    if (Math.random() >= LOOT_SPAWN_CHANCE) return null;

    const lootChoices = Object.keys(itemData);
    if (!lootChoices.length) return null;

    // Weighted bias: more common items early, better ones deeper
    const tier = Math.min(Math.floor(depth / 4), 3); // 0-3 tiers
    const commonLoot = lootChoices.filter(k => itemData[k].value <= 20);
    const midLoot = lootChoices.filter(k => itemData[k].value > 20 && itemData[k].value <= 100);
    const rareLoot = lootChoices.filter(k => itemData[k].value > 100);

    let lootPool = commonLoot;
    if (tier >= 1 && midLoot.length) lootPool = lootPool.concat(midLoot);
    if (tier >= 2 && rareLoot.length) lootPool = lootPool.concat(rareLoot);

    const chosen = lootPool[Math.floor(Math.random() * lootPool.length)];
    return chosen || null;
  }

  // roll loot quality by depth
  function rollLoot(depth = 0) {
    const lootable = Object.keys(itemData)
      .filter(k => (itemData[k].value || 0) <= 10 + depth * 5);
    return randomChoice(lootable.length ? lootable : Object.keys(itemData));
  }

  // generate a set of exits depending on zone and depth
  function generateExits(zone = "forest", fromDir = null) {
    const dirs = ["north", "south", "east", "west"];
    const exits = {};

    const range = zone === "dungeon" ? DUNGEON_EXIT_RANGE : FOREST_EXIT_RANGE;
    const count = rand(range[0], range[1]);
    const chosen = shuffle(dirs).slice(0, count);

    chosen.forEach(d => (exits[d] = null));

    // limit vertical movement
    if (zone === "dungeon" && verticalLinks < MAX_VERTICALS_PER_LEVEL && Math.random() < 0.3) {
      exits[Math.random() < 0.5 ? "up" : "down"] = null;
      verticalLinks++;
    }

    // ensure at least one way back
    if (fromDir && !exits[reverseDir(fromDir)]) {
      exits[reverseDir(fromDir)] = "BACKTRACK";
    }

    return exits;
  }

  function reverseDir(dir) {
    const map = { north: "south", south: "north", east: "west", west: "east", up: "down", down: "up" };
    return map[dir] || null;
  }

  // ---- Main generation function ----
  function generateRoom(zone = "forest", fromRoom = null, fromDir = null) {
    const depth = (fromRoom?.depth || 0) + (zone === "dungeon" ? 1 : 0);
    
    let monster = null;
    if (Math.random() < MONSTER_SPAWN_CHANCE) {
      monster = pickMonsterByDepth(zone, depth);
      if (monster) {
        // Clone monster so each room has its own instance
        monster = structuredClone ? structuredClone(monster) : JSON.parse(JSON.stringify(monster));
      }
    }

    // --- Loot generation (always returns a readable string key) ---
    const lootItem = generateRandomLoot(zone, depth);
    let loot = {};

    if (lootItem) {
      // If generateRandomLoot returns an object, try to extract its key or name
      if (typeof lootItem === 'object') {
        if (lootItem.name) {
          loot[lootItem.name] = 1;
        } else if (lootItem.id) {
          loot[lootItem.id] = 1;
        } else {
          // If it’s a key-value map like { Potion: 1 }, use the key
          const key = Object.keys(lootItem)[0];
          loot[key || 'Unknown'] = 1;
        }
      } else if (typeof lootItem === 'string') {
        loot[lootItem] = 1;
      }
    }

    const exits = generateExits(zone, fromDir);
    const desc = randomDescription(zone);

    return {
      id: crypto.randomUUID ? crypto.randomUUID() : `room_${Date.now()}_${Math.floor(Math.random()*1000)}`,
      zone,
      desc,
      exits,
      monster,
      loot,
      depth,
      discovered: true
    };
  }

  // Reset counters when entering a new dungeon or zone
  function resetZone() {
    verticalLinks = 0;
  }

  return { generateRoom, resetZone };
})();
