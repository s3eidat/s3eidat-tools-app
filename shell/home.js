/* App home: the hub's search + categories (fork of the site's hub.js) plus favourites.
   The Arabic page (lang=ar) uses window.S3_AR names. Favourites and recent tools live in this device's storage. */
(function () {
  "use strict";
  var AR = document.documentElement.lang === "ar" && window.S3_AR;
  var CAT_AR = {
    "Audio & Video": "صوت وفيديو", "Calculators": "حاسبات", "Design": "تصميم", "Developer": "للمبرمجين",
    "Everyday": "يومية", "Images": "صور", "PDF & Docs": "PDF ومستندات", "Productivity": "إنتاجية",
    "QR & Codes": "QR وباركود", "Security & Privacy": "أمان وخصوصية", "Text": "نصوص"
  };
  function nm(t) { return AR && AR[t.slug] ? AR[t.slug][0] : t.name; }
  function tg(t) { return AR && AR[t.slug] ? AR[t.slug][1] : t.tagline; }
  function ct(c) { return AR ? CAT_AR[c] || c : c; }
  function L(en, ar) { return AR ? ar : en; }

  var tools = S3.tools.slice().sort(function (a, b) { return nm(a).localeCompare(nm(b), AR ? "ar" : "en"); });
  var bySlug = {};
  tools.forEach(function (t) { bySlug[t.slug] = t; });
  var grid = S3.$("#grid"), q = S3.$("#q"), cats = S3.$("#cats"), none = S3.$("#none");
  var FAV = L("★ Favourites", "★ المفضلة"), ALL = L("All", "الكل"), cat = ALL;

  function favs() { return (S3.store("favs") || []).filter(function (s) { return bySlug[s]; }); }
  function isFav(slug) { return favs().indexOf(slug) >= 0; }
  function toggleFav(slug) {
    var f = favs().filter(function (s) { return s !== slug; });
    if (f.length === favs().length) f.unshift(slug);
    S3.store("favs", f);
    rows();
    draw();
  }

  S3.$("#count").textContent = AR ? tools.length.toLocaleString("ar-EG") : tools.length;
  var counts = {};
  tools.forEach(function (t) { counts[t.category] = (counts[t.category] || 0) + 1; });
  function catButtons() {
    cats.innerHTML = "";
    var list = [ALL].concat(favs().length ? [FAV] : [], Object.keys(counts).sort(function (a, b) { return ct(a).localeCompare(ct(b)); }));
    if (list.indexOf(cat) < 0) cat = ALL;
    list.forEach(function (c) {
      var n = c === ALL ? tools.length : c === FAV ? favs().length : counts[c];
      var b = S3.h("button", { type: "button", "aria-pressed": String(c === cat) }, [c === FAV || c === ALL ? c : ct(c), S3.h("span", { text: n })]);
      b.addEventListener("click", function () { cat = c; catButtons(); draw(); });
      cats.appendChild(b);
    });
  }

  // Latin: case and accents folded. Arabic: tashkeel/tatweel removed, alef/ya/ta-marbuta forms unified.
  function norm(s) {
    return s.toLowerCase().normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[ً-ٰٕـ]/g, "")
      .replace(/[أإآٱ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه");
  }
  function card(t) {
    var on = isFav(t.slug);
    var star = S3.h("button", {
      type: "button", "class": "app-star", "aria-pressed": String(on),
      "aria-label": (on ? L("Remove from favourites: ", "إزالة من المفضلة: ") : L("Add to favourites: ", "أضف إلى المفضلة: ")) + nm(t),
      title: on ? L("Remove from favourites", "إزالة من المفضلة") : L("Add to favourites", "أضف إلى المفضلة"),
      text: on ? "★" : "☆"
    });
    star.addEventListener("click", function () { toggleFav(t.slug); });
    return S3.h("div", { "class": "app-cell" }, [
      S3.h("a", { "class": "hub-card", href: "/" + t.slug + "/" }, [
        S3.h("b", { text: nm(t) }), S3.h("span", { text: tg(t) }), S3.h("em", { text: ct(t.category) })
      ]),
      star
    ]);
  }
  function draw() {
    var words = norm(q.value.trim()).split(/\s+/).filter(Boolean), f = favs();
    var hits = tools.filter(function (t) {
      if (cat === FAV ? f.indexOf(t.slug) < 0 : cat !== ALL && t.category !== cat) return false;
      var hay = norm([t.name, t.tagline, t.category, t.slug, nm(t), tg(t), ct(t.category)].join(" "));
      return words.every(function (w) { return hay.indexOf(w) >= 0; });
    });
    grid.innerHTML = "";
    hits.forEach(function (t) { grid.appendChild(card(t)); });
    none.hidden = hits.length > 0;
  }

  // Flagship apps: free versions of the big paid apps people use every day (same list as the site).
  var FLAGSHIP = [
    ["design-studio", "Canva"], ["pages", "Notion"], ["sheets", "Excel"], ["slides", "PowerPoint"],
    ["docs", "Word"], ["photo-editor", "Photoshop"], ["video-editor", "CapCut"], ["study-planner", "MyStudyLife"], ["budget", "YNAB"], ["storyboard", "Boords"], ["teleprompter", "PromptSmart"], ["diagrams", "Lucidchart"], ["logo-maker", "Looka"], ["time-tracker", "Toggl Track"], ["floor-plan", "RoomSketcher"], ["gantt", "Microsoft Project"], ["subtitle-editor", "Kapwing"], ["beat-maker", "FL Studio"], ["base", "Airtable"], ["mind-map", "MindMeister"], ["crm", "HubSpot CRM"], ["email-builder", "Mailchimp"], ["pdf-notes", "GoodNotes"], ["link-page", "Linktree"]
  ].filter(function (f) { return bySlug[f[0]]; });
  var flag = S3.$("#flagship-row");
  FLAGSHIP.forEach(function (f) {
    var t = bySlug[f[0]];
    flag.appendChild(S3.h("a", { "class": "hub-flag", href: "/" + t.slug + "/" }, [
      S3.h("b", { text: nm(t) }), S3.h("span", { text: tg(t) }),
      S3.h("em", { text: L("Free alternative to ", "بديل مجاني لـ ") + f[1] })
    ]));
  });
  S3.$("#flagship").hidden = !FLAGSHIP.length;

  function row(id, slugs) {
    var el = S3.$("#" + id + "-row");
    el.innerHTML = "";
    slugs.forEach(function (s) { el.appendChild(S3.h("a", { href: "/" + s + "/" }, [nm(bySlug[s])])); });
    S3.$("#" + id).hidden = !slugs.length;
  }
  function rows() {
    row("favs", favs());
    row("recent", (S3.store("recent") || []).filter(function (s) { return bySlug[s]; }));
    catButtons();
  }

  q.addEventListener("input", draw);
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && document.activeElement !== q) { e.preventDefault(); q.focus(); }
  });
  rows();
  draw();

  window.S3_SELFTEST = function () {
    return norm("إِسْتِخْرَاج") === norm("استخراج") && norm("صلاة") === norm("صلاه") && norm("Café") === "cafe" &&
      grid.children.length > 0;
  };
})();
