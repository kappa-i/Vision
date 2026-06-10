const fs = require('fs');
const files = [
  'src/store/media.js',
  'src/store/stages.js',
  'src/store/invites.js',
  'src/store/comments.js',
  'src/store/validations.js'
];

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  content = content.replace(/if \(auth\.user\)/g, 'if (auth.user || !db.isTauri())');
  fs.writeFileSync(f, content);
});
console.log('Done!');
