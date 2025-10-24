export const itemData = {


// ARMOR
  "Robe": {
    type: "armor",
    defense: 1,
    description: "Soft and comfortable. Offers protection from the elements but not much else.",
    value: 10
  },

  "Padded Armor": {
    type: "armor",
    defense: 2,
    description: "Light armor offering minimal protection.",
    value: 30
  },

  "Leather Armor": {
    type: "armor",
    defense: 3,
    description: "Light armor offering basic protection.",
    value: 50
  },

  "Chainmail": {
    type: "armor",
    defense: 5,
    description: "A suit of interlocked rings providing good defense.",
    value: 640
  },

  "Scalemail": {
    type: "armor",
    defense: 8,
    description: "A suit of steel scales bound by leather providing solid defense.",
    value: 935
  },

  "Plate Armor": {
    type: "armor",
    defense: 12,
    description: "Heavy armor that offers maximum protection.",
    value: 1360
  },


// WEAPONS
  "Rusty Dagger": {
    type: "weapon",
    attack: 1,
    description: "An old dagger, chipped and worn. Better than nothing.",
    value: 1
  },

  "Rusty Sword": {
    type: "weapon",
    attack: 2,
    description: "An old sword with a dull edge. Better than nothing.",
    value: 2
  },

  "Iron Sword": {
    type: "weapon",
    attack: 4,
    description: "A sturdy iron sword, reliable for most adventurers.",
    value: 260
  },

  "Steel Sword": {
    type: "weapon",
    attack: 8,
    description: "Well-forged steel blade. Sharp and balanced.",
    value: 340
  },
  
  
// MISC Vendor Trash
  "Wolf Fang": {
    type: "misc",
    description: "A sharp fang from a wraith wolf.",
    value: 6
  },

  "Canine Fang": {
    type: "misc",
    description: "A sharp fang from a coyote or wild dog.",
    value: 4
  },

  "Ancient Coin": {
    type: "misc",
    description: "A coin from a forgotten empire.",
    value: 10
  },

  "Gold Nugget": {
    type: "misc",
    description: "A shiny chunk of gold.",
    value: 20
  },

  "Gemstone": {
    type: "misc",
    description: "A glittering gem. Valuable to merchants, useless in combat.",
    value: 30
  },

  "Torch": {
    type: "utility",
    description: "A simple wooden torch to light your way in the dark.",
    value: 2
  },


// CONSUMABLES
  "Healing Potion": {
    type: "consumable",
    description: "Restores 30 HP when used.",
    heal: 30,
    consumeText: "You drink the potion, feeling renewed energy coursing through you.",
    value: 5
  },

  "Pumpkin": {
    type: "consumable",
    description: "A fresh tasty gourd. Restores 5 HP when used.",
    heal: 10,
    consumeText: "You take a bite of the pumpkin — sweet, earthy, and oddly comforting.",
    value: 4
  },

  "Almond Water": {
    type: "consumable",
    description: "A Backrooms beverage of choice. Restores 5 HP when used.",
    heal: 10,
    consumeText: "The beverage has a sweet rosy vanilla flavour. You feel refreshed.",
    value: 10
  }

};


// SHOP items for sale
export const shopItems = {
  "Steel Sword": { price: 340 },
  "Scalemail": { price: 935 },
  "Plate Armor": { price: 1360 },
  "Healing Potion": { price: 25 },
};
