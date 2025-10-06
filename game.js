import { itemData, shopItems } from './data/items.js';
import { monsters } from './data/monsters.js';
import { descriptions, milestoneRooms } from './data/rooms.js';

// --- Utility to normalize item names ---
function normalizeItemName(input) {
  const lower = input.toLowerCase();
  // Try shop items
  for (const item of Object.keys(shopItems)) {
    if (item.toLowerCase() === lower) return item;
  }
  // Try all items
  for (const item of Object.keys(itemData)) {
    if (item.toLowerCase() === lower) return item;
  }
  // Fallback: just capitalize first letter
  return input.charAt(0).toUpperCase() + input.slice(1);
}

window.onload = function () {
  const consoleEl = document.getElementById('console');
  const inputEl = document.getElementById('inputLine');
  const logWindow = document.getElementById('logWindow');
  const logToggle = document.getElementById('logToggle');

  // --- Log UI ---
  let logVisible = true;
  logToggle.onclick = () => {
    logVisible = !logVisible;
    logWindow.style.display = logVisible ? 'block' : 'none';
    logToggle.innerText = logVisible ? 'Hide Log' : 'Show Log';
  };

  function log(text) {
    consoleEl.innerText += `\n${text}`;
    consoleEl.scrollTop = consoleEl.scrollHeight;
  }

  // --- Player ---
  let player = {
    name: '',
    race: '',
    class: '',
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
    'Town Square': {
      description: 'A foggy town square with flickering lanterns.',
      exits: { north: 'Town Gates', east: 'Shop', west: 'Tavern', south: 'Graveyard' },
      loot: {}
    },
    'Town Gates': {
      description: 'Tall iron gates mark the edge of town. Beyond lies the untamed forest.',
      exits: { south: 'Town Square', north: null },
      loot: {}
    },
    'Shop': {
      description: 'Abby the Shopkeeper smiles. Potions and gear line the shelves.',
      exits: { west: 'Town Square' },
      shop: true,
      loot: {}
    },
    'Tavern': {
      description: 'The tavern smells of ale and secrets. Adventurers whisper in the corners.',
      exits: { east: 'Town Square' },
      loot: {}
    },
    'Graveyard': {
      description: 'Cracked tombstones and swirling mist. You feel watched.',
      exits: { north: 'Town Square', south: 'Crypts' },
      loot: {}
    },
    'Crypts': {
      description: 'A cold stone stairwell descends into the ancient crypts.',
      exits: { north: 'Graveyard', down: null },
      loot: {}
    }
  };

  let roomCount = 1;
  let step = 0;
  let pendingConfirm = null;

  // --- Save / Load / Reset ---
  function saveGame() {
    const data = { player, world, roomCount, step };
    localStorage.setItem('kalendaleSave', JSON.stringify(data));
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
    step = (typeof data.step === 'number') ? data.step : 3;
    pendingConfirm = null;
    inputEl.disabled = false;
    updateGlow();
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
    log("Save data cleared. Start a new game.");
  }

  // --- XP / Level ---
  function xpForNextLevel(lv) { return 50 + (lv - 1) * 70; }

  function grantXP(amount) {
    player.xp += amount;
    log(`You gained ${amount} XP.`);
    while (player.xp >= xpForNextLevel(player.level)) {
      player.xp -= xpForNextLevel(player.level);
      player.level++;
      const hpGain = 10 + Math.floor(Math.random() * 6);
      player.maxHp += hpGain;
      player.hp = player.maxHp;
      log(`*** You are now Level ${player.level}! Max HP +${hpGain}. HP fully restored. ***`);
      updateGlow();
    }
  }

  // --- Glow ---
  function updateGlow() {
    inputEl.classList.remove('inCombatGlow', 'lowHpGlow');
    if (player.inCombat) {
      if (player.hp <= 30) inputEl.classList.add('lowHpGlow');
      else inputEl.classList.add('inCombatGlow');
    }
  }

  // --- World gen ---
  const lootTable = Object.keys(itemData);
  const directions = ['north', 'south', 'east', 'west', 'up', 'down'];
  const directionAliases = {
    n: 'north',
    s: 'south',
    e: 'east',
    w: 'west',
    u: 'up',
    d: 'down'
  };

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
    log(`\n== ${player.location} ==`);
    log(loc.description);
    const exits = Object.entries(loc.exits).map(([d, dest]) => `${d.toUpperCase()} → ${dest || '???'}`).join(', ');
    log(`Exits: ${exits || 'None'}`);

    if (loc.shop) {
      log('The shopkeeper has these items:');
      for (const [item, data] of Object.entries(shopItems)) {
        log(`- ${item} (${data.price} gold)`);
      }
      log('The shopkeeper will also buy any item you bring her.');
    }

    if (loc.loot && Object.keys(loc.loot).length > 0) {
      log("Items on the ground:");
      for (const [item, count] of Object.entries(loc.loot)) {
        log(`- ${item} x${count}`);
      }
    }

    if (loc.monster) log(`A ${loc.monster.name} lurks here. Type "fight" to engage.`);
  }

  // --- Game Logic ---
  function gameLogic(cmd) {
    const loc = world[player.location];

    if (cmd === 'help') {
      log(`Commands:
      - north, south, east, west, up, down → move
      - look → examine the room
      - get [item], drop [item]
      - fight, run
      - status, inventory (or inv)
      - buy [item], sell [item] (in shop)
      - equip [item], unequip [weapon|armor]
      - inspect [item]
      - use [item]
      - save, load, reset
      - help`);
      return;
    }

    // Save/Load/Reset
    if (cmd === 'save') return saveGame();
    if (cmd === 'load') return loadGame();
    if (cmd === 'reset') return resetGame();
    if (cmd === 'reset confirm') return resetGame(true);

    // Direction alias expansion
    if (directionAliases[cmd]) cmd = directionAliases[cmd];
    // Movement
    if (directions.includes(cmd)) {
      if (player.inCombat) return log("You can't leave while in combat!");
      if (!(cmd in loc.exits)) return log("You can't go that way.");
      if (!loc.exits[cmd]) {
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

    if (cmd === 'inventory' || cmd === 'inv') {
      if (Object.keys(player.inventory).length === 0) log("Inventory: Empty");
      else for (const [item, count] of Object.entries(player.inventory)) log(`${item} x${count}`);
      log(`Gold: ${player.gold}`);
      log(`Equipped Weapon: ${player.equipped.weapon || 'None'}`);
      log(`Equipped Armor: ${player.equipped.armor || 'None'}`);
      return;
    }

    if (cmd === 'status') {
      log(`Name: ${player.name}`);
      log(`Race: ${player.race || 'Unchosen'}`);
      log(`Class: ${player.class || 'Unchosen'}`);
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
      } else log("You don’t have enough gold.");
      return;
    }

    // Shop Sell
    if (cmd.startsWith('sell ') && loc.shop) {
      const itemName = normalizeItemName(cmd.slice(5).trim());
      if (!player.inventory[itemName]) return log(`You don’t have a ${itemName} to sell.`);
      const baseValue = shopItems[itemName]?.price || itemData[itemName]?.value || 10;
      const sellValue = Math.floor(baseValue / 2);
      player.inventory[itemName]--;
      if (player.inventory[itemName] <= 0) delete player.inventory[itemName];
      player.gold += sellValue;
      log(`You sold ${itemName} for ${sellValue} gold.`);
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
      } else log(`You don't have a ${itemName}.`);
      return;
    }

    // Inspect
    if (cmd.startsWith('inspect ')) {
      const itemName = normalizeItemName(cmd.slice(8).trim());
      const owned = player.inventory[itemName] || player.equipped.weapon === itemName || player.equipped.armor === itemName;
      if (owned && itemData[itemName]) {
        log(`${itemName}: ${itemData[itemName].description}`);
      } else {
        log(`You don't have a ${itemName}.`);
      }
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
          }
          player.equipped[type] = itemName;
          player.inventory[itemName]--;
          if (player.inventory[itemName] <= 0) delete player.inventory[itemName];
          log(`You equipped the ${itemName}.`);
        } else log(`You can't equip a ${itemName}.`);
      } else log(`You don't have a ${itemName}.`);
      return;
    }

    if (cmd.startsWith('unequip ')) {
      const slot = cmd.slice(8).trim();
      if (["weapon", "armor"].includes(slot) && player.equipped[slot]) {
        const unequipped = player.equipped[slot];
        player.inventory[unequipped] = (player.inventory[unequipped] || 0) + 1;
        log(`You unequipped the ${unequipped}.`);
        player.equipped[slot] = null;
      } else log(`You have nothing equipped in ${slot}.`);
      return;
    }

    // Use consumables
    if (cmd.startsWith('use ')) {
      const itemName = normalizeItemName(cmd.slice(4).trim());
      if (player.inventory[itemName] > 0 && itemData[itemName]) {
        if (itemName === 'Healing Potion') {
          player.inventory[itemName]--;
          if (player.inventory[itemName] <= 0) delete player.inventory[itemName];
          player.hp = Math.min(player.maxHp, player.hp + 30);
          log(`You feel rejuvenated. Potions left: ${player.inventory[itemName] || 0}`);
          updateGlow();
        } else {
          log(`You can't use ${itemName} right now.`);
        }
      } else log(`You don't have a ${itemName}.`);
      return;
    }

    // Combat
    if (cmd === 'fight') {
      const monster = loc.monster;
      if (!monster) return log("There's nothing to fight here.");
      if (!player.inCombat) {
        player.inCombat = true;
        player.currentMonster = monster;
        log(`You engage the ${monster.name} in combat!`);
      }
      updateGlow();

      const weaponBonus = player.equipped.weapon && itemData[player.equipped.weapon]?.attack || 0;
      const armorBonus = player.equipped.armor && itemData[player.equipped.armor]?.defense || 0;

      let playerHit = Math.floor(Math.random() * 20) + 5 + weaponBonus;
      let monsterHit = Math.max(0, Math.floor(Math.random() * 15) + 3 - armorBonus);

      if (Math.random() < 0.08) playerHit = 0;
      if (Math.random() < 0.10) monsterHit = 0;
      if (Math.random() < 0.10) playerHit = Math.floor(playerHit * 1.5);
      if (Math.random() < 0.05) monsterHit = Math.floor(monsterHit * 1.5);

      monster.hp -= playerHit;
      player.hp -= monsterHit;

      log(`You hit the ${monster.name} for ${playerHit}. ${monster.name} hits you for ${monsterHit}.`);

      if (player.hp <= 0) {
        log("You have died. Game over.");
        inputEl.disabled = true;
        player.inCombat = false;
        player.currentMonster = null;
        updateGlow();
        return;
      }

      if (monster.hp <= 0) {
        log(`You defeated the ${monster.name}!`);
        if (monster.loot) {
          player.inventory[monster.loot] = (player.inventory[monster.loot] || 0) + 1;
          log(`The ${monster.name} dropped ${monster.loot}.`);
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

    if (cmd === 'run') {
      if (!player.inCombat || !player.currentMonster) return log('You are not in combat.');
      if (Math.random() < 0.55) {
        log(`You successfully flee from the ${player.currentMonster.name}.`);
        player.inCombat = false;
        player.currentMonster = null;
        updateGlow();
      } else {
        const graze = Math.floor(Math.random() * 6) + 1;
        player.hp -= graze;
        log(`You failed to escape! The ${player.currentMonster.name} grazes you for ${graze} damage.`);
        if (player.hp <= 0) {
          log("You have died. Game over.");
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

      // Lowercase all commands except at step 0 (name selection)
      const cmd = (step === 0) ? cmdRaw : cmdRaw.toLowerCase();

      log(`> ${cmdRaw}`);
      processCommand(cmd);
    }
  });

  function processCommand(cmd) {
    if (pendingConfirm) {
      if (pendingConfirm.type === 'name') {
        if (cmd.toLowerCase() === 'yes') { step = 1; log(`Hello, ${player.name}. Choose your race: Human, Elf, Orc`); pendingConfirm = null; }
        else if (cmd.toLowerCase() === 'no') { player.name = ''; log("Okay, enter your name again:"); pendingConfirm = null; }
        else log("Please type 'yes' or 'no'.");
        return;
      }
      if (pendingConfirm.type === 'load') {
        if (cmd.toLowerCase() === 'yes') { loadGame(true); pendingConfirm = null; }
        else if (cmd.toLowerCase() === 'no') { log("Cancelled loading save."); pendingConfirm = null; }
        else log("Please type 'yes' or 'no'.");
        return;
      }
    }

    if (step === 0) {
      player.name = cmd; // preserve case
      log(`Confirm name '${player.name}'? (yes/no)`);
      pendingConfirm = { type: 'name' };
      return;
    }
    if (step === 1) {
      const choice = cmd.toLowerCase();
      if (!['human', 'elf', 'orc'].includes(choice)) return log('Invalid race. Choose: Human, Elf, Orc');
      player.race = choice.charAt(0).toUpperCase() + choice.slice(1);
      step = 2;
      log(`Race set to ${player.race}. Choose your class: Warrior, Mage, Rogue`);
      return;
    }
    if (step === 2) {
      const choice = cmd.toLowerCase();
      if (!['warrior', 'mage', 'rogue'].includes(choice)) return log('Invalid class. Choose: Warrior, Mage, Rogue');
      player.class = choice.charAt(0).toUpperCase() + choice.slice(1);
      step = 3;
      log(`Class set to ${player.class}. You begin in the Town Square.`);
      describeLocation();
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
    log("Loading your last saved game...");
    loadGame(true);
  } else {
    localStorage.removeItem('kalendaleReset');
    log('KBOX Labs welcomes you to the Shadows of Kalendale RPG!');
    log('Enter your name:');
  }
};

