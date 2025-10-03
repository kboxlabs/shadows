window.onload = function () {
  const consoleEl = document.getElementById('console');
  const inputEl = document.getElementById('inputLine');
  const logWindow = document.getElementById('logWindow');
  const logToggle = document.getElementById('logToggle');

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

  function logAction(text, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.innerText = `[${timestamp}] ${text}`;
    logWindow.appendChild(entry);
    if (logWindow.children.length > 20) logWindow.removeChild(logWindow.firstChild);
    logWindow.scrollTop = logWindow.scrollHeight;
  }

	let player = {
		name: '',
		race: '',
		class: '',
		hp: 100,
		maxHp: 100,
		gold: 50,
		inventory: [],
		location: 'Town Square',
		equipped: {
			weapon: null,
			armor: null
		},
		inCombat: false,
		currentMonster: null,
	};

	const itemData = {
	  "Wolf Fang": { description: "A sharp fang from a wraith wolf.", type: "loot" },
	  "Rusty Sword": { description: "An old sword. Better than nothing.", type: "weapon", attack: 5 },
	  "Healing Potion": { description: "Restores 30 HP when used.", type: "potion" },
	  "Gold Nugget": { description: "A shiny chunk of gold.", type: "loot" },
	  "Ancient Coin": { description: "A coin from a forgotten empire.", type: "loot" },
	  "Leather Armor": { description: "Basic protection against attacks.", type: "armor", defense: 3 }
	};

  const lootTable = Object.keys(itemData);

  const directions = ['north', 'south', 'east', 'west', 'up', 'down'];

  let world = {
    'Town Square': {
      description: 'A foggy town square with flickering lanterns.',
      exits: { north: 'Town Gates', east: 'Shop', west: 'Tavern', south: 'Graveyard' },
      loot: null
    },
    'Town Gates': {
      description: 'Tall iron gates mark the edge of town. Beyond lies the untamed forest.',
      exits: { south: 'Town Square', north: null },
      loot: null
    },
    'Shop': {
      description: 'Abby the Shopkeeper smiles. Potions and gear line their shelves.',
      exits: { west: 'Town Square' },
      shop: true,
      loot: null
    },
    'Tavern': {
      description: 'The tavern smells of ale and secrets. Adventurers whisper in the corners.',
      exits: { east: 'Town Square' },
      loot: null
    },
    'Graveyard': {
      description: 'Cracked tombstones and swirling mist. You feel watched.',
      exits: { north: 'Town Square', south: 'Crypts' },
      loot: null
    },
    'Crypts': {
      description: 'A cold stone stairwell descends into the ancient crypts.',
      exits: { north: 'Graveyard', down: null },
      loot: null
    }
  };

  let roomCount = 1;

  function generateRoom(type) {
    const id = `${type.charAt(0).toUpperCase() + type.slice(1)} Room #${roomCount++}`;
    const descriptions = {
      forest: [
        'A mossy glade with eerie silence.',
        'Twisted trees loom overhead.',
        'You hear rustling in the underbrush.'
      ],
      dungeon: [
        'A damp stone chamber with claw marks.',
        'Bones litter the floor.',
        'A torch flickers on the wall.'
      ]
    };

    const monsters = {
      forest: { name: 'Wraith Wolf', hp: 30, loot: 'Wolf Fang', gold: 10 },
      dungeon: { name: 'Skeleton Knight', hp: 50, loot: 'Rusty Sword', gold: 20 }
    };

    const desc = descriptions[type][Math.floor(Math.random() * descriptions[type].length)];
    const monster = Math.random() < 0.5 ? { ...monsters[type] } : null;
    const loot = Math.random() < 0.4 ? lootTable[Math.floor(Math.random() * lootTable.length)] : null;

    const shuffled = directions.sort(() => 0.5 - Math.random());
    const allowedDirs = shuffled.slice(0, Math.floor(Math.random() * 3) + 1);
    const exits = {};
    for (const dir of allowedDirs) {
      exits[dir] = null;
    }

    world[id] = {
      description: desc,
      exits: exits,
      monster: monster,
      loot: loot
    };

    return id;
  }

  function getOppositeDirection(dir) {
    const opposites = {
      north: 'south',
      south: 'north',
      east: 'west',
      west: 'east',
      up: 'down',
      down: 'up'
    };
    return opposites[dir];
  }

  function describeLocation() {
    const loc = world[player.location];
    log(`\n== ${player.location} ==`);
    log(loc.description);
    const exits = Object.entries(loc.exits)
      .map(([dir, dest]) => `${dir.toUpperCase()} → ${dest || '???'}`)
      .join(', ');
    log(`Exits: ${exits || 'None'}`);
    if (loc.shop) log('Type "buy potion" to purchase a healing potion for 20 gold.');
    if (loc.monster) log(`A ${loc.monster.name} lurks here. Type "fight" to engage.`);
    if (loc.loot) log(`You see a ${loc.loot} here. Type "get ${loc.loot.toLowerCase()}" to pick it up.`);
    logAction(`Entered ${player.location}`, 'move');
  }

	function fightMonster(monster) {
		log(`You fight the ${monster.name}!`);
		logAction(`Combat started with ${monster.name}`, 'combat');

		const weapon = player.equipped.weapon;
		const armor = player.equipped.armor;
		const weaponBonus = weapon && itemData[weapon]?.attack ? itemData[weapon].attack : 0;
		const armorBonus = armor && itemData[armor]?.defense ? itemData[armor].defense : 0;

		while (monster.hp > 0 && player.hp > 0) {
			const basePlayerHit = Math.floor(Math.random() * 20) + 5;
			const baseMonsterHit = Math.floor(Math.random() * 15) + 3;

			const playerHit = basePlayerHit + weaponBonus;
			const monsterHit = Math.max(0, baseMonsterHit - armorBonus);

			monster.hp -= playerHit;
			player.hp -= monsterHit;

			const roundSummary = `You hit for ${playerHit} (base ${basePlayerHit} + weapon ${weaponBonus}), ` +
													 `${monster.name} hits for ${monsterHit} (base ${baseMonsterHit} - armor ${armorBonus})`;

			log(roundSummary);
			logAction(roundSummary, 'combat');
		}

		if (player.hp <= 0) {
			log('You have died. Game over.');
			logAction('You died in combat.', 'combat');
			inputEl.disabled = true;
		} else {
			log(`You defeated the ${monster.name}!`);
			logAction(`Victory over ${monster.name}`, 'combat');
			player.inventory.push(monster.loot);
			player.gold += monster.gold;
			delete world[player.location].monster;
		}
	}

  function gameLogic(cmd) {
    const loc = world[player.location];

    if (cmd === 'help') {
      log(`Available commands:
           - north, south, east, west, up, down → move
           - look → examine the room
           - get [item] → pick up loot
           - drop [item] → leave loot
           - fight → engage a monster
           - inventory → view items, gold, and HP
           - buy potion → purchase healing potion (in shop)
           - use potion → heal yourself
           - help → show this list`);
      logAction('Viewed help menu', 'info');
      return;

    } else if (directions.includes(cmd)) {
      if (!(cmd in loc.exits)) {
        log("You can't go that way.");
        logAction(`Blocked path: ${cmd}`, 'move');
        return;
      }

      if (!loc.exits[cmd]) {
        let type = 'forest';
        if (player.location.includes('Crypts') || cmd === 'down') type = 'dungeon';
        if (player.location.includes('Town Gates') || cmd === 'north') type = 'forest';
        const newRoom = generateRoom(type);
        loc.exits[cmd] = newRoom;
        world[newRoom].exits[getOppositeDirection(cmd)] = player.location;
      }

      player.location = loc.exits[cmd];
      logAction(`Moved ${cmd} to ${player.location}`, 'move');
      describeLocation();

    } else if (cmd === 'look') {
      describeLocation();

    } else if (cmd.startsWith('get ')) {
      const item = cmd.slice(4).trim();
      if (loc.loot && loc.loot.toLowerCase() === item) {
        player.inventory.push(loc.loot);
        log(`You picked up the ${loc.loot}.`);
        logAction(`Picked up ${loc.loot}`, 'item');
        loc.loot = null;
      } else {
        log(`There's no ${item} here.`);
        logAction(`Tried to get ${item} but failed`, 'item');
      }

    } else if (cmd.startsWith('drop ')) {
	  const item = cmd.slice(5).trim();
      const index = player.inventory.findIndex(i => i.toLowerCase() === item);
      if (index >= 0) {
        if (!loc.loot) {
          loc.loot = player.inventory[index];
          player.inventory.splice(index, 1);
          log(`You dropped the ${loc.loot}.`);
          logAction(`Dropped ${loc.loot}`, 'item');
        } else {
          log(`There's already something here. You can't drop the ${item}.`);
          logAction(`Drop failed: ${item}`, 'item');
        }
      } else {
        log(`You don't have a ${item}.`);
        logAction(`Tried to drop ${item} but failed`, 'item');
      }

	} else if (cmd === 'inventory') {
		log(`Inventory: ${player.inventory.join(', ') || 'Empty'}`);
		log(`Gold: ${player.gold}`);
		log(`HP: ${player.hp}/${player.maxHp}`);
		log(`Equipped Weapon: ${player.equipped.weapon || 'None'}`);
		log(`Equipped Armor: ${player.equipped.armor || 'None'}`);
		logAction('Checked inventory', 'info');

	} else if (cmd === 'fight') {
		const loc = world[player.location];
		const monster = loc.monster;

		if (!monster) {
			log("There's nothing to fight here.");
			logAction("Tried to fight but no monster", "combat");
			return;
		}

		if (!player.inCombat) {
			player.inCombat = true;
			player.currentMonster = monster;
			log(`You engage the ${monster.name} in combat!`);
			logAction(`Engaged ${monster.name} in combat`, "combat");
		}

		const weapon = player.equipped.weapon;
		const armor = player.equipped.armor;
		const weaponBonus = weapon && itemData[weapon]?.attack ? itemData[weapon].attack : 0;
		const armorBonus = armor && itemData[armor]?.defense ? itemData[armor].defense : 0;

		const basePlayerHit = Math.floor(Math.random() * 20) + 5;
		const baseMonsterHit = Math.floor(Math.random() * 15) + 3;

		const playerHit = basePlayerHit + weaponBonus;
		const monsterHit = Math.max(0, baseMonsterHit - armorBonus);

		monster.hp -= playerHit;
		player.hp -= monsterHit;

		const roundText = `You hit the ${monster.name} for ${playerHit} (base ${basePlayerHit} + weapon ${weaponBonus}).\n` +
											`${monster.name} hits you for ${monsterHit} (base ${baseMonsterHit} - armor ${armorBonus}).`;

		log(roundText);
		logAction(roundText.replace(/\n/g, ' '), "combat");

		if (player.hp <= 0) {
			log("You have died. Game over.");
			logAction("Player died in combat", "combat");
			inputEl.disabled = true;
			player.inCombat = false;
			player.currentMonster = null;
		} else if (monster.hp <= 0) {
			log(`You defeated the ${monster.name}!`);
			logAction(`Defeated ${monster.name}`, "combat");
			player.inventory.push(monster.loot);
			player.gold += monster.gold;
			delete loc.monster;
			player.inCombat = false;
			player.currentMonster = null;
		} else {
			const hpStatus = `The ${monster.name} has ${monster.hp} HP left. You have ${player.hp}/${player.maxHp} HP.`;
			log(hpStatus);
			logAction(hpStatus, "combat");
		}

	} else if (cmd === 'buy potion' && loc.shop) {
		if (player.gold >= 20) {
			player.gold -= 20;
			player.inventory.push('Healing Potion');
			log('You bought a Healing Potion.');
			logAction('Bought Healing Potion', 'item');
		} else {
			log('Not enough gold.');
			logAction('Tried to buy potion but lacked gold', 'item');
		}

	} else if (cmd === 'use potion') {
		const index = player.inventory.indexOf('Healing Potion');
		if (index >= 0) {
			player.inventory.splice(index, 1);
			player.hp = Math.min(player.maxHp, player.hp + 30);
			log('You feel rejuvenated.');
			logAction('Used Healing Potion', 'heal');
		} else {
			log('No potion to use.');
			logAction('Tried to use potion but had none', 'heal');
		}

	} else if (cmd.startsWith('inspect ')) {
	  const item = cmd.slice(8).trim();
	  const match = player.inventory.find(i => i.toLowerCase() === item);
	  if (match && itemData[match]) {
		log(`${match}: ${itemData[match].description}`);
		logAction(`Inspected ${match}`, 'info');
	  } else {
		log(`You don't have a ${item}.`);
		logAction(`Tried to inspect ${item} but failed`, 'info');
	  }

	} else if (cmd.startsWith('equip ')) {
	  const item = cmd.slice(6).trim();
	  const match = player.inventory.find(i => i.toLowerCase() === item);
	  if (match && itemData[match]) {
		const type = itemData[match].type;
		if (type === "weapon" || type === "armor") {
		  if (player.equipped[type]) {
			log(`You unequip your ${player.equipped[type]}.`);
			player.inventory.push(player.equipped[type]);
		  }
		  player.equipped[type] = match;
		  player.inventory = player.inventory.filter(i => i !== match);
		  log(`You equipped the ${match}.`);
		  logAction(`Equipped ${match}`, 'item');
		} else {
		  log(`You can't equip a ${match}.`);
		  logAction(`Tried to equip ${match} but failed`, 'item');
		}
	  } else {
		log(`You don't have a ${item}.`);
		logAction(`Tried to equip ${item} but failed`, 'item');
	  }

	} else if (cmd.startsWith('unequip ')) {
	  const slot = cmd.slice(8).trim();
	  if (["weapon", "armor"].includes(slot)) {
		if (player.equipped[slot]) {
		  player.inventory.push(player.equipped[slot]);
		  log(`You unequipped the ${player.equipped[slot]}.`);
		  logAction(`Unequipped ${player.equipped[slot]}`, 'item');
		  player.equipped[slot] = null;
		} else {
		  log(`You have nothing equipped in ${slot}.`);
		  logAction(`Tried to unequip ${slot} but failed`, 'item');
		}
	  } else {
		log(`Invalid slot. Use 'weapon' or 'armor'.`);
		logAction(`Invalid unequip slot: ${slot}`, 'item');
	  }

    } else {
      log('Unknown command.');
      logAction(`Unknown command: ${cmd}`, 'info');
    }
  }

  let step = 0;

  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      const cmd = inputEl.value.trim().toLowerCase();
      inputEl.value = '';
      log(`> ${cmd}`);
      processCommand(cmd);
    }
  });

  function processCommand(cmd) {
    if (step === 0) {
      player.name = cmd;
      step++;
      log(`Hello, ${player.name}. Choose your race: Human, Elf, Orc`);
    } else if (step === 1) {
      if (!['human', 'elf', 'orc'].includes(cmd)) return log('Invalid race. Choose: Human, Elf, Orc');
      player.race = cmd;
      step++;
      log(`Race set to ${cmd}. Choose your class: Warrior, Mage, Rogue`);
    } else if (step === 2) {
      if (!['warrior', 'mage', 'rogue'].includes(cmd)) return log('Invalid class. Choose: Warrior, Mage, Rogue');
      player.class = cmd;
      step++;
      log(`Class set to ${cmd}. You begin in the Town Square.`);
      describeLocation();
    } else {
      gameLogic(cmd);
    }
  }

  log('KBOX Labs welcomes you to the Shadows of Kalendale RPG!');
  log('Enter your name:');
};
