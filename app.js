const API_BASE = "https://api.dxgames.eu";
const RETURN_TO = "https://admin.dxgames.eu/";
const PLATFORMS = ["iOS", "Android", "Steam"];
const ANALYTICS_DATE_RANGE_OPTIONS = [
  { value: "", label: "All time" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" }
];
const SQUEAKS_DATE_RANGE_OPTIONS = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" }
];
const SQUEAKS_INTERVAL_OPTIONS = [
  { value: "day", label: "Day" },
  { value: "hour", label: "Hour" }
];
const ANALYTICS_PLAYER_XP_OPTIONS = [
  { value: "", label: "All players" },
  { value: "new", label: "New players" },
  { value: "beginner", label: "Beginners" },
  { value: "intermediate", label: "Intermediate" },
  { value: "expert", label: "Expert" }
];
const ANALYTICS_MAIN_DEADLANDS_OPTIONS = [
  { value: "", label: "All Deadlands mains" },
  { value: "ooze", label: "Ooze" },
  { value: "skelechonk", label: "Skelechonk" },
  { value: "banshee", label: "Banshee" },
  { value: "ghost", label: "Ghost" }
];
const ANALYTICS_MAIN_EDGE_OPTIONS = [
  { value: "", label: "All Edge mains" },
  { value: "rats", label: "Rats" },
  { value: "spiders", label: "Spiders" },
  { value: "necros", label: "Necros" },
  { value: "armored", label: "Armored" }
];
const ANALYTICS_BOSS_OPTIONS = [
  { value: "", label: "All bosses" },
  { value: "vampire", label: "Vampire" },
  { value: "lich", label: "Lich" },
  { value: "gargoyle", label: "Gargoyle" },
  { value: "shadow", label: "Shadow" }
];
const LOCAL_MOCK = ["localhost", "127.0.0.1"].includes(window.location.hostname)
  ? new URLSearchParams(window.location.search).get("mock")
  : null;

const app = document.querySelector("#app");

const state = {
  user: null,
  activeTab: "versions",
  versions: null,
  scheduled: null,
  analytics: null,
  analyticsVersion: [],
  analyticsOutcome: [],
  analyticsPlayerXp: [],
  analyticsDateRange: "",
  analyticsMainDeadlands: [],
  analyticsMainEdge: [],
  analyticsBoss: [],
  analyticsOutcomeOptions: [],
  analyticsLoading: false,
  analyticsError: "",
  squeaks: null,
  squeaksTags: [],
  squeaksTagSelectionInitialized: false,
  squeaksInterval: "day",
  squeaksDateRange: "7d",
  squeaksPlatforms: [],
  squeaksAppVersions: [],
  squeaksPlayerXp: [],
  squeaksLoading: false,
  squeaksError: "",
  versionsLoading: false,
  versionsError: "",
  saveStatus: "idle",
  saveMessage: ""
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatKey(key) {
  return String(key)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC"
  }) + " UTC";
}

function formatDuration(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return `${Number(value).toFixed(2)} s`;
}

function outcomeKeyToDeathAct(key) {
  if (key === "survived") return "-1";
  if (key?.startsWith("death_act_")) return key.slice("death_act_".length);
  return "";
}

function buildOutcomeFilterOptions(outcomes) {
  if (!Array.isArray(outcomes)) return [];

  let deadCount = 0;
  const options = [];
  for (const outcome of outcomes) {
    const value = outcomeKeyToDeathAct(outcome.key);
    if (!value) continue;
    if (value !== "-1") {
      deadCount += Number(outcome.count) || 0;
    }
    options.push({
      value,
      label: outcome.label ?? outcome.key,
      count: Number(outcome.count) || 0
    });
  }

  if (deadCount > 0) {
    const survivedIndex = options.findIndex((option) => option.value === "-1");
    const deadOption = { value: "dead", label: "Died", count: deadCount };
    options.splice(survivedIndex === -1 ? 0 : survivedIndex + 1, 0, deadOption);
  }

  return options;
}

function optionsWithoutAll(options) {
  return options.filter((option) => option.value !== "");
}

function selectedValuesSummary(options, selected, allLabel) {
  if (!selected.length) return allLabel;
  if (selected.length === 1) {
    return options.find((option) => option.value === selected[0])?.label ?? selected[0];
  }
  return `${selected.length} selected`;
}

function renderMultiSelectFilter(label, allLabel, options, selected, field) {
  const choices = optionsWithoutAll(options);
  const selectedSet = new Set(selected);
  const summary = selectedValuesSummary(choices, selected, allLabel);
  return `
    <div class="field">
      <span>${escapeHtml(label)}</span>
      <details class="multi-select">
        <summary>${escapeHtml(summary)}</summary>
        <div class="multi-select__menu">
          ${choices.map((option) => `
            <label>
              <input
                type="checkbox"
                data-field="${escapeHtml(field)}"
                value="${escapeHtml(option.value)}"
                ${selectedSet.has(option.value) ? "checked" : ""}
              >
              <span>${escapeHtml(option.label)}</span>
            </label>
          `).join("")}
          ${selected.length ? `<button type="button" data-action="clear-filter" data-field="${escapeHtml(field)}">Clear</button>` : ""}
        </div>
      </details>
    </div>
  `;
}

function selectedValuesForField(field) {
  switch (field) {
    case "analytics-version":
      return state.analyticsVersion;
    case "analytics-outcome":
      return state.analyticsOutcome;
    case "analytics-player-xp":
      return state.analyticsPlayerXp;
    case "analytics-main-deadlands":
      return state.analyticsMainDeadlands;
    case "analytics-main-edge":
      return state.analyticsMainEdge;
    case "analytics-boss":
      return state.analyticsBoss;
    case "squeaks-tags":
      return state.squeaksTags;
    case "squeaks-platforms":
      return state.squeaksPlatforms;
    case "squeaks-app-versions":
      return state.squeaksAppVersions;
    case "squeaks-player-xp":
      return state.squeaksPlayerXp;
    default:
      return [];
  }
}

function setSelectedValuesForField(field, values) {
  switch (field) {
    case "analytics-version":
      state.analyticsVersion = values;
      state.analyticsOutcome = [];
      break;
    case "analytics-outcome":
      state.analyticsOutcome = values;
      break;
    case "analytics-player-xp":
      state.analyticsPlayerXp = values;
      break;
    case "analytics-main-deadlands":
      state.analyticsMainDeadlands = values;
      break;
    case "analytics-main-edge":
      state.analyticsMainEdge = values;
      break;
    case "analytics-boss":
      state.analyticsBoss = values;
      break;
    case "squeaks-tags":
      state.squeaksTags = values;
      state.squeaksTagSelectionInitialized = true;
      break;
    case "squeaks-platforms":
      state.squeaksPlatforms = values;
      break;
    case "squeaks-app-versions":
      state.squeaksAppVersions = values;
      break;
    case "squeaks-player-xp":
      state.squeaksPlayerXp = values;
      break;
  }
}

function appendSelectedParams(params, key, values) {
  values.forEach((value) => params.append(key, value));
}

function loadForFilterField(field) {
  return field?.startsWith("squeaks-") ? loadSqueaks() : loadAnalytics();
}

async function apiFetch(path, init = {}) {
  if (LOCAL_MOCK) {
    return mockApiFetch(path, init);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers ?? {})
    }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error ?? payload?.reason ?? `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function mockApiFetch(path, init = {}) {
  await new Promise((resolve) => window.setTimeout(resolve, 80));
  if (LOCAL_MOCK === "error" && path !== "/stx/admin/auth/me") {
    const error = new Error("Mock API failure");
    error.status = 500;
    throw error;
  }
  if (path === "/stx/admin/auth/me") {
    if (LOCAL_MOCK === "signed-out") {
      const error = new Error("unauthorized");
      error.status = 401;
      throw error;
    }
    return {
      user: {
        email: "admin@example.com",
        name: "Admin User",
        picture: null,
        expires_at: new Date(Date.now() + 3600_000).toISOString()
      }
    };
  }
  if (path.startsWith("/stx/today")) {
    return {
      date: "2026-05-21",
      versions: {
        iOS: { live_version: "1.2.3", minimum_supported_version: "1.2.0" },
        Android: { live_version: "1.2.4", minimum_supported_version: "1.2.0" },
        Steam: { live_version: "1.3.0", minimum_supported_version: "1.2.1" }
      },
      entries: [],
      player_status: null,
      from: 0,
      count: 1
    };
  }
  if (path === "/stx/admin/scheduled-versions") {
    return {
      date: "2026-05-22",
      scheduled: true,
      minimum_versions: {
        iOS: { minimum_supported_version: "1.2.1" },
        Android: { minimum_supported_version: "1.2.1" },
        Steam: { minimum_supported_version: "1.2.2" }
      },
      updated_at: "2026-05-21T15:00:00.000Z"
    };
  }
  if (path === "/stx/admin/app-config" && init.method === "PATCH") {
    const body = JSON.parse(init.body);
    return {
      next_daily_date: "2026-05-22",
      scheduled_minimum: Object.fromEntries(
        PLATFORMS.map((platform) => [
          platform,
          { minimum_supported_version: body.platforms[platform].minimum_supported_version }
        ])
      ),
      minimum_updated_at: new Date().toISOString(),
      live_versions: Object.fromEntries(
        PLATFORMS.map((platform) => [platform, { live_version: body.platforms[platform].live_version }])
      ),
      live_updated_at: new Date().toISOString()
    };
  }
  if (path.startsWith("/stx/admin/squeaks/summary")) {
    const url = new URL(path, "https://mock.local");
    const interval = url.searchParams.get("interval") || "day";
    const dateRange = url.searchParams.get("date_range") || "7d";
    const tags = url.searchParams.getAll("tag");
    const platforms = url.searchParams.getAll("platform");
    const appVersions = url.searchParams.getAll("app_version");
    const playerXps = url.searchParams.getAll("player_xp");
    const rangeHours = dateRange === "24h" ? 24 : dateRange === "30d" ? 24 * 30 : 24 * 7;
    const stepHours = interval === "hour" ? 1 : 24;
    const to = new Date("2026-08-10T12:00:00.000Z");
    const from = new Date(to.getTime() - rangeHours * 60 * 60 * 1000);
    const allTags = [
      { tag: "first_session", count: 48 },
      { tag: "tutorial_finished", count: 31 },
      { tag: "boss_seen", count: 19 },
      { tag: "store_opened", count: 16 },
      { tag: "daily_started", count: 12 },
      { tag: "settings_opened", count: 7 }
    ];
    const filterScale =
      (platforms.length ? 0.78 : 1) *
      (appVersions.length ? 0.7 : 1) *
      (playerXps.length ? 0.65 : 1);
    const tagOptions = allTags.map((row) => ({
      tag: row.tag,
      count: Math.max(1, Math.round(row.count * filterScale))
    }));
    const buckets = [];
    for (const cursor = new Date(from); cursor <= to; cursor.setUTCHours(cursor.getUTCHours() + stepHours)) {
      const bucket = new Date(cursor);
      if (interval === "day") bucket.setUTCHours(0, 0, 0, 0);
      buckets.push(bucket.toISOString());
    }
    const selectedTags = tags.length ? tags : [];
    const series = selectedTags.map((tag, tagIndex) => ({
      tag,
      points: buckets.map((bucket, index) => {
        const wave = Math.max(0, Math.sin((index + tagIndex) / 2.2));
        const base = Math.max(1, Math.round((tagOptions.find((row) => row.tag === tag)?.count ?? 5) / buckets.length));
        return {
          bucket,
          count: Math.max(0, Math.round((base + wave * (tagIndex + 2)) * filterScale))
        };
      })
    }));
    return {
      count: series.reduce((total, row) => total + row.points.reduce((sum, point) => sum + point.count, 0), 0),
      interval,
      range: { from: from.toISOString(), to: to.toISOString() },
      series,
      tag_options: tagOptions,
      platforms: ["Android", "iOS", "Steam"],
      app_versions: ["1.3.0", "1.2.4", "1.2.3"]
    };
  }
  if (path.startsWith("/stx/admin/analytics/summary")) {
    const url = new URL(path, "https://mock.local");
    const deathActs = url.searchParams.getAll("death_act");
    const appVersions = url.searchParams.getAll("app_version");
    const playerXps = url.searchParams.getAll("player_xp");
    const mainDeadlands = url.searchParams.getAll("main_deadlands");
    const mainEdges = url.searchParams.getAll("main_edge");
    const bosses = url.searchParams.getAll("boss");
    const dateRange = url.searchParams.get("date_range") || "";
    const selectedFilters = [
      ...appVersions,
      ...playerXps,
      ...mainDeadlands,
      ...mainEdges,
      ...bosses,
      dateRange
    ].filter(Boolean).length;
    const averageFactor = (values, factors) =>
      values.length ? values.reduce((sum, value) => sum + (factors[value] ?? 1), 0) / values.length : 1;
    const versionFactors = { "1.3.0": 0.9, "1.2.4": 0.72, "1.2.3": 0.58 };
    const xpFactors = { new: 0.42, beginner: 0.56, intermediate: 0.72, expert: 0.88 };
    const deadlandsFactors = { ooze: 0.84, skelechonk: 0.68, banshee: 0.56, ghost: 0.46 };
    const edgeFactors = { rats: 0.74, spiders: 0.62, necros: 0.5, armored: 0.44 };
    const bossFactors = { vampire: 0.78, lich: 0.64, gargoyle: 0.52, shadow: 0.4 };
    const dateFactors = { "24h": 0.3, "7d": 0.62, "30d": 0.84 };
    const baseOutcomes = [
      { key: "survived", label: "Survived", count: 14 },
      { key: "death_act_1", label: "Died · Deadlands", count: 9 },
      { key: "death_act_2", label: "Died · The Edge", count: 11 },
      { key: "death_act_3", label: "Died · Mausoleum", count: 8 }
    ];
    const allOutcomes = baseOutcomes.map((row, index) => {
      const versionFactor = averageFactor(appVersions, versionFactors);
      const xpFactor = averageFactor(playerXps, xpFactors);
      const deadlandsFactor = averageFactor(mainDeadlands, deadlandsFactors);
      const edgeFactor = averageFactor(mainEdges, edgeFactors);
      const bossFactor = averageFactor(bosses, bossFactors);
      const dateFactor = dateFactors[dateRange] ?? 1;
      const rowVariance = selectedFilters ? 1 + index * 0.08 : 1;
      const count = Math.max(
        selectedFilters ? 1 : 0,
        Math.round(row.count * versionFactor * xpFactor * deadlandsFactor * edgeFactor * bossFactor * dateFactor * rowVariance)
      );
      return { ...row, count };
    });
    const outcomes = deathActs.length === 0
      ? allOutcomes
      : allOutcomes.filter((row) => {
        const value = outcomeKeyToDeathAct(row.key);
        return deathActs.some((deathAct) => deathAct === "dead" ? value !== "-1" : value === deathAct);
      });
    const count = outcomes.reduce((sum, row) => sum + row.count, 0);
    const popularScale = count > 0 ? Math.max(0.18, count / 42) : 0;
    const scaleCount = (value) => Math.max(count > 0 ? 1 : 0, Math.round(value * popularScale));
    return {
      count,
      average_time: Math.max(42, (deathActs.length === 0 ? 118.42 : 104.6) - selectedFilters * 9.5),
      outcomes,
      popular_weapons: [
        { id: 20, label: "Sparkling Spell", count: scaleCount(18) },
        { id: 4, label: "Fire Censer", count: scaleCount(12) },
        { id: 10, label: "Lightning Rod", count: scaleCount(8) }
      ],
      popular_info_items: [
        { id: 37, label: "Necronomicon", count: scaleCount(20) },
        { id: 38, label: "Pendulum", count: scaleCount(13) },
        { id: 39, label: "Compass", count: scaleCount(7) }
      ],
      app_versions: ["1.3.0", "1.2.4", "1.2.3"]
    };
  }
  return { ok: true };
}

function signIn() {
  window.location.href = `${API_BASE}/stx/admin/auth/google/start?return_to=${encodeURIComponent(RETURN_TO)}`;
}

async function signOut() {
  try {
    await apiFetch("/stx/admin/auth/logout", { method: "POST" });
  } finally {
    state.user = null;
    renderLogin();
  }
}

function renderLogin(message = "") {
  app.innerHTML = `
    <section class="login-panel">
      <p class="eyebrow">Axaxaxas Admin</p>
      <h1>Sign in to continue</h1>
      <p class="muted">Google admin access is required before versions or analytics are shown.</p>
      ${message ? `<p class="state state--error">${escapeHtml(message)}</p>` : ""}
      <button class="button" type="button" data-action="signin">Sign in with Google</button>
    </section>
  `;
}

function renderShell() {
  const identity = state.user?.name || state.user?.email || "Admin";
  app.innerHTML = `
    <header class="topbar">
      <div>
        <p class="eyebrow">Axaxaxas</p>
        <h1>Admin Panel</h1>
        <p class="muted">Manage platform versions and monitor run analytics.</p>
      </div>
      <div class="user-box">
        <div>
          <strong>${escapeHtml(identity)}</strong>
          <span class="muted">${escapeHtml(state.user?.email ?? "")}</span>
        </div>
        <button class="button button--secondary" type="button" data-action="signout">Sign out</button>
      </div>
    </header>
    <nav class="tabs" aria-label="Admin sections">
      <button class="tab ${state.activeTab === "versions" ? "is-active" : ""}" type="button" data-tab="versions">Versions</button>
      <button class="tab ${state.activeTab === "analytics" ? "is-active" : ""}" type="button" data-tab="analytics">Analytics</button>
      <button class="tab ${state.activeTab === "squeaks" ? "is-active" : ""}" type="button" data-tab="squeaks">Squeaks</button>
    </nav>
    <main class="panel">
      ${
        state.activeTab === "versions"
          ? renderVersionsPanel()
          : state.activeTab === "analytics"
            ? renderAnalyticsPanel()
            : renderSqueaksPanel()
      }
    </main>
  `;
}

function renderVersionsPanel() {
  if (state.versionsLoading) {
    return `<p class="state">Loading versions...</p>`;
  }
  if (state.versionsError) {
    return `
      <div class="panel-header">
        <div>
          <p class="eyebrow">Versions</p>
          <h2 class="panel-title">Platform versions</h2>
        </div>
        <button class="button button--ghost" type="button" data-action="reload-versions">Retry</button>
      </div>
      <p class="state state--error">${escapeHtml(state.versionsError)}</p>
    `;
  }
  if (!state.versions) {
    return `<p class="state">No version data loaded.</p>`;
  }

  const scheduledMessage = state.scheduled?.scheduled
    ? `Minimum supported versions are scheduled for ${escapeHtml(state.scheduled.date)}. Last update: ${escapeHtml(formatDate(state.scheduled.updated_at))}.`
    : "No next-day minimum version schedule is currently stored; saving will create one.";

  return `
    <form data-form="versions">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Versions</p>
          <h2 class="panel-title">Platform versions</h2>
          <p class="muted">Live changes apply immediately. Minimum supported versions are scheduled for the next UTC daily.</p>
        </div>
        <button class="button button--ghost" type="button" data-action="reload-versions">Refresh</button>
      </div>
      <p class="callout">${scheduledMessage}</p>
      <div class="versions-grid">
        ${PLATFORMS.map((platform) => {
          const current = state.versions[platform] ?? { live_version: "", minimum_supported_version: "" };
          return `
            <fieldset class="version-card">
              <h3>${platform}</h3>
              <label class="field">
                <span>Live version</span>
                <input class="input" name="${platform}.live_version" value="${escapeHtml(current.live_version)}" required pattern="\\d+\\.\\d+\\.\\d+" inputmode="numeric">
              </label>
              <label class="field">
                <span>Minimum supported</span>
                <input class="input" name="${platform}.minimum_supported_version" value="${escapeHtml(current.minimum_supported_version)}" required pattern="\\d+\\.\\d+\\.\\d+" inputmode="numeric">
              </label>
            </fieldset>
          `;
        }).join("")}
      </div>
      <div class="actions">
        <button class="button" type="submit" ${state.saveStatus === "saving" ? "disabled" : ""}>
          ${state.saveStatus === "saving" ? "Saving..." : "Submit version changes"}
        </button>
        ${state.saveMessage ? `<p class="message message--${state.saveStatus === "error" ? "error" : "success"}">${escapeHtml(state.saveMessage)}</p>` : ""}
      </div>
    </form>
  `;
}

function renderAnalyticsPanel() {
  if (state.analyticsLoading) {
    return `<p class="state">Loading analytics...</p>`;
  }
  if (state.analyticsError) {
    return `
      <div class="panel-header">
        <div>
          <p class="eyebrow">Analytics</p>
          <h2 class="panel-title">Run analytics</h2>
        </div>
        <button class="button button--ghost" type="button" data-action="reload-analytics">Retry</button>
      </div>
      <p class="state state--error">${escapeHtml(state.analyticsError)}</p>
    `;
  }
  if (!state.analytics) {
    return `<p class="state">No analytics loaded.</p>`;
  }

  const summary = state.analytics;
  const appVersions = Array.isArray(summary.app_versions) ? summary.app_versions : [];
  const outcomeOptions = Array.isArray(state.analyticsOutcomeOptions) ? state.analyticsOutcomeOptions : [];
  const knownKeys = new Set(["count", "average_time", "outcomes", "popular_weapons", "popular_info_items", "app_versions"]);
  const extraEntries = Object.entries(summary).filter(([key]) => !knownKeys.has(key));

  return `
    <div class="analytics-toolbar">
      <div>
        <p class="eyebrow">Analytics</p>
        <h2 class="panel-title">Run analytics</h2>
        <p class="muted">Summary from <code>/stx/admin/analytics/summary</code>.</p>
      </div>
      <div class="analytics-filters">
        ${renderMultiSelectFilter(
          "App version",
          "All versions",
          appVersions.map((version) => ({ value: version, label: version })),
          state.analyticsVersion,
          "analytics-version"
        )}
        ${renderMultiSelectFilter(
          "Outcome",
          "All outcomes",
          buildOutcomeFilterOptions(outcomeOptions).map((outcome) => ({
            value: outcome.value,
            label: `${outcome.label ?? outcome.key} (${outcome.count ?? 0})`
          })),
          state.analyticsOutcome,
          "analytics-outcome"
        )}
        ${renderMultiSelectFilter(
          "Player XP",
          "All players",
          ANALYTICS_PLAYER_XP_OPTIONS,
          state.analyticsPlayerXp,
          "analytics-player-xp"
        )}
        <label class="field">
          <span>Date</span>
          <select class="select" data-field="analytics-date-range">
            ${ANALYTICS_DATE_RANGE_OPTIONS.map((option) => `
              <option value="${escapeHtml(option.value)}" ${option.value === state.analyticsDateRange ? "selected" : ""}>
                ${escapeHtml(option.label)}
              </option>
            `).join("")}
          </select>
        </label>
        <fieldset class="filter-group">
          <legend>Main enemies</legend>
          ${renderMultiSelectFilter(
            "Main Deadlands",
            "All Deadlands mains",
            ANALYTICS_MAIN_DEADLANDS_OPTIONS,
            state.analyticsMainDeadlands,
            "analytics-main-deadlands"
          )}
          ${renderMultiSelectFilter(
            "Main Edge",
            "All Edge mains",
            ANALYTICS_MAIN_EDGE_OPTIONS,
            state.analyticsMainEdge,
            "analytics-main-edge"
          )}
          ${renderMultiSelectFilter(
            "Boss",
            "All bosses",
            ANALYTICS_BOSS_OPTIONS,
            state.analyticsBoss,
            "analytics-boss"
          )}
        </fieldset>
      </div>
    </div>
    <div class="stat-grid">
      <div class="stat"><span>Runs</span><strong>${escapeHtml(summary.count ?? 0)}</strong></div>
      <div class="stat"><span>Average run time</span><strong>${escapeHtml(formatDuration(summary.average_time))}</strong></div>
      <div class="stat"><span>Versions</span><strong>${appVersions.length}</strong></div>
    </div>
    ${renderBarSection("Outcome breakdown", summary.outcomes, summary.count)}
    ${renderBarSection("Popular weapons", summary.popular_weapons, summary.count)}
    ${renderBarSection("Popular info items", summary.popular_info_items, summary.count)}
    ${extraEntries.length ? renderJsonSection("Additional summary fields", extraEntries) : ""}
  `;
}

function renderSqueaksPanel() {
  if (state.squeaksLoading) {
    return `<p class="state">Loading squeaks...</p>`;
  }
  if (state.squeaksError) {
    return `
      <div class="panel-header">
        <div>
          <p class="eyebrow">Squeaks</p>
          <h2 class="panel-title">Squeak events</h2>
        </div>
        <button class="button button--ghost" type="button" data-action="reload-squeaks">Retry</button>
      </div>
      <p class="state state--error">${escapeHtml(state.squeaksError)}</p>
    `;
  }
  if (!state.squeaks) {
    return `<p class="state">No squeaks loaded.</p>`;
  }

  const summary = state.squeaks;
  const tagOptions = Array.isArray(summary.tag_options) ? summary.tag_options : [];
  const platformOptions = Array.isArray(summary.platforms) ? summary.platforms.map((platform) => ({ value: platform, label: platform })) : [];
  const appVersionOptions = Array.isArray(summary.app_versions)
    ? summary.app_versions.map((version) => ({ value: version, label: version }))
    : [];
  const selectedDateLabel = labelForOption(SQUEAKS_DATE_RANGE_OPTIONS, state.squeaksDateRange);
  const tagTotals = tagTotalsFromSeries(summary.series);
  const noTagsAvailable = tagOptions.length === 0;
  const noTagsSelected = !noTagsAvailable && state.squeaksTags.length === 0;

  return `
    <div class="analytics-toolbar">
      <div>
        <p class="eyebrow">Squeaks</p>
        <h2 class="panel-title">Squeak events</h2>
        <p class="muted">Summary from <code>/stx/admin/squeaks/summary</code>.</p>
      </div>
      <div class="analytics-filters">
        ${renderMultiSelectFilter(
          "Tag",
          "All tags",
          tagOptions.map((option) => ({ value: option.tag, label: `${option.tag} (${option.count ?? 0})` })),
          state.squeaksTags,
          "squeaks-tags"
        )}
        <label class="field">
          <span>Interval</span>
          <select class="select" data-field="squeaks-interval">
            ${SQUEAKS_INTERVAL_OPTIONS.map((option) => `
              <option value="${escapeHtml(option.value)}" ${option.value === state.squeaksInterval ? "selected" : ""}>
                ${escapeHtml(option.label)}
              </option>
            `).join("")}
          </select>
        </label>
        <label class="field">
          <span>Date</span>
          <select class="select" data-field="squeaks-date-range">
            ${SQUEAKS_DATE_RANGE_OPTIONS.map((option) => `
              <option value="${escapeHtml(option.value)}" ${option.value === state.squeaksDateRange ? "selected" : ""}>
                ${escapeHtml(option.label)}
              </option>
            `).join("")}
          </select>
        </label>
        ${renderMultiSelectFilter("Platform", "All platforms", platformOptions, state.squeaksPlatforms, "squeaks-platforms")}
        ${renderMultiSelectFilter("App version", "All versions", appVersionOptions, state.squeaksAppVersions, "squeaks-app-versions")}
        ${renderMultiSelectFilter("Player XP", "All players", ANALYTICS_PLAYER_XP_OPTIONS, state.squeaksPlayerXp, "squeaks-player-xp")}
      </div>
    </div>
    <div class="stat-grid">
      <div class="stat"><span>Squeaks</span><strong>${escapeHtml(summary.count ?? 0)}</strong></div>
      <div class="stat"><span>Selected tags</span><strong>${escapeHtml(state.squeaksTags.length)}</strong></div>
      <div class="stat"><span>Window</span><strong>${escapeHtml(selectedDateLabel)}</strong></div>
    </div>
    ${noTagsAvailable ? `<p class="state">No squeak tags found for this filter.</p>` : ""}
    ${noTagsSelected ? `<p class="callout">Select one or more tags to show squeak series data.</p>` : ""}
    ${renderSqueaksSeriesChart(summary)}
    ${renderBarSection("Tag breakdown", tagTotals, summary.count)}
  `;
}

function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function barColorForPercent(value) {
  const percent = clampPercent(value);
  const hue = Math.round(210 - percent * 1.35);
  return `hsl(${hue} 72% 48%)`;
}

function analyticsSummaryPath(params) {
  const query = params.toString();
  return `/stx/admin/analytics/summary${query ? `?${query}` : ""}`;
}

function squeaksSummaryPath(params) {
  const query = params.toString();
  return `/stx/admin/squeaks/summary${query ? `?${query}` : ""}`;
}

function labelForOption(options, value) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function tagTotalsFromSeries(series) {
  if (!Array.isArray(series)) return [];
  return series.map((row) => ({
    key: row.tag,
    label: row.tag,
    count: Array.isArray(row.points)
      ? row.points.reduce((total, point) => total + (Number(point.count) || 0), 0)
      : 0
  }));
}

function renderSqueaksSeriesChart(summary) {
  const series = Array.isArray(summary.series) ? summary.series : [];
  if (!series.length) {
    return `
      <section class="analytics-section">
        <h3>Squeaks over time</h3>
        <p class="state">Select one or more tags to show a time series.</p>
      </section>
    `;
  }

  const width = 760;
  const height = 280;
  const pad = { top: 18, right: 18, bottom: 38, left: 48 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const maxCount = Math.max(
    ...series.flatMap((row) => Array.isArray(row.points) ? row.points.map((point) => Number(point.count) || 0) : [0]),
    1
  );
  const colors = ["#57d68d", "#f4b84a", "#ef5f67", "#7cc7ff", "#c084fc"];
  const firstPoints = Array.isArray(series[0]?.points) ? series[0].points : [];
  const xForIndex = (index, length) => pad.left + (length <= 1 ? 0 : (index / (length - 1)) * plotWidth);
  const yForCount = (count) => pad.top + plotHeight - (count / maxCount) * plotHeight;
  const yTicks = [0, Math.round(maxCount / 2), maxCount];
  const xTicks = firstPoints.length <= 1
    ? firstPoints
    : [firstPoints[0], firstPoints[Math.floor(firstPoints.length / 2)], firstPoints[firstPoints.length - 1]];

  return `
    <section class="analytics-section">
      <h3>Squeaks over time</h3>
      <div class="squeaks-chart" role="img" aria-label="Squeak count by selected tag over time">
        <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
          ${yTicks.map((tick) => {
            const y = yForCount(tick);
            return `
              <line class="squeaks-chart__grid" x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}"></line>
              <text class="squeaks-chart__tick" x="${pad.left - 10}" y="${y + 4}" text-anchor="end">${tick}</text>
            `;
          }).join("")}
          ${xTicks.map((point, index) => {
            const pointIndex = firstPoints.indexOf(point);
            const x = xForIndex(pointIndex, firstPoints.length);
            return `
              <text class="squeaks-chart__tick" x="${x}" y="${height - 10}" text-anchor="${index === 0 ? "start" : index === xTicks.length - 1 ? "end" : "middle"}">
                ${escapeHtml(formatSqueakBucket(point.bucket, summary.interval))}
              </text>
            `;
          }).join("")}
          ${series.map((row, index) => {
            const points = Array.isArray(row.points) ? row.points : [];
            const polyline = points
              .map((point, pointIndex) => `${xForIndex(pointIndex, points.length)},${yForCount(Number(point.count) || 0)}`)
              .join(" ");
            return `<polyline class="squeaks-chart__line" points="${polyline}" style="--series-color: ${colors[index % colors.length]}"></polyline>`;
          }).join("")}
        </svg>
      </div>
      <div class="squeaks-legend">
        ${series.map((row, index) => `
          <span><i style="--series-color: ${colors[index % colors.length]}"></i>${escapeHtml(row.tag)}</span>
        `).join("")}
      </div>
    </section>
  `;
}

function formatSqueakBucket(iso, interval) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  if (interval === "hour") {
    return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", hour12: false, timeZone: "UTC" });
  }
  return date.toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function renderBarSection(title, rows, totalRuns) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return `
      <section class="analytics-section">
        <h3>${escapeHtml(title)}</h3>
        <p class="state">No data.</p>
      </section>
    `;
  }

  const denominator = Math.max(Number(totalRuns) || 0, 0);
  return `
    <section class="analytics-section">
      <h3>${escapeHtml(title)}</h3>
      ${rows.map((row) => {
        const label = row.label ?? row.key ?? row.id ?? "Unknown";
        const count = Number(row.count) || 0;
        const percent = denominator > 0 ? clampPercent((count / denominator) * 100) : 0;
        return `
          <div class="bar-row">
            <span class="bar-label">${escapeHtml(label)}</span>
            <span class="bar-count">${count}</span>
            <span class="bar-track"><span class="bar-fill" style="width: ${percent}%; --bar-color: ${barColorForPercent(percent)}"></span></span>
          </div>
        `;
      }).join("")}
    </section>
  `;
}

function renderJsonSection(title, entries) {
  return `
    <section class="analytics-section">
      <h3>${escapeHtml(title)}</h3>
      <div class="json-grid">
        ${entries.map(([key, value]) => `
          <div class="json-row">
            <span class="json-key">${escapeHtml(formatKey(key))}</span>
            <pre class="json-value">${escapeHtml(JSON.stringify(value, null, 2))}</pre>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

async function checkSession() {
  try {
    const payload = await apiFetch("/stx/admin/auth/me");
    state.user = payload.user;
    renderShell();
    await loadVersions();
  } catch (error) {
    state.user = null;
    if (error.status === 401) {
      renderLogin();
      return;
    }
    renderLogin(error.message || "Unable to check admin session.");
  }
}

async function loadVersions() {
  state.versionsLoading = true;
  state.versionsError = "";
  renderShell();
  try {
    const [today, scheduled] = await Promise.all([
      apiFetch("/stx/today?from=0&count=1"),
      apiFetch("/stx/admin/scheduled-versions")
    ]);
    const next = structuredClone(today.versions);
    for (const platform of PLATFORMS) {
      const scheduledMinimum = scheduled?.minimum_versions?.[platform]?.minimum_supported_version;
      if (scheduledMinimum) {
        next[platform].minimum_supported_version = scheduledMinimum;
      }
    }
    state.versions = next;
    state.scheduled = scheduled;
    state.versionsLoading = false;
  } catch (error) {
    state.versionsLoading = false;
    state.versionsError = error.message || "Unable to load versions.";
  }
  renderShell();
}

async function loadAnalytics() {
  state.analyticsLoading = true;
  state.analyticsError = "";
  renderShell();
  try {
    const baseParams = new URLSearchParams();
    appendSelectedParams(baseParams, "app_version", state.analyticsVersion);
    appendSelectedParams(baseParams, "player_xp", state.analyticsPlayerXp);
    if (state.analyticsDateRange) {
      baseParams.set("date_range", state.analyticsDateRange);
    }
    appendSelectedParams(baseParams, "main_deadlands", state.analyticsMainDeadlands);
    appendSelectedParams(baseParams, "main_edge", state.analyticsMainEdge);
    appendSelectedParams(baseParams, "boss", state.analyticsBoss);

    const optionsSummary = await apiFetch(analyticsSummaryPath(baseParams));
    state.analyticsOutcomeOptions = Array.isArray(optionsSummary.outcomes) ? optionsSummary.outcomes : [];
    const availableOutcomeValues = new Set(buildOutcomeFilterOptions(state.analyticsOutcomeOptions).map((option) => option.value));
    const availableOutcomes = state.analyticsOutcome.filter((outcome) => availableOutcomeValues.has(outcome));
    if (availableOutcomes.length !== state.analyticsOutcome.length) {
      state.analyticsOutcome = availableOutcomes;
    }

    if (state.analyticsOutcome.length) {
      const filteredParams = new URLSearchParams(baseParams);
      appendSelectedParams(filteredParams, "death_act", state.analyticsOutcome);
      const filteredSummary = await apiFetch(analyticsSummaryPath(filteredParams));
      state.analytics = {
        ...filteredSummary,
        app_versions: Array.isArray(optionsSummary.app_versions) ? optionsSummary.app_versions : filteredSummary.app_versions
      };
    } else {
      state.analytics = optionsSummary;
    }
    state.analyticsLoading = false;
  } catch (error) {
    state.analyticsLoading = false;
    state.analyticsError = error.message || "Unable to load analytics.";
  }
  renderShell();
}

async function loadSqueaks() {
  state.squeaksLoading = true;
  state.squeaksError = "";
  renderShell();
  try {
    const baseParams = new URLSearchParams();
    baseParams.set("interval", state.squeaksInterval);
    baseParams.set("date_range", state.squeaksDateRange);
    appendSelectedParams(baseParams, "platform", state.squeaksPlatforms);
    appendSelectedParams(baseParams, "app_version", state.squeaksAppVersions);
    appendSelectedParams(baseParams, "player_xp", state.squeaksPlayerXp);

    const discovery = await apiFetch(squeaksSummaryPath(baseParams));
    const tagOptions = Array.isArray(discovery.tag_options) ? discovery.tag_options : [];
    const availableTags = new Set(tagOptions.map((option) => option.tag));
    let selectedTags = state.squeaksTags.filter((tag) => availableTags.has(tag));

    if (!state.squeaksTagSelectionInitialized && tagOptions.length > 0) {
      selectedTags = tagOptions.slice(0, 5).map((option) => option.tag);
      state.squeaksTagSelectionInitialized = true;
    }
    state.squeaksTags = selectedTags;

    if (selectedTags.length > 0) {
      const filteredParams = new URLSearchParams(baseParams);
      appendSelectedParams(filteredParams, "tag", selectedTags);
      const filteredSummary = await apiFetch(squeaksSummaryPath(filteredParams));
      state.squeaks = {
        ...filteredSummary,
        tag_options: tagOptions,
        platforms: Array.isArray(discovery.platforms) ? discovery.platforms : filteredSummary.platforms,
        app_versions: Array.isArray(discovery.app_versions) ? discovery.app_versions : filteredSummary.app_versions
      };
    } else {
      state.squeaks = discovery;
    }
    state.squeaksLoading = false;
  } catch (error) {
    state.squeaksLoading = false;
    state.squeaksError = error.message || "Unable to load squeaks.";
  }
  renderShell();
}

async function saveVersions(form) {
  const data = new FormData(form);
  const platforms = {};
  for (const platform of PLATFORMS) {
    platforms[platform] = {
      live_version: String(data.get(`${platform}.live_version`) ?? "").trim(),
      minimum_supported_version: String(data.get(`${platform}.minimum_supported_version`) ?? "").trim()
    };
  }

  state.saveStatus = "saving";
  state.saveMessage = "Saving...";
  renderShell();

  try {
    const saved = await apiFetch("/stx/admin/app-config", {
      method: "PATCH",
      body: JSON.stringify({ platforms })
    });
    state.versions = {};
    for (const platform of PLATFORMS) {
      state.versions[platform] = {
        live_version: saved.live_versions?.[platform]?.live_version ?? platforms[platform].live_version,
        minimum_supported_version:
          saved.scheduled_minimum?.[platform]?.minimum_supported_version ?? platforms[platform].minimum_supported_version
      };
    }
    state.scheduled = {
      date: saved.next_daily_date,
      scheduled: true,
      minimum_versions: saved.scheduled_minimum ?? {},
      updated_at: saved.minimum_updated_at ?? null
    };
    state.saveStatus = "success";
    state.saveMessage = "Version settings saved.";
  } catch (error) {
    state.saveStatus = "error";
    state.saveMessage = error.message || "Unable to save version settings.";
  }
  renderShell();
}

app.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const target = event.target.closest("button");
  if (!target) return;
  const action = target.dataset.action;
  const tab = target.dataset.tab;
  if (action === "signin") signIn();
  if (action === "signout") void signOut();
  if (action === "reload-versions") void loadVersions();
  if (action === "reload-analytics") void loadAnalytics();
  if (action === "reload-squeaks") void loadSqueaks();
  if (action === "clear-filter") {
    setSelectedValuesForField(target.dataset.field, []);
    renderShell();
    void loadForFilterField(target.dataset.field);
  }
  if (tab) {
    state.activeTab = tab;
    renderShell();
    if (tab === "versions" && !state.versions && !state.versionsLoading) void loadVersions();
    if (tab === "analytics" && !state.analytics && !state.analyticsLoading) void loadAnalytics();
    if (tab === "squeaks" && !state.squeaks && !state.squeaksLoading) void loadSqueaks();
  }
});

app.addEventListener("submit", (event) => {
  if (!(event.target instanceof Element)) return;
  const form = event.target.closest("[data-form='versions']");
  if (!form) return;
  event.preventDefault();
  void saveVersions(form);
});

app.addEventListener("change", (event) => {
  if (!(event.target instanceof Element)) return;
  const target = event.target;
  const field = target?.dataset?.field;
  if (
    target instanceof HTMLInputElement &&
    target.type === "checkbox" &&
    (field?.startsWith("analytics-") || field?.startsWith("squeaks-"))
  ) {
    const selected = selectedValuesForField(field);
    const nextValues = target.checked
      ? [...selected, target.value]
      : selected.filter((value) => value !== target.value);
    setSelectedValuesForField(field, nextValues);
    renderShell();
    void loadForFilterField(field);
  }
  if (target instanceof HTMLSelectElement && field === "analytics-date-range") {
    state.analyticsDateRange = target.value;
    void loadAnalytics();
  }
  if (target instanceof HTMLSelectElement && field === "squeaks-date-range") {
    state.squeaksDateRange = target.value;
    void loadSqueaks();
  }
  if (target instanceof HTMLSelectElement && field === "squeaks-interval") {
    state.squeaksInterval = target.value;
    void loadSqueaks();
  }
});

void checkSession();
