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
    website: "cityplug.co.uk",
    quoteUrl: "https://www.cityplug.co.uk/#contact",
    showHeader: true,                 // set false when embedding inside an existing page that has its own heading
    accentRGB: [10, 108, 255],        // PDF accent colour (match --cpwp-accent)

    coveragePerAP: { modern: 110, brick: 80, solid: 55 },   // m² a standard ceiling AP (U7 Pro) covers indoors, by wall type
    devicesPerPerson: { home: 8, business: 3 },
    hoursPerRun: { easy: 0.6, mixed: 1, hard: 1.75 },        // per new cable run, incl. termination

    /* Gateways, smallest first.
       cap   = rough relative capacity for the load meter (not a Ubiquiti figure; calibrate against calculator.ui.com)
       maxTB = largest recording storage it takes; maxCams = Ubiquiti's managed-camera figure at 2K (HD for UDR models) */
    gateways: [
      { id:"ux7", lan:1,       name:"Express 7",    full:"UniFi Express 7",              shape:"cube",  cap:55,  protect:false, maxTB:0,   maxCams:0,  media:"",                       multigig:true,  homeOnly:true,  wifi:true, smallOnly:true, blurb:"Router + Wi-Fi 7 in one small box (no CCTV)" },
      { id:"ucg-ultra", lan:4, name:"UCG Ultra",    full:"UniFi Cloud Gateway Ultra",    shape:"desk",  cap:60,  protect:false, maxTB:0,   maxCams:0,  media:"",                       multigig:false, homeOnly:true,  blurb:"Compact router, no CCTV recording" },
      { id:"udr7", lan:3,      name:"UDR7",         full:"UniFi Dream Router 7",         shape:"tower", cap:70,  protect:true,  maxTB:0.5, maxCams:5,  media:"microSD card",           multigig:false, homeOnly:true,  wifi:true, blurb:"All-in-one with built-in Wi-Fi 7" },
      { id:"udr5g", lan:3,     name:"UDR 5G Max",   full:"UniFi Dream Router 5G Max",    shape:"tower", cap:70,  protect:true,  maxTB:0.5, maxCams:5,  media:"microSD card",           multigig:false, homeOnly:true,  wifi:true, manual:true, blurb:"Built-in 5G for mobile broadband" },
      { id:"ucg-max", lan:4,   name:"UCG Max",      full:"UniFi Cloud Gateway Max",      shape:"desk",  cap:110, protect:true,  maxTB:2,   maxCams:8,  media:"NVMe SSD",               multigig:false, homeOnly:false, blurb:"Network + CCTV, under 2 Gb internet" },
      { id:"ucg-fiber", lan:4, name:"UCG Fiber",    full:"UniFi Cloud Gateway Fiber",    shape:"desk",  cap:160, protect:true,  maxTB:2,   maxCams:8,  media:"NVMe SSD + M.2 tray",    multigig:true,  homeOnly:false, blurb:"Multi-gig fibre, 10G ports" },
      { id:"udm-pro", lan:8,   name:"UDM Pro / SE", full:"UniFi Dream Machine Pro / SE", shape:"rack",  cap:140, protect:true,  maxTB:20,  maxCams:14, media:"3.5\" surveillance HDD", multigig:true,  homeOnly:false, blurb:"Rack-mount, one drive bay" },
      { id:"udm-pm", lan:8,    name:"UDM Pro Max",  full:"UniFi Dream Machine Pro Max",  shape:"rack",  cap:220, protect:true,  maxTB:20,  maxCams:25, media:"2 x 3.5\" HDD (mirrored)", multigig:true, homeOnly:false, blurb:"Rack-mount, two mirrored drive bays" },
      { id:"udm-beast", lan:8, name:"UDM Beast",    full:"UniFi Dream Machine Beast",    shape:"rack",  cap:600, protect:true,  maxTB:20,  maxCams:60, media:"2 x 3.5\" HDD (mirrored)", multigig:true, homeOnly:false, blurb:"Large sites, up to 60 2K cameras" }
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
    roomSwitches: ["flexmini", "flexmini25"],   // offered as extra small switches for a TV / desk
    injector: "UniFi PoE injector",
    controller: "UniFi Cloud Key (to manage the UniFi kit)",
    poeHeadroom: 0.9,                 // use at most 90% of a switch's PoE budget (figures are max draw, so this is conservative)
    watts: { camera:12, onvifCamera:10, phone:6, aiPort:15 },

    cctv: {
      gbPerCameraDay: 22,             // ~2 Mbps continuous per 2K camera. 4K is roughly double.
      driveSizesTB: [0.064, 0.128, 0.256, 0.512, 1, 2, 4, 8, 12, 16, 20],
      driveHeadroom: 1.15,            // a drive formats to ~90% of its label, plus some slack
      camsPerAIPort: 2,               // Ubiquiti: 1 x 4K, 2 x 2K or 3 x HD third-party (ONVIF) cameras per AI Port
      nvr: "UniFi Network Video Recorder (separate)"
    },
    bridge: "UniFi Building-to-Building Bridge",
    ups: "UPS (battery backup) for network kit",

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
  function fmtDays(d) { return d <= 0.5 ? "½ day" : (d % 1 ? Math.floor(d) + "½ days" : d + " day" + (d > 1 ? "s" : "")); }
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
  var LIMITS = { people: [1, 200], guests: [0, 500], camsNew: [0, 64], camsExisting: [0, 64], wired: [0, 48], roomSwQty: [0, 10] };
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
      gw: null, ap: null, sw: null, roomSw: "flexmini", roomSwQty: 0
    };
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
      '<div class="kpis"><div class="kpi"><b data-r="kAP">–</b><span>Access points</span></div><div class="kpi"><b data-r="kCam">–</b><span>Cameras</span></div><div class="kpi"><b data-r="kDays">–</b><span>On site</span></div></div>' +
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
        '<div><label for="cpwp-project">Project name <span class="hint">e.g. Scarborough</span></label><input type="text" id="cpwp-project" data-t="project" value="' + esc(S.project) + '"></div>' +
        '<div><label for="cpwp-postcode">Postcode</label><input type="text" id="cpwp-postcode" data-t="postcode" value="' + esc(S.postcode) + '" placeholder="SE1 7PB"></div></div></div>' +
        '<div class="q"><label for="cpwp-customer">Customer name</label><input type="text" id="cpwp-customer" data-t="customer" value="' + esc(S.customer) + '"></div>' +
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
        '<div class="q"><div class="ql">Existing cameras to keep <span class="hint">customer\'s own</span></div>' + stepperInput("camsExisting") + "</div>" +
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

      var devices = biz ? S.people * CONFIG.devicesPerPerson.business + S.guests * 1.2
                        : S.people * CONFIG.devicesPerPerson.home + (S.uses.indexOf("smarthome") >= 0 ? 15 : 0);

      // Access points ("none" = no indoor APs)
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
      var indoor = 0;
      if (selAP) {
        var cov = covFor(selAP);
        floors.forEach(function (f) { f.aps = Math.max(1, Math.ceil(f.area / cov)); });
        var covAPs = floors.reduce(function (a, f) { return a + f.aps; }, 0);
        indoor = Math.max(covAPs, Math.ceil(devices / selAP.clients));
        var extra = indoor - covAPs, k = 0;
        var bySize = floors.slice().sort(function (a, b) { return b.area - a.area; });
        while (extra > 0) { bySize[k % bySize.length].aps++; extra--; k++; }
      } else floors.forEach(function (f) { f.aps = 0; });

      var outdoorAreas = S.outside.filter(function (o) { return ["garden", "patio", "carpark"].indexOf(o) >= 0; });
      var outdoorAPs = outdoorAreas.length;
      var outbuildAPs = S.outside.filter(function (o) { return o === "outbuilding" || o === "office"; }).length;
      var totalAPs = indoor + outdoorAPs + outbuildAPs;

      // CCTV
      var cctv = hasCCTV(), analogue = S.camKind === "analogue";
      var replaced = cctv && analogue ? S.camsExisting : 0;
      var newCams = cctv ? S.camsNew + replaced : 0;
      var onvifCams = cctv && !analogue ? S.camsExisting : 0;
      var cams = newCams + onvifCams;
      var aiPorts = onvifCams && S.smart === "yes" ? Math.ceil(onvifCams / CONFIG.cctv.camsPerAIPort) : 0;
      var storageTB = cams * CONFIG.cctv.gbPerCameraDay * (+S.retention) / 1000;
      var sizes = CONFIG.cctv.driveSizesTB;
      var driveTB = cams ? (sizes.filter(function (x) { return x >= storageTB * CONFIG.cctv.driveHeadroom; })[0] || sizes[sizes.length - 1]) : 0;

      // Gateway ("none" = customer keeps their own router)
      var phones = S.uses.indexOf("voip") >= 0 ? Math.max(1, Math.ceil(S.people / 2)) : 0;
      var L = CONFIG.load;
      var loadUnits = L.base + totalAPs * L.perAP + devices * L.perClient + newCams * L.perCamera + onvifCams * L.perOnvifCamera + phones * L.perPhone + (biz ? L.ips : 0);
      function gwOk(g) { return (!cams || (g.protect && cams <= g.maxCams)) && (S.internet !== "multigig" || g.multigig); }
      function baseFit(g) { return gwOk(g) && !(biz && g.homeOnly) && !g.manual && !(g.smallOnly && (indoor > 1 || outdoorAPs + outbuildAPs > 0 || S.wired > 1)) && loadUnits / g.cap <= CONFIG.targetLoad; }
      var G = CONFIG.gateways;
      var recG = G.filter(function (g) { return baseFit(g) && (!cams || g.maxTB >= driveTB); })[0] || G.filter(baseFit)[0] || G[G.length - 1];
      var noGW = S.gw === "none";
      var selG = noGW ? null : (G.filter(function (g) { return g.id === S.gw; })[0] || recG);
      var gwLoad = selG ? loadUnits / selG.cap : 0;
      var needNVR = cams > 0 && (!selG || !selG.protect || cams > selG.maxCams || selG.maxTB < driveTB);
      var gwWarn = [];
      if (selG) {
        if (cams && !selG.protect) gwWarn.push("This gateway can't record cameras, so a separate UniFi recorder is added to the kit list.");
        else if (cams > selG.maxCams) gwWarn.push("Ubiquiti rates this gateway for about " + selG.maxCams + " cameras, so a separate UniFi recorder is added for " + cams + ".");
        else if (needNVR) gwWarn.push(fmtTB(storageTB) + " of recordings won't fit in this gateway, so a separate UniFi recorder is added to the kit list.");
        if (S.internet === "multigig" && !selG.multigig) gwWarn.push("This gateway won't run multi-gig fibre at full speed.");
        if (gwLoad > 0.85) gwWarn.push("This gateway would be close to its limit with this setup.");
      }
      // gateway with built-in Wi-Fi covers one indoor area (placed where the internet comes in)
      var builtIn = selG && selG.wifi ? 1 : 0, builtInFloor = null;
      if (builtIn && indoor > 0) {
        var gf = floors.filter(function (f) { return f.name !== "Basement" && f.aps > 0; })[0] || floors.filter(function (f) { return f.aps > 0; })[0];
        if (gf) { gf.aps--; indoor--; totalAPs--; builtInFloor = gf.name; }
      }
      if (builtIn && !builtInFloor) builtInFloor = (floors.filter(function (f) { return f.name !== "Basement"; })[0] || floors[0]).name;

      // Switch ("none" = no switch, PoE injectors instead; Flex Minis have no PoE output)
      var apWatts = indoor * (selAP ? selAP.watts : 0) + outdoorAPs * CONFIG.apOutdoor.watts + outbuildAPs * CONFIG.apOutbuilding.watts;
      var W = CONFIG.watts;
      var poeWatts = apWatts + newCams * W.camera + onvifCams * W.onvifCamera + phones * W.phone + aiPorts * W.aiPort;
      var poeNeed = totalAPs + cams + phones + aiPorts;
      var portNeed = poeNeed + S.wired + 1;
      function swCountFor(sw) {
        if (!sw.poe) return Math.max(1, Math.ceil(portNeed / sw.ports));
        return Math.max(1, Math.ceil(poeNeed / sw.poe), Math.ceil(portNeed / sw.ports), Math.ceil(poeWatts / (sw.budget * CONFIG.poeHeadroom)));
      }
      function swFits(sw) { return swCountFor(sw) === 1 && (sw.poe > 0 || poeNeed === 0); }
      var SWL = CONFIG.switches;
      var recNoSW = poeNeed === 0 && !!selG && portNeed - 1 <= (selG.lan || 0);   // gateway's own ports are enough
      var recSW = recNoSW ? null : (SWL.filter(swFits)[0] || SWL[SWL.length - 1]);
      var noSW = S.sw === "none" || (!S.sw && recNoSW);
      var selSW = noSW ? null : (SWL.filter(function (x) { return x.id === S.sw; })[0] || recSW);
      var swCount = selSW ? swCountFor(selSW) : 0;
      var injectors = (!selSW || !selSW.poe) ? poeNeed : 0;
      var roomSw = SWL.filter(function (x) { return x.id === S.roomSw; })[0] || SWL[0];

      // Cabling
      var camRuns = newCams + (onvifCams && S.camCabled === "no" ? onvifCams : 0) + aiPorts;
      var reuse = S.cabling === "full" ? 0.5 : S.cabling === "some" ? 0.8 : 1;
      var apRuns = Math.round((indoor + S.wired + phones) * reuse) + outdoorAPs + outbuildAPs;
      var newRuns = apRuns + camRuns;
      var runs = indoor + outdoorAPs + outbuildAPs + S.wired + phones + camRuns;
      var cabinet = (selG && selG.shape === "rack") || runs >= 10 ? "9U wall cabinet with patch panel" : runs >= 6 ? "6U wall cabinet with patch panel" : "Compact comms shelf / small cabinet";

      // Time
      var hours = 1.5 + newRuns * CONFIG.hoursPerRun[S.routes] + totalAPs * 0.3 + newCams * 0.4 + onvifCams * 0.3 + 1.5;
      var days = Math.max(0.5, Math.ceil(hours / 8 * 2) / 2);

      // Kit list
      var kit = [];
      function add(group, qn, item, why) { if (qn > 0) kit.push({ group: group, q: qn, item: item, why: why || "" }); }
      if (selG) add("Network", 1, selG.full, selG.blurb + (selG === recG ? "" : " (chosen manually)"));
      if (!selG && (totalAPs || selSW || cams)) add("Network", 1, CONFIG.controller, "Customer keeps their router; UniFi kit still needs a controller");
      if (selSW) add("Network", swCount, selSW.full + (/switch/i.test(selSW.full) ? "" : " switch"), selSW.poe ? "Powers " + poeNeed + " PoE device" + (poeNeed === 1 ? "" : "s") + " (~" + Math.round(poeWatts) + " W), " + portNeed + " ports needed" : portNeed + " ports needed, no PoE output");
      add("Network", injectors, CONFIG.injector, "Powers each access point / camera without a PoE switch");
      add("Network", S.roomSwQty, roomSw.full, "Extra wired ports behind a TV or on a desk");
      add("Network", 1, cabinet, "Tidy home for the network kit");
      if (biz || cams) add("Network", 1, CONFIG.ups, "Keeps Wi-Fi and cameras up through power cuts");
      if (selAP) add("Wi-Fi", indoor, selAP.full, "Indoor " + (/U6/.test(selAP.name) ? "Wi-Fi 6" : "Wi-Fi 7") + ", " + selAP.mount + "-mounted");
      add("Wi-Fi", outdoorAPs, CONFIG.apOutdoor.full, "Weatherproof, for " + outdoorAreas.map(function (o) { return OUT_LABEL[o]; }).join(", "));
      add("Wi-Fi", outbuildAPs, CONFIG.apOutbuilding.full, "Inside the garage / garden office");
      add("Wi-Fi", outbuildAPs, CONFIG.bridge, "Only if a cable can't be run to the outbuilding");
      add("CCTV", newCams, "UniFi Protect camera", replaced ? S.camsNew + " new + " + replaced + " replacing old analogue cameras" : "Model and lens chosen at survey");
      add("CCTV", onvifCams, "Customer's own camera, added to UniFi Protect (ONVIF)", S.camCabled === "yes" ? "Reuses existing cable, no licence fee" : "New cable to the cabinet, no licence fee");
      add("CCTV", aiPorts, "UniFi AI Port", "Adds smart detections to customer's own cameras");
      if (cams) add("CCTV", 1, needNVR ? CONFIG.cctv.nvr + " with " + fmtTB(driveTB) + " storage" : fmtTB(driveTB) + " " + (selG.media || "recording drive"), "About " + S.retention + " days of 24/7 recording");
      add("Cabling", apRuns, "Cat6 runs for Wi-Fi & wired points", "Terminated, tested, labelled both ends");
      add("Cabling", camRuns, "Cat6 runs for cameras", "External-grade cable where it runs outside");

      var nets = [biz ? "Staff" : "Main"];
      if (S.uses.indexOf("guest") >= 0 || S.guests > 0) nets.push("Guest (isolated)");
      if (S.uses.indexOf("smarthome") >= 0) nets.push("Smart devices / IoT");
      if (S.uses.indexOf("pos") >= 0) nets.push("Payments (locked down)");
      if (cams) nets.push("Cameras (no internet access)");
      if (phones) nets.push("Phones");

      var notes = [];
      if (!selG) notes.push(["", "The customer keeps their existing router. UniFi access points and switches still need a UniFi controller, so a Cloud Key is listed (or the UniFi Network app can run on a computer that stays on)." + (cams ? " Cameras record on a separate UniFi recorder." : "")]);
      if (builtIn) notes.push(["", "The " + selG.name + " has Wi-Fi built in, so it covers one area itself (" + builtInFloor.toLowerCase() + ", where the internet comes in)."]);
      if (noAP) notes.push(["", "No indoor access points are planned" + (builtIn ? " beyond the gateway's built-in Wi-Fi" : "") + "."]);
      if (injectors) notes.push(["warn", "Without a PoE switch, each access point" + (cams ? " and camera" : "") + " needs its own PoE injector and a power socket near the network kit."]);
      if (onvifCams) notes.push(["", "Existing network cameras are added to UniFi Protect using ONVIF, the open standard most IP cameras support, with no licence fee. They record 24/7 and show live in the Protect app. Smart detections, PTZ control and two-way audio depend on the camera and may not carry across. " + (aiPorts ? "The AI Port adds UniFi's people and vehicle detection." : "A UniFi AI Port can add people and vehicle detection if wanted.")]);
      if (replaced) notes.push(["warn", "Analogue (coax) cameras can't connect to UniFi Protect, so the plan swaps them for UniFi cameras. If the customer wants to keep them, they stay on their own DVR, separate from Protect."]);
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

      return { recNoSW: recNoSW, noGW: noGW, noAP: noAP, noSW: noSW, builtIn: builtIn, builtInFloor: builtInFloor, injectors: injectors, roomSw: roomSw, swFits: swFits, biz: biz, totalArea: totalArea, floors: floors, devices: Math.round(devices), indoor: indoor, outdoorAPs: outdoorAPs, outdoorAreas: outdoorAreas,
        outbuildAPs: outbuildAPs, totalAPs: totalAPs, recAP: recAP, selAP: selAP, apCountFor: apCountFor, cams: cams, newCams: newCams, onvifCams: onvifCams,
        replaced: replaced, aiPorts: aiPorts, storageTB: storageTB, driveTB: driveTB, needNVR: needNVR, loadUnits: loadUnits, recG: recG, selG: selG,
        gwLoad: gwLoad, gwWarn: gwWarn, gwOk: gwOk, poeNeed: poeNeed, portNeed: portNeed, poeWatts: poeWatts, phones: phones, recSW: recSW, selSW: selSW,
        swCount: swCount, swCountFor: swCountFor, apRuns: apRuns, camRuns: camRuns, newRuns: newRuns, hours: hours, days: days, kit: kit, nets: nets,
        notes: notes, checks: checks };
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
        case "disc-s": return '<svg viewBox="0 0 90 40" aria-hidden="true"><circle cx="45" cy="20" r="12" ' + g + '/><circle cx="45" cy="20" r="2" fill="#0a6cff" opacity=".5"/></svg>';
        case "disc": return '<svg viewBox="0 0 90 40" aria-hidden="true"><rect x="30" y="5" width="30" height="30" rx="8" ' + g + '/><circle cx="45" cy="20" r="2.2" fill="#0a6cff" opacity=".5"/></svg>';
        case "disc-l": return '<svg viewBox="0 0 90 40" aria-hidden="true"><rect x="27" y="2" width="36" height="36" rx="9" ' + g + '/><circle cx="45" cy="20" r="2.6" fill="#0a6cff" opacity=".5"/></svg>';
        case "wall": return '<svg viewBox="0 0 90 40" aria-hidden="true"><rect x="35" y="2" width="20" height="36" rx="4" ' + g + '/><rect x="42" y="31" width="6" height="2" rx="1" fill="#8e8e93"/></svg>';
        case "plate": return '<svg viewBox="0 0 90 40" aria-hidden="true"><rect x="31" y="6" width="28" height="28" rx="3" ' + g + '/><rect x="38" y="24" width="6" height="4" rx=".5" fill="#8e8e93"/><rect x="46" y="24" width="6" height="4" rx=".5" fill="#8e8e93"/></svg>';
        case "switch-s": for (i = 0; i < 4; i++) r += '<rect x="' + (40 + i * 7) + '" y="18" width="5" height="4" rx=".5" fill="#8e8e93"/>'; return '<svg viewBox="0 0 90 40" aria-hidden="true"><rect x="18" y="14" width="54" height="12" rx="2" ' + g + '/>' + r + "</svg>";
        default: for (i = 0; i < 8; i++) r += '<rect x="' + (30 + i * 6) + '" y="18" width="4.5" height="4" rx=".5" fill="#8e8e93"/>'; return '<svg viewBox="0 0 90 40" aria-hidden="true"><rect x="4" y="15" width="82" height="10" rx="1.5" fill="#d9d9de"/>' + r + "</svg>";
      }
    }
    var NONE_LABEL = { gw: "Keep own router", ap: "No indoor APs", sw: "No switch" };
    function picker(kind, list, selId, recId, label) {
      list = [{ id: "none", name: "None", shape: "none" }].concat(list);
      var base = label;
      label = function (it) { return it.id === "none" ? { text: NONE_LABEL[kind] } : base(it); };
      return '<div class="picks" data-picks="' + kind + '">' + list.map(function (it) {
        var l = label(it);
        return '<button type="button" class="pc' + (l.bad ? " no" : "") + '" data-pick="' + kind + '" data-v="' + it.id + '" aria-pressed="' + (it.id === selId) + '">' +
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
      var n = 4;
      var h = '<div class="meta"><div><span>Project</span>' + esc(S.project || "—") + "</div><div><span>Customer</span>" + esc(S.customer || "—") + "</div><div><span>Postcode</span>" + esc(S.postcode || "—") + "</div><div><span>Prepared</span>" + today + "</div></div>" +
        '<div class="section"><div class="kpis k4" style="margin:0" data-r="planKpis">' +
        '<div class="kpi"><b>' + P.totalAPs + '</b><span>Access points</span></div><div class="kpi"><b>' + P.cams + '</b><span>Cameras</span></div>' +
        '<div class="kpi"><b>' + P.newRuns + '</b><span>New cable runs</span></div><div class="kpi"><b>' + fmtDays(P.days) + "</b><span>On site</span></div></div></div>";

      h += '<div class="section" data-sec="gateway"><h3>1. Gateway</h3><p class="tag">The box that runs the whole network' + (P.cams ? " and records the cameras" : "") + ". Tap another to compare, or pick None to keep the customer's router.</p>" +
        picker("gw", CONFIG.gateways, P.selG ? P.selG.id : "none", P.recG.id, function (g) {
          var ld = Math.min(999, Math.round(P.loadUnits / g.cap * 100)) + "% load";
          if (S.internet === "multigig" && !g.multigig) return { text: "Too slow for fibre", bad: true };
          if (P.cams && (!g.protect || P.cams > g.maxCams)) return { text: ld + " + recorder" };
          return { text: ld + (g.wifi ? " · Wi-Fi" : "") };
        }) +
        (P.selG ? meter("Estimated load on " + P.selG.name, P.gwLoad, P.totalAPs + " APs · ~" + P.devices + " devices" + (P.cams ? " · " + P.cams + " cameras" : "") + (P.biz ? " · IPS/IDS on" : "") + '. Rough guide. Confirm on Ubiquiti\'s <a href="https://calculator.ui.com" target="_blank" rel="noopener">capacity calculator</a>.', "gw")
          : '<div class="note" style="margin-top:8px">No UniFi gateway: the customer keeps their existing router.</div>') +
        P.gwWarn.map(function (w) { return '<div class="note warn" style="margin-top:8px">' + w + "</div>"; }).join("") + "</div>";

      var apName = P.selAP ? P.selAP.name : "—";
      h += '<div class="section" data-sec="aps"><h3>2. Wi-Fi access points</h3><p class="tag">The units that give the Wi-Fi signal. Tap a model to see how many you\'d need.</p>' +
        picker("ap", CONFIG.aps, P.selAP ? P.selAP.id : "none", P.recAP.id, function (a) { return { text: P.apCountFor(a) + " indoor · " + a.mount }; }) +
        '<table style="margin-top:8px"><thead><tr><th>Area</th><th>Unit</th><th class="n">Qty</th></tr></thead><tbody>' +
        (P.selAP ? P.floors.map(function (f) { return "<tr><td>" + f.name + ' <span class="tag">~' + Math.round(f.area) + ' m²</span></td><td class="m">' + apName + '</td><td class="n">' + f.aps + "</td></tr>"; }).join("")
          : '<tr><td>Indoors</td><td class="m">No access points</td><td class="n">0</td></tr>') +
        (P.builtIn ? "<tr><td>" + P.builtInFloor + ' <span class="tag">built into gateway</span></td><td class="m">' + P.selG.name + '</td><td class="n">1</td></tr>' : "") +
        (P.outdoorAPs ? "<tr><td>Outside (" + P.outdoorAreas.map(function (o) { return OUT_LABEL[o]; }).join(", ") + ')</td><td class="m">' + CONFIG.apOutdoor.name + '</td><td class="n">' + P.outdoorAPs + "</td></tr>" : "") +
        (P.outbuildAPs ? '<tr><td>Outbuildings</td><td class="m">' + CONFIG.apOutbuilding.name + '</td><td class="n">' + P.outbuildAPs + "</td></tr>" : "") +
        '</tbody></table><p class="tag" style="margin-top:8px">' + TYPE_LABEL[S.type] + ", ~" + Math.round(P.totalArea) + " m², around " + P.devices + " devices at busy times." + (P.selAP ? " " + P.selAP.blurb + "." : "") + "</p></div>";

      var sw = P.selSW, poeSw = sw && sw.poe > 0;
      h += '<div class="section" data-sec="switch"><h3>3. Switch</h3><p class="tag">Connects the access points' + (P.cams ? " and cameras" : "") + " and wired points. A PoE switch also powers them over the same cable.</p>" +
        picker("sw", CONFIG.switches, sw ? sw.id : "none", P.recSW ? P.recSW.id : "none", function (s) {
          var c = P.swCountFor(s);
          if (!s.poe) return { text: s.ports + " ports · no PoE" + (c > 1 ? " · needs " + c : "") };
          return c === 1 ? { text: s.poe + " PoE · " + s.budget + " W" } : { text: "needs " + c + " switches", bad: true };
        }) +
        (poeSw ? meter("PoE ports used" + (P.swCount > 1 ? " across " + P.swCount + " switches" : ""), P.poeNeed / (sw.poe * P.swCount),
          P.totalAPs + " access points" + (P.cams ? " + " + P.cams + " cameras" : "") + (P.phones ? " + " + P.phones + " phones" : "") + (P.aiPorts ? " + " + P.aiPorts + " AI Port" + (P.aiPorts > 1 ? "s" : "") : "") + " · " + P.portNeed + " ports needed in total", "ports") +
          meter("PoE power used", P.poeWatts / (sw.budget * P.swCount), "~" + Math.round(P.poeWatts) + " W at maximum draw, of " + sw.budget * P.swCount + " W available", "watts") : "") +
        (P.recNoSW && !sw ? '<div class="note" style="margin-top:8px">No switch needed: the ' + P.selG.name + "'s own ports cover the wired points.</div>" : "") +
        (P.injectors ? '<div class="note warn" style="margin-top:8px">' + (sw ? "This switch has no PoE output, so " : "No switch, so ") + P.injectors + " PoE injector" + (P.injectors > 1 ? "s are" : " is") + " added to power the access points" + (P.cams ? " and cameras" : "") + ".</div>" : "") +
        '<div class="q" style="margin:16px 0 0"><div class="ql">Extra small switches <span class="hint">behind a TV, on a desk</span></div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">' +
        chips("roomSw", CONFIG.roomSwitches.map(function (id) { var x = CONFIG.switches.filter(function (s) { return s.id === id; })[0]; return [id, x.name]; })) +
        stepperInput("roomSwQty") + "</div></div></div>";


      if (P.cams) {
        h += '<div class="section" data-sec="cctv"><h3>' + n + ". CCTV</h3><p class=\"tag\">Recorded on the " + (P.needNVR ? "separate UniFi recorder" : P.selG.name) + " and viewed in the UniFi Protect app.</p><table><tbody>" +
          (P.newCams ? '<tr><td>New UniFi cameras</td><td class="m">' + (P.replaced ? "includes " + P.replaced + " replacing analogue" : "full smart detections") + '</td><td class="n">' + P.newCams + "</td></tr>" : "") +
          (P.onvifCams ? '<tr><td>Customer\'s own cameras (ONVIF)</td><td class="m">24/7 recording, live view</td><td class="n">' + P.onvifCams + "</td></tr>" : "") +
          (P.aiPorts ? '<tr><td>AI Port</td><td class="m">smart detections for own cameras</td><td class="n">' + P.aiPorts + "</td></tr>" : "") +
          '<tr><td>Recording storage</td><td class="m">' + S.retention + " days, ~" + fmtTB(P.storageTB) + ' needed</td><td class="n">' + fmtTB(P.driveTB) + "</td></tr></tbody></table></div>";
        n++;
      }

      h += '<div class="section" data-sec="kit"><h3>' + n + '. Full kit list</h3><table><thead><tr><th>Item</th><th>Why</th><th class="n">Qty</th></tr></thead><tbody>' +
        ["Network", "Wi-Fi", "CCTV", "Cabling"].map(function (g) {
          var rows = P.kit.filter(function (k) { return k.group === g; });
          return rows.length ? '<tr class="grp"><td colspan="3">' + g + "</td></tr>" + rows.map(function (k) { return "<tr><td>" + esc(k.item) + '</td><td class="m">' + esc(k.why) + '</td><td class="n">' + k.q + "</td></tr>"; }).join("") : "";
        }).join("") + "</tbody></table></div>";

      h += '<div class="section"><h3>Networks we\'ll set up</h3><div class="chips" style="margin-top:8px">' + P.nets.map(function (x) { return '<span class="chip">' + x + "</span>"; }).join("") + "</div></div>";
      if (P.notes.length) h += '<div class="section"><h3>Good to know</h3><div style="display:grid;gap:8px;margin-top:8px">' + P.notes.map(function (x) { return '<div class="note ' + x[0] + '">' + x[1] + "</div>"; }).join("") + "</div></div>";
      h += '<div class="section"><h3>What we\'ll check at the survey</h3><ul class="checks">' + P.checks.map(function (c) { return "<li>" + c + "</li>"; }).join("") + "</ul></div>";
      h += '<div class="section"><h3>What happens next</h3><div class="timeline"><div><b>1. Survey</b>We visit, confirm positions and cable routes.</div><div><b>2. Fixed quote</b>Itemised, based on this plan.</div><div><b>3. Install</b>About ' + fmtDays(P.days) + ' on site, tidy cabling.</div><div><b>4. Handover</b>Tested room by room, apps set up for you.</div></div></div>';
      if (S.notes) h += '<div class="section"><h3>Your notes</h3><p style="margin:0;white-space:pre-wrap">' + esc(S.notes) + "</p></div>";
      h += '<div class="actions"><button type="button" class="btn primary" data-r="pdfBtn">Export PDF</button><button type="button" class="btn ghost" data-r="copyBtn">Copy plan</button>' +
        '<a class="btn ghost" href="' + esc(CONFIG.quoteUrl) + '">Get a free quote</a><button type="button" class="btn ghost" data-r="editBtn">Edit answers</button></div>' +
        '<p class="disclaimer">This is a planning estimate. Final equipment, positions and price are confirmed after a site survey.</p>';
      return h;
    }

    function planText() {
      var P = plan(), L = [];
      L.push(CONFIG.company + " Wi-Fi plan" + (S.project ? " — " + S.project : ""));
      if (S.customer) L.push("Customer: " + S.customer);
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
        .then(function () { if (!hasT()) throw new Error("PDF library unavailable"); });
    }
    function pdfFileName() {
      var d = new Date(), ds = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
      var p = (S.project || "plan").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "plan";
      return CONFIG.company.replace(/\s+/g, "") + "-WiFi-Plan-" + p + "-" + ds + ".pdf";
    }
    function pdfSafe(t) { return String(t).replace(/m²/g, "sq m").replace(/²/g, "2").replace(/(\d)½/g, "$1.5").replace(/½/g, "0.5").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, "..."); }
    function buildPDF() {
      var P = plan();
      var jsPDF = window.jspdf.jsPDF;
      var doc = new jsPDF({ unit: "mm", format: "a4" });
      var A = CONFIG.accentRGB, INK = [29, 29, 31], MUTED = [110, 110, 115], LINE = [227, 227, 232], BG = [245, 245, 247];
      var M = 15, PW = 210, PH = 297, CW = PW - 2 * M, y = 0;
      var today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
      var _text = doc.text.bind(doc), _split = doc.splitTextToSize.bind(doc);
      doc.text = function (t) { var a = Array.prototype.slice.call(arguments); a[0] = Array.isArray(t) ? t.map(pdfSafe) : pdfSafe(t); return _text.apply(null, a); };
      doc.splitTextToSize = function (t, w, o) { return _split(pdfSafe(t), w, o); };
      function color(c, kind) { doc[kind === "fill" ? "setFillColor" : kind === "draw" ? "setDrawColor" : "setTextColor"](c[0], c[1], c[2]); }
      function ensure(hgt) { if (y + hgt > PH - 20) { doc.addPage(); y = 22; } }
      function heading(t) { ensure(18); y += 8; doc.setFont("helvetica", "bold"); doc.setFontSize(12.5); color(INK); doc.text(t, M, y); y += 2.5; }
      function para(t, size, col) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(size || 9.5); color(col || MUTED);
        var lines = doc.splitTextToSize(t, CW); ensure(lines.length * 4.4 + 2); doc.text(lines, M, y + 4); y += lines.length * 4.4 + 2;
      }
      function table(head, body, opts) {
        var clean = function (row) { return row.map(function (c) { return typeof c === "string" ? pdfSafe(c) : (c && c.content ? Object.assign({}, c, { content: pdfSafe(c.content) }) : c); }); };
        body = body.map(clean); if (head) head = clean(head);
        doc.autoTable(Object.assign({
          startY: y + 2, head: head ? [head] : undefined, body: body, margin: { left: M, right: M, top: 22, bottom: 20 }, theme: "plain",
          styles: { font: "helvetica", fontSize: 9, cellPadding: { top: 2.2, bottom: 2.2, left: 2, right: 2 }, textColor: INK, lineColor: LINE, lineWidth: { bottom: 0.2 } },
          headStyles: { fontStyle: "bold", fontSize: 7.5, textColor: MUTED },
          columnStyles: { 1: { textColor: MUTED }, 2: { halign: "right", fontStyle: "bold", cellWidth: 16 } }
        }, opts || {}));
        y = doc.lastAutoTable.finalY + 2;
      }

      // Header
      color(A, "fill"); doc.rect(0, 0, PW, 3, "F");
      y = 16; doc.setFont("helvetica", "bold"); doc.setFontSize(15);
      var co = CONFIG.company;
      if (co.indexOf("City") === 0) { color(INK); doc.text("City", M, y); color(A); doc.text(co.slice(4), M + doc.getTextWidth("City"), y); }
      else { color(INK); doc.text(co, M, y); }
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); color(MUTED); doc.text("Wi-Fi & CCTV installation plan", PW - M, y, { align: "right" });
      y = 30; doc.setFont("helvetica", "bold"); doc.setFontSize(22); color(INK);
      doc.text((S.project ? S.project + " " : "") + "Wi-Fi plan", M, y);
      y += 8;
      var meta = [["Customer", S.customer || "—"], ["Postcode", S.postcode || "—"], ["Prepared", today], ["Property", TYPE_LABEL[S.type] + ", ~" + Math.round(P.totalArea) + " m²"]];
      meta.forEach(function (m, i) {
        var x = M + i * (CW / 4);
        doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); color(MUTED); doc.text(m[0].toUpperCase(), x, y);
        doc.setFontSize(10); color(INK); doc.text(doc.splitTextToSize(m[1], CW / 4 - 3)[0], x, y + 5);
      });
      y += 11;
      var kpis = [[String(P.totalAPs), "Access points"], [String(P.cams), "Cameras"], [String(P.newRuns), "New cable runs"], [fmtDays(P.days), "On site"]];
      var bw = (CW - 9) / 4;
      kpis.forEach(function (k, i) {
        var x = M + i * (bw + 3); color(BG, "fill"); doc.roundedRect(x, y, bw, 17, 2.5, 2.5, "F");
        doc.setFont("helvetica", "bold"); doc.setFontSize(15); color(INK); doc.text(k[0], x + 4, y + 8.5);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); color(MUTED); doc.text(k[1], x + 4, y + 13.5);
      });
      y += 21;

      // 1. Gateway
      heading("1. Gateway");
      table(null, P.selG ? [[P.selG.full, P.selG.blurb, ""], ["Estimated load", Math.round(P.gwLoad * 100) + "% (rough guide, confirm on calculator.ui.com)", ""]] : [["None", "Customer keeps their existing router", ""]],
        { columnStyles: { 0: { fontStyle: "bold", cellWidth: 62 }, 1: { textColor: MUTED }, 2: { cellWidth: 1 } } });
      P.gwWarn.forEach(function (w) { para("! " + w, 9, [178, 106, 0]); });

      // 2. Access points
      heading("2. Wi-Fi access points");
      var apRows = P.selAP ? P.floors.map(function (f) { return [f.name + "  (~" + Math.round(f.area) + " m²)", P.selAP.full, String(f.aps)]; }) : [["Indoors", "No access points", "0"]];
      if (P.builtIn) apRows.push([P.builtInFloor + "  (built into gateway)", P.selG.full, "1"]);
      if (P.outdoorAPs) apRows.push(["Outside (" + P.outdoorAreas.map(function (o) { return OUT_LABEL[o]; }).join(", ") + ")", CONFIG.apOutdoor.full, String(P.outdoorAPs)]);
      if (P.outbuildAPs) apRows.push(["Outbuildings", CONFIG.apOutbuilding.full, String(P.outbuildAPs)]);
      table(["AREA", "UNIT", "QTY"], apRows);
      para("Around " + P.devices + " devices at busy times." + (P.selAP ? " " + P.selAP.blurb + "." : ""), 8.5);

      // 3. Switch
      heading("3. Switch");
      var swRows = [];
      if (P.selSW) swRows.push([P.selSW.full, P.selSW.poe ? P.poeNeed + " PoE devices, " + P.portNeed + " ports needed, ~" + Math.round(P.poeWatts) + " W of " + P.selSW.budget * P.swCount + " W budget" : P.portNeed + " ports needed, no PoE output", String(P.swCount)]);
      else swRows.push(["None", "No network switch", ""]);
      if (P.injectors) swRows.push([CONFIG.injector, "One per powered device", String(P.injectors)]);
      if (S.roomSwQty) swRows.push([P.roomSw.full, "Extra ports behind a TV or on a desk", String(S.roomSwQty)]);
      table(null, swRows,
        { columnStyles: { 0: { fontStyle: "bold", cellWidth: 62 }, 1: { textColor: MUTED }, 2: { halign: "right", fontStyle: "bold", cellWidth: 16 } } });

      var n = 4;
      if (P.cams) {
        heading(n + ". CCTV"); n++;
        var cRows = [];
        if (P.newCams) cRows.push(["New UniFi cameras", P.replaced ? "includes " + P.replaced + " replacing analogue" : "full smart detections", String(P.newCams)]);
        if (P.onvifCams) cRows.push(["Customer's own cameras (ONVIF)", "24/7 recording, live view, no licence fee", String(P.onvifCams)]);
        if (P.aiPorts) cRows.push(["UniFi AI Port", "smart detections for own cameras", String(P.aiPorts)]);
        cRows.push(["Recording storage", S.retention + " days 24/7, ~" + fmtTB(P.storageTB) + " needed, on " + (P.needNVR ? "separate recorder" : P.selG.name), fmtTB(P.driveTB)]);
        table(null, cRows, { columnStyles: { 0: { cellWidth: 62 }, 1: { textColor: MUTED }, 2: { halign: "right", fontStyle: "bold", cellWidth: 16 } } });
      }

      // Kit list
      heading(n + ". Full kit list");
      var firstGroup = true;
      ["Network", "Wi-Fi", "CCTV", "Cabling"].forEach(function (g) {
        var rows = P.kit.filter(function (k) { return k.group === g; });
        if (!rows.length) return;
        ensure(16 + Math.min(rows.length, 3) * 7);
        var head = [{ content: g.toUpperCase(), styles: { fillColor: BG, fontStyle: "bold", fontSize: 7.5, textColor: MUTED } }, { content: firstGroup ? "WHY" : "", styles: { fillColor: BG, fontSize: 7.5, textColor: MUTED } }, { content: firstGroup ? "QTY" : "", styles: { fillColor: BG, fontSize: 7.5, textColor: MUTED, halign: "right" } }];
        table(head, rows.map(function (k) { return [k.item, k.why, String(k.q)]; }), { showHead: "everyPage", columnStyles: { 0: { cellWidth: 72 }, 1: { textColor: MUTED }, 2: { halign: "right", fontStyle: "bold", cellWidth: 14 } } });
        y -= 2; firstGroup = false;
      });
      y += 2;

      heading("Networks we'll set up");
      para(P.nets.join("   ·   "), 9.5, INK);

      if (P.notes.length) {
        heading("Good to know");
        P.notes.forEach(function (x) {
          doc.setFont("helvetica", "normal"); doc.setFontSize(9);
          var lines = doc.splitTextToSize(x[1], CW - 8), hh = lines.length * 4.1 + 5;
          ensure(hh + 2);
          if (x[0] === "warn") doc.setFillColor(255, 244, 224); else doc.setFillColor(Math.round(255 - (255 - A[0]) * 0.09), Math.round(255 - (255 - A[1]) * 0.09), Math.round(255 - (255 - A[2]) * 0.09));
          doc.roundedRect(M, y + 1.5, CW, hh, 2, 2, "F"); color(INK); doc.text(lines, M + 4, y + 6.3); y += hh + 2.5;
        });
      }

      heading("What we'll check at the survey");
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
      P.checks.forEach(function (c) {
        var lines = doc.splitTextToSize(c, CW - 8); ensure(lines.length * 4.4 + 2);
        color([199, 199, 204], "draw"); doc.setLineWidth(0.35); doc.roundedRect(M, y + 1.3, 3.6, 3.6, 0.8, 0.8, "S");
        color(INK); doc.text(lines, M + 6.5, y + 4.4); y += lines.length * 4.4 + 1.8;
      });

      heading("What happens next");
      ensure(26);
      var steps = [["1. Survey", "We visit, confirm positions and cable routes."], ["2. Fixed quote", "Itemised, based on this plan."], ["3. Install", "About " + fmtDays(P.days) + " on site, tidy cabling."], ["4. Handover", "Tested room by room, apps set up for you."]];
      steps.forEach(function (s, i) {
        var x = M + i * (bw + 3); color(BG, "fill"); doc.roundedRect(x, y + 2, bw, 22, 2.5, 2.5, "F");
        doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); color(INK); doc.text(s[0], x + 3.5, y + 7.5);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); color(MUTED); doc.text(doc.splitTextToSize(s[1], bw - 7), x + 3.5, y + 12);
      });
      y += 27;

      if (S.notes) { heading("Customer notes"); para(S.notes, 9.5, INK); }

      // Footer on every page
      var pages = doc.getNumberOfPages();
      for (var p = 1; p <= pages; p++) {
        doc.setPage(p);
        color(LINE, "draw"); doc.setLineWidth(0.2); doc.line(M, PH - 14, PW - M, PH - 14);
        doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); color(MUTED);
        doc.text(CONFIG.website + "  ·  Planning estimate. Final equipment, positions and price are confirmed after a site survey.", M, PH - 9);
        doc.text("Page " + p + " of " + pages, PW - M, PH - 9, { align: "right" });
        if (p > 1) { doc.setFont("helvetica", "bold"); doc.setFontSize(9); color(INK); doc.text((S.project ? S.project + " " : "") + "Wi-Fi plan", M, 13); color(A, "fill"); doc.rect(0, 0, PW, 3, "F"); }
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
        toast(framed ? "PDF exported. If nothing downloaded, this preview blocks downloads; it works on the live site." : "PDF downloaded");
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
      R("kAP").textContent = P.totalAPs; R("kCam").textContent = P.cams; R("kDays").textContent = fmtDays(P.days);
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
      if (t.closest('[data-r="copyBtn"]')) {
        var txt = planText();
        (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(txt) : Promise.reject())
          .then(function () { toast("Plan copied"); }, function () { toast("Couldn't copy here"); });
        return;
      }
      if (t.closest('[data-r="editBtn"]')) { step = 0; S.gw = S.ap = S.sw = null; render(); scrollTop(); return; }
    });
    root.addEventListener("input", function (e) {
      var el = e.target;
      if (el.dataset.t) { S[el.dataset.t] = el.value; if (el.dataset.t === "project") updateAside(); }
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
      api.mount(el, Object.assign(cfg, window.CityPlugPlannerConfig || {}));
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", auto); else auto();
})();
