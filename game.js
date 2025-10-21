import { itemData, shopItems } from './data/items.js';
import { monsters } from './data/monsters.js';
import { descriptions, milestoneRooms } from './data/rooms.js';
import { town } from './data/town.js';
import { RoomGenerator } from './data/roomGenerator.js';

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

window.onload = function () {
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
    inventory: {}, // stacked: { "Healing Potion": 2, "Rusty Sword": 1 }
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

    if (player.hp <= 30) {
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

  function describeLocation() {
    const loc = world[player.location];
    logAction(`Entered ${player.location}`, "move");
    log(`\n== ${player.location} ==`);
    log(loc.description);
    const exits = Object.entries(loc.exits).map(([d, dest]) => `${d.toUpperCase()} → ${dest || '???'}`).join(', ');
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
      log(`You notice ${lootList} on the ground.`);
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
      let zone;
      if (player.location.includes('Crypts') || player.location.includes('Dungeon')) zone = 'dungeon';
      else if (player.location.includes('Town Gates') || player.location.includes('Forest')) zone = 'forest';
      else if (player.location === 'Graveyard' && cmd === 'south') zone = 'dungeon';
      else if (player.location === 'Town Gates' && cmd === 'north') zone = 'forest';
      else zone = 'forest';

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
        return;
      }

      // Otherwise, move into existing room
      player.location = destId;
      describeLocation();
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

    // Use consumables (stacked, one at a time)
    if (cmd.startsWith('use ')) {
      const itemName = normalizeItemName(cmd.slice(4).trim());
      if (player.inventory[itemName] > 0 && itemData[itemName]) {
        if (itemName === 'Healing Potion') {
          player.inventory[itemName]--;
          if (player.inventory[itemName] <= 0) delete player.inventory[itemName];
          player.hp = Math.min(player.maxHp, player.hp + 30);
          log(`You feel rejuvenated. Potions left: ${player.inventory[itemName] || 0}`);
          logAction("Used Healing Potion (+30 HP)", "heal");
          updateGlow();
        } else {
          log(`You can't use ${itemName} right now.`);
        }
      } else log(`You don't have a ${itemName}.`);
      return;
    }

    // Tavern Easter egg: Ale & Cider (only in Tavern)
    if (player.location === "Tavern") {
      if (cmd === "ale") {
        if (player.gold >= 5) {
          player.gold -= 5;
          player.hp = Math.min(player.maxHp, player.hp + 5);
          log("You order a frothy mug of ale. Restores 5 HP.");
          logAction("Drank Ale (+5 HP)", "heal");
          updateGlow();
        } else {
          log("The barkeep frowns. 'No coin, no ale.'");
        }
        return;
      }
      if (cmd === "cider") {
        if (player.gold >= 7) {
          player.gold -= 7;
          player.hp = Math.min(player.maxHp, player.hp + 10);
          log("You sip a sweet cider. Restores 10 HP.");
          logAction("Drank Cider (+10 HP)", "heal");
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
        logCombat("You have fallen. The world fades to black...");
        inputEl.disabled = true;
        player.inCombat = false;
        player.currentMonster = null;
        updateGlow();
        return;
      }

      if (monster.hp <= 0) {
        logCombat(`You defeated the *${monster.name}*!`);
        if (monster.loot) {
          player.inventory[monster.loot] = (player.inventory[monster.loot] || 0) + 1;
          logCombat(`The *${monster.name}* dropped ${monster.loot}.`);
        }
        if (monster.gold) player.gold += monster.gold;
        grantXP(monster.xp || 20);
        delete loc.monster;
        player.inCombat = false;
        player.currentMonster = null;
        updateGlow();
      } else {
        log(`The *${monster.name}* has ${monster.hp} HP left. You have ${player.hp}/${player.maxHp} HP.`);
        updateGlow();
      }
      return;
    }

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
          logCombat("You have fallen. The world fades to black...");
          inputEl.disabled = true;
          player.inCombat = false;
          player.currentMonster = null;
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
            log("(Human, Elf, Dwarf, Orc, Halfling, Half-Elf)");
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
        log("(Human, Elf, Dwarf, Orc, Halfling, Half-Elf)");
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
      const validRaces = ['human', 'elf', 'dwarf', 'orc', 'halfling', 'half-elf'];

      if (!validRaces.includes(choice)) {
        log("That is not a known race. Choose: Human, Elf, Dwarf, Orc, Halfling, Half-Elf.");
        return;
      }

      player.race = choice.charAt(0).toUpperCase() + choice.slice(1);

      const awakenLines = [
        " ",
        'The voice lingers for a heartbeat, then drifts away like breath in the cold.',
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
};
