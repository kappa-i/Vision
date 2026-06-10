const fs = require('fs');
 // Not available? I'll just use simple recursive readdir
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
  // Replace border-4 border-line with border-4 border-ink shadow-[4px_4px_0_var(--color-ink)]
  let updated = content.replace(/border-4 border-line/g, 'border-4 border-ink shadow-[4px_4px_0_var(--color-ink)]');
  updated = updated.replace(/border-2 border-line/g, 'border-2 border-ink shadow-[2px_2px_0_var(--color-ink)]');
  updated = updated.replace(/border border-line/g, 'border border-ink shadow-[2px_2px_0_var(--color-ink)]');
  
  if (content !== updated) {
    fs.writeFileSync(f, updated);
  }
});
console.log('Borders updated!');
