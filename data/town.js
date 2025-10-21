export const town = {
  'Town Square': {
    description: 'You are in a small town square. Flickering lanterns in the thick fog throw hints of what lies in the shadows.',
    exits: { north: 'Town Gates', east: 'Shop', west: 'Tavern', south: 'Graveyard' },
    loot: {}
  },
  'Town Gates': {
    description: 'Tall iron gates mark the edge of town. Beyond lies the dark and untamed forest of Harrowynn.',
    exits: { south: 'Town Square', north: null },
    loot: {}
  },
  'Shop': {
    description: 'You are in The Shoppe of Topsy Turvy. Abby the shop keeper smiles warmly. Potions and gear line the shelves in no particular order',
    exits: { west: 'Town Square' },
    shop: true,
    loot: {}
  },
  'Tavern': {
    description: " You are in The Briar's End. A tavern and inn that smells of ale and secrets. Adventurers whisper in the corners.",
    exits: { east: 'Town Square' },
    loot: {}
  },
  'Graveyard': {
    description: "You are in The Willow's Keep. The branches of a giant tree reach towards cracked tombstones, as if to pluck them from the ground. You feel watched.",
    exits: { north: 'Town Square', south: 'Crypts' },
    loot: {}
  },
  'Crypts': {
    description: "Steps of cold crumbling stone descend into the ancient crypts of The Stillbone.",
    exits: { north: 'Graveyard', down: null },
    loot: {}
  }
};
