/* Shepherd — Disciples & Churches tracker */
(() => {
  const STORE_KEY = "shepherd.data.v1";

  // ---------- data ----------
  const seed = () => ([
    { id: uid(), type: "disciple", name: "Sujit Bandari", role: "building", lat: 32.7767, lng: -96.797, place: "Dallas, TX",
      health: "green", notes: "Walking closely; growing in leadership.", checkins: [
        { date: "2026-07-28", note: "Phone call — encouraged, praying through next steps." }] },
    { id: uid(), type: "disciple", name: "Disciple — Honolulu", role: "building", lat: 21.3069, lng: -157.8583, place: "Honolulu, HI",
      health: "yellow", notes: "Part of the Hawaii discipleship cycle.", checkins: [
        { date: "2026-06-15", note: "Met during Hawaii trip." }] },
    { id: uid(), type: "church", name: "Church — Hawaii", role: "building", lat: 21.4389, lng: -158.0001, place: "Oahu, HI",
      health: "green", notes: "Cycle of discipleship & church care in Hawaii.", checkins: [] },
    { id: uid(), type: "church", name: "Church — California", role: "blessing", lat: 34.0522, lng: -118.2437, place: "Los Angeles, CA",
      health: "yellow", notes: "Contributing toward / blessing this work.", checkins: [] },
    { id: uid(), type: "church", name: "Church — Japan", role: "blessing", lat: 35.6762, lng: 139.6503, place: "Tokyo, Japan",
      health: "gray", notes: "Early connection in Japan.", checkins: [] },
  ]);

  function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

  let data = load();
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    const s = seed();
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
    return s;
  }
  function save() { localStorage.setItem(STORE_KEY, JSON.stringify(data)); }

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

  function healthClass(item) {
    return "dot-" + (item.health || "gray");
  }

  function renderMarkers() {
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    const items = data.filter(d => d.type === (view === "disciples" ? "disciple" : "church"));
    items.forEach(item => {
      const icon = L.divIcon({
        className: "",
        html: `<div class="pin ${item.type}"><span>${item.type === "disciple" ? "🧑" : "⛪️"}</span><i class="health-dot ${healthClass(item)}"></i></div>`,
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
    wrap.innerHTML = items.map(i => `
      <div class="card" data-id="${i.id}">
        <div class="avatar ${i.type}">${i.type === "disciple" ? "🧑" : "⛪️"}</div>
        <div class="info">
          <div class="name">${esc(i.name)}</div>
          <div class="meta">${esc(i.place || "")} · ${i.role === "building" ? "Building" : "Blessing"} · ${followupLabel(i)}</div>
        </div>
        <div class="health ${healthClass(i)}" style="background: var(--${i.health === 'gray' ? 'text-dim' : i.health})"></div>
      </div>`).join("");
    wrap.querySelectorAll(".card").forEach(c =>
      c.addEventListener("click", () => openDetail(c.dataset.id)));
  }

  // ---------- detail sheet ----------
  function openDetail(id) {
    const item = data.find(d => d.id === id);
    if (!item) return;
    const lc = lastCheckin(item);
    const cks = [...(item.checkins || [])].sort((a, b) => b.date.localeCompare(a.date));
    $("#sheet-content").innerHTML = `
      <h2>${esc(item.name)}</h2>
      <div class="sub">${esc(item.place || "")}</div>
      <div class="badges">
        <span class="badge ${item.role}">${item.role === "building" ? "🔨 Building" : "🕊️ Blessing"}</span>
        <span class="badge h-${item.health}">● ${HEALTH_LABEL[item.health] || "Unknown"}</span>
      </div>
      <div class="stat-row">
        <div class="stat"><div class="v">${(item.checkins || []).length}</div><div class="k">Check-ins</div></div>
        <div class="stat"><div class="v">${lc ? daysSince(lc.date) + "d" : "—"}</div><div class="k">Since last</div></div>
        <div class="stat"><div class="v">${item.role === "building" ? "High" : "Support"}</div><div class="k">Responsibility</div></div>
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
    $("#d-checkin").onclick = () => { closeSheets(); openCheckinForm(item.id); };
    $("#d-edit").onclick = () => { closeSheets(); openForm(item.id); };
    $("#d-delete").onclick = () => {
      if (confirm(`Delete ${item.name}?`)) {
        data = data.filter(d => d.id !== item.id);
        save(); closeSheets(); refresh();
      }
    };
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
      <label>Health</label>
      <div class="seg" id="f-health">
        ${["green", "yellow", "red"].map(h => `<button data-h="${h}" class="${item.health === h ? "active" : ""}">${HEALTH_LABEL[h]}</button>`).join("")}
      </div>
      <div class="btn-row">
        <button class="btn" id="f-cancel">Cancel</button>
        <button class="btn primary" id="f-save">Save check-in</button>
      </div>`;
    openSheet("#form-sheet");
    let health = item.health;
    $("#f-health").querySelectorAll("button").forEach(b => b.onclick = () => {
      $("#f-health").querySelectorAll("button").forEach(x => x.classList.remove("active"));
      b.classList.add("active"); health = b.dataset.h;
    });
    $("#f-cancel").onclick = closeSheets;
    $("#f-save").onclick = () => {
      item.checkins = item.checkins || [];
      item.checkins.push({ date: $("#f-date").value || today, note: $("#f-note").value.trim() });
      item.health = health;
      save(); closeSheets(); refresh(); openDetail(item.id);
    };
  }

  function openForm(id) {
    const editing = id ? data.find(d => d.id === id) : null;
    const type = editing ? editing.type : (view === "disciples" ? "disciple" : "church");
    let loc = editing ? { lat: editing.lat, lng: editing.lng } : null;
    $("#form-content").innerHTML = `
      <h2>${editing ? "Edit" : "New"} ${type}</h2>
      <label>Name</label>
      <input type="text" id="f-name" placeholder="${type === "disciple" ? "Person's name" : "Church name"}" value="${esc(editing?.name || "")}" />
      <label>Place</label>
      <div class="autocomplete">
        <input type="text" id="f-place" autocomplete="off" placeholder="Start typing a city, church, or address…" value="${esc(editing?.place || "")}" />
        <div class="ac-list" id="f-place-list" hidden></div>
      </div>
      <label>Relationship</label>
      <div class="seg" id="f-role">
        <button data-r="building" class="${(!editing || editing.role === "building") ? "active" : ""}">🔨 Building</button>
        <button data-r="blessing" class="${editing?.role === "blessing" ? "active" : ""}">🕊️ Blessing</button>
      </div>
      <div class="loc-display" style="margin-top:4px">${ROLE_LABEL.building} vs ${ROLE_LABEL.blessing}</div>
      <label>Health</label>
      <div class="seg" id="f-health">
        ${["green", "yellow", "red", "gray"].map(h => `<button data-h="${h}" class="${(editing?.health || "gray") === h ? "active" : ""}">${HEALTH_LABEL[h]}</button>`).join("")}
      </div>
      <label>Notes</label>
      <textarea id="f-notes" placeholder="Background, prayer points, context…">${esc(editing?.notes || "")}</textarea>
      <label>Location</label>
      <button class="btn" id="f-pick">📍 ${loc ? "Adjust pin on map" : "Or tap the map to set it"}</button>
      <div class="loc-display" id="f-loc">${loc ? `<b>${loc.lat.toFixed(3)}, ${loc.lng.toFixed(3)}</b>` : "Not set yet — type a place above"}</div>
      <div class="btn-row">
        <button class="btn" id="f-cancel">Cancel</button>
        <button class="btn primary" id="f-save">${editing ? "Save changes" : "Add"}</button>
      </div>`;
    openSheet("#form-sheet");

    let role = editing?.role || "building";
    let health = editing?.health || "gray";
    segWire("#f-role", "r", v => role = v);
    segWire("#f-health", "h", v => health = v);

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
      if (!loc) { alert("Type a place to search for it, or tap the map to drop a pin."); return; }
      if (editing) {
        Object.assign(editing, { name, place: $("#f-place").value.trim(), role, health, notes: $("#f-notes").value.trim(), lat: loc.lat, lng: loc.lng });
      } else {
        data.push({ id: uid(), type, name, place: $("#f-place").value.trim(), role, health, notes: $("#f-notes").value.trim(), lat: loc.lat, lng: loc.lng, checkins: [] });
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

  function refresh() { renderMarkers(); renderList(); }
  refresh();

  // ---------- PWA ----------
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
