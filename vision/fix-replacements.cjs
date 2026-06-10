const fs = require('fs');
const path = require('path');

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.resolve(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(file));
    } else if (file.endsWith('.vue')) {
      results.push(file);
    }
  });
  return results;
}

const vueFiles = getFiles(path.resolve(__dirname, 'src'));

vueFiles.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  let updated = content;
  
  // Fix duplicate shadow-sm
  updated = updated.replace(/shadow-sm shadow-black\/5 rounded-lg shadow-sm shadow-black\/5 rounded-lg border border-line\/30\/30/g, 'shadow-sm shadow-black/5 rounded-lg border border-line/30');
  
  // Actually, wait, let me just do a general regex for "shadow-sm shadow-black/5 rounded-lg shadow-sm shadow-black/5 rounded-lg border border-line/30/30"
  updated = updated.replace(/shadow-sm shadow-black\/5 rounded-lg shadow-sm shadow-black\/5 rounded-lg border border-line\/30\/30/g, 'shadow-sm shadow-black/5 rounded-lg border border-line/30');
  
  // Remove ANY residual thick borders that might be annoying
  updated = updated.replace(/border-4 border-line/g, 'border border-line/30 rounded-xl shadow-sm');
  updated = updated.replace(/border-4 border-ink/g, 'border border-line/30 rounded-xl shadow-sm');
  
  // Buttons with solid pixel shadows
  updated = updated.replace(/shadow-\[.*?\]/g, 'shadow-md shadow-black/5');
  
  if (content !== updated) {
    fs.writeFileSync(f, updated);
  }
});
console.log('Fixed botched replacements');
