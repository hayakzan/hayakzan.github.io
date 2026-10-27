/*
 * waveshaper-time.js — tanh vs. hard clip, in the time domain
 *
 * Usage (anywhere in a page or blog post):
 *   <div data-waveshaper-time></div>
 *   <script src="waveshaper-time.js"></script>
 *
 * If no element with data-waveshaper-time exists, the demo is inserted
 * right after the <script> tag. No dependencies.
 *
 * Left: the transfer curve y = f(x), with a dot riding along it.
 * Right: two cycles of the driven input and the shaped output.
 * The selected shape is drawn solid (and is what you hear); the others are ghosts.
 */
(function () {
  "use strict";

  var script = document.currentScript;

  function mountAll() {
    var hosts = document.querySelectorAll("[data-waveshaper-time]:not([data-mounted])");
    if (!hosts.length && script) {
      var div = document.createElement("div");
      div.setAttribute("data-waveshaper-time", "");
      script.parentNode.insertBefore(div, script.nextSibling);
      hosts = [div];
    }
    for (var i = 0; i < hosts.length; i++) mount(hosts[i]);
  }

  // ---------- styles (scoped under .wst) ----------
  var CSS = [
    ".wst{--wst-bg:#f8f8fc;--wst-ink:#1c1940;--wst-muted:#5c5880;--wst-rule:#d4d1e6;--wst-accent:#40318d;--wst-warn:#a2512c;",
    "font:15px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif;color:var(--wst-ink);background:var(--wst-bg);border:1px solid var(--wst-rule);border-radius:10px;padding:16px;display:grid;gap:16px;max-width:980px;margin:1.5em 0}",
    "@media (prefers-color-scheme:dark){.wst{--wst-bg:#1d1a4a;--wst-ink:#dcd8f7;--wst-muted:#9c97c8;--wst-rule:#322e66;--wst-accent:#8b80ee;--wst-warn:#e39268}}",
    ".wst *{box-sizing:border-box}",
    ".wst-scope{border-bottom:1px solid var(--wst-rule);padding-bottom:12px;display:grid;gap:8px}",
    ".wst canvas{width:100%;height:260px;display:block}",
    ".wst-note{font:12.5px ui-monospace,'SF Mono',Menlo,monospace;color:var(--wst-warn)}",
    ".wst-note:empty{display:none}",
    ".wst-row{display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center}",
    ".wst-row label{font-weight:600;font-size:17px}",
    ".wst-val{font:500 22px ui-monospace,'SF Mono',Menlo,monospace;font-variant-numeric:tabular-nums;color:var(--wst-accent);min-width:5.2ch;text-align:right}",
    ".wst input[type=range]{width:100%;min-width:0;accent-color:var(--wst-accent)}",
    ".wst input:disabled{opacity:.35;cursor:not-allowed}",
    ".wst-chips{display:flex;flex-wrap:wrap;gap:8px;align-items:center}",
    ".wst-chips span{font:12px ui-monospace,'SF Mono',Menlo,monospace;color:var(--wst-muted);margin-right:4px}",
    ".wst button{font:500 13px ui-monospace,'SF Mono',Menlo,monospace;color:var(--wst-ink);background:var(--wst-bg);border:1px solid var(--wst-rule);border-radius:999px;padding:6px 12px;cursor:pointer}",
    ".wst button:hover{border-color:var(--wst-accent)}",
    ".wst button:focus-visible,.wst input:focus-visible{outline:2px solid var(--wst-accent);outline-offset:2px}",
    ".wst button[aria-pressed=true]{background:var(--wst-accent);color:var(--wst-bg);border-color:var(--wst-accent)}",
    ".wst-vol{display:grid;grid-template-columns:auto auto 1fr auto;gap:12px;align-items:center;max-width:520px}",
    ".wst-vol .wst-vlabel,.wst-hz{font:13px ui-monospace,'SF Mono',Menlo,monospace;color:var(--wst-muted);font-variant-numeric:tabular-nums}",
    ".wst-hz{min-width:5ch;text-align:right}",
    "@media (max-width:600px){.wst canvas{height:200px}}"
  ].join("\n");

  function injectCSS() {
    if (document.getElementById("wst-style")) return;
    var s = document.createElement("style");
    s.id = "wst-style";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  var HTML =
    '<div class="wst-scope">' +
    '  <canvas role="img" aria-label="Transfer curve and waveform of a sine through tanh or a hard clipper"></canvas>' +
    '  <div class="wst-note" data-k="note" aria-live="polite"></div>' +
    '</div>' +
    '<div class="wst-chips" role="group" aria-label="Nonlinearity">' +
    '  <span>shape</span>' +
    '  <button data-s="sine">sine</button><button data-s="tanh">tanh</button><button data-s="clip">hard clip</button>' +
    '</div>' +
    '<div class="wst-row">' +
    '  <label>Drive</label>' +
    '  <input data-k="drive" type="range" min="0.2" max="10" step="0.05" value="2" aria-label="Drive">' +
    '  <span class="wst-val" data-k="driveVal">2.0</span>' +
    '</div>' +
    '<div class="wst-vol">' +
    '  <button data-k="play" aria-pressed="false">Play</button>' +
    '  <span class="wst-vlabel">volume</span>' +
    '  <input data-k="vol" type="range" min="0" max="1" step="0.01" value="0.5" aria-label="Volume">' +
    '  <span class="wst-hz" data-k="volVal">50%</span>' +
    '</div>';

  // Each shape maps the driven input x to the output.
  // "sine" is the clean reference: no shaping, and drive is switched off (held at 1) while it's selected.
  var SHAPES = {
    sine: function (x) { return x; },
    tanh: function (x) { return Math.tanh(x); },
    clip: function (x) { return Math.max(-1, Math.min(1, x)); }
  };
  var ORDER = ["sine", "tanh", "clip"];

  function mount(host) {
    injectCSS();
    host.setAttribute("data-mounted", "");
    host.classList.add("wst");
    host.innerHTML = HTML;

    var q = function (k) { return host.querySelector('[data-k="' + k + '"]'); };
    var canvas = host.querySelector("canvas");
    var driveEl = q("drive"), volEl = q("vol");
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var shape = "tanh", playhead = 0.18;
    var C = {};
    function readColors() {
      var s = getComputedStyle(host);
      ["ink", "muted", "rule", "accent"].forEach(function (k) { C[k] = s.getPropertyValue("--wst-" + k).trim(); });
    }
    readColors();
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () { readColors(); draw(); });

    function mono(px) { return px + "px ui-monospace, 'SF Mono', Menlo, monospace"; }
    function drive() { return shape === "sine" ? 1 : parseFloat(driveEl.value); } // effective drive
    function others() { return ORDER.filter(function (n) { return n !== shape; }); }

    function draw() {
      var dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
      if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
      var ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      var d = drive(), YR = 1.3;
      var top = 22, bot = h - 34, ph = bot - top;
      var tfSize = Math.min(ph, Math.round(w * 0.3));
      var A = { x: 34, y: top + (ph - tfSize) / 2, w: tfSize, h: tfSize };          // transfer curve
      var B = { x: A.x + A.w + 34, y: top, w: w - (A.x + A.w + 34) - 10, h: ph };   // time plot
      var XR = Math.max(d, 1.2) * 1.08;                                            // transfer x range

      ctx.font = mono(11); ctx.lineCap = "round"; ctx.lineJoin = "round";

      // ---- panel A: transfer curve ----
      function ax(u) { return A.x + (u + XR) / (2 * XR) * A.w; }
      function ay(v) { return A.y + (1 - (v + YR) / (2 * YR)) * A.h; }
      ctx.strokeStyle = C.rule; ctx.lineWidth = 1;
      ctx.strokeRect(A.x, A.y, A.w, A.h);
      ctx.setLineDash([3, 4]);
      [-1, 1].forEach(function (r) { ctx.beginPath(); ctx.moveTo(A.x, ay(r)); ctx.lineTo(A.x + A.w, ay(r)); ctx.stroke(); });
      ctx.beginPath(); ctx.moveTo(ax(0), A.y); ctx.lineTo(ax(0), A.y + A.h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(A.x, ay(0)); ctx.lineTo(A.x + A.w, ay(0)); ctx.stroke();
      // y = x for reference: the "no distortion" line
      ctx.save(); ctx.beginPath(); ctx.rect(A.x, A.y, A.w, A.h); ctx.clip();
      ctx.beginPath(); ctx.moveTo(ax(-YR), ay(-YR)); ctx.lineTo(ax(YR), ay(YR)); ctx.stroke();
      ctx.restore();
      ctx.setLineDash([]);

      function curve(name, alpha, width) {
        var f = SHAPES[name];
        ctx.globalAlpha = alpha; ctx.strokeStyle = C.accent; ctx.lineWidth = width; ctx.beginPath();
        for (var i = 0; i <= 300; i++) {
          var u = -XR + 2 * XR * i / 300, v = f(u, d);
          if (i === 0) ctx.moveTo(ax(u), ay(v)); else ctx.lineTo(ax(u), ay(v));
        }
        ctx.stroke(); ctx.globalAlpha = 1;
      }
      ctx.save(); ctx.beginPath(); ctx.rect(A.x, A.y, A.w, A.h); ctx.clip();
      others().forEach(function (n) { curve(n, 0.25, 1.5); });
      curve(shape, 1, 2.5);
      ctx.restore();

      // the part of the curve the input actually visits
      ctx.strokeStyle = C.muted; ctx.lineWidth = 3; ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.moveTo(ax(-d), A.y + A.h + 6); ctx.lineTo(ax(d), A.y + A.h + 6); ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.fillStyle = C.muted; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      ctx.fillText("f(x)", A.x + 4, A.y - 6);
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      ctx.fillText("1", A.x - 6, ay(1)); ctx.fillText("-1", A.x - 6, ay(-1));
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.fillText("input \u2192", A.x + A.w / 2, A.y + A.h + 14);
      ctx.save(); ctx.translate(A.x - 24, A.y + A.h / 2); ctx.rotate(-Math.PI / 2);
      ctx.textBaseline = "middle"; ctx.fillText("output \u2192", 0, 0); ctx.restore();

      // ---- panel B: two cycles in time ----
      var cycles = 2;
      function bx(t) { return B.x + t / cycles * B.w; }
      function by(v) { return B.y + (1 - (v + YR) / (2 * YR)) * B.h; }
      ctx.strokeStyle = C.rule; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      [-1, 0, 1].forEach(function (r) { ctx.beginPath(); ctx.moveTo(B.x, by(r)); ctx.lineTo(B.x + B.w, by(r)); ctx.stroke(); });
      ctx.setLineDash([]);
      ctx.fillStyle = C.muted; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      ctx.fillText("time → (two cycles)", B.x + 4, B.y - 6);

      ctx.save(); ctx.beginPath(); ctx.rect(B.x, B.y, B.w, B.h); ctx.clip();
      // input (may run off the top and bottom: that's the point)
      ctx.strokeStyle = C.muted; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]); ctx.beginPath();
      var S = 800, i, t;
      for (i = 0; i <= S; i++) {
        t = cycles * i / S;
        var x = d * Math.sin(2 * Math.PI * t);
        if (i === 0) ctx.moveTo(bx(t), by(x)); else ctx.lineTo(bx(t), by(x));
      }
      ctx.stroke(); ctx.setLineDash([]);
      function wave(name, alpha, width) {
        var f = SHAPES[name];
        ctx.globalAlpha = alpha; ctx.strokeStyle = C.accent; ctx.lineWidth = width; ctx.beginPath();
        for (var j = 0; j <= S; j++) {
          var tt = cycles * j / S, v = f(d * Math.sin(2 * Math.PI * tt), d);
          if (j === 0) ctx.moveTo(bx(tt), by(v)); else ctx.lineTo(bx(tt), by(v));
        }
        ctx.stroke(); ctx.globalAlpha = 1;
      }
      others().forEach(function (n) { wave(n, 0.25, 1.5); });
      wave(shape, 1, 2.5);
      ctx.restore();

      // legend under the time plot
      var ly = B.y + B.h + 20, lx = Math.max(0, Math.min(B.x + B.w / 2 - 88, w - 182)); // keep it on-canvas at phone width
      ctx.lineWidth = 1.5; ctx.strokeStyle = C.muted; ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 24, ly); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = C.muted; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText("input", lx + 30, ly);
      ctx.strokeStyle = C.accent; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(lx + 100, ly); ctx.lineTo(lx + 124, ly); ctx.stroke();
      ctx.fillStyle = C.accent; ctx.fillText("output", lx + 130, ly);

      // ---- playhead: same instant in both panels ----
      if (!reduceMotion) {
        var xin = d * Math.sin(2 * Math.PI * playhead), yout = SHAPES[shape](xin, d);
        var px = bx(playhead);
        ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.globalAlpha = 0.45;
        ctx.beginPath(); ctx.moveTo(px, B.y); ctx.lineTo(px, B.y + B.h); ctx.stroke();
        ctx.globalAlpha = 1; ctx.fillStyle = C.ink;
        ctx.beginPath(); ctx.arc(px, by(yout), 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(ax(xin), ay(yout), 4.5, 0, Math.PI * 2); ctx.fill();
      }
    }

    function updateText() {
      q("driveVal").textContent = shape === "sine" ? "\u2013" : drive().toFixed(1);
      driveEl.disabled = shape === "sine";
    }

    function setShape(s) {
      shape = s;
      host.querySelectorAll(".wst-chips button").forEach(function (b) {
        b.setAttribute("aria-pressed", String(b.dataset.s === s));
      });
      updateCurve(); updateText(); draw();
    }
    host.querySelectorAll(".wst-chips button").forEach(function (b) {
      b.addEventListener("click", function () { setShape(b.dataset.s); });
    });
    driveEl.addEventListener("input", function () { updateCurve(); updateText(); draw(); });

    // ---------- sound: a low sine through the selected shape ----------
    // 220 Hz: low enough that aliasing stays small; this demo is about the shape, not the spectrum.
    var actx = null, osc = null, shaperNode = null, amp = null;
    // Same ceiling as pulse-duty-wave.js: 100% peaks around -36 dBFS.
    var MAX_GAIN = 0.015;
    function gainFromVol() { var v = parseFloat(volEl.value); return MAX_GAIN * v * v; } // squared = smoother taper
    function buildCurve() {
      var L = 4096, c = new Float32Array(L), f = SHAPES[shape], d = drive();
      for (var i = 0; i < L; i++) c[i] = f(d * (i / (L - 1) * 2 - 1), d);
      return c;
    }
    function updateCurve() { if (shaperNode) shaperNode.curve = buildCurve(); }

    volEl.addEventListener("input", function () {
      q("volVal").textContent = Math.round(parseFloat(volEl.value) * 100) + "%";
      if (osc) amp.gain.setTargetAtTime(gainFromVol(), actx.currentTime, 0.02);
    });

    q("play").addEventListener("click", function () {
      var btn = q("play");
      if (osc) {
        amp.gain.setTargetAtTime(0, actx.currentTime, 0.02);
        var o = osc; osc = null; setTimeout(function () { o.stop(); }, 150);
        btn.textContent = "Play"; btn.setAttribute("aria-pressed", "false");
        return;
      }
      try {
        actx = actx || new (window.AudioContext || window.webkitAudioContext)();
        actx.resume().then(function () {
          amp = actx.createGain(); amp.gain.value = 0; amp.connect(actx.destination);
          shaperNode = actx.createWaveShaper(); shaperNode.curve = buildCurve(); shaperNode.oversample = "none";
          shaperNode.connect(amp);
          osc = actx.createOscillator(); osc.type = "sine"; osc.frequency.value = 220;
          osc.connect(shaperNode); osc.start();
          amp.gain.setTargetAtTime(gainFromVol(), actx.currentTime, 0.02);
          btn.textContent = "Stop"; btn.setAttribute("aria-pressed", "true");
        });
      } catch (e) { q("note").textContent = "Sound could not start in this browser."; }
    });

    var last = performance.now();
    function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!reduceMotion) { playhead = (playhead + dt * 0.25) % 2; draw(); }
      requestAnimationFrame(frame);
    }

    if (window.ResizeObserver) new ResizeObserver(draw).observe(host);
    setShape("tanh");
    requestAnimationFrame(frame);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountAll);
  else mountAll();
})();
