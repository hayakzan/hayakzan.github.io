/*
 * sid-waveforms.js — one accumulator, four waveforms
 *
 * All four SID waveforms read the same 24-bit accumulator (as in reSID):
 *   sawtooth  = accumulator >> 12
 *   triangle  = ((bit23 ? ~accumulator : accumulator) >> 11) & 0xfff
 *   pulse     = (accumulator >> 12) >= pw ? 0xfff : 0x000
 *   noise     = 8 bits of a 23-bit LFSR, clocked when bit 19 goes 0 -> 1
 *
 * Usage (anywhere in a page or blog post):
 *   <div data-sid-waveforms></div>
 *   <script src="sid-waveforms.js"></script>
 *
 * If no element with data-sid-waveforms exists, the demo is inserted
 * right after the <script> tag. No dependencies.
 */
(function () {
  "use strict";

  var script = document.currentScript;

  function mountAll() {
    var hosts = document.querySelectorAll("[data-sid-waveforms]:not([data-mounted])");
    if (!hosts.length && script) {
      var div = document.createElement("div");
      div.setAttribute("data-sid-waveforms", "");
      script.parentNode.insertBefore(div, script.nextSibling);
      hosts = [div];
    }
    for (var i = 0; i < hosts.length; i++) mount(hosts[i]);
  }

  var MONO = "ui-monospace,'SF Mono',Menlo,monospace";
  var TWO24 = 16777216, CYCLES = 2, FREQ = 220;

  // ---------- the SID's waveform logic (reSID) ----------
  function saw(acc) { return acc >>> 12; }
  function tri(acc) { return (((acc & 0x800000) ? ~acc : acc) >>> 11) & 0xfff; }
  function pulse(acc, pw) { return (acc >>> 12) >= pw ? 0xfff : 0; }
  function lfsrClock(s) { var bit0 = ((s >>> 22) ^ (s >>> 17)) & 1; return ((s << 1) & 0x7fffff) | bit0; }
  function noiseOut(s) {
    return ((s & 0x400000) >>> 11) | ((s & 0x100000) >>> 10) | ((s & 0x010000) >>> 7) |
           ((s & 0x002000) >>> 5) | ((s & 0x000800) >>> 4) | ((s & 0x000080) >>> 1) |
           ((s & 0x000010) << 1) | ((s & 0x000004) << 2);
  }
  var LFSR_INIT = 0x7ffff8;

  // noise levels for the displayed cycles: one value per bit-19 rising edge (16 per cycle)
  var NOISE_STEPS = [];
  (function () {
    // Right after reset the register is nearly all 1s and needs a few thousand
    // clocks before its output looks random, so skip ahead for the picture.
    var s = LFSR_INIT;
    for (var j = 0; j < 5000; j++) s = lfsrClock(s);
    NOISE_STEPS.push(noiseOut(s));
    for (var k = 0; k < 16 * CYCLES; k++) { s = lfsrClock(s); NOISE_STEPS.push(noiseOut(s)); }
  })();
  // bit 19 rises at accumulator = (2m+1) * 2^19, i.e. at cycle fractions (k + 0.5) / 16
  function noiseAt(t) { var k = Math.floor(t * 16 + 0.5); return NOISE_STEPS[Math.min(k, NOISE_STEPS.length - 1)]; }

  var CSS = [
    ".swf{--swf-bg:#f8f8fc;--swf-ink:#1c1940;--swf-muted:#5c5880;--swf-rule:#d4d1e6;--swf-accent:#40318d;--swf-warn:#a2512c;--swf-soft:rgba(64,49,141,.12);",
    "font:15px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif;color:var(--swf-ink);background:var(--swf-bg);border:1px solid var(--swf-rule);border-radius:10px;padding:16px;display:grid;gap:14px;max-width:980px;margin:1.5em 0}",
    "@media (prefers-color-scheme:dark){.swf{--swf-bg:#1d1a4a;--swf-ink:#dcd8f7;--swf-muted:#9c97c8;--swf-rule:#322e66;--swf-accent:#8b80ee;--swf-warn:#e39268;--swf-soft:rgba(139,128,238,.16)}}",
    ".swf *{box-sizing:border-box}",
    ".swf canvas{width:100%;height:380px;display:block}",
    ".swf-acc{font:13px " + MONO + ";font-variant-numeric:tabular-nums;color:var(--swf-muted)}",
    ".swf-acc strong{color:var(--swf-ink);font-weight:500}",
    ".swf-acc .b23 strong{color:var(--swf-accent)}",
    ".swf-acc .b19 strong{color:var(--swf-warn)}",
    ".swf-row{display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center}",
    ".swf-row label{font-weight:600;font-size:15px}",
    ".swf-val{font:500 15px " + MONO + ";font-variant-numeric:tabular-nums;color:var(--swf-warn);min-width:11ch;text-align:right}",
    ".swf input[type=range]{width:100%;min-width:0;accent-color:var(--swf-accent)}",
    ".swf-btns{display:flex;flex-wrap:wrap;gap:8px;align-items:center}",
    ".swf-btns > span{font:12px " + MONO + ";color:var(--swf-muted);margin-right:4px}",
    ".swf button{font:500 13px " + MONO + ";color:var(--swf-ink);background:var(--swf-bg);border:1px solid var(--swf-rule);border-radius:999px;padding:6px 12px;cursor:pointer}",
    ".swf button:hover{border-color:var(--swf-accent)}",
    ".swf button:focus-visible,.swf input:focus-visible{outline:2px solid var(--swf-accent);outline-offset:2px}",
    ".swf button[aria-pressed=true]{background:var(--swf-accent);color:var(--swf-bg);border-color:var(--swf-accent)}",
    ".swf-sound{display:grid;grid-template-columns:auto auto 1fr auto;gap:12px;align-items:center;max-width:560px}",
    ".swf-sound span{font:13px " + MONO + ";font-variant-numeric:tabular-nums;color:var(--swf-muted)}",
    "@media (max-width:600px){.swf canvas{height:420px}.swf-row{grid-template-columns:1fr auto}.swf-row label{grid-column:1/-1}}"
  ].join("\n");

  function injectCSS() {
    if (document.getElementById("swf-style")) return;
    var s = document.createElement("style");
    s.id = "swf-style";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  var HTML =
    '<div class="swf-acc">accumulator <strong data-k="accHex">0x000000</strong>' +
    ' &nbsp;·&nbsp; <span class="b23">bit 23 <strong data-k="b23">0</strong></span>' +
    ' &nbsp;·&nbsp; <span class="b19">bit 19 <strong data-k="b19">0</strong></span></div>' +
    '<canvas role="img" aria-label="Sawtooth, triangle, pulse and noise drawn from the same accumulator over two cycles"></canvas>' +
    '<div class="swf-row">' +
    '  <label>Pulse width (pw)</label>' +
    '  <input data-k="pw" type="range" min="0" max="4095" step="1" value="2048" aria-label="Pulse width register, 0 to 4095">' +
    '  <span class="swf-val" data-k="pwVal">2048 ($800)</span>' +
    '</div>' +
    '<div class="swf-row">' +
    '  <label>Frequency</label>' +
    '  <input data-k="freq" type="range" min="0" max="1" step="0.001" aria-label="Frequency">' +
    '  <span class="swf-val" data-k="freqVal">220 Hz</span>' +
    '</div>' +
    '<div class="swf-btns" role="group" aria-label="Waveform to hear">' +
    '  <span>listen to</span>' +
    '  <button data-wave="saw" aria-pressed="true">sawtooth</button><button data-wave="tri" aria-pressed="false">triangle</button>' +
    '  <button data-wave="pulse" aria-pressed="false">pulse</button><button data-wave="noise" aria-pressed="false">noise</button>' +
    '</div>' +
    '<div class="swf-sound">' +
    '  <button data-k="play" aria-pressed="false">Play</button>' +
    '  <span>volume</span>' +
    '  <input data-k="vol" type="range" min="0" max="1" step="0.01" value="0.5" aria-label="Volume">' +
    '  <span data-k="volVal">50%</span>' +
    '</div>';

  function hex(n, d) { return "$" + n.toString(16).toUpperCase().padStart(d, "0"); }

  function mount(host) {
    injectCSS();
    host.setAttribute("data-mounted", "");
    host.classList.add("swf");
    host.innerHTML = HTML;

    var q = function (k) { return host.querySelector('[data-k="' + k + '"]'); };
    var canvas = host.querySelector("canvas");
    var pwEl = q("pw");
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var pw = 2048, playhead = 0.3, wave = "saw";   // playhead in cycles, 0..CYCLES
    var C = {};
    function readColors() {
      var s = getComputedStyle(host);
      ["ink", "muted", "rule", "accent", "warn", "soft", "bg"].forEach(function (k) { C[k] = s.getPropertyValue("--swf-" + k).trim(); });
    }
    readColors();
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () { readColors(); draw(); });

    function mono(px) { return px + "px " + MONO; }
    function accAt(t) { return Math.floor((t - Math.floor(t)) * TWO24) & 0xffffff; }

    var LANES = [
      { key: "saw", name: "sawtooth", code: "acc >> 12", f: function (t) { return saw(accAt(t)); } },
      { key: "tri", name: "triangle", code: "fold at bit 23", f: function (t) { return tri(accAt(t)); } },
      { key: "pulse", name: "pulse", code: "(acc >> 12) >= pw", f: function (t) { return pulse(accAt(t), pw); } },
      { key: "noise", name: "noise", code: "LFSR, clocked by bit 19", f: function (t) { return noiseAt(t); } }
    ];

    function draw() {
      var dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
      if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
      var ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      var narrow = w < 560;
      var padL = narrow ? 8 : 150, padR = narrow ? 46 : 64, top = 6, bot = h - 22;
      var laneH = (bot - top) / LANES.length;
      function X(t) { return padL + (t / CYCLES) * (w - padL - padR); }

      // bit 23 flips (mid-cycle) and wraps: full-height guides
      for (var c = 0; c <= CYCLES; c++) {
        ctx.strokeStyle = C.rule; ctx.lineWidth = 1; ctx.setLineDash([]);
        var xw = Math.round(X(c)) + 0.5;
        ctx.beginPath(); ctx.moveTo(xw, top); ctx.lineTo(xw, bot); ctx.stroke();
        if (c < CYCLES) {
          ctx.strokeStyle = C.accent; ctx.globalAlpha = 0.5; ctx.setLineDash([4, 4]);
          var xm = Math.round(X(c + 0.5)) + 0.5;
          ctx.beginPath(); ctx.moveTo(xm, top); ctx.lineTo(xm, bot); ctx.stroke();
          ctx.globalAlpha = 1; ctx.setLineDash([]);
        }
      }
      ctx.font = mono(10.5); ctx.textBaseline = "top"; ctx.textAlign = "center";
      ctx.fillStyle = C.muted; ctx.fillText("wrap", X(1), bot + 6);
      ctx.fillStyle = C.accent; ctx.fillText("bit 23 → 1", X(0.5), bot + 6);
      if (!narrow) ctx.fillText("bit 23 → 1", X(1.5), bot + 6);

      LANES.forEach(function (lane, li) {
        var y0 = top + li * laneH + 8, y1 = top + (li + 1) * laneH - 8;
        function Y(v) { return y1 - (v / 4095) * (y1 - y0); }
        var active = lane.key === wave;

        // label
        ctx.textAlign = "left"; ctx.textBaseline = "top";
        ctx.fillStyle = active ? C.accent : C.ink; ctx.font = (active ? "600 " : "") + mono(narrow ? 11 : 12.5);
        if (narrow) ctx.fillText(lane.name, padL + 2, y0 - 6);
        else { ctx.fillText(lane.name, 8, y0 + 4); ctx.fillStyle = C.muted; ctx.font = mono(10.5); ctx.fillText(lane.code, 8, y0 + 22); }

        // baseline
        ctx.strokeStyle = C.rule; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(CYCLES), Y(0)); ctx.stroke();

        // pw threshold drawn on the sawtooth lane: pulse is "saw above this line"
        if (lane.key === "saw") {
          ctx.strokeStyle = C.warn; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(X(0), Y(pw)); ctx.lineTo(X(CYCLES), Y(pw)); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = C.warn; ctx.font = mono(10); ctx.textAlign = "left"; ctx.textBaseline = "middle";
          ctx.fillText("pw", X(CYCLES) + 4, Y(pw));
        }

        // bit 19 rising edges on the noise lane
        if (lane.key === "noise") {
          ctx.strokeStyle = C.warn; ctx.lineWidth = 1;
          for (var k = 0; k < 16 * CYCLES; k++) {
            var xt = Math.round(X((k + 0.5) / 16)) + 0.5;
            ctx.beginPath(); ctx.moveTo(xt, y1 + 2); ctx.lineTo(xt, y1 + 6); ctx.stroke();
          }
          if (!narrow) { ctx.fillStyle = C.warn; ctx.font = mono(10); ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("bit 19 ↑", X(CYCLES) + 4, y1 + 4); }
        }

        // the waveform
        ctx.strokeStyle = C.accent; ctx.lineWidth = active ? 2.5 : 1.6; ctx.globalAlpha = active ? 1 : 0.7;
        ctx.beginPath();
        var N = Math.max(400, Math.round(w * 2)), prev = null;
        for (var i = 0; i <= N; i++) {
          var t = Math.min((i / N) * CYCLES, CYCLES - 1e-9), v = lane.f(t), x = X(t), y = Y(v);
          if (i === 0) ctx.moveTo(x, y);
          else if (prev !== null && Math.abs(v - prev) > 300 && lane.key !== "tri") { ctx.lineTo(x, Y(prev)); ctx.lineTo(x, y); }
          else ctx.lineTo(x, y);
          prev = v;
        }
        ctx.stroke(); ctx.globalAlpha = 1;

        // value at the cursor
        var cv = lane.f(playhead);
        ctx.fillStyle = C.accent; ctx.beginPath(); ctx.arc(X(playhead), Y(cv), 4, 0, Math.PI * 2); ctx.fill();
        if (!narrow || lane.key !== "saw") {
          ctx.fillStyle = C.ink; ctx.font = mono(11); ctx.textAlign = "right"; ctx.textBaseline = "middle";
          ctx.fillText(hex(cv, 3), w - 2, (y0 + y1) / 2);
        }
      });

      // cursor
      var xc = X(playhead);
      ctx.strokeStyle = C.ink; ctx.globalAlpha = 0.35; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(xc, top); ctx.lineTo(xc, bot); ctx.stroke(); ctx.globalAlpha = 1;

      var acc = accAt(playhead);
      q("accHex").textContent = "0x" + acc.toString(16).toUpperCase().padStart(6, "0");
      q("b23").textContent = (acc >>> 23) & 1;
      q("b19").textContent = (acc >>> 19) & 1;
    }

    pwEl.addEventListener("input", function () {
      pw = parseInt(pwEl.value, 10);
      q("pwVal").textContent = pw + " (" + hex(pw, 3) + ")";
      draw(); if (wave === "pulse") setSource();
    });
    host.querySelectorAll("[data-wave]").forEach(function (b) {
      b.addEventListener("click", function () {
        wave = b.dataset.wave;
        host.querySelectorAll("[data-wave]").forEach(function (o) { o.setAttribute("aria-pressed", String(o === b)); });
        draw(); setSource();
      });
    });

    // ---------- sound ----------
    // Same hard ceiling as the other widgets: 100% volume peaks around -36 dBFS.
    // Saw, triangle and pulse are band-limited Fourier versions; noise runs the
    // actual LFSR, clocked 16 times per cycle, so it has the SID's stepped grit.
    var MAX_GAIN = 0.015;
    var actx = null, amp = null, src = null, noiseBuf = null, volEl = q("vol");
    function gainFromVol() { var v = parseFloat(volEl.value); return MAX_GAIN * v * v; }

    // ---- frequency: log slider 55..1760 Hz, shown with the PAL register value ----
    var freqEl = q("freq"), freq = FREQ;
    function sliderToHz(v) { return 55 * Math.pow(2, v * 5); }
    function hzToSlider(f) { return Math.log(f / 55) / Math.log(2) / 5; }
    function showFreq() {
      var reg = Math.round(freq * TWO24 / 985248);
      q("freqVal").textContent = Math.round(freq) + " Hz · reg " + reg;
    }
    freqEl.value = hzToSlider(freq); showFreq();
    freqEl.addEventListener("input", function () {
      freq = sliderToHz(parseFloat(freqEl.value)); showFreq();
      if (!src) return;
      if (src.frequency) src.frequency.setTargetAtTime(freq, actx.currentTime, 0.01);
      else src.playbackRate.setTargetAtTime(freq / FREQ, actx.currentTime, 0.01); // noise buffer is built at FREQ
    });

    function periodic(kind) {
      var H = 64, re = new Float32Array(H + 1), im = new Float32Array(H + 1), n;
      if (kind === "saw") for (n = 1; n <= H; n++) im[n] = -1 / (n * Math.PI);                 // ±0.5
      if (kind === "tri") for (n = 1; n <= H; n += 2) im[n] = (4 / (Math.PI * Math.PI * n * n)) * (((n - 1) / 2) % 2 ? -1 : 1); // ±0.5
      if (kind === "pulse") { var d = 1 - pw / 4096; for (n = 1; n <= H; n++) re[n] = Math.sin(n * Math.PI * d) / (n * Math.PI); } // 1-unit pulse, halved
      return actx.createPeriodicWave(re, im, { disableNormalization: true });
    }
    function buildNoise() {
      var sr = actx.sampleRate, len = Math.round(sr * 2), buf = actx.createBuffer(1, len, sr), data = buf.getChannelData(0);
      var acc = 0, step = Math.round(FREQ * TWO24 / sr), s = LFSR_INIT;
      for (var j = 0; j < 5000; j++) s = lfsrClock(s);   // skip the non-random warm-up
      var out = noiseOut(s);
      for (var i = 0; i < len; i++) {
        var prev = acc; acc = (acc + step) & 0xffffff;
        if (!(prev & 0x080000) && (acc & 0x080000)) { s = lfsrClock(s); out = noiseOut(s); }
        data[i] = (out / 4095 - 0.5) * 0.7;   // noise reads louder; trim it a little
      }
      return buf;
    }
    function stopSource() {
      if (!src) return;
      var old = src; src = null;
      try { old.stop(actx.currentTime + 0.03); } catch (e) {}
    }
    function setSource() {
      if (!amp) return;           // not playing
      if (src && wave !== "noise" && src.setPeriodicWave) { src.setPeriodicWave(periodic(wave)); return; }
      stopSource();
      if (wave === "noise") {
        noiseBuf = noiseBuf || buildNoise();
        // Playing the buffer faster or slower speeds up the LFSR clock with it,
        // just like raising the frequency register does on the chip.
        src = actx.createBufferSource(); src.buffer = noiseBuf; src.loop = true; src.playbackRate.value = freq / FREQ;
      } else {
        src = actx.createOscillator(); src.frequency.value = freq; src.setPeriodicWave(periodic(wave));
      }
      src.connect(amp); src.start();
    }

    volEl.addEventListener("input", function () {
      q("volVal").textContent = Math.round(parseFloat(volEl.value) * 100) + "%";
      if (amp) amp.gain.setTargetAtTime(gainFromVol(), actx.currentTime, 0.02);
    });
    q("play").addEventListener("click", function () {
      var btn = q("play");
      if (amp) {
        amp.gain.setTargetAtTime(0, actx.currentTime, 0.02);
        var a = amp, s = src; amp = null; src = null;
        setTimeout(function () { try { s.stop(); } catch (e) {} a.disconnect(); }, 150);
        btn.textContent = "Play"; btn.setAttribute("aria-pressed", "false");
        return;
      }
      try {
        actx = actx || new (window.AudioContext || window.webkitAudioContext)();
        actx.resume().then(function () {
          amp = actx.createGain(); amp.gain.value = 0; amp.connect(actx.destination);
          setSource();
          amp.gain.setTargetAtTime(gainFromVol(), actx.currentTime, 0.02);
          btn.textContent = "Stop"; btn.setAttribute("aria-pressed", "true");
        });
      } catch (e) { btn.textContent = "No sound"; btn.disabled = true; }
    });

    // ---------- slow cursor ----------
    var last = performance.now();
    function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      playhead = (playhead + dt * 0.15) % CYCLES;
      draw();
      requestAnimationFrame(frame);
    }

    if (window.ResizeObserver) new ResizeObserver(draw).observe(host);
    draw();
    if (!reduceMotion) requestAnimationFrame(frame);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountAll);
  else mountAll();
})();
