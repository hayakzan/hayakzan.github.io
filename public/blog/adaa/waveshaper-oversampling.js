/*
 * waveshaper-oversampling.js — oversampling as the textbook fix for aliasing
 *
 * Usage (anywhere in a page or blog post):
 *   <div data-waveshaper-oversampling></div>
 *   <script src="waveshaper-oversampling.js"></script>
 *
 * If no element with data-waveshaper-oversampling exists, the demo is inserted
 * right after the <script> tag. No dependencies.
 *
 * Panel 1 shows the partials at the oversampled rate, from 0 to N*fs/2, with the
 * lowpass filter's response drawn over them. Panel 2 shows what's left after the
 * lowpass and decimation, back at fs. Harmonics and folded-back partials are drawn
 * in different colors.
 *
 * The sine is generated directly at N x the sample rate (a stand-in for a
 * perfect upsampler); the lowpass is a Kaiser-windowed sinc FIR.
 *
 * Loudness: playback gain follows A-weighting (a standard approximation of the
 * ear's equal-loudness contour at moderate levels). The A-weighted power of the
 * output is compared with the same sound at 100 Hz, and the gain only ever goes
 * down, so sweeping into the ear's sensitive 2-5 kHz region doesn't get louder.
 */
(function () {
  "use strict";

  var script = document.currentScript;

  function mountAll() {
    var hosts = document.querySelectorAll("[data-waveshaper-oversampling]:not([data-mounted])");
    if (!hosts.length && script) {
      var div = document.createElement("div");
      div.setAttribute("data-waveshaper-oversampling", "");
      script.parentNode.insertBefore(div, script.nextSibling);
      hosts = [div];
    }
    for (var i = 0; i < hosts.length; i++) mount(hosts[i]);
  }

  // ---------- styles (scoped under .wso) ----------
  var CSS = [
    ".wso{--wso-bg:#f8f8fc;--wso-ink:#1c1940;--wso-muted:#5c5880;--wso-rule:#d4d1e6;--wso-accent:#40318d;--wso-soft:rgba(64,49,141,.08);--wso-warn:#a2512c;--wso-fold:#c0522a;--wso-filter:#2f7d4f;",
    "font:15px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif;color:var(--wso-ink);background:var(--wso-bg);border:1px solid var(--wso-rule);border-radius:10px;padding:16px;display:grid;gap:16px;max-width:980px;margin:1.5em 0}",
    "@media (prefers-color-scheme:dark){.wso{--wso-bg:#1d1a4a;--wso-ink:#dcd8f7;--wso-muted:#9c97c8;--wso-rule:#322e66;--wso-accent:#8b80ee;--wso-soft:rgba(139,128,238,.10);--wso-warn:#e39268;--wso-fold:#ee9a6c;--wso-filter:#7fd49a}}",
    ".wso *{box-sizing:border-box}",
    ".wso-scope{border-bottom:1px solid var(--wso-rule);padding-bottom:12px;display:grid;gap:8px}",
    ".wso canvas{width:100%;height:420px;display:block}",
    ".wso-read{display:flex;flex-wrap:wrap;gap:6px 22px;font:13px ui-monospace,'SF Mono',Menlo,monospace;color:var(--wso-muted)}",
    ".wso-read strong{color:var(--wso-ink);font-weight:500;font-variant-numeric:tabular-nums}",
    ".wso-read .hi strong{color:var(--wso-accent)}",
    ".wso-note{font:12.5px ui-monospace,'SF Mono',Menlo,monospace;color:var(--wso-warn)}",
    ".wso-note:empty{display:none}",
    ".wso-row{display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center}",
    ".wso-row label{font-weight:600;font-size:17px}",
    ".wso-val{font:500 22px ui-monospace,'SF Mono',Menlo,monospace;font-variant-numeric:tabular-nums;color:var(--wso-accent);min-width:5.2ch;text-align:right}",
    ".wso input[type=range]{width:100%;min-width:0;accent-color:var(--wso-accent)}",
    ".wso-chips{display:flex;flex-wrap:wrap;gap:8px;align-items:center}",
    ".wso-chips span{font:12px ui-monospace,'SF Mono',Menlo,monospace;color:var(--wso-muted);margin-right:4px}",
    ".wso-chips span.gap{margin-left:14px}",
    ".wso button{font:500 13px ui-monospace,'SF Mono',Menlo,monospace;color:var(--wso-ink);background:var(--wso-bg);border:1px solid var(--wso-rule);border-radius:999px;padding:6px 12px;cursor:pointer}",
    ".wso button:hover{border-color:var(--wso-accent)}",
    ".wso button:focus-visible,.wso input:focus-visible{outline:2px solid var(--wso-accent);outline-offset:2px}",
    ".wso button[aria-pressed=true]{background:var(--wso-accent);color:var(--wso-bg);border-color:var(--wso-accent)}",
    ".wso-sound{display:grid;grid-template-columns:auto 1fr auto auto;gap:12px;align-items:center}",
    ".wso-hz{font:13px ui-monospace,'SF Mono',Menlo,monospace;font-variant-numeric:tabular-nums;color:var(--wso-muted);min-width:7ch;text-align:right}",
    ".wso-vol{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;max-width:420px}",
    ".wso-vol .wso-vlabel{font:13px ui-monospace,'SF Mono',Menlo,monospace;color:var(--wso-muted)}",
    "@media (max-width:600px){.wso-sound{grid-template-columns:auto 1fr auto}.wso-sweep{grid-column:1/-1;justify-self:start}.wso canvas{height:360px}}"
  ].join("\n");

  function injectCSS() {
    if (document.getElementById("wso-style")) return;
    var s = document.createElement("style");
    s.id = "wso-style";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  var FACTORS = [1, 2, 4, 8, 16];
  var F_MIN = 100, F_MAX = 5500; // 6 kHz = fs/8 at 48 kHz would hide every fold under a harmonic

  var HTML =
    '<div class="wso-scope">' +
    '  <canvas role="img" aria-label="Partials at the oversampled rate, and after filtering back down to the output rate"></canvas>' +
    '  <div class="wso-read">' +
    '    <span class="hi">f0 <strong data-k="f0">0 Hz</strong></span>' +
    '    <span>waveshaper runs at <strong data-k="inner">-</strong></span>' +
    '    <span>output <strong data-k="fs">-</strong></span>' +
    '  </div>' +
    '  <div class="wso-note" data-k="note" aria-live="polite"></div>' +
    '</div>' +
    '<div class="wso-chips" role="group" aria-label="Nonlinearity and oversampling">' +
    '  <span>shape</span>' +
    '  <button data-s="tanh">tanh</button><button data-s="clip">hard clip</button>' +
    '  <span class="gap">oversampling</span>' +
    FACTORS.map(function (n) { return '<button data-n="' + n + '">' + n + '&times;</button>'; }).join("") +
    '</div>' +
    '<div class="wso-row">' +
    '  <label>Drive</label>' +
    '  <input data-k="drive" type="range" min="1" max="20" step="0.1" value="4" aria-label="Drive">' +
    '  <span class="wso-val" data-k="driveVal">4.0</span>' +
    '</div>' +
    '<div class="wso-sound">' +
    '  <button data-k="play" aria-pressed="false">Play</button>' +
    '  <input data-k="freq" type="range" min="0" max="1" step="0.001" value="' +
    (Math.log(110 / F_MIN) / Math.log(F_MAX / F_MIN)).toFixed(3) + '" aria-label="Pitch">' +
    '  <span class="wso-hz" data-k="freqVal">0 Hz</span>' +
    '  <button class="wso-sweep" data-k="sweep" aria-pressed="false">Sweep pitch</button>' +
    '</div>' +
    '<div class="wso-vol">' +
    '  <span class="wso-vlabel">volume</span>' +
    '  <input data-k="vol" type="range" min="0" max="1" step="0.01" value="0.5" aria-label="Volume">' +
    '  <span class="wso-hz" data-k="volVal">50%</span>' +
    '</div>';

  // ---------- the lowpass (decimation) filter ----------
  // Passband to 0.40 fs, stopband from 0.50 fs (fs = output rate): everything above the
  // final fs/2 is removed before we throw away samples, so it can't fold into the audio band.
  var PASS = 0.40, STOP = 0.50;

  function besselI0(x) {
    var sum = 1, term = 1, k = 1;
    do { term *= (x / (2 * k)) * (x / (2 * k)); sum += term; k++; } while (term > 1e-12 * sum);
    return sum;
  }

  // Kaiser-windowed sinc lowpass at the high rate. perPhase sets its length (and so its attenuation).
  function designLowpass(N, perPhase) {
    if (N === 1) return new Float64Array([1]);
    var T = perPhase * N + 1, M = (T - 1) / 2;
    var df = (STOP - PASS) / N;                     // transition width, in units of the high rate
    var A = 2.285 * 2 * Math.PI * df * (T - 1) + 8; // Kaiser's length formula, solved for attenuation (dB)
    var beta = A > 50 ? 0.1102 * (A - 8.7) : A >= 21 ? 0.5842 * Math.pow(A - 21, 0.4) + 0.07886 * (A - 21) : 0;
    var fc = (PASS + STOP) / 2 / N, i0b = besselI0(beta), h = new Float64Array(T), sum = 0;
    for (var k = 0; k < T; k++) {
      var t = k - M, r = t / M;
      var sinc = t === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * t) / (Math.PI * t);
      h[k] = sinc * besselI0(beta * Math.sqrt(Math.max(0, 1 - r * r))) / i0b;
      sum += h[k];
    }
    for (k = 0; k < T; k++) h[k] /= sum;
    return h;
  }

  // Display filters are long (~100 dB stopband); the real-time ones are shorter (~65 dB) to stay cheap.
  var SPEC_LEN = 64, AUDIO_LEN = 40;
  var filterCache = {};
  function filterFor(N, perPhase) {
    var key = N + "|" + perPhase;
    return filterCache[key] || (filterCache[key] = designLowpass(N, perPhase));
  }

  // Runs on the audio thread: N shaped sub-samples per output sample, then one
  // filter dot product per output sample (decimating as we go).
  var WORKLET = [
    "class WsoProc extends AudioWorkletProcessor {",
    "  constructor() {",
    "    super();",
    "    this.ph = 0; this.f = 440; this.tf = 440; this.d = 4; this.td = 4; this.shape = 'clip';",
    "    this.setFilter(1, new Float32Array([1]));",
    "    this.port.onmessage = (e) => { var m = e.data;",
    "      if (m.tf !== undefined) this.tf = m.tf;",
    "      if (m.td !== undefined) this.td = m.td;",
    "      if (m.shape !== undefined) this.shape = m.shape;",
    "      if (m.N !== undefined) this.setFilter(m.N, m.h); };",
    "  }",
    "  setFilter(N, h) {",
    "    this.N = N; this.h = h; this.T = h.length;",
    "    this.buf = new Float32Array(2 * this.T); this.pos = 0;", // doubled ring buffer: contiguous reads
    "  }",
    "  process(inputs, outputs) {",
    "    var out = outputs[0][0], N = this.N, T = this.T, h = this.h, buf = this.buf;",
    "    var hr = sampleRate * N, k = Math.exp(-1 / (hr * 0.01)), clip = this.shape === 'clip';",
    "    for (var i = 0; i < out.length; i++) {",
    "      for (var j = 0; j < N; j++) {",
    "        this.f = this.tf + (this.f - this.tf) * k;",
    "        this.d = this.td + (this.d - this.td) * k;",
    "        this.ph += this.f / hr; if (this.ph >= 1) this.ph -= 1;",
    "        var x = this.d * Math.sin(2 * Math.PI * this.ph);",
    "        var y = clip ? Math.max(-1, Math.min(1, x)) : Math.tanh(x);",
    "        buf[this.pos] = y; buf[this.pos + T] = y;",
    "        this.pos = this.pos + 1 === T ? 0 : this.pos + 1;",
    "      }",
    "      var acc = 0, p = this.pos;",
    "      for (var t = 0; t < T; t++) acc += h[t] * buf[p + t];",
    "      out[i] = acc;",
    "    }",
    "    return true;",
    "  }",
    "}",
    "registerProcessor('wso-proc', WsoProc);"
  ].join("\n");

  // ---------- shared DSP for the spectra ----------
  var L = 8192; // output-rate FFT length; the high-rate FFT is N*L, so both share one bin width

  function hann(n) {
    var w = new Float64Array(n);
    for (var i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1));
    return w;
  }
  var HANN = hann(L), hannCache = {};

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

  function maxOf(m) { var mx = 0; for (var i = 0; i < m.length; i++) if (m[i] > mx) mx = m[i]; return mx; }

  // A-weighting, as a linear amplitude factor (IEC 61672; 0 dB at 1 kHz).
  function aWeight(f) {
    var f2 = f * f;
    var ra = 148693636 * f2 * f2 /
      ((f2 + 424.36) * Math.sqrt((f2 + 11599.29) * (f2 + 544496.41)) * (f2 + 148693636));
    return ra * 1.2589; // +2.0 dB normalisation
  }

  // Filter magnitude response in dB on the high-rate bin grid.
  var respCache = {};
  function filterResponse(N) {
    if (respCache[N]) return respCache[N];
    var h = filterFor(N, SPEC_LEN), x = new Float64Array(L * N);
    x.set(h);
    var m = fftMag(x), out = new Float64Array(m.length);
    for (var i = 0; i < m.length; i++) out[i] = 20 * Math.log10(m[i] + 1e-12);
    return (respCache[N] = out);
  }

  // Shape at N x the rate (panel 1), then filter + decimate back to fs (panel 2).
  // f0 is bin-centred, so every partial sits exactly on a bin in both spectra.
  function analyse(shape, d, f0, SR, N, wantInner) {
    var f = shaper(shape), h = filterFor(N, SPEC_LEN), T = h.length;
    var total = L * N + T, s = new Float64Array(total), w = 2 * Math.PI * f0 / (SR * N), i, m;
    for (i = 0; i < total; i++) s[i] = f(d * Math.sin(w * i));

    var y = new Float64Array(L);
    for (m = 0; m < L; m++) {
      var acc = 0, base = m * N;
      for (var k = 0; k < T; k++) acc += h[k] * s[base + k];
      y[m] = acc * HANN[m];
    }
    var out = fftMag(y), pw = 0, bin = SR / L;
    for (i = 1; i < out.length; i++) { var a = out[i] * aWeight(i * bin); pw += a * a; }

    var inner = out;
    if (wantInner && N > 1) {
      var LH = L * N, wh = hannCache[LH] || (hannCache[LH] = hann(LH)), xh = new Float64Array(LH);
      for (i = 0; i < LH; i++) xh[i] = s[i] * wh[i];
      inner = fftMag(xh);
    }
    return { inner: inner, innerMax: maxOf(inner), out: out, outMax: maxOf(out), pw: pw };
  }

  function fmtKHz(hz) {
    var k = hz / 1000;
    return (k >= 100 ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, "")) + " kHz";
  }
  function snap(f, SR) { var bin = SR / L; return Math.max(1, Math.round(f / bin)) * bin; }

  function mount(host) {
    injectCSS();
    host.setAttribute("data-mounted", "");
    host.classList.add("wso");
    host.innerHTML = HTML;

    var q = function (k) { return host.querySelector('[data-k="' + k + '"]'); };
    var canvas = host.querySelector("canvas");
    var driveEl = q("drive"), freqEl = q("freq"), volEl = q("vol");

    var shape = "clip", N = 4, sweepOn = false, sweepDir = 1;
    var C = {};
    function readColors() {
      var s = getComputedStyle(host);
      ["ink", "muted", "rule", "accent", "soft", "warn", "fold", "filter"].forEach(function (k) { C[k] = s.getPropertyValue("--wso-" + k).trim(); });
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
    function sendFilter() { send({ N: N, h: Float32Array.from(filterFor(N, AUDIO_LEN)) }); }
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
          node = new AudioWorkletNode(actx, "wso-proc");
          send({ tf: freqFromSlider(), td: drive(), shape: shape }); sendFilter();
          node.connect(amp);
          draw(); // fs may have changed from the 48 kHz guess; also sets loudComp
          applyGain(0.02);
          btn.textContent = "Stop"; btn.setAttribute("aria-pressed", "true");
        }).catch(function () { q("note").textContent = "Sound could not start in this browser."; });
      } catch (e) { q("note").textContent = "Sound could not start in this browser."; }
    });

    // ---------- spectra ----------
    var cache = {};
    function spectra() {
      var SR = sampleRate(), f0 = snap(freqFromSlider(), SR);
      var base = shape + "|" + drive() + "|" + SR + "|" + N, key = base + "|" + f0;
      if (cache.base !== base) { cache.ref = analyse(shape, drive(), snap(F_MIN, SR), SR, N, false); cache.base = base; }
      if (cache.key !== key) { cache.cur = analyse(shape, drive(), f0, SR, N, true); cache.key = key; }
      return { cur: cache.cur, f0: f0, SR: SR, comp: Math.min(1, Math.sqrt(cache.ref.pw / cache.cur.pw)) };
    }

    // pick a tick step (kHz) giving roughly 6 labels
    function tickStep(maxKHz) {
      var steps = [4, 8, 12, 24, 48, 96, 192];
      for (var i = 0; i < steps.length; i++) if (maxKHz / steps[i] <= 7) return steps[i];
      return 384;
    }

    function draw() {
      var dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
      if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
      var ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.font = mono(11);

      var S = spectra(), nyq = S.SR / 2, floor = -100, binHz = S.SR / L;
      var f0bin = Math.round(S.f0 / binHz);
      var narrow = w < 560;
      var padL = 44, padR = 12, gap = 26, titleH = 20, axisH = 18, legendH = narrow ? 46 : 26;
      var panelH = (h - 2 * titleH - 2 * axisH - gap - legendH) / 2;
      var P1 = { x: padL, y: titleH, w: w - padL - padR, h: panelH, nyq: nyq * N };
      var P2 = { x: padL, y: titleH + panelH + axisH + gap + titleH - 4, w: w - padL - padR, h: panelH, nyq: nyq };

      function frame(P, title, rightLabel) {
        function yOf(db) { return P.y + Math.max(floor, db) / floor * P.h; }
        ctx.fillStyle = C.warn; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
        ctx.fillText(title, P.x, P.y - 7);
        ctx.strokeStyle = C.rule; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
        ctx.fillStyle = C.muted; ctx.textAlign = "right"; ctx.textBaseline = "middle";
        for (var db = 0; db >= floor; db -= 20) {
          ctx.beginPath(); ctx.moveTo(P.x, yOf(db)); ctx.lineTo(P.x + P.w, yOf(db)); ctx.stroke();
          if (db % 40 === 0 || db === floor) ctx.fillText(db + "", P.x - 8, yOf(db));
        }
        var step = tickStep(P.nyq / 1000);
        ctx.textAlign = "center"; ctx.textBaseline = "top";
        for (var k = 0; k * 1000 <= P.nyq - step * 500; k += step) {
          var x = P.x + k * 1000 / P.nyq * P.w;
          ctx.beginPath(); ctx.moveTo(x, P.y); ctx.lineTo(x, P.y + P.h); ctx.stroke();
          ctx.fillText(k + "k", x, P.y + P.h + 5);
        }
        ctx.setLineDash([]);
        ctx.textAlign = "right"; ctx.fillText(rightLabel, P.x + P.w, P.y + P.h + 5);
        return yOf;
      }

      // partials as lines from the floor: harmonics in one color, folded-back ones in another
      function stems(P, yOf, m, max) {
        var harm = [], fold = [];
        for (var b = 1; b < m.length - 1; b++) {
          if (!(m[b] >= m[b - 1] && m[b] > m[b + 1])) continue;
          var d = 20 * Math.log10(m[b] / max + 1e-15);
          if (d <= floor) continue;
          var hN = Math.round(b / f0bin);
          (hN % 2 === 1 && Math.abs(b - hN * f0bin) <= 1 ? harm : fold).push([b * binHz, d]);
        }
        function draw1(list, color, width) {
          ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
          list.forEach(function (p) {
            var x = P.x + p[0] / P.nyq * P.w;
            ctx.moveTo(x, yOf(floor)); ctx.lineTo(x, yOf(p[1]));
          });
          ctx.stroke();
        }
        // line width follows the spacing between harmonics, so dense spectra don't merge into a block
        var spacing = 2 * S.f0 / P.nyq * P.w, wd = Math.max(0.6, Math.min(2, spacing * 0.45));
        draw1(fold, C.fold, wd * 0.8);
        draw1(harm, C.accent, wd);
      }

      // ---- panel 1: at the oversampled rate ----
      var t1 = N === 1
        ? (narrow ? "1 · at fs = " : "1 · the waveshaper runs at fs = ") + fmtKHz(S.SR) + (narrow ? "" : " (no oversampling)")
        : (narrow ? "1 · at " : "1 · the waveshaper runs at ") + N + " × fs = " + fmtKHz(S.SR * N);
      var y1 = frame(P1, t1, N === 1 ? "fs/2" : N + "·fs/2");
      var xc = P1.x + nyq / P1.nyq * P1.w;
      if (N > 1) {
        ctx.fillStyle = C.soft; ctx.fillRect(xc, P1.y, P1.x + P1.w - xc, P1.h);
        ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(xc, P1.y); ctx.lineTo(xc, P1.y + P1.h); ctx.stroke();
        ctx.fillStyle = C.muted; ctx.textAlign = "left"; ctx.textBaseline = "top";
        ctx.fillText(P1.x + P1.w - xc > 400 ? "final fs/2: the lowpass removes everything to the right" : "final fs/2",
          xc + 5, P1.y + 6);
      }
      stems(P1, y1, S.cur.inner, S.cur.innerMax);

      // the lowpass: drawn until it has dropped out of view, so its stopband ripple doesn't clutter the floor
      if (N > 1) {
        var resp = filterResponse(N), per = resp.length / P1.w;
        ctx.strokeStyle = C.filter; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.beginPath();
        for (var px = 0; px < P1.w; px++) {
          var v = resp[Math.floor(px * per)];
          if (px === 0) ctx.moveTo(P1.x, y1(v)); else ctx.lineTo(P1.x + px, y1(v));
          if (P1.x + px > xc && v < floor + 10) break;
        }
        ctx.stroke(); ctx.setLineDash([]);
      }

      // ---- panel 2: back at fs ----
      var t2 = N === 1
        ? "2 · output at fs = " + fmtKHz(S.SR) + (narrow ? "" : " (same thing: nothing to filter)")
        : (narrow ? "2 · back at fs = " : "2 · after the lowpass, back at fs = ") + fmtKHz(S.SR);
      var y2 = frame(P2, t2, "fs/2");
      stems(P2, y2, S.cur.out, S.cur.outMax);

      // ---- legend ----
      // one row on wide screens; on narrow ones the filter entry drops to a second row
      var ly = narrow ? h - legendH + 12 : h - legendH / 2, lx = Math.max(padL, padL + (w - padL - padR) / 2 - 190);
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.strokeStyle = C.accent; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(lx, ly - 6); ctx.lineTo(lx, ly + 6); ctx.stroke();
      ctx.fillStyle = C.accent; ctx.fillText("harmonics", lx + 8, ly);
      ctx.strokeStyle = C.fold; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(lx + 110, ly - 6); ctx.lineTo(lx + 110, ly + 6); ctx.stroke();
      ctx.fillStyle = C.fold; ctx.fillText("folded back", lx + 118, ly);
      ctx.strokeStyle = C.filter; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      var fx = narrow ? lx - 4 : lx + 236, fy = narrow ? ly + 20 : ly;
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + 26, fy); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = C.filter; ctx.fillText("lowpass filter", fx + 32, fy);

      // loudness: follow the spectrum, so higher pitches don't get louder
      loudComp = S.comp;
      applyGain(0.05);

      updateText(S);
    }

    function updateText(S) {
      q("f0").textContent = Math.round(S.f0) + " Hz";
      q("inner").textContent = N === 1 ? fmtKHz(S.SR) : fmtKHz(S.SR * N) + " (" + N + " × " + fmtKHz(S.SR).replace(" kHz", "") + ")";
      q("fs").textContent = fmtKHz(S.SR);
    }

    function showFreq() { q("freqVal").textContent = Math.round(freqFromSlider()) + " Hz"; }
    function showDrive() { q("driveVal").textContent = drive().toFixed(1); }

    function setShape(s) {
      shape = s;
      host.querySelectorAll(".wso-chips button[data-s]").forEach(function (b) {
        b.setAttribute("aria-pressed", String(b.dataset.s === s));
      });
      send({ shape: s }); draw();
    }
    function setN(n) {
      N = n;
      host.querySelectorAll(".wso-chips button[data-n]").forEach(function (b) {
        b.setAttribute("aria-pressed", String(+b.dataset.n === n));
      });
      sendFilter(); draw();
    }
    host.querySelectorAll(".wso-chips button[data-s]").forEach(function (b) {
      b.addEventListener("click", function () { setShape(b.dataset.s); });
    });
    host.querySelectorAll(".wso-chips button[data-n]").forEach(function (b) {
      b.addEventListener("click", function () { setN(+b.dataset.n); });
    });
    driveEl.addEventListener("input", function () { showDrive(); send({ td: drive() }); draw(); });
    freqEl.addEventListener("input", function () { sweepOff(); showFreq(); send({ tf: freqFromSlider() }); draw(); });

    // ---------- pitch sweep ----------
    function sweepOff() { if (sweepOn) { sweepOn = false; q("sweep").setAttribute("aria-pressed", "false"); } }
    q("sweep").addEventListener("click", function () {
      sweepOn = !sweepOn; q("sweep").setAttribute("aria-pressed", String(sweepOn));
    });

    var last = performance.now(), lastDraw = 0;
    function tick(now) {
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (sweepOn) {
        var v = parseFloat(freqEl.value) + sweepDir * dt / 8; // 8 s bottom to top, then back
        if (v >= 1) { v = 1; sweepDir = -1; } else if (v <= 0) { v = 0; sweepDir = 1; }
        freqEl.value = v; showFreq(); send({ tf: freqFromSlider() });
        if (now - lastDraw > 40 * Math.max(1, N / 2)) { lastDraw = now; draw(); } // heavier at high N: redraw less often
      }
      requestAnimationFrame(tick);
    }

    if (window.ResizeObserver) new ResizeObserver(draw).observe(host);
    showFreq(); showDrive(); setShape("clip"); setN(4);
    requestAnimationFrame(tick);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountAll);
  else mountAll();
})();
