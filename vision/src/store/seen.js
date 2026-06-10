import { reactive } from "vue";
import { session } from "./session";

/**
 * Suivi local du « déjà vu » pour signaler les nouveautés (non-lus).
 * Sans backend : on mémorise dans localStorage, par rôle, la date à laquelle
 * chaque projet/section a été consulté. Un élément plus récent = non lu.
 *
 * À terme (cloud), ça deviendra un vrai statut de lecture synchronisé.
 */
const KEY = "vision.seen";

function loadAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

const state = reactive({ data: loadAll() }); // { [role]: { [projectId]: { [section]: ts } } }

function persist() {
  localStorage.setItem(KEY, JSON.stringify(state.data));
}

function roleBucket() {
  const r = session.role;
  if (!state.data[r]) state.data[r] = {};
  return state.data[r];
}

export function lastSeen(projectId, section = "*") {
  return roleBucket()[projectId]?.[section] || "";
}

export function markSeen(projectId, section = "*") {
  const bucket = roleBucket();
  if (!bucket[projectId]) bucket[projectId] = {};
  bucket[projectId][section] = new Date().toISOString();
  persist();
}

/** Vrai si `ts` (date d'un élément) est postérieur à la dernière visite. */
export function isNewer(ts, projectId, section = "*") {
  if (!ts) return false;
  const last = lastSeen(projectId, section);
  if (!last) return true;
  
  // Normalize both strings to "YYYY-MM-DD HH:MM:SS" for safe string comparison
  const norm = (s) => s.replace("T", " ").substring(0, 19);
  return norm(ts) > norm(last);
}
