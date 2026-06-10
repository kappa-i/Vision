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
  
  // Remove brutalist classes
  let updated = content
    // Replace thick ink borders + hard shadows
    .replace(/border-4 border-ink shadow-\[.*?\]/g, 'shadow-xl shadow-black/5 rounded-xl border border-line/30')
    .replace(/border-2 border-ink shadow-\[.*?\]/g, 'shadow-md shadow-black/5 rounded-xl border border-line/30')
    .replace(/border border-ink shadow-\[.*?\]/g, 'shadow-sm shadow-black/5 rounded-lg border border-line/30')
    
    // Replace old gray borders
    .replace(/border-4 border-line/g, 'shadow-xl shadow-black/5 rounded-xl border border-line/30')
    .replace(/border-2 border-line/g, 'shadow-md shadow-black/5 rounded-xl border border-line/30')
    .replace(/border border-line/g, 'shadow-sm shadow-black/5 rounded-lg border border-line/30')
    
    // Smooth out square edges
    .replace(/rounded-none/g, 'rounded-xl')
    
    // Replace dashed thick borders with smooth dashed
    .replace(/border-4 border-dashed border-line/g, 'border-2 border-dashed border-line/30 rounded-2xl bg-surface/50 backdrop-blur-sm')
    
    // Change brutalist fonts if explicit
    .replace(/font-black uppercase tracking-widest/g, 'font-semibold tracking-wide')
    .replace(/font-black uppercase tracking-tighter/g, 'font-bold tracking-tight')
    
    // Buttons
    .replace(/bg-ink text-canvas/g, 'bg-ink text-canvas shadow-lg shadow-ink/20')
    .replace(/border-4 border-ink shadow-\[.*?\] px-4 py-2 text-\[10px\] font-black uppercase tracking-widest text-ink transition hover:bg-ink hover:text-canvas/g, 
             'bg-surface px-5 py-2.5 text-sm font-semibold text-ink shadow-md shadow-black/5 rounded-xl transition hover:shadow-lg hover:-translate-y-0.5 border border-line/30')
             
    // Floating pin loading
    .replace(/border-4 border-ink shadow-\[.*?\]/g, 'shadow-2xl shadow-black/20 rounded-2xl');
    
  if (content !== updated) {
    fs.writeFileSync(f, updated);
  }
});
console.log('Premium aesthetic applied!');
