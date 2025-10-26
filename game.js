import { itemData, shopItems } from './data/items.js';
import { monsters } from './data/monsters.js';
import { descriptions, milestoneRooms } from './data/rooms.js';
import { town } from './data/town.js';
import { RoomGenerator, determineZone } from './data/roomGenerator.js';

const DROP_GOLD_CHANCE = 0.3;   // 30% chance gold only
const DROP_LOOT_CHANCE = 0.25;  // 25% chance loot only
const DROP_BOTH_CHANCE = 0.15;  // 15% chance both

// --- Title Screen Logic ---
window.addEventListener("DOMContentLoaded", () => {
  const startScreen = document.getElementById("startScreen");
  const startButton = document.getElementById("startButton");
  const gameContainer = document.getElementById("gameContainer");

  if (startButton) {
    startButton.addEventListener("click", () => {
      startScreen.style.animation = "fadeOut 1.5s ease forwards";
			
      setTimeout(() => {
        startScreen.style.display = "none";
        gameContainer.style.display = "flex";
				// Start the actual game only after fade completes
				if (typeof startGame === "function") startGame();
      }, 1500);
    });
  }
});

// --- Utility to normalize item names (case-insensitive input, canonical output) ---
function normalizeItemName(input) {
  const lower = input.toLowerCase();
  for (const item of Object.keys(shopItems)) {
    if (item.toLowerCase() === lower) return item;
  }
  for (const item of Object.keys(itemData)) {
    if (item.toLowerCase() === lower) return item;
  }
  // Fallback: Title-case first letter only (so unknowns still look decent)
  return input.charAt(0).toUpperCase() + input.slice(1);
}

function startGame() {
  const consoleEl = document.getElementById('console');
  const inputEl = document.getElementById('inputLine');
  const logWindow = document.getElementById('logWindow');
  const logToggle = document.getElementById('logToggle');

  function log(message, allowHTML = false) {
    const consoleEl = document.getElementById('console');
    const entry = document.createElement('div');
    if (allowHTML) entry.innerHTML = message;
    else entry.textContent = message;
    consoleEl.appendChild(entry);
    consoleEl.scrollTop = consoleEl.scrollHeight;
  }

  function logCombat(message) {
    // Convert simple markup to styled spans
    const html = message
      .replace(/\*(.*?)\*/g, '<span class="combat-monster">$1</span>') // *monster*
      .replace(/\[(-?\d+)\]/g, '<span class="combat-damage">[$1]</span>') // [damage]
      .replace(/\{(\+?\d+)\}/g, '<span class="combat-heal">{$1}</span>')  // {healing}
      .replace(/!CRIT!/g, '<span class="combat-crit">CRITICAL HIT!</span>');

    // Show in both log and console
    logAction(message, "combat");
    log(html, true);
  }

  // --- Slow fade text logging with animation ---
  function logFade(lines, delay = 500) {
    let i = 0;
    function showNext() {
      if (i < lines.length) {
        const div = document.createElement("div");
        div.innerHTML = `<i>${lines[i]}</i>`;
        div.classList.add("fadeLine");
        consoleEl.appendChild(div);
        consoleEl.scrollTop = consoleEl.scrollHeight;
        i++;
        setTimeout(showNext, delay);
      }
    }
    showNext();
  }

  function logAction(text, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.innerHTML = `<span class="log-time">[${timestamp}]</span> ${text}`;
    logWindow.appendChild(entry);
    logWindow.scrollTop = logWindow.scrollHeight;
  }

  // --- Hide/Show Log button wiring ---
  let logVisible = true;
  if (logToggle) {
    logToggle.addEventListener('click', () => {
      logVisible = !logVisible;

      if (logVisible) {
        logWindow.style.display = 'block';
        logToggle.textContent = 'Hide Log';

        // 🔽 Always scroll to bottom when the log becomes visible
        requestAnimationFrame(() => {
          logWindow.scrollTop = logWindow.scrollHeight;
        });

      } else {
        logWindow.style.display = 'none';
        logToggle.textContent = 'Show Log';
      }
    });
  }

  // --- Player ---
  let player = {
    name: '',
    race: '',
    hp: 100,
    maxHp: 100,
    gold: 50,
    inventory: { "Healing Potion": 2, "Rusty Dagger": 1 }, // stacked: { "Healing Potion": 2, "Rusty Dagger": 1 }
    location: 'Town Square',
    equipped: { weapon: null, armor: null },
    inCombat: false,
    currentMonster: null,
    level: 1,
    xp: 0
  };

  // --- World ---
  let world = {
    ...town
  };

  let roomCount = 1;
  let step = 0;
  let pendingConfirm = null;

  // --- Save / Load / Reset ---
  function saveGame(silent = false) {
    const data = { player, world, roomCount, step };
    localStorage.setItem('kalendaleSave', JSON.stringify(data));

    // Always record in log window
    logAction("Game saved", "info");

    // Only show visible message if not silent
    if (!silent) log("Game saved.");
  }

  function loadGame(force = false) {
    const saved = localStorage.getItem('kalendaleSave');
    if (!saved) return log("No saved game found.");
    if (!force) {
      log("Are you sure you want to load your last save? Type 'yes' to confirm, 'no' to cancel.");
      pendingConfirm = { type: 'load' };
      return;
    }
    const data = JSON.parse(saved);
    player = data.player;
    world = data.world;
    roomCount = data.roomCount;
    // Ensure we don't get stuck mid-creation
		if (typeof data.step === 'number' && data.step >= 3) {
			step = data.step;
		} else {
			step = 3; // force ready-to-play if save is incomplete
		}
		pendingConfirm = null;
    pendingConfirm = null;
    inputEl.disabled = false;
    updateGlow();
    logAction("Game loaded", "info");
    log("Game loaded.");
    describeLocation();
  }

  function resetGame(force = false, hard = false) {
    const saved = localStorage.getItem('kalendaleSave');
    if (!saved) return log("No save exists to reset.");

    if (!force) {
      log("Are you sure you want to RESET and delete your save?");
      log("Type 'reset confirm' to proceed, or 'reset confirm hard' to also refresh the game cache.");
      return;
    }

    // Remove save and mark reset
    localStorage.removeItem('kalendaleSave');
    localStorage.setItem('kalendaleReset', 'true');
    logAction("Save reset", "info");
    log("Save data cleared. Start a new game.");

    // Optional: perform a hard reload to bypass cache
    if (hard) {
      const url = new URL(window.location);
      url.searchParams.set('nocache', Date.now());
      window.location.href = url.toString();
    }
  }

  // --- XP / Level ---
  function xpForNextLevel(lv) { return 50 + (lv - 1) * 70; }

  function grantXP(amount) {
    player.xp += amount;
    log(`You gained ${amount} XP.`);
    logAction(`Gained ${amount} XP`, "info");
    while (player.xp >= xpForNextLevel(player.level)) {
      player.xp -= xpForNextLevel(player.level);
      player.level++;
      const hpGain = 10 + Math.floor(Math.random() * 6);
      player.maxHp += hpGain;
      player.hp = player.maxHp;
      log(`*** You are now Level ${player.level}! Max HP +${hpGain}. HP fully restored. ***`);
      logAction(`Leveled up to ${player.level}`, "info");
      updateGlow();
    }
  }

  // --- Input glow cues ---
  function updateGlow() {
    inputEl.classList.remove('inCombatGlow', 'lowHpGlow');

    // Glow red when HP is approaching 30%
    if (player.hp <= player.maxHp/3) {
      inputEl.classList.add('lowHpGlow');
    } else if (player.inCombat) {
      inputEl.classList.add('inCombatGlow');
    }
  }

  // --- World generation ---
  const lootTable = Object.keys(itemData);
  const directions = ['north', 'south', 'east', 'west', 'up', 'down'];
  const directionAliases = { n: 'north', s: 'south', e: 'east', w: 'west', u: 'up', d: 'down' };

  function getOppositeDirection(dir) {
    const opposites = { north: 'south', south: 'north', east: 'west', west: 'east', up: 'down', down: 'up' };
    return opposites[dir];
  }

  // --- Periodic item respawn (data-driven) ---
  function maybeRespawnItems(loc) {
    if (!loc || loc.shop || loc.healer || loc.safezone) return;

    // 10% chance to respawn items (tweakable)
    const ITEM_RESPAWN_RATE = 0.10;
    if (Math.random() >= ITEM_RESPAWN_RATE) return;

    // Build a pool from itemData that makes sense to find on the ground
    // (consumables and low-value misc by default)
    const pool = Object.entries(itemData)
      .filter(([name, it]) =>
        it &&
        (
          it.type === 'consumable' ||
          (it.type === 'misc' && ((it.value ?? 0) <= 25))
        )
      )
      .map(([name]) => name);

    // Nothing suitable in the data? Bail gracefully.
    if (pool.length === 0) return;

    // Pick an item and quantity
    const item = pool[Math.floor(Math.random() * pool.length)];
    const amount = (itemData[item].type === 'consumable')
      ? (Math.random() < 0.5 ? 1 : 2)  // small stacks for consumables
      : 1;                              // single for misc

    if (!loc.loot) loc.loot = {};
    loc.loot[item] = (loc.loot[item] || 0) + amount;

    logAction(`Something new glitters in ${player.location}... (${item} x${amount})`, "item");
  }

  // --- Monster respawn system ---
  function maybeRespawnMonster(loc) {
    if (!loc || loc.monster || loc.shop || loc.healer || loc.safezone) return;
    // 15% chance monster appears
    if (Math.random() < 0.15) {
      const zone = inferZoneForAmbush(player.location, loc);
      const pool = Array.isArray(monsters[zone]) ? monsters[zone] : [];
      if (pool.length === 0) return;
      const template = pool[Math.floor(Math.random() * pool.length)];
      loc.monster = { ...template, hp: template.hp, name: template.name };
      logAction(`You sense movement... a ${template.name} has returned to ${player.location}.`, "combat");
    }
  }

  // --- Random ambush chance when entering rooms ---
  function maybeAmbushOnEntry(loc) {
    if (!loc || loc.shop || loc.healer || loc.safezone) return;
    if (player.inCombat) return;

    const ambushChance = 0.10; // 10% ambush chance
    if (Math.random() < ambushChance) {
      const zone = inferZoneForAmbush(player.location, loc);
      const pool = Array.isArray(monsters[zone]) ? monsters[zone] : [];
      if (pool.length === 0) return;
      const template = pool[Math.floor(Math.random() * pool.length)];
      const ambusher = { ...template, hp: template.hp, name: template.name };
      loc.monster = ambusher;
      player.inCombat = true;
      player.currentMonster = ambusher;
      log(`\n⚔️ A ${ambusher.name} suddenly attacks as you enter!`);
      logAction(`Ambushed by ${ambusher.name} while exploring`, "combat");
    }
  }

  function inferZoneForAmbush(roomId, roomObj) {
    // Prefer explicit zone if your generator sets it
    if (roomObj && roomObj.zone) return roomObj.zone;

    // Fallback: infer from location name
    const name = String(roomId);
    if (name.includes('Crypt') || name.includes('Dungeon')) return 'dungeon';
    if (name.includes('Forest') || name.includes('Gates')) return 'forest';

    // Default to forest if unknown
    return 'forest';
  }

  function describeLocation() {
    const loc = world[player.location];
    logAction(`Entered ${player.location}`, "move");
    log(`\n== ${player.location} ==`);
    log(loc.description);
    const exits = Object.entries(loc.exits).map(([d, dest]) => `${d.toUpperCase()} → ${dest || '?'}`).join(', ');
    log(`Exits: ${exits || 'None'}`);
    if (loc.shop) {
      log('The shopkeeper has these items:');
      for (const [item, data] of Object.entries(shopItems)) {
        log(`- ${item} (${data.price} gold)`);
      }
      log('The shopkeeper will also buy any item you bring them.');
    }
    if (loc.loot && Object.keys(loc.loot).length > 0) {
      const lootList = Object.entries(loc.loot)
        .map(([item, count]) => `${item}${count > 1 ? ` x${count}` : ''}`)
        .join(', ');
      log(`You notice something on the ground: ${lootList}`);
    }

    if (loc.monster) log(`A ${loc.monster.name} lurks here. Type "fight" to engage.`);
  }

  // --- Core game logic ---
  function gameLogic(cmd) {
    const loc = world[player.location];

    // Direction alias expansion
    if (directionAliases[cmd]) cmd = directionAliases[cmd];

    // Help
    if (cmd === 'help') {
      log(` 
  Commands:
  - north/south/east/west/up/down (n/s/e/w/u/d)
  - look
  - get [item], drop [item]
  - equip [item], unequip weapon, unequip armor
  - inspect [item], use [item]
  - inventory (inv), status
  - buy [item], sell [item] (in Shop)
  - rest, donate (in church)
  - fight, run
  - save, load, reset`);
      return;
    }

    // Save / Load / Reset
    if (cmd === 'save') return saveGame();
    if (cmd === 'load') return loadGame();

    if (cmd.startsWith('reset')) {
      const parts = cmd.split(' ');
      const confirm = parts.includes('confirm');
      const hard = parts.includes('hard');
      return resetGame(confirm, hard);
    }

    // --- Movement (blocked during combat) ---
    if (directions.includes(cmd)) {
      if (player.inCombat) return log("You can't leave while in combat!");

      const currentRoom = world[player.location];
      const exits = currentRoom.exits || {};

      // No such exit
      if (!(cmd in exits)) return log("You can't go that way.");

      let destId = exits[cmd];
      let destRoom = world[destId];

      // Decide zone type
      const zone = determineZone(player, cmd);

      // If the destination room doesn't exist yet, generate & normalize it
      if (!destRoom) {
        const gen = RoomGenerator.generateRoom(zone, currentRoom, cmd);
        if (!gen) {
          log("The way seems blocked by shadows.");
          return;
        }

        const newRoomData = normalizeGeneratedRoom(gen);
        const newRoomId = `${zone.charAt(0).toUpperCase() + zone.slice(1)} Room #${roomCount++}`;

        // Store and link
        world[newRoomId] = newRoomData;
        currentRoom.exits[cmd] = newRoomId;
        const reverse = getOppositeDirection(cmd);
        if (reverse) newRoomData.exits[reverse] = player.location;

        logAction(`New ${zone} room generated (depth ${newRoomData.depth})`, "move");

        // Move into the new room
        player.location = newRoomId;
        describeLocation();
        maybeRespawnMonster(world[player.location]);
        maybeAmbushOnEntry(world[player.location]);
        return;
      }

      // Otherwise, move into existing room
      player.location = destId;
      describeLocation();
      maybeRespawnItems(world[player.location]);
      maybeRespawnMonster(world[player.location]);
      maybeAmbushOnEntry(world[player.location]);
      return;
    }

    if (cmd === 'look') return describeLocation();

    // Inventory
    if (cmd === 'inventory' || cmd === 'inv') {
      if (Object.keys(player.inventory).length === 0) log("Inventory: Empty");
      else for (const [item, count] of Object.entries(player.inventory)) log(`${item} x${count}`);
      log(`Gold: ${player.gold}`);
      log(`Equipped Weapon: ${player.equipped.weapon || 'None'}`);
      log(`Equipped Armor: ${player.equipped.armor || 'None'}`);
      return;
    }

    // Status
    if (cmd === 'status') {
      log(`Name: ${player.name}`);
      log(`Race: ${player.race || 'Unchosen'}`);
      log(`Level: ${player.level}`);
      log(`XP: ${player.xp}/${xpForNextLevel(player.level)}`);
      log(`HP: ${player.hp}/${player.maxHp}`);
      return;
    }

    // Shop Buy
    if (cmd.startsWith('buy ') && loc.shop) {
      const itemName = normalizeItemName(cmd.slice(4).trim());
      if (!shopItems[itemName]) return log("That item is not sold here.");
      const cost = shopItems[itemName].price;
      if (player.gold >= cost) {
        player.gold -= cost;
        player.inventory[itemName] = (player.inventory[itemName] || 0) + 1;
        log(`You bought a ${itemName} for ${cost} gold.`);
        logAction(`Bought ${itemName}`, "item");
      } else log("You don’t have enough gold.");
      return;
    }

    // Shop Sell (buys anything, vendor trash included)
    if (cmd.startsWith('sell ') && loc.shop) {
      const itemName = normalizeItemName(cmd.slice(5).trim());
      if (!player.inventory[itemName]) return log(`You don’t have a ${itemName} to sell.`);
      const baseValue = shopItems[itemName]?.price || itemData[itemName]?.value || 10;
      const sellValue = Math.floor(baseValue / 2);
      player.inventory[itemName]--;
      if (player.inventory[itemName] <= 0) delete player.inventory[itemName];
      player.gold += sellValue;
      log(`You sold ${itemName} for ${sellValue} gold.`);
      logAction(`Sold ${itemName}`, "item");
      return;
    }

    // Pickup
    if (cmd.startsWith('get ')) {
      const itemName = normalizeItemName(cmd.slice(4).trim());
      if (loc.loot && loc.loot[itemName] > 0) {
        player.inventory[itemName] = (player.inventory[itemName] || 0) + 1;
        loc.loot[itemName]--;
        if (loc.loot[itemName] <= 0) delete loc.loot[itemName];
        log(`You picked up a ${itemName}.`);
        logAction(`Picked up ${itemName}`, "item");
      } else log(`There's no ${itemName} here.`);
      return;
    }

    // Drop
    if (cmd.startsWith('drop ')) {
      const itemName = normalizeItemName(cmd.slice(5).trim());
      if (player.inventory[itemName] > 0) {
        player.inventory[itemName]--;
        if (player.inventory[itemName] <= 0) delete player.inventory[itemName];
        loc.loot[itemName] = (loc.loot[itemName] || 0) + 1;
        log(`You dropped a ${itemName}.`);
        logAction(`Dropped ${itemName}`, "item");
      } else log(`You don't have a ${itemName}.`);
      return;
    }

    // Inspect (inventory or equipped)
    if (cmd.startsWith('inspect ')) {
      const itemName = normalizeItemName(cmd.slice(8).trim());
      const owned = player.inventory[itemName] || player.equipped.weapon === itemName || player.equipped.armor === itemName;
      if (owned && itemData[itemName]) {
        log(`${itemName}: ${itemData[itemName].description}`);
      } else log(`You don't have a ${itemName}.`);
      return;
    }

    // Equip
    if (cmd.startsWith('equip ')) {
      const itemName = normalizeItemName(cmd.slice(6).trim());
      if (player.inventory[itemName] > 0 && itemData[itemName]) {
        const type = itemData[itemName].type;
        if (type === "weapon" || type === "armor") {
          if (player.equipped[type]) {
            player.inventory[player.equipped[type]] = (player.inventory[player.equipped[type]] || 0) + 1;
            log(`You unequip your ${player.equipped[type]}.`);
            logAction(`Unequipped ${player.equipped[type]}`, "item");
          }
          player.equipped[type] = itemName;
          player.inventory[itemName]--;
          if (player.inventory[itemName] <= 0) delete player.inventory[itemName];
          log(`You equipped the ${itemName}.`);
          logAction(`Equipped ${itemName}`, "item");
        } else log(`You can't equip a ${itemName}.`);
      } else log(`You don't have a ${itemName}.`);
      return;
    }

    // Unequip
    if (cmd.startsWith('unequip ')) {
      const slot = cmd.slice(8).trim();
      if (["weapon", "armor"].includes(slot) && player.equipped[slot]) {
        const unequipped = player.equipped[slot];
        player.inventory[unequipped] = (player.inventory[unequipped] || 0) + 1;
        log(`You unequipped the ${unequipped}.`);
        logAction(`Unequipped ${unequipped}`, "item");
        player.equipped[slot] = null;
      } else log(`You have nothing equipped in ${slot}.`);
      return;
    }

    // --- Generic Use Command for Consumables ---
    if (cmd.startsWith('use ')) {
      const itemName = normalizeItemName(cmd.slice(4).trim());
      const item = itemData[itemName];

      if (!player.inventory[itemName]) return log(`You don't have a ${itemName}.`);
      if (!item) return log(`You can't use ${itemName}.`);
      if (item.type !== 'consumable') return log(`You can't use ${itemName} right now.`);

      // Consume the item
      player.inventory[itemName]--;
      if (player.inventory[itemName] <= 0) delete player.inventory[itemName];

      // If it has healing properties
      if (item.heal) {
        const prevHp = player.hp;
        player.hp = Math.min(player.maxHp, player.hp + item.heal);
        const healed = player.hp - prevHp;

        log(item.consumeText || `You use the ${itemName}.`);
        log(`You recover ${healed} HP. (${player.hp}/${player.maxHp})`);
        logAction(`Used ${itemName} (+${healed} HP)`, "heal");
        updateGlow();
      } else {
        log(item.consumeText || `You use the ${itemName}, but nothing happens.`);
        logAction(`Used ${itemName}`, "info");
      }

      return;
    }

    // --- Church Healing ---
    if (cmd === 'donate') {
      const loc = world[player.location];
      if (!loc.healer) return log("There’s no one here to receive your offering.");

      const healCost = Math.floor(player.maxHp * 0.5); // gold cost scales with max HP
      if (player.gold < healCost) {
        log(`The cleric shakes their head sadly. "A donation of ${healCost} gold is required, child."`);
        return;
      }

      player.gold -= healCost;
      player.hp = player.maxHp;
      log(`You place ${healCost} gold upon the altar. A soft radiance surrounds you — your wounds mend completely.`);
      logAction(`Healed fully at the Church for ${healCost} gold`, "heal");
      updateGlow();
      return;
    }

    // --- Rest Command (heal small amount, chance of ambush) ---
    if (cmd === 'rest') {
      const loc = world[player.location]; // ✅ move to top

      // Block rest in safe zones
      if (loc.safezone) {
        log("No camping allowed within the town limits!");
        return;
      }

      const healAmount = Math.floor(player.maxHp * 0.1);
      const ambushBaseChance = 0.30; // 30% base chance

      log("You take a moment to rest...");
      player.hp = Math.min(player.maxHp, player.hp + healAmount);
      log(`You recover ${healAmount} HP. (${player.hp}/${player.maxHp})`);
      logAction(`Rested and healed ${healAmount} HP`, "heal");
      updateGlow();

      // If a monster is already here, don't stack ambushes
      if (loc.monster) {
        log("You remain alert — something is already lurking nearby.");
        return;
      }

      // Optional: increase chance by depth (if your generator sets depth)
      const depth = loc?.depth || 0;
      const ambushChance = Math.min(ambushBaseChance + depth * 0.05, 0.6); // cap at 60%

      if (Math.random() < ambushChance) {
        const zone = inferZoneForAmbush(player.location, loc);
        const pool = Array.isArray(monsters[zone]) ? monsters[zone] : [];

        if (pool.length === 0) {
          log("You hear movement nearby... but nothing comes of it.");
          return;
        }

        const template = pool[Math.floor(Math.random() * pool.length)];
        if (!template || typeof template.hp !== 'number' || template.hp <= 0) {
          log("You hear movement nearby... but nothing comes of it.");
          return;
        }

        const ambusher = {
          ...template,
          hp: Math.max(1, Math.floor(template.hp * 0.8)) // slightly weaker
        };

        loc.monster = ambusher;
        player.inCombat = true;
        player.currentMonster = ambusher;

        log(`\n⚔️ You are ambushed by a ${ambusher.name} in your sleep!`);
        logAction(`Ambushed by ${ambusher.name} while resting`, "combat");
      } else {
        log("You rest peacefully and awaken refreshed.");
      }

      return;
    }

    // Tavern Easter egg: Ale & Cider (only in Tavern)
    if (player.location === "Tavern") {
      if (cmd === "ale") {
        if (player.gold >= 2) {
          player.gold -= 2;
          player.hp = Math.min(player.maxHp, player.hp + 10);
          log("You order a frothy mug of ale. Restores 10 HP.");
          logAction("Drank Ale (+10 HP)", "heal");
          updateGlow();
        } else {
          log("The barkeep frowns. 'No coin, no ale.'");
        }
        return;
      }
      if (cmd === "cider") {
        if (player.gold >= 3) {
          player.gold -= 3;
          player.hp = Math.min(player.maxHp, player.hp + 15);
          log("You sip a sweet cider. Restores 15 HP.");
          logAction("Drank Cider (+15 HP)", "heal");
          updateGlow();
        } else {
          log("The barkeep shakes his head. 'No coin, no cider.'");
        }
        return;
      }
    }

    // Combat (single round per 'fight' command)
    if (cmd === 'fight') {
      const monster = loc.monster;
      if (!monster) return log("There's nothing to fight here.");
      if (!player.inCombat) {
        player.inCombat = true;
        player.currentMonster = monster;
        logCombat(`You engage the *${monster.name}* in combat!`);
      }
      updateGlow();

      const weaponBonus = (player.equipped.weapon && itemData[player.equipped.weapon]?.attack) || 0;
      const armorBonus  = (player.equipped.armor  && itemData[player.equipped.armor]?.defense) || 0;

      let playerHit  = Math.floor(Math.random() * 20) + 5 + weaponBonus;
      let monsterHit = Math.max(0, Math.floor(Math.random() * 15) + 3 - armorBonus);

      const playerCrit = Math.random() < 0.10;
      const monsterCrit = Math.random() < 0.05;
      const playerMiss = Math.random() < 0.08;
      const monsterMiss = Math.random() < 0.10;

      if (playerMiss) playerHit = 0;
      if (monsterMiss) monsterHit = 0;
      if (playerCrit) playerHit = Math.floor(playerHit * 1.5);
      if (monsterCrit) monsterHit = Math.floor(monsterHit * 1.5);

      // Apply results
      monster.hp -= playerHit;
      player.hp  -= monsterHit;

      // --- Combat narration ---
      if (playerMiss) {
        logCombat(`You swing and miss the *${monster.name}*!`);
      } else if (playerCrit) {
        logCombat(`You land a devastating blow on the *${monster.name}* for [${playerHit}] damage! !CRIT!`);
      } else {
        logCombat(`You hit the *${monster.name}* for [${playerHit}] damage. [${monster.hp > 0 ? monster.hp : 0} HP left]`);
      }

      if (monsterMiss) {
        logCombat(`The *${monster.name}* misses you!`);
      } else if (monsterCrit) {
        logCombat(`The *${monster.name}* strikes you for [${monsterHit}] damage! !CRIT! [${player.hp > 0 ? player.hp : 0}/${player.maxHp} HP]`);
      } else {
        logCombat(`The *${monster.name}* hits you for [${monsterHit}] damage. [${player.hp > 0 ? player.hp : 0}/${player.maxHp} HP]`);
      }

      // --- Combat resolution ---
      if (player.hp <= 0) {
        log("You have died...");
        logAction("You died", "combat");
        player.inCombat = false;
        player.currentMonster = null;
        updateGlow();

        setTimeout(() => {
          // Flavor message
          log("\nA distant voice whispers prayers over your fallen form...");
          log("You awaken beneath the vaulted arches of the Church of Kalendale.");
          log("The cleric smiles faintly. \"A small donation was required to restore your life.\"");

          // Resurrect logic
          player.hp = player.maxHp;
          player.location = "Church of Kalendale";
          player.gold = 0;

          // Clear any lingering monster from previous room
          const loc = world[player.location];
          if (loc) {
            loc.monster = null;
          }

          logAction("Resurrected at the Church of Kalendale (all gold lost)", "info");
          updateGlow();
          describeLocation();
        }, 3000); // small delay for immersion

        return;
      }

      if (monster.hp <= 0) {
        log(`You defeated the ${monster.name}!`);
        logAction(`Defeated ${monster.name}`, "combat");

        // --- Randomized reward outcome ---
        const roll = Math.random();
        const dropGoldChance = DROP_GOLD_CHANCE;   // 30% chance gold only
        const dropLootChance = DROP_LOOT_CHANCE;   // 25% chance loot only
        const dropBothChance = DROP_BOTH_CHANCE;   // 15% chance both
        const nothingChance = 1 - (dropGoldChance + dropLootChance + dropBothChance);

        let gotSomething = false;

        if (roll < nothingChance) {
          log("The creature leaves nothing behind.");
        } else if (roll < nothingChance + dropGoldChance) {
          if (monster.gold) {
            player.gold += monster.gold;
            log(`You find ${monster.gold} gold among the remains.`);
            logAction(`Looted ${monster.gold} gold`, "item");
            gotSomething = true;
          }
        } else if (roll < nothingChance + dropGoldChance + dropLootChance) {
          if (monster.loot) {
            player.inventory[monster.loot] = (player.inventory[monster.loot] || 0) + 1;
            log(`The ${monster.name} dropped ${monster.loot}.`);
            logAction(`Looted ${monster.loot}`, "item");
            gotSomething = true;
          }
        } else {
          if (monster.gold) {
            player.gold += monster.gold;
            log(`You find ${monster.gold} gold.`);
            logAction(`Looted ${monster.gold} gold`, "item");
          }
          if (monster.loot) {
            player.inventory[monster.loot] = (player.inventory[monster.loot] || 0) + 1;
            log(`The ${monster.name} dropped ${monster.loot}.`);
            logAction(`Looted ${monster.loot}`, "item");
          }
          gotSomething = true;
        }

        if (!gotSomething) log("Nothing remains but dust.");

        grantXP(monster.xp || 20);
        delete loc.monster;
        player.inCombat = false;
        player.currentMonster = null;
        updateGlow();
        return;
      }
			
			return;
    } // closes if (cmd === 'fight')

    // Run
    if (cmd === 'run') {
      if (!player.inCombat || !player.currentMonster) return log('You are not in combat.');
      if (Math.random() < 0.55) {
        logCombat(`You successfully flee from the *${player.currentMonster.name}*.`);
        player.inCombat = false;
        player.currentMonster = null;
        updateGlow();
      } else {
        const graze = Math.floor(Math.random() * 6) + 1;
        player.hp -= graze;
        logCombat(`You failed to escape! The *${player.currentMonster.name}* grazes you for [${graze}] damage.`);
        if (player.hp <= 0) {
          log("You have died...");
          logAction("You died", "combat");
          player.inCombat = false;
          player.currentMonster = null;
          updateGlow();

          setTimeout(() => {
            // Flavor message
            log("\nA distant voice whispers prayers over your fallen form...");
            log("You awaken beneath the vaulted arches of the Church of Kalendale.");
            log("The cleric smiles faintly. \"A small donation was required to restore your life.\"");

            // Resurrect logic
            player.hp = player.maxHp;
            player.location = "Church of Kalendale";
            player.gold = 0;

            // Clear any lingering monster from previous room
            const loc = world[player.location];
            if (loc) {
              loc.monster = null;
            }

            logAction("Resurrected at the Church of Kalendale (all gold lost)", "info");
            updateGlow();
            describeLocation();
          }, 3000); // small delay for immersion

          return;
        }
        updateGlow();
      }
      return;
    }
    
    // --- Unknown command fallback ---
    else {
      log(`"${cmd}" - you can’t do that here...`);
      logAction(`Unknown command: ${cmd}`, "info");
    }
  }

  // --- Input & Onboarding ---
  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      const cmdRaw = inputEl.value.trim();
      inputEl.value = '';
      if (!cmdRaw) return;

      // Keep commands lowercase, but preserve name case at step 0
      const cmd = (step === 0) ? cmdRaw : cmdRaw.toLowerCase();

      log(`
> ${cmdRaw}`);
      processCommand(cmd);
    }
  });

  function normalizeGeneratedRoom(gen) {
    return {
      description: gen?.desc || `You step into a dimly lit ${gen?.zone || 'place'}.`,
      exits: gen?.exits || {},
      monster: gen?.monster || null,
      loot: gen?.loot || {},
      zone: gen?.zone || 'unknown',
      depth: gen?.depth || 1,
      discovered: true
    };
  }

  function processCommand(cmd) {
    if (pendingConfirm) {
      // --- Name confirmation branch (UPDATED) ---
      if (pendingConfirm.type === 'name') {
        const answer = cmd.toLowerCase();

        if (answer === 'yes') {
          pendingConfirm = null;

					// Confirm name
					log(` `);
					logFade([`"${player.name}..." the voice repeats softly.`], 2200);
					step = 0.5; // temporary state between name and race selection

          // Lantern glow while the race intro fades in
          consoleEl.classList.add('lanternGlow');

          const raceIntroLines = [
            " ",
            "Candlelight trembles — shaping hints of a face not wholly human, nor entirely known.",
            "The voice hums in thought, low and uncertain, as though tasting your name upon the air.",
            '"Tell me… what manner of being wakes beneath this veil of dusk?"'
          ];

          logFade(raceIntroLines, 3000);

          // After narration, show race list and enter race-selection step
          setTimeout(() => {
            consoleEl.classList.remove('lanternGlow');
					  log(" ");
            log("(Human, Elf, Dwarf, Orc, Halfling)");
            step = 1;       // now actually in race selection
            saveGame(true);
          }, raceIntroLines.length * 3000 + 800);

          return; // IMPORTANT: don't fall through
        }

        if (answer === 'no') {
          player.name = '';
          pendingConfirm = null;
          log("Then tell me again — what is your name?");
          return;
        }

        log("Please type 'yes' or 'no'.");
        return;
      }

      // --- Load confirmation branch (unchanged) ---
      if (pendingConfirm.type === 'load') {
        if (cmd.toLowerCase() === 'yes') { loadGame(true); pendingConfirm = null; }
        else if (cmd.toLowerCase() === 'no') { log("Cancelled loading save."); pendingConfirm = null; }
        else log("Please type 'yes' or 'no'.");
        return;
      }
    }

    if (step === 0) {
      player.name = cmd; // preserves case
      log(`Confirm name '${player.name}'? (yes/no)`);
      pendingConfirm = { type: 'name' };
      return;
    }

    if (pendingConfirm && pendingConfirm.type === 'name' && cmd.toLowerCase() === 'yes') {
      pendingConfirm = null;

      // Confirm name
      log(` `);
      logFade([`"${player.name}..." the voice repeats softly.`], 2200);
      step = 0.5; // temporary state between name and race selection

      // Start lantern flicker effect
      consoleEl.classList.add('lanternGlow');

      // Fade-in narrative lines before race selection
      const raceIntroLines = [
          " ",
          "Candlelight trembles — shaping hints of a face not wholly human, nor entirely known.",
          "The voice hums in thought, low and uncertain, as though tasting your name upon the air.",
          '"Tell me… what manner of being wakes beneath this veil of dusk?"'
      ];

      logFade(raceIntroLines, 3000);

      // After narration finishes, show races and remove glow
      setTimeout(() => {
        consoleEl.classList.remove('lanternGlow');
				log(" ");
        log("(Human, Elf, Dwarf, Orc, Halfling)");
        step = 1;          // now actually enter race-selection phase
        saveGame(true);
      }, raceIntroLines.length * 3000 + 800);

      return;
    }

    if (pendingConfirm && pendingConfirm.type === 'name' && cmd.toLowerCase() === 'no') {
      player.name = '';
      pendingConfirm = null;
      log("Then tell me again — what is your name?");
      return;
    }

    if (step === 1) {
      const choice = cmd.toLowerCase();
      const validRaces = ['human', 'elf', 'dwarf', 'orc', 'halfling'];

      if (!validRaces.includes(choice)) {
        log("That is not a known race. Choose: Human, Elf, Dwarf, Orc, Halfling");
        return;
      }

      player.race = choice.charAt(0).toUpperCase() + choice.slice(1);

      const awakenLines = [
        " ",
        'The voice lingers for a heartbeat, then drifts away like a breath in the cold.',
        'Lanterns sway in the mist, their flames wavering against the coming dark.',
        'Dusk has fallen on the small town of Kalendale.',
      ];

      logFade(awakenLines, 3000);

      setTimeout(() => {
        consoleEl.classList.remove('lanternGlow');
        consoleEl.classList.remove('ambientFlicker'); // stop flicker completely
        step = 3;
        saveGame(true);
				log(" ");
        log("You awaken in the town square, the mist curling through lanternlight — your journey quietly begins.");	
        describeLocation();
      }, awakenLines.length * 3000 + 800);

      return;
    }

    gameLogic(cmd);
  }

  // --- Quick save on quit ---
  window.addEventListener('beforeunload', function () { saveGame(); });

	// --- Auto-load save ---
	const resetFlag = localStorage.getItem('kalendaleReset');
	const saved = localStorage.getItem('kalendaleSave');
	if (saved && !resetFlag) {
		const data = JSON.parse(saved);

		// Only reject if explicitly incomplete (step < 3)
		if (typeof data.step === "number" && data.step >= 3) {
			log("Loading your last saved game...");
			loadGame(true);
		} else {
			// Restart creation
			localStorage.removeItem('kalendaleSave');
			localStorage.removeItem('kalendaleReset');
      const introLines = [
        " ",
        'Fog coils around you, forming and fading like half-remembered dreams. A candle flickers somewhere unseen.',
        'A soft voice breaks the silence — distant, yet near...',
        '"Traveler…?"',
        '"No…"',
        '"Wanderer…"',
        '"By what name do you still remember yourself?"',
      ];

      // Play the fading intro
      logFade(introLines, 3000);

      // After the last line, start the ambient flicker
      setTimeout(() => {
        consoleEl.classList.add("ambientFlicker");
      }, introLines.length * 3000 + 1000); // small buffer after final line

      step = 0;
		}
	} else {
		localStorage.removeItem('kalendaleReset');
    const introLines = [
      " ",
      'Fog coils around you, forming and fading like half-remembered dreams. A candle flickers somewhere unseen.',
      'A soft voice breaks the silence — distant, yet near...',
      '"Traveler…?"',
      '"No…"',
      '"Wanderer…"',
      '"By what name do you still remember yourself?"',
    ];

    // Play the fading intro
    logFade(introLines, 3000);

    // After the last line, start the ambient flicker
    setTimeout(() => {
      consoleEl.classList.add("ambientFlicker");
    }, introLines.length * 3000 + 1000); // small buffer after final line

    step = 0;

	}
}
