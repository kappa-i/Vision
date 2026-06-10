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
    } else if (file.endsWith('.vue') || file.endsWith('.css')) {
      results.push(file);
    }
  });
  return results;
}

const files = getFiles(path.resolve(__dirname, 'src'));

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  let updated = content;
  
  // Replace rounded classes with rounded-none
  updated = updated.replace(/\brounded-xl\b/g, 'rounded-none');
  updated = updated.replace(/\brounded-lg\b/g, 'rounded-none');
  updated = updated.replace(/\brounded-2xl\b/g, 'rounded-none');
  updated = updated.replace(/\brounded-md\b/g, 'rounded-none');
  updated = updated.replace(/\brounded\b/g, 'rounded-none');
  
  // Fix specifically the main.css where I manually set border-radius: 16px
  if (f.endsWith('main.css')) {
    updated = updated.replace(/border-radius: 16px;/g, 'border-radius: 0;');
    updated = updated.replace(/border-radius: 8px;/g, 'border-radius: 0;');
  }
  
  if (content !== updated) {
    fs.writeFileSync(f, updated);
  }
});
console.log('Removed rounded corners!');
