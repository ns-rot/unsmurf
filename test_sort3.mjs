import { createNaturalCompare } from './src/settingsUtils.js';

const items = [
  '087', '089', '090', '091', '092', '093', '094',
  '9-5', '095', '096', '-9-9-', '099',
  '-C-C-', 'D I', 'D L', 'D X',
  'I C', 'I D', 'I L', 'I V', 'I X',
  'L 9', '-L-L-', 'L V',
  'V C', 'V L', 'V M',
  '105', '113', '117', '121'
];

const cmp = createNaturalCompare(items);
items.slice().sort(cmp).forEach(d => console.log(d));
