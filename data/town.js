export const town = {
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
    description: 'Abby the shop keeper smiles. Potions and gear line the shelves.',
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
