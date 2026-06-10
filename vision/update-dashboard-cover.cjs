const fs = require('fs');

const path = 'src/pages/DashboardPage.vue';
let content = fs.readFileSync(path, 'utf8');

// The replacement chunk starts at <li v-for="(p, index) in shownProjects" and ends before </ul>

const targetStart = `<li\n        v-for="(p, index) in shownProjects"`;
const targetEnd = `</li>\n    </ul>`;

const startIndex = content.indexOf(targetStart);
const endIndex = content.indexOf(`    </ul>`, startIndex);

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find replacement block in DashboardPage.vue");
  process.exit(1);
}

const replacement = `<li
        v-for="(p, index) in shownProjects"
        :key="p.id"
        class="group relative flex h-72 cursor-pointer flex-col justify-between shadow-sm border border-line/30 bg-surface transition hover:border-ink overflow-hidden"
        @click="open(p)"
      >
        <!-- Background -->
        <div v-if="p.cover_path" class="absolute inset-0 z-0">
          <img :src="p.cover_path" class="w-full h-full object-cover transition duration-700 group-hover:scale-105" />
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10"></div>
        </div>
        <div v-else class="absolute inset-0 z-0 bg-surface group-hover:bg-ink/5 transition"></div>

        <!-- Top: Status & Delete -->
        <div class="relative z-10 flex items-start justify-between p-6">
          <span
            class="border px-2 py-1 text-[10px] font-semibold tracking-wide backdrop-blur-sm"
            :class="[p.cover_path ? 'border-white/20 bg-black/40 text-white' : badgeClass[p.status]]"
          >
            {{ STATUS_LABEL[p.status] }}
          </span>
          <button
            v-if="can.createProject.value"
            type="button"
            title="Supprimer le projet"
            class="hidden transition group-hover:block"
            :class="p.cover_path ? 'text-white/70 hover:text-rose-400' : 'text-muted hover:text-rose-500'"
            @click.stop="handleDelete(p)"
          >
            <Trash2 class="h-5 w-5" />
          </button>
        </div>

        <!-- Center Index (only if no cover) -->
        <div
          v-if="!p.cover_path"
          class="relative z-10 flex flex-1 items-center justify-center font-bold text-ink/5 select-none"
          style="font-size: 8rem; line-height: 1"
        >
          {{ String(projects.items.length - index).padStart(2, "0") }}
        </div>
        <div v-else class="flex-1"></div>

        <!-- Bottom: Title -->
        <div class="relative z-10 p-6">
          <h3 class="text-3xl font-bold tracking-tight line-clamp-2" :class="p.cover_path ? 'text-white' : 'text-ink'">
            {{ p.name }}
          </h3>
          <div class="mt-4 h-px w-6" :class="p.cover_path ? 'bg-white/50' : 'bg-muted'"></div>
        </div>
      </li>\n`;

content = content.substring(0, startIndex) + replacement + content.substring(endIndex);

fs.writeFileSync(path, content);
console.log("Updated DashboardPage.vue");
