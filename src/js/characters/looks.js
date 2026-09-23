// Appearance definitions. Everyone keeps one consistent outfit for the whole day.
export const LOOKS = {
  player: {
    id: 'player', seed: 11, height: 1.0, build: 1.0,
    skin: '#c68b59', hair: '#231b17', hairStyle: 'messy',
    shirt: '#9ec5e8', sleeve: 'rolled', pants: '#2c3a55', belt: '#3a2d25',
    shoes: '#f2f0eb', sole: '#d8d0c3', sneakers: true, shoeAccent: '#e0a83a',
    acc: ['id', 'backpack', 'eyebags'], bag: '#3b4250', bagAccent: '#e0a83a',
    props: ['cup', 'phone'],
  },
  rahul: {
    id: 'rahul', seed: 23, height: 1.02, build: 1.03,
    skin: '#b37448', hair: '#1a1513', hairStyle: 'side', jaw: '#8c5a3a',
    shirt: '#b5473a', sleeve: 'short', untucked: true, collar: false, pants: '#3e5c86',
    shoes: '#2b2b2e', sole: '#ecebe6', sneakers: true, shoeAccent: '#d4483b',
    acc: ['headphones'], props: ['cup', 'phone'],
  },
  anu: {
    id: 'anu', seed: 31, height: 0.95, build: 0.93,
    skin: '#d19a6a', hair: '#1c1614', hairStyle: 'bun', hairTie: '#e0a83a',
    shirt: '#2f8f83', sleeve: 'long', cuff: '#2a7f74', pants: '#22262e', belt: '#22262e',
    shoes: '#1d1d20', sole: '#2e2e33', acc: ['glasses', 'id'], props: ['mug', 'phone'],
    lip: '#7a3434',
  },
  manager: {
    id: 'manager', seed: 41, height: 0.99, build: 1.12, belly: 1,
    skin: '#a86f45', hair: '#8a837d', hairStyle: 'balding', browColor: '#5d5751', mustache: '#4a4541',
    shirt: '#f4f4f0', sleeve: 'long', cuff: '#e8e8e2', pants: '#5b5f66', belt: '#2a2320',
    shoes: '#5a3a24', sole: '#3a261a', acc: ['tie', 'mustache'], tieColor: '#b7332e', props: ['mug', 'phone'],
  },
  hr: {
    id: 'hr', seed: 53, height: 0.97, build: 0.95,
    skin: '#c98e62', hair: '#15110f', hairStyle: 'long',
    shirt: '#262a36', sleeve: 'long', cuff: '#f3f1ec', inner: '#f3f1ec', pants: '#262a36', belt: '#262a36',
    shoes: '#141416', sole: '#141416', acc: ['blazer', 'id'], props: ['clipboard'], lip: '#6e2f33',
  },
  deepa: {
    id: 'deepa', seed: 61, height: 0.94, build: 0.94,
    skin: '#b5774a', hair: '#1d1715', hairStyle: 'ponytail', hairTie: '#2f6fe4',
    shirt: '#e3b23c', sleeve: 'long', pants: '#3a3f4a', belt: '#3a3f4a',
    shoes: '#443b36', acc: ['id'], props: ['phone'],
  },
  arjun: {
    id: 'arjun', seed: 71, height: 1.0, build: 1.0,
    skin: '#9c6440', hair: '#191412', hairStyle: 'short',
    shirt: '#6e9e6a', sleeve: 'long', pants: '#b59f7b', belt: '#5a4632',
    shoes: '#4a3526', acc: ['glasses', 'id'], props: ['cup', 'phone'],
  },
  neha: {
    id: 'neha', seed: 83, height: 0.93, build: 0.92,
    skin: '#d8a57a', hair: '#2b1f1a', hairStyle: 'long',
    shirt: '#d98ba0', sleeve: 'rolled', pants: '#44618f', belt: '#44618f',
    shoes: '#f2f0eb', sole: '#d8d0c3', sneakers: true, shoeAccent: '#d98ba0', acc: ['id'], props: ['phone', 'cup'],
  },
  dev: {
    id: 'dev', seed: 97, height: 1.03, build: 1.05,
    skin: '#a36b43', hair: '#16110f', hairStyle: 'messy',
    shirt: '#6f7784', sleeve: 'long', untucked: true, collar: false, pants: '#2e3440',
    shoes: '#f2f0eb', sneakers: true, acc: ['headphones'], props: ['phone'],
  },
  kiran: {
    id: 'kiran', seed: 101, height: 0.96, build: 0.95,
    skin: '#c48a5c', hair: '#221a16', hairStyle: 'bun', hairTie: '#8c6bb1',
    shirt: '#8c6bb1', sleeve: 'long', pants: '#1f232b', shoes: '#1d1d20', acc: ['id'], props: ['phone'],
  },
};

export const CAST = {
  player:  { name: 'You', role: 'Employee #4471', color: '#2f6fe4' },
  rahul:   { name: 'Rahul', role: 'The Survivor', color: '#d4483b', pitch: 330 },
  anu:     { name: 'Anu', role: 'The Overachiever', color: '#2b9a8d', pitch: 520 },
  manager: { name: 'Mr. Menon', role: 'Manager', color: '#c77d1a', pitch: 250 },
  hr:      { name: 'Priya', role: 'HR', color: '#5b5f86', pitch: 440 },
  deepa:   { name: 'Deepa', role: 'Reception', color: '#b88a12', pitch: 560 },
  arjun:   { name: 'Arjun', role: 'Finance', color: '#4f8a4b', pitch: 300 },
  neha:    { name: 'Neha', role: 'Design', color: '#c0587a', pitch: 600 },
  dev:     { name: 'Dev', role: 'Backend', color: '#6f7784', pitch: 280 },
  kiran:   { name: 'Kiran', role: 'QA', color: '#8c6bb1', pitch: 480 },
  narrator:{ name: '', role: '', color: '#1d2433' },
};
