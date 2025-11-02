export const town = {
  
  'Town Square': {
    description: 'You are in a small town square. Flickering lanterns in the thick fog throw hints of what lies in the shadows.',
    exits: { north: 'Town Gates', east: 'Shop', west: 'Tavern', south: 'Church of Kalendale' },
    loot: {},
    safezone: true
  },
  
  'Town Gates': {
    description: 'Tall iron gates mark the edge of town. Beyond lies the dark and untamed forest of Harrowynn.',
    exits: { south: 'Town Square', north: null },
    loot: {},
    safezone: true
  },
  
  'Shop': {
    description: 'You are in a shop called Kalendale Curiosities. Potions, gear, and other trinkets line the shelves in no particular order.',
    exits: { west: 'Town Square' },
    shop: true,
    loot: {},
    safezone: true
  },

  'Tavern': {
    description: " You are in The Briar's End. A tavern that smells of ale and secrets. Adventurers whisper in the corners.",
    exits: { east: 'Town Square' },
    loot: {},
    safezone: true
  },

  'Church of Kalendale': {
    description: "Tall candles flicker beneath stone arches. A robed cleric tends to the weary and the lost.",
    exits: { north: 'Town Square', east: 'Graveyard' },
    healer: true,
    loot: {},
    safezone: true
  },

  'Graveyard': {
    description: "You are in The Willow's Keep. The branches of a giant tree reach towards cracked tombstones, as if to pluck them from the ground. You feel watched.",
    exits: { west: 'Church of Kalendale', east: 'Crypts' },
    loot: { "Pumpkin": 2 },
    safezone: true
  },

  'Crypts': {
    description: "Steps of cold crumbling stone descend into the ancient crypts of The Stillbone.",
    exits: { west: 'Graveyard', down: null },
    loot: {},
    safezone: false
  },

  'Dummy Room': {
    description: "You have somehow slipped through a dimensional crack and found yourself in the liminal spaces of The Backrooms...",
    exits: { up: 'Town Square' },
    loot: { "Almond Water": 2, "Ancient Coin": 1 },
    safezone: true
  }
  
};
