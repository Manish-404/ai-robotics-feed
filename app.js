(function () {
  "use strict";

  var PAGE = 24;
  var TABS = ["today", "ai", "robotics", "apis", "favs"];
  var $ = function (id) { return document.getElementById(id); };

  // ---- safe storage (may be blocked or unavailable)
  var memory = {};
  function load(key) {
    try { var v = JSON.parse(localStorage.getItem(key)); if (Array.isArray(v)) return v; } catch (e) {}
    return memory[key] || [];
  }
  function save(key, arr) {
    memory[key] = arr;
    try { localStorage.setItem(key, JSON.stringify(arr)); } catch (e) {}
  }

  var items = [];
  var byId = {};
  var likes = load("likes");
  var favs = load("favs");
  var state = { tab: "today", shown: PAGE, highlight: "" };

  // ---- helpers
  function el(tag, props, kids) {
    var n = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      if (k === "text") n.textContent = props[k];
      else if (k === "class") n.className = props[k];
      else n.setAttribute(k, props[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove("show"); }, 2200);
  }
  function istToday() {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  }
  function hue(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
  function cardSvg(item) {
    var h = hue(item.topic || item.title), label = (item.kind === "api" ? "API" : (item.topic || "").toUpperCase());
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="hsl(' + h + ',70%,38%)"/><stop offset="1" stop-color="hsl(' + ((h + 50) % 360) + ',70%,24%)"/></linearGradient></defs>' +
      '<rect width="640" height="360" fill="url(#g)"/><g fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="6">' +
      '<circle cx="320" cy="150" r="52"/><path d="M296 150h48M320 126v48"/></g>' +
      '<text x="320" y="270" fill="#fff" fill-opacity=".85" font-family="sans-serif" font-size="30" text-anchor="middle">' +
      label.replace(/[<>&]/g, "").slice(0, 28) + '</text></svg>';
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }
  function safeImg(item) {
    return /^https:\/\//i.test(item.image || "") ? item.image : cardSvg(item);
  }
  function picture(item, cls) {
    var img = el("img", { "class": cls, alt: "", loading: "lazy", referrerpolicy: "no-referrer", src: safeImg(item) });
    img.addEventListener("error", function () { img.onerror = null; img.src = cardSvg(item); });
    return img;
  }
  function safeUrl(u) { return /^https?:\/\//i.test(u || "") ? u : "#"; }

  // ---- data views
  function inTab(item) {
    switch (state.tab) {
      case "today": return item.added === latestDate();
      case "ai": return item.kind === "news" && item.topic === "ai";
      case "robotics": return item.kind === "news" && item.topic === "robotics";
      case "apis": return item.kind === "api";
      case "favs": return favs.indexOf(item.id) !== -1;
    }
    return false;
  }
  function latestDate() {
    var t = istToday();
    if (items.some(function (i) { return i.added === t; })) return t;
    return items.reduce(function (m, i) { return i.added > m ? i.added : m; }, "");
  }
  function current() {
    var q = $("search").value.trim().toLowerCase(), cat = $("category").value;
    return items.filter(function (i) {
      if (!inTab(i)) return false;
      if (state.tab === "apis" && cat && i.topic !== cat) return false;
      return !q || (i.title + " " + i.summary + " " + i.source + " " + i.topic).toLowerCase().indexOf(q) !== -1;
    });
  }

  // ---- rendering
  function card(item) {
    var liked = likes.indexOf(item.id) !== -1, faved = favs.indexOf(item.id) !== -1;
    var meta = el("div", { "class": "meta" }, [
      el("span", { "class": "chip", text: item.kind === "api" ? item.topic : (item.topic === "ai" ? "AI" : "Robotics") }),
      el("span", { text: item.source + " · " + (item.published || item.added) })
    ]);
    if (item.kind === "api") {
      meta.appendChild(el("div", { text: "Auth: " + (item.auth || "?") + " · HTTPS: " + (item.https || "?") + " · CORS: " + (item.cors || "?") }));
    }
    var a = el("a", { href: safeUrl(item.url), target: "_blank", rel: "noopener noreferrer", text: item.title });
    var body = el("div", { "class": "body" }, [el("h3", {}, [a]), el("p", { text: item.summary }), meta]);

    var like = el("button", { "class": "like" + (liked ? " on" : ""), "aria-pressed": String(liked), "aria-label": "Like", text: (liked ? "♥" : "♡") + " Like" });
    var share = el("button", { "aria-label": "Share", text: "Share" });
    var fav = el("button", { "class": "fav" + (faved ? " on" : ""), "aria-pressed": String(faved), "aria-label": "Favourite", text: (faved ? "★" : "☆") + " Favourite" });
    like.addEventListener("click", function () { toggle(likes, item.id, "likes"); render(); });
    fav.addEventListener("click", function () {
      var added = toggle(favs, item.id, "favs"); toast(added ? "Added to favourites" : "Removed from favourites"); render();
    });
    share.addEventListener("click", function () { shareItem(item); });

    var c = el("article", { "class": "card" + (state.highlight === item.id ? " hl" : ""), id: item.id }, [
      picture(item, "pic"), body, el("div", { "class": "actions" }, [like, share, fav])
    ]);
    return c;
  }
  function toggle(arr, id, key) {
    var i = arr.indexOf(id), added = i === -1;
    if (added) arr.push(id); else arr.splice(i, 1);
    save(key, arr);
    return added;
  }
  function render() {
    var list = current();
    var grid = $("grid"); grid.textContent = "";
    list.slice(0, state.shown).forEach(function (i) { grid.appendChild(card(i)); });
    $("more").hidden = list.length <= state.shown;
    $("favCount").textContent = String(favs.length);
    $("exportBar").hidden = state.tab !== "favs";
    $("category").hidden = state.tab !== "apis";
    var note = list.length + " item" + (list.length === 1 ? "" : "s");
    if (state.tab === "today") {
      var d = latestDate();
      note = d ? (d === istToday() ? "Added today (" + d + "): " : "Nothing new today yet. Latest update (" + d + "): ") + note : "No items yet.";
    }
    if (state.tab === "favs" && !favs.length) note = "No favourites yet. Use the Favourite button on any card.";
    $("note").textContent = note;
    Array.prototype.forEach.call(document.querySelectorAll("#tabs button"), function (b) {
      b.setAttribute("aria-selected", String(b.getAttribute("data-tab") === state.tab));
    });
  }
  function setTab(tab) {
    state.tab = tab; state.shown = PAGE; state.highlight = ""; render();
  }

  // ---- sharing
  function shareItem(item) {
    var url = location.href.split("#")[0] + "#" + item.id;
    if (navigator.share) {
      navigator.share({ title: item.title, text: item.title, url: url }).catch(function () {});
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { toast("Link copied"); }, function () { window.prompt("Copy this link", url); });
    } else {
      window.prompt("Copy this link", url);
    }
  }

  // ---- export / import
  function favItems() { return favs.map(function (id) { return byId[id]; }).filter(Boolean); }
  function download(name, mime, text) {
    var a = el("a", { href: URL.createObjectURL(new Blob([text], { type: mime })), download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  function csvCell(v) {
    v = String(v == null ? "" : v);
    if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;  // avoid spreadsheet formula injection
    return '"' + v.replace(/"/g, '""') + '"';
  }
  function exportAs(kind) {
    var list = favItems();
    if (!list.length) { toast("Nothing to export yet"); return; }
    var stamp = new Date().toISOString().slice(0, 10);
    if (kind === "json") {
      download("favourites-" + stamp + ".json", "application/json", JSON.stringify({ exported: stamp, items: list }, null, 2));
    } else if (kind === "csv") {
      var cols = ["title", "kind", "topic", "source", "published", "added", "url", "summary"];
      var rows = [cols.join(",")].concat(list.map(function (i) { return cols.map(function (c) { return csvCell(i[c]); }).join(","); }));
      download("favourites-" + stamp + ".csv", "text/csv", rows.join("\r\n"));
    } else {
      var md = "# Favourites (" + stamp + ")\n\n" + list.map(function (i) {
        return "- [" + i.title.replace(/([\[\]])/g, "\\$1") + "](" + i.url + ") - " + i.source + (i.summary ? "\n  " + i.summary : "");
      }).join("\n") + "\n";
      download("favourites-" + stamp + ".md", "text/markdown", md);
    }
  }
  function importFile(file) {
    var r = new FileReader();
    r.onload = function () {
      try {
        var data = JSON.parse(r.result), arr = Array.isArray(data) ? data : data.items;
        var n = 0;
        arr.forEach(function (x) {
          var id = typeof x === "string" ? x : x && x.id;
          if (id && byId[id] && favs.indexOf(id) === -1) { favs.push(id); n++; }
        });
        save("favs", favs); render(); toast("Imported " + n + " favourite" + (n === 1 ? "" : "s"));
      } catch (e) { toast("That file could not be read"); }
    };
    r.readAsText(file);
  }

  // ---- carousel
  var car = { i: 0, n: 0, timer: null };
  function buildCarousel() {
    var d = latestDate();
    var feat = items.filter(function (i) { return i.added === d && i.kind === "news"; });
    if (feat.length < 3) feat = feat.concat(items.filter(function (i) { return i.added !== d && i.kind === "news" && /^https:/.test(i.image || ""); }));
    feat = feat.sort(function (a, b) { return (/^https:/.test(b.image || "") ? 1 : 0) - (/^https:/.test(a.image || "") ? 1 : 0); }).slice(0, 6);
    if (!feat.length) return;
    $("carousel").hidden = false;
    car.n = feat.length;
    var slides = $("slides"), dots = $("dots");
    feat.forEach(function (it, idx) {
      var s = el("a", { "class": "slide", href: safeUrl(it.url), target: "_blank", rel: "noopener noreferrer", "aria-label": it.title }, [
        picture(it, ""), el("div", { "class": "cap" }, [el("h2", { text: it.title }), el("p", { text: it.summary })])
      ]);
      slides.appendChild(s);
      var dot = el("button", { "aria-label": "Go to slide " + (idx + 1) });
      dot.addEventListener("click", function () { go(idx); });
      dots.appendChild(dot);
    });
    $("prev").addEventListener("click", function () { go(car.i - 1); });
    $("next").addEventListener("click", function () { go(car.i + 1); });
    var box = $("carousel"), startX = null;
    box.addEventListener("mouseenter", stop); box.addEventListener("mouseleave", play);
    box.addEventListener("focusin", stop); box.addEventListener("focusout", play);
    box.addEventListener("pointerdown", function (e) { startX = e.clientX; });
    box.addEventListener("pointerup", function (e) {
      if (startX !== null && Math.abs(e.clientX - startX) > 40) go(car.i + (e.clientX < startX ? 1 : -1));
      startX = null;
    });
    go(0); play();
  }
  function go(i) {
    car.i = (i + car.n) % car.n;
    $("slides").style.transform = "translateX(-" + car.i * 100 + "%)";
    Array.prototype.forEach.call($("dots").children, function (d, k) { d.setAttribute("aria-current", String(k === car.i)); });
  }
  function play() {
    stop();
    if (car.n > 1 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) car.timer = setInterval(function () { go(car.i + 1); }, 5500);
  }
  function stop() { clearInterval(car.timer); }

  // ---- startup
  function fillCategories() {
    var cats = {};
    items.forEach(function (i) { if (i.kind === "api") cats[i.topic] = 1; });
    var sel = $("category");
    sel.appendChild(el("option", { value: "", text: "All categories" }));
    Object.keys(cats).sort().forEach(function (c) { sel.appendChild(el("option", { value: c, text: c })); });
  }
  function fromHash() {
    var h = decodeURIComponent(location.hash.slice(1));
    if (!h) return;
    if (TABS.indexOf(h) !== -1) { state.tab = h; return; }
    var it = byId[h];
    if (!it) return;
    state.highlight = h;
    state.tab = it.kind === "api" ? "apis" : it.topic;
    var idx = items.filter(inTab).indexOf(it);
    state.shown = Math.max(PAGE, idx + 1);
  }

  function init(data) {
    items = Array.isArray(data) ? data : [];
    items.forEach(function (i) { byId[i.id] = i; });
    fillCategories();
    Array.prototype.forEach.call(document.querySelectorAll("#tabs button"), function (b) {
      b.addEventListener("click", function () { setTab(b.getAttribute("data-tab")); history.replaceState(null, "", "#" + b.getAttribute("data-tab")); });
    });
    $("search").addEventListener("input", function () { state.shown = PAGE; render(); });
    $("category").addEventListener("change", function () { state.shown = PAGE; render(); });
    $("more").addEventListener("click", function () { state.shown += PAGE; render(); });
    $("exJson").addEventListener("click", function () { exportAs("json"); });
    $("exCsv").addEventListener("click", function () { exportAs("csv"); });
    $("exMd").addEventListener("click", function () { exportAs("md"); });
    $("importFile").addEventListener("change", function (e) { if (e.target.files[0]) importFile(e.target.files[0]); e.target.value = ""; });
    fromHash();
    buildCarousel();
    render();
    if (state.highlight) { var t = $(state.highlight); if (t) t.scrollIntoView({ block: "center" }); }
  }

  fetch("data/items.json", { cache: "no-cache" })
    .then(function (r) { return r.ok ? r.json() : []; })
    .catch(function () { return []; })
    .then(init);
})();
