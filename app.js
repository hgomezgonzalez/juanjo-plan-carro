(function () {
  "use strict";

  // ---------- Constantes ----------
  const NJ = { tax: 0.06625, docDefault: 599, titleLien: 85, regLight: 46.5, regHeavy: 71.5, plates: 6, decal: 4, tiresYr: 150, oilYr: 300 };
  const HOME = [40.4593, -74.361]; // Sayreville
  const NOW_YEAR = 2026 + 9.5 / 12; // mediados de octubre de 2026
  const BUDGET_MAX = 15000;
  const VERD = { good: ["good", "✓ Recomendado"], warn: ["warn", "! Con cuidado"], bad: ["bad", "✕ Descartar"] };
  const DEFAULTS = { car: "A", price: 14987, down: 3000, term: 60, apr: 7.5, ins: 350, miles: 700, gas: 4.25, other: 40, income: 800, family: 0, save: 500, goal: 5000, reserve: 1000, cutPrice: 25,
    wage: 18, hours: 28, tips: 0, tax: 12, buffer: 100, extraOn: false, season: "school" };
  const WEEKS = 52 / 12;
  const LEGAL = { school: 40, summer: 50 };
  const STORE_KEY = "juanjo.added.v1";
  const STATE_KEY = "juanjo.state.v1";
  const BASE_KEY = "juanjo.bases.v1";
  const MAX_BASES = 8;

  // Centroides aproximados de ZIP de 3 dígitos (NJ, NY, PA, CT) para estimar distancia.
  const ZIP3 = {
    "070": [40.74, -74.17], "071": [40.73, -74.2], "072": [40.66, -74.21], "073": [40.72, -74.06], "074": [40.95, -74.25],
    "075": [40.92, -74.17], "076": [40.89, -74.04], "077": [40.3, -74.1], "078": [40.88, -74.6], "079": [40.75, -74.4],
    "080": [39.85, -75.0], "081": [39.93, -75.1], "082": [39.3, -74.7], "083": [39.45, -75.0], "084": [39.37, -74.45],
    "085": [40.22, -74.7], "086": [40.22, -74.75], "087": [40.0, -74.2], "088": [40.5, -74.4], "089": [40.49, -74.45],
    "100": [40.76, -73.98], "101": [40.76, -73.98], "102": [40.76, -73.98], "103": [40.58, -74.15], "104": [40.85, -73.87],
    "105": [41.05, -73.8], "106": [41.03, -73.76], "107": [40.93, -73.9], "108": [40.93, -73.78], "109": [41.15, -74.05],
    "110": [40.73, -73.7], "111": [40.75, -73.94], "112": [40.65, -73.95], "113": [40.75, -73.83], "114": [40.7, -73.8],
    "115": [40.66, -73.64], "116": [40.6, -73.76], "117": [40.78, -73.4], "118": [40.77, -73.52], "119": [40.92, -72.66],
    "180": [40.6, -75.45], "189": [40.3, -75.1], "190": [40.0, -75.25], "191": [39.98, -75.15], "194": [40.12, -75.35],
    "068": [41.1, -73.5], "069": [41.05, -73.55], "064": [41.3, -72.9], "065": [41.3, -72.9], "066": [41.2, -73.2]
  };

  // ---------- Estado ----------
  const S = { ...DEFAULTS };
  let MODELS = null, CURATED = [], ADDED = [], ALL = [];
  let filter = "all";
  let cmpA = "A", cmpB = "J1";
  let draft = null; // carro en preparación desde el formulario
  let BASES = []; // líneas base guardadas; la última es el objetivo

  // ---------- Utilidades ----------
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => (n < 0 ? "−$" : "$") + Math.round(Math.abs(n)).toLocaleString("es-CO");
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const cap = (s) => String(s || "").replace(/\b\w/g, (c) => c.toUpperCase());
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const safeUrl = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch { return ""; } };
  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 3200);
  }
  function haversine(a, b) {
    const R = 3958.8, toR = Math.PI / 180;
    const dLat = (b[0] - a[0]) * toR, dLon = (b[1] - a[1]) * toR;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * toR) * Math.cos(b[0] * toR) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function distFromZip(zip) {
    const c = ZIP3[String(zip || "").slice(0, 3)];
    return c ? Math.round(haversine(HOME, c) * 1.2) : null; // factor carretera
  }

  // ---------- Modelo de datos por carro ----------
  function modelInfo(make, model) {
    const mk = String(make || "").toLowerCase().trim();
    const md = String(model || "").toLowerCase().trim();
    const base = { ...MODELS.default };
    const mkInfo = MODELS.makes[mk] || {};
    let mdInfo = MODELS.models[mk + "|" + md];
    if (!mdInfo) {
      // coincidencia parcial: "corolla le" -> "corolla"
      const key = Object.keys(MODELS.models).filter(k => k.startsWith(mk + "|") && md.includes(k.split("|")[1])).sort((a, b) => b.length - a.length)[0];
      mdInfo = key ? MODELS.models[key] : null;
    }
    const out = Object.assign(base, mkInfo, mdInfo || {});
    out.unknown = !mdInfo;
    return out;
  }

  // Completa un carro con datos del modelo, garantía, alertas, puntaje y veredicto.
  function enrich(c) {
    const mi = modelInfo(c.make, c.model);
    const e = { ...c };
    e.h2 = !!mi.h2;
    e.mpgE = e.h2 ? null : (c.mpg || mi.mpg);
    e.repair = mi.repair; e.dep = mi.dep; e.insF = mi.ins; e.rel = mi.rel; e.cvt = !!mi.cvt;
    e.heavy = c.heavy ?? !!mi.heavy;
    e.theft = mi.theftBefore ? c.year < mi.theftBefore : false;
    e.unknownModel = mi.unknown;
    // Garantía de tren motriz restante
    const pt = c.cpo && c.cpoPt ? c.cpoPt : mi.pt2;
    const age = NOW_YEAR - (c.year - 0.25);
    const remY = pt[0] - age, remMi = pt[1] - (c.miles || 0);
    e.warFrac = clamp(Math.min(remY / pt[0], remMi / pt[1]), 0, 1);
    e.warText = e.warFrac > 0 ? `~${Math.max(1, Math.round(remY * 12))} meses o ${Math.round(remMi / 1000)}k millas de garantía de motor` : "Sin garantía de fábrica";
    e.dist = c.dist ?? distFromZip(c.zip);
    e.alerts = [];
    if (e.h2) e.alerts.push(["bad", "Es de hidrógeno: en NJ no hay estaciones públicas. No se puede usar aquí."]);
    if (c.title === "rebuilt") e.alerts.push(["bad", "Título rebuilt/salvage: tuvo daño grave. Difícil de asegurar y de revender."]);
    if (c.accidents === "yes") e.alerts.push(["bad", "Accidente reportado: pedir el reporte completo y una inspección."]);
    if (e.theft) e.alerts.push(["warn", `${cap(c.make)} ${cap(c.model)} ${c.year} con llave puede no tener inmovilizador: exigir la actualización antirrobo y cotizar el seguro antes.`]);
    if (mi.alert) e.alerts.push(["warn", mi.alert]);
    if (e.unknownModel) e.alerts.push(["warn", "Modelo sin datos propios en la tabla: se usan promedios. Pide verificación completa."]);
    if (c.price > BUDGET_MAX) e.alerts.push(["warn", `Está ${fmt(c.price - BUDGET_MAX)} sobre el presupuesto de $15.000.`]);
    if (e.dist != null && e.dist > 40) e.alerts.push(["warn", `Queda lejos (~${e.dist} millas): suma un día de viaje y es difícil volver por garantía.`]);
    if (c.recalls) e.alerts.push(["warn", `NHTSA tiene ${c.recalls} campaña(s) de recall para este modelo y año: revisar por VIN en nhtsa.gov/recalls.`]);
    return e;
  }

  // ---------- Motor de cálculo ----------
  function pmt(P, aprPct, n) {
    if (P <= 0) return 0;
    const r = aprPct / 100 / 12;
    return r === 0 ? P / n : P * r / (1 - Math.pow(1 + r, -n));
  }
  function balanceAt(P, aprPct, n, k) {
    if (P <= 0) return 0;
    const r = aprPct / 100 / 12, p = pmt(P, aprPct, n);
    if (r === 0) return Math.max(0, P - p * k);
    return Math.max(0, P * Math.pow(1 + r, k) - p * (Math.pow(1 + r, k) - 1) / r);
  }
  function otd(car, price) {
    const doc = car.docInc ? 0 : NJ.docDefault;
    const tax = (price + doc) * NJ.tax;
    const reg = car.heavy ? NJ.regHeavy : NJ.regLight;
    const fees = NJ.titleLien + reg + NJ.plates + NJ.decal;
    return { doc, tax, reg, fees, total: price + doc + tax + fees };
  }
  function monthly(car, price, s, downOverride) {
    const o = otd(car, price);
    const down = Math.min(downOverride ?? s.down, o.total);
    const loan = o.total - down;
    const p = pmt(loan, s.apr, s.term);
    const ins = s.ins * car.insF * (car.theft ? 1.05 : 1);
    const gas = car.mpgE ? s.miles / car.mpgE * s.gas : 0;
    const maint = car.h2 ? 0 : (car.repair + NJ.tiresYr + NJ.oilYr) / 12;
    const other = s.other + o.reg / 12;
    const total = p + ins + gas + maint + other;
    const interest = p * s.term - loan;
    return { o, down, loan, p, ins, gas, maint, other, total, interest };
  }
  // Ingreso neto mensual del trabajo después de clase.
  const netPerHour = () => S.wage * (1 - S.tax / 100);
  const extraNet = () => (S.wage * S.hours + S.tips) * (1 - S.tax / 100) * WEEKS;
  const income = () => S.income + (S.extraOn ? extraNet() : 0);
  const budget = () => income() + S.family;
  // Horas por semana para cubrir un costo mensual más el margen, contando ingreso actual, familia y propinas.
  function hoursFor(total) {
    const weekly = (total + S.buffer - S.income - S.family) / WEEKS - S.tips * (1 - S.tax / 100);
    return Math.max(0, weekly / netPerHour());
  }

  // Puntaje Juanjo: cada criterio 0–100.
  function scoreParts(c, m) {
    const cost = c.h2 ? 0 : clamp(100 - (m.total - 600) / 5, 0, 100);
    const rel = c.rel;
    const ins = clamp(100 - (c.insF - 1) * 500 - (c.theft ? 20 : 0), 0, 100);
    let hist = c.accidents === "no" ? 100 : c.accidents === "yes" ? 15 : 55;
    if (c.owners >= 3) hist -= 10;
    if (c.title === "rebuilt") hist = 0;
    const war = c.warFrac * 100;
    const dist = c.dist == null ? 60 : clamp(100 - c.dist * 1.5, 0, 100);
    return { cost, rel, ins, hist, war, dist };
  }
  function scoreOf(c, m) {
    const p = scoreParts(c, m);
    let s = p.cost * .35 + p.rel * .20 + p.ins * .15 + p.hist * .15 + p.war * .10 + p.dist * .05;
    if (c.h2 || c.title === "rebuilt") s = Math.min(s, 15);
    return Math.round(s);
  }
  function autoVerdict(c, score) {
    if (c.h2 || c.title === "rebuilt") return "bad";
    let v = score >= 72 ? "good" : score >= 55 ? "warn" : "bad";
    if ((c.accidents !== "no" || c.price > 17500) && v === "good") v = "warn";
    if (c.accidents === "yes" && v === "warn" && score < 65) v = "bad";
    return v;
  }
  // Tres razones cortas, primero las más importantes.
  function reasons(c, m) {
    const r = [];
    if (c.h2) r.push(["neg", "No hay hidrógeno en NJ para cargarlo", 100]);
    if (c.title === "rebuilt") r.push(["neg", "Título rebuilt: tuvo daño grave", 95]);
    if (c.accidents === "yes") r.push(["neg", "Accidente reportado", 90]);
    if (!c.h2) {
      if (m.total <= budget()) r.push(["pos", `Cabe en tu dinero: ${fmt(m.total)} al mes`, 85]);
      else r.push(["neg", `Cuesta ${fmt(m.total)} al mes; tienes ${fmt(budget())}`, 70]);
    }
    if (c.h2) {} else if (c.rel >= 90) r.push(["pos", "Muy confiable, casi no se daña", 60]);
    else if (c.rel <= 72) r.push(["mid", `Confiabilidad regular (${c.rel} de 100)`, 55]);
    if (c.mpgE >= 45) r.push(["pos", `Gasta muy poca gasolina (${c.mpgE} MPG)`, 58]);
    else if (c.mpgE >= 33) r.push(["pos", `Buen consumo: ${c.mpgE} MPG`, 40]);
    else if (c.mpgE && c.mpgE < 29) r.push(["neg", `Gasta bastante gasolina (${c.mpgE} MPG)`, 45]);
    if (c.insF > 1.2) r.push(["neg", "Seguro muy caro para tu edad", 75]);
    else if (c.insF > 1.04) r.push(["mid", "Seguro algo más caro (sedán mediano)", 42]);
    else r.push(["pos", "De los más baratos de asegurar", 38]);
    if (c.theft) r.push(["mid", "Riesgo de robo: pide la actualización antirrobo", 65]);
    if (c.accidents === "unk") r.push(["mid", "Historial sin verificar", 50]);
    else if (c.accidents === "no") r.push(["pos", "Sin accidentes", 35]);
    if (c.warFrac > 0.3) r.push(["pos", "Le queda garantía de motor", 36]);
    else if (c.warFrac === 0) r.push(["mid", "Ya no tiene garantía de fábrica", 44]);
    if (c.price > BUDGET_MAX) r.push(["mid", `${fmt(c.price - BUDGET_MAX)} sobre el presupuesto`, 52]);
    if (c.dist != null && c.dist <= 10) r.push(["pos", "Muy cerca de casa", 30]);
    else if (c.dist > 40) r.push(["mid", `Lejos: ~${c.dist} millas`, 33]);
    return r.sort((a, b) => b[2] - a[2]);
  }

  // Por qué un carro está descartado o con cuidado: lo crítico primero, en palabras simples.
  // Junta las razones escritas a mano (cars.json "why") con las que se calculan solas, sin repetir.
  function whyItems(c, m) {
    const out = (c.why || []).map(([lvl, k, t, d]) => ({ lvl, k, t, d }));
    const has = (k) => out.some(x => x.k === k);
    const add = (lvl, k, t, d) => { if (!has(k)) out.push({ lvl, k, t, d }); };
    if (c.h2) add("crit", "h2", "No hay dónde echarle combustible", "Funciona con hidrógeno. En NJ no hay estaciones públicas.");
    if (c.title === "rebuilt") add("crit", "titulo", "Título rebuilt: tuvo daño grave", "Lo declararon pérdida total y lo repararon. Difícil de asegurar y casi nadie lo compra después.");
    if (c.accidents === "yes") add("crit", "acc", "Accidente reportado", "Puede tener daños escondidos, vale menos al venderlo y el seguro puede salir más caro.");
    if (!c.h2) {
      const gap = m.total - budget();
      if (gap >= 10) add(gap > 100 ? "crit" : "warn", "mes", `Con tu plan de hoy te faltan ${fmt(gap)} al mes`, `Cuesta ${fmt(m.total)} al mes con todo incluido y te entran ${fmt(budget())}.`);
    }
    if (c.price > BUDGET_MAX) add(c.price - BUDGET_MAX > 2500 ? "crit" : "warn", "budget", `${fmt(c.price - BUDGET_MAX)} sobre tu presupuesto`, "Más precio es más deuda, más intereses y más impuesto de venta.");
    if (c.rel <= 72 && !c.h2) add(c.warFrac === 0 ? "crit" : "warn", "rel", `Confiabilidad regular: ${c.rel} de 100`,
      (c.cvt ? "La caja automática CVT de Nissan falla más que la de Toyota o Honda y cambiarla cuesta miles de dólares. " : "")
      + `Para comparar: un Corolla tiene 95. Menos puntos = más visitas al taller y gastos que no esperas.`
      + (c.warFrac > 0 ? " La garantía que le queda lo protege por ahora." : ""));
    if (c.warFrac === 0 && !c.h2 && !(c.cvt && has("rel"))) add("warn", "war", "Ya no tiene garantía de fábrica", "Si se daña el motor o la caja, el arreglo sale de tu bolsillo.");
    if (c.theft) add("warn", "robo", "Fácil de robar si no tiene la actualización", "Algunos con llave no tienen inmovilizador. Pide el antirrobo por escrito y cotiza el seguro antes.");
    if (c.accidents === "unk") add("warn", "hist", "Historial sin verificar", "No sabemos si ha chocado. Pide el Carfax completo antes de ir.");
    if (c.insF > 1.04 && !has("seguro")) add("warn", "seguro", "Seguro más caro", "Para un conductor de 17 años este tipo de carro cuesta más de asegurar.");
    if (c.dist > 40) add("warn", "lejos", `Queda lejos: ~${c.dist} millas`, "Un día entero para ir a verlo y más difícil volver si algo falla.");
    if (c.unknownModel) add("warn", "datos", "Sin datos propios del modelo", "Se usan promedios. Pide verificación completa.");
    if (c.recalls) add("warn", "recall", `${c.recalls} recall(s) en NHTSA`, "Confirma con el VIN en nhtsa.gov/recalls que ya los arreglaron.");
    return out.sort((a, b) => (a.lvl === "crit" ? 0 : 1) - (b.lvl === "crit" ? 0 : 1));
  }
  // El mejor recomendado para comparar (distinto del carro dado).
  const bestOther = (c) => ALL.filter(x => x.verdict === "good" && x.id !== c.id && !x.h2).sort((a, b) => b.score - a.score)[0];
  function whyHtml(c, m) {
    const items = whyItems(c, m);
    const pos = reasons(c, m).filter(r => r[0] === "pos").slice(0, 2);
    const best = bestOther(c);
    const nCrit = items.filter(x => x.lvl === "crit").length;
    const title = c.verdict === "bad" ? "¿Por qué está descartado?" : "¿Por qué hay que tener cuidado?";
    let h = `<div class="why ${c.verdict}"><h4>${title}${nCrit ? ` <span class="why-n">${nCrit} crítico${nCrit > 1 ? "s" : ""}</span>` : ""}</h4><ol class="why-list">`;
    h += items.map(x => `<li class="${x.lvl}"><span class="tag">${x.lvl === "crit" ? "Crítico" : "Ojo"}</span><div><b>${esc(x.t)}</b><span>${esc(x.d)}</span></div></li>`).join("");
    h += "</ol>";
    if (pos.length) h += `<p class="why-pos"><b>Lo bueno que sí tiene:</b> ${pos.map(r => esc(r[1])).join(" · ")}</p>`;
    if (best && !c.h2) {
      const dm = m.total - best._m.total, ds = best.score - c.score;
      h += `<p class="why-cmp">Frente al <b>${esc(best.name)}</b> (el mejor recomendado): ${dm >= 1 ? `cuesta <b>${fmt(dm)} más al mes</b>` : dm <= -1 ? `cuesta ${fmt(-dm)} menos al mes` : "cuesta casi lo mismo al mes"}${ds > 0 ? ` y tiene <b>${ds} puntos menos</b>` : ""}. <button type="button" class="linkbtn" data-pick="${esc(best.id)}">Ver ese</button></p>`;
    }
    if (c.decide) h += `<p class="why-dec"><b>Decisión:</b> ${esc(c.decide)}</p>`;
    return h + "</div>";
  }

  // Recalcula puntajes y veredictos de todos los carros con la configuración actual.
  function rescore() {
    ALL.forEach(c => {
      c._m = monthly(c, c.price, S);
      c.score = scoreOf(c, c._m);
      c.verdict = c.src === "added" ? autoVerdict(c, c.score) : c.v;
    });
  }
  const carById = (id) => ALL.find(c => c.id === id);
  function rebuildAll() {
    ALL = [...CURATED, ...ADDED].map(enrich);
    rescore();
  }

  // ---------- Fotos ----------
  const SIL = '<svg class="sil" viewBox="0 0 160 120" aria-hidden="true"><path fill="currentColor" opacity=".35" d="M22 78c0-6 3-10 9-11l18-4 14-14c4-4 9-6 15-6h20c6 0 11 2 15 6l13 14 12 2c6 1 10 6 10 12v8c0 3-2 5-5 5h-8a14 14 0 0 0-28 0H56a14 14 0 0 0-28 0h-1c-3 0-5-2-5-5v-7z"/><circle cx="42" cy="88" r="10" fill="currentColor" opacity=".5"/><circle cx="114" cy="88" r="10" fill="currentColor" opacity=".5"/></svg>';
  function photo(c, eager) {
    const src = c.img ? (c.img.startsWith("img/") ? c.img : safeUrl(c.img)) : "";
    if (!src) return `<div class="ph">${SIL}</div>`;
    return `<div class="ph">${SIL}<img src="${esc(src)}" alt="${esc(c.name)}" width="400" height="300" loading="${eager ? "eager" : "lazy"}" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()"></div>`;
  }

  // ---------- Gráficas (solo se dibujan cuando están en pantalla) ----------
  const charts = {}, seen = {}, drawers = {};
  function baseOpts() {
    const ink2 = css("--ink2"), muted = css("--muted"), line = css("--line");
    return {
      responsive: true, maintainAspectRatio: false, animation: { duration: 200 },
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { display: false }, tooltip: { backgroundColor: css("--surface"), titleColor: css("--ink"), bodyColor: ink2, footerColor: ink2, borderColor: line, borderWidth: 1, padding: 10, boxPadding: 4, usePointStyle: true,
        callbacks: { label: (c) => ` ${c.dataset.label}: ${fmt(c.parsed.y ?? c.parsed)}` } } },
      scales: {
        x: { grid: { display: false }, border: { color: line }, ticks: { color: muted } },
        y: { grid: { color: line }, border: { display: false }, ticks: { color: muted, callback: (v) => fmt(v) }, beginAtZero: true }
      }
    };
  }
  function upsert(key, canvasId, cfg) {
    if (!window.Chart) return;
    if (charts[key]) { charts[key].data = cfg.data; charts[key].options = cfg.options; charts[key].update(); return; }
    charts[key] = new Chart($(canvasId), cfg);
  }
  function draw(key) { if (seen[key] && drawers[key]) drawers[key](); }
  function drawSeen() { Object.keys(drawers).forEach(draw); }
  const CANVAS = { hours: "cHours", donut: "cDonut", equity: "cEquity", when: "cWhen", interest: "cInterest", radar: "cRadar", cmpbar: "cCmpBar", tco: "cTco" };
  function watchCharts() {
    if (!("IntersectionObserver" in window)) { Object.keys(CANVAS).forEach(k => { seen[k] = true; }); drawSeen(); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const key = en.target.dataset.chart;
        seen[key] = true; draw(key); io.unobserve(en.target);
      });
    }, { rootMargin: "300px 0px" });
    Object.entries(CANVAS).forEach(([k, id]) => { const el = $(id); el.dataset.chart = k; io.observe(el); });
  }

  // ---------- Render ----------
  let rafId = 0;
  function schedule() { if (rafId) return; rafId = requestAnimationFrame(() => { rafId = 0; renderAll(); }); }

  function renderAll() {
    rescore();
    const car = carById(S.car) || ALL[0];
    S.car = car.id;
    const m = monthly(car, S.price, S);
    car._sim = m;
    renderOutputs(car, m);
    renderVerdict(car, m);
    renderHero(car, m);
    renderCuts(m);
    renderFlows(car, m);
    renderWork(car, m);
    renderOtd(car, m);
    renderDonutLegend(m);
    renderGoal();
    renderMatrix(car);
    renderReco();
    renderGoal2();
    ["donut", "equity", "when", "interest", "hours"].forEach(draw);
    scheduleHeavy();
    saveStateSoon();
  }
  // Tarjetas con foto: se redibujan cuando el usuario deja de mover los controles.
  let heavyT = 0;
  function scheduleHeavy() {
    clearTimeout(heavyT);
    heavyT = setTimeout(() => { renderStrip(); renderCompareCards(); renderGallery(); draw("radar"); draw("cmpbar"); draw("tco"); }, 180);
  }

  function renderOutputs(car, m) {
    const set = (id, t) => { $(id).textContent = t; };
    set("priceOut", fmt(S.price)); set("downOut", fmt(S.down));
    set("aprOut", S.apr.toFixed(2).replace(".", ",") + "%");
    set("insOut", fmt(S.ins) + "/mes"); set("milesOut", S.miles.toLocaleString("es-CO") + " mi");
    set("gasOut", "$" + S.gas.toFixed(2).replace(".", ",")); set("otherOut", fmt(S.other) + "/mes");
    set("incomeOut", fmt(S.income) + "/mes"); set("familyOut", fmt(S.family) + "/mes");
    set("saveOut", fmt(S.save) + "/mes"); set("goalOut", fmt(S.goal)); set("reserveOut", fmt(S.reserve));
    set("cutPriceOut", fmt(S.cutPrice));
    set("carHint", `${(car.miles || 0).toLocaleString("es-CO")} millas · ${car.dealer || "Concesionario sin dato"}${car.city ? ", " + car.city : ""}${car.dist != null ? ` (~${car.dist} mi)` : ""} · ${car.mpgE ? car.mpgE + " MPG" : "hidrógeno"}`);
    set("otdHint", `Total con impuesto y trámites NJ: ${fmt(m.o.total)}`);
    document.querySelectorAll("#term button").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.v === S.term)));

    const gap = m.total - budget();
    const st = gap <= 0 ? "good" : gap <= 200 ? "warn" : "bad";
    $("kpiGapBox").className = "kpi hero-k " + (st === "bad" ? "" : st);
    set("kpiGapLabel", gap <= 0 ? "Te sobra cada mes" : "Te falta cada mes");
    set("kpiGap", fmt(Math.abs(gap)));
    set("kpiGapSub", `Te entran ${fmt(budget())} al mes${S.extraOn ? " (con trabajo extra)" : ""}${S.family ? `, ${fmt(S.family)} de la familia` : ""}`);
    set("kpiTotal", fmt(m.total));
    set("kpiTotalSub", income() > 0 ? `De cada $100 que ganas, $${Math.min(999, Math.round(m.total / income() * 100))} se irían al carro` : "Sin ingreso");
    set("kpiPmt", fmt(m.p)); set("kpiPmtSub", `Cada mes por ${S.term} meses, para devolver ${fmt(m.loan)} que te presta el banco`);
    set("kpiInt", fmt(m.interest)); set("kpiIntSub", `Dinero extra para el banco: al final pagas ${fmt(m.p * S.term + m.down)} por un carro de ${fmt(m.o.total)}`);
  }

  function renderVerdict(car, m) {
    const gap = m.total - budget();
    const st = car.h2 ? "bad" : gap <= 0 ? "good" : gap <= 200 ? "warn" : "bad";
    $("verdict").className = "verdict " + (st === "bad" ? "" : st);
    $("verdictIcon").textContent = st === "good" ? "✓" : st === "warn" ? "!" : "✕";
    if (car.h2) {
      $("verdictTitle").textContent = "Este carro no sirve en New Jersey";
      $("verdictText").textContent = "Funciona con hidrógeno y en NJ no hay estaciones públicas. Elige otro carro arriba.";
    } else if (st === "bad") {
      const hn = hoursFor(m.total);
      $("verdictTitle").textContent = S.extraOn ? `Aun con ${S.hours} h de trabajo extra te faltan ${fmt(gap)} cada mes` : `Con lo que ganas hoy no alcanza: te faltan ${fmt(gap)} cada mes`;
      $("verdictText").textContent = `Tener el ${car.name} cuesta ${fmt(m.total)} al mes. El seguro solo (${fmt(m.ins)}) ya ${m.ins > income() ? "supera" : "se come buena parte de"} lo que gana Juan (${fmt(income())}). Con el trabajo después de clase a ${fmt(S.wage)} la hora necesitaría unas ${hn.toFixed(1).replace(".", ",")} horas por semana (sección 2). Otras salidas: que la familia aporte la diferencia, o esperar y ahorrar para una inicial más grande (sección 4).`;
    } else if (st === "warn") {
      $("verdictTitle").textContent = `Casi alcanza: te faltan ${fmt(gap)} al mes`;
      $("verdictText").textContent = `Te entran ${fmt(budget())} al mes y el carro te costaría ${fmt(m.total)} (cuota, seguro, gasolina y mantenimiento). Para que alcance puedes dar más de inicial, buscar un seguro con descuentos, elegir un carro más barato o trabajar unas horas más. Abajo, en “Así funcionan las cuentas”, está el detalle.`;
    } else {
      $("verdictTitle").textContent = `Sí alcanza: te sobran ${fmt(-gap)} al mes`;
      $("verdictText").textContent = S.extraOn
        ? `Trabajando ${S.hours} horas por semana a ${fmt(S.wage)} la hora, Juan gana unos ${fmt(income())} netos al mes y el carro cuesta ${fmt(m.total)}. Le bastarían unas ${hoursFor(m.total).toFixed(1).replace(".", ",")} horas por semana; lo demás es ahorro. Ojo: ese trabajo no está garantizado, no firmes el crédito hasta tener el empleo y 2 o 3 pagos recibidos.`
        : `Te entran ${fmt(budget())} al mes y el carro te cuesta ${fmt(m.total)}. Guarda tu dinero de emergencia (${fmt(S.reserve)}) sin tocarlo, por si chocas o se daña algo.`;
    }
  }

  function renderStrip() {
    const rank = (c) => (c.verdict === "bad" ? 1000 : 0) - c.score;
    const list = [...ALL].sort((a, b) => rank(a) - rank(b));
    const html = list.map(c => `<button type="button" class="thumb${c.verdict === "bad" ? " dim" : ""}" data-pick="${esc(c.id)}" aria-pressed="${c.id === S.car}">${photo(c)}<span>${esc(c.name)}</span><small>${c.verdict === "bad" ? "✕ Descartado · " : ""}${fmt(c.price)} · ${c.score} pts${c.src === "juan" ? " · lo vio Juan" : ""}</small></button>`).join("");
    const el = $("strip");
    if (el._html !== html) { el.innerHTML = html; el._html = html; }
  }

  function ring(score, verdict) {
    const r = 40, C = 2 * Math.PI * r, col = verdict === "good" ? "var(--good)" : verdict === "warn" ? "var(--warn)" : "var(--bad)";
    return `<svg class="ring" viewBox="0 0 96 96" role="img" aria-label="Puntaje ${score} de 100"><circle cx="48" cy="48" r="${r}" fill="none" stroke="var(--line)" stroke-width="8"/><circle cx="48" cy="48" r="${r}" fill="none" stroke="${col}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${(score / 100 * C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 48 48)"/><text x="48" y="54" text-anchor="middle" font-size="28" fill="var(--ink)">${score}</text><text x="48" y="70" text-anchor="middle" font-size="10" fill="var(--muted)" font-family="var(--f-body)">de 100</text></svg>`;
  }

  function renderHero(car, m) {
    const rs = reasons(car, m).slice(0, 3);
    const [vc, vl] = VERD[car.verdict];
    const src = car.src === "juan" ? "Lo vio Juan" : car.src === "added" ? "Añadido · análisis automático" : "Nueva opción";
    const url = safeUrl(car.url);
    const key = car.id + "|" + Math.round(m.total) + "|" + car.score + "|" + S.price + "|" + Math.round(budget());
    const el = $("heroCard");
    if (el._key === key) return;
    el._key = key;
    el.innerHTML = `${photo(car, true)}
      <div class="hero-top"><div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px"><span class="pill ${vc}">${vl}</span><span class="pill src">${src}</span></div><h3>${esc(car.name)}</h3><p class="hero-meta">${esc(car.dealer || "")}${car.city ? " · " + esc(car.city) : ""}${car.dist != null ? ` · ~${car.dist} mi de casa` : ""}</p></div>${ring(car.score, car.verdict)}</div>
      <ul class="reasons">${rs.map(r => `<li class="${r[0]}"><span class="ic" aria-hidden="true">${r[0] === "pos" ? "✓" : r[0] === "neg" ? "✕" : "!"}</span><span>${esc(r[1])}</span></li>`).join("")}</ul>
      <div class="specs"><div class="spec"><b>${fmt(S.price)}</b><span>precio</span></div><div class="spec"><b>${(car.miles || 0).toLocaleString("es-CO")}</b><span>millas</span></div><div class="spec"><b>${car.mpgE || "H₂"}</b><span>MPG</span></div><div class="spec"><b>${fmt(m.total)}</b><span>${car.h2 ? "al mes, sin combustible" : "al mes, todo incluido"}</span></div></div>
      <p class="note">${esc(car.warText)}. ${esc(car.hist || "")}</p>
      ${car.verdict !== "good" ? whyHtml(car, m) : car.alerts.length ? `<div class="alerts">${car.alerts.map(a => `<div class="alert ${a[0] === "bad" ? "bad" : ""}">${esc(a[1])}</div>`).join("")}</div>` : ""}
      ${url ? `<div><a class="btn" href="${esc(url)}" target="_blank" rel="noopener">Ver anuncio ↗</a></div>` : ""}`;
  }

  const SCISSORS = '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.6 7.6 20 18M8.6 16.4 20 6M12 12h.01"/></g></svg>';
  function renderCuts(m) {
    const per = S.cutPrice;
    const have = Math.round(income() / per), need = Math.ceil(m.total / per);
    const famCuts = Math.round(S.family / per);
    const shown = Math.min(Math.max(need, have), 60);
    let icons = "";
    for (let i = 0; i < shown; i++) icons += `<span class="${i < have ? "ic-have" : i < need ? "ic-need" : "ic-extra"}">${SCISSORS}</span>`;
    const missing = Math.max(0, need - have - famCuts);
    $("cutsQ").innerHTML = need <= have + famCuts
      ? `Con <em class="ok">${have} cortes</em> al mes ya te alcanza.`
      : `Necesitas <em>${need} cortes</em> al mes. Hoy haces unos ${have}.`;
    $("cuts").innerHTML = `<div class="cut-row"><div class="lab"><b>${need}</b> cortes = ${fmt(m.total)} que cuesta el carro al mes</div><div class="icons" aria-hidden="true">${icons}</div>${need > 60 ? '<span class="small">Se muestran 60 de ' + need + "</span>" : ""}</div>
      <div class="legend-inline"><span><i class="sw" style="background:var(--good)"></i>Cortes que ya haces (${have})</span><span><i class="sw" style="background:var(--bad)"></i>Te faltan ${missing}${famCuts ? ` (la familia cubre ${famCuts})` : ""}</span></div>`;
    const max = Math.max(m.total, budget()) * 1.1;
    $("meterAvail").style.width = (budget() / max * 100).toFixed(1) + "%";
    $("meterCost").style.left = (m.total / max * 100).toFixed(1) + "%";
    $("meterL1").textContent = `Verde: tu dinero ${fmt(budget())}`;
    $("meterL2").textContent = `Raya: el carro ${fmt(m.total)}`;
  }


  const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const hh = (x) => { const h = Math.floor(x), mm = Math.round((x - h) * 60); const ap = h >= 12 ? "pm" : "am"; const h12 = ((h + 11) % 12) + 1; return `${h12}${mm ? ":" + String(mm).padStart(2, "0") : ""} ${ap}`; };
  const h1 = (x) => x.toFixed(1).replace(".", ",").replace(",0", "");
  function renderWork(car, m) {
    const set = (id, t) => { $(id).textContent = t; };
    set("wageOut", "$" + S.wage.toFixed(2).replace(".", ",")); set("hoursOut", h1(S.hours) + " h");
    set("tipsOut", fmt(S.tips)); set("taxOut", h1(S.tax) + "%"); set("bufferOut", fmt(S.buffer));
    set("scenToday", fmt(S.income) + "/mes");
    set("scenExtra", `+${fmt(extraNet())}/mes`);
    document.querySelectorAll("#scen button").forEach(b => b.setAttribute("aria-pressed", String((b.dataset.v === "1") === S.extraOn)));
    document.querySelectorAll("#season button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === S.season)));
    const cap = LEGAL[S.season];
    const need = car.h2 ? Infinity : hoursFor(m.total);
    const weekGross = S.wage * S.hours + S.tips, weekNet = weekGross * (1 - S.tax / 100);
    const monthNet = weekNet * WEEKS;
    const st = need <= 15 ? "good" : need <= 25 ? "warn" : "bad";
    $("kNeedBox").className = "kpi hero-k " + (st === "bad" ? "" : st);
    set("kNeed", isFinite(need) ? h1(Math.ceil(need * 2) / 2) + " h" : "—");
    set("kNeedSub", isFinite(need) ? `= ${h1(need * WEEKS)} h al mes para cubrir ${fmt(m.total + S.buffer)} (carro + margen)` : "Este carro no se puede usar en NJ");
    set("kWeek", fmt(weekNet));
    set("kWeekSub", `${fmt(weekGross)} brutos − ${h1(S.tax)}% de descuentos`);
    set("kMonth", fmt(monthNet));
    set("kMonthSub", `${h1(S.hours * WEEKS)} horas al mes · más ${fmt(S.income)} de lo de hoy`);
    const left = S.income + S.family + monthNet - m.total;
    set("kLeft", fmt(left));
    set("kLeftSub", left >= S.buffer ? "Después de pagar todo el carro" : left >= 0 ? "Alcanza, pero sin margen de seguridad" : "No alcanza para el carro");

    // Barra de esfuerzo: 0–50 h
    const MAXH = 50, pct = (h) => (clamp(h, 0, MAXH) / MAXH * 100).toFixed(2) + "%";
    const zones = [[15, "var(--good)", .55], [25, "var(--warn)", .65], [cap, "var(--s2)", .6], [MAXH, "var(--bad)", .7]];
    let prev = 0, zhtml = "";
    zones.forEach(([to, col, op]) => { if (to > prev) { zhtml += `<div class="z" style="width:${((to - prev) / MAXH * 100).toFixed(2)}%;background:${col};opacity:${op}"></div>`; prev = to; } });
    const mk = (h, cls, label) => `<div class="mk ${cls}${h > MAXH * 0.62 ? " flip" : ""}" style="left:${pct(h)}"><span>${label}</span></div>`;
    zhtml += isFinite(need) ? mk(need, "need", `Necesitas ${h1(Math.ceil(need * 2) / 2)} h`) : "";
    if (S.extraOn || S.hours > 0) zhtml += mk(S.hours, "", `Planeas ${h1(S.hours)} h`);
    $("effortTrack").innerHTML = zhtml;
    $("effortScale").innerHTML = [...new Set([0, 15, 25, cap, 50])].map(h => `<span style="left:${pct(h)}">${h} h</span>`).join("");
    let txt;
    if (!isFinite(need)) txt = "Este carro funciona con hidrógeno y no se puede usar en NJ.";
    else if (need === 0) txt = "Con lo que ganas hoy (más el aporte de la familia) ya se cubre el carro: no necesitas horas extra.";
    else if (need <= 15) txt = `Liviano: ${h1(Math.ceil(need * 2) / 2)} horas por semana se pueden combinar con clases sin problema, por ejemplo 2 tardes y el sábado.`;
    else if (need <= 25) txt = `Exigente: ${h1(Math.ceil(need * 2) / 2)} horas por semana son 3–4 tardes más el sábado. Se puede, pero cuida las notas: el descuento de buen estudiante del seguro depende de ellas.`;
    else if (need <= cap) txt = `Pesado: ${h1(Math.ceil(need * 2) / 2)} horas por semana con clases es casi un trabajo de tiempo completo. Cualquier semana floja deja el pago en riesgo. Considera un carro más barato, más inicial o un aporte de la familia.`;
    else txt = `No es posible: necesitarías ${h1(need)} horas por semana y la ley de NJ permite a un menor de 18 hasta ${cap} en ${S.season === "school" ? "época de clases" : "verano"}.`;
    if (S.extraOn && S.hours > cap) txt += ` Ojo: las ${h1(S.hours)} horas que planeas superan el máximo de ${cap}.`;
    $("effortText").textContent = txt;

    // Semana: sábado hasta 8 h (9 am), entre semana desde 3:30 pm hasta 5 h por día.
    const planned = S.hours;
    const sat = Math.min(8, planned);
    const rest = Math.max(0, planned - sat);
    const perDay = rest / 5;
    const fits = Math.min(perDay, 5);
    const needLeft = { v: isFinite(need) ? need : 0 };
    const dayHours = [fits, fits, fits, fits, fits, sat];
    const overDay = Math.max(0, perDay - 5);
    $("week").innerHTML = DAYS.map((d, i) => {
      const hrs = dayHours[i], start = i === 5 ? 9 : 15.5;
      const extra = i < 5 ? overDay : 0;
      let cells = "";
      const slots = Math.ceil((hrs + extra) * 2) / 2;
      for (let k = 0; k < Math.max(8, Math.ceil(slots)); k++) {
        const amt = clamp(slots - k, 0, 1);
        if (amt <= 0) { cells += "<i></i>"; continue; }
        let cls;
        if (k >= Math.ceil(hrs)) cls = "over";
        else if (needLeft.v > 0) { cls = "car"; needLeft.v -= amt; } else cls = "me";
        cells += `<i class="${cls}${amt < 1 ? " half" : ""}"></i>`;
      }
      const tm = hrs > 0 ? `${hh(start)}–${hh(start + hrs)}` : "Libre";
      return `<div class="day"><span class="dn">${d}</span><span class="tm">${tm}${extra > 0 ? `<br><b style="color:var(--bad-ink)">+${h1(extra)} h no caben</b>` : ""}</span><div class="cells">${cells}</div></div>`;
    }).join("");

    // Reparto del sueldo del mes
    const totalIn = S.income + monthNet;
    const famPart = Math.min(S.family, m.total);
    const carPart = Math.max(0, Math.min(m.total - famPart, totalIn));
    const bufPart = Math.max(0, Math.min(S.buffer, totalIn - carPart));
    const youPart = Math.max(0, totalIn - carPart - bufPart);
    const short = Math.max(0, m.total - famPart - totalIn);
    const parts = [["Paga el carro", carPart, "var(--s1)"], ["Margen de seguridad", bufPart, "var(--s4)"], ["Para ti y tu ahorro", youPart, "var(--s3)"], ["Falta para el carro", short, "var(--bad)"]].filter(p => p[1] > 0.5);
    const tot = parts.reduce((a, p) => a + p[1], 0) || 1;
    $("split").innerHTML = parts.map(p => `<div style="flex:${p[1] / tot};background:${p[2]}" title="${p[0]}: ${fmt(p[1])}">${p[1] / tot > .12 ? fmt(p[1]) : ""}</div>`).join("");
    const perTen = totalIn > 0 ? Math.round(carPart / totalIn * 10) : 0;
    $("splitLegend").innerHTML = parts.map(p => `<span><i class="sw" style="background:${p[2]}"></i>${p[0]}: ${fmt(p[1])}</span>`).join("")
      + (totalIn > 0 ? `<span>De cada $10 que ganas, ${short > 0 ? "todos" : "$" + perTen} se van al carro${famPart ? ` (la familia pone ${fmt(famPart)})` : ""}.</span>` : "");
  }
  drawers.hours = () => {
    const list = ALL.filter(c => !c.h2 && (c.verdict !== "bad" || c.id === S.car)).map(c => ({ c, h: hoursFor(c._m.total) })).sort((a, b) => a.h - b.h);
    $("hoursBox").style.height = Math.max(240, list.length * 32 + 60) + "px";
    const cap = LEGAL[S.season];
    const o = baseOpts();
    o.indexAxis = "y";
    o.interaction = { mode: "index", axis: "y", intersect: false };
    o.scales = {
      x: { beginAtZero: true, suggestedMax: Math.max(cap + 2, S.hours + 2), grid: { color: css("--line") }, border: { display: false }, ticks: { color: css("--muted"), callback: (v) => v + " h" } },
      y: { grid: { display: false }, border: { color: css("--line") }, ticks: { color: css("--ink2"), font: { weight: 600 } } }
    };
    o.plugins.tooltip.callbacks = { label: (c) => ` ${h1(c.parsed.x)} h por semana (${fmt(list[c.dataIndex].c._m.total)} al mes)` };
    const col = css("--s1");
    upsert("hours", "cHours", {
      type: "bar",
      data: { labels: list.map(x => x.c.name), datasets: [{ label: "Horas por semana", data: list.map(x => x.h), backgroundColor: list.map(x => x.c.id === S.car ? css("--s2") : col), borderRadius: 4, barThickness: 18 }] },
      options: o,
      plugins: [{ id: "lines", afterDatasetsDraw(ch) {
        const { top, bottom } = ch.chartArea, ctx = ch.ctx, x = ch.scales.x;
        const line = (v, color, label, dash) => { const px = x.getPixelForValue(v); ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(px, top); ctx.lineTo(px, bottom); ctx.stroke(); ctx.fillStyle = color; ctx.font = `700 12px ${css("--f-body")}`; ctx.textAlign = "right"; ctx.fillText(label, px - 4, top + 12); ctx.restore(); };
        line(cap, css("--bad"), `Máximo legal ${cap} h`, [6, 4]);
        if (S.hours > 0) line(S.hours, css("--s1"), `Planeas ${h1(S.hours)} h`, []);
      } }]
    });
  };

  function renderOtd(car, m) {
    const o = m.o;
    const rows = [
      ["Precio del carro", S.price, car.docInc ? "Incluye doc fee del concesionario" : ""],
      ["Doc fee (cargo de papeleo)", o.doc, car.docInc ? "Ya incluido en el precio" : "Promedio NJ $711; negociable"],
      ["Impuesto de venta NJ 6,625%", o.tax, ""],
      ["Placas, registro, título y calcomanía roja", o.fees, car.heavy ? "Registro $71,50 (más de 3.500 lb)" : "Registro $46,50"],
      ["Total que cuesta comprarlo", o.total, ""],
      ["Pago inicial", -m.down, ""],
      ["Lo que te presta el banco", m.loan, `${S.term} meses al ${S.apr.toFixed(2).replace(".", ",")}%`]
    ];
    $("otdTable").innerHTML = rows.map((r, i) => `<tr${i === 4 || i === 6 ? ' style="font-weight:700"' : ""}><td>${r[0]}${r[2] ? `<div class="small">${r[2]}</div>` : ""}</td><td class="r">${fmt(r[1])}</td></tr>`).join("");
  }

  const PARTS = [["Cuota del crédito", "p", "--s1"], ["Seguro", "ins", "--s2"], ["Gasolina", "gas", "--s3"], ["Mantenimiento y llantas", "maint", "--s4"], ["Peajes, parqueo, registro", "other", "--s5"]];
  function renderDonutLegend(m) {
    $("donutLegend").innerHTML = PARTS.map(p => `<div class="legend-row"><i class="sw" style="background:var(${p[2]})"></i><span>${p[0]}</span><span class="val">${fmt(m[p[1]])}</span></div>`).join("")
      + `<div class="legend-row" style="border-top:1px solid var(--line);padding-top:6px"><i></i><b>Total</b><span class="val">${fmt(m.total)}</span></div>`;
  }
  drawers.donut = () => {
    const m = carById(S.car)._sim;
    upsert("donut", "cDonut", {
      type: "doughnut",
      data: { labels: PARTS.map(p => p[0]), datasets: [{ label: "Al mes", data: PARTS.map(p => m[p[1]]), backgroundColor: PARTS.map(p => css(p[2])), borderColor: css("--surface"), borderWidth: 2, hoverOffset: 4 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: "62%", animation: { duration: 200 },
        plugins: { legend: { display: false }, tooltip: { backgroundColor: css("--surface"), titleColor: css("--ink"), bodyColor: css("--ink2"), borderColor: css("--line"), borderWidth: 1, callbacks: { label: (c) => ` ${c.label}: ${fmt(c.parsed)}` } } } }
    });
  };

  drawers.equity = () => {
    const car = carById(S.car), m = car._sim;
    const labels = [], bal = [], val = [];
    let under = 0;
    for (let k = 0; k <= S.term; k += 3) {
      labels.push(k === 0 ? "Hoy" : `Mes ${k}`);
      const b = balanceAt(m.loan, S.apr, S.term, k), v = S.price * Math.pow(1 - car.dep, k / 12);
      bal.push(b); val.push(v);
      if (b > v) under = k;
    }
    upsert("equity", "cEquity", {
      type: "line",
      data: { labels, datasets: [
        { label: "Saldo del crédito", data: bal, borderColor: css("--s2"), backgroundColor: css("--s2"), borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, tension: .25 },
        { label: "Valor del carro", data: val, borderColor: css("--s1"), backgroundColor: css("--s1"), borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, tension: .25 }
      ] },
      options: baseOpts()
    });
    $("equityNote").textContent = under > 0
      ? `Durante unos ${under} meses Juan deberá más de lo que vale el carro. Si choca o lo vende en ese tiempo, tendría que poner dinero encima. Una inicial más grande acorta ese periodo.`
      : "Desde el primer día el carro vale más de lo que se debe. Buena señal: si hay que venderlo, alcanza para pagar el crédito.";
  };

  const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const monthLabel = (i) => { const d = new Date(2026, 9 + i, 1); return `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`; };
  function whenSeries(car) {
    const cost = [], downs = [];
    let first = -1;
    for (let i = 0; i <= 24; i++) {
      const down = Math.max(0, 3000 + i * S.save - S.reserve);
      const price = S.price * Math.pow(1 - car.dep, i / 12);
      const m = monthly(car, price, S, down);
      cost.push(m.total); downs.push(down);
      if (first < 0 && m.total <= budget()) first = i;
    }
    return { cost, downs, first };
  }
  function goalMonth() {
    const need = S.goal + S.reserve - 3000;
    if (need <= 0) return 0;
    if (S.save <= 0) return -1;
    return Math.ceil(need / S.save);
  }

  function renderGoal() {
    const car = carById(S.car);
    const ws = whenSeries(car);
    const gm = goalMonth();
    const have = Math.max(0, 3000 - S.reserve);
    const pct = clamp(have / S.goal * 100, 0, 100);
    $("goalBar").style.width = pct.toFixed(1) + "%";
    $("goalPct").textContent = `${Math.round(pct)}%`;
    $("goalLabel").textContent = `Meta de inicial ${fmt(S.goal)} (más ${fmt(S.reserve)} de colchón). Hoy: ${fmt(have)} disponibles para la inicial.` + (gm > 0 ? ` La alcanzas en ${monthLabel(gm)}.` : gm === 0 ? " Ya la tienes." : " Sin ahorro mensual no llegas.");
    let cal = "";
    for (let i = 1; i <= 12; i++) {
      const saved = 3000 + i * S.save;
      const cls = [i === gm ? "goal" : "", i === ws.first ? "buy" : "", monthLabel(i) === "jun 27" ? "grad" : ""].join(" ");
      const tags = [i === gm ? "Meta de inicial" : "", i === ws.first ? "¡Cabe en tu dinero!" : "", monthLabel(i) === "jun 27" ? "Graduación" : ""].filter(Boolean).join(" · ");
      cal += `<div class="mo ${cls}"><span class="m">${monthLabel(i)}</span><span class="a">Ahorro ${fmt(saved)}</span><span class="t">${tags}</span></div>`;
    }
    $("cal").innerHTML = cal;
    const last = ws.cost[24];
    let txt;
    if (car.h2) txt = "<b>Este carro no sirve en NJ.</b> Elige otro.";
    else if (ws.first === 0) txt = `<b>Ya cuadra hoy.</b> Con ${fmt(ws.downs[0])} de inicial el costo total es ${fmt(ws.cost[0])} al mes y el dinero disponible es ${fmt(budget())}.`;
    else if (ws.first > 0) txt = `<b>Cuadra en ${monthLabel(ws.first)}.</b> Ahorrando ${fmt(S.save)} al mes llegarías a ${fmt(ws.downs[ws.first])} de inicial (más el colchón de ${fmt(S.reserve)}), y el carro costaría ${fmt(ws.cost[ws.first])} al mes, dentro de los ${fmt(budget())} disponibles.`;
    else txt = `<b>No cuadra en los próximos 24 meses.</b> Aun esperando hasta ${monthLabel(24)} con ${fmt(ws.downs[24])} de inicial, el carro costaría ${fmt(last)} al mes y faltarían ${fmt(last - budget())}. Esperar solo baja la cuota: el seguro, la gasolina y el mantenimiento siguen ahí. Lo que mueve la aguja es más ingreso o un aporte familiar fijo; prueba subirlos en el simulador.`;
    $("whenText").innerHTML = txt;
  }
  drawers.when = () => {
    const car = carById(S.car), ws = whenSeries(car);
    const labels = ws.cost.map((_, i) => monthLabel(i));
    const o = baseOpts();
    o.plugins.tooltip.callbacks.afterBody = (items) => `Inicial disponible: ${fmt(ws.downs[items[0].dataIndex])}`;
    const grad = labels.indexOf("jun 27");
    upsert("when", "cWhen", {
      type: "line",
      data: { labels, datasets: [
        { label: "Costo total al mes", data: ws.cost, borderColor: css("--s1"), backgroundColor: css("--s1"), borderWidth: 2, pointRadius: labels.map((_, i) => i === ws.first ? 6 : 0), pointHoverRadius: 5, tension: .2 },
        { label: "Dinero disponible", data: labels.map(budget), borderColor: css("--good"), backgroundColor: css("--good"), borderWidth: 2, borderDash: [6, 4], pointRadius: 0, pointHoverRadius: 4 }
      ] },
      options: o,
      plugins: [{ id: "grad", afterDatasetsDraw(ch) {
        if (grad < 0) return;
        const x = ch.scales.x.getPixelForValue(grad), { top, bottom } = ch.chartArea, ctx = ch.ctx;
        ctx.save(); ctx.strokeStyle = css("--muted"); ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
        ctx.fillStyle = css("--ink2"); ctx.font = `600 12px ${css("--f-body")}`; ctx.fillText("Graduación", x + 4, top + 12); ctx.restore();
      } }]
    });
  };

  const DOWNS = [0, 1000, 2000, 3000, 5000, 7000, 9000];
  const TERMS = [36, 48, 60, 72];
  function renderMatrix(car) {
    const head = `<thead><tr><th>Inicial</th>${TERMS.map(t => `<th>${t} meses</th>`).join("")}</tr></thead>`;
    const body = DOWNS.map(d => `<tr><td><b>${fmt(d)}</b></td>${TERMS.map(t => {
      const m = monthly(car, S.price, { ...S, term: t }, d), g = m.total - budget();
      const cls = g <= 0 ? "cell-good" : g <= 200 ? "cell-warn" : "cell-bad";
      const cur = d === S.down && t === S.term ? ' style="outline:2px solid var(--ink);outline-offset:-2px"' : "";
      return `<td class="${cls}"${cur}><b>${fmt(m.p)}</b><span class="small" style="color:inherit">total ${fmt(m.total)}</span></td>`;
    }).join("")}</tr>`).join("");
    $("matrix").innerHTML = head + `<tbody>${body}</tbody>`;
  }
  drawers.interest = () => {
    const car = carById(S.car);
    const cols = ["--s1", "--s2", "--s3", "--s4"].map(css);
    const o = baseOpts();
    o.scales.x.title = { display: true, text: "Pago inicial", color: css("--muted") };
    upsert("interest", "cInterest", { type: "line", data: { labels: DOWNS.map(fmt), datasets: TERMS.map((t, i) => ({
      label: `${t} meses`, data: DOWNS.map(d => monthly(car, S.price, { ...S, term: t }, d).interest),
      borderColor: cols[i], backgroundColor: cols[i], borderWidth: 2, pointRadius: 3, pointHoverRadius: 6, tension: .2 })) }, options: o });
    $("intLegend").innerHTML = TERMS.map((t, i) => `<span><i class="sw" style="background:${cols[i]}"></i>${t} meses</span>`).join("");
  };


  function showCard(id) {
    filter = "all"; document.querySelectorAll("#filters button").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.f === "all")));
    renderGallery();
    const el = document.getElementById("card-" + id); if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 2400);
  }

  // Explicación simple: dinero de cada mes y dinero guardado.
  function renderFlows(car, m) {
    const row = (sg, label, val, sub, cls) => `<div class="fl-row ${cls || ""}"><span class="sg">${sg}</span><span>${label}${sub ? `<small>${sub}</small>` : ""}</span><b>${val}</b></div>`;
    const gap = budget() - m.total;
    let h = row("+", "Lo que ganas en la barbería", fmt(S.income), "Hoy, al mes");
    if (S.extraOn) h += row("+", "Trabajo extra después de clase", fmt(extraNet()), `${h1(S.hours)} h por semana, ya sin impuestos`);
    if (S.family) h += row("+", "Lo que pone la familia", fmt(S.family));
    h += row("=", "Te entra al mes", fmt(budget()), "", "sum");
    h += row("−", "Cuota al banco", fmt(m.p), `${S.term} meses`);
    h += row("−", "Seguro", fmt(m.ins), "Obligatorio");
    h += car.h2 ? row("✕", "Hidrógeno", "—", "En NJ no se vende: no hay cómo calcularlo (ni cómo usar el carro)", "res bad")
      : row("−", "Gasolina", fmt(m.gas), `${S.miles} millas al mes`);
    h += row("−", "Mantenimiento y llantas", fmt(m.maint), "Aceite, frenos, llantas, reparaciones");
    h += row("−", "Otros (peajes, parqueo, registro)", fmt(m.other));
    h += row("=", "El carro te cuesta al mes", fmt(m.total), car.h2 ? "Sin contar combustible, porque aquí no hay" : "", "sum");
    if (car.h2) h += row("✕", "No sirve hacer la cuenta", "—", "Aunque parezca barato, en NJ no lo podrías manejar", "res bad");
    else h += row(gap >= 0 ? "✓" : "✕", gap >= 0 ? "Te sobra cada mes" : "Te falta cada mes", fmt(Math.abs(gap)),
      gap >= 0 ? "Esto puedes guardarlo o usarlo para ti" : "Este dinero tendría que salir de algún lado cada mes",
      "res " + (gap >= 0 ? (gap < S.buffer ? "warn" : "good") : "bad"));
    $("flowMonth").innerHTML = h;

    const saved = 3000, used = m.down + S.reserve, left = saved - used;
    let g = row("", "Tienes ahorrado hoy", fmt(saved));
    g += row("−", "Pago inicial el día de la compra", fmt(m.down), "Lo demás te lo presta el banco");
    g += row("−", "Dinero de emergencia (no se toca)", fmt(S.reserve), "Por si chocas o se daña algo");
    g += row(left >= 0 ? "✓" : "✕", left >= 0 ? "Te queda libre" : "Te falta ahorrar", fmt(Math.abs(left)),
      left >= 0 ? "No hace falta guardar más para empezar" : `Guardando ${fmt(S.save)} al mes lo tienes en ${S.save > 0 ? Math.ceil(-left / S.save) + " mes(es)" : "—"}`,
      "res " + (left >= 0 ? "good" : "bad"));
    $("flowSave").innerHTML = g;
  }

  // ---------- Comparar ----------
  function carOptions(sel) {
    const groups = [["good", "✓ Recomendados"], ["warn", "! Con cuidado"], ["bad", "✕ Descartados"]];
    return groups.map(([v, lab]) => {
      const items = ALL.filter(c => c.verdict === v).sort((a, b) => b.score - a.score);
      return items.length ? `<optgroup label="${lab}">${items.map(c => `<option value="${esc(c.id)}"${c.id === sel ? " selected" : ""}>${esc(c.name)} · ${fmt(c.price)}</option>`).join("")}</optgroup>` : "";
    }).join("");
  }
  function renderCompareCards() {
    if (!carById(cmpA)) cmpA = ALL[0].id;
    if (!carById(cmpB)) cmpB = ALL[1].id;
    [["cmpA", cmpA, "--s1"], ["cmpB", cmpB, "--s2"]].forEach(([el, id, col]) => {
      const c = carById(id), [vc, vl] = VERD[c.verdict];
      const key = id + "|" + c.score + "|" + Math.round(c._m.total) + "|" + ALL.length;
      if ($(el)._key === key) return;
      $(el)._key = key;
      $(el).innerHTML = `<select data-cmp="${el}" aria-label="Carro a comparar">${carOptions(id)}</select>${photo(c)}
        <div class="cmp-h"><i class="sw" style="background:var(${col})"></i><b>${esc(c.name)}</b></div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="big">${c.score}</span><span class="small">puntos</span><span class="pill ${vc}">${vl}</span></div>
        <div class="car-line">${fmt(c._m.total)} al mes · ${fmt(c.price)} · ${(c.miles || 0).toLocaleString("es-CO")} mi</div>`;
    });
  }
  const AXES = [["Costo al mes", "cost"], ["Confiabilidad", "rel"], ["Seguro", "ins"], ["Historial", "hist"], ["Garantía", "war"]];
  drawers.radar = () => {
    const a = carById(cmpA), b = carById(cmpB);
    const pa = scoreParts(a, a._m), pb = scoreParts(b, b._m);
    const c1 = css("--s1"), c2 = css("--s2"), line = css("--line");
    const hexA = (h, al) => h.startsWith("#") && h.length === 7 ? h + al : h;
    upsert("radar", "cRadar", {
      type: "radar",
      data: { labels: AXES.map(x => x[0]), datasets: [
        { label: a.name, data: AXES.map(x => Math.round(pa[x[1]])), borderColor: c1, backgroundColor: hexA(c1, "26"), borderWidth: 2, pointRadius: 3, pointBackgroundColor: c1 },
        { label: b.name, data: AXES.map(x => Math.round(pb[x[1]])), borderColor: c2, backgroundColor: hexA(c2, "26"), borderWidth: 2, pointRadius: 3, pointBackgroundColor: c2 }
      ] },
      options: { responsive: true, maintainAspectRatio: false, animation: { duration: 200 },
        plugins: { legend: { display: false }, tooltip: { backgroundColor: css("--surface"), titleColor: css("--ink"), bodyColor: css("--ink2"), borderColor: line, borderWidth: 1, callbacks: { label: (c) => ` ${c.dataset.label}: ${c.parsed.r}/100` } } },
        scales: { r: { min: 0, max: 100, ticks: { display: false, stepSize: 25 }, grid: { color: line }, angleLines: { color: line }, pointLabels: { color: css("--ink2"), font: { size: 12, weight: 600 } } } } }
    });
    $("radarLegend").innerHTML = `<span><i class="sw" style="background:${c1}"></i>${esc(a.name)}</span><span><i class="sw" style="background:${c2}"></i>${esc(b.name)}</span>`;
  };
  drawers.cmpbar = () => {
    const a = carById(cmpA), b = carById(cmpB);
    const c1 = css("--s1"), c2 = css("--s2");
    const o = baseOpts();
    o.indexAxis = "y";
    o.interaction = { mode: "index", axis: "y", intersect: false };
    o.scales = { x: { grid: { color: css("--line") }, border: { display: false }, ticks: { color: css("--muted"), callback: (v) => fmt(v) }, beginAtZero: true }, y: { grid: { display: false }, ticks: { color: css("--ink2") } } };
    o.plugins.tooltip.callbacks = { label: (c) => ` ${c.dataset.label}: ${fmt(c.parsed.x)}` };
    upsert("cmpbar", "cCmpBar", {
      type: "bar",
      data: { labels: PARTS.map(p => p[0]).concat("Total"), datasets: [
        { label: a.name, data: PARTS.map(p => a._m[p[1]]).concat(a._m.total), backgroundColor: c1, borderRadius: 4, barPercentage: .8, categoryPercentage: .7 },
        { label: b.name, data: PARTS.map(p => b._m[p[1]]).concat(b._m.total), backgroundColor: c2, borderRadius: 4, barPercentage: .8, categoryPercentage: .7 }
      ] },
      options: o
    });
    $("cmpBarLegend").innerHTML = `<span><i class="sw" style="background:${c1}"></i>${esc(a.name)}</span><span><i class="sw" style="background:${c2}"></i>${esc(b.name)}</span>`;
  };

  // ---------- Galería ----------
  function renderGallery() {
    const list = ALL.filter(c => filter === "all" || (filter === "good" ? c.verdict === "good" : c.src === filter)).sort((a, b) => b.score - a.score);
    const html = list.map(c => {
      const [vc, vl] = VERD[c.verdict];
      const rs = reasons(c, c._m).slice(0, 3);
      const url = safeUrl(c.url);
      const src = c.src === "juan" ? "Lo vio Juan" : c.src === "added" ? "Añadido" : "Nueva opción";
      return `<article class="car${c.id === S.car ? " sel" : ""}" id="card-${esc(c.id)}">
        <div style="position:relative">${photo(c)}<div class="badges"><span class="pill ${vc}">${vl}</span><span class="score ${c.verdict}" title="Puntaje Juanjo">${c.score}</span></div></div>
        <div class="car-body">
          <div style="display:flex;gap:6px;flex-wrap:wrap"><span class="pill src">${src}</span>${c.src === "added" ? '<span class="pill src">Historial sin verificar</span>' : ""}</div>
          <h3>${esc(c.name)}</h3>
          <div class="car-line">${fmt(c.price)}${c.docInc ? " con doc fee" : " + doc fee"} · ${(c.miles || 0).toLocaleString("es-CO")} mi · ${c.mpgE ? c.mpgE + " MPG" : "H₂"}</div>
          <div class="car-line">${esc(c.dealer || "")}${c.city ? " · " + esc(c.city) : ""}${c.dist != null ? ` · ~${c.dist} mi` : ""}</div>
          <div class="car-cost"><b>${c.h2 ? "—" : fmt(c._m.total)}</b><span>${c.h2 ? "no se puede usar en NJ" : "al mes, todo incluido"}</span></div>
          ${c.verdict !== "good" ? whyItems(c, c._m).slice(0, 2).map(w => `<div class="why-line ${w.lvl}"><b>${w.lvl === "crit" ? "Crítico" : "Ojo"}:</b> ${esc(w.t)}</div>`).join("") : ""}
          <div class="chips">${rs.map(r => `<span class="chip ${r[0] === "pos" ? "pos" : r[0] === "neg" ? "neg" : ""}">${esc(r[1])}</span>`).join("")}</div>
          <div class="car-actions">
            <button type="button" class="btn solid" data-sim="${esc(c.id)}">${c.verdict === "bad" ? "Ver por qué" : "Simular"}</button>
            ${url ? `<a class="btn" href="${esc(url)}" target="_blank" rel="noopener">Anuncio ↗</a>` : ""}
            ${c.src === "added" ? `<button type="button" class="btn ghost" data-verify="${esc(c.id)}">Pedir verificación</button><button type="button" class="btn ghost" data-remove="${esc(c.id)}">Quitar</button>` : ""}
          </div>
        </div></article>`;
    }).join("") || '<p class="note">No hay carros en este filtro. Añade uno con el link.</p>';
    const el = $("gallery");
    if (el._html !== html) { el.innerHTML = html; el._html = html; }
    $("car").innerHTML = carOptions(S.car);
  }

  const TCO = [["Pérdida de valor + impuestos y trámites", "--s1"], ["Intereses", "--s2"], ["Seguro", "--s3"], ["Gasolina", "--s4"], ["Mantenimiento", "--s5"]];
  drawers.tco = () => {
    const list = ALL.filter(c => c.verdict !== "bad").map(c => {
      const m = c._m, n = 36;
      const k = Math.min(n, S.term);
      const balEnd = balanceAt(m.loan, S.apr, S.term, k);
      const interest36 = m.p * k - (m.loan - balEnd);
      const lossAndFees = m.o.total - c.price * Math.pow(1 - c.dep, 3);
      const parts = [lossAndFees, interest36, m.ins * n, m.gas * n, m.maint * n];
      return { c, parts, total: parts.reduce((a, b) => a + b, 0) };
    }).sort((a, b) => a.total - b.total);
    $("tcoBox").style.height = Math.max(240, list.length * 38 + 60) + "px";
    const cols = TCO.map(t => css(t[1]));
    const o = baseOpts();
    o.indexAxis = "y";
    o.interaction = { mode: "index", axis: "y", intersect: false };
    o.scales = {
      x: { stacked: true, grid: { color: css("--line") }, border: { display: false }, ticks: { color: css("--muted"), callback: (v) => fmt(v) } },
      y: { stacked: true, grid: { display: false }, border: { color: css("--line") }, ticks: { color: css("--ink2"), font: { weight: 600 } } }
    };
    o.plugins.tooltip.callbacks = { label: (c) => ` ${c.dataset.label}: ${fmt(c.parsed.x)}`, footer: (it) => `Total 3 años: ${fmt(list[it[0].dataIndex].total)} (${fmt(list[it[0].dataIndex].total / 36)}/mes)` };
    upsert("tco", "cTco", {
      type: "bar",
      data: { labels: list.map(x => x.c.name), datasets: TCO.map((t, i) => ({ label: t[0], data: list.map(x => x.parts[i]), backgroundColor: cols[i], borderColor: css("--surface"), borderWidth: { right: 2 }, borderSkipped: false, barThickness: 22 })) },
      options: o
    });
    $("tcoLegend").innerHTML = TCO.map((t, i) => `<span><i class="sw" style="background:${cols[i]}"></i>${t[0]}</span>`).join("");
  };

  function renderReco() {
    const a = carById("A");
    const bestAdded = ALL.filter(c => c.src === "added" && c.score > (a ? a.score : 0))[0];
    $("recoText").innerHTML = `<b>Carro recomendado: 2023 Toyota Corolla LE por $14.987</b> en Trophy Auto Lounge, South Amboy (a 3 millas de casa). Es el más barato de mantener de la lista: el seguro de un Corolla es de los más bajos para adolescentes, hace unas 35 millas por galón, tiene el costo de reparación más bajo y es el que menos valor pierde. Sin accidentes, un dueño y $1.546 por debajo del mercado. Segunda opción: el 2022 Corolla LE del mismo lote ($14.297). De los carros que vio Juan, el más sensato es el <b>2024 Nissan Sentra SV certificado</b> ($15.689 en Hackensack), por la garantía de motor hasta 100k millas.`
      + (bestAdded ? `<br><br><b>Ojo:</b> el carro que añadiste, ${esc(bestAdded.name)}, saca ${bestAdded.score} puntos, más que el Corolla. Pide la verificación completa antes de decidir.` : "")
      + `<br><br><b>Sobre el dinero:</b> ${moneyAdvice(a)}`;
  }
  function moneyAdvice(a) {
    const total = a._m.total, gap = total - budget(), share = Math.round(total / Math.max(budget(), 1) * 100);
    const extraH = hoursFor(total);
    const hTxt = `${extraH.toFixed(1).replace(".", ",")} horas por semana a ${fmt(S.wage)}`;
    if (gap > 0) return `con la configuración actual el Corolla cuesta ${fmt(total)} al mes en total y Juan tiene ${fmt(budget())}: faltan ${fmt(gap)}. Está muy cerca, pero se iría prácticamente todo su ingreso en el carro, sin margen para un deducible ni para ahorrar. Para cerrarlo con un margen de ${fmt(S.buffer)} necesitaría unas ${hTxt} de trabajo extra (sección 2), una inicial más grande o un carro más barato. Lo prudente es ahorrar unos meses más (sección 4) y firmar cuando la cuenta deje margen.`;
    if (-gap < S.buffer) return `con la configuración actual el Corolla cuesta ${fmt(total)} al mes y Juan tiene ${fmt(budget())}: alcanza, pero solo sobran ${fmt(-gap)}. El carro se llevaría el ${share}% de su ingreso. Una semana floja o una reparación lo dejaría sin pagar. Conviene sumar unas horas de trabajo (sección 2) o subir la inicial antes de firmar.`;
    return `con la configuración actual el Corolla cuesta ${fmt(total)} al mes y Juan tiene ${fmt(budget())}: le sobran ${fmt(-gap)} al mes (el carro se lleva el ${share}% de su ingreso). El plan funciona. Mantén el colchón de ${fmt(S.reserve)} y no firmes hasta tener el ingreso estable por 2 o 3 meses.`;
  }

  // ---------- Añadir carro por link ----------
  function vinValid(v) {
    const map = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9, S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9 };
    const w = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < 17; i++) { const ch = v[i]; sum += (/\d/.test(ch) ? +ch : map[ch] || 0) * w[i]; }
    const chk = sum % 11;
    return (chk === 10 ? "X" : String(chk)) === v[8];
  }
  function parsePaste(text) {
    let dec = text;
    for (let i = 0; i < 3; i++) { try { const d = decodeURIComponent(dec); if (d === dec) break; dec = d; } catch { break; } }
    const out = {};
    const vins = (dec.toUpperCase().match(/(?<![A-Z0-9])[A-HJ-NPR-Z0-9]{17}(?![A-Z0-9])/g) || []);
    out.vin = vins.find(vinValid) || vins[0] || "";
    const pm = dec.match(/\$\s?(\d{1,3}(?:,\d{3})+|\d{4,6})(?!\d)/);
    if (pm) out.price = +pm[1].replace(/,/g, "");
    const mm = dec.match(/([\d,]{3,7})\s*(?:mi\b|miles|millas)/i);
    if (mm) out.miles = +mm[1].replace(/,/g, "");
    const urls = text.match(/https?:\/\/[^\s"'<>]+/g) || [];
    urls.forEach(u => {
      try {
        const url = new URL(u);
        const q = url.searchParams;
        if (q.get("af_og_image")) out.img = q.get("af_og_image");
        if (q.get("og_image")) out.img = out.img || q.get("og_image");
        if (q.get("dealerZip")) out.zip = q.get("dealerZip");
        if (q.get("make")) out.make = q.get("make");
        if (q.get("model")) out.model = q.get("model");
        if (q.get("af_og_title")) out.title = q.get("af_og_title");
        if (q.get("af_web_dp")) out.url = q.get("af_web_dp").replace(/[?&]no_ul=1/, "").replace(/\?partner=[^&]*/, "");
        if (!out.url && !/onelink\.me/.test(url.host)) out.url = url.href;
      } catch { /* link mal formado */ }
    });
    if (!out.url && urls[0]) out.url = urls[0];
    const tm = (out.title || dec).match(/\b(19|20)\d{2}\s+([A-Za-z-]+)\s+([A-Za-z0-9-]+(?:\s(?!in\b)[A-Za-z0-9-]+)?)(?:\s+in\s+([^,]+,\s*[A-Z]{2}))?/);
    if (tm) {
      out.year = out.year || +tm[0].slice(0, 4);
      out.make = out.make || tm[2];
      if (!out.model) out.model = tm[3].replace(/\s+(in|with|-).*$/i, "");
      if (tm[4]) out.city = tm[4];
    }
    return out;
  }
  async function decodeVin(vin) {
    const r = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${encodeURIComponent(vin)}?format=json`);
    if (!r.ok) throw new Error("vpic " + r.status);
    const x = (await r.json()).Results[0];
    if (!x || !x.Make) throw new Error("VIN no reconocido");
    let model = (x.Model || "").trim();
    if (/HEV|Hybrid/i.test(x.ElectrificationLevel || "") && /corolla/i.test(model)) model += " Hybrid";
    return { year: +x.ModelYear || null, make: cap((x.Make || "").toLowerCase()), model, trim: (x.Trim || x.Series || "").trim(), weight: +x.CurbWeightLB || null };
  }
  async function recallCount(make, model, year) {
    try {
      const r = await fetch(`https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${year}`);
      if (!r.ok) return null;
      const j = await r.json();
      return j.Count ?? null;
    } catch { return null; }
  }
  function status(msg, kind) { const s = $("parseStatus"); s.hidden = false; s.className = "status " + (kind || ""); s.textContent = msg; }
  function fillForm(d) {
    $("fYear").value = d.year || ""; $("fMake").value = d.make || ""; $("fModel").value = d.model || ""; $("fTrim").value = d.trim || "";
    $("fPrice").value = d.price || ""; $("fMiles").value = d.miles ?? ""; $("fDealer").value = d.dealer || ""; $("fCity").value = d.city || "";
    $("fZip").value = d.zip || ""; $("fAcc").value = d.accidents || "unk"; $("fOwners").value = d.owners || ""; $("fTitle").value = d.title || "clean";
    $("fDoc").checked = !!d.docInc; $("fCpo").checked = !!d.cpo; $("fVin").value = d.vin || ""; $("fImg").value = d.img || ""; $("fUrl").value = d.url || "";
    $("addForm").hidden = false;
    const firstEmpty = ["fPrice", "fMiles", "fYear", "fMake", "fModel"].map($).find(i => !i.value);
    (firstEmpty || $("fDealer")).focus();
  }
  async function onParse() {
    const text = $("pasteIn").value.trim();
    if (!text) { status("Pega primero el link o el mensaje del carro.", "err"); return; }
    const d = parsePaste(text);
    draft = d;
    const dup = d.vin && ALL.find(c => c.vin && c.vin.toUpperCase() === d.vin);
    if (dup) {
      const why = dup.verdict === "bad" ? ` Está marcado “Descartar”: ${dup.hist}` : "";
      status(`Este carro ya está en la lista: ${dup.name} (${dup.city || ""}), ${dup.score} puntos.${why}`, dup.verdict === "bad" ? "err" : "ok");
      $("addForm").hidden = true;
      filter = "all"; document.querySelectorAll("#filters button").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.f === "all")));
      renderGallery();
      setTimeout(() => showCard(dup.id), 1400);
      return;
    }
    if (d.vin) {
      status(`VIN ${d.vin} encontrado. Consultando NHTSA…`);
      try {
        const v = await decodeVin(d.vin);
        Object.assign(d, { year: v.year || d.year, make: v.make || d.make, model: v.model || d.model, trim: v.trim || d.trim });
        if (v.weight) d.heavy = v.weight > 3500;
        status(`Listo: ${d.year} ${d.make} ${d.model} ${d.trim || ""}. ${d.price ? "Precio " + fmt(d.price) + "." : "Falta el precio."} ${d.miles ? "" : "Escribe las millas."}`, "ok");
      } catch {
        status("No pude consultar el VIN en NHTSA (sin conexión o VIN raro). Completa los datos a mano.", "err");
      }
    } else {
      status("Este link no trae VIN (pasa con Cars.com y CarGurus). Completa año, marca, modelo, precio y millas a mano; el VIN está en el anuncio.", "err");
    }
    fillForm(d);
  }
  function readForm() {
    const n = (id) => { const v = parseFloat($(id).value); return isFinite(v) ? v : null; };
    const make = $("fMake").value.trim(), model = $("fModel").value.trim(), year = n("fYear");
    const trim = $("fTrim").value.trim();
    const vin = $("fVin").value.trim().toUpperCase();
    return {
      id: "U" + (vin || Date.now().toString(36)).slice(-8),
      src: "added", make: make.toLowerCase(), model: model.toLowerCase(), year,
      name: `${year} ${cap(make)} ${cap(model)}${trim ? " " + trim : ""}`.trim(),
      vin, price: n("fPrice"), docInc: $("fDoc").checked, miles: n("fMiles") || 0,
      dealer: $("fDealer").value.trim(), city: $("fCity").value.trim(), zip: $("fZip").value.trim(),
      accidents: $("fAcc").value, owners: $("fOwners").value ? +$("fOwners").value : null, title: $("fTitle").value,
      cpo: $("fCpo").checked, img: safeUrl($("fImg").value.trim()) || null, url: safeUrl($("fUrl").value.trim()) || "",
      heavy: draft && draft.heavy != null ? draft.heavy : undefined,
      hist: "Análisis automático con datos del modelo. El historial no está verificado: pide el Carfax y una inspección."
    };
  }
  async function onAdd(ev) {
    ev.preventDefault();
    const c = readForm();
    if (!c.year || !c.make || !c.model || !c.price) { status("Faltan año, marca, modelo o precio.", "err"); return; }
    status("Buscando recalls en NHTSA…");
    c.recalls = await recallCount(c.make, c.model, c.year);
    ADDED = ADDED.filter(x => x.id !== c.id && (!c.vin || x.vin !== c.vin));
    ADDED.push(c);
    saveAdded();
    rebuildAll();
    const e = carById(c.id);
    $("addForm").hidden = true; $("pasteIn").value = ""; $("parseStatus").hidden = true; $("addBox").open = false; draft = null;
    pickCar(c.id);
    toast(`Añadido: ${e.name}. Puntaje ${e.score} (${VERD[e.verdict][1].slice(2)}).`);
    document.getElementById("tu-carro").scrollIntoView({ behavior: "smooth" });
  }


  // ---------- Persistencia y líneas base ----------
  function loadState() {
    try {
      const j = JSON.parse(localStorage.getItem(STATE_KEY) || "null");
      if (!j || !j.S) return;
      Object.keys(DEFAULTS).forEach(k => { if (j.S[k] != null && typeof j.S[k] === typeof DEFAULTS[k]) S[k] = j.S[k]; });
      if (!carById(S.car)) { S.car = DEFAULTS.car; S.price = carById(S.car).price; }
      if (j.cmpA && carById(j.cmpA)) cmpA = j.cmpA;
      if (j.cmpB && carById(j.cmpB)) cmpB = j.cmpB;
      const c = carById(S.car); $("price").max = Math.max(25000, Math.ceil(c.price / 1000) * 1000 + 3000);
    } catch { /* sin almacenamiento */ }
  }
  let saveT = 0;
  function saveStateSoon() {
    clearTimeout(saveT);
    saveT = setTimeout(() => { try { localStorage.setItem(STATE_KEY, JSON.stringify({ S, cmpA, cmpB, at: Date.now() })); } catch { /* sin almacenamiento */ } }, 300);
  }
  function loadBases() { try { const j = JSON.parse(localStorage.getItem(BASE_KEY) || "[]"); return Array.isArray(j) ? j : []; } catch { return []; } }
  function saveBases() { try { localStorage.setItem(BASE_KEY, JSON.stringify(BASES)); } catch { /* sin almacenamiento */ } }
  const activeBase = () => BASES[BASES.length - 1] || null;

  function metricsNow() {
    const car = carById(S.car), m = monthly(car, S.price, S);
    return { car: car.id, carName: car.name, total: m.total, gap: m.total - budget(), pmt: m.p, down: m.down, interest: m.interest,
      hours: hoursFor(m.total), first: whenSeries(car).first, score: car.score, income: budget() };
  }
  function saveBaseline() {
    const m = metricsNow();
    const n = BASES.length ? Math.max(...BASES.map(b => b.n || 0)) + 1 : 1;
    BASES.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), n, label: `Línea base ${n}`, at: new Date().toISOString(), S: { ...S }, m, who: ME.name || "" });
    while (BASES.length > MAX_BASES) BASES.shift();
    saveBases(); renderBases(); renderGoal2();
    toast(`Guardada “Línea base ${n}” como tu objetivo.`);
  }
  function loadBase(id) {
    const b = BASES.find(x => x.id === id); if (!b) return;
    Object.keys(DEFAULTS).forEach(k => { if (b.S[k] != null) S[k] = b.S[k]; });
    if (!carById(S.car)) { S.car = DEFAULTS.car; S.price = carById(S.car).price; toast("Ese carro ya no está en la lista; se cargó el Corolla."); }
    const c = carById(S.car); $("price").max = Math.max(25000, Math.ceil(c.price / 1000) * 1000 + 3000);
    syncInputs(); schedule();
  }
  const fmtGap = (g) => g > 0 ? `Faltan ${fmt(g)}` : `Sobran ${fmt(-g)}`;
  const fmtH = (h) => h1(Math.round(h * 10) / 10) + " h";
  const fmtFirst = (i) => i < 0 ? "+24 meses" : i === 0 ? "Ya" : monthLabel(i);
  // Métricas del objetivo: [clave, etiqueta, formato, menor es mejor]
  const GOAL_METRICS = [
    ["total", "Costo al mes", fmt, true],
    ["gap", "Falta / sobra", fmtGap, true],
    ["pmt", "Cuota", fmt, true],
    ["hours", "Horas extra/sem", fmtH, true],
    ["first", "Cuadra en", fmtFirst, true],
    ["down", "Inicial", fmt, null]
  ];
  function delta(key, cur, base, lowerBetter) {
    if (key === "first") {
      const c = cur < 0 ? 99 : cur, b = base < 0 ? 99 : base;
      if (c === b) return ["same", "igual"];
      return c < b ? ["better", `${b - c} mes${b - c > 1 ? "es" : ""} antes`] : ["worse", `${c - b} mes${c - b > 1 ? "es" : ""} después`];
    }
    const d = cur - base;
    const tol = key === "hours" ? 0.25 : 1;
    if (Math.abs(d) < tol) return ["same", "igual"];
    const txt = key === "hours" ? `${d > 0 ? "▲" : "▼"} ${h1(Math.abs(d))} h` : `${d > 0 ? "▲" : "▼"} ${fmt(Math.abs(d))}`;
    if (lowerBetter == null) return ["neutral", txt];
    return [(d < 0) === lowerBetter ? "better" : "worse", txt];
  }
  function renderGoal2() {
    const b = activeBase(), el = $("goalbar");
    if (!b) {
      el.className = "goalbar empty";
      el.innerHTML = `<div class="gb-tag"><b>Sin objetivo todavía</b><span>Mueve los valores hasta que te guste el plan y guárdalo como línea base: quedará aquí arriba como la meta a alcanzar.</span></div>
        <div class="gb-actions"><button type="button" class="btn solid" data-gb="save">Guardar línea base</button><button type="button" class="btn ghost" data-share="1">Compartir mi plan</button></div>`;
      ["kpiGapGoal", "kpiTotalGoal", "kpiPmtGoal", "kpiIntGoal", "kNeedGoal", "kLeftGoal"].forEach(id => { $(id).textContent = ""; });
      return;
    }
    const cur = metricsNow();
    const when = new Date(b.at);
    const same = b.m.car === cur.car;
    el.className = "goalbar";
    el.innerHTML = `<div class="gb-tag"><b>Objetivo · ${esc(b.label)}</b><span>${esc(b.m.carName)} · ${when.toLocaleDateString("es-CO", { day: "numeric", month: "short" })} ${when.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })}${same ? "" : ` · ahora ves: ${esc(cur.carName)}`}</span></div>
      <div class="gb-metrics">${GOAL_METRICS.map(([k, lab, f, lb]) => {
        const [cls, txt] = delta(k, cur[k], b.m[k], lb);
        const hit = lb != null && cls !== "worse";
        return `<div class="gm${hit ? " hit" : ""}" title="Objetivo: ${esc(f(b.m[k]))} · Ahora: ${esc(f(cur[k]))}"><span class="k">${lab}</span><span class="o">${f(b.m[k])}</span><span class="d ${cls}">Ahora ${f(cur[k])}${cls === "same" ? "" : " · " + txt}</span></div>`;
      }).join("")}</div>
      <div class="gb-actions"><button type="button" class="btn ghost" data-gb="restore">Volver al objetivo</button><button type="button" class="btn solid" data-gb="save">Guardar nueva</button><a class="btn ghost" href="#lineas">Historial (${BASES.length})</a><button type="button" class="btn ghost" data-share="1">Compartir mi plan</button></div>`;
    const chip = (id, k, f, lb) => { const [cls, txt] = delta(k, cur[k], b.m[k], lb); const e = $(id); e.className = "gc " + cls; e.textContent = `Objetivo ${f(b.m[k])}${cls === "same" ? " · lo cumples" : " · " + txt}`; };
    chip("kpiGapGoal", "gap", fmtGap, true); chip("kpiTotalGoal", "total", fmt, true); chip("kpiPmtGoal", "pmt", fmt, true);
    chip("kpiIntGoal", "interest", fmt, true); chip("kNeedGoal", "hours", fmtH, true);
    const left = $("kLeftGoal"); left.className = "gc"; left.textContent = `Objetivo: ${fmtGap(b.m.gap)}`;
  }
  function renderBases() {
    const sec = $("lineas");
    sec.hidden = false;
    $("basesEmpty").hidden = BASES.length > 0;
    const act = activeBase();
    $("bases").innerHTML = [...BASES].reverse().map(b => {
      const isAct = b === act;
      const when = new Date(b.at);
      return `<article class="base${isAct ? " active" : ""}">
        <div class="bt"><input type="text" value="${esc(b.label)}" data-rename="${b.id}" aria-label="Nombre de la línea base" maxlength="40">${isAct ? '<span class="pill goal">Objetivo actual</span>' : ""}</div>
        <span class="small">${esc(b.m.carName)} · ${when.toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}${b.who ? ` · de ${esc(b.who)}` : ""}</span>
        <dl><dt>Costo al mes</dt><dd>${fmt(b.m.total)}</dd><dt>Falta / sobra</dt><dd>${fmtGap(b.m.gap)}</dd><dt>Cuota · plazo</dt><dd>${fmt(b.m.pmt)} · ${b.S.term} m</dd>
        <dt>Inicial</dt><dd>${fmt(b.m.down)}</dd><dt>Ingreso usado</dt><dd>${fmt(b.m.income)}${b.S.extraOn ? " (con trabajo)" : ""}</dd><dt>Horas extra/sem</dt><dd>${fmtH(b.m.hours)}</dd><dt>Cuadra en</dt><dd>${fmtFirst(b.m.first)}</dd></dl>
        <div class="car-actions"><button type="button" class="btn solid" data-bload="${b.id}">Cargar valores</button>${isAct ? "" : `<button type="button" class="btn" data-bact="${b.id}">Hacer objetivo</button>`}<button type="button" class="btn ghost" data-bdel="${b.id}">Borrar</button></div>
      </article>`;
    }).join("");
  }
  function bindBases() {
    $("goalbar").addEventListener("click", (e) => {
      const b = e.target.closest("[data-gb]"); if (!b) return;
      if (b.dataset.gb === "save") saveBaseline();
      if (b.dataset.gb === "restore") { loadBase(activeBase().id); toast("Volviste a los valores de tu objetivo."); }
    });
    $("bases").addEventListener("click", (e) => {
      const ld = e.target.closest("[data-bload]"), ac = e.target.closest("[data-bact]"), dl = e.target.closest("[data-bdel]");
      if (ld) { loadBase(ld.dataset.bload); toast("Valores cargados. Muévelos y compara con el objetivo de arriba."); document.getElementById("tu-carro").scrollIntoView({ behavior: "smooth" }); }
      if (ac) { const i = BASES.findIndex(x => x.id === ac.dataset.bact); BASES.push(BASES.splice(i, 1)[0]); saveBases(); renderBases(); renderGoal2(); toast("Ahora ese es tu objetivo."); }
      if (dl) {
        if (dl.dataset.confirm !== "1") { dl.dataset.confirm = "1"; dl.textContent = "¿Seguro? Toca otra vez"; setTimeout(() => { dl.dataset.confirm = ""; dl.textContent = "Borrar"; }, 3000); return; }
        BASES = BASES.filter(x => x.id !== dl.dataset.bdel); saveBases(); renderBases(); renderGoal2(); toast("Línea base borrada.");
      }
    });
    $("bases").addEventListener("change", (e) => {
      const r = e.target.closest("[data-rename]"); if (!r) return;
      const b = BASES.find(x => x.id === r.dataset.rename); if (!b) return;
      b.label = r.value.trim() || b.label; saveBases(); renderGoal2();
    });
  }

  // ---------- Guardar y compartir ----------
  function saveAdded() { try { localStorage.setItem(STORE_KEY, JSON.stringify(ADDED)); } catch { /* sin almacenamiento */ } }
  function loadAdded() { try { const j = JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); return Array.isArray(j) ? j : []; } catch { return []; } }
  const SHARE_KEYS = ["id", "make", "model", "year", "name", "vin", "price", "docInc", "miles", "dealer", "city", "zip", "accidents", "owners", "title", "cpo", "img", "url", "heavy", "recalls"];
  function decodeList(s) {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
    const arr = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0))));
    return arr.map(row => {
      const c = { src: "added", hist: "Recibido por enlace compartido. Análisis automático; historial sin verificar." };
      SHARE_KEYS.forEach((k, i) => { if (row[i] != null) c[k] = row[i]; });
      c.img = c.img ? safeUrl(c.img) || null : null; c.url = c.url ? safeUrl(c.url) : "";
      return c;
    }).filter(c => c.id && c.make && c.price);
  }
  // ---------- Compartir el plan completo por enlace ----------
  const ME_KEY = "juanjo.me.v1";
  const ME = { name: "" };
  try { ME.name = localStorage.getItem(ME_KEY) || ""; } catch { /* sin almacenamiento */ }
  const b64u = (bytes) => { let bin = ""; bytes.forEach(b => { bin += String.fromCharCode(b); }); return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
  const unb64u = (s) => { const b = s.replace(/-/g, "+").replace(/_/g, "/"); const bin = atob(b + "===".slice((b.length + 3) % 4)); return Uint8Array.from(bin, ch => ch.charCodeAt(0)); };
  async function packPlan(obj) {
    const raw = new TextEncoder().encode(JSON.stringify(obj));
    if ("CompressionStream" in window) {
      try {
        const zipped = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer());
        return "z." + b64u(zipped);
      } catch { /* sin compresión */ }
    }
    return "j." + b64u(raw);
  }
  async function unpackPlan(s) {
    const [kind, body] = [s.slice(0, 1), s.slice(2)];
    let bytes = unb64u(body);
    if (kind === "z") bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  async function shareLink() {
    const who = ME.name || "Alguien";
    const plan = {
      v: 2, who, at: Date.now(), S: { ...S },
      bases: BASES.map(b => ({ ...b, who: b.who || who })),
      cars: ADDED.map(c => SHARE_KEYS.map(k => c[k] ?? null))
    };
    return location.origin + location.pathname + "#plan=" + await packPlan(plan);
  }
  async function onShare() {
    if (!ME.name) {
      $("lineas").hidden = false;
      document.getElementById("lineas").scrollIntoView({ behavior: "smooth" });
      setTimeout(() => $("meName").focus(), 400);
      toast("Escribe tu nombre para que sepan quién comparte el plan.");
      return;
    }
    const url = await shareLink();
    $("shareUrl").value = url; $("shareOut").hidden = false;
    const text = `${ME.name} te comparte su plan del carro`;
    if (navigator.share) {
      try { await navigator.share({ title: "Plan Carro Juanjo", text, url }); return; } catch (err) { if (err && err.name === "AbortError") return; }
    }
    toast(await copy(url) ? "Enlace copiado. Pégalo en WhatsApp para compartir tu plan." : "Copia el enlace de la caja de abajo.");
  }

  // Lee #plan= (plan completo) o #lista= (solo carros, enlaces viejos).
  async function importHash() {
    const lista = location.hash.match(/^#lista=([A-Za-z0-9_-]+)$/);
    const plan = location.hash.match(/^#plan=([zj]\.[A-Za-z0-9_-]+)$/);
    if (!lista && !plan) return null;
    const clear = () => history.replaceState(null, "", location.pathname + location.search);
    try {
      if (lista) {
        const list = decodeList(lista[1]);
        let n = 0;
        list.forEach(c => { if (!ADDED.some(x => x.id === c.id)) { ADDED.push(c); n++; } });
        saveAdded(); clear();
        return { kind: "lista", n };
      }
      const P = await unpackPlan(plan[1]);
      if (!P || P.v !== 2 || !P.S) throw new Error("formato");
      clear();
      return { kind: "plan", P };
    } catch { clear(); return { kind: "error" }; }
  }
  let BEFORE = null; // mis valores antes de ver el plan recibido
  function applyPlan(P) {
    // Carros añadidos
    let nc = 0;
    (P.cars || []).forEach(row => {
      const c = { src: "added", hist: `Compartido por ${P.who}. Análisis automático; historial sin verificar.` };
      SHARE_KEYS.forEach((k, i) => { if (row[i] != null) c[k] = row[i]; });
      c.img = c.img ? safeUrl(c.img) || null : null; c.url = c.url ? safeUrl(c.url) : "";
      if (c.id && c.make && c.price && !ADDED.some(x => x.id === c.id)) { ADDED.push(c); nc++; }
    });
    saveAdded();
    // Líneas base: se suman; si ya existe la misma, se reemplaza. Su objetivo queda como el objetivo.
    let nb = 0;
    (P.bases || []).forEach(b => {
      if (!b || !b.id || !b.S || !b.m) return;
      const i = BASES.findIndex(x => x.id === b.id);
      if (i >= 0) BASES.splice(i, 1); else nb++;
      BASES.push(b);
    });
    while (BASES.length > MAX_BASES * 2) BASES.shift();
    saveBases();
    rebuildAll();
    // Ver lo que estaba probando
    BEFORE = { ...S };
    Object.keys(DEFAULTS).forEach(k => { if (P.S[k] != null && typeof P.S[k] === typeof DEFAULTS[k]) S[k] = P.S[k]; });
    if (!carById(S.car)) { S.car = DEFAULTS.car; S.price = carById(S.car).price; }
    const c = carById(S.car); $("price").max = Math.max(25000, Math.ceil(c.price / 1000) * 1000 + 3000);
    syncInputs();
    return { nc, nb };
  }
  function showReceived(P, counts) {
    const el = $("received");
    const goal = (P.bases || [])[(P.bases || []).length - 1];
    const when = new Date(P.at || Date.now());
    el.hidden = false;
    el.innerHTML = `<div><b>${esc(P.who)} te compartió su plan</b> · ${when.toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</div>
      <p class="note">Estás viendo exactamente lo que ${esc(P.who)} estaba probando.${goal ? ` Su objetivo “${esc(goal.label)}” (${esc(goal.m.carName)}, ${fmt(goal.m.total)} al mes) quedó arriba como objetivo.` : ""} ${counts.nb ? `Se guardaron ${counts.nb} línea(s) base` : ""}${counts.nb && counts.nc ? " y " : counts.nb ? "." : ""}${counts.nc ? `${counts.nc} carro(s) que añadió.` : ""}</p>
      <div class="car-actions"><a class="btn solid" href="#cuentas">Ver sus cuentas</a><a class="btn" href="#lineas">Ver sus líneas base</a>${BEFORE ? '<button type="button" class="btn ghost" id="backMine">Volver a mis valores</button>' : ""}<button type="button" class="btn ghost" id="closeReceived">Cerrar aviso</button></div>`;
  }
  async function handleHash(first) {
    const r = await importHash();
    if (!r) return;
    if (r.kind === "error") { toast("El enlace compartido está dañado o incompleto. Pide que lo vuelvan a enviar."); return; }
    if (r.kind === "lista") { if (!first) { rebuildAll(); renderAll(); } announceImport(r.n); return; }
    const counts = applyPlan(r.P);
    renderAll(); renderBases(); renderStrip(); renderCompareCards(); renderGallery();
    showReceived(r.P, counts);
    window.scrollTo({ top: 0 });
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
  }

  // ---------- Eventos ----------
  const RANGES = ["price", "down", "apr", "ins", "miles", "gas", "other", "income", "family", "save", "goal", "reserve", "cutPrice", "wage", "hours", "tips", "tax", "buffer"];
  function syncInputs() { RANGES.forEach(k => { $(k).value = S[k]; }); }
  function pickCar(id) {
    const c = carById(id); if (!c) return;
    if (c.h2) toast("Es de hidrógeno: lo puedes ver, pero en NJ no hay dónde cargarlo.");
    S.car = id; S.price = c.price;
    const pr = $("price"); pr.max = Math.max(25000, Math.ceil(c.price / 1000) * 1000 + 3000);
    syncInputs(); schedule();
  }
  function bind() {
    RANGES.forEach(k => $(k).addEventListener("input", (e) => { S[k] = parseFloat(e.target.value); schedule(); }));
    $("car").addEventListener("change", (e) => pickCar(e.target.value));
    $("term").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { S.term = +b.dataset.v; schedule(); } });
    $("strip").addEventListener("click", (e) => { const b = e.target.closest("[data-pick]"); if (b) pickCar(b.dataset.pick); });
    $("heroCard").addEventListener("click", (e) => { const b = e.target.closest("[data-pick]"); if (b) { pickCar(b.dataset.pick); $("tu-carro").scrollIntoView({ behavior: "smooth" }); } });
    bindBases();
    document.addEventListener("click", (e) => { const q = e.target.closest('a[href^="#g-"]'); if (q) $("glosario").open = true; });
    if (/^#g-/.test(location.hash)) $("glosario").open = true;
    $("scen").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { S.extraOn = b.dataset.v === "1"; if (S.extraOn && S.hours === 0) S.hours = 28; syncInputs(); schedule(); } });
    $("season").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { S.season = b.dataset.v; schedule(); } });
    $("h500").addEventListener("click", () => { S.hours = Math.round(500 / S.wage * 2) / 2; S.extraOn = true; syncInputs(); schedule(); toast(`${h1(S.hours)} h a ${fmt(S.wage)} ≈ ${fmt(S.hours * S.wage)} brutos por semana.`); });
    $("hNeed").addEventListener("click", () => { const c = carById(S.car); S.hours = Math.min(50, Math.ceil(hoursFor(monthly(c, S.price, S).total) * 2) / 2); S.extraOn = true; syncInputs(); schedule(); });
    $("hours").addEventListener("input", () => { if (!S.extraOn) { S.extraOn = true; } });
    $("resetBtn").addEventListener("click", () => { const car = S.car, price = carById(car).price; Object.assign(S, DEFAULTS, { car, price }); syncInputs(); schedule(); toast("Valores iniciales restaurados."); });
    $("gallery").addEventListener("click", async (e) => {
      const sim = e.target.closest("[data-sim]"), rm = e.target.closest("[data-remove]"), ver = e.target.closest("[data-verify]");
      if (sim) { pickCar(sim.dataset.sim); document.getElementById("tu-carro").scrollIntoView({ behavior: "smooth" }); }
      if (rm) {
        if (rm.dataset.confirm !== "1") { rm.dataset.confirm = "1"; rm.textContent = "¿Seguro? Toca otra vez"; setTimeout(() => { rm.dataset.confirm = ""; rm.textContent = "Quitar"; }, 3000); return; }
        ADDED = ADDED.filter(x => x.id !== rm.dataset.remove); saveAdded(); rebuildAll();
        if (!carById(S.car)) pickCar("A"); else schedule();
        toast("Carro quitado de tu lista.");
      }
      if (ver) {
        const c = carById(ver.dataset.verify);
        const txt = `Claude, verifica este carro para el Plan Carro Juanjo y agrégalo a cars.json:\n${c.name}\nVIN: ${c.vin || "sin VIN"}\nPrecio: ${fmt(c.price)} · Millas: ${c.miles}\nConcesionario: ${c.dealer || "?"} ${c.city || ""} ${c.zip || ""}\nAnuncio: ${c.url || "sin link"}`;
        toast(await copy(txt) ? "Texto copiado. Pásaselo a Hugo para que Claude lo verifique." : "No se pudo copiar: mándale a Hugo el link del anuncio.");
      }
    });
    $("filters").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      filter = b.dataset.f;
      document.querySelectorAll("#filters button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
      renderGallery();
    });
    document.querySelector("#comparar").addEventListener("change", (e) => {
      const s = e.target.closest("[data-cmp]"); if (!s) return;
      if (s.dataset.cmp === "cmpA") cmpA = s.value; else cmpB = s.value;
      renderCompareCards(); draw("radar"); draw("cmpbar"); saveStateSoon();
    });
    $("parseBtn").addEventListener("click", onParse);
    $("manualBtn").addEventListener("click", () => { draft = {}; $("parseStatus").hidden = true; fillForm({}); });
    $("cancelAdd").addEventListener("click", () => { $("addForm").hidden = true; $("parseStatus").hidden = true; draft = null; });
    $("addForm").addEventListener("submit", onAdd);
    $("fMake").addEventListener("input", fillModelList);
    document.addEventListener("click", (e) => { if (e.target.closest("[data-share]")) onShare(); });
    $("meName").value = ME.name;
    $("meName").addEventListener("change", (e) => { ME.name = e.target.value.trim().slice(0, 20); try { localStorage.setItem(ME_KEY, ME.name); } catch { /* sin almacenamiento */ } BASES.forEach(b => { if (!b.who) b.who = ME.name; }); saveBases(); renderBases(); });
    $("received").addEventListener("click", (e) => {
      if (e.target.id === "closeReceived") $("received").hidden = true;
      if (e.target.id === "backMine" && BEFORE) { Object.assign(S, BEFORE); BEFORE = null; const c = carById(S.car) || carById(DEFAULTS.car); S.car = c.id; syncInputs(); schedule(); $("received").hidden = true; toast("Volviste a tus valores. Sus líneas base siguen guardadas en el historial."); }
    });
    $("shareCopy").addEventListener("click", async () => { const i = $("shareUrl"); if (!(await copy(i.value))) { i.select(); } else toast("Enlace copiado."); });
    // Tema: redibujar con los colores nuevos
    const rebuildCharts = () => { Object.keys(charts).forEach(k => { charts[k].destroy(); delete charts[k]; }); drawSeen(); };
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", rebuildCharts);
    new MutationObserver(rebuildCharts).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }
  function fillModelList() {
    const mk = $("fMake").value.trim().toLowerCase();
    $("modelList").innerHTML = Object.keys(MODELS.models).filter(k => k.startsWith(mk + "|")).map(k => `<option value="${esc(cap(k.split("|")[1]))}">`).join("");
  }

  // ---------- Arranque ----------
  async function start() {
    try {
      const [cj, mj] = await Promise.all([fetch("data/cars.json").then(r => r.json()), fetch("data/models.json").then(r => r.json())]);
      MODELS = mj; CURATED = cj.cars;
    } catch (err) {
      $("verdictTitle").textContent = "No se pudieron cargar los datos";
      $("verdictText").textContent = "Abre la página desde su dirección web (no como archivo) o recarga.";
      return;
    }
    ADDED = loadAdded();
    BASES = loadBases();
    rebuildAll();
    $("makeList").innerHTML = [...new Set(Object.keys(MODELS.models).map(k => k.split("|")[0]))].map(m => `<option value="${esc(cap(m))}">`).join("");
    loadState();
    syncInputs();
    bind();
    renderAll();
    renderBases();
    if ("ResizeObserver" in window) new ResizeObserver(([e]) => document.documentElement.style.setProperty("--gb-h", Math.ceil(e.target.getBoundingClientRect().height) + "px")).observe($("goalbar"));
    renderStrip(); renderCompareCards(); renderGallery();
    watchCharts();
    await handleHash(true);
    window.addEventListener("hashchange", () => handleHash(false));
  }
  function announceImport(n) {
    if (n > 0) { rebuildAll(); renderAll(); }
    if (n > 0) { toast(`Se añadieron ${n} carro(s) del enlace compartido.`); filter = "added"; document.querySelectorAll("#filters button").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.f === "added"))); renderGallery(); }
    else if (n < 0) toast("El enlace compartido está dañado; no se cargaron carros.");
  }
  if (window.Chart) Chart.defaults.font.family = css("--f-body");
  start();
})();
