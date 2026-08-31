/* Shepherd — Disciples & Churches tracker */
(() => {
  const STORE_KEY = "shepherd.data.v1";

  // ---------- data ----------
  const seed = () => ([
    ...FOCUS_DISCIPLES.map(d => ({ ...d, id: uid(), type: "disciple", role: "building", focus: true, checkins: [] })),
    { id: uid(), type: "church", name: "Church — Hawaii", role: "building", lat: 21.4389, lng: -158.0001, place: "Oahu, HI",
      health: "green", kind: "house", formed: "2025-11", notes: "Cycle of discipleship & church care in Hawaii.", checkins: [] },
    { id: uid(), type: "church", name: "Church — California", role: "blessing", lat: 34.0522, lng: -118.2437, place: "Los Angeles, CA",
      health: "yellow", kind: "established", notes: "Contributing toward / blessing this work.", checkins: [] },
    { id: uid(), type: "church", name: "Church — Japan", role: "blessing", lat: 35.6762, lng: 139.6503, place: "Tokyo, Japan",
      health: "gray", kind: "house", formed: "2026-03", notes: "Early connection in Japan.", checkins: [] },
  ]);

  function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

  // ---------- the people you are actually focused on ----------
  // lat/lng may be null — "location not set yet" is a first-class state.
  const FOCUS_DISCIPLES = [
    { name: "Sujit Bandari", place: "Dallas, TX", lat: 32.7767, lng: -96.797, soil: "green",
      notes: "Walking closely; growing in leadership.",
      training: { assurance: true, baptized: true, word: true, story: true, gospel: true, dbs: true } },
    { name: "Isaac", place: "", lat: null, lng: null, soil: "unset",
      notes: "Location still to be confirmed.", training: {} },
    { name: "Becca Topping", place: "Mongolia", lat: 47.8864, lng: 106.9057, soil: "unset",
      notes: "Serving in Mongolia.", training: {} },
    { name: "Gavin", place: "", lat: null, lng: null, soil: "unset",
      notes: "", training: {} },
    { name: "Henry McAlpine", place: "Los Angeles, CA", lat: 34.0522, lng: -118.2437, soil: "unset",
      notes: "", training: {} },
  ];

  // Each focus disciple is offered to your device exactly once, tracked by name in
  // a ledger. Someone added to the roster later gets synced on the next launch,
  // while anyone you have deleted stays deleted. Your own edits are never touched.
  const FOCUS_SYNC_KEY = "shepherd.focusSync.v1";   // legacy boolean flag
  const FOCUS_LEDGER_KEY = "shepherd.focusSynced.v1";
  const firstName = n => String(n || "").trim().toLowerCase().split(/\s+/)[0];

  function loadLedger() {
    try {
      const raw = localStorage.getItem(FOCUS_LEDGER_KEY);
      if (raw) return new Set(JSON.parse(raw));
    } catch (e) {}
    // upgrading from the old all-or-nothing flag: everyone synced back then is
    // already accounted for, so only genuinely new names get offered.
    if (localStorage.getItem(FOCUS_SYNC_KEY)) {
      return new Set(["sujit", "isaac", "becca", "gavin"]);
    }
    return new Set();
  }

  function syncFocusDisciples(items) {
    const ledger = loadLedger();
    let changed = false;
    FOCUS_DISCIPLES.forEach(fd => {
      const key = firstName(fd.name);
      if (ledger.has(key)) return;         // already offered once — leave it alone
      ledger.add(key);
      const existing = items.find(i => i.type === "disciple" && firstName(i.name) === key);
      if (existing) {
        if (!existing.focus) { existing.focus = true; changed = true; } // yours already — only mark it
      } else {
        items.push({ ...fd, id: uid(), type: "disciple", role: "building", focus: true, checkins: [] });
        changed = true;
      }
    });
    // persist immediately, or the additions vanish on the next launch
    if (changed) localStorage.setItem(STORE_KEY, JSON.stringify(items));
    localStorage.setItem(FOCUS_LEDGER_KEY, JSON.stringify([...ledger]));
    return items;
  }

  // One-time surname fill for focus disciples added before their full name was known.
  // Only touches an exact bare first-name match, so a name you have edited is left alone.
  const NAME_FILL_KEY = "shepherd.nameFill.v1";
  const NAME_FILLS = [{ from: "becca", to: "Becca Topping" }];
  function fillFocusNames(items) {
    if (localStorage.getItem(NAME_FILL_KEY)) return items;
    let changed = false;
    NAME_FILLS.forEach(({ from, to }) => {
      items.forEach(i => {
        if (i.type === "disciple" && String(i.name || "").trim().toLowerCase() === from) {
          i.name = to;
          changed = true;
        }
      });
    });
    if (changed) localStorage.setItem(STORE_KEY, JSON.stringify(items));
    localStorage.setItem(NAME_FILL_KEY, "1");
    return items;
  }

  function firstWord(n) { return String(n || "").trim().split(/\s+/)[0] || "this"; }

  // ---------- texting ----------
  // A web app can't read your phone's message history, so "last texted" is
  // recorded when you send from here (or set by hand).
  const cleanPhone = p => String(p || "").replace(/[^\d+]/g, "");
  const smsHref = p => "sms:" + cleanPhone(p);

  function textedLabel(item) {
    if (!item.lastTexted) return item.phone ? "Never texted from here" : "";
    const d = daysSince(item.lastTexted);
    if (d === 0) return "Texted today";
    if (d === 1) return "Texted yesterday";
    if (d < 0) return `Texted ${esc(item.lastTexted)}`;
    return `Texted ${d} days ago`;
  }

  function markTexted(item, date) {
    item.lastTexted = date || new Date().toISOString().slice(0, 10);
    save(); renderList();
  }

  function hasLocation(item) {
    return typeof item.lat === "number" && typeof item.lng === "number";
  }

  let data = load();
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return fillFocusNames(syncFocusDisciples(migrate(JSON.parse(raw))));
    } catch (e) {}
    const s = seed();
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
    return s;
  }
  // disciples used to carry a generic `health`; it now reads as soil
  function migrate(items) {
    items.forEach(i => {
      if (i.type === "disciple" && !i.soil) i.soil = i.health === "gray" ? "unset" : (i.health || "unset");
      if (i.type === "disciple" && !i.training) i.training = {};
      if (i.type === "church" && !i.kind) i.kind = "established";
    });
    return items;
  }
  function save() { localStorage.setItem(STORE_KEY, JSON.stringify(data)); }

  // ---------- the four soils (Matthew 13:3–23) ----------
  const SOILS = {
    green: {
      light: "Green light",
      soil: "Good soil",
      short: "Bearing fruit",
      desc: "Hears the word, understands it, and bears fruit — thirty, sixty, a hundredfold. Keep sowing; give them more to carry.",
    },
    yellow: {
      light: "Yellow light",
      soil: "Thorny ground",
      short: "Crowded out",
      desc: "The word took root, but the cares of this world and the deceitfulness of riches are choking it. Fruitfulness is stalling. Help them pull weeds.",
    },
    red: {
      light: "Red light",
      soil: "Rocky ground",
      short: "No root",
      desc: "Received the word with joy, but has no root in themselves. When trouble or persecution comes, they fall away. Depth is the need, not more excitement.",
    },
    black: {
      light: "Black light",
      soil: "The path",
      short: "Word snatched",
      desc: "The word is heard but not understood, and the enemy carries it off before it can take root. The ground itself must be broken up first.",
    },
    unset: {
      light: "Not yet discerned",
      soil: "Unknown soil",
      short: "Unknown",
      desc: "You haven't marked a soil for them yet.",
    },
  };
  const SOIL_ORDER = ["green", "yellow", "red", "black"];

  // ---------- target 1: fully trained disciples ----------
  // A disciple is "fully trained" once every tool below has been handed over.
  const TRAINING = [
    { id: "assurance", label: "Assurance of salvation", hint: "Knows they are His, and why." },
    { id: "baptized", label: "Baptized", hint: "Publicly buried and raised with Christ." },
    { id: "word", label: "Daily Word & prayer", hint: "Feeding themselves, not waiting to be fed." },
    { id: "story", label: "Shares their testimony", hint: "Can tell their story in a few minutes." },
    { id: "gospel", label: "Shares the gospel", hint: "Can open the gospel with a stranger." },
    { id: "dbs", label: "Leads a Bible study", hint: "Can facilitate discovery, not just attend." },
    { id: "disciples", label: "Discipling someone else", hint: "Has their own person they are stewarding." },
    { id: "gathers", label: "Ready to gather a house church", hint: "Equipped to start and shepherd a gathering." },
  ];

  function trainedCount(item) {
    const t = item.training || {};
    return TRAINING.filter(m => t[m.id]).length;
  }
  function isFullyTrained(item) {
    return item.type === "disciple" && trainedCount(item) === TRAINING.length;
  }

  // ---------- target 2: house churches formed ----------
  const CHURCH_KINDS = {
    house: { label: "House church", icon: "🏠", desc: "A gathering formed in a home." },
    established: { label: "Established church", icon: "⛪️", desc: "An existing congregation." },
  };
  function isHouseChurch(item) { return item.type === "church" && (item.kind || "established") === "house"; }
  function churchIcon(item) { return isHouseChurch(item) ? "🏠" : "⛪️"; }

  // ---------- targets (editable goals) ----------
  const TARGETS_KEY = "shepherd.targets.v1";
  let targets = loadTargets();
  function loadTargets() {
    try {
      const raw = localStorage.getItem(TARGETS_KEY);
      if (raw) return { houseChurches: 10, trainedDisciples: 10, ...JSON.parse(raw) };
    } catch (e) {}
    return { houseChurches: 10, trainedDisciples: 10 };
  }
  function saveTargets() { localStorage.setItem(TARGETS_KEY, JSON.stringify(targets)); }

  function progress() {
    const disciples = data.filter(d => d.type === "disciple");
    const churches = data.filter(d => d.type === "church");
    const trained = disciples.filter(isFullyTrained);
    const houses = churches.filter(isHouseChurch);
    return {
      disciples, churches, trained, houses,
      trainedN: trained.length, housesN: houses.length,
      // everyone who has started but not finished, most-complete first
      inTraining: disciples
        .filter(d => !isFullyTrained(d))
        .map(d => ({ item: d, done: trainedCount(d) }))
        .sort((a, b) => b.done - a.done),
    };
  }

  // ---------- state ----------
  let view = "disciples"; // disciples | churches
  let listOpen = false;
  let pickingLocation = null; // callback(latlng) when tap-to-place is active
  let markers = [];

  // ---------- map ----------
  const map = L.map("map", { zoomControl: false, attributionControl: true, worldCopyJump: true })
    .setView([25, -140], 3);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; OpenStreetMap &copy; CARTO', maxZoom: 19,
  }).addTo(map);

  map.on("click", (e) => {
    if (pickingLocation) {
      const cb = pickingLocation;
      pickingLocation = null;
      hideTapHint();
      cb(e.latlng);
    }
  });

  // disciples are marked by soil, churches by health — both drive the same dot
  function statusKey(item) {
    if (item.type === "disciple") {
      const s = item.soil || "unset";
      return s === "unset" ? "gray" : s;
    }
    return item.health || "gray";
  }
  function statusClass(item) { return "dot-" + statusKey(item); }

  function renderMarkers() {
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    const items = data
      .filter(d => d.type === (view === "disciples" ? "disciple" : "church"))
      .filter(hasLocation);
    items.forEach(item => {
      const icon = L.divIcon({
        className: "",
        html: `<div class="pin ${item.type}${isHouseChurch(item) ? " house" : ""}${isFullyTrained(item) ? " trained" : ""}${item.focus ? " focus" : ""}"><span>${item.type === "disciple" ? "🧑" : churchIcon(item)}</span><i class="health-dot ${statusClass(item)}"></i></div>`,
        iconSize: [34, 34],
        iconAnchor: [8, 32],
      });
      const m = L.marker([item.lat, item.lng], { icon }).addTo(map);
      m.on("click", () => openDetail(item.id));
      markers.push(m);
    });
    if (items.length) {
      const b = L.latLngBounds(items.map(i => [i.lat, i.lng]));
      map.fitBounds(b.pad(0.35), { maxZoom: 6 });
    }
    updateUnlocatedBanner();
  }

  // ---------- helpers ----------
  const $ = s => document.querySelector(s);
  const esc = s => String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function daysSince(dateStr) {
    if (!dateStr) return null;
    return Math.floor((Date.now() - new Date(dateStr + "T12:00:00").getTime()) / 86400000);
  }
  function lastCheckin(item) {
    if (!item.checkins || !item.checkins.length) return null;
    return [...item.checkins].sort((a, b) => b.date.localeCompare(a.date))[0];
  }
  function followupLabel(item) {
    const lc = lastCheckin(item);
    if (!lc) return "No check-ins yet";
    const d = daysSince(lc.date);
    if (d === 0) return "Checked in today";
    if (d === 1) return "Checked in yesterday";
    return `Last check-in ${d} days ago`;
  }
  const HEALTH_LABEL = { green: "Healthy", yellow: "Needs attention", red: "Struggling", gray: "Unknown" };
  const ROLE_LABEL = { building: "Building — responsible for", blessing: "Blessing — contributing toward" };

  // ---------- list ----------
  function renderList() {
    const wrap = $("#list-scroll");
    const type = view === "disciples" ? "disciple" : "church";
    const items = data.filter(d => d.type === type);
    if (!items.length) {
      wrap.innerHTML = `<div class="empty-msg">Nothing here yet.<br>Tap + to add your first ${type}.</div>`;
      return;
    }
    // focus disciples lead the list, then everyone else
    const focused = items.filter(i => i.focus);
    const rest = items.filter(i => !i.focus);
    const section = (title, arr) => arr.length
      ? `<div class="list-section">${title}</div>` + arr.map(renderCard).join("")
      : "";

    wrap.innerHTML = goalStrip()
      + (focused.length && rest.length
          ? section(`⭐ Focus (${focused.length})`, focused) + section("Everyone else", rest)
          : [...focused, ...rest].map(renderCard).join(""));

    const unlocated = items.filter(i => !hasLocation(i));
    if (unlocated.length) {
      wrap.insertAdjacentHTML("beforeend",
        `<div class="hint-note">📍 ${unlocated.length} ${unlocated.length === 1 ? "entry has" : "entries have"} no location yet — open ${unlocated.length === 1 ? "it" : "them"} to add one.</div>`);
    }

    function renderCard(i) {
      const done = trainedCount(i), full = isFullyTrained(i);
      return `
      <div class="card ${i.focus ? "is-focus" : ""}" data-id="${i.id}">
        <div class="avatar ${i.type}">${i.type === "disciple" ? "🧑" : churchIcon(i)}</div>
        <div class="info">
          <div class="name">${i.focus ? `<span class="star">⭐</span>` : ""}${esc(i.name)}${full ? ` <span class="tag trained-tag">Fully trained</span>` : ""}${isHouseChurch(i) ? ` <span class="tag house-tag">House church</span>` : ""}</div>
          <div class="meta">${hasLocation(i) ? esc(i.place || "Pinned") : `<span class="no-loc">📍 Location not set</span>`} · ${i.role === "building" ? "Building" : "Blessing"} · ${followupLabel(i)}</div>
          ${i.phone ? `<div class="meta ${staleText(i) ? "stale" : ""}">💬 ${esc(textedLabel(i))}</div>` : ""}
          ${i.type === "disciple" ? `
            <div class="meta soil-line"><i class="soil-chip ${statusClass(i)}"></i>${esc(SOILS[i.soil || "unset"].soil)}</div>
            <div class="mini-bar" title="${done} of ${TRAINING.length} tools"><span style="width:${(done / TRAINING.length) * 100}%"></span></div>
            <div class="meta mini-bar-label">${done}/${TRAINING.length} tools trained</div>` : ""}
        </div>
        <div class="health ${statusClass(i)}"></div>
      </div>`; }
    wrap.querySelectorAll(".card").forEach(c =>
      c.addEventListener("click", () => openDetail(c.dataset.id)));
    const strip = $("#goal-strip");
    if (strip) strip.onclick = openGoals;
  }

  // ---------- soil panel (disciples only) ----------
  function soilPanel(item) {
    const key = item.soil || "unset";
    const s = SOILS[key];
    return `
      <div class="soil-panel">
        <div class="soil-head">
          <span class="soil-lamp dot-${statusKey(item)}"></span>
          <div>
            <div class="soil-light">${esc(s.light)}</div>
            <div class="soil-name">${esc(s.soil)}</div>
          </div>
        </div>
        <p class="soil-desc">${esc(s.desc)}</p>
        <div class="soil-ref">Parable of the Sower · Matthew 13:3–23</div>
        <div class="section-label" style="margin-bottom:8px">Change soil</div>
        <div class="soil-picker" id="d-soil">
          ${SOIL_ORDER.map(k => `
            <button data-s="${k}" class="soil-opt ${key === k ? "active" : ""}" title="${esc(SOILS[k].soil)}">
              <span class="soil-lamp dot-${k}"></span>
              <span class="soil-opt-label">${esc(SOILS[k].soil)}</span>
            </button>`).join("")}
        </div>
      </div>`;
  }

  // compact progress banner at the top of the list for whichever target is in view
  function goalStrip() {
    const p = progress();
    const isD = view === "disciples";
    const have = isD ? p.trainedN : p.housesN;
    const goal = isD ? targets.trainedDisciples : targets.houseChurches;
    const label = isD ? "fully trained disciples" : "house churches formed";
    const pct = goal > 0 ? Math.min(100, (have / goal) * 100) : 0;
    return `
      <button class="goal-strip" id="goal-strip">
        <div class="goal-strip-top">
          <span class="goal-strip-label">🎯 ${have} of ${goal} ${label}</span>
          <span class="goal-strip-pct">${Math.round(pct)}%</span>
        </div>
        <div class="bar"><span style="width:${pct}%"></span></div>
      </button>`;
  }

  // ---------- contact / texting ----------
  function contactBlock(item) {
    const name = esc(firstWord(item.name));
    if (!item.phone) {
      return `
        <div class="contact-block">
          <button class="btn" id="d-addphone">💬 Add ${name}'s number to text them</button>
        </div>`;
    }
    return `
      <div class="contact-block">
        <a class="btn primary text-btn" id="d-text" href="${esc(smsHref(item.phone))}">💬 Text ${name}</a>
        <div class="contact-meta">
          <span class="contact-num">${esc(item.phone)}</span>
          <span class="contact-when ${staleText(item) ? "stale" : ""}">${esc(textedLabel(item))}</span>
        </div>
        <div class="contact-actions">
          <button class="link-btn" id="d-texted-now">Mark texted today</button>
          <label class="link-btn-label">or set date
            <input type="date" id="d-texted-date" value="${esc(item.lastTexted || "")}" />
          </label>
        </div>
      </div>`;
  }

  // more than three weeks without a text is worth flagging
  function staleText(item) {
    if (!item.phone) return false;
    if (!item.lastTexted) return true;
    return daysSince(item.lastTexted) > 21;
  }

  // ---------- target 1 panel: the training toolset ----------
  function trainingPanel(item) {
    const done = trainedCount(item), total = TRAINING.length, full = done === total;
    const pct = (done / total) * 100;
    return `
      <div class="goal-panel ${full ? "complete" : ""}">
        <div class="goal-panel-head">
          <div>
            <div class="goal-panel-title">${full ? "✅ Fully trained" : "Training toolset"}</div>
            <div class="goal-panel-sub">${done} of ${total} tools handed over</div>
          </div>
          <div class="goal-ring" style="--pct:${pct}"><span>${done}/${total}</span></div>
        </div>
        <div class="bar"><span style="width:${pct}%"></span></div>
        <div class="tool-list" id="d-training">
          ${TRAINING.map(m => {
            const on = !!(item.training || {})[m.id];
            return `
            <button class="tool ${on ? "on" : ""}" data-m="${m.id}">
              <span class="tool-check">${on ? "✓" : ""}</span>
              <span class="tool-text">
                <span class="tool-label">${esc(m.label)}</span>
                <span class="tool-hint">${esc(m.hint)}</span>
              </span>
            </button>`;
          }).join("")}
        </div>
      </div>`;
  }

  // ---------- target 2 panel: house church ----------
  function churchPanel(item) {
    const house = isHouseChurch(item);
    return `
      <div class="goal-panel ${house ? "complete" : ""}">
        <div class="goal-panel-head">
          <div>
            <div class="goal-panel-title">${house ? "🏠 House church formed" : "⛪️ Established church"}</div>
            <div class="goal-panel-sub">${house
              ? (item.formed ? `Formed ${esc(monthLabel(item.formed))}` : "Formed — date not set")
              : "Not counted toward the house-church target"}</div>
          </div>
        </div>
        <div class="seg" id="d-kind" style="margin-top:12px">
          ${Object.entries(CHURCH_KINDS).map(([k, v]) =>
            `<button data-k="${k}" class="${(item.kind || "established") === k ? "active" : ""}">${v.icon} ${v.label}</button>`).join("")}
        </div>
        ${house ? `
          <label style="margin-top:12px">Month formed</label>
          <input type="month" id="d-formed" value="${esc(item.formed || "")}" />` : ""}
      </div>`;
  }

  function monthLabel(ym) {
    if (!ym) return "";
    const [y, m] = ym.split("-");
    const names = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    return `${names[parseInt(m, 10) - 1] || ""} ${y}`.trim();
  }

  // ---------- detail sheet ----------
  function openDetail(id) {
    const item = data.find(d => d.id === id);
    if (!item) return;
    const lc = lastCheckin(item);
    const cks = [...(item.checkins || [])].sort((a, b) => b.date.localeCompare(a.date));
    $("#sheet-content").innerHTML = `
      <h2>${item.focus ? `<span class="star">⭐</span>` : ""}${esc(item.name)}</h2>
      <div class="sub">${hasLocation(item) ? esc(item.place || "Pinned on the map") : "📍 No location set yet"}</div>
      ${item.type === "disciple" ? `
        <button class="focus-toggle ${item.focus ? "on" : ""}" id="d-focus">
          ${item.focus ? "⭐ Focus disciple" : "☆ Make a focus disciple"}
        </button>` : ""}
      ${!hasLocation(item) ? `
        <button class="btn locate-btn" id="d-locate">📍 Set ${esc(firstWord(item.name))}'s location</button>` : ""}
      ${contactBlock(item)}
      <div class="badges">
        <span class="badge ${item.role}">${item.role === "building" ? "🔨 Building" : "🕊️ Blessing"}</span>
        ${item.type === "disciple"
          ? `<span class="badge h-${statusKey(item)}">● ${esc(SOILS[item.soil || "unset"].light)}</span>`
          : `<span class="badge h-${item.health}">● ${HEALTH_LABEL[item.health] || "Unknown"}</span>`}
      </div>
      ${item.type === "disciple" ? soilPanel(item) : ""}
      ${item.type === "disciple" ? trainingPanel(item) : churchPanel(item)}
      <div class="stat-row">
        <div class="stat"><div class="v">${(item.checkins || []).length}</div><div class="k">Check-ins</div></div>
        <div class="stat"><div class="v">${lc ? daysSince(lc.date) + "d" : "—"}</div><div class="k">Since last</div></div>
        <div class="stat"><div class="v">${item.lastTexted ? daysSince(item.lastTexted) + "d" : "—"}</div><div class="k">Since text</div></div>
      </div>
      ${item.notes ? `<div class="notes-block">${esc(item.notes)}</div>` : ""}
      <div class="section-label">History</div>
      <div class="timeline">
        ${cks.length ? cks.map(c => `
          <div class="checkin"><div class="date">${esc(c.date)}</div><div class="note">${esc(c.note)}</div></div>`).join("")
        : `<div class="empty-msg" style="padding:16px">No history yet.</div>`}
      </div>
      <div class="btn-row">
        <button class="btn primary" id="d-checkin">✓ Check in</button>
        <button class="btn" id="d-edit">Edit</button>
        <button class="btn danger" id="d-delete">Delete</button>
      </div>`;
    openSheet("#sheet");
    const focusBtn = $("#d-focus");
    if (focusBtn) focusBtn.onclick = () => {
      item.focus = !item.focus;
      save(); renderMarkers(); renderList(); openDetail(item.id);
    };
    const locateBtn = $("#d-locate");
    if (locateBtn) locateBtn.onclick = () => { closeSheets(); openForm(item.id); };

    const addPhone = $("#d-addphone");
    if (addPhone) addPhone.onclick = () => { closeSheets(); openForm(item.id); };
    const textBtn = $("#d-text");
    if (textBtn) textBtn.onclick = () => {
      // record before the phone hands off to Messages
      markTexted(item);
      setTimeout(() => openDetail(item.id), 400);
    };
    const textedNow = $("#d-texted-now");
    if (textedNow) textedNow.onclick = () => { markTexted(item); openDetail(item.id); };
    const textedDate = $("#d-texted-date");
    if (textedDate) textedDate.onchange = () => {
      item.lastTexted = textedDate.value || null;
      save(); renderList(); openDetail(item.id);
    };
    if (item.type === "disciple") {
      $("#d-soil").querySelectorAll(".soil-opt").forEach(b => b.onclick = () => {
        item.soil = b.dataset.s;
        save(); renderMarkers(); renderList();
        openDetail(item.id); // re-render with the new soil in place
      });
      // tap a tool to mark it trained
      $("#d-training").querySelectorAll(".tool").forEach(b => b.onclick = () => {
        const wasFull = isFullyTrained(item);
        item.training = item.training || {};
        const id = b.dataset.m;
        if (item.training[id]) delete item.training[id]; else item.training[id] = true;
        save(); renderMarkers(); renderList();
        const nowFull = isFullyTrained(item);
        openDetail(item.id);
        if (!wasFull && nowFull) celebrate();
      });
    } else {
      $("#d-kind").querySelectorAll("button").forEach(b => b.onclick = () => {
        const wasHouse = isHouseChurch(item);
        item.kind = b.dataset.k;
        if (item.kind === "house" && !item.formed) item.formed = new Date().toISOString().slice(0, 7);
        save(); renderMarkers(); renderList();
        openDetail(item.id);
        if (!wasHouse && isHouseChurch(item)) celebrate();
      });
      const formed = $("#d-formed");
      if (formed) formed.onchange = () => { item.formed = formed.value; save(); renderList(); };
    }
    $("#d-checkin").onclick = () => { closeSheets(); openCheckinForm(item.id); };
    $("#d-edit").onclick = () => { closeSheets(); openForm(item.id); };
    $("#d-delete").onclick = () => {
      if (confirm(`Delete ${item.name}?`)) {
        data = data.filter(d => d.id !== item.id);
        save(); closeSheets(); refresh();
      }
    };
  }

  // ---------- targets sheet ----------
  function openGoals() {
    const p = progress();
    $("#goals-content").innerHTML = `
      <h2>Targets</h2>
      <div class="sub">The two things you are actually moving toward.</div>

      <div id="goal-cards">${goalCards()}</div>

      <div class="section-label">House churches (${p.housesN})</div>
      <div class="timeline">
        ${p.houses.length ? p.houses.map(c => `
          <div class="goal-row" data-id="${c.id}">
            <span class="goal-row-name">🏠 ${esc(c.name)}</span>
            <span class="goal-row-meta">${esc(c.formed ? monthLabel(c.formed) : c.place || "")}</span>
          </div>`).join("")
        : `<div class="empty-msg" style="padding:14px">None yet. Mark a church as a house church to count it.</div>`}
      </div>

      <div class="section-label">Closest to fully trained</div>
      <div class="timeline">
        ${p.trained.map(d => `
          <div class="goal-row done" data-id="${d.id}">
            <span class="goal-row-name">✅ ${esc(d.name)}</span>
            <span class="goal-row-meta">${TRAINING.length}/${TRAINING.length}</span>
          </div>`).join("")}
        ${p.inTraining.length ? p.inTraining.map(({ item, done }) => `
          <div class="goal-row" data-id="${item.id}">
            <span class="goal-row-name">${esc(item.name)}</span>
            <span class="goal-row-bar"><span class="bar"><span style="width:${(done / TRAINING.length) * 100}%"></span></span></span>
            <span class="goal-row-meta">${done}/${TRAINING.length}</span>
          </div>`).join("")
        : (p.trained.length ? "" : `<div class="empty-msg" style="padding:14px">No disciples yet.</div>`)}
      </div>

      <div class="section-label">Adjust targets</div>
      <div class="target-edit">
        <label>House churches</label>
        <input type="number" id="t-houses" min="1" max="999" value="${targets.houseChurches}" />
        <label>Fully trained disciples</label>
        <input type="number" id="t-trained" min="1" max="999" value="${targets.trainedDisciples}" />
      </div>
      <div class="btn-row">
        <button class="btn primary" id="g-close">Done</button>
      </div>`;
    openSheet("#goals-sheet");

    const commit = () => {
      const h = parseInt($("#t-houses").value, 10), t = parseInt($("#t-trained").value, 10);
      if (h > 0) targets.houseChurches = h;
      if (t > 0) targets.trainedDisciples = t;
      saveTargets();
      // refresh just the cards so the open sheet stays put and inputs keep focus
      $("#goal-cards").innerHTML = goalCards();
      renderList();
    };
    $("#t-houses").oninput = commit;
    $("#t-trained").oninput = commit;
    $("#g-close").onclick = () => { commit(); closeSheets(); };
    $("#goals-content").querySelectorAll(".goal-row").forEach(r =>
      r.onclick = () => { closeSheets(); openDetail(r.dataset.id); });
  }

  function goalCards() {
    const p = progress();
    return goalCard("🏠", "House churches formed", p.housesN, targets.houseChurches)
         + goalCard("🎓", "Fully trained disciples", p.trainedN, targets.trainedDisciples);
  }

  function goalCard(icon, label, have, goal) {
    const pct = goal > 0 ? Math.min(100, (have / goal) * 100) : 0;
    const hit = have >= goal;
    return `
      <div class="goal-card ${hit ? "hit" : ""}">
        <div class="goal-card-head">
          <span class="goal-card-icon">${icon}</span>
          <span class="goal-card-label">${label}</span>
        </div>
        <div class="goal-card-num"><b>${have}</b><span>of ${goal}</span></div>
        <div class="bar big"><span style="width:${pct}%"></span></div>
        <div class="goal-card-foot">${hit ? "🎉 Target reached" : `${goal - have} to go`}</div>
      </div>`;
  }

  // a brief flourish when a target-moving milestone lands
  function celebrate() {
    const el = document.createElement("div");
    el.className = "celebrate";
    el.textContent = "🎉";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }

  // ---------- forms ----------
  function openCheckinForm(id) {
    const item = data.find(d => d.id === id);
    const today = new Date().toISOString().slice(0, 10);
    $("#form-content").innerHTML = `
      <h2>Check in — ${esc(item.name)}</h2>
      <label>Date</label>
      <input type="date" id="f-date" value="${today}" />
      <label>Note</label>
      <textarea id="f-note" placeholder="How are they doing? What did you talk about?"></textarea>
      ${item.type === "disciple" ? `
        <label>Soil today</label>
        <div class="soil-picker" id="f-soil">
          ${SOIL_ORDER.map(k => `
            <button data-s="${k}" class="soil-opt ${(item.soil || "unset") === k ? "active" : ""}">
              <span class="soil-lamp dot-${k}"></span>
              <span class="soil-opt-label">${esc(SOILS[k].soil)}</span>
            </button>`).join("")}
        </div>
        <div class="soil-hint" id="f-soil-hint">${esc(SOILS[item.soil || "unset"].desc)}</div>
      ` : `
        <label>Health</label>
        <div class="seg" id="f-health">
          ${["green", "yellow", "red"].map(h => `<button data-h="${h}" class="${item.health === h ? "active" : ""}">${HEALTH_LABEL[h]}</button>`).join("")}
        </div>
      `}
      <div class="btn-row">
        <button class="btn" id="f-cancel">Cancel</button>
        <button class="btn primary" id="f-save">Save check-in</button>
      </div>`;
    openSheet("#form-sheet");
    let health = item.health, soil = item.soil || "unset";
    if (item.type === "disciple") {
      soilWire("#f-soil", "#f-soil-hint", v => soil = v);
    } else {
      segWire("#f-health", "h", v => health = v);
    }
    $("#f-cancel").onclick = () => closeSheets();
    $("#f-save").onclick = () => {
      item.checkins = item.checkins || [];
      item.checkins.push({ date: $("#f-date").value || today, note: $("#f-note").value.trim() });
      if (item.type === "disciple") item.soil = soil; else item.health = health;
      save(); closeSheets(); refresh(); openDetail(item.id);
    };
  }

  // shared wiring for the four-light soil picker
  function soilWire(sel, hintSel, cb) {
    $(sel).querySelectorAll(".soil-opt").forEach(b => b.onclick = () => {
      $(sel).querySelectorAll(".soil-opt").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      const v = b.dataset.s;
      if (hintSel && $(hintSel)) $(hintSel).textContent = SOILS[v].desc;
      cb(v);
    });
  }

  function openForm(id) {
    const editing = id ? data.find(d => d.id === id) : null;
    const type = editing ? editing.type : (view === "disciples" ? "disciple" : "church");
    // null lat/lng means "no location yet" — don't treat it as a set location
    let loc = editing && hasLocation(editing) ? { lat: editing.lat, lng: editing.lng } : null;
    $("#form-content").innerHTML = `
      <h2>${editing ? "Edit" : "New"} ${type}</h2>
      <label>Name</label>
      <input type="text" id="f-name" placeholder="${type === "disciple" ? "Person's name" : "Church name"}" value="${esc(editing?.name || "")}" />
      <label>Place</label>
      <div class="autocomplete">
        <input type="text" id="f-place" autocomplete="off" placeholder="Start typing a city, church, or address…" value="${esc(editing?.place || "")}" />
        <div class="ac-list" id="f-place-list" hidden></div>
      </div>
      <label>Phone number</label>
      <input type="tel" id="f-phone" inputmode="tel" autocomplete="tel"
             placeholder="+1 555 123 4567" value="${esc(editing?.phone || "")}" />
      <div class="loc-display">Used for the text button — stays on your device.</div>
      <label>Relationship</label>
      <div class="seg" id="f-role">
        <button data-r="building" class="${(!editing || editing.role === "building") ? "active" : ""}">🔨 Building</button>
        <button data-r="blessing" class="${editing?.role === "blessing" ? "active" : ""}">🕊️ Blessing</button>
      </div>
      <div class="loc-display" style="margin-top:4px">${ROLE_LABEL.building} vs ${ROLE_LABEL.blessing}</div>
      ${type === "disciple" ? `
        <label>Soil — what ground are they?</label>
        <div class="soil-picker" id="f-soil">
          ${SOIL_ORDER.map(k => `
            <button data-s="${k}" class="soil-opt ${(editing?.soil || "unset") === k ? "active" : ""}">
              <span class="soil-lamp dot-${k}"></span>
              <span class="soil-opt-label">${esc(SOILS[k].soil)}</span>
            </button>`).join("")}
        </div>
        <div class="soil-hint" id="f-soil-hint">${esc(SOILS[editing?.soil || "unset"].desc)}</div>
        <label>Focus</label>
        <button type="button" class="focus-toggle ${editing?.focus ? "on" : ""}" id="f-focus">
          ${editing?.focus ? "⭐ Focus disciple" : "☆ Not a focus disciple"}
        </button>
      ` : `
        <label>Kind of church</label>
        <div class="seg" id="f-kind">
          ${Object.entries(CHURCH_KINDS).map(([k, v]) =>
            `<button data-k="${k}" class="${(editing?.kind || "established") === k ? "active" : ""}">${v.icon} ${v.label}</button>`).join("")}
        </div>
        <label>Health</label>
        <div class="seg" id="f-health">
          ${["green", "yellow", "red", "gray"].map(h => `<button data-h="${h}" class="${(editing?.health || "gray") === h ? "active" : ""}">${HEALTH_LABEL[h]}</button>`).join("")}
        </div>
      `}
      <label>Notes</label>
      <textarea id="f-notes" placeholder="Background, prayer points, context…">${esc(editing?.notes || "")}</textarea>
      <label>Location</label>
      <button class="btn" id="f-pick">📍 ${loc ? "Adjust pin on map" : "Or tap the map to set it"}</button>
      <div class="loc-display" id="f-loc">${loc ? `<b>${loc.lat.toFixed(3)}, ${loc.lng.toFixed(3)}</b>` : "Not set yet — optional, you can add it later"}</div>
      <div class="btn-row">
        <button class="btn" id="f-cancel">Cancel</button>
        <button class="btn primary" id="f-save">${editing ? "Save changes" : "Add"}</button>
      </div>`;
    openSheet("#form-sheet");

    let role = editing?.role || "building";
    let health = editing?.health || "gray";
    let soil = editing?.soil || "unset";
    segWire("#f-role", "r", v => role = v);
    let kind = editing?.kind || "established";
    let focus = !!editing?.focus;
    if (type === "disciple") {
      soilWire("#f-soil", "#f-soil-hint", v => soil = v);
      const fb = $("#f-focus");
      fb.onclick = () => {
        focus = !focus;
        fb.classList.toggle("on", focus);
        fb.textContent = focus ? "⭐ Focus disciple" : "☆ Not a focus disciple";
      };
    } else {
      segWire("#f-health", "h", v => health = v);
      segWire("#f-kind", "k", v => kind = v);
    }

    // --- place autocomplete: typing a place sets the pin automatically ---
    const placeInput = $("#f-place");
    const acList = $("#f-place-list");
    let acTimer = null, acResults = [], lastQuery = "";

    function setLoc(lat, lng, label) {
      loc = { lat, lng };
      if (label) placeInput.value = label;
      $("#f-loc").innerHTML = `<b>${lat.toFixed(3)}, ${lng.toFixed(3)}</b> · pin set`;
      $("#f-pick").textContent = "📍 Adjust pin on map";
      previewPin(lat, lng);
    }

    function hideAc() { acList.hidden = true; acList.innerHTML = ""; }

    function renderAc(results) {
      acResults = results;
      if (!results.length) { hideAc(); return; }
      acList.innerHTML = results.map((r, i) =>
        `<div class="ac-item" data-i="${i}"><span class="ac-main">${esc(r.main)}</span><span class="ac-sub">${esc(r.sub)}</span></div>`
      ).join("");
      acList.hidden = false;
      acList.querySelectorAll(".ac-item").forEach(el => el.onclick = () => {
        const r = acResults[el.dataset.i];
        setLoc(r.lat, r.lng, r.label);
        hideAc();
      });
    }

    placeInput.addEventListener("input", () => {
      const q = placeInput.value.trim();
      clearTimeout(acTimer);
      if (q.length < 3) { hideAc(); return; }
      acList.hidden = false;
      acList.innerHTML = `<div class="ac-item ac-status">Searching…</div>`;
      acTimer = setTimeout(async () => {
        if (q === lastQuery) return;
        lastQuery = q;
        const results = await geocode(q);
        if (placeInput.value.trim() !== q) return; // stale
        if (!results.length) {
          acList.innerHTML = `<div class="ac-item ac-status">No matches — tap the map instead</div>`;
          acList.hidden = false;
          return;
        }
        renderAc(results);
      }, 450);
    });
    placeInput.addEventListener("blur", () => setTimeout(hideAc, 200));

    $("#f-pick").onclick = () => {
      // hide the sheet while the user taps the map
      $("#form-sheet").classList.remove("open");
      $("#scrim").classList.remove("show");
      showTapHint();
      pickingLocation = async (latlng) => {
        $("#form-sheet").classList.add("open");
        $("#scrim").classList.add("show");
        setLoc(latlng.lat, latlng.lng);
        // fill the place name from the dropped pin, if we can
        if (!placeInput.value.trim()) {
          const label = await reverseGeocode(latlng.lat, latlng.lng);
          if (label && !placeInput.value.trim()) placeInput.value = label;
        }
      };
    };
    $("#f-cancel").onclick = () => { pickingLocation = null; hideTapHint(); clearPreviewPin(); closeSheets(); };
    $("#f-save").onclick = async () => {
      const name = $("#f-name").value.trim();
      if (!name) { $("#f-name").focus(); return; }
      if (!loc) {
        // last chance: resolve whatever they typed into the place field
        const q = placeInput.value.trim();
        if (q.length >= 3) {
          $("#f-save").textContent = "Finding place…";
          const results = await geocode(q);
          $("#f-save").textContent = editing ? "Save changes" : "Add";
          if (results.length) setLoc(results[0].lat, results[0].lng, results[0].label);
        }
      }
      // a location is optional — "not set yet" is a valid state
      const fields = {
        name, place: $("#f-place").value.trim(), role, notes: $("#f-notes").value.trim(),
        phone: $("#f-phone").value.trim(),
        lat: loc ? loc.lat : null, lng: loc ? loc.lng : null,
      };
      if (type === "disciple") {
        fields.soil = soil;
        fields.focus = focus;
        fields.training = editing?.training || {};
      } else {
        fields.health = health;
        fields.kind = kind;
        if (kind === "house") fields.formed = editing?.formed || new Date().toISOString().slice(0, 7);
      }
      if (editing) {
        Object.assign(editing, fields); // lastTexted is untouched by the form
      } else {
        data.push({ id: uid(), type, ...fields, checkins: [] });
      }
      save(); clearPreviewPin(); closeSheets(); refresh();
    };
  }

  // ---------- geocoding (OpenStreetMap / Nominatim) ----------
  const geoCache = new Map();

  async function geocode(query) {
    const key = query.toLowerCase();
    if (geoCache.has(key)) return geoCache.get(key);
    try {
      const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&addressdetails=1&q=" + encodeURIComponent(query);
      const res = await fetch(url, { headers: { "Accept": "application/json" } });
      if (!res.ok) throw new Error(res.status);
      const json = await res.json();
      const out = json.map(r => {
        const parts = r.display_name.split(",").map(s => s.trim());
        return {
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
          main: parts[0],
          sub: parts.slice(1).join(", "),
          label: shortLabel(r),
        };
      });
      geoCache.set(key, out);
      return out;
    } catch (e) {
      return [];
    }
  }

  async function reverseGeocode(lat, lng) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lng}`;
      const res = await fetch(url, { headers: { "Accept": "application/json" } });
      if (!res.ok) throw new Error(res.status);
      return shortLabel(await res.json());
    } catch (e) {
      return null;
    }
  }

  // "Honolulu, HI" / "Tokyo, Japan" rather than the full Nominatim display_name
  function shortLabel(r) {
    const a = r.address || {};
    const city = a.city || a.town || a.village || a.hamlet || a.suburb || a.county;
    const region = a.state || a.province || a.region;
    const country = a.country;
    const isUS = a.country_code === "us";
    const bits = [];
    if (r.name && r.name !== city) bits.push(r.name);
    if (city) bits.push(city);
    if (isUS) { if (region) bits.push(US_ABBR[region] || region); }
    else if (country) bits.push(country);
    return bits.length ? bits.join(", ") : (r.display_name || "").split(",").slice(0, 2).join(", ").trim();
  }

  const US_ABBR = {
    Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA", Colorado: "CO",
    Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID",
    Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS", Kentucky: "KY", Louisiana: "LA",
    Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI", Minnesota: "MN",
    Mississippi: "MS", Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV",
    "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
    "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK", Oregon: "OR",
    Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD",
    Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT", Virginia: "VA", Washington: "WA",
    "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY", "District of Columbia": "DC",
  };

  // a temporary pin so you can see where the resolved place landed
  let previewMarker = null;
  function previewPin(lat, lng) {
    clearPreviewPin();
    previewMarker = L.marker([lat, lng], {
      icon: L.divIcon({ className: "", html: `<div class="pin preview"><span>📍</span></div>`, iconSize: [34, 34], iconAnchor: [8, 32] }),
    }).addTo(map);
    map.setView([lat, lng], Math.max(map.getZoom(), 9), { animate: true });
  }
  function clearPreviewPin() {
    if (previewMarker) { map.removeLayer(previewMarker); previewMarker = null; }
  }

  function segWire(sel, attr, cb) {
    $(sel).querySelectorAll("button").forEach(b => b.onclick = () => {
      $(sel).querySelectorAll("button").forEach(x => x.classList.remove("active"));
      b.classList.add("active"); cb(b.dataset[attr]);
    });
  }

  // ---------- sheets / panels ----------
  function openSheet(sel) {
    closeSheets(true);
    $(sel).classList.add("open");
    $("#scrim").classList.add("show");
  }
  function closeSheets(soft) {
    $("#sheet").classList.remove("open");
    $("#form-sheet").classList.remove("open");
    $("#goals-sheet").classList.remove("open");
    if (!soft) $("#scrim").classList.remove("show");
  }
  $("#scrim").addEventListener("click", () => { pickingLocation = null; hideTapHint(); closeSheets(); });

  function showTapHint() { $("#tap-hint").classList.add("show"); }
  function hideTapHint() { $("#tap-hint").classList.remove("show"); }

  // ---------- view switching ----------
  function setView(v) {
    view = v;
    document.querySelector(".glass-nav").dataset.active = v;
    document.querySelectorAll(".glass-tab").forEach(t => t.classList.toggle("active", t.dataset.view === v));
    $("#page-title").textContent = v === "disciples" ? "Disciples" : "Churches";
    refresh();
  }
  document.querySelectorAll(".glass-tab").forEach(t =>
    t.addEventListener("click", () => setView(t.dataset.view)));

  $("#btn-list").addEventListener("click", () => {
    listOpen = !listOpen;
    $("#list-panel").classList.toggle("open", listOpen);
  });
  $("#btn-add").addEventListener("click", () => openForm(null));
  $("#btn-goals").addEventListener("click", openGoals);

  function updateUnlocatedBanner() {
    const type = view === "disciples" ? "disciple" : "church";
    const missing = data.filter(d => d.type === type && !hasLocation(d));
    let el = $("#unlocated-banner");
    if (!missing.length) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement("button");
      el.id = "unlocated-banner";
      el.className = "unlocated-banner";
      document.querySelector("main").appendChild(el);
      el.onclick = () => { listOpen = true; $("#list-panel").classList.add("open"); };
    }
    el.textContent = `📍 ${missing.map(m => firstWord(m.name)).join(", ")} — location not set`;
  }

  function refresh() { renderMarkers(); renderList(); }
  refresh();

  // ---------- PWA ----------
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
