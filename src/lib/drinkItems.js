// Built-in starting catalog. User-added items (see data.ts getDrinkItemGroups)
// are merged into these groups by label.
export const BASE_DRINK_ITEM_GROUPS = [
  {
    label: "Liquor",
    items: [
      { name: "Cook's Champagne", price: 10.09 },
      { name: "1.5L Vodka", price: 14.79 },
      { name: "1.75L Tequila Blanco", price: 27.49 },
    ],
  },
  {
    label: "Beer & Seltzer",
    items: [
      { name: "36 Coors", price: 29.0 },
      { name: "24 Seltzers", price: 23.59 },
    ],
  },
  {
    label: "Mixers",
    items: [
      { name: "2 Jugs Cranberry Juice", price: 9.86 },
      { name: "2 1-Gal Jugs Orange Juice", price: 18.38 },
    ],
  },
  {
    label: "Cups",
    items: [{ name: "240 Red Solo Cups", price: 13.04 }],
  },
];

export const GROUP_LABELS = BASE_DRINK_ITEM_GROUPS.map((group) => group.label);
