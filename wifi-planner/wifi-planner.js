/*!
 * CityPlug Wi-Fi & CCTV Planner
 * Drop-in widget: <div data-cityplug-planner></div> + wifi-planner.css + this script.
 * Everything you might want to tune is in DEFAULT_CONFIG below. Specs were checked against
 * Ubiquiti tech specs / datasheets in Nov 2026 — re-check when Ubiquiti releases new models.
 */
(function () {
  "use strict";

  var SCRIPT_BASE = (function () {
    try { var s = document.currentScript && document.currentScript.src; return s ? s.slice(0, s.lastIndexOf("/") + 1) : ""; }
    catch (e) { return ""; }
  })();

  var DEFAULT_CONFIG = {
    company: "CityPlug",
    website: "www.cityplug.co.uk",
    email: "info@cityplug.co.uk",
    areas: "London · Kent · Essex",
    quoteUrl: "https://www.cityplug.co.uk/#contact",
    sendUrl: "",                      // relay for "Send this plan to CityPlug"; empty = button hidden. Set per page with data-send-url
    privacyUrl: "/privacy",
    showHeader: true,                 // set false when embedding inside an existing page that has its own heading
    accentRGB: [15, 98, 234],        // PDF accent colour (match --cpwp-accent)

    coveragePerAP: { modern: 110, brick: 80, solid: 55 },   // m² a standard ceiling AP (U7 Pro) covers indoors, by wall type
    devicesPerPerson: { home: 8, business: 3 },
    hoursPerRun: { easy: 0.6, mixed: 1, hard: 1.75 },        // per new cable run, incl. termination

    /* Gateways, smallest first.
       cap   = rough relative capacity for the load meter (not a Ubiquiti figure; calibrate against calculator.ui.com)
       maxTB = largest recording storage it takes; maxCams = Ubiquiti's Protect camera figure at 2K (G5 cameras are 2K). UDM Pro / SE uses the lower SE figure. */
    gateways: [
      { id:"ux7", lan:1,       name:"Express 7",    full:"UniFi Express 7",              shape:"cube",  cap:55,  protect:false, maxTB:0,   maxCams:0,  media:"",                       multigig:true,  homeOnly:true,  wifi:true, smallOnly:true, blurb:"Router + Wi-Fi 7 in one small box (no CCTV)" },
      { id:"ucg-ultra", lan:4, name:"UCG Ultra",    full:"UniFi Cloud Gateway Ultra",    shape:"desk",  cap:60,  protect:false, maxTB:0,   maxCams:0,  media:"",                       multigig:false, homeOnly:true,  blurb:"Compact router, no CCTV recording" },
      { id:"udr7", lan:3,      name:"UDR7",         full:"UniFi Dream Router 7",         shape:"tower", cap:70,  protect:true,  maxTB:0.5, maxCams:2,  media:"microSD card",           multigig:false, homeOnly:true,  wifi:true, blurb:"All-in-one with built-in Wi-Fi 7" },
      { id:"udr5g", lan:3,     name:"UDR 5G Max",   full:"UniFi Dream Router 5G Max",    shape:"tower", cap:70,  protect:true,  maxTB:0.5, maxCams:2,  media:"microSD card",           multigig:false, homeOnly:true,  wifi:true, manual:true, blurb:"Built-in 5G for mobile broadband" },
      { id:"ucg-max", lan:4,   name:"UCG Max",      full:"UniFi Cloud Gateway Max",      shape:"desk",  cap:110, protect:true,  maxTB:2,   maxCams:8,  media:"NVMe SSD",               multigig:false, homeOnly:false, blurb:"Network + CCTV, under 2 Gb internet" },
      { id:"ucg-fiber", lan:4, name:"UCG Fiber",    full:"UniFi Cloud Gateway Fiber",    shape:"desk",  cap:160, protect:true,  maxTB:2,   maxCams:8,  media:"NVMe SSD + M.2 tray",    multigig:true,  homeOnly:false, blurb:"Multi-gig fibre, 10G ports" },
      { id:"udm-pro", lan:8,   name:"UDM Pro / SE", full:"UniFi Dream Machine Pro / SE", shape:"rack",  cap:140, protect:true,  maxTB:20,  maxCams:12, media:"3.5\" surveillance HDD", multigig:true,  homeOnly:false, blurb:"Rack-mount, one drive bay" },
      { id:"udm-pm", lan:8,    name:"UDM Pro Max",  full:"UniFi Dream Machine Pro Max",  shape:"rack",  cap:220, protect:true,  maxTB:20,  maxCams:25, bays:2, media:"3.5\" surveillance HDD", multigig:true, homeOnly:false, blurb:"Rack-mount, two mirrored drive bays" },
      { id:"udm-beast", lan:8, name:"UDM Beast",    full:"UniFi Dream Machine Beast",    shape:"rack",  cap:600, protect:true,  maxTB:20,  maxCams:60, bays:2, media:"3.5\" surveillance HDD", multigig:true, homeOnly:false, blurb:"Large sites, up to 60 2K cameras" }
    ],
    load: { base:15, perAP:1.5, perClient:0.15, perCamera:6, perOnvifCamera:6, perPhone:0.5, ips:10 },
    targetLoad: 0.6,

    /* Indoor access points. cov = coverage vs U7 Pro (Ubiquiti: Lite/In-Wall 115 m², Pro 140 m², Pro Max 160 m²);
       clients = comfortable busy-time clients (well under Ubiquiti's max); watts = Ubiquiti max power draw */
    aps: [
      { id:"u6-plus",    name:"U6+",         full:"UniFi U6+",         shape:"disc-s", mount:"ceiling", cov:1.0,  clients:25, watts:9,  blurb:"Budget Wi-Fi 6 (140 m²)" },
      { id:"u7-lite",    name:"U7 Lite",     full:"UniFi U7 Lite",     shape:"disc-s", mount:"ceiling", cov:0.8,  clients:25, watts:13, blurb:"Smaller rooms, flats" },
      { id:"u7-pro",     name:"U7 Pro",      full:"UniFi U7 Pro",      shape:"disc",   mount:"ceiling", cov:1.0,  clients:35, watts:21, blurb:"Best all-rounder" },
      { id:"u7-pro-max", name:"U7 Pro Max",  full:"UniFi U7 Pro Max",  shape:"disc-l", mount:"ceiling", cov:1.15, clients:50, watts:25, blurb:"Busy spaces, lots of devices" },
      { id:"u7-wall",    name:"U7 Pro Wall", full:"UniFi U7 Pro Wall", shape:"wall",   mount:"wall",    cov:0.9,  clients:35, watts:22, blurb:"Wall-mounted, no ceiling access" },
      { id:"u7-inwall",  name:"U7 In-Wall",  full:"UniFi U7 In-Wall",  shape:"plate",  mount:"wall",    cov:0.7,  clients:20, watts:13, blurb:"Replaces a wall socket, one room" }
    ],
    apOutdoor: { name:"U7 Outdoor", full:"UniFi U7 Outdoor", watts:19 },
    apOutbuilding: { name:"U7 Pro Wall", full:"UniFi U7 Pro Wall", watts:22 },

    /* PoE switches, smallest first: ports, poe = PoE-capable ports, budget = total PoE watts (Ubiquiti tech specs) */
    switches: [
      { id:"flexmini",   name:"Flex Mini",      full:"UniFi Switch Flex Mini",      shape:"mini",     ports:5,  poe:0,  budget:0   },
      { id:"flexmini25", name:"Flex Mini 2.5G", full:"UniFi Switch Flex Mini 2.5G", shape:"mini",     ports:5,  poe:0,  budget:0   },
      { id:"lite8",  name:"Lite 8 PoE",     full:"UniFi Switch Lite 8 PoE",     shape:"switch-s", ports:8,  poe:4,  budget:52  },
      { id:"ultra",  name:"Ultra",          full:"UniFi Switch Ultra (60 W)",   shape:"switch-s", ports:8,  poe:7,  budget:52  },
      { id:"lite16", name:"Lite 16 PoE",    full:"UniFi Switch Lite 16 PoE",    shape:"switch-s", ports:16, poe:8,  budget:45  },
      { id:"flex25poe", name:"Flex 2.5G PoE", full:"UniFi Switch Flex 2.5G PoE + 210 W adapter", shape:"switch-s", ports:9, poe:8, budget:196 },
      { id:"pm16",   name:"Pro Max 16 PoE", full:"UniFi Switch Pro Max 16 PoE", shape:"switch",   ports:16, poe:16, budget:180 },
      { id:"pm24",   name:"Pro Max 24 PoE", full:"UniFi Switch Pro Max 24 PoE", shape:"switch",   ports:24, poe:24, budget:400 },
      { id:"pm48",   name:"Pro Max 48 PoE", full:"UniFi Switch Pro Max 48 PoE", shape:"switch",   ports:48, poe:48, budget:720 }
    ],
    /* Separate recorders (UniFi Protect), smallest first. maxCams at 2K, bays = 3.5" drive bays (max 20 TB per drive here). */
    nvrs: [
      { id:"unvr-instant", name:"UNVR Instant", full:"UniFi NVR Instant",               shape:"desk", bays:1,  maxCams:8,  blurb:"1 drive bay, built-in PoE ports for cameras" },
      { id:"unvr",         name:"UNVR",         full:"UniFi Network Video Recorder",    shape:"rack", bays:4,  maxCams:30, blurb:"4 drive bays, rack-mount" },
      { id:"unvr-pro",     name:"UNVR Pro",     full:"UniFi Network Video Recorder Pro",shape:"rack", bays:7,  maxCams:35, blurb:"7 drive bays, rack-mount" },
      { id:"envr",         name:"Enterprise NVR", full:"UniFi Enterprise NVR",          shape:"rack", bays:16, maxCams:70, blurb:"16 drive bays, large sites" }
    ],
    nvrDriveSizesTB: [4, 8, 12, 16, 20],
    roomSwitches: ["flexmini", "flexmini25"],   // offered as extra small switches for a TV / desk
    injector: "UniFi PoE injector",
    controller: "UniFi Cloud Key (to manage the UniFi kit)",
    maxSwitches: 12,
    poeHeadroom: 0.9,                 // use at most 90% of a switch's PoE budget (figures are max draw, so this is conservative)
    watts: { camera:10, onvifCamera:10, phone:6, aiPort:15 },   // camera: G5 Bullet 5 W, G5 Dome 7.7 W, G5 Pro 10 W, so 10 W is a safe planning figure

    cctv: {
      gbPerCameraDay: 22,             // ~2 Mbps continuous per 2K camera. 4K is roughly double.
      driveSizesTB: [0.064, 0.128, 0.256, 0.512, 1, 2, 4, 8, 12, 16, 20],
      driveHeadroom: 1.15,            // a drive formats to ~90% of its label, plus some slack
      camsPerAIPort: 2,               // Ubiquiti: 1 x 4K, 2 x 2K or 3 x HD third-party (ONVIF) cameras per AI Port
      nvr: "UniFi Network Video Recorder (separate)"
    },
    bridge: "UniFi Building-to-Building Bridge",
    ups: "UPS (battery backup) for network kit",

    pdfBrand: { logo: "brand/logo.png", stamp: "brand/stamp.png" },   // same-origin images for the PDF letterhead
    pdfOpacity: { logo: 0.6, stamp: 0.8 },                              // logo 60%, CityPlug stamp 80% on the PDF
    pdfLibs: {
      jspdf:     ["vendor/jspdf.umd.min.js"],
      autotable: ["vendor/jspdf.plugin.autotable.min.js"]
    }
  };

  /* ---------- helpers ---------- */
  function merge(base, extra) {
    var out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    if (!extra) return out;
    Object.keys(extra).forEach(function (k) {
      var v = extra[k];
      out[k] = (v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) ? merge(base[k], v) : v;
    });
    return out;
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fmtDaysNum(d) { return d <= 0.5 ? "½" : (d % 1 ? Math.floor(d) + "½" : String(d)); }   // number only, for the fixed-size tiles
  function fmtDays(d) { return d <= 0.5 ? "½ day" : (d % 1 ? Math.floor(d) + "½ days" : d + " day" + (d > 1 ? "s" : "")); }
  function aAn(t) { return /^(8|11|18|80)\b|^[aeiou]/i.test(String(t)) ? "an " + t : "a " + t; }
  function fmtTB(tb) { return tb >= 1 ? (Math.round(tb * 10) / 10) + " TB" : Math.round(tb * 1000) + " GB"; }
  function loadScript(srcs) {
    return srcs.reduce(function (p, src) {
      return p.catch(function () {
        return new Promise(function (res, rej) {
          var url = /^https?:|^\//.test(src) ? src : SCRIPT_BASE + src;
          var s = document.createElement("script"); s.src = url; s.async = true;
          s.onload = res; s.onerror = function () { s.remove(); rej(new Error("load " + url)); };
          document.head.appendChild(s);
        });
      });
    }, Promise.reject());
  }

  var BEDS = { "1-2": 65, "3": 95, "4": 130, "5+": 190 };
  var LIMITS = { people: [1, 200], guests: [0, 500], camsNew: [0, 64], camsExisting: [0, 64], wired: [0, 48], roomSwQty: [0, 10], apQty: [0, 30] };
  var TYPE_LABEL = { house: "House", flat: "Flat", office: "Office", shop: "Shop", hospitality: "Hospitality", warehouse: "Warehouse / unit" };
  var OUT_LABEL = { garden: "garden", patio: "patio", carpark: "car park" };

  /* ================================================================ */
  function Planner(root, userConfig) {
    var CONFIG = merge(DEFAULT_CONFIG, userConfig || {});
    var S = {
      project: "", customer: "", postcode: "",
      type: "house", beds: "3", area: 150, floors: 2, basement: false, loft: false,
      walls: "brick", outside: [], people: 4, guests: 0,
      uses: ["streaming", "homeworking"],
      camsNew: 4, camsExisting: 0, camKind: "ip", camCabled: "yes", retention: 30, smart: "no",
      internet: "fttp", cabling: "none", routes: "mixed", mount: "ceiling", wired: 2, notes: "",
      gw: null, ap: null, sw: null, rec: null, apAdj: {}, roomSw: "flexmini", roomSwQty: 0,
      sendEmail: "", sendPhone: "", sendConsent: false, sendHp: "", sendState: "",
      gwDisk: "auto"                 // UCG Max / Fiber storage: "auto" = what the cameras need, else size in TB ("0" = no disk)
    };
    var startedAt = Date.now();
    if (CONFIG.project) S.project = CONFIG.project;
    try { var qp = new URLSearchParams(location.search).get("project"); if (qp) S.project = qp; } catch (e) {}
    var step = 0;

    function isBiz() { return ["house", "flat"].indexOf(S.type) < 0; }
    function hasCCTV() { return S.uses.indexOf("cctv") >= 0; }
    function q(sel) { return root.querySelector(sel); }
    function qa(sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); }

    /* ---------- shell ---------- */
    root.classList.add("cpwp");
    root.innerHTML =
      '<div class="cpwp-wrap">' +
      (CONFIG.showHeader ? '<div class="cpwp-top"><div class="cpwp-brand">' + esc(CONFIG.company).replace(/^City/, "City<span>") + (CONFIG.company.indexOf("City") === 0 ? "</span>" : "") + '</div><div class="tag">Wi-Fi &amp; CCTV planner</div></div>' +
        '<h1>Plan your Wi-Fi installation</h1><p class="lede">Answer a few quick questions about the property. You\'ll get a suggested UniFi setup (gateway, Wi-Fi access points, switch, cabling and CCTV) and what to expect on the day. It takes about two minutes.</p>' : "") +
      '<div class="cpwp-grid" data-r="grid">' +
      '<div class="card" data-r="main"><nav class="steps" data-r="steps" aria-label="Progress"></nav><div data-r="body"></div>' +
      '<div class="nav" data-r="nav"><button type="button" class="btn ghost" data-r="back">Back</button><button type="button" class="btn primary" data-r="next">Next</button></div></div>' +
      '<aside class="card" data-r="aside" aria-live="polite"><h3>Your plan so far</h3><div class="tag" data-r="asideProject">Live estimate</div>' +
      '<div class="kpis"><div class="kpi"><b data-r="kAP">–</b><span>Access points</span></div><div class="kpi"><b data-r="kCam">–</b><span>Cameras</span></div><div class="kpi"><b data-r="kDays">–</b><span>Days on site</span></div></div>' +
      '<ul class="kit" data-r="asideKit"></ul></aside></div></div><div class="toast" data-r="toast" role="status"></div>';
    function R(name) { return q('[data-r="' + name + '"]'); }

    var STEPS = [
      { title: "Property", sub: "Tell us about the building.", render: renderProperty },
      { title: "How it's used", sub: "Who and what will be on the network.", render: renderUsage },
      { title: "Installation", sub: "What's there now and how cables can be run.", render: renderInstall },
      { title: "Your plan", sub: "", render: renderPlan }
    ];

    function chips(name, opts, multi) {
      return '<div class="chips" role="group">' + opts.map(function (o) {
        var on = multi ? S[name].indexOf(o[0]) >= 0 : String(S[name]) === String(o[0]);
        return '<button type="button" class="chip" data-f="' + name + '" data-v="' + o[0] + '" data-m="' + (multi ? 1 : 0) + '" aria-pressed="' + on + '">' + o[1] + (o[2] ? "<small>" + o[2] + "</small>" : "") + "</button>";
      }).join("") + "</div>";
    }
    function stepperInput(name) {
      return '<div class="stepper"><button type="button" data-step="' + name + '" data-d="-1" aria-label="Fewer">−</button><output data-o="' + name + '">' + S[name] + '</output><button type="button" data-step="' + name + '" data-d="1" aria-label="More">+</button></div>';
    }

    function renderProperty() {
      return '<div class="q"><div class="row2">' +
        '<div><label for="cpwp-project">Project name <span class="hint">e.g. Home Wi-Fi upgrade</span></label><input type="text" id="cpwp-project" data-t="project" value="' + esc(S.project) + '"></div>' +
        '<div><label for="cpwp-postcode">Postcode</label><input type="text" id="cpwp-postcode" data-t="postcode" value="' + esc(S.postcode) + '" placeholder="SE1 7PB"></div></div></div>' +
        '<div class="q"><label for="cpwp-customer">Your name</label><input type="text" id="cpwp-customer" data-t="customer" value="' + esc(S.customer) + '"></div>' +
        '<div class="q"><div class="ql">Type of property</div>' + chips("type", [["house", "House"], ["flat", "Flat"], ["office", "Office"], ["shop", "Shop"], ["hospitality", "Café / bar / hotel"], ["warehouse", "Warehouse / unit"]]) + "</div>" +
        (isBiz()
          ? '<div class="q"><label for="cpwp-area">Approximate floor area <span class="hint">m², all floors together</span></label><input type="number" id="cpwp-area" data-n="area" min="20" step="10" value="' + S.area + '"></div>'
          : '<div class="q"><div class="ql">Size</div>' + chips("beds", [["1-2", "1–2 bed"], ["3", "3 bed"], ["4", "4 bed"], ["5+", "5+ bed"]]) + "</div>") +
        '<div class="q"><div class="ql">Main floors</div>' + chips("floors", [[1, "1"], [2, "2"], [3, "3"], [4, "4+"]]) + "</div>" +
        '<div class="q"><div class="ql">Also has <span class="hint">optional</span></div><div class="chips"><button type="button" class="chip" data-toggle="basement" aria-pressed="' + S.basement + '">Basement / cellar</button><button type="button" class="chip" data-toggle="loft" aria-pressed="' + S.loft + '">Loft room</button></div></div>' +
        '<div class="q"><div class="ql">Walls are mostly</div>' + chips("walls", [["modern", "Modern / stud", "newer builds"], ["brick", "Brick", "most UK homes"], ["solid", "Thick / stone", "period, concrete"]]) + "</div>" +
        '<div class="q"><div class="ql">Outside areas that need Wi-Fi <span class="hint">pick any</span></div>' + chips("outside", [["garden", "Garden"], ["patio", "Patio / terrace"], ["outbuilding", "Garage / outbuilding"], ["office", "Garden office"], ["carpark", "Car park / yard"]], true) + "</div>";
    }
    function renderUsage() {
      return '<div class="q"><div class="ql">' + (isBiz() ? "Staff on site at busy times" : "People living there") + "</div>" + stepperInput("people") + "</div>" +
        (isBiz() ? '<div class="q"><div class="ql">Customers / guests on Wi-Fi at once <span class="hint">0 if none</span></div>' + stepperInput("guests") + "</div>" : "") +
        '<div class="q"><div class="ql">What\'s needed <span class="hint">pick any</span></div>' + chips("uses", [
          ["streaming", "4K streaming"], ["homeworking", isBiz() ? "Video calls" : "Working from home"], ["gaming", "Gaming"], ["smarthome", isBiz() ? "Smart devices / IoT" : "Smart home"],
          ["guest", "Separate guest Wi-Fi"], ["pos", "Card machines / tills"], ["voip", "Phones (VoIP)"], ["cctv", "CCTV cameras"]], true) + "</div>" +
        (hasCCTV() ? renderCCTV() : "") +
        '<div class="q"><div class="ql">Internet connection</div>' + chips("internet", [["fttp", "Full fibre", "up to 1 Gb"], ["multigig", "Full fibre 2 Gb+", "multi-gig"], ["fttc", "Part fibre / copper"], ["wireless", "5G / Starlink"], ["unknown", "Not sure"]]) + "</div>";
    }
    function renderCCTV() {
      var ex = S.camsExisting > 0;
      return '<div class="panel" data-r="cctvPanel"><h4>CCTV</h4>' +
        '<div class="q"><div class="ql">New UniFi cameras</div>' + stepperInput("camsNew") + "</div>" +
        '<div class="q"><div class="ql">Existing cameras to keep <span class="hint">your own</span></div>' + stepperInput("camsExisting") + "</div>" +
        (ex ? '<div class="q"><div class="ql">Existing cameras are</div>' + chips("camKind", [["ip", "Network / IP", "plug into a network cable"], ["analogue", "Analogue / coax", "old DVR system"], ["unsure", "Not sure"]]) + "</div>" +
          (S.camKind !== "analogue" ?
            '<div class="q"><div class="ql">Are they already cabled?</div>' + chips("camCabled", [["yes", "Yes, cable reaches the cabinet"], ["no", "No, need new cable"]]) + "</div>" +
            '<div class="q"><div class="ql">Smart alerts on existing cameras? <span class="hint">people / vehicle detection</span></div>' + chips("smart", [["no", "Not needed"], ["yes", "Yes, add AI Port"]]) + "</div>" : "") : "") +
        '<div class="q"><div class="ql">Keep recordings for</div>' + chips("retention", [[7, "7 days"], [14, "14 days"], [30, "30 days"], [60, "60 days"]]) + "</div></div>";
    }
    function renderInstall() {
      return '<div class="q"><div class="ql">Existing network cabling</div>' + chips("cabling", [["none", "None"], ["some", "Some rooms"], ["full", "Most rooms"]]) + "</div>" +
        '<div class="q"><div class="ql">Running cables will be</div>' + chips("routes", [["easy", "Straightforward", "loft, floorboards up"], ["mixed", "Mixed", "some tricky rooms"], ["hard", "Difficult", "solid floors, finished decor"]]) + "</div>" +
        '<div class="q"><div class="ql">Access point mounting</div>' + chips("mount", [["ceiling", "Ceiling", "best coverage"], ["wall", "Wall", "no ceiling access"]]) + "</div>" +
        '<div class="q"><div class="ql">Extra wired points <span class="hint">TV, desk, console, printer</span></div>' + stepperInput("wired") + "</div>" +
        '<div class="q"><label for="cpwp-notes">Anything else we should know?</label><textarea id="cpwp-notes" data-t="notes" rows="3" maxlength="700" placeholder="Dead spots, where the router is now, camera brand, listed building, timings…">' + esc(S.notes) + "</textarea></div>";
    }

    /* ---------- planning engine ---------- */
    function plan() {
      var biz = isBiz();
      var totalArea = biz ? Math.max(20, +S.area || 0) : BEDS[S.beds];
      var perFloor = totalArea / S.floors;
      var names = ["Ground floor", "First floor", "Second floor", "Third floor"];
      var floors = [], i;
      for (i = 0; i < S.floors; i++) floors.push({ name: names[i] || "Floor " + i, area: perFloor });
      if (S.basement) floors.unshift({ name: "Basement", area: perFloor * 0.6 });
      if (S.loft) floors.push({ name: "Loft room", area: perFloor * 0.5 });
      floors.forEach(function (f) { f.key = f.name; });

      var devices = biz ? S.people * CONFIG.devicesPerPerson.business + S.guests * 1.2
                        : S.people * CONFIG.devicesPerPerson.home + (S.uses.indexOf("smarthome") >= 0 ? 15 : 0);
      var adj = S.apAdj || {};
      function adjOf(key) { return +adj[key] || 0; }

      // Access points ("none" = no indoor APs). Suggested counts first, the customer's +/- changes on top.
      function covFor(a) { var c = CONFIG.coveragePerAP[S.walls] * a.cov; if (S.type === "warehouse") c *= 2.2; else if (S.type === "office" || S.type === "shop") c *= 1.2; return c; }
      function apCountFor(a) {
        var c = covFor(a);
        return Math.max(floors.reduce(function (s, f) { return s + Math.max(1, Math.ceil(f.area / c)); }, 0), Math.ceil(devices / a.clients));
      }
      function apById(id) { return CONFIG.aps.filter(function (a) { return a.id === id; })[0]; }
      var dense = devices / Math.max(1, floors.length) > 40 || S.type === "hospitality" || S.type === "warehouse";
      var recAP = S.mount === "wall" ? apById("u7-wall") : dense ? apById("u7-pro-max") : apById("u7-pro");
      if (recAP.id === "u7-pro" && !biz && S.floors === 1 && apById("u7-lite") && apCountFor(apById("u7-lite")) <= apCountFor(recAP)) recAP = apById("u7-lite");
      var noAP = S.ap === "none";
      var selAP = noAP ? null : (apById(S.ap) || recAP);
      if (selAP) {
        var cov = covFor(selAP);
        floors.forEach(function (f) { f.aps = Math.max(1, Math.ceil(f.area / cov)); });
        var covAPs = floors.reduce(function (a, f) { return a + f.aps; }, 0);
        var extra = Math.max(covAPs, Math.ceil(devices / selAP.clients)) - covAPs, k = 0;
        var bySize = floors.slice().sort(function (a, b) { return b.area - a.area; });
        while (extra > 0) { bySize[k % bySize.length].aps++; extra--; k++; }
      } else floors.forEach(function (f) { f.aps = 0; });

      var outdoorAreas = S.outside.filter(function (o) { return ["garden", "patio", "carpark"].indexOf(o) >= 0; });
      var outdoorSugg = outdoorAreas.length;
      var outbuildSugg = S.outside.filter(function (o) { return o === "outbuilding" || o === "office"; }).length;
      function withAdj(sugg, key) { return Math.max(0, Math.min(LIMITS.apQty[1], sugg + adjOf(key))); }
      var outdoorAPs = withAdj(outdoorSugg, "outdoor");
      var outbuildAPs = withAdj(outbuildSugg, "outbuild");
      // provisional count (before the gateway's built-in Wi-Fi is taken off) for sizing the gateway
      var provisionalAPs = floors.reduce(function (a, f) { return a + (selAP ? withAdj(f.aps, f.key) : 0); }, 0) + outdoorAPs + outbuildAPs;

      // CCTV
      var cctv = hasCCTV(), analogue = S.camKind === "analogue";
      var replaced = cctv && analogue ? S.camsExisting : 0;
      var newCams = cctv ? S.camsNew + replaced : 0;
      var onvifCams = cctv && !analogue ? S.camsExisting : 0;
      var cams = newCams + onvifCams;
      var aiPorts = onvifCams && S.smart === "yes" ? Math.ceil(onvifCams / CONFIG.cctv.camsPerAIPort) : 0;
      var storageTB = cams * CONFIG.cctv.gbPerCameraDay * (+S.retention) / 1000;
      var needTB = storageTB * CONFIG.cctv.driveHeadroom;
      var sizes = CONFIG.cctv.driveSizesTB;
      var driveTB = cams ? (sizes.filter(function (x) { return x >= needTB; })[0] || sizes[sizes.length - 1]) : 0;
      // drives for a recorder with n bays: fewest drives, then smallest size; 2+ drives get one extra for protection (RAID)
      function drivesFor(bays) {
        if (!cams) return null;
        var best = null;
        CONFIG.nvrDriveSizesTB.forEach(function (sz) {
          var data = Math.max(1, Math.ceil(needTB / sz)), count = bays === 1 ? data : data + 1;
          if (count > bays) return;
          if (!best || count < best.count || (count === best.count && sz < best.size)) best = { size: sz, count: count, protected: count > data };
        });
        return best;
      }

      // Gateway and recording. Recording on the gateway needs Protect, enough camera capacity and room for the drive.
      var phones = S.uses.indexOf("voip") >= 0 ? Math.max(1, Math.ceil(S.people / 2)) : 0;
      var L = CONFIG.load;
      function loadFor(onGw) {
        return L.base + provisionalAPs * L.perAP + devices * L.perClient + (onGw ? newCams * L.perCamera + onvifCams * L.perOnvifCamera : cams) + phones * L.perPhone + (biz ? L.ips : 0);
      }
      var loadOnGw = loadFor(true), loadOffGw = loadFor(false);
      function gwStore(g) { return g.bays > 1 ? "2 × " + fmtTB(driveTB) + " mirrored hard drives" : aAn(fmtTB(driveTB)) + " " + g.media; }
      function canRecord(g) { return !!g && g.protect && cams <= g.maxCams && g.maxTB >= driveTB; }
      function nvrFits(n) { return cams <= n.maxCams && !!drivesFor(n.bays); }
      function speedOk(g) { return S.internet !== "multigig" || g.multigig; }
      function baseFit(g, onGw) {
        return speedOk(g) && !(biz && g.homeOnly) && !g.manual &&
          !(g.smallOnly && (provisionalAPs > 1 || S.wired > 1)) && (onGw ? loadOnGw : loadOffGw) / g.cap <= CONFIG.targetLoad;
      }
      var G = CONFIG.gateways, NV = CONFIG.nvrs;
      var recNVR = cams ? (NV.filter(nvrFits)[0] || NV[NV.length - 1]) : null;
      var gwThatRecords = cams ? G.filter(function (g) { return baseFit(g, true) && canRecord(g); })[0] : null;
      var gwPlain = G.filter(function (g) { return baseFit(g, false); })[0] || G[G.length - 1];
      var userNVR = NV.filter(function (n) { return n.id === S.rec; })[0] || null;
      // which way the recommendation goes: on the gateway when one fits, otherwise a separate NVR
      // homes: a rack-mount gateway just to record is overkill when a desktop recorder does it
      var preferNVR = !biz && gwThatRecords && gwThatRecords.shape === "rack" && recNVR && recNVR.shape !== "rack" && gwPlain.shape !== "rack";
      var wantGwRec = cams > 0 && !userNVR && (S.rec === "gw" || (!!gwThatRecords && !preferNVR));
      var recG = (wantGwRec && gwThatRecords) || gwPlain;
      var noGW = S.gw === "none";
      var selG = noGW ? null : (G.filter(function (g) { return g.id === S.gw; })[0] || recG);
      var onGateway = cams > 0 && !userNVR && canRecord(selG);
      var needNVR = cams > 0 && !onGateway;
      var selNVR = needNVR ? (userNVR || recNVR) : null;
      var nvrDrives = selNVR ? drivesFor(selNVR.bays) : null;
      var recRec = cams ? (canRecord(selG) ? "gw" : recNVR.id) : null;
      // NVMe gateways (UCG Max / UCG Fiber) take an optional SSD: the customer can pick the size, or leave it on Auto.
      var nvmeGw = !!selG && /NVMe/.test(selG.media || "");
      var diskChoice = nvmeGw && S.gwDisk !== "auto" ? +S.gwDisk : null;          // TB; 0 = no disk; null = auto
      var gwDiskDays = cams && diskChoice ? Math.floor(diskChoice * 1000 / CONFIG.cctv.driveHeadroom / (cams * CONFIG.cctv.gbPerCameraDay)) : 0;          // recommended recording option for the current gateway
      var recReason = "";
      if (cams) {
        if (onGateway) recReason = "No. The " + selG.name + " records all " + cams + " camera" + (cams > 1 ? "s" : "") + " itself, on " + gwStore(selG) + ".";
        else if (!userNVR && selG === recG && gwThatRecords && preferNVR) {
          var desk = G.filter(function (g) { return g.protect && g.shape !== "rack" && !g.manual; }).pop();
          recReason = "Yes. " + (cams > desk.maxCams ? cams + " cameras is more than a desktop gateway records (" + desk.maxCams + ")" : S.retention + " days from " + cams + " camera" + (cams > 1 ? "s" : "") + " needs about " + fmtTB(storageTB) + ", more than a desktop gateway holds (" + fmtTB(desk.maxTB) + ")") +
            ". A " + recNVR.name + " records them and the gateway stays small. Recording on the gateway would mean a rack-mount " + gwThatRecords.name + ".";
        }
        else if (userNVR) recReason = "Yes, you chose a separate recorder. The gateway then only runs the network" + (selG && selG !== gwThatRecords ? ", so a smaller one can do the job" : "") + ".";
        else if (!selG) recReason = "Yes. Without a UniFi gateway, cameras need their own UniFi recorder.";
        else if (!selG.protect) recReason = "Yes. The " + selG.name + " can't record cameras.";
        else if (cams > selG.maxCams) recReason = "Yes. " + cams + " cameras is more than the " + selG.name + " records (" + selG.maxCams + " at 2K).";
        else recReason = "Yes. " + fmtTB(storageTB) + " of recordings won't fit in the " + selG.name + " (" + fmtTB(selG.maxTB) + " max).";
      }
      var gwLoad = selG ? (onGateway ? loadOnGw : loadOffGw) / selG.cap : 0;
      var loadUnits = onGateway ? loadOnGw : loadOffGw;
      var gwWarn = [];
      if (selG) {
        if (cams && S.rec === "gw" && !onGateway) gwWarn.push("The " + selG.name + " can't record " + (cams > selG.maxCams && selG.protect ? "this many cameras" : "these cameras") + ", so a separate UniFi recorder is added.");
        if (!speedOk(selG)) gwWarn.push("This gateway won't run multi-gig fibre at full speed.");
        if (gwLoad > 0.85) gwWarn.push("This gateway would be close to its limit with this setup.");
      }
      var nvrWarn = [];
      if (selNVR && !nvrFits(selNVR)) nvrWarn.push("The " + selNVR.name + " is too small for " + cams + " cameras and " + fmtTB(storageTB) + " of recordings. The " + recNVR.name + " fits.");

      // gateway with built-in Wi-Fi covers one indoor area (placed where the internet comes in)
      var builtIn = selG && selG.wifi ? 1 : 0, builtInFloor = null;
      if (builtIn && selAP) {
        var gf = floors.filter(function (f) { return f.name !== "Basement" && f.aps > 0; })[0] || floors.filter(function (f) { return f.aps > 0; })[0];
        if (gf) { gf.aps--; builtInFloor = gf.name; }
      }
      if (builtIn && !builtInFloor) builtInFloor = (floors.filter(function (f) { return f.name !== "Basement"; })[0] || floors[0]).name;

      // apply the customer's quantity changes
      floors.forEach(function (f) { f.sugg = f.aps; f.adj = selAP ? adjOf(f.key) : 0; f.aps = selAP ? withAdj(f.aps, f.key) : 0; });
      var indoor = floors.reduce(function (a, f) { return a + f.aps; }, 0);
      var indoorSugg = floors.reduce(function (a, f) { return a + f.sugg; }, 0);
      var totalAPs = indoor + outdoorAPs + outbuildAPs;
      var apChanged = floors.some(function (f) { return f.adj; }) || adjOf("outdoor") || adjOf("outbuild") ? true : false;

      // Switch. Works out how many of a model are needed: PoE ports, total ports (incl. links between switches) and power.
      var W = CONFIG.watts;
      var apWatts = indoor * (selAP ? selAP.watts : 0) + outdoorAPs * CONFIG.apOutdoor.watts + outbuildAPs * CONFIG.apOutbuilding.watts;
      var camWatts = newCams * W.camera + onvifCams * W.onvifCamera;
      var poeWatts = apWatts + camWatts + phones * W.phone + aiPorts * W.aiPort;
      var poeNeed = totalAPs + cams + phones + aiPorts;
      var portNeed = poeNeed + S.wired + 1 + (selNVR ? 1 : 0);
      function swFitsCount(sw, c) {
        var ports = c * sw.ports - 2 * (c - 1);
        if (ports < portNeed) return false;
        if (!sw.poe) return true;
        return c * sw.poe >= poeNeed && c * sw.budget * CONFIG.poeHeadroom >= poeWatts;
      }
      function swCountFor(sw) { for (var c = 1; c < CONFIG.maxSwitches; c++) if (swFitsCount(sw, c)) return c; return CONFIG.maxSwitches; }
      function swLimits(sw) {   // what one of these runs out of first
        var r = [];
        if (sw.poe && sw.poe < poeNeed) r.push("PoE ports");
        if (sw.poe && sw.budget * CONFIG.poeHeadroom < poeWatts) r.push("power");
        if (sw.ports < portNeed) r.push("total ports");
        return r;
      }
      var SWL = CONFIG.switches;
      var recNoSW = poeNeed === 0 && !!selG && portNeed - 1 <= (selG.lan || 0);   // gateway's own ports are enough
      var recSW = null;
      if (!recNoSW) {
        var cands = SWL.filter(function (x) { return x.poe > 0 || poeNeed === 0; });
        recSW = cands.filter(function (x) { return swCountFor(x) === 1; })[0] ||
          cands.slice().sort(function (a, b) { return swCountFor(a) - swCountFor(b) || a.budget - b.budget; })[0];
      }
      var noSW = S.sw === "none" || (!S.sw && recNoSW);
      var selSW = noSW ? null : (SWL.filter(function (x) { return x.id === S.sw; })[0] || recSW);
      var swCount = selSW ? swCountFor(selSW) : 0;
      var swMulti = swCount > 1;
      var swNote = "";
      if (selSW && swMulti) {
        var lim = swLimits(selSW);
        swNote = "One " + selSW.name + " isn't enough. It has " + (selSW.poe ? selSW.poe + " PoE ports and " + selSW.budget + " W" : selSW.ports + " ports") +
          ", and this plan needs " + (selSW.poe ? poeNeed + " PoE ports and about " + Math.round(poeWatts) + " W" : portNeed + " ports") +
          (lim.length ? " (short on " + lim.join(", ").replace(/, ([^,]*)$/, " and $1") + ")" : "") + ". So the plan uses " + swCount + " of them, linked together, and the kit list, ports and cabinet are updated to match." +
          (recSW && recSW !== selSW && swCountFor(recSW) === 1 ? " A single " + recSW.name + " would also do it." : "");
      }
      var injectors = (!selSW || !selSW.poe) ? poeNeed : 0;
      var roomSw = SWL.filter(function (x) { return x.id === S.roomSw; })[0] || SWL[0];

      // Cabling
      var camRuns = newCams + (onvifCams && S.camCabled === "no" ? onvifCams : 0) + aiPorts;
      var reuse = S.cabling === "full" ? 0.5 : S.cabling === "some" ? 0.8 : 1;
      var apRuns = Math.round((indoor + S.wired + phones) * reuse) + outdoorAPs + outbuildAPs;
      // Default rules: a router (gateway) always gets 1 cable run, and a router + switch get 1 more run linking them.
      // Both are terminated like any other run.
      var routerRuns = selG ? 1 : 0, linkRuns = selG && selSW ? 1 : 0, coreRuns = routerRuns + linkRuns;
      var newRuns = apRuns + camRuns + coreRuns;
      var runs = indoor + outdoorAPs + outbuildAPs + S.wired + phones + camRuns + coreRuns;
      var rackU = (selG && selG.shape === "rack" ? 1 : 0) + (selNVR && selNVR.shape === "rack" ? (selNVR.bays > 4 ? 2 : 1) : 0) +
        (selSW && selSW.shape === "switch" ? swCount : 0) + Math.ceil(runs / 24) + 1;
      var cabinet = rackU >= 8 || runs > 40 ? "12U wall cabinet with patch panels" : rackU >= 4 || (selG && selG.shape === "rack") || runs >= 10 ? "9U wall cabinet with patch panel" : runs >= 6 || swMulti ? "6U wall cabinet with patch panel" : "Compact comms shelf / small cabinet";

      // Time
      var hours = 1.5 + newRuns * CONFIG.hoursPerRun[S.routes] + totalAPs * 0.3 + newCams * 0.4 + onvifCams * 0.3 + (selNVR ? 0.5 : 0) + 1.5;
      var days = Math.max(0.5, Math.ceil(hours / 8 * 2) / 2);

      // Kit list
      var kit = [];
      function add(group, qn, item, why) { if (qn > 0) kit.push({ group: group, q: qn, item: item, why: why || "" }); }
      if (selG) add("Network", 1, selG.full, selG.blurb + (selG === recG ? "" : " (chosen manually)"));
      if (!selG && (totalAPs || selSW || cams)) add("Network", 1, CONFIG.controller, "You keep your router; UniFi kit still needs a controller");
      if (selSW) add("Network", swCount, selSW.full + (/switch/i.test(selSW.full) ? "" : " switch"),
        (swMulti ? swCount + " needed, linked together. " : "") +
        (selSW.poe ? "Powers " + poeNeed + " PoE device" + (poeNeed === 1 ? "" : "s") + " (~" + Math.round(poeWatts) + " W of " + selSW.budget * swCount + " W), " + portNeed + " ports needed" : portNeed + " ports needed, no PoE output"));
      add("Network", injectors, CONFIG.injector, "Powers each access point / camera without a PoE switch");
      add("Network", S.roomSwQty, roomSw.full, "Extra wired ports behind a TV or on a desk");
      add("Network", 1, cabinet, "Tidy home for the network kit");
      if (biz || cams) add("Network", 1, CONFIG.ups, "Keeps Wi-Fi and cameras up through power cuts");
      if (selAP) add("Wi-Fi", indoor, selAP.full, "Indoor " + (/U6/.test(selAP.name) ? "Wi-Fi 6" : "Wi-Fi 7") + ", " + selAP.mount + "-mounted" + (indoor !== indoorSugg ? " (" + (indoor > indoorSugg ? "+" : "") + (indoor - indoorSugg) + " vs suggested)" : ""));
      add("Wi-Fi", outdoorAPs, CONFIG.apOutdoor.full, "Weatherproof" + (outdoorAreas.length ? ", for " + outdoorAreas.map(function (o) { return OUT_LABEL[o]; }).join(", ") : ", outside"));
      add("Wi-Fi", outbuildAPs, CONFIG.apOutbuilding.full, "Inside the garage / garden office");
      add("Wi-Fi", outbuildAPs ? 1 : 0, CONFIG.bridge, "Only if a cable can't be run to the outbuilding");
      add("CCTV", newCams, "UniFi Protect camera (G5 range)", replaced ? S.camsNew + " new + " + replaced + " replacing old analogue cameras" : "Model and lens chosen at survey");
      add("CCTV", onvifCams, "Your own camera, added to UniFi Protect (ONVIF)", S.camCabled === "yes" ? "Reuses existing cable, no licence fee" : "New cable to the cabinet, no licence fee");
      add("CCTV", aiPorts, "UniFi AI Port", "Adds smart detections to your own cameras");
      if (diskChoice != null) {
        if (diskChoice > 0) add(onGateway ? "CCTV" : "Network", 1, fmtTB(diskChoice) + " NVMe SSD",
          "Chosen size for the " + selG.name + (onGateway ? ". About " + Math.min(+S.retention, gwDiskDays) + " days of 24/7 recording" : ". For future CCTV recording or backups"));
      } else if (onGateway) add("CCTV", selG.bays || 1, fmtTB(driveTB) + " " + (nvmeGw ? "NVMe SSD" : selG.media || "recording drive"), "Fits in the " + selG.name + (selG.bays > 1 ? ", mirrored so a failed drive loses nothing" : "") + ". About " + S.retention + " days of 24/7 recording");
      if (selNVR) {
        add("CCTV", 1, selNVR.full, "Records " + cams + " camera" + (cams > 1 ? "s" : "") + " (up to " + selNVR.maxCams + " at 2K). " + selNVR.blurb);
        if (nvrDrives) add("CCTV", nvrDrives.count, nvrDrives.size + " TB surveillance hard drive", "About " + S.retention + " days of 24/7 recording" + (nvrDrives.protected ? ", one drive's worth of protection if a drive fails" : ""));
      }
      if (coreRuns) add("Cabling", coreRuns, "Cat6 runs for the router" + (linkRuns ? " and switch" : ""), "1 run to the " + selG.name + (linkRuns ? " + 1 linking it to the switch" : "") + ". Terminated, tested, labelled both ends");
      add("Cabling", apRuns, "Cat6 runs for Wi-Fi & wired points", "Terminated, tested, labelled both ends");
      add("Cabling", camRuns, "Cat6 runs for cameras", "External-grade cable where it runs outside");

      var nets = [biz ? "Staff" : "Main"];
      if (S.uses.indexOf("guest") >= 0 || S.guests > 0) nets.push("Guest (isolated)");
      if (S.uses.indexOf("smarthome") >= 0) nets.push("Smart devices / IoT");
      if (S.uses.indexOf("pos") >= 0) nets.push("Payments (locked down)");
      if (cams) nets.push("Cameras (no internet access)");
      if (phones) nets.push("Phones");

      var notes = [];
      if (diskChoice === 0 && onGateway) notes.push(["warn", "No disk is chosen for the " + selG.name + ", so it can't record the cameras. Pick a storage size, or choose a separate recorder in step 4."]);
      else if (diskChoice != null && onGateway && diskChoice < driveTB) notes.push(["warn", "The " + fmtTB(diskChoice) + " drive holds about " + gwDiskDays + " days of 24/7 recording from " + cams + " camera" + (cams > 1 ? "s" : "") + ", less than the " + S.retention + " days chosen. " + fmtTB(driveTB) + " covers it."]);
      if (!selG) notes.push(["", "You keep your existing router. UniFi access points and switches still need a UniFi controller, so a Cloud Key is listed (or the UniFi Network app can run on a computer that stays on)."]);
      if (builtIn) notes.push(["", "The " + selG.name + " has Wi-Fi built in, so it covers one area itself (" + builtInFloor.toLowerCase() + ", where the internet comes in)."]);
      if (noAP) notes.push(["", "No indoor access points are planned" + (builtIn ? " beyond the gateway's built-in Wi-Fi" : "") + "."]);
      if (apChanged) notes.push(["", "Access point numbers have been changed from our suggestion (" + (indoorSugg + outdoorSugg + outbuildSugg) + " suggested, " + totalAPs + " planned). Power, switch and cabling are worked out on the planned number."]);
      if (injectors) notes.push(["warn", "Without a PoE switch, each access point" + (cams ? " and camera" : "") + " needs its own PoE injector and a power socket near the network kit."]);
      if (selNVR && selNVR.id === "unvr-instant") notes.push(["", "The UNVR Instant has PoE ports of its own, so some cameras can plug straight into it. We'll confirm at the survey whether that lets us use a smaller switch."]);
      if (onvifCams) notes.push(["", "Existing network cameras are added to UniFi Protect using ONVIF, the open standard most IP cameras support, with no licence fee. They record 24/7 and show live in the Protect app. Smart detections, PTZ control and two-way audio depend on the camera and may not carry across. " + (aiPorts ? "The AI Port adds UniFi's people and vehicle detection." : "A UniFi AI Port can add people and vehicle detection if wanted.")]);
      if (replaced) notes.push(["warn", "Analogue (coax) cameras can't connect to UniFi Protect, so the plan swaps them for UniFi cameras. If you'd rather keep them, they stay on their own DVR, separate from Protect."]);
      if (cctv && S.camKind === "unsure" && S.camsExisting) notes.push(["warn", "We'll check at the survey whether the existing cameras are IP (ONVIF) or analogue. That decides whether they can be kept."]);
      if (S.internet === "fttc") notes.push(["warn", "The internet line is part-fibre. New Wi-Fi gives great coverage, but it can't make the line itself faster. It's worth asking the provider about full fibre."]);
      if (S.internet === "wireless") notes.push(["", "5G and Starlink work well with UniFi. We'll place the receiver for best signal and run its cable to the cabinet."]);
      if (S.walls === "solid") notes.push(["", "Thick walls block Wi-Fi, so we plan an access point per main area rather than relying on signal passing through walls."]);
      if (S.cabling !== "none") notes.push(["", "We'll test the existing cables first. Good Cat5e/Cat6 runs are reused, which cuts time and cost."]);
      if (S.routes === "hard") notes.push(["warn", "Difficult cable routes take longer. Where a run isn't practical we can use a wall-mounted or mesh access point instead."]);
      if (S.uses.indexOf("pos") >= 0) notes.push(["", "Card machines go on their own locked-down network, separate from staff and guests."]);

      var checks = [
        "Where the internet comes in and where the cabinet will live (power socket nearby)",
        "Cable routes to each access point: loft, floor voids, risers, external walls",
        "Exact access point positions (" + floors.map(function (f) { return f.name.toLowerCase(); }).join(", ") + ")",
        "Any dead spots or rooms that matter most"
      ];
      if (outdoorAPs || outbuildAPs) checks.push("Outside mounting points, cable entry and distance to outbuildings");
      if (newCams) checks.push("Camera positions, viewing angles, lighting at night");
      if (onvifCams) checks.push("Existing cameras: make/model, ONVIF enabled, firmware, admin passwords, PoE or separate power");
      if (cctv && S.camsExisting && S.camKind === "unsure") checks.push("Confirm whether existing cameras are IP or analogue");
      if (biz) checks.push("Opening hours / best times to work, and building or landlord permissions");
      if (S.walls === "solid" || S.type === "warehouse") checks.push("Wi-Fi signal test on site to confirm access point spacing");

      return { recNoSW: recNoSW, noGW: noGW, noAP: noAP, noSW: noSW, builtIn: builtIn, builtInFloor: builtInFloor, injectors: injectors, roomSw: roomSw, biz: biz, totalArea: totalArea, floors: floors, devices: Math.round(devices),
        indoor: indoor, indoorSugg: indoorSugg, outdoorAPs: outdoorAPs, outdoorSugg: outdoorSugg, outdoorAreas: outdoorAreas, outbuildAPs: outbuildAPs, outbuildSugg: outbuildSugg, apChanged: apChanged,
        totalAPs: totalAPs, recAP: recAP, selAP: selAP, apCountFor: apCountFor, cams: cams, newCams: newCams, onvifCams: onvifCams,
        replaced: replaced, aiPorts: aiPorts, storageTB: storageTB, driveTB: driveTB, needNVR: needNVR, onGateway: onGateway, selNVR: selNVR, recNVR: recNVR, nvrDrives: nvrDrives, drivesFor: drivesFor,
        nvrFits: nvrFits, canRecord: canRecord, gwStore: gwStore, recRec: recRec, nvmeGw: nvmeGw, diskChoice: diskChoice, gwDiskDays: gwDiskDays, recReason: recReason, nvrWarn: nvrWarn, gwThatRecords: gwThatRecords,
        loadUnits: loadUnits, loadOnGw: loadOnGw, loadOffGw: loadOffGw, recG: recG, selG: selG, speedOk: speedOk,
        gwLoad: gwLoad, gwWarn: gwWarn, poeNeed: poeNeed, portNeed: portNeed, poeWatts: poeWatts, apWatts: apWatts, camWatts: camWatts, phones: phones, recSW: recSW, selSW: selSW,
        swCount: swCount, swMulti: swMulti, swNote: swNote, swLimits: swLimits, swCountFor: swCountFor, apRuns: apRuns, camRuns: camRuns, coreRuns: coreRuns, routerRuns: routerRuns, linkRuns: linkRuns, newRuns: newRuns, hours: hours, days: days, kit: kit, nets: nets,
        notes: notes, checks: checks, cabinet: cabinet };
    }

    /* ---------- icons / pickers ---------- */
    function icon(shape) {
      var g = 'fill="#ececf0" stroke="#d1d1d6"', i, r = "";
      switch (shape) {
        case "rack": return '<svg viewBox="0 0 90 40" aria-hidden="true"><rect x="4" y="15" width="82" height="10" rx="1.5" fill="#d9d9de"/><rect x="8" y="18" width="30" height="4" rx="1" fill="#8e8e93"/><rect x="62" y="18" width="18" height="4" rx="1" fill="#b0b0b5"/></svg>';
        case "none": return '<svg viewBox="0 0 90 40" aria-hidden="true"><circle cx="45" cy="20" r="13" fill="none" stroke="#c7c7cc" stroke-width="2" stroke-dasharray="4 3"/><line x1="36" y1="29" x2="54" y2="11" stroke="#c7c7cc" stroke-width="2"/></svg>';
        case "cube": return '<svg viewBox="0 0 90 40" aria-hidden="true"><rect x="31" y="6" width="28" height="28" rx="7" ' + g + '/><rect x="38" y="14" width="14" height="5" rx="1.5" fill="#8e8e93"/></svg>';
        case "mini": for (i = 0; i < 5; i++) r += '<rect x="' + (33 + i * 5) + '" y="18" width="3.5" height="4" rx=".5" fill="#8e8e93"/>'; return '<svg viewBox="0 0 90 40" aria-hidden="true"><rect x="28" y="13" width="34" height="14" rx="3" ' + g + '/>' + r + "</svg>";
        case "tower": return '<svg viewBox="0 0 90 40" aria-hidden="true"><rect x="36" y="3" width="18" height="34" rx="6" ' + g + '/><circle cx="45" cy="14" r="1.6" fill="#8e8e93"/></svg>';
        case "desk": return '<svg viewBox="0 0 90 40" aria-hidden="true"><rect x="18" y="16" width="54" height="10" rx="3" ' + g + '/><rect x="40" y="19.5" width="10" height="3" rx="1.5" fill="#8e8e93"/></svg>';
        case "disc-s": return '<svg viewBox="0 0 90 40" aria-hidden="true"><circle cx="45" cy="20" r="12" ' + g + '/><circle cx="45" cy="20" r="2" fill="#0f62ea" opacity=".5"/></svg>';
        case "disc": return '<svg viewBox="0 0 90 40" aria-hidden="true"><rect x="30" y="5" width="30" height="30" rx="8" ' + g + '/><circle cx="45" cy="20" r="2.2" fill="#0f62ea" opacity=".5"/></svg>';
        case "disc-l": return '<svg viewBox="0 0 90 40" aria-hidden="true"><rect x="27" y="2" width="36" height="36" rx="9" ' + g + '/><circle cx="45" cy="20" r="2.6" fill="#0f62ea" opacity=".5"/></svg>';
        case "wall": return '<svg viewBox="0 0 90 40" aria-hidden="true"><rect x="35" y="2" width="20" height="36" rx="4" ' + g + '/><rect x="42" y="31" width="6" height="2" rx="1" fill="#8e8e93"/></svg>';
        case "plate": return '<svg viewBox="0 0 90 40" aria-hidden="true"><rect x="31" y="6" width="28" height="28" rx="3" ' + g + '/><rect x="38" y="24" width="6" height="4" rx=".5" fill="#8e8e93"/><rect x="46" y="24" width="6" height="4" rx=".5" fill="#8e8e93"/></svg>';
        case "switch-s": for (i = 0; i < 4; i++) r += '<rect x="' + (40 + i * 7) + '" y="18" width="5" height="4" rx=".5" fill="#8e8e93"/>'; return '<svg viewBox="0 0 90 40" aria-hidden="true"><rect x="18" y="14" width="54" height="12" rx="2" ' + g + '/>' + r + "</svg>";
        default: for (i = 0; i < 8; i++) r += '<rect x="' + (30 + i * 6) + '" y="18" width="4.5" height="4" rx=".5" fill="#8e8e93"/>'; return '<svg viewBox="0 0 90 40" aria-hidden="true"><rect x="4" y="15" width="82" height="10" rx="1.5" fill="#d9d9de"/>' + r + "</svg>";
      }
    }
    var NONE_LABEL = { gw: "Keep own router", ap: "No indoor APs", sw: "No switch" };
    function picker(kind, list, selId, recId, label, noNone) {
      if (!noNone) list = [{ id: "none", name: "None", shape: "none" }].concat(list);
      var base = label;
      label = function (it) { return it.id === "none" ? { text: NONE_LABEL[kind] } : base(it); };
      return '<div class="picks" data-picks="' + kind + '">' + list.map(function (it) {
        var l = label(it);
        return '<button type="button" class="pc' + (l.bad ? " no" : l.multi ? " multi" : "") + '" data-pick="' + kind + '" data-v="' + it.id + '" aria-pressed="' + (it.id === selId) + '">' +
          (it.id === recId ? '<span class="rec">Recommended</span>' : "") + icon(it.shape) + "<b>" + it.name + "</b><small>" + l.text + "</small></button>";
      }).join("") + "</div>";
    }
    function meter(label, frac, sub, kind) {
      var c = frac > 1 ? "var(--cpwp-bad)" : frac > 0.85 ? "var(--cpwp-bad)" : frac > 0.6 ? "var(--cpwp-amber)" : "var(--cpwp-ok)";
      return '<div class="meter" data-meter="' + kind + '"><div class="mh"><span>' + label + "</span><b>" + Math.round(frac * 100) + "%</b></div>" +
        '<div class="bar"><i style="width:' + Math.min(100, frac * 100) + "%;background:" + c + '"></i></div>' + (sub ? '<div class="tag" style="margin-top:6px">' + sub + "</div>" : "") + "</div>";
    }

    /* ---------- plan page ---------- */
    function renderPlan() {
      var P = plan();
      var today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
      var n = 5;
      function result(label, html) { return '<div class="pick-result"><span>' + label + "</span><b>" + html + "</b></div>"; }
      function qtyCtl(key, val, sugg) {
        return '<div class="qty"><button type="button" data-apadj="' + esc(key) + '" data-s="' + sugg + '" data-val="' + val + '" data-d="-1" aria-label="One fewer"' + (val <= 0 ? " disabled" : "") + '>−</button><output>' + val + '</output><button type="button" data-apadj="' + esc(key) + '" data-s="' + sugg + '" data-val="' + val + '" data-d="1" aria-label="One more">+</button></div>' +
          '<small class="was' + (val === sugg ? ' same" aria-hidden="true' : "") + '">suggested ' + sugg + "</small>";   // always rendered so the row height never changes
      }
      var h = '<div class="meta"><div><span>Project</span>' + esc(S.project || "—") + "</div><div><span>Name</span>" + esc(S.customer || "—") + "</div><div><span>Postcode</span>" + esc(S.postcode || "—") + "</div><div><span>Prepared</span>" + today + "</div></div>" +
        '<div class="section"><div class="kpis k4" style="margin:0" data-r="planKpis">' +
        '<div class="kpi"><b>' + P.totalAPs + '</b><span>Access points</span></div><div class="kpi"><b>' + P.cams + '</b><span>Cameras</span></div>' +
        '<div class="kpi"><b>' + P.newRuns + '</b><span>New cable runs</span></div><div class="kpi"><b>' + fmtDaysNum(P.days) + "</b><span>Days on site</span></div></div></div>";

      // 1. Gateway
      h += '<div class="section" data-sec="gateway"><h3>1. Gateway</h3><p class="tag">The box that runs the whole network' + (P.cams ? (P.onGateway ? " and records the cameras" : "") : "") + ". Tap another to compare, or pick None to keep your current router.</p>" +
        picker("gw", CONFIG.gateways, P.selG ? P.selG.id : "none", P.recG.id, function (g) {
          var ld = Math.min(999, Math.round((P.cams && P.canRecord(g) && !(S.rec && S.rec !== "gw") ? P.loadOnGw : P.loadOffGw) / g.cap * 100)) + "% load";
          if (!P.speedOk(g)) return { text: "Too slow for your fibre", bad: true };
          if (P.cams) return { text: ld + (P.canRecord(g) ? " · records" : " · needs NVR") };
          return { text: ld + (g.wifi ? " · Wi-Fi" : "") };
        }) +
        (P.selG ? result("Planned", "1 × " + esc(P.selG.full)) + meter("Estimated load on " + P.selG.name, P.gwLoad, P.totalAPs + " APs · ~" + P.devices + " devices" + (P.cams ? " · " + P.cams + " cameras" + (P.onGateway ? " recorded here" : " on a separate NVR") : "") + (P.biz ? " · IPS/IDS on" : "") + '. Rough guide. Confirm on Ubiquiti\'s <a href="https://calculator.ui.com" target="_blank" rel="noopener">capacity calculator</a>.', "gw")
          : '<div class="note" style="margin-top:8px">No UniFi gateway: you keep your existing router.</div>') +
        P.gwWarn.map(function (w) { return '<div class="note warn" style="margin-top:8px">' + w + "</div>"; }).join("") + "</div>";

      // 1b. Storage for NVMe gateways
      if (P.nvmeGw) {
        var dOpts = [["auto", "Auto", P.onGateway ? fmtTB(P.driveTB) : P.cams ? "recording on NVR" : "none needed"], ["0", "No disk", "network only"]]
          .concat([0.256, 0.512, 1, 2].filter(function (x) { return x <= P.selG.maxTB; }).map(function (x) { return [String(x), fmtTB(x), "NVMe SSD"]; }));
        h += '<div class="section" data-sec="gwdisk" style="margin-top:16px"><div class="ql" style="font-weight:600;margin-bottom:8px">Storage for the ' + esc(P.selG.name) +
          ' <span class="hint">' + (P.cams ? "for camera recordings" : "optional, for future CCTV or backups") + "</span></div>" + chips("gwDisk", dOpts) + "</div>";
      }

      // 2. Access points
      var apName = P.selAP ? P.selAP.name : "—";
      h += '<div class="section" data-sec="aps"><h3>2. Wi-Fi access points</h3><p class="tag">The units that give the Wi-Fi signal. Pick a model, then use + and − to add or remove units in any area. Power and switches update as you go.</p>' +
        picker("ap", CONFIG.aps, P.selAP ? P.selAP.id : "none", P.recAP.id, function (a) { return { text: P.apCountFor(a) + " indoor · " + a.watts + " W" }; }) +
        '<table class="apt" style="margin-top:12px"><thead><tr><th>Area</th><th>Unit</th><th class="n">Qty</th></tr></thead><tbody>' +
        (P.selAP ? P.floors.map(function (f) { return "<tr><td>" + f.name + ' <span class="tag">~' + Math.round(f.area) + ' m²</span></td><td class="m">' + apName + '</td><td class="n">' + qtyCtl(f.key, f.aps, f.sugg) + "</td></tr>"; }).join("")
          : '<tr><td>Indoors</td><td class="m">No access points</td><td class="n">0</td></tr>') +
        (P.builtIn ? "<tr><td>" + P.builtInFloor + ' <span class="tag">built into gateway</span></td><td class="m">' + P.selG.name + '</td><td class="n"><span class="fixed">1</span></td></tr>' : "") +
        "<tr><td>Outside" + (P.outdoorAreas.length ? ' <span class="tag">' + P.outdoorAreas.map(function (o) { return OUT_LABEL[o]; }).join(", ") + "</span>" : "") + '</td><td class="m">' + CONFIG.apOutdoor.name + '</td><td class="n">' + qtyCtl("outdoor", P.outdoorAPs, P.outdoorSugg) + "</td></tr>" +
        (P.outbuildSugg || P.outbuildAPs ? '<tr><td>Outbuildings</td><td class="m">' + CONFIG.apOutbuilding.name + '</td><td class="n">' + qtyCtl("outbuild", P.outbuildAPs, P.outbuildSugg) + "</td></tr>" : "") +
        '</tbody><tfoot><tr><td colspan="2">Total' + (P.selAP || P.outdoorAPs ? ' <span class="tag">~' + Math.round(P.apWatts) + " W of PoE power</span>" : "") + '</td><td class="n"><b>' + (P.totalAPs + P.builtIn) + "</b></td></tr></tfoot></table>" +
        (P.apChanged ? '<div class="row-end"><button type="button" class="linkbtn" data-r="apReset">Reset to suggested (' + (P.indoorSugg + P.outdoorSugg + P.outbuildSugg) + ")</button></div>" : "") +
        '<p class="tag" style="margin-top:8px">' + TYPE_LABEL[S.type] + ", ~" + Math.round(P.totalArea) + " m², around " + P.devices + " devices at busy times." + (P.selAP ? " " + P.selAP.blurb + "." : "") + "</p></div>";

      // 3. Switch
      var sw = P.selSW, poeSw = sw && sw.poe > 0;
      h += '<div class="section" data-sec="switch"><h3>3. Switch</h3><p class="tag">Connects the access points' + (P.cams ? " and cameras" : "") + " and wired points. A PoE switch also powers them over the same cable. If one switch isn't enough, the plan works out how many you need.</p>" +
        picker("sw", CONFIG.switches, sw ? sw.id : "none", P.recSW ? P.recSW.id : "none", function (s) {
          var c = P.swCountFor(s);
          if (!s.poe) return P.poeNeed ? { text: "No PoE · injectors", bad: true } : { text: s.ports + " ports" + (c > 1 ? " · " + c + " needed" : "") };
          if (c === 1) return { text: s.poe + " PoE · " + s.budget + " W" };
          var lim = P.swLimits(s);
          return { text: c + " needed" + (lim.length ? " · " + lim[0] : ""), multi: true };
        }) +
        (sw ? result("Planned", (P.swMulti ? '<em class="count">' + P.swCount + " ×</em> " : "1 × ") + esc(sw.full)) : "") +
        (P.swNote ? '<div class="note warn" style="margin-top:8px">' + P.swNote + "</div>" : "") +
        (poeSw ? meter("PoE ports used" + (P.swMulti ? " across " + P.swCount + " switches" : ""), P.poeNeed / (sw.poe * P.swCount),
          P.totalAPs + " access point" + (P.totalAPs === 1 ? "" : "s") + (P.cams ? " + " + P.cams + " camera" + (P.cams === 1 ? "" : "s") : "") + (P.phones ? " + " + P.phones + " phones" : "") + (P.aiPorts ? " + " + P.aiPorts + " AI Port" + (P.aiPorts > 1 ? "s" : "") : "") + " · " + P.portNeed + " ports needed in total", "ports") +
          meter("PoE power used", P.poeWatts / (sw.budget * P.swCount), "~" + Math.round(P.poeWatts) + " W at maximum draw (APs ~" + Math.round(P.apWatts) + " W" + (P.cams ? ", cameras ~" + Math.round(P.camWatts) + " W" : "") + ") of " + sw.budget * P.swCount + " W available", "watts") : "") +
        (P.recNoSW && !sw ? '<div class="note" style="margin-top:8px">No switch needed: the ' + P.selG.name + "'s own ports cover the wired points.</div>" : "") +
        (P.injectors ? '<div class="note warn" style="margin-top:8px">' + (sw ? "This switch has no PoE output, so " : "No switch, so ") + P.injectors + " PoE injector" + (P.injectors > 1 ? "s are" : " is") + " added to power the access points" + (P.cams ? " and cameras" : "") + ".</div>" : "") +
        '<div class="inline-qs"><div class="q"><div class="ql">Wired points <span class="hint">TV, desk, console, printer</span></div>' + stepperInput("wired") + "</div>" +
        '<div class="q"><div class="ql">Extra small switches <span class="hint">behind a TV, on a desk</span></div><div class="inline-row">' +
        chips("roomSw", CONFIG.roomSwitches.map(function (id) { var x = CONFIG.switches.filter(function (s) { return s.id === id; })[0]; return [id, x.name]; })) +
        stepperInput("roomSwQty") + "</div></div></div></div>";

      // 4. CCTV & recording
      if (P.cams) {
        var recList = [{ id: "gw", name: "On gateway", shape: P.selG ? P.selG.shape : "none" }].concat(CONFIG.nvrs);
        h += '<div class="section" data-sec="cctv"><h3>4. CCTV &amp; recording</h3><p class="tag">Where the cameras record. Recording on the gateway saves a box; a separate NVR (recorder) takes more cameras and storage and lets the gateway be smaller.</p>' +
          '<div class="nvr-q ' + (P.needNVR ? "yes" : "no") + '"><span>NVR needed?</span><b>' + P.recReason + "</b></div>" +
          picker("rec", recList, P.onGateway ? "gw" : P.selNVR.id, P.recRec, function (r) {
            if (r.id === "gw") return P.canRecord(P.selG) ? { text: fmtTB(P.driveTB) + " in " + P.selG.name } : { text: P.selG ? (P.selG.protect ? "Too small for this" : "Can't record") : "No gateway", bad: true };
            return P.nvrFits(r) ? { text: "up to " + r.maxCams + " cams · " + r.bays + " bay" + (r.bays > 1 ? "s" : "") } : { text: "max " + r.maxCams + " cams", bad: true };
          }, true) +
          P.nvrWarn.map(function (w) { return '<div class="note warn" style="margin-top:8px">' + w + "</div>"; }).join("") +
          '<table style="margin-top:12px"><tbody>' +
          '<tr><td>New UniFi cameras</td><td class="m">' + (P.replaced ? "includes " + P.replaced + " replacing analogue" : "G5 range, smart detections") + '</td><td class="n">' + stepperInput("camsNew") + "</td></tr>" +
          (P.onvifCams ? '<tr><td>Your own cameras (ONVIF)</td><td class="m">24/7 recording, live view</td><td class="n">' + P.onvifCams + "</td></tr>" : "") +
          (P.aiPorts ? '<tr><td>AI Port</td><td class="m">smart detections for own cameras</td><td class="n">' + P.aiPorts + "</td></tr>" : "") +
          '<tr><td>Recording</td><td class="m">' + (P.onGateway ? "on the " + P.selG.name : "on the " + P.selNVR.name) + "</td><td class=\"n\">" + (P.onGateway ? "1" : "1") + "</td></tr>" +
          '<tr><td>Storage</td><td class="m">' + S.retention + " days 24/7, ~" + fmtTB(P.storageTB) + ' needed</td><td class="n">' + (P.onGateway ? (P.selG.bays > 1 ? "2 × " : "") + fmtTB(P.driveTB) : P.nvrDrives ? P.nvrDrives.count + " × " + P.nvrDrives.size + " TB" : "—") + "</td></tr></tbody></table></div>";
      } else {
        h += '<div class="section" data-sec="cctv"><h3>4. CCTV</h3><p class="tag">No cameras in this plan.</p><button type="button" class="btn ghost small" data-r="addCctv">Add CCTV cameras</button></div>';
      }

      h += '<div class="section" data-sec="kit"><h3>' + n + '. Full kit list</h3><table><thead><tr><th>Item</th><th>Why</th><th class="n">Qty</th></tr></thead><tbody>' +
        ["Network", "Wi-Fi", "CCTV", "Cabling"].map(function (g) {
          var rows = P.kit.filter(function (k) { return k.group === g; });
          return rows.length ? '<tr class="grp"><td colspan="3">' + g + "</td></tr>" + rows.map(function (k) { return "<tr><td>" + esc(k.item) + '</td><td class="m">' + esc(k.why) + '</td><td class="n">' + k.q + "</td></tr>"; }).join("") : "";
        }).join("") + "</tbody></table></div>";

      h += '<div class="section"><h3>Networks we\'ll set up</h3><div class="chips" style="margin-top:8px">' + P.nets.map(function (x) { return '<span class="chip static">' + x + "</span>"; }).join("") + "</div></div>";
      if (P.notes.length) h += '<div class="section"><h3>Good to know</h3><div style="display:grid;gap:8px;margin-top:8px">' + P.notes.map(function (x) { return '<div class="note ' + x[0] + '">' + x[1] + "</div>"; }).join("") + "</div></div>";
      h += '<div class="section"><h3>What we\'ll check at the survey</h3><ul class="checks">' + P.checks.map(function (c) { return "<li>" + c + "</li>"; }).join("") + "</ul></div>";
      h += '<div class="section"><h3>What happens next</h3><div class="timeline"><div><b>1. Survey</b>We visit, confirm positions and cable routes.</div><div><b>2. Fixed quote</b>Itemised, based on this plan.</div><div><b>3. Install</b>About ' + fmtDays(P.days) + ' on site, tidy cabling.</div><div><b>4. Handover</b>Tested room by room, apps set up for you.</div></div></div>';
      if (S.notes) h += '<div class="section"><h3>Your notes</h3><p style="margin:0;white-space:pre-wrap">' + esc(S.notes) + "</p></div>";
      if (CONFIG.sendUrl) h += renderSend();
      h += '<div class="actions"><button type="button" class="btn primary" data-r="pdfBtn">Export PDF</button><button type="button" class="btn ghost" data-r="copyBtn">Copy plan</button>' +
        '<button type="button" class="btn ghost" data-r="editBtn">Edit answers</button></div>' +
        '<p class="disclaimer">This is a planning estimate. Final equipment, positions and price are confirmed after a site survey.</p>';
      return h;
    }

    function renderSend() {
      if (S.sendState === "sent") {
        return '<div class="section send-plan sent" data-r="sendBox"><h3>Plan sent</h3><p>Thanks' + (S.customer ? ", " + esc(S.customer.split(" ")[0]) : "") +
          '. CityPlug has your plan and will reply to ' + esc(S.sendEmail) + ' about a survey and a fixed quote.</p></div>';
      }
      var busy = S.sendState === "sending";
      return '<div class="section send-plan" data-r="sendBox"><h3>Send this plan to CityPlug</h3>' +
        '<p class="sub">We\'ll look over your plan and get back to you about a free survey and a fixed quote. Nothing is sent until you press Send.</p>' +
        '<div class="row2"><div class="q"><label for="cpwp-s-name">Your name</label><input type="text" id="cpwp-s-name" data-t="customer" autocomplete="name" maxlength="80" value="' + esc(S.customer) + '"></div>' +
        '<div class="q"><label for="cpwp-s-email">Email</label><input type="email" id="cpwp-s-email" data-t="sendEmail" autocomplete="email" maxlength="120" value="' + esc(S.sendEmail) + '"></div></div>' +
        '<div class="row2"><div class="q"><label for="cpwp-s-phone">Phone <span class="hint">optional</span></label><input type="tel" id="cpwp-s-phone" data-t="sendPhone" autocomplete="tel" maxlength="20" value="' + esc(S.sendPhone) + '"></div>' +
        '<div class="q"><label for="cpwp-s-postcode">Postcode</label><input type="text" id="cpwp-s-postcode" data-t="postcode" autocomplete="postal-code" maxlength="10" placeholder="SE1 7PB" value="' + esc(S.postcode) + '"></div></div>' +
        '<div class="hp" aria-hidden="true"><label for="cpwp-s-web">Leave this empty</label><input type="text" id="cpwp-s-web" data-t="sendHp" tabindex="-1" autocomplete="off"></div>' +
        '<label class="consent"><input type="checkbox" data-c="sendConsent"' + (S.sendConsent ? " checked" : "") + '> <span>I\'m happy for CityPlug to use these details and this plan to reply to me. See the <a href="' + esc(CONFIG.privacyUrl) + '">privacy notice</a>.</span></label>' +
        '<div class="actions"><button type="button" class="btn primary" data-r="sendBtn"' + (busy ? " disabled" : "") + '>' + (busy ? "Sending…" : "Send this plan") + '</button></div>' +
        '<p class="send-status" role="status" aria-live="polite" data-r="sendStatus"></p></div>';
    }
    function sendProblem() {
      if (String(S.customer).trim().length < 2) return ["Please add your name.", "cpwp-s-name"];
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(S.sendEmail).trim())) return ["Please add a valid email address.", "cpwp-s-email"];
      if (S.sendPhone && !/^[\d\s\-()+]{7,20}$/.test(String(S.sendPhone).trim())) return ["That phone number doesn't look right. It's optional, so you can leave it blank.", "cpwp-s-phone"];
      if (!/^[A-Za-z]{1,2}\d[A-Za-z\d]?(\s*\d[A-Za-z]{2})?$/.test(String(S.postcode).trim())) return ["Please add your postcode (the first part is fine, e.g. SE1).", "cpwp-s-postcode"];
      if (!S.sendConsent) return ["Please tick the box so we can reply to you.", null];
      return null;
    }
    function sendPlan() {
      var status = R("sendStatus"), problem = sendProblem();
      if (problem) {
        status.textContent = problem[0]; status.className = "send-status bad";
        if (problem[1]) { var fld = root.querySelector("#" + problem[1]); if (fld) fld.focus(); }
        return;
      }
      S.sendState = "sending"; rerenderKeepScroll();
      var P = plan(), ref = planRef();
      ensurePdfLibs().then(function () {
        var blob = buildPDF().output("blob");
        var fd = new FormData();
        fd.append("name", String(S.customer).trim()); fd.append("email", String(S.sendEmail).trim());
        fd.append("phone", String(S.sendPhone).trim()); fd.append("postcode", String(S.postcode).trim());
        fd.append("consent", "yes"); fd.append("website", S.sendHp || "");
        fd.append("elapsed", String(Math.round((Date.now() - startedAt) / 1000)));
        fd.append("ref", ref); fd.append("project", S.project || "");
        fd.append("property", TYPE_LABEL[S.type] || S.type);
        fd.append("size", (isBiz() ? P.totalArea + " m²" : S.beds + " bed") + ", " + S.floors + (S.floors === 1 ? " floor" : " floors"));
        fd.append("aps", String(P.totalAPs)); fd.append("cams", String(P.cams)); fd.append("days", fmtDays(P.days));
        fd.append("gateway", P.selG ? P.selG.full : "Keeping own router");
        fd.append("notes", S.notes || "");
        fd.append("pdf", blob, "plan.pdf");
        var ctl = typeof AbortController === "function" ? new AbortController() : null;
        var timer = ctl ? setTimeout(function () { ctl.abort(); }, 25000) : null;
        return fetch(CONFIG.sendUrl, { method: "POST", body: fd, mode: "cors", credentials: "omit", signal: ctl ? ctl.signal : undefined })
          .then(function (res) { if (timer) clearTimeout(timer); if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
          .then(function (j) { if (!j || !j.ok) throw new Error("not ok"); });
      }).then(function () {
        S.sendState = "sent"; rerenderKeepScroll();
        var box = R("sendBox"); if (box) box.scrollIntoView({ behavior: "smooth", block: "center" });
      }).catch(function (e) {
        S.sendState = ""; rerenderKeepScroll();
        var st = R("sendStatus");
        if (st) { st.textContent = "Sorry, that didn't send. Please try again, or press Export PDF and email it to " + CONFIG.email + "."; st.className = "send-status bad"; }
        if (window.console) console.error("[CityPlug planner] send failed:", e);
      });
    }

    function planText() {
      var P = plan(), L = [];
      L.push(CONFIG.company + " Wi-Fi plan" + (S.project ? " — " + S.project : ""));
      if (S.customer) L.push("Name: " + S.customer);
      if (S.postcode) L.push("Postcode: " + S.postcode);
      L.push("", "Access points: " + P.totalAPs + " | Cameras: " + P.cams + " | New cable runs: " + P.newRuns + " | On site: " + fmtDays(P.days));
      ["Network", "Wi-Fi", "CCTV", "Cabling"].forEach(function (g) {
        var r = P.kit.filter(function (k) { return k.group === g; });
        if (r.length) { L.push("", g.toUpperCase()); r.forEach(function (k) { L.push(k.q + " x " + k.item); }); }
      });
      L.push("", "ACCESS POINTS BY AREA");
      if (P.selAP) P.floors.forEach(function (f) { L.push(f.name + ": " + f.aps + " x " + P.selAP.name); }); else L.push("Indoors: none");
      if (P.builtIn) L.push(P.builtInFloor + ": built into " + P.selG.name);
      if (P.outdoorAPs) L.push("Outside: " + P.outdoorAPs + " x " + CONFIG.apOutdoor.name);
      if (P.outbuildAPs) L.push("Outbuildings: " + P.outbuildAPs + " x " + CONFIG.apOutbuilding.name);
      L.push("", "NETWORKS: " + P.nets.join(", "), "", "SURVEY CHECKS");
      P.checks.forEach(function (c) { L.push("- " + c); });
      if (S.notes) L.push("", "NOTES", S.notes);
      L.push("", "Planning estimate — confirmed after site survey.");
      return L.join("\n");
    }

    /* ---------- PDF export ---------- */
    function ensurePdfLibs() {
      var hasJ = function () { return window.jspdf && window.jspdf.jsPDF; };
      var hasT = function () { return hasJ() && typeof window.jspdf.jsPDF.API.autoTable === "function"; };
      return (hasJ() ? Promise.resolve() : loadScript(CONFIG.pdfLibs.jspdf))
        .then(function () { return hasT() ? null : loadScript(CONFIG.pdfLibs.autotable); })
        .then(function () { if (!hasT()) throw new Error("PDF library unavailable"); })
        .then(ensureBrand);
    }
    function pdfFileName() {
      var d = new Date(), ds = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
      var p = (S.project || "plan").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "plan";
      return CONFIG.company.replace(/\s+/g, "") + "-WiFi-Plan-" + p + "-" + ds + ".pdf";
    }
    function pdfSafe(t) { return String(t).replace(/m²/g, "sq m").replace(/²/g, "2").replace(/(\d)½/g, "$1.5").replace(/½/g, "0.5").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, "..."); }
    function loadImg(src) {
      return new Promise(function (res) {
        var im = new Image();
        im.onload = function () {   // hand jsPDF a data URL: given a URL it would try to fetch it, which the page's CSP blocks
          try { var c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext("2d").drawImage(im, 0, 0);
            res({ data: c.toDataURL("image/png"), w: im.naturalWidth, h: im.naturalHeight }); } catch (e) { res(null); }
        };
        im.onerror = function () { res(null); };
        im.src = /^https?:|^\/|^data:/.test(src) ? src : SCRIPT_BASE + src;
      });
    }
    var BRAND = null;
    function ensureBrand() {
      if (BRAND) return Promise.resolve(BRAND);
      return Promise.all([loadImg(CONFIG.pdfBrand.logo), loadImg(CONFIG.pdfBrand.stamp)]).then(function (r) { BRAND = { logo: r[0], stamp: r[1] }; return BRAND; });
    }
    function planRef() {
      var d = new Date(), ds = d.getFullYear() + ("0" + (d.getMonth() + 1)).slice(-2) + ("0" + d.getDate()).slice(-2);
      var p = (S.project || S.postcode || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
      return "CP-" + ds + (p ? "-" + p : "");
    }
    function buildPDF() {
      var P = plan(), B = BRAND || {};
      var jsPDF = window.jspdf.jsPDF;
      var doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
      var A = CONFIG.accentRGB, INK = [16, 20, 24], MUTED = [104, 104, 110], LINE = [222, 222, 228], BG = [246, 246, 248], GOLD = [176, 128, 36], AMBER = [168, 98, 0];
      var M = 16, PW = 210, PH = 297, CW = PW - 2 * M, TOP = 26, y = 0;
      var today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
      var ref = planRef(), title = (S.project ? S.project + " " : "") + "Wi-Fi plan";
      var _text = doc.text.bind(doc), _split = doc.splitTextToSize.bind(doc);
      doc.text = function (t) { var a = Array.prototype.slice.call(arguments); a[0] = Array.isArray(t) ? t.map(pdfSafe) : pdfSafe(t); return _text.apply(null, a); };
      doc.splitTextToSize = function (t, w, o) { return _split(pdfSafe(t), w, o); };
      doc.setProperties({ title: CONFIG.company + " - " + title, subject: "Wi-Fi & CCTV installation plan", author: CONFIG.company, creator: CONFIG.website });
      function color(c, kind) { doc[kind === "fill" ? "setFillColor" : kind === "draw" ? "setDrawColor" : "setTextColor"](c[0], c[1], c[2]); }
      function fade(op, draw) {   // draw at reduced opacity (PDF graphics state); full opacity again afterwards
        var G = op < 1 && doc.setGState && (doc.GState || (window.jspdf && window.jspdf.GState));
        if (G) doc.setGState(new G({ opacity: op }));
        try { draw(); } finally { if (G) doc.setGState(new G({ opacity: 1 })); }
      }
      function img(im, x, yy, h) { if (!im) return 0; var w = h * im.w / im.h, op = im === B.logo ? CONFIG.pdfOpacity.logo : im === B.stamp ? CONFIG.pdfOpacity.stamp : 1;
        try { fade(op, function () { doc.addImage(im.data, "PNG", x, yy, w, h, undefined, "FAST"); }); } catch (e) { return 0; } return w; }
      function ensure(hgt) { if (y + hgt > PH - 24) { doc.addPage(); y = TOP; } }
      function heading(num, t) {
        ensure(20); y += 9;
        doc.setFont("helvetica", "bold"); doc.setFontSize(12.5);
        var x = M;
        if (num) { color(A); doc.text(String(num), x, y); x += doc.getTextWidth(String(num)) + 2.5; }
        color(INK); doc.text(t, x, y); y += 2.5;
      }
      function para(t, size, col, bold) {
        doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size || 9.5); color(col || MUTED);
        var lines = doc.splitTextToSize(t, CW); ensure(lines.length * 4.4 + 2); doc.text(lines, M, y + 4); y += lines.length * 4.4 + 2;
      }
      function callout(t, warn) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(9);
        var lines = doc.splitTextToSize(t, CW - 10), hh = lines.length * 4.1 + 5.5;
        ensure(hh + 3);
        if (warn) doc.setFillColor(255, 245, 228); else doc.setFillColor(Math.round(255 - (255 - A[0]) * 0.08), Math.round(255 - (255 - A[1]) * 0.08), Math.round(255 - (255 - A[2]) * 0.08));
        doc.roundedRect(M, y + 1.5, CW, hh, 2, 2, "F");
        color(warn ? AMBER : A, "fill"); doc.rect(M, y + 1.5, 1.1, hh, "F");
        color(INK); doc.text(lines, M + 5, y + 6.6); y += hh + 2.5;
      }
      function table(head, body, opts) {
        var clean = function (row) { return row.map(function (c) { return typeof c === "string" ? pdfSafe(c) : (c && c.content ? Object.assign({}, c, { content: pdfSafe(c.content) }) : c); }); };
        body = body.map(clean); if (head) head = clean(head);
        if (head && typeof head[2] === "string") head[2] = { content: head[2], styles: { halign: "right" } };
        doc.autoTable(Object.assign({
          startY: y + 2.5, head: head ? [head] : undefined, body: body, margin: { left: M, right: M, top: TOP, bottom: 24 }, theme: "plain",
          styles: { font: "helvetica", fontSize: 9, cellPadding: { top: 2.3, bottom: 2.3, left: 2, right: 2 }, textColor: INK, lineColor: LINE, lineWidth: { bottom: 0.2 }, valign: "middle" },
          headStyles: { fontStyle: "bold", fontSize: 7.5, textColor: MUTED, lineWidth: { bottom: 0.35 }, lineColor: [200, 200, 206] },
          columnStyles: { 0: { fontStyle: "bold", cellWidth: 62 }, 1: { textColor: MUTED }, 2: { halign: "right", fontStyle: "bold", cellWidth: 18 } }
        }, opts || {}));
        y = doc.lastAutoTable.finalY + 2;
      }

      // ---- Letterhead (page 1) ----
      var lw = img(B.logo, M, 11, 14);
      var tx = M + (lw ? lw + 3.5 : 0);
      doc.setFont("helvetica", "bold"); doc.setFontSize(16);
      var co = CONFIG.company;
      if (co.indexOf("City") === 0) { color(INK); doc.text("City", tx, 19.2); color(A); doc.text(co.slice(4), tx + doc.getTextWidth("City"), 19.2); }
      else { color(INK); doc.text(co, tx, 19.2); }
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); color(MUTED); doc.text("Wi-Fi, CCTV & network installation", tx, 24);
      doc.setFontSize(8.5); color(INK);
      doc.text(CONFIG.website, PW - M, 15, { align: "right" });
      doc.text(CONFIG.email, PW - M, 19.5, { align: "right" });
      color(MUTED); doc.text(CONFIG.areas, PW - M, 24, { align: "right" });
      color(LINE, "draw"); doc.setLineWidth(0.25); doc.line(M, 30, PW - M, 30);
      color(A, "fill"); doc.rect(M, 29.6, 26, 0.8, "F");

      // Title block with the stamp on the right
      var stampH = 40, stampW = B.stamp ? stampH * B.stamp.w / B.stamp.h : 0;
      if (B.stamp) img(B.stamp, PW - M - stampW, 35, stampH);
      var tw = CW - (stampW ? stampW + 8 : 0);
      doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); color(A);
      doc.setCharSpace(0.6); doc.text("INSTALLATION PLAN", M, 43); var lblW = doc.getTextWidth("INSTALLATION PLAN") + 0.6 * 17; doc.setCharSpace(0);
      doc.setFont("helvetica", "normal"); color(MUTED); doc.text("Ref " + ref, M + lblW + 4, 43);
      doc.setFont("helvetica", "bold"); doc.setFontSize(23); color(INK);
      var tl = doc.splitTextToSize(title, tw); doc.text(tl, M, 53); y = 53 + (tl.length - 1) * 9;
      y += 9;
      var meta = [["Name", S.customer || "—"], ["Postcode", S.postcode || "—"], ["Prepared", today], ["Property", TYPE_LABEL[S.type] + ", ~" + Math.round(P.totalArea) + " m²"]];
      var mw = tw / 4;
      meta.forEach(function (m, i) {
        var x = M + i * mw;
        doc.setFont("helvetica", "bold"); doc.setFontSize(6.8); color(MUTED); doc.setCharSpace(0.3); doc.text(m[0].toUpperCase(), x, y); doc.setCharSpace(0);
        doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); color(INK); doc.text(doc.splitTextToSize(m[1], mw - 3)[0], x, y + 5);
      });
      y = Math.max(y + 12, B.stamp ? 35 + stampH + 4 : 0);
      var kpis = [[String(P.totalAPs + P.builtIn), "Wi-Fi access points"], [String(P.cams), "Cameras"], [String(P.newRuns), "New cable runs"], [fmtDays(P.days), "On site"]];
      var bw = (CW - 9) / 4;
      kpis.forEach(function (k, i) {
        var x = M + i * (bw + 3); color(BG, "fill"); doc.roundedRect(x, y, bw, 18, 2.5, 2.5, "F");
        doc.setFont("helvetica", "bold"); doc.setFontSize(16); color(INK); doc.text(k[0], x + 4.5, y + 9);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); color(MUTED); doc.text(k[1], x + 4.5, y + 14.2);
      });
      y += 21;

      // 1. Gateway
      heading(1, "Gateway");
      table(null, P.selG ? [[P.selG.full, P.selG.blurb + (P.cams ? (P.onGateway ? ". Records the cameras." : ". Network only; cameras record on a separate NVR.") : ""), "1"],
          [{ content: "Estimated load", styles: { fontStyle: "normal", textColor: MUTED } }, Math.round(P.gwLoad * 100) + "% (rough guide, confirmed with Ubiquiti's calculator)", ""]]
        : [["None", "You keep your existing router", ""]]);
      P.gwWarn.forEach(function (w) { callout(w, true); });

      // 2. Access points
      heading(2, "Wi-Fi access points");
      var apRows = P.selAP ? P.floors.map(function (f) { return [f.name + "  (~" + Math.round(f.area) + " m²)", P.selAP.full + (f.aps !== f.sugg ? "  (suggested " + f.sugg + ")" : ""), String(f.aps)]; }) : [["Indoors", "No access points", "0"]];
      if (P.builtIn) apRows.push([P.builtInFloor, "Built into the " + P.selG.name, "1"]);
      if (P.outdoorAPs || P.outdoorSugg) apRows.push(["Outside" + (P.outdoorAreas.length ? " (" + P.outdoorAreas.map(function (o) { return OUT_LABEL[o]; }).join(", ") + ")" : ""), CONFIG.apOutdoor.full + (P.outdoorAPs !== P.outdoorSugg ? "  (suggested " + P.outdoorSugg + ")" : ""), String(P.outdoorAPs)]);
      if (P.outbuildAPs || P.outbuildSugg) apRows.push(["Outbuildings", CONFIG.apOutbuilding.full, String(P.outbuildAPs)]);
      apRows.push([{ content: "Total", styles: { lineWidth: 0 } }, { content: "~" + Math.round(P.apWatts) + " W of PoE power at maximum draw", styles: { lineWidth: 0 } }, { content: String(P.totalAPs + P.builtIn), styles: { lineWidth: 0 } }]);
      table(["AREA", "UNIT", "QTY"], apRows, { columnStyles: { 0: { fontStyle: "normal", cellWidth: 62 }, 1: { textColor: MUTED }, 2: { halign: "right", fontStyle: "bold", cellWidth: 18 } } });
      para("Around " + P.devices + " devices at busy times." + (P.selAP ? " " + P.selAP.blurb + "." : ""), 8.5);

      // 3. Switch
      heading(3, "Switch & power");
      var swRows = [];
      if (P.selSW) swRows.push([P.selSW.full, P.selSW.poe ? P.poeNeed + " PoE devices, " + P.portNeed + " ports needed, ~" + Math.round(P.poeWatts) + " W of " + P.selSW.budget * P.swCount + " W" + (P.swMulti ? " (" + P.swCount + " switches, linked)" : "") : P.portNeed + " ports needed, no PoE output", String(P.swCount)]);
      else swRows.push(["None", P.recNoSW ? "The gateway's own ports cover the wired points" : "No network switch", ""]);
      if (P.injectors) swRows.push([CONFIG.injector, "One per powered device", String(P.injectors)]);
      if (S.roomSwQty) swRows.push([P.roomSw.full, "Extra ports behind a TV or on a desk", String(S.roomSwQty)]);
      table(null, swRows);
      if (P.swNote) callout(P.swNote, true);

      var n = 4;
      if (P.cams) {
        heading(n, "CCTV & recording"); n++;
        callout("NVR needed? " + P.recReason, false);
        var cRows = [];
        if (P.newCams) cRows.push(["New UniFi cameras", P.replaced ? "includes " + P.replaced + " replacing analogue" : "G5 range, smart detections", String(P.newCams)]);
        if (P.onvifCams) cRows.push(["Your own cameras (ONVIF)", "24/7 recording, live view, no licence fee", String(P.onvifCams)]);
        if (P.aiPorts) cRows.push(["UniFi AI Port", "smart detections for own cameras", String(P.aiPorts)]);
        if (P.onGateway) cRows.push(["Recording", "On the " + P.selG.name + ": " + P.gwStore(P.selG) + ", " + S.retention + " days 24/7 (~" + fmtTB(P.storageTB) + " needed)", String(P.selG.bays || 1)]);
        else {
          cRows.push([P.selNVR.full, "Separate recorder, up to " + P.selNVR.maxCams + " cameras at 2K", "1"]);
          if (P.nvrDrives) cRows.push(["Recording drives", P.nvrDrives.count + " x " + P.nvrDrives.size + " TB, " + S.retention + " days 24/7 (~" + fmtTB(P.storageTB) + " needed)" + (P.nvrDrives.protected ? ", protected if a drive fails" : ""), String(P.nvrDrives.count)]);
        }
        table(null, cRows);
        P.nvrWarn.forEach(function (w) { callout(w, true); });
      }

      // Kit list
      heading(n, "Full kit list");
      var firstGroup = true;
      ["Network", "Wi-Fi", "CCTV", "Cabling"].forEach(function (g) {
        var rows = P.kit.filter(function (k) { return k.group === g; });
        if (!rows.length) return;
        ensure(16 + Math.min(rows.length, 3) * 7);
        var hs = { fillColor: BG, fontStyle: "bold", fontSize: 7.5, textColor: MUTED, lineWidth: 0 };
        var head = [{ content: g.toUpperCase(), styles: hs }, { content: firstGroup ? "WHY" : "", styles: hs }, { content: firstGroup ? "QTY" : "", styles: Object.assign({}, hs, { halign: "right" }) }];
        table(head, rows.map(function (k) { return [k.item, k.why, String(k.q)]; }), { showHead: "everyPage", columnStyles: { 0: { cellWidth: 70, fontStyle: "normal" }, 1: { textColor: MUTED }, 2: { halign: "right", fontStyle: "bold", cellWidth: 14 } } });
        y += 1; firstGroup = false;
      });

      heading("", "Networks we'll set up");
      para(P.nets.join("   ·   "), 9.5, INK);

      if (P.notes.length) {
        heading("", "Good to know");
        P.notes.forEach(function (x) { callout(x[1], x[0] === "warn"); });
      }

      heading("", "What we'll check at the survey");
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
      P.checks.forEach(function (c) {
        var lines = doc.splitTextToSize(c, CW - 8); ensure(lines.length * 4.4 + 2);
        color([190, 190, 196], "draw"); doc.setLineWidth(0.35); doc.roundedRect(M, y + 1.3, 3.6, 3.6, 0.8, 0.8, "S");
        color(INK); doc.text(lines, M + 6.5, y + 4.4); y += lines.length * 4.4 + 1.8;
      });

      heading("", "What happens next");
      ensure(28);
      var steps = [["1. Survey", "We visit, confirm positions and cable routes."], ["2. Fixed quote", "Itemised, based on this plan."], ["3. Install", "About " + fmtDays(P.days) + " on site, tidy cabling."], ["4. Handover", "Tested room by room, apps set up for you."]];
      steps.forEach(function (s, i) {
        var x = M + i * (bw + 3); color(BG, "fill"); doc.roundedRect(x, y + 2, bw, 22, 2.5, 2.5, "F");
        doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); color(INK); doc.text(s[0], x + 4, y + 8);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); color(MUTED); doc.text(doc.splitTextToSize(s[1], bw - 8), x + 4, y + 12.5);
      });
      y += 27;

      if (S.notes) { heading("", "Your notes"); para(S.notes, 9.5, INK); }

      // Sign-off with the stamp
      ensure(46); y += 6;
      var boxH = 38;
      color(LINE, "draw"); doc.setLineWidth(0.3); doc.roundedRect(M, y, CW, boxH, 3, 3, "S");
      var sH = 30, sW = B.stamp ? sH * B.stamp.w / B.stamp.h : 0;
      if (B.stamp) img(B.stamp, PW - M - sW - 6, y + 4, sH);
      var bx = M + 6, bwid = CW - 12 - (sW ? sW + 8 : 0);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); color(INK); doc.text("Planned by " + CONFIG.company, bx, y + 9);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); color(MUTED); doc.text("Ref " + ref + "   ·   " + today, bx, y + 14);
      doc.setFontSize(9); color(INK);
      var sl = doc.splitTextToSize("This plan is an estimate based on the answers given. We confirm positions, cable routes and equipment at a free site survey, then send you a fixed, itemised quote.", bwid);
      doc.text(sl, bx, y + 20.5);
      doc.setFont("helvetica", "bold"); color(A); doc.text("Book your survey: " + CONFIG.website + "  ·  " + CONFIG.email, bx, y + 21.5 + sl.length * 4.2);
      y += boxH + 4;

      // Running header (pages 2+) and footer (all pages)
      var pages = doc.getNumberOfPages();
      for (var p = 1; p <= pages; p++) {
        doc.setPage(p);
        if (p > 1) {
          var hw = img(B.logo, M, 9, 7.5);
          doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); color(INK); doc.text(co, M + (hw ? hw + 2.5 : 0), 14.6);
          doc.setFont("helvetica", "normal"); doc.setFontSize(8); color(MUTED); doc.text(title + "   ·   Ref " + ref, PW - M, 14.6, { align: "right" });
          color(LINE, "draw"); doc.setLineWidth(0.25); doc.line(M, 19, PW - M, 19);
        }
        color(LINE, "draw"); doc.setLineWidth(0.25); doc.line(M, PH - 17, PW - M, PH - 17);
        doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); color(INK); doc.text(co, M, PH - 12);
        doc.setFont("helvetica", "normal"); color(MUTED); doc.text(CONFIG.website + "  ·  " + CONFIG.email + "  ·  " + CONFIG.areas, M + doc.getTextWidth(co) + 3, PH - 12);
        doc.setFontSize(6.8); doc.text("Planning estimate. Final equipment, positions and price are confirmed after a site survey.", M, PH - 8);
        doc.setFontSize(7.5); doc.text("Page " + p + " of " + pages, PW - M, PH - 12, { align: "right" });
      }
      return doc;
    }
    function exportPDF(btn) {
      var label = btn.textContent; btn.disabled = true; btn.textContent = "Preparing PDF…";
      ensurePdfLibs().then(function () {
        var doc = buildPDF();
        root._lastPdf = doc;                // exposed for testing
        doc.save(pdfFileName());
        var framed = (function () { try { return window.self !== window.top; } catch (e) { return true; } })();
        toast(framed ? "PDF exported. If nothing downloaded, open the planner in its own browser tab and try again." : "PDF downloaded");
      }).catch(function (e) {
        toast("Couldn't create the PDF. Check your connection and try again.");
        if (window.console) console.error("[CityPlug planner] PDF export failed:", e);
      }).then(function () { btn.disabled = false; btn.textContent = label; });
    }

    /* ---------- render & events ---------- */
    function render() {
      R("steps").innerHTML = STEPS.map(function (s, i) {
        return '<button type="button" data-go="' + i + '" class="' + (i === step ? "on" : i < step ? "done" : "") + '"' + (i === step ? ' aria-current="step"' : "") + "><span>Step " + (i + 1) + "</span><b>" + s.title + "</b></button>";
      }).join("");
      var s = STEPS[step];
      var title = step === 3 ? (S.project ? esc(S.project) + " plan" : "Your plan") : s.title;
      R("body").innerHTML = "<h2>" + title + '</h2><p class="sub">' + (s.sub || "Suggested UniFi setup based on your answers.") + "</p>" + s.render();
      R("back").disabled = step === 0;
      R("next").textContent = step === 2 ? "See my plan" : "Next";
      R("nav").classList.toggle("hidden", step === 3);
      R("aside").classList.toggle("hidden", step === 3);
      R("grid").classList.toggle("full", step === 3);
      updateAside();
    }
    function rerenderKeepScroll() {
      var y = window.scrollY, sx = {};
      qa("[data-picks]").forEach(function (el) { sx[el.dataset.picks] = el.scrollLeft; });
      render(); window.scrollTo(0, y);
      qa("[data-picks]").forEach(function (el) { el.scrollLeft = sx[el.dataset.picks] || 0; });
    }
    function scrollTop() {
      var r = root.getBoundingClientRect();
      if (r.top < 0) root.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    function updateAside() {
      var P = plan();
      R("kAP").textContent = P.totalAPs; R("kCam").textContent = P.cams; R("kDays").textContent = fmtDaysNum(P.days);
      R("asideProject").textContent = S.project || "Live estimate";
      var top = [P.kit.filter(function (k) { return k.group === "Network"; })[0]]
        .concat(P.kit.filter(function (k) { return k.group === "Wi-Fi"; }), P.kit.filter(function (k) { return k.group === "CCTV"; }))
        .filter(Boolean).slice(0, 7);
      R("asideKit").innerHTML = top.map(function (k) { return "<li><div>" + esc(k.item) + "<small>" + esc(k.why) + '</small></div><span class="qty">' + k.q + "</span></li>"; }).join("");
    }
    function toast(msg) {
      var t = R("toast"); t.textContent = msg; t.classList.add("show");
      clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove("show"); }, 3200);
    }

    root.addEventListener("click", function (e) {
      var t = e.target, el;
      if ((el = t.closest("[data-pick]"))) { S[el.dataset.pick] = el.dataset.v; rerenderKeepScroll(); return; }
      if ((el = t.closest(".chip[data-f]"))) {
        var f = el.dataset.f, v = el.dataset.v;
        if (el.dataset.m === "1") S[f] = S[f].indexOf(v) >= 0 ? S[f].filter(function (x) { return x !== v; }) : S[f].concat([v]);
        else S[f] = (f === "floors" || f === "retention") ? +v : v;
        var structural = f === "type" || (f === "uses" && v === "cctv") || f === "camKind" || step === 3;
        if (structural) rerenderKeepScroll();
        else {
          Array.prototype.forEach.call(el.parentElement.querySelectorAll(".chip"), function (b) {
            b.setAttribute("aria-pressed", el.dataset.m === "1" ? S[f].indexOf(b.dataset.v) >= 0 : String(S[f]) === b.dataset.v);
          });
          updateAside();
        }
        return;
      }
      if ((el = t.closest("[data-toggle]"))) { var key = el.dataset.toggle; S[key] = !S[key]; el.setAttribute("aria-pressed", S[key]); updateAside(); return; }
      if ((el = t.closest("[data-step]"))) {
        var k = el.dataset.step, lim = LIMITS[k], before = S[k];
        S[k] = Math.min(lim[1], Math.max(lim[0], S[k] + (+el.dataset.d)));
        if ((k === "camsExisting" && (before === 0) !== (S[k] === 0)) || step === 3) rerenderKeepScroll();
        else { q('[data-o="' + k + '"]').textContent = S[k]; updateAside(); }
        return;
      }
      if ((el = t.closest("[data-go]"))) { step = +el.dataset.go; render(); return; }
      if (t.closest('[data-r="next"]')) { if (step < 3) { step++; render(); scrollTop(); } return; }
      if (t.closest('[data-r="back"]')) { if (step > 0) { step--; render(); scrollTop(); } return; }
      if ((el = t.closest('[data-r="pdfBtn"]'))) { exportPDF(el); return; }
      if (t.closest('[data-r="sendBtn"]')) { if (S.sendState !== "sending") sendPlan(); return; }
      if (t.closest('[data-r="copyBtn"]')) {
        var txt = planText();
        (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(txt) : Promise.reject())
          .then(function () { toast("Plan copied"); }, function () { toast("Couldn't copy here"); });
        return;
      }
      if ((el = t.closest("[data-apadj]"))) {
        var ak = el.dataset.apadj, nv = Math.max(LIMITS.apQty[0], Math.min(LIMITS.apQty[1], +el.dataset.val + (+el.dataset.d)));
        S.apAdj = Object.assign({}, S.apAdj); S.apAdj[ak] = nv - (+el.dataset.s); rerenderKeepScroll(); return;
      }
      if (t.closest('[data-r="apReset"]')) { S.apAdj = {}; rerenderKeepScroll(); return; }
      if (t.closest('[data-r="addCctv"]')) { S.uses = S.uses.concat(["cctv"]); if (!S.camsNew && !S.camsExisting) S.camsNew = 4; rerenderKeepScroll(); return; }
      if (t.closest('[data-r="editBtn"]')) { step = 0; S.gw = S.ap = S.sw = S.rec = null; S.gwDisk = "auto"; render(); scrollTop(); return; }
    });
    root.addEventListener("input", function (e) {
      var el = e.target;
      if (el.dataset.t) { S[el.dataset.t] = el.value; if (el.dataset.t === "project") updateAside(); }
      if (el.dataset.c) S[el.dataset.c] = el.checked;
      if (el.dataset.n) { S[el.dataset.n] = +el.value; updateAside(); }
    });

    render();
    return { state: S, config: CONFIG, plan: plan, planText: planText, buildPDF: function () { return ensurePdfLibs().then(buildPDF); }, render: render,
      goTo: function (i) { step = i; render(); } };
  }

  /* ---------- public API + auto-mount ---------- */
  var api = {
    defaults: DEFAULT_CONFIG,
    mount: function (target, config) {
      var el = typeof target === "string" ? document.querySelector(target) : target;
      if (!el) throw new Error("CityPlug planner: mount element not found");
      if (el._cpwp) return el._cpwp;
      el._cpwp = Planner(el, config);
      return el._cpwp;
    }
  };
  window.CityPlugPlanner = api;
  function auto() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-cityplug-planner]"), function (el) {
      var cfg = {};
      if (el.dataset.header === "false") cfg.showHeader = false;
      if (el.dataset.project) cfg.project = el.dataset.project;
      if (el.dataset.sendUrl && /^https:\/\//.test(el.dataset.sendUrl)) cfg.sendUrl = el.dataset.sendUrl;
      api.mount(el, Object.assign(cfg, window.CityPlugPlannerConfig || {}));
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", auto); else auto();
})();
