(() => {
  "use strict";

  const PAGE = 24;
  const TABS = ["today", "ai", "robotics", "apis", "favs"];
  const SVGNS = "http://www.w3.org/2000/svg";
  const root = document.documentElement;
  const $ = (id) => document.getElementById(id);
  const reducedMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
  const reduced = () => reducedMQ.matches;

  const ICONS = {
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  };
  function icon(name) {
    const s = document.createElementNS(SVGNS, "svg");
    s.setAttribute("class", "i");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("aria-hidden", "true");
    s.setAttribute("focusable", "false");
    s.innerHTML = ICONS[name];
    return s;
  }

  function el(tag, props, kids) {
    const n = document.createElement(tag);
    for (const k in props || {}) {
      const v = props[k];
      if (k === "text") n.textContent = v;
      else if (k === "class") n.className = v;
      else n.setAttribute(k, v);
    }
    for (const c of kids || []) {
      if (c == null || c === false) continue;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return n;
  }

  // ---- storage (may be blocked or unavailable)
  const memory = {};
  function load(key) {
    try { const v = JSON.parse(localStorage.getItem(key)); if (Array.isArray(v)) return v; } catch (e) { /* fall through */ }
    return memory[key] || [];
  }
  function save(key, arr) {
    memory[key] = arr;
    try { localStorage.setItem(key, JSON.stringify(arr)); } catch (e) { /* ignore */ }
  }

  let items = [];
  const byId = {};
  const likes = new Set(load("likes"));
  const favs = new Set(load("favs"));
  const state = { tab: "today", shown: PAGE, rendered: 0, highlight: "", latest: "" };

  // ---- small helpers
  const pad = (n) => String(n).padStart(2, "0");
  const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const istFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });
  const istToday = () => istFmt.format(new Date());
  function parseDay(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || "");
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function dayLabel(s) {
    const d = parseDay(s);
    if (!d) return "";
    const today = istToday();
    if (s === today) return "Today";
    const y = parseDay(today); y.setDate(y.getDate() - 1);
    if (s === isoDay(y)) return "Yesterday";
    return `${d.getDate()} ${MONTHS[d.getMonth()]}` + (d.getFullYear() !== parseDay(today).getFullYear() ? ` ${d.getFullYear()}` : "");
  }
  const hue = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; };
  const initials = (s) => (String(s || "?").split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("") || "?").toUpperCase();
  const topicLabel = (t) => (t === "ai" ? "AI" : t === "robotics" ? "Robotics" : t);
  const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "#");

  // the page is https, so only https pictures can load; upgrade http and protocol-relative ones
  function imgUrl(item) {
    let u = (item.image || "").trim();
    if (/^\/\//.test(u)) u = "https:" + u;
    else if (/^http:\/\//i.test(u)) u = "https://" + u.slice(7);
    return /^https:\/\//i.test(u) ? u : "";
  }

  // generated artwork for items without a real picture
  function cardSvg(item) {
    const isApi = item.kind === "api";
    const h = hue(isApi ? item.topic : (item.source || item.topic || ""));
    const label = (isApi ? item.topic : item.source || item.topic || "").slice(0, 30)
      .replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c]));
    const art = isApi
      ? '<g fill="none" stroke="#fff" stroke-opacity=".92" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" transform="translate(320 168)"><path d="m-26-34-42 34 42 34"/><path d="m26-34 42 34-42 34"/><path d="M10-46-10 46" stroke-opacity=".55"/></g>'
      : '<g fill="none" stroke="#fff" stroke-opacity=".88" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" transform="translate(320 168)"><rect x="-54" y="-34" width="108" height="76" rx="16"/><path d="M0-34v-26h-18"/><path d="M-72 8h18M54 8h18"/><path d="M-22 4v14M22 4v14"/></g>';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h},72%,44%)"/><stop offset="1" stop-color="hsl(${(h + 48) % 360},72%,26%)"/></linearGradient><radialGradient id="r" cx=".82" cy=".08" r=".95"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><pattern id="p" width="30" height="30" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.6" fill="#fff" fill-opacity=".15"/></pattern></defs><rect width="640" height="400" fill="url(#g)"/><rect width="640" height="400" fill="url(#p)"/><rect width="640" height="400" fill="url(#r)"/>${art}<text x="320" y="300" fill="#fff" fill-opacity=".92" font-family="Inter,system-ui,sans-serif" font-size="26" font-weight="600" text-anchor="middle" letter-spacing=".5">${label}</text></svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }
  function picture(item, cls) {
    const img = el("img", { class: cls, alt: "", loading: "lazy", decoding: "async", referrerpolicy: "no-referrer", src: imgUrl(item) || cardSvg(item) });
    img.addEventListener("error", () => { img.onerror = null; img.src = cardSvg(item); });
    return img;
  }

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove("show"), 2300);
  }

  // ---- theme
  const mode = () => (root.dataset.mode === "dark" ? "dark" : "light");
  function setMode(m, persist) {
    root.dataset.mode = m;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = m === "dark" ? "#070a13" : "#f4f6fb";
    if (persist) { try { localStorage.setItem("theme", m); } catch (e) { /* ignore */ } }
  }
  $("themeBtn").addEventListener("click", () => {
    const next = mode() === "dark" ? "light" : "dark";
    if (document.startViewTransition && !reduced()) document.startViewTransition(() => setMode(next, true));
    else setMode(next, true);
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    let saved = null;
    try { saved = localStorage.getItem("theme"); } catch (err) { /* ignore */ }
    if (!saved) setMode(e.matches ? "dark" : "light", false);
  });

  // ---- data views
  function latestDate() {
    const t = istToday();
    if (items.some((i) => i.added === t)) return t;
    return items.reduce((m, i) => (i.added > m ? i.added : m), "");
  }
  function inTab(item, tab) {
    switch (tab) {
      case "today": return item.added === state.latest;
      case "ai": return item.kind === "news" && item.topic === "ai";
      case "robotics": return item.kind === "news" && item.topic === "robotics";
      case "apis": return item.kind === "api";
      case "favs": return favs.has(item.id);
    }
    return false;
  }
  function current() {
    const q = $("search").value.trim().toLowerCase();
    const cat = $("category").value;
    return items.filter((i) => {
      if (!inTab(i, state.tab)) return false;
      if (state.tab === "apis" && cat && i.topic !== cat) return false;
      return !q || `${i.title} ${i.summary} ${i.source} ${i.topic}`.toLowerCase().includes(q);
    });
  }
  function updateCounts() {
    const c = { today: 0, ai: 0, robotics: 0, apis: 0, favs: 0 };
    items.forEach((i) => { TABS.forEach((t) => { if (inTab(i, t)) c[t]++; }); });
    document.querySelectorAll("#tabs [data-n]").forEach((n) => { n.textContent = String(c[n.dataset.n]); });
    return c;
  }

  // ---- cards
  function actBtn(kind, ic, label, on) {
    const b = el("button", { class: `act ${kind}${on ? " on" : ""}`, type: "button", title: label, "aria-label": label }, [icon(ic)]);
    if (kind !== "share") b.setAttribute("aria-pressed", String(!!on));
    return b;
  }
  function apiFacts(item) {
    const auth = (item.auth || "").trim();
    const https = (item.https || "").trim();
    const cors = (item.cors || "").trim().toLowerCase();
    const facts = [
      !auth || /^no$/i.test(auth) ? ["good", "No auth"] : ["warn", /^apikey$/i.test(auth) ? "API key" : auth],
      /^yes$/i.test(https) ? ["good", "HTTPS"] : /^no$/i.test(https) ? ["bad", "HTTP only"] : ["mute", "HTTPS ?"],
      cors === "yes" ? ["good", "CORS"] : cors === "no" ? ["mute", "No CORS"] : ["mute", "CORS ?"],
    ];
    return el("div", { class: "facts" }, facts.map(([c, t]) => el("span", { class: `fact ${c}`, text: t })));
  }
  function card(item, i) {
    const isApi = item.kind === "api";
    const chips = el("div", { class: "chips" }, [
      el("span", { class: "chip", "data-t": isApi ? "api" : item.topic }, [el("i"), isApi ? item.topic : topicLabel(item.topic)]),
      item.added === istToday() ? el("span", { class: "chip new", text: "New" }) : null,
    ]);
    const meta = el("div", { class: "meta" }, [
      el("span", { class: "av", style: `--h:${hue(item.source || "")}`, text: initials(item.source) }),
      el("span", { class: "src", text: item.source }),
      el("span", { text: "·" }),
      el("time", { text: dayLabel(item.published || item.added) }),
    ]);
    const body = el("div", { class: "body" }, [
      meta,
      el("h3", { class: "title" }, [el("a", { href: safeUrl(item.url), target: "_blank", rel: "noopener noreferrer", text: item.title })]),
      item.summary ? el("p", { class: "summary", text: item.summary }) : null,
      isApi ? apiFacts(item) : null,
    ]);
    const actions = el("div", { class: "actions" }, [
      actBtn("like", "heart", "Like", likes.has(item.id)),
      actBtn("fav", "star", "Add to favourites", favs.has(item.id)),
      actBtn("share", "share", "Share"),
      el("a", { class: "cta", href: safeUrl(item.url), target: "_blank", rel: "noopener noreferrer", "aria-label": `${isApi ? "Open docs for" : "Read"} ${item.title}` }, [isApi ? "Docs" : "Read", icon("arrow")]),
    ]);
    return el("article", { class: "card", "data-id": item.id, id: item.id, style: `--d:${Math.min(i, 8) * 60}ms` }, [
      el("div", { class: "media" }, [picture(item, "pic"), chips]),
      body,
      actions,
    ]);
  }

  // reveal cards as they scroll into view
  const revealer = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); revealer.unobserve(e.target); } });
    }, { threshold: 0.06, rootMargin: "0px 0px -4% 0px" })
    : null;

  const EMPTY_ART = '<svg viewBox="0 0 160 120" aria-hidden="true"><defs><linearGradient id="eg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--accent)"/><stop offset="1" style="stop-color:var(--accent-2)"/></linearGradient></defs><circle cx="80" cy="60" r="48" fill="url(#eg)" opacity=".14"/><rect x="42" y="34" width="76" height="54" rx="13" fill="none" stroke="url(#eg)" stroke-width="3"/><path d="M42 62h22l6 9h20l6-9h22" fill="none" stroke="url(#eg)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="125" cy="30" r="5" fill="url(#eg)"/><circle cx="33" cy="93" r="3" fill="url(#eg)" opacity=".6"/></svg>';
  function emptyState() {
    const q = $("search").value.trim();
    let title = "Nothing here yet";
    let text = "Check back soon, new entries are added most days.";
    let action = null;
    if (q) {
      title = "No matches";
      text = `Nothing in this tab matches “${q}”.`;
      action = el("button", { class: "btn", type: "button", text: "Clear search" });
      action.addEventListener("click", () => { $("search").value = ""; renderList(); $("search").focus(); });
    } else if (state.tab === "favs") {
      title = "No favourites yet";
      text = "Tap the star on any card to save it here, then export your list whenever you like.";
    } else if (state.tab === "today") {
      title = "Nothing new today yet";
      text = "The next entry lands at a random time later today. Browse the other tabs in the meantime.";
    }
    const box = el("div", { class: "empty" }, [el("h3", { text: title }), el("p", { text }), action]);
    box.insertAdjacentHTML("afterbegin", EMPTY_ART);
    return box;
  }

  function updateNote(total) {
    const note = $("note");
    note.textContent = "";
    const b = (n) => el("b", { text: String(n) });
    const noun = (n) => (state.tab === "apis" ? (n === 1 ? "API" : "APIs") : n === 1 ? "story" : "stories");
    if (state.tab === "today") {
      const d = state.latest;
      if (!d) { note.textContent = "No entries yet."; return; }
      const label = d === istToday() ? "Added today" : `Nothing new today yet, latest update ${dayLabel(d)}`;
      note.append(`${label}: `, b(total), ` ${total === 1 ? "entry" : "entries"}`);
    } else if (state.tab === "favs") {
      note.append(b(total), " saved");
    } else {
      note.append(b(total), ` ${noun(total)}`);
    }
  }

  function renderList(opts) {
    const append = !!(opts && opts.append);
    const list = current();
    const grid = $("grid");
    grid.removeAttribute("aria-busy");
    if (!append) { grid.textContent = ""; state.rendered = 0; }
    const upto = Math.min(list.length, state.shown);
    const frag = document.createDocumentFragment();
    for (let i = state.rendered; i < upto; i++) {
      const c = card(list[i], i - state.rendered);
      frag.appendChild(c);
      if (revealer) revealer.observe(c); else c.classList.add("in");
    }
    grid.appendChild(frag);
    state.rendered = upto;
    if (!list.length) grid.appendChild(emptyState());
    $("more").hidden = list.length <= upto;
    $("exportBar").hidden = state.tab !== "favs";
    $("categoryWrap").hidden = state.tab !== "apis";
    updateNote(list.length);
  }

  // ---- tabs
  function placeInk(animate) {
    const tabs = $("tabs"), ink = $("ink");
    const btn = tabs.querySelector('[aria-selected="true"]');
    if (!btn) return;
    ink.style.width = `${btn.offsetWidth}px`;
    ink.style.transform = `translateX(${btn.offsetLeft}px)`;
    if (tabs.scrollWidth > tabs.clientWidth) {
      tabs.scrollTo({ left: btn.offsetLeft - (tabs.clientWidth - btn.offsetWidth) / 2, behavior: animate && !reduced() ? "smooth" : "auto" });
    }
    requestAnimationFrame(() => ink.classList.add("ready"));
  }
  function setTab(tab, fromUser) {
    state.tab = tab;
    document.querySelectorAll("#tabs button").forEach((b) => {
      const on = b.dataset.tab === tab;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
    });
    $("grid").setAttribute("aria-labelledby", `tab-${tab}`);
    placeInk(fromUser);
    renderList();
    if (fromUser) history.replaceState(null, "", `#${tab}`);
  }

  // ---- like / favourite / share
  function toggle(set, id, key) {
    const added = !set.has(id);
    if (added) set.add(id); else set.delete(id);
    save(key, [...set]);
    return added;
  }
  function pop(btn) {
    btn.classList.remove("pop");
    void btn.offsetWidth;
    btn.classList.add("pop");
    setTimeout(() => btn.classList.remove("pop"), 650);
  }
  function shareItem(item) {
    const url = `${location.href.split("#")[0]}#${item.id}`;
    if (navigator.share) navigator.share({ title: item.title, text: item.title, url }).catch(() => {});
    else if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(() => toast("Link copied"), () => window.prompt("Copy this link", url));
    else window.prompt("Copy this link", url);
  }
  $("grid").addEventListener("click", (e) => {
    const b = e.target.closest(".act");
    if (!b) return;
    const cardEl = b.closest(".card");
    const item = cardEl && byId[cardEl.dataset.id];
    if (!item) return;
    if (b.classList.contains("share")) { shareItem(item); return; }
    const isFav = b.classList.contains("fav");
    const on = toggle(isFav ? favs : likes, item.id, isFav ? "favs" : "likes");
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", String(on));
    pop(b);
    if (!isFav) return;
    toast(on ? "Added to favourites" : "Removed from favourites");
    updateCounts();
    if (state.tab === "favs" && !on) {
      cardEl.classList.add("leaving");
      setTimeout(() => {
        cardEl.remove();
        state.rendered = Math.max(0, state.rendered - 1);
        const left = current().length;
        if (!left) renderList(); else updateNote(left);
      }, 320);
    }
  });
  // soft spotlight that follows the pointer
  $("grid").addEventListener("pointermove", (e) => {
    const c = e.target.closest && e.target.closest(".card");
    if (!c || e.pointerType === "touch") return;
    const r = c.getBoundingClientRect();
    c.style.setProperty("--mx", `${e.clientX - r.left}px`);
    c.style.setProperty("--my", `${e.clientY - r.top}px`);
  });

  // ---- export / import
  const favItems = () => [...favs].map((id) => byId[id]).filter(Boolean);
  function download(name, mime, text) {
    const a = el("a", { href: URL.createObjectURL(new Blob([text], { type: mime })), download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function csvCell(v) {
    v = String(v == null ? "" : v);
    if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; // avoid spreadsheet formula injection
    return `"${v.replace(/"/g, '""')}"`;
  }
  function exportAs(kind) {
    const list = favItems();
    if (!list.length) { toast("Nothing to export yet"); return; }
    const stamp = new Date().toISOString().slice(0, 10);
    if (kind === "json") {
      download(`favourites-${stamp}.json`, "application/json", JSON.stringify({ exported: stamp, items: list }, null, 2));
    } else if (kind === "csv") {
      const cols = ["title", "kind", "topic", "source", "published", "added", "url", "summary"];
      const rows = [cols.join(",")].concat(list.map((i) => cols.map((c) => csvCell(i[c])).join(",")));
      download(`favourites-${stamp}.csv`, "text/csv", rows.join("\r\n"));
    } else {
      const md = `# Favourites (${stamp})\n\n` + list.map((i) => `- [${i.title.replace(/([[\]])/g, "\\$1")}](${i.url}) - ${i.source}` + (i.summary ? `\n  ${i.summary}` : "")).join("\n") + "\n";
      download(`favourites-${stamp}.md`, "text/markdown", md);
    }
    toast(`Exported ${list.length} favourite${list.length === 1 ? "" : "s"}`);
  }
  function importFile(file) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        const arr = Array.isArray(data) ? data : data.items;
        let n = 0;
        arr.forEach((x) => {
          const id = typeof x === "string" ? x : x && x.id;
          if (id && byId[id] && !favs.has(id)) { favs.add(id); n++; }
        });
        save("favs", [...favs]);
        updateCounts(); renderList();
        toast(`Imported ${n} favourite${n === 1 ? "" : "s"}`);
      } catch (e) { toast("That file could not be read"); }
    };
    r.readAsText(file);
  }

  // ---- carousel: every news item that has a real picture, newest first (items.json is newest first)
  const car = { i: 0, slides: [], dragged: false };
  const MAX_DOTS = 10;
  const ORIGINS = ["50% 50%", "18% 30%", "82% 38%", "40% 84%", "72% 70%", "28% 62%"];

  function buildCarousel() {
    const box = $("carousel"), hero = $("heroGrid"), track = $("slides");
    box.classList.remove("loading");
    const feat = items.filter((i) => i.kind === "news" && imgUrl(i));
    if (!feat.length) { box.hidden = true; hero.classList.add("single"); return; }
    box.setAttribute("tabindex", "0");
    car.slides = feat.map((it, k) => {
      // the picture is only requested once the slide is near the front (see reveal)
      const img = el("img", { alt: "", referrerpolicy: "no-referrer", draggable: "false", decoding: "async" });
      const node = el("a", { class: "slide", href: safeUrl(it.url), target: "_blank", rel: "noopener noreferrer", draggable: "false", "aria-label": it.title, style: `--o:${ORIGINS[k % ORIGINS.length]}` }, [
        img,
        el("div", { class: "cap" }, [
          el("span", { class: "chip", "data-t": it.topic }, [el("i"), `${topicLabel(it.topic)} · ${it.source}`]),
          el("h2", { text: it.title }),
          el("p", { text: it.summary }),
          el("span", { class: "go" }, ["Read story", icon("arrow")]),
        ]),
      ]);
      const s = { item: it, node, img, started: false };
      img.addEventListener("error", () => drop(s)); // no picture, no slide
      track.appendChild(node);
      return s;
    });
    $("prev").addEventListener("click", () => go(car.i - 1));
    $("next").addEventListener("click", () => go(car.i + 1));
    // the progress bar is the autoplay timer: when it fills, move on
    $("bar").firstElementChild.addEventListener("animationend", () => go(car.i + 1));
    let startX = null;
    box.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); go(car.i + (e.key === "ArrowRight" ? 1 : -1)); }
    });
    box.addEventListener("pointerdown", (e) => { startX = e.clientX; car.dragged = false; });
    box.addEventListener("pointerup", (e) => {
      if (startX !== null && Math.abs(e.clientX - startX) > 40) { car.dragged = true; go(car.i + (e.clientX < startX ? 1 : -1)); }
      startX = null;
    });
    box.addEventListener("pointercancel", () => { startX = null; });
    // a swipe must not also open the article under the finger
    box.addEventListener("click", (e) => { if (car.dragged) { e.preventDefault(); car.dragged = false; } }, true);
    renderDots();
    go(0);
  }
  function reveal(s) {
    if (s && !s.started) { s.started = true; s.img.src = imgUrl(s.item); }
  }
  function drop(s) {
    const k = car.slides.indexOf(s);
    if (k === -1) return;
    car.slides.splice(k, 1);
    s.node.remove();
    if (!car.slides.length) { $("carousel").hidden = true; $("heroGrid").classList.add("single"); return; }
    if (k < car.i) car.i--;
    renderDots();
    go(car.i);
  }
  function renderDots() {
    const box = $("dots"), n = car.slides.length;
    box.textContent = "";
    $("prev").hidden = $("next").hidden = n < 2;
    if (n < 2) return;
    if (n > MAX_DOTS) { box.appendChild(el("span", { class: "pill" })); return; }
    car.slides.forEach((_, k) => {
      const d = el("button", { type: "button", "aria-label": `Go to slide ${k + 1}` });
      d.addEventListener("click", () => go(k));
      box.appendChild(d);
    });
  }
  function restartBar() {
    const bar = $("bar");
    bar.classList.remove("run");
    if (car.slides.length < 2 || reduced()) return;
    void bar.offsetWidth;
    bar.classList.add("run");
  }
  function go(i) {
    const n = car.slides.length;
    if (!n) return;
    car.i = ((i % n) + n) % n;
    $("slides").style.transform = `translateX(-${car.i * 100}%)`;
    reveal(car.slides[car.i]); reveal(car.slides[(car.i + 1) % n]); reveal(car.slides[(car.i + n - 1) % n]);
    car.slides.forEach((s, k) => { // only the visible slide is a tab stop
      s.node.setAttribute("tabindex", k === car.i ? "0" : "-1");
      s.node.setAttribute("aria-hidden", String(k !== car.i));
      s.node.classList.toggle("is-active", k === car.i);
    });
    Array.from($("dots").children).forEach((d, k) => {
      if (d.tagName === "BUTTON") d.setAttribute("aria-current", String(k === car.i));
      else d.textContent = `${car.i + 1} / ${n}`;
    });
    restartBar();
  }

  // ---- hero numbers
  function countUp(node, to) {
    if (reduced() || to === 0) { node.textContent = String(to); return; }
    const t0 = performance.now(), dur = 1000;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      node.textContent = String(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function fillHero() {
    const today = istToday();
    countUp($("statNews"), items.filter((i) => i.kind === "news").length);
    countUp($("statApis"), items.filter((i) => i.kind === "api").length);
    countUp($("statToday"), items.filter((i) => i.added === today).length);
    const dot = $("updatedDot"), txt = $("updatedText");
    if (!state.latest) { txt.textContent = "Feed starting soon"; return; }
    const live = state.latest === today;
    dot.classList.toggle("live", live);
    txt.textContent = live ? "Updated today" : `Last updated ${dayLabel(state.latest)}`;
  }

  // ---- page chrome: scroll progress, sticky bar, back to top
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const y = window.scrollY, max = root.scrollHeight - window.innerHeight;
      $("scrollLine").style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
      $("toTop").classList.toggle("show", y > 700);
      $("tabbar").classList.toggle("stuck", $("tabbar").getBoundingClientRect().top <= 0.5);
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => { onScroll(); placeInk(false); });
  const toTop = () => window.scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" });
  $("toTop").addEventListener("click", toTop);
  $("brand").addEventListener("click", (e) => { e.preventDefault(); toTop(); });

  // ---- search
  const search = $("search");
  search.addEventListener("input", () => { state.shown = PAGE; renderList(); });
  $("clearSearch").addEventListener("click", () => { search.value = ""; state.shown = PAGE; renderList(); search.focus(); });
  document.addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || ""));
    if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); search.focus(); search.select(); }
    else if (e.key === "Escape" && e.target === search) { search.value = ""; state.shown = PAGE; renderList(); search.blur(); }
  });
  $("category").addEventListener("change", () => { state.shown = PAGE; renderList(); });
  $("more").addEventListener("click", () => { state.shown += PAGE; renderList({ append: true }); });
  $("exJson").addEventListener("click", () => exportAs("json"));
  $("exCsv").addEventListener("click", () => exportAs("csv"));
  $("exMd").addEventListener("click", () => exportAs("md"));
  $("importFile").addEventListener("change", (e) => { if (e.target.files[0]) importFile(e.target.files[0]); e.target.value = ""; });

  // ---- startup
  function fillCategories() {
    const cats = [...new Set(items.filter((i) => i.kind === "api").map((i) => i.topic))].sort();
    const sel = $("category");
    sel.appendChild(el("option", { value: "", text: "All categories" }));
    cats.forEach((c) => sel.appendChild(el("option", { value: c, text: c })));
  }
  // #ai opens a tab, #<item id> opens the tab that holds that card and highlights it
  function applyHash() {
    state.shown = PAGE; state.highlight = "";
    const h = decodeURIComponent(location.hash.slice(1));
    if (TABS.includes(h)) state.tab = h;
    else if (byId[h]) {
      const it = byId[h];
      state.highlight = h;
      state.tab = it.kind === "api" ? "apis" : it.topic;
      state.shown = Math.max(PAGE, items.filter((x) => inTab(x, state.tab)).indexOf(it) + 1);
    }
    setTab(state.tab, false);
    if (state.highlight) {
      const t = document.getElementById(state.highlight);
      if (t) { t.classList.add("hl"); t.scrollIntoView({ block: "center" }); }
    }
  }

  function init(data) {
    items = Array.isArray(data) ? data : [];
    items.forEach((i) => { byId[i.id] = i; });
    state.latest = latestDate();
    fillCategories();
    document.querySelectorAll("#tabs button").forEach((b) => b.addEventListener("click", () => {
      state.shown = PAGE; state.highlight = "";
      setTab(b.dataset.tab, true);
    }));
    // arrow keys move between tabs (the other tabs are skipped by Tab, per the ARIA tabs pattern)
    $("tabs").addEventListener("keydown", (e) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
      const btns = [...document.querySelectorAll("#tabs button")];
      let i = btns.indexOf(document.activeElement);
      if (i < 0) i = btns.findIndex((b) => b.getAttribute("aria-selected") === "true");
      i = e.key === "Home" ? 0 : e.key === "End" ? btns.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + btns.length) % btns.length;
      e.preventDefault();
      btns[i].focus();
      btns[i].click();
    });
    // stop the background animation while the hero is scrolled out of view
    if ("IntersectionObserver" in window) {
      const hero = document.querySelector(".hero");
      new IntersectionObserver(([en]) => hero.classList.toggle("offscreen", !en.isIntersecting)).observe(hero);
    }
    window.addEventListener("hashchange", applyHash);
    fillHero();
    buildCarousel();
    updateCounts();
    applyHash();
    onScroll();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => placeInk(false));
  }
  function showError() {
    $("carousel").classList.remove("loading");
    $("carousel").hidden = true;
    $("heroGrid").classList.add("single");
    const grid = $("grid");
    grid.removeAttribute("aria-busy");
    grid.textContent = "";
    const retry = el("button", { class: "btn primary", type: "button", text: "Try again" });
    retry.addEventListener("click", () => location.reload());
    const box = el("div", { class: "empty" }, [el("h3", { text: "Couldn't load the feed" }), el("p", { text: "Check your connection and try again." }), retry]);
    box.insertAdjacentHTML("afterbegin", EMPTY_ART);
    grid.appendChild(box);
    $("note").textContent = "";
  }

  fetch("data/items.json", { cache: "no-cache" })
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then(init)
    .catch((e) => { console.error(e); showError(); });
})();
