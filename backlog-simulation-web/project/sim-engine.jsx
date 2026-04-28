// ============================================================
// Simulation engine — pure logic, no React
// ============================================================

const ROLES = ['FE', 'BE', 'DSGN', 'QA', 'OPS', 'DATA'];

const ROLE_META = {
  FE:   { label: 'Frontend', color: 'oklch(70% 0.14 250)' },
  BE:   { label: 'Backend',  color: 'oklch(66% 0.14 285)' },
  DSGN: { label: 'Design',   color: 'oklch(72% 0.13 25)'  },
  QA:   { label: 'QA',       color: 'oklch(68% 0.13 145)' },
  OPS:  { label: 'DevOps',   color: 'oklch(68% 0.13 75)'  },
  DATA: { label: 'Data',     color: 'oklch(64% 0.14 320)' },
};

// Color palette for features (hue rotation)
const FEATURE_HUES = [12, 45, 90, 140, 180, 215, 260, 300, 335];

// ---- RNG (seedable) ----
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FEATURE_NAMES = [
  'Login flow', 'Search filters', 'Export CSV', 'Dark mode', 'Onboarding',
  'Notifications', 'API rate limits', 'Audit log', 'Billing portal', 'SSO',
  'Bulk actions', 'Webhooks', 'Mobile nav', 'Empty states', 'Settings page',
  'Activity feed', 'Permissions', 'Inline editing', 'Drag & drop', 'Comments',
  'Reactions', '2FA', 'Profile page', 'Charts', 'Keyboard shortcuts',
  'File upload', 'Sharing', 'Tags', 'Saved views', 'Reports',
];

let nextFeatureId = 1;
let nextTaskId = 1;

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function makeFeature(rng, now, settings) {
  const id = nextFeatureId++;
  const hue = FEATURE_HUES[(id - 1) % FEATURE_HUES.length];
  const name = FEATURE_NAMES[(id - 1) % FEATURE_NAMES.length];

  // Size variability: how many sub-tasks (controls total work)
  // sizeVar 0 = uniform 3, sizeVar 1 = 1..7
  const baseSize = 3;
  const spread = Math.round(settings.sizeVar * 3);
  const minSize = Math.max(1, baseSize - spread);
  const maxSize = baseSize + spread;
  const taskCount = minSize + Math.floor(rng() * (maxSize - minSize + 1));

  // Role variability: how many distinct roles needed
  // roleVar 0 = always 2 roles, roleVar 1 = 1..6 roles
  const baseRoles = 2;
  const roleSpread = Math.round(settings.roleVar * 4);
  const minRoles = Math.max(1, baseRoles - Math.floor(roleSpread / 2));
  const maxRoles = Math.min(ROLES.length, baseRoles + roleSpread);
  const roleCount = minRoles + Math.floor(rng() * (maxRoles - minRoles + 1));

  // Pick distinct roles
  const shuffled = [...ROLES].sort(() => rng() - 0.5);
  const chosenRoles = shuffled.slice(0, roleCount);

  // Build tasks: distribute taskCount across chosenRoles
  // Each role gets at least 1 task
  const tasks = [];
  const counts = new Array(chosenRoles.length).fill(1);
  let remaining = taskCount - chosenRoles.length;
  while (remaining > 0) {
    counts[Math.floor(rng() * chosenRoles.length)]++;
    remaining--;
  }
  // size of each task in "work units" (time to process)
  for (let r = 0; r < chosenRoles.length; r++) {
    for (let i = 0; i < counts[r]; i++) {
      const work = 0.8 + rng() * 1.4; // 0.8..2.2 seconds of work at 1x
      tasks.push({
        id: nextTaskId++,
        role: chosenRoles[r],
        work,
        progress: 0,         // 0..work
        status: 'todo',      // 'todo' | 'doing' | 'done'
        assignee: null,
      });
    }
  }

  return {
    id,
    name: `F-${String(id).padStart(3, '0')} ${name}`,
    hue,
    tasks,
    createdAt: now,
    startedAt: null,
    finishedAt: null,
    status: 'backlog', // 'backlog' | 'in-progress' | 'done'
  };
}

function makeMember(i, role) {
  return {
    id: i,
    name: ['Ada', 'Ben', 'Chen', 'Dani', 'Eli', 'Fae', 'Gus', 'Hari'][i] || `P${i+1}`,
    roles: [role],
    currentTask: null,   // { featureId, taskId } | null
    busyUntil: 0,
  };
}

function defaultTeam() {
  // Start: 1 role per member, default rotation
  const defaults = ['FE', 'BE', 'DSGN', 'QA', 'OPS', 'DATA'];
  return defaults.map((r, i) => makeMember(i, r));
}

// ---- Sim state factory ----
function makeInitialState(rng, settings) {
  const state = {
    backlog: [],
    backlogSnapshot: [],    // deep clone of the initial backlog — restored by resetFromSnapshot
    inProgress: [],
    done: [],
    team: defaultTeam(),
    leadTimes: [],          // array of { id, ms, finishedAt }
    simTime: 0,             // simulated seconds elapsed
    wipIntegral: 0,         // ∫ WIP dt — divide by simTime for avg WIP
    lastGenAt: 0,
    startedAt: null,
  };
  // Pre-seed the backlog so the workshop starts with visible inventory
  if (rng && settings) {
    const seedCount = settings.initialBacklog ?? 20;
    for (let i = 0; i < seedCount; i++) {
      state.backlog.push(makeFeature(rng, 0, settings));
    }
    // Snapshot the freshly-seeded backlog so reset can restore the same items
    state.backlogSnapshot = state.backlog.map(cloneFeatureFresh);
  }
  return state;
}

// Deep-clone a feature, resetting any in-flight task progress so the clone
// represents a "fresh, untouched" version of the item — used for snapshotting
// and for restoring on reset.
function cloneFeatureFresh(f) {
  return {
    ...f,
    status: 'backlog',
    startedAt: null,
    finishedAt: null,
    tasks: f.tasks.map(t => ({
      ...t,
      status: 'todo',
      progress: 0,
      assignee: null,
    })),
  };
}

// Restore the backlog to its original snapshot, clear in-progress/done,
// and reset team task assignments + counters. Keeps the team roster + roles.
function resetFromSnapshot(state) {
  state.backlog = state.backlogSnapshot.map(cloneFeatureFresh);
  state.inProgress = [];
  state.done = [];
  state.leadTimes = [];
  state.simTime = 0;
  state.wipIntegral = 0;
  state.lastGenAt = 0;
  state.startedAt = null;
  for (const m of state.team) {
    m.currentTask = null;
  }
  return state;
}

// ---- Tick ----
function tick(state, dtSim, settings, rng) {
  // dtSim: simulated seconds advanced (already speed-adjusted)
  state.simTime += dtSim;
  state.wipIntegral += state.inProgress.length * dtSim;
  if (state.startedAt === null) state.startedAt = state.simTime;

  // 1. Keep backlog topped up at minBacklog items at all times
  const minBacklog = settings.minBacklog ?? 10;
  while (state.backlog.length < minBacklog) {
    state.backlog.push(makeFeature(rng, state.simTime, settings));
  }

  // 2. Assign idle members to available tasks.
  //    Strategy: for each idle member with roles, find a 'todo' task they can do
  //    in any in-progress feature (oldest first). If none exists, pull a feature
  //    from the backlog whose roles they can contribute to, promote it to
  //    in-progress, and grab a task from it. This removes any artificial WIP
  //    cap — work-in-progress emerges naturally from team capacity.
  for (const m of state.team) {
    if (m.currentTask) continue;
    if (m.roles.length === 0) continue;

    // 2a. Try existing in-progress features first
    let chosen = null;
    for (const f of state.inProgress) {
      const t = f.tasks.find(t => t.status === 'todo' && m.roles.includes(t.role));
      if (t) { chosen = { f, t }; break; }
    }

    // 2b. Otherwise pull from backlog: find the first feature that has
    //     at least one task this member can do.
    if (!chosen) {
      for (let i = 0; i < state.backlog.length; i++) {
        const f = state.backlog[i];
        const t = f.tasks.find(t => t.status === 'todo' && m.roles.includes(t.role));
        if (t) {
          // promote feature to in-progress
          state.backlog.splice(i, 1);
          f.status = 'in-progress';
          f.startedAt = state.simTime;
          state.inProgress.push(f);
          chosen = { f, t };
          break;
        }
      }
    }

    if (chosen) {
      chosen.t.status = 'doing';
      chosen.t.assignee = m.id;
      m.currentTask = { featureId: chosen.f.id, taskId: chosen.t.id };
    }
  }

  // 4. Progress all 'doing' tasks
  for (const f of state.inProgress) {
    for (const t of f.tasks) {
      if (t.status === 'doing') {
        t.progress += dtSim;
        if (t.progress >= t.work) {
          t.progress = t.work;
          t.status = 'done';
          // free member
          const m = state.team.find(m => m.id === t.assignee);
          if (m) m.currentTask = null;
        }
      }
    }
  }

  // 5. Move completed features → done
  for (let i = state.inProgress.length - 1; i >= 0; i--) {
    const f = state.inProgress[i];
    if (f.tasks.every(t => t.status === 'done')) {
      f.status = 'done';
      f.finishedAt = state.simTime;
      const lt = f.finishedAt - f.createdAt;
      state.leadTimes.push({ id: f.id, ms: lt, finishedAt: f.finishedAt });
      // keep last 200
      if (state.leadTimes.length > 200) state.leadTimes.shift();
      state.done.unshift(f);
      if (state.done.length > 40) state.done.length = 40;
      state.inProgress.splice(i, 1);
    }
  }

  return state;
}

// ---- Stats ----
function computeStats(leadTimes) {
  if (leadTimes.length === 0) {
    return { count: 0, avg: 0, min: 0, max: 0, p50: 0, p85: 0, buckets: [] };
  }
  const vals = leadTimes.map(l => l.ms);
  const sorted = [...vals].sort((a, b) => a - b);
  const sum = vals.reduce((a, b) => a + b, 0);
  const avg = sum / vals.length;
  const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  // histogram buckets — fixed 0..maxBucket s
  const maxBucket = Math.max(20, Math.ceil(max / 5) * 5);
  const bucketCount = 12;
  const bucketSize = maxBucket / bucketCount;
  const buckets = new Array(bucketCount).fill(0);
  for (const v of vals) {
    const idx = Math.min(bucketCount - 1, Math.floor(v / bucketSize));
    buckets[idx]++;
  }
  return {
    count: vals.length,
    avg, min, max,
    p50: pct(0.5),
    p85: pct(0.85),
    buckets,
    bucketSize,
    maxBucket,
  };
}

window.SimEngine = {
  ROLES, ROLE_META, mulberry32,
  makeInitialState, resetFromSnapshot, tick, computeStats,
};
