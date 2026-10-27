/*
 * waveshaper-aliasing.js — naive waveshaping and the aliasing it creates
 *
 * Usage (anywhere in a page or blog post):
 *   <div data-waveshaper-aliasing></div>
 *   <script src="waveshaper-aliasing.js"></script>
 *
 * If no element with data-waveshaper-aliasing exists, the demo is inserted
 * right after the <script> tag. No dependencies.
 *
 * A sine is driven into tanh or a hard clipper, evaluated sample by sample
 * with no antialiasing. Each partial in the spectrum is drawn as a line:
 * the odd harmonics in one color, partials folded back from above Nyquist
 * in another.
 *
 * Loudness: playback gain follows A-weighting (a standard approximation of
 * the ear's equal-loudness contour at moderate levels). The A-weighted power
 * of the current spectrum is compared with the same sound at 100 Hz, and the
 * gain only ever goes down, so sweeping into the ear's sensitive 2-5 kHz
 * region doesn't get louder.
 */
(function () {
  "use strict";

  var script = document.currentScript;

  function mountAll() {
    var hosts = document.querySelectorAll("[data-waveshaper-aliasing]:not([data-mounted])");
    if (!hosts.length && script) {
      var div = document.createElement("div");
      div.setAttribute("data-waveshaper-aliasing", "");
      script.parentNode.insertBefore(div, script.nextSibling);
      hosts = [div];
    }
    for (var i = 0; i < hosts.length; i++) mount(hosts[i]);
  }

  // ---------- styles (scoped under .wsa) ----------
  var CSS = [
    ".wsa{--wsa-bg:#f8f8fc;--wsa-ink:#1c1940;--wsa-muted:#5c5880;--wsa-rule:#d4d1e6;--wsa-accent:#40318d;--wsa-fold:#c0522a;--wsa-warn:#a2512c;",
    "font:15px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif;color:var(--wsa-ink);background:var(--wsa-bg);border:1px solid var(--wsa-rule);border-radius:10px;padding:16px;display:grid;gap:16px;max-width:980px;margin:1.5em 0}",
    "@media (prefers-color-scheme:dark){.wsa{--wsa-bg:#1d1a4a;--wsa-ink:#dcd8f7;--wsa-muted:#9c97c8;--wsa-rule:#322e66;--wsa-accent:#8b80ee;--wsa-fold:#ee9a6c;--wsa-warn:#e39268}}",
    ".wsa *{box-sizing:border-box}",
    ".wsa-scope{border-bottom:1px solid var(--wsa-rule);padding-bottom:12px;display:grid;gap:8px}",
    ".wsa canvas{width:100%;height:250px;display:block}",
    ".wsa-read{display:flex;flex-wrap:wrap;gap:6px 22px;font:13px ui-monospace,'SF Mono',Menlo,monospace;color:var(--wsa-muted)}",
    ".wsa-read strong{color:var(--wsa-ink);font-weight:500;font-variant-numeric:tabular-nums}",
    ".wsa-read .hi strong{color:var(--wsa-accent)}",
    ".wsa-note{font:12.5px ui-monospace,'SF Mono',Menlo,monospace;color:var(--wsa-warn)}",
    ".wsa-note:empty{display:none}",
    ".wsa-row{display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center}",
    ".wsa-row label{font-weight:600;font-size:17px}",
    ".wsa-val{font:500 22px ui-monospace,'SF Mono',Menlo,monospace;font-variant-numeric:tabular-nums;color:var(--wsa-accent);min-width:5.2ch;text-align:right}",
    ".wsa input[type=range]{width:100%;min-width:0;accent-color:var(--wsa-accent)}",
    ".wsa-chips{display:flex;flex-wrap:wrap;gap:8px;align-items:center}",
    ".wsa-chips span{font:12px ui-monospace,'SF Mono',Menlo,monospace;color:var(--wsa-muted);margin-right:4px}",
    ".wsa button{font:500 13px ui-monospace,'SF Mono',Menlo,monospace;color:var(--wsa-ink);background:var(--wsa-bg);border:1px solid var(--wsa-rule);border-radius:999px;padding:6px 12px;cursor:pointer}",
    ".wsa button:hover{border-color:var(--wsa-accent)}",
    ".wsa button:focus-visible,.wsa input:focus-visible{outline:2px solid var(--wsa-accent);outline-offset:2px}",
    ".wsa button[aria-pressed=true]{background:var(--wsa-accent);color:var(--wsa-bg);border-color:var(--wsa-accent)}",
    ".wsa-sound{display:grid;grid-template-columns:auto 1fr auto auto;gap:12px;align-items:center}",
    ".wsa-hz{font:13px ui-monospace,'SF Mono',Menlo,monospace;font-variant-numeric:tabular-nums;color:var(--wsa-muted);min-width:7ch;text-align:right}",
    ".wsa-vol{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;max-width:420px}",
    ".wsa-vol .wsa-vlabel{font:13px ui-monospace,'SF Mono',Menlo,monospace;color:var(--wsa-muted)}",
    "@media (max-width:600px){.wsa-sound{grid-template-columns:auto 1fr auto}.wsa-sweep{grid-column:1/-1;justify-self:start}.wsa canvas{height:210px}}"
  ].join("\n");

  function injectCSS() {
    if (document.getElementById("wsa-style")) return;
    var s = document.createElement("style");
    s.id = "wsa-style";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  var HTML =
    '<div class="wsa-scope">' +
    '  <canvas role="img" aria-label="Partials of a waveshaped sine: harmonics and partials folded back from above Nyquist"></canvas>' +
    '  <div class="wsa-read">' +
    '    <span class="hi">f0 <strong data-k="f0">0 Hz</strong></span>' +
    '    <span>fs <strong data-k="fs">48 kHz</strong></span>' +
    '  </div>' +
    '  <div class="wsa-note" data-k="note" aria-live="polite"></div>' +
    '</div>' +
    '<div class="wsa-chips" role="group" aria-label="Nonlinearity">' +
    '  <span>shape</span>' +
    '  <button data-s="tanh">tanh</button><button data-s="clip">hard clip</button>' +
    '</div>' +
    '<div class="wsa-row">' +
    '  <label>Drive</label>' +
    '  <input data-k="drive" type="range" min="1" max="20" step="0.1" value="4" aria-label="Drive">' +
    '  <span class="wsa-val" data-k="driveVal">4.0</span>' +
    '</div>' +
    '<div class="wsa-sound">' +
    '  <button data-k="play" aria-pressed="false">Play</button>' +
    '  <input data-k="freq" type="range" min="0" max="1" step="0.001" value="0" aria-label="Pitch">' +
    '  <span class="wsa-hz" data-k="freqVal">0 Hz</span>' +
    '  <button class="wsa-sweep" data-k="sweep" aria-pressed="false">Sweep pitch</button>' +
    '</div>' +
    '<div class="wsa-vol">' +
    '  <span class="wsa-vlabel">volume</span>' +
    '  <input data-k="vol" type="range" min="0" max="1" step="0.01" value="0.5" aria-label="Volume">' +
    '  <span class="wsa-hz" data-k="volVal">50%</span>' +
    '</div>';

  // Runs on the audio thread: a sine, waveshaped sample by sample, no antialiasing.
  // Frequency and drive are smoothed (~10 ms) so sliders don't click.
  var WORKLET = [
    "class WsaNaive extends AudioWorkletProcessor {",
    "  constructor() {",
    "    super();",
    "    this.ph = 0; this.f = 440; this.tf = 440; this.d = 4; this.td = 4; this.shape = 'tanh';",
    "    this.port.onmessage = (e) => { var m = e.data;",
    "      if (m.tf !== undefined) this.tf = m.tf;",
    "      if (m.td !== undefined) this.td = m.td;",
    "      if (m.shape !== undefined) this.shape = m.shape; };",
    "  }",
    "  process(inputs, outputs) {",
    "    var out = outputs[0][0], k = Math.exp(-1 / (sampleRate * 0.01)), clip = this.shape === 'clip';",
    "    for (var i = 0; i < out.length; i++) {",
    "      this.f = this.tf + (this.f - this.tf) * k;",
    "      this.d = this.td + (this.d - this.td) * k;",
    "      this.ph += this.f / sampleRate; if (this.ph >= 1) this.ph -= 1;",
    "      var x = this.d * Math.sin(2 * Math.PI * this.ph);",
    "      out[i] = clip ? Math.max(-1, Math.min(1, x)) : Math.tanh(x);",
    "    }",
    "    return true;",
    "  }",
    "}",
    "registerProcessor('wsa-naive', WsaNaive);"
  ].join("\n");

  // ---------- shared DSP for the spectrum ----------
  var N = 8192;
  var HANN = new Float64Array(N);
  for (var hi = 0; hi < N; hi++) HANN[hi] = 0.5 - 0.5 * Math.cos(2 * Math.PI * hi / (N - 1));
  var F_MIN = 100, F_MAX = 5500; // 6 kHz = fs/8 at 48 kHz would hide every fold under a harmonic

  function shaper(name) {
    return name === "clip" ? function (x) { return Math.max(-1, Math.min(1, x)); } : Math.tanh;
  }

  function fftMag(x) {
    var n = x.length, re = Float64Array.from(x), im = new Float64Array(n), i, j, bit;
    for (i = 1, j = 0; i < n; i++) {
      for (bit = n >> 1; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { var t = re[i]; re[i] = re[j]; re[j] = t; }
    }
    for (var size = 2; size <= n; size <<= 1) {
      var ang = -2 * Math.PI / size, wr = Math.cos(ang), wi = Math.sin(ang), half = size >> 1;
      for (var s = 0; s < n; s += size) {
        var cr = 1, ci = 0;
        for (var k = 0; k < half; k++) {
          var a = s + k, b = a + half;
          var tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
          var nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
        }
      }
    }
    var m = new Float64Array(n / 2);
    for (i = 0; i < n / 2; i++) m[i] = Math.hypot(re[i], im[i]);
    return m;
  }

  // A-weighting, as a linear amplitude factor (IEC 61672; 0 dB at 1 kHz).
  function aWeight(f) {
    var f2 = f * f;
    var ra = 148693636 * f2 * f2 /
      ((f2 + 424.36) * Math.sqrt((f2 + 11599.29) * (f2 + 544496.41)) * (f2 + 148693636));
    return ra * 1.2589; // +2.0 dB normalisation
  }

  // Spectrum of the shaped sine at a bin-centred f0, plus its A-weighted power.
  function analyse(shape, d, f0, SR) {
    var f = shaper(shape), w = 2 * Math.PI * f0 / SR, y = new Float64Array(N), i;
    for (i = 0; i < N; i++) y[i] = f(d * Math.sin(w * i)) * HANN[i];
    var m = fftMag(y), max = 0, pw = 0, bin = SR / N;
    for (i = 1; i < m.length; i++) {
      if (m[i] > max) max = m[i];
      var a = m[i] * aWeight(i * bin); pw += a * a;
    }
    return { m: m, max: max, pw: pw };
  }

  function snap(f, SR) { var bin = SR / N; return Math.max(1, Math.round(f / bin)) * bin; }

  function mount(host) {
    injectCSS();
    host.setAttribute("data-mounted", "");
    host.classList.add("wsa");
    host.innerHTML = HTML;

    var q = function (k) { return host.querySelector('[data-k="' + k + '"]'); };
    var canvas = host.querySelector("canvas");
    var driveEl = q("drive"), freqEl = q("freq"), volEl = q("vol");

    var shape = "tanh", sweepOn = false, sweepDir = 1;
    var C = {};
    function readColors() {
      var s = getComputedStyle(host);
      ["ink", "muted", "rule", "accent", "fold"].forEach(function (k) { C[k] = s.getPropertyValue("--wsa-" + k).trim(); });
    }
    readColors();
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () { readColors(); draw(); });

    function mono(px) { return px + "px ui-monospace, 'SF Mono', Menlo, monospace"; }
    function freqFromSlider() { return F_MIN * Math.pow(F_MAX / F_MIN, parseFloat(freqEl.value)); }
    function drive() { return parseFloat(driveEl.value); }

    // ---------- audio ----------
    var actx = null, node = null, amp = null, moduleReady = null, loudComp = 1;
    // Same ceiling as pulse-duty-wave.js: 100% peaks around -36 dBFS.
    var MAX_GAIN = 0.015;
    function gainFromVol() { var v = parseFloat(volEl.value); return MAX_GAIN * v * v * loudComp; } // squared = smoother taper
    function sampleRate() { return actx ? actx.sampleRate : 48000; }
    function send(msg) { if (node) node.port.postMessage(msg); }
    function applyGain(tc) { if (node) amp.gain.setTargetAtTime(gainFromVol(), actx.currentTime, tc); }

    volEl.addEventListener("input", function () {
      q("volVal").textContent = Math.round(parseFloat(volEl.value) * 100) + "%";
      applyGain(0.02);
    });

    q("play").addEventListener("click", function () {
      var btn = q("play");
      if (node) {
        amp.gain.setTargetAtTime(0, actx.currentTime, 0.02);
        var n = node; node = null;
        setTimeout(function () { n.disconnect(); }, 150);
        btn.textContent = "Play"; btn.setAttribute("aria-pressed", "false");
        return;
      }
      try {
        actx = actx || new (window.AudioContext || window.webkitAudioContext)();
        if (!actx.audioWorklet) throw new Error("no AudioWorklet");
        if (!moduleReady) {
          var url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
          moduleReady = actx.audioWorklet.addModule(url);
        }
        Promise.all([actx.resume(), moduleReady]).then(function () {
          amp = actx.createGain(); amp.gain.value = 0; amp.connect(actx.destination);
          node = new AudioWorkletNode(actx, "wsa-naive");
          send({ tf: freqFromSlider(), td: drive(), shape: shape });
          node.connect(amp);
          draw(); // fs may have changed from the 48 kHz guess; also sets loudComp
          applyGain(0.02);
          btn.textContent = "Stop"; btn.setAttribute("aria-pressed", "true");
        }).catch(function () { q("note").textContent = "Sound could not start in this browser."; });
      } catch (e) { q("note").textContent = "Sound could not start in this browser."; }
    });

    // ---------- spectrum ----------
    var cache = {};
    function spectrum() {
      var SR = sampleRate(), f0 = snap(freqFromSlider(), SR);
      var base = shape + "|" + drive() + "|" + SR, key = base + "|" + f0;
      if (cache.base !== base) { cache.ref = analyse(shape, drive(), snap(F_MIN, SR), SR); cache.base = base; }
      if (cache.key !== key) { cache.cur = analyse(shape, drive(), f0, SR); cache.key = key; }
      return { m: cache.cur.m, max: cache.cur.max, f0: f0, SR: SR,
               comp: Math.min(1, Math.sqrt(cache.ref.pw / cache.cur.pw)) };
    }

    function draw() {
      var dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
      if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
      var ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      var S = spectrum(), nyq = S.SR / 2, floor = -100;
      var padL = 44, padR = 12, top = 10, bot = h - 42, pw = w - padL - padR, ph = bot - top;
      function xOf(hz) { return padL + hz / nyq * pw; }
      function yOf(db) { return top + db / floor * ph; }

      // grid
      ctx.strokeStyle = C.rule; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      ctx.font = mono(11); ctx.fillStyle = C.muted;
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      for (var db = 0; db >= floor; db -= 20) {
        ctx.beginPath(); ctx.moveTo(padL, yOf(db)); ctx.lineTo(w - padR, yOf(db)); ctx.stroke();
        ctx.fillText(db + "", padL - 8, yOf(db));
      }
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      for (var k = 0; k * 1000 <= nyq - 2000; k += 4) { // leave room for the fs/2 label
        ctx.beginPath(); ctx.moveTo(xOf(k * 1000), top); ctx.lineTo(xOf(k * 1000), bot); ctx.stroke();
        ctx.fillText(k + "k", xOf(k * 1000), bot + 5);
      }
      ctx.setLineDash([]);
      ctx.textAlign = "right"; ctx.fillText("fs/2", w - padR, bot + 5);
      ctx.save(); ctx.translate(12, top + ph / 2); ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("dB", 0, 0); ctx.restore();

      // partials: each peak drawn as a line from the floor. The f0 is bin-centred, so every
      // partial (harmonic or folded) sits exactly on a bin with its two neighbours ~6 dB down.
      var bin = S.SR / N, f0bin = Math.round(S.f0 / bin), m = S.m;
      function isHarmonic(b) {
        var hN = Math.round(b / f0bin);
        return hN % 2 === 1 && Math.abs(b - hN * f0bin) <= 1;
      }
      var harm = [], fold = [];
      for (var b = 1; b < m.length - 1; b++) {
        if (!(m[b] >= m[b - 1] && m[b] > m[b + 1])) continue;
        var d = 20 * Math.log10(m[b] / S.max + 1e-15);
        if (d <= floor) continue;
        (isHarmonic(b) ? harm : fold).push([b * bin, d]);
      }
      function stems(list, color, width) {
        ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
        list.forEach(function (p) { var x = xOf(p[0]); ctx.moveTo(x, yOf(floor)); ctx.lineTo(x, yOf(p[1])); });
        ctx.stroke();
      }
      stems(fold, C.fold, 1.5);
      stems(harm, C.accent, 2);

      // legend
      var ly = bot + 30, lx = Math.max(padL, padL + pw / 2 - 120);
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.strokeStyle = C.accent; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(lx, ly - 6); ctx.lineTo(lx, ly + 6); ctx.stroke();
      ctx.fillStyle = C.accent; ctx.fillText("harmonics", lx + 8, ly);
      ctx.strokeStyle = C.fold; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(lx + 110, ly - 6); ctx.lineTo(lx + 110, ly + 6); ctx.stroke();
      ctx.fillStyle = C.fold; ctx.fillText("folded back", lx + 118, ly);

      // loudness: follow the spectrum, so higher pitches don't get louder
      loudComp = S.comp;
      applyGain(0.05);

      q("f0").textContent = Math.round(S.f0) + " Hz";
      q("fs").textContent = (S.SR / 1000).toFixed(1).replace(/\.0$/, "") + " kHz";
    }

    function showFreq() { q("freqVal").textContent = Math.round(freqFromSlider()) + " Hz"; }
    function showDrive() { q("driveVal").textContent = drive().toFixed(1); }

    function setShape(s) {
      shape = s;
      host.querySelectorAll(".wsa-chips button").forEach(function (b) {
        b.setAttribute("aria-pressed", String(b.dataset.s === s));
      });
      send({ shape: s }); draw();
    }
    host.querySelectorAll(".wsa-chips button").forEach(function (b) {
      b.addEventListener("click", function () { setShape(b.dataset.s); });
    });
    driveEl.addEventListener("input", function () { showDrive(); send({ td: drive() }); draw(); });
    freqEl.addEventListener("input", function () { sweepOff(); showFreq(); send({ tf: freqFromSlider() }); draw(); });

    // ---------- pitch sweep ----------
    function sweepOff() { if (sweepOn) { sweepOn = false; q("sweep").setAttribute("aria-pressed", "false"); } }
    q("sweep").addEventListener("click", function () {
      sweepOn = !sweepOn; q("sweep").setAttribute("aria-pressed", String(sweepOn));
    });

    var last = performance.now(), tick = 0;
    function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (sweepOn) {
        var v = parseFloat(freqEl.value) + sweepDir * dt / 8; // 8 s bottom to top, then back
        if (v >= 1) { v = 1; sweepDir = -1; } else if (v <= 0) { v = 0; sweepDir = 1; }
        freqEl.value = v; showFreq(); send({ tf: freqFromSlider() });
        if ((tick = (tick + 1) % 2) === 0) draw();
      }
      requestAnimationFrame(frame);
    }

    if (window.ResizeObserver) new ResizeObserver(draw).observe(host);
    showFreq(); showDrive(); setShape("tanh");
    requestAnimationFrame(frame);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountAll);
  else mountAll();
})();
