import { itemData, shopItems } from './data/items.js';
import { monsters } from './data/monsters.js';
import { descriptions, milestoneRooms } from './data/rooms.js';
import { town } from './data/town.js';


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

  // --- Log functions ---
  function log(text) {
    consoleEl.innerText += `\n${text}`;
    consoleEl.scrollTop = consoleEl.scrollHeight;
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
  function saveGame() {
    const data = { player, world, roomCount, step };
    localStorage.setItem('kalendaleSave', JSON.stringify(data));
    logAction("Game saved", "info");
    log("Game saved.");
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

  function resetGame(force = false) {
    const saved = localStorage.getItem('kalendaleSave');
    if (!saved) return log("No save exists to reset.");
    if (!force) {
      log("Are you sure you want to RESET and delete your save? Type 'reset confirm' to proceed.");
      return;
    }
    localStorage.removeItem('kalendaleSave');
    localStorage.setItem('kalendaleReset', 'true');
    logAction("Save reset", "info");
    log("Save data cleared. Start a new game.");
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
    if (player.inCombat) {
      if (player.hp <= 30) inputEl.classList.add('lowHpGlow');
      else inputEl.classList.add('inCombatGlow');
    }
  }

  // --- World generation ---
  const lootTable = Object.keys(itemData);
  const directions = ['north', 'south', 'east', 'west', 'up', 'down'];
  const directionAliases = { n: 'north', s: 'south', e: 'east', w: 'west', u: 'up', d: 'down' };

  function generateRoom(type) {
    const id = `${type.charAt(0).toUpperCase() + type.slice(1)} Room #${roomCount++}`;
    const depth = Object.keys(world).filter(k => k.startsWith(type === 'forest' ? 'Forest' : 'Dungeon')).length + 1;
    const defaultDesc = descriptions[type][Math.floor(Math.random() * descriptions[type].length)];
    const desc = (milestoneRooms[type] && milestoneRooms[type][depth]) ? milestoneRooms[type][depth] : defaultDesc;

    let monster = null;
    if (Math.random() < 0.5) {
      const pool = monsters[type];
      const index = Math.min(Math.floor(depth / 3), pool.length - 1);
      monster = { ...pool[index] };
    }

    const loot = {};
    if (Math.random() < 0.4) {
      const roll = lootTable[Math.floor(Math.random() * lootTable.length)];
      loot[roll] = 1;
    }

    const shuffled = directions.slice().sort(() => 0.5 - Math.random());
    const allowedDirs = shuffled.slice(0, Math.floor(Math.random() * 3) + 1);
    const exits = {};
    for (const dir of allowedDirs) exits[dir] = null;

    world[id] = { description: desc, exits, monster, loot };
    return id;
  }

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
      log("Items on the ground:");
      for (const [item, count] of Object.entries(loc.loot)) log(`- ${item} x${count}`);
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

    // Save/Load/Reset
    if (cmd === 'save') return saveGame();
    if (cmd === 'load') return loadGame();
    if (cmd === 'reset') return resetGame();
    if (cmd === 'reset confirm') return resetGame(true);

    // Movement (blocked during combat)
    if (directions.includes(cmd)) {
      if (player.inCombat) return log("You can't leave while in combat!");
      if (!(cmd in loc.exits)) return log("You can't go that way.");
      if (!loc.exits[cmd]) {
        // Control region: forest beyond Town Gates; dungeon beyond Crypts/Graveyard south
        let type;
        if (player.location.includes('Crypts') || player.location.includes('Dungeon')) type = 'dungeon';
        else if (player.location.includes('Town Gates') || player.location.includes('Forest')) type = 'forest';
        else if (player.location === 'Graveyard' && cmd === 'south') type = 'dungeon';
        else if (player.location === 'Town Gates' && cmd === 'north') type = 'forest';
        else type = 'forest';
        const newRoom = generateRoom(type);
        loc.exits[cmd] = newRoom;
        world[newRoom].exits[getOppositeDirection(cmd)] = player.location;
      }
      player.location = loc.exits[cmd];
      return describeLocation();
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
        log(`You engage the ${monster.name} in combat!`);
        logAction(`Engaged ${monster.name}`, "combat");
      }
      updateGlow();

      const weaponBonus = (player.equipped.weapon && itemData[player.equipped.weapon]?.attack) || 0;
      const armorBonus  = (player.equipped.armor  && itemData[player.equipped.armor]?.defense) || 0;

      let playerHit  = Math.floor(Math.random() * 20) + 5 + weaponBonus;
      let monsterHit = Math.max(0, Math.floor(Math.random() * 15) + 3 - armorBonus);

      if (Math.random() < 0.08) playerHit = 0; // player miss
      if (Math.random() < 0.10) monsterHit = 0; // monster miss
      if (Math.random() < 0.10) playerHit = Math.floor(playerHit * 1.5); // player crit
      if (Math.random() < 0.05) monsterHit = Math.floor(monsterHit * 1.5); // monster crit

      // Apply results
      monster.hp -= playerHit;
      player.hp  -= monsterHit;

      // Detailed logging
      if (playerHit === 0) {
        logAction(`You missed the ${monster.name}!`, "combat");
      } else {
        logAction(`You hit the ${monster.name} for ${playerHit} damage. [${monster.hp > 0 ? monster.hp : 0} HP left]`, "combat");
      }

      if (monsterHit === 0) {
        logAction(`The ${monster.name} missed you!`, "combat");
      } else {
        logAction(`${monster.name} hits you for ${monsterHit} damage. [${player.hp > 0 ? player.hp : 0}/${player.maxHp} HP]`, "combat");
      }

      if (player.hp <= 0) {
        log("You have died. Game over.");
        logAction("You died", "combat");
        inputEl.disabled = true;
        player.inCombat = false;
        player.currentMonster = null;
        updateGlow();
        return;
      }

      if (monster.hp <= 0) {
        log(`You defeated the ${monster.name}!`);
        logAction(`Defeated ${monster.name}`, "combat");
        if (monster.loot) {
          player.inventory[monster.loot] = (player.inventory[monster.loot] || 0) + 1;
          log(`The ${monster.name} dropped ${monster.loot}.`);
          logAction(`Looted ${monster.loot}`, "item");
        }
        if (monster.gold) player.gold += monster.gold;
        grantXP(monster.xp || 20);
        delete loc.monster;
        player.inCombat = false;
        player.currentMonster = null;
        updateGlow();
      } else {
        log(`The ${monster.name} has ${monster.hp} HP left. You have ${player.hp}/${player.maxHp} HP.`);
        updateGlow();
      }
      return;
    }

    // Run
    if (cmd === 'run') {
      if (!player.inCombat || !player.currentMonster) return log('You are not in combat.');
      if (Math.random() < 0.55) {
        log(`You successfully flee from the ${player.currentMonster.name}.`);
        logAction(`Fled from ${player.currentMonster.name}`, "combat");
        player.inCombat = false;
        player.currentMonster = null;
        updateGlow();
      } else {
        const graze = Math.floor(Math.random() * 6) + 1;
        player.hp -= graze;
        log(`You failed to escape! The ${player.currentMonster.name} grazes you for ${graze} damage.`);
        if (player.hp <= 0) {
          log("You have died. Game over.");
          logAction("You died", "combat");
          inputEl.disabled = true;
          player.inCombat = false;
          player.currentMonster = null;
        }
        updateGlow();
      }
      return;
    }

    log('Unknown command.');
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

  function processCommand(cmd) {
    if (pendingConfirm) {
      // --- Name confirmation branch (UPDATED) ---
      if (pendingConfirm.type === 'name') {
        const answer = cmd.toLowerCase();

        if (answer === 'yes') {
          pendingConfirm = null;

          // Acknowledge the name
          log(` `);
          log(`"${player.name}..." the voice repeats softly.`);

          // Lantern glow while the race intro fades in
          consoleEl.classList.add('lanternGlow');

          const raceIntroLines = [
            " ",
            "Lantern light flickers — revealing faint features not quite human, not yet known.",
            "The voice hums thoughtfully, as if weighing your answer.",
            '"Tell me... what manner of being stands before me?"',
            " "
          ];

          logFade(raceIntroLines, 3000);

          // After narration, show race list and enter race-selection step
          setTimeout(() => {
            consoleEl.classList.remove('lanternGlow');
            log("(Human, Elf, Dwarf, Orc, Halfling, Half-Elf)");
            step = 1;       // now actually in race selection
            saveGame();
          }, raceIntroLines.length * 3000 + 800);

          return; // IMPORTANT: don't fall through
        }

        if (answer === 'no') {
          player.name = '';
          pendingConfirm = null;
          log("Very well... then tell me again — what is your name?");
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
      log(`"${player.name}..." the voice repeats softly.`);
      step = 0.5; // temporary state between name and race selection

      // Start lantern flicker effect
      consoleEl.classList.add('lanternGlow');

      // Fade-in narrative lines before race selection
      const raceIntroLines = [
          " ",
          "Lantern light flickers — revealing faint features not quite human, not yet known.",
          "The voice hums thoughtfully, as if weighing your answer.",
          '"Tell me... what manner of being stands before me?"',
          " "
      ];

      logFade(raceIntroLines, 3000);

      // After narration finishes, show races and remove glow
      setTimeout(() => {
        consoleEl.classList.remove('lanternGlow');
        log("(Human, Elf, Dwarf, Orc, Halfling, Half-Elf)");
        step = 1;          // now actually enter race-selection phase
        saveGame();
      }, raceIntroLines.length * 3000 + 800);

      return;
    }

    if (pendingConfirm && pendingConfirm.type === 'name' && cmd.toLowerCase() === 'no') {
      player.name = '';
      pendingConfirm = null;
      log("Very well... then tell me again — what is your name?");
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
        "The lantern’s glow dissolves into daylight.",
        "The voice fades to memory as you open your eyes.",
        "Cobblestones press beneath your boots — the town of Kalendale awaits.",
        " "
      ];

      logFade(awakenLines, 3000);

      setTimeout(() => {
        consoleEl.classList.remove('lanternGlow');
        consoleEl.classList.remove('ambientFlicker'); // stop flicker completely
        log("You awaken in the Town Square, ready to begin your journey.");
        step = 3;
        saveGame();
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
        "The fog stirs around you as shapes drift in and out of sight. Lantern light flickers somewhere in the dark.",
        "A soft, distant voice breaks the silence...",
        '"Traveler..."',
        '"By what name do they call you?"'
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
      "The fog stirs around you as shapes drift in and out of sight. Lantern light flickers somewhere in the dark.",
      "A soft, distant voice breaks the silence...",
      '"Traveler..."',
      '"By what name do they call you?"'
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
