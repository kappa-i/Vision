const fs = require('fs');

const path = 'src/pages/project/DeliveryTab.vue';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /<div\s+v-if="released"\s+class="mb-8 flex items-center gap-4 border-4 border-indigo-900\/50 bg-indigo-950\/40 p-6 text-lg font-bold tracking-tight text-indigo-400"\s*>/g,
  `<div\n        v-if="released"\n        class="mb-8 flex items-center gap-3 bg-indigo-500/10 p-4 text-sm font-medium text-indigo-500 border border-indigo-500/20"\n      >`
);

content = content.replace(
  /<CheckCircle class="h-6 w-6 shrink-0" \/>/g,
  `<CheckCircle class="h-5 w-5 shrink-0" />`
);

content = content.replace(
  /<div\s+v-else-if="can\.uploadMedia\.value"\s+class="mb-8 shadow-xl shadow-black\/5 rounded-none-none shadow-sm shadow-black\/5 rounded-none-none border border-line\/30\/30 bg-surface p-6"\s*>/g,
  `<div\n        v-else-if="can.uploadMedia.value"\n        class="mb-8 bg-surface p-6 border border-line/30 shadow-sm shadow-black/5"\n      >`
);

content = content.replace(
  /<p class="text-lg font-black tracking-tighter uppercase text-ink">/g,
  `<p class="font-medium text-ink">`
);

content = content.replace(
  /class="mt-6 w-full bg-accent px-6 py-4 text-lg font-semibold tracking-wide text-canvas transition hover:opacity-90 disabled:opacity-50"/g,
  `class="mt-4 w-full bg-accent px-4 py-2.5 text-sm font-semibold text-canvas transition hover:opacity-90 disabled:opacity-50"`
);

content = content.replace(
  /<div\s+v-else\s+class="mb-8 flex items-center gap-4 border-4 border-amber-900\/50 bg-amber-950\/40 p-6 text-lg font-bold tracking-tight text-amber-400"\s*>/g,
  `<div\n        v-else\n        class="mb-8 flex items-center gap-3 bg-amber-500/10 p-4 text-sm font-medium text-amber-500 border border-amber-500/20"\n      >`
);

content = content.replace(
  /class="flex items-center gap-2 shadow-xl shadow-black\/5 rounded-none-none shadow-sm shadow-black\/5 rounded-none-none border border-line\/30\/30 bg-surface px-6 py-4 text-\[10px\] font-semibold tracking-wide text-ink transition hover:bg-ink hover:text-canvas disabled:opacity-50"/g,
  `class="flex items-center gap-2 border border-line/30 bg-surface px-4 py-2 text-sm font-medium transition hover:bg-ink hover:text-canvas disabled:opacity-50 shadow-sm"`
);

content = content.replace(
  /class="flex items-center gap-6 shadow-xl shadow-black\/5 rounded-none-none shadow-sm shadow-black\/5 rounded-none-none border border-line\/30\/30 bg-surface p-4"/g,
  `class="flex items-center gap-4 border border-line/30 bg-surface p-3 shadow-sm"`
);

content = content.replace(
  /<p class="truncate text-lg font-bold tracking-tight text-ink">/g,
  `<p class="truncate text-base font-semibold text-ink">`
);

content = content.replace(
  /<p class="mt-1 truncate text-\[10px\] font-bold uppercase tracking-widest text-muted">/g,
  `<p class="mt-1 truncate text-xs text-muted">`
);

content = content.replace(
  /class="flex shrink-0 items-center gap-2 text-\[10px\] font-semibold tracking-wide text-emerald-500"/g,
  `class="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-emerald-500"`
);

content = content.replace(
  /class="shrink-0 shadow-xl shadow-black\/5 rounded-none-none shadow-sm shadow-black\/5 rounded-none-none border border-line\/30\/30 bg-surface px-6 py-4 text-\[10px\] font-semibold tracking-wide text-ink transition hover:bg-ink hover:text-canvas disabled:opacity-50"/g,
  `class="shrink-0 border border-line/30 bg-surface px-4 py-2 text-sm font-medium transition hover:bg-ink hover:text-canvas disabled:opacity-50 shadow-sm"`
);

content = content.replace(
  /class="flex shrink-0 items-center gap-2 shadow-xl shadow-black\/5 rounded-none-none shadow-sm shadow-black\/5 rounded-none-none border border-line\/30\/30 bg-surface\/50 px-6 py-4 text-\[10px\] font-semibold tracking-wide text-muted"/g,
  `class="flex shrink-0 items-center gap-2 border border-line/30 bg-surface/50 px-4 py-2 text-sm font-medium text-muted shadow-sm"`
);

fs.writeFileSync(path, content);
console.log("Cleaned DeliveryTab");
