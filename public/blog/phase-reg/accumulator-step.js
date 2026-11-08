/*
 * accumulator-step.js — why a bigger step means a higher pitch
 *
 * A toy 6-bit accumulator (0..63) instead of the SID's 24-bit one, so every
 * step is visible. On each tick: value = (value + step) % 64.
 * Bigger step -> wraps sooner -> more cycles per second -> higher pitch.
 * No sound here: the readout shows how ticks per cycle becomes Hz.
 *
 * Usage (anywhere in a page or blog post):
 *   <div data-accumulator-step></div>
 *   <script src="accumulator-step.js"></script>
 *
 * If no element with data-accumulator-step exists, the demo is inserted
 * right after the <script> tag. No dependencies.
 */
(function () {
  "use strict";

  var script = document.currentScript;

  function mountAll() {
    var hosts = document.querySelectorAll("[data-accumulator-step]:not([data-mounted])");
    if (!hosts.length && script) {
      var div = document.createElement("div");
      div.setAttribute("data-accumulator-step", "");
      script.parentNode.insertBefore(div, script.nextSibling);
      hosts = [div];
    }
    for (var i = 0; i < hosts.length; i++) mount(hosts[i]);
  }

  var MONO = "ui-monospace,'SF Mono',Menlo,monospace";
  var SIZE = 64;          // toy accumulator wraps at 64
  var WINDOW = 48;        // ticks shown on the timeline
  var TOY_CLOCK = 3520;   // a made-up "fast" tick rate: step 1 -> 55 Hz
  var RUN_RATE = 4;       // ticks per second when Run is on

  var CSS = [
    ".astp{--astp-bg:#f8f8fc;--astp-ink:#1c1940;--astp-muted:#5c5880;--astp-rule:#d4d1e6;--astp-accent:#40318d;--astp-warn:#a2512c;--astp-soft:rgba(64,49,141,.12);",
    "font:15px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif;color:var(--astp-ink);background:var(--astp-bg);border:1px solid var(--astp-rule);border-radius:10px;padding:16px;display:grid;gap:14px;max-width:980px;margin:1.5em 0}",
    "@media (prefers-color-scheme:dark){.astp{--astp-bg:#1d1a4a;--astp-ink:#dcd8f7;--astp-muted:#9c97c8;--astp-rule:#322e66;--astp-accent:#8b80ee;--astp-warn:#e39268;--astp-soft:rgba(139,128,238,.16)}}",
    ".astp *{box-sizing:border-box}",
    ".astp canvas{width:100%;height:220px;display:block}",
    ".astp-read{display:flex;flex-wrap:wrap;gap:6px 22px;font:13px " + MONO + ";color:var(--astp-muted);font-variant-numeric:tabular-nums}",
    ".astp-read strong{color:var(--astp-ink);font-weight:500}",
    ".astp-read .hi strong{color:var(--astp-accent)}",
    ".astp-row{display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:center}",
    ".astp-row label{font-weight:600;font-size:15px;white-space:nowrap}",
    ".astp-val{display:inline-block;font:500 18px " + MONO + ";font-variant-numeric:tabular-nums;color:var(--astp-warn);min-width:2ch;text-align:right}",
    ".astp-reg{display:inline-flex;gap:1px;margin-left:8px;vertical-align:middle}",
    ".astp-reg span{font:500 11px " + MONO + ";width:1.5em;text-align:center;padding:2px 0;border-radius:2px;background:var(--astp-soft);color:var(--astp-muted)}",
    ".astp-reg span.one{background:var(--astp-accent);color:var(--astp-bg)}",
    "@media (max-width:600px){.astp-row{grid-template-columns:1fr}.astp-row label{white-space:normal}}",
    ".astp-sound{display:grid;grid-template-columns:auto auto 1fr auto;gap:12px;align-items:center;max-width:560px}",
    ".astp-sound span{font:13px " + MONO + ";font-variant-numeric:tabular-nums;color:var(--astp-muted)}",
    ".astp-sound [data-k=volVal]{min-width:4ch;text-align:right}",
    ".astp input[type=range]{width:100%;min-width:0;accent-color:var(--astp-accent)}",
    ".astp-btns{display:flex;flex-wrap:wrap;gap:8px;align-items:center}",
    ".astp button{font:500 13px " + MONO + ";color:var(--astp-ink);background:var(--astp-bg);border:1px solid var(--astp-rule);border-radius:999px;padding:6px 12px;cursor:pointer}",
    ".astp button:hover{border-color:var(--astp-accent)}",
    ".astp button:focus-visible,.astp input:focus-visible{outline:2px solid var(--astp-accent);outline-offset:2px}",
    ".astp button[aria-pressed=true]{background:var(--astp-accent);color:var(--astp-bg);border-color:var(--astp-accent)}",
    ".astp-chain{font:13px/1.7 " + MONO + ";font-variant-numeric:tabular-nums;background:var(--astp-soft);border-radius:8px;padding:10px 12px;overflow-x:auto;white-space:pre;color:var(--astp-muted)}",
    ".astp-chain b{color:var(--astp-ink);font-weight:500}",
    ".astp-chain .hi{color:var(--astp-accent)}",
    "@media (max-width:600px){.astp canvas{height:300px}}"
  ].join("\n");

  function injectCSS() {
    if (document.getElementById("astp-style")) return;
    var s = document.createElement("style");
    s.id = "astp-style";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  var HTML =
    '<canvas role="img" aria-label="A counter from 0 to 63 drawn as a dial and as a timeline; each tick adds the step and it wraps past 63"></canvas>' +
    '<div class="astp-read">' +
    '  <span>value <strong data-k="value">0</strong></span>' +
    '  <span>ticks <strong data-k="ticks">0</strong></span>' +
    '</div>' +
    '<div class="astp-chain" data-k="chain"></div>' +
    '<div class="astp-row">' +
    '  <label>Frequency register (step): <span class="astp-val" data-k="stepVal">4</span>' +
    '    <span class="astp-reg" data-k="reg" aria-hidden="true"></span></label>' +
    '  <input data-k="step" type="range" min="1" max="16" step="1" value="4" aria-label="Frequency register, the step size">' +
    '</div>' +
    '<div class="astp-btns">' +
    '  <button data-k="tick">Tick +1</button>' +
    '  <button data-k="run" aria-pressed="false">Run</button>' +
    '  <button data-k="reset">Reset</button>' +
    '</div>' +
    '<div class="astp-sound">' +
    '  <button data-k="play" aria-pressed="false">Play</button>' +
    '  <span>volume</span>' +
    '  <input data-k="vol" type="range" min="0" max="1" step="0.01" value="0.5" aria-label="Volume">' +
    '  <span data-k="volVal">50%</span>' +
    '</div>';

  function mount(host) {
    injectCSS();
    host.setAttribute("data-mounted", "");
    host.classList.add("astp");
    host.innerHTML = HTML;

    var q = function (k) { return host.querySelector('[data-k="' + k + '"]'); };
    var canvas = host.querySelector("canvas");
    var stepEl = q("step");

    var step = 4, value = 0, ticks = 0, wraps = 0, running = false;
    var history = [{ v: 0, wrap: false }];   // one entry per tick
    var C = {};
    function readColors() {
      var s = getComputedStyle(host);
      ["ink", "muted", "rule", "accent", "warn", "soft", "bg"].forEach(function (k) { C[k] = s.getPropertyValue("--astp-" + k).trim(); });
    }
    readColors();
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () { readColors(); draw(); });

    function mono(px) { return px + "px " + MONO; }

    function tick() {
      var next = value + step, wrapped = next >= SIZE;
      value = next % SIZE; ticks++;
      if (wrapped) wraps++;
      history.push({ v: value, wrap: wrapped, step: step });
      if (history.length > WINDOW + 1) history.shift();
      updateText(); draw();
    }

    function reset() {
      value = 0; ticks = 0; wraps = 0; history = [{ v: 0, wrap: false }];
      updateText(); draw();
    }

    function updateText() {
      q("value").textContent = value;
      q("ticks").textContent = ticks;
      q("stepVal").textContent = step;
      // the register itself: one 5-bit slot holding the step (the SID's is 16 bits)
      var bits = "";
      for (var b = 4; b >= 0; b--) { var one = (step >> b) & 1; bits += '<span class="' + (one ? "one" : "") + '">' + one + "</span>"; }
      q("reg").innerHTML = bits;
      // From "ticks per cycle" to pitch: pitch is simply how many cycles fit in a second.
      // Every number is padded to a fixed width so the surrounding text never shifts.
      var p = SIZE / step, pTxt = (Number.isInteger(p) ? String(p) : p.toFixed(2)).padStart(5);
      var slow = RUN_RATE / p, fast = Math.round(TOY_CLOCK / p);
      var hzPart = " = " + String(fast).padStart(3) + " Hz";            // only on the Sound row
      q("chain").innerHTML =
        "each tick: value = (value + freq register) mod 64 = (value + <b>" + String(step).padStart(2) + "</b>) mod 64\n" +
        "1 cycle = 64 values / <b>" + String(step).padStart(2) + "</b> step size = <b>" + pTxt + "</b> ticks per cycle\n" +
        "pitch   = cycles per second = ticks per second ÷ ticks per cycle\n\n" +
        "Visual example: " + String(RUN_RATE).padStart(5) + " ticks/s ÷ " + pTxt + " = <b>" + slow.toFixed(2).padStart(6) + "</b> cycles/s" +
        " ".repeat(hzPart.length) + "   too slow to hear\n" +
        "Sound:          " + "3,520" + " ticks/s ÷ " + pTxt + " = <b class=\"hi\">" + String(fast).padStart(6) + " cycles/s" + hzPart + "</b>   a pitch\n\n" +
        "Same counter, same step. Only the tick rate turns it into sound.\n" +
        "The SID does this with 16,777,216 values and about a million ticks per second.";
    }

    function draw() {
      var dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
      if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
      var ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // narrow screens: dial on top, timeline below; otherwise side by side
      var stacked = w < 560;
      var dialBox = stacked ? { x: 0, y: 0, w: w, h: h * 0.45 } : { x: 0, y: 0, w: Math.min(230, w * 0.3), h: h };
      var tl = stacked ? { x: 0, y: h * 0.5, w: w, h: h * 0.5 } : { x: dialBox.w + 16, y: 0, w: w - dialBox.w - 16, h: h };

      // ---- dial: 64 positions around a circle, a hand at the current value ----
      var cx = dialBox.x + dialBox.w / 2, cy = dialBox.y + dialBox.h / 2;
      var r = Math.min(dialBox.w, dialBox.h) / 2 - 18;
      function ang(v) { return -Math.PI / 2 + (v / SIZE) * Math.PI * 2; }
      ctx.strokeStyle = C.rule; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      for (var i = 0; i < SIZE; i++) {
        var a = ang(i), len = i % 16 === 0 ? 8 : i % 4 === 0 ? 4 : 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        ctx.lineTo(cx + Math.cos(a) * (r - len), cy + Math.sin(a) * (r - len));
        ctx.stroke();
      }
      ctx.textAlign = "center";
      // the last few jumps, as arcs, so the step size is visible
      var recent = history.slice(-4);
      for (var k = 1; k < recent.length; k++) {
        var from = recent[k - 1].v, to = recent[k].v;
        var a0 = ang(from), a1 = ang(to);
        if (a1 <= a0) a1 += Math.PI * 2;
        ctx.strokeStyle = C.accent; ctx.globalAlpha = 0.25 + 0.2 * k; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(cx, cy, r + 7, a0, a1); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      var ah = ang(value);
      ctx.strokeStyle = C.accent; ctx.lineWidth = 2.5; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ah) * (r - 10), cy + Math.sin(ah) * (r - 10)); ctx.stroke();
      ctx.fillStyle = C.accent; ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C.ink; ctx.font = mono(20); ctx.textBaseline = "middle";
      ctx.fillText(String(value), cx, cy + r * 0.45);

      // ---- timeline: value after each tick, wraps marked ----
      var padL = 46, padB = 22, top = tl.y + 10;
      var X0 = tl.x + padL, X1 = tl.x + tl.w - 6, Yb = tl.y + tl.h - padB;
      function X(n) { return X0 + (n / WINDOW) * (X1 - X0); }
      function Y(v) { return Yb - (v / (SIZE - 1)) * (Yb - top); }
      ctx.font = mono(10.5); ctx.textAlign = "right"; ctx.textBaseline = "middle";
      [0, 32, 63].forEach(function (v) {
        ctx.strokeStyle = C.rule; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(X0, Y(v)); ctx.lineTo(X1, Y(v)); ctx.stroke();
        ctx.fillStyle = C.muted; ctx.fillText(String(v), X0 - 5, Y(v));
      });
      // y-axis label
      ctx.save();
      ctx.translate(tl.x + 8, (top + Yb) / 2); ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = C.muted; ctx.font = mono(10.5); ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("value", 0, 0);
      ctx.restore();
      // staircase
      ctx.strokeStyle = C.accent; ctx.lineWidth = 2; ctx.lineCap = "butt";
      ctx.beginPath();
      for (var n = 0; n < history.length; n++) {
        var x = X(n), y = Y(history[n].v);
        if (n === 0) ctx.moveTo(x, y);
        else if (history[n].wrap) { ctx.lineTo(x, Y(history[n - 1].v)); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y); }
        else ctx.lineTo(x, Y(history[n - 1].v)), ctx.lineTo(x, y);
      }
      ctx.lineTo(X(history.length - 1) + (X(1) - X(0)), Y(history[history.length - 1].v));
      ctx.stroke();
      // wrap markers
      ctx.fillStyle = C.warn; ctx.strokeStyle = C.warn; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      for (n = 1; n < history.length; n++) {
        if (!history[n].wrap) continue;
        var wx = Math.round(X(n)) + 0.5;
        ctx.beginPath(); ctx.moveTo(wx, top); ctx.lineTo(wx, Yb); ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillStyle = C.muted;
      ctx.fillText("ticks →", X0, Yb + 6);
      // current point
      var lx = X(history.length - 1), ly = Y(value);
      ctx.fillStyle = C.accent; ctx.beginPath(); ctx.arc(lx, ly, 4, 0, Math.PI * 2); ctx.fill();
    }

    stepEl.addEventListener("input", function () { step = parseInt(stepEl.value, 10); updateText(); draw(); updateSound(); });
    q("tick").addEventListener("click", function () { tick(); });
    q("reset").addEventListener("click", reset);

    var timer = null;
    q("run").addEventListener("click", function () {
      running = !running;
      q("run").setAttribute("aria-pressed", String(running));
      q("run").textContent = running ? "Pause" : "Run";
      if (running) timer = setInterval(tick, 1000 / RUN_RATE);
      else clearInterval(timer);
    });

    // ---------- sound: this exact toy counter, ticking 3,520 times a second ----------
    // Each tick adds `step` and wraps at 64; the value is held until the next tick
    // (a 64-level staircase, so it's buzzier than a smooth sawtooth). 3,520 ticks
    // is exactly 55 trips through 64 values, so a 1-second buffer loops seamlessly.
    // Same hard ceiling as the other widgets: 100% volume peaks around -36 dBFS.
    var MAX_GAIN = 0.015;
    var actx = null, src = null, amp = null, volEl = q("vol");
    function gainFromVol() { var v = parseFloat(volEl.value); return MAX_GAIN * v * v; }
    function counterBuffer() {
      var sr = actx.sampleRate, buf = actx.createBuffer(1, sr, sr), d = buf.getChannelData(0);
      for (var i = 0; i < sr; i++) {
        var t = Math.floor(i * TOY_CLOCK / sr);           // tick number at this sample
        d[i] = ((t * step) % SIZE) / (SIZE - 1) - 0.5;   // 0..63 -> -0.5..0.5
      }
      return buf;
    }
    function startSource() {
      src = actx.createBufferSource(); src.buffer = counterBuffer(); src.loop = true;
      src.connect(amp); src.start();
    }
    function updateSound() {
      if (!src) return;
      var old = src; old.stop(actx.currentTime + 0.01);
      startSource();
    }
    volEl.addEventListener("input", function () {
      q("volVal").textContent = Math.round(parseFloat(volEl.value) * 100) + "%";
      if (amp) amp.gain.setTargetAtTime(gainFromVol(), actx.currentTime, 0.02);
    });
    q("play").addEventListener("click", function () {
      var btn = q("play");
      if (src) {
        amp.gain.setTargetAtTime(0, actx.currentTime, 0.02);
        var s = src, a = amp; src = null; amp = null;
        setTimeout(function () { s.stop(); a.disconnect(); }, 150);
        btn.textContent = "Play"; btn.setAttribute("aria-pressed", "false");
        return;
      }
      try {
        actx = actx || new (window.AudioContext || window.webkitAudioContext)();
        actx.resume().then(function () {
          amp = actx.createGain(); amp.gain.value = 0; amp.connect(actx.destination);
          startSource();
          amp.gain.setTargetAtTime(gainFromVol(), actx.currentTime, 0.02);
          btn.textContent = "Stop"; btn.setAttribute("aria-pressed", "true");
        });
      } catch (e) { btn.textContent = "No sound"; btn.disabled = true; }
    });

    if (window.ResizeObserver) new ResizeObserver(draw).observe(host);
    updateText(); draw();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountAll);
  else mountAll();
})();
