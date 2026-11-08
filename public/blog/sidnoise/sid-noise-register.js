/*
 * sid-noise-register.js — the SID's noise generator vs. ordinary noise
 *
 * Usage (anywhere in a page or blog post):
 *   <div data-sid-noise-register></div>
 *   <script src="sid-noise-register.js"></script>
 *
 * If no element with data-sid-noise-register exists, the demo is inserted
 * right after the <script> tag. No dependencies.
 *
 * Model (after reSID's wave.h): a 23-bit shift register, clocked each time bit 19
 * of the 24-bit phase accumulator goes high, i.e. 16 steps per oscillator cycle.
 * Feedback: bit0 = bit22 XOR bit17. Output: register bits 20,18,14,11,9,5,2,0 as
 * the top 8 bits of the waveform; the value holds between steps.
 */
(function () {
  "use strict";

  var script = document.currentScript;

  function mountAll() {
    var hosts = document.querySelectorAll("[data-sid-noise-register]:not([data-mounted])");
    if (!hosts.length && script) {
      var div = document.createElement("div");
      div.setAttribute("data-sid-noise-register", "");
      script.parentNode.insertBefore(div, script.nextSibling);
      hosts = [div];
    }
    for (var i = 0; i < hosts.length; i++) mount(hosts[i]);
  }

  // ---------- styles (scoped under .snr) ----------
  var CSS = [
    ".snr{--snr-bg:#f8f8fc;--snr-ink:#1c1940;--snr-muted:#5c5880;--snr-rule:#d4d1e6;--snr-accent:#40318d;--snr-soft:rgba(64,49,141,.12);--snr-warm:#a2512c;--snr-warm-soft:rgba(162,81,44,.14);",
    "font:15px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif;color:var(--snr-ink);background:var(--snr-bg);border:1px solid var(--snr-rule);border-radius:10px;padding:16px;display:grid;gap:16px;max-width:980px;margin:1.5em 0}",
    "@media (prefers-color-scheme:dark){.snr{--snr-bg:#1d1a4a;--snr-ink:#dcd8f7;--snr-muted:#9c97c8;--snr-rule:#322e66;--snr-accent:#8b80ee;--snr-soft:rgba(139,128,238,.16);--snr-warm:#e39268;--snr-warm-soft:rgba(227,146,104,.16)}}",
    ".snr *{box-sizing:border-box}",
    ".snr-sec{border-bottom:1px solid var(--snr-rule);padding-bottom:12px;display:grid;gap:6px}",
    ".snr-title{font:600 13px ui-monospace,'SF Mono',Menlo,monospace;color:var(--snr-muted);letter-spacing:.02em}",
    ".snr canvas{width:100%;display:block}",
    ".snr canvas.snr-time{height:260px}",
    ".snr canvas.snr-reg{height:112px}",
    ".snr-read{display:flex;flex-wrap:wrap;gap:6px 22px;font:13px ui-monospace,'SF Mono',Menlo,monospace;color:var(--snr-muted)}",
    ".snr-read strong{color:var(--snr-ink);font-weight:500;font-variant-numeric:tabular-nums}",
    ".snr-read .hi strong{color:var(--snr-accent)}",
    ".snr-row{display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center}",
    ".snr-row label{font-weight:600;font-size:17px}",
    ".snr-val{font:500 22px ui-monospace,'SF Mono',Menlo,monospace;font-variant-numeric:tabular-nums;color:var(--snr-accent);min-width:7ch;text-align:right}",
    ".snr input[type=range]{width:100%;min-width:0;accent-color:var(--snr-accent)}",
    ".snr-btns{display:flex;flex-wrap:wrap;gap:8px;align-items:center}",
    ".snr-btns span{font:12px ui-monospace,'SF Mono',Menlo,monospace;color:var(--snr-muted);margin-right:4px}",
    ".snr button{font:500 13px ui-monospace,'SF Mono',Menlo,monospace;color:var(--snr-ink);background:var(--snr-bg);border:1px solid var(--snr-rule);border-radius:999px;padding:6px 12px;cursor:pointer}",
    ".snr button:hover{border-color:var(--snr-accent)}",
    ".snr button:focus-visible,.snr input:focus-visible{outline:2px solid var(--snr-accent);outline-offset:2px}",
    ".snr button[aria-pressed=true]{background:var(--snr-accent);color:var(--snr-bg);border-color:var(--snr-accent)}",
    ".snr button.snr-white[aria-pressed=true]{background:var(--snr-warm);border-color:var(--snr-warm)}",
    ".snr-vol{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;max-width:420px}",
    ".snr-vlabel,.snr-small{font:13px ui-monospace,'SF Mono',Menlo,monospace;color:var(--snr-muted);font-variant-numeric:tabular-nums}",
    ".snr-note{font:12.5px ui-monospace,'SF Mono',Menlo,monospace;color:var(--snr-warm);min-height:1.4em}",
    "@media (max-width:600px){.snr canvas.snr-time{height:240px}.snr canvas.snr-reg{height:120px}}"
  ].join("\n");

  function injectCSS() {
    if (document.getElementById("snr-style")) return;
    var s = document.createElement("style");
    s.id = "snr-style";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  var HTML =
    '<div class="snr-sec">' +
    '  <div class="snr-title">4 ms of each signal</div>' +
    '  <canvas class="snr-time" role="img" aria-label="Ordinary noise compared with SID noise over 4 milliseconds"></canvas>' +
    '  <div class="snr-read">' +
    '    <span class="hi">SID steps <strong data-k="rate">3,520</strong> per second</span>' +
    '    <span>one step lasts <strong data-k="stepLen">284 µs</strong></span>' +
    '    <span>repeats after <strong data-k="repeat">40 min</strong></span>' +
    '    <span>dashed line = new cycle, every 16 steps</span>' +
    '  </div>' +
    '</div>' +
    '<div class="snr-row">' +
    '  <label>Pitch</label>' +
    '  <input data-k="freq" type="range" min="0" max="1" step="0.001" value="0.5" aria-label="Pitch">' +
    '  <span class="snr-val" data-k="freqVal">220 Hz</span>' +
    '</div>' +
    '<div class="snr-sec">' +
    '  <div class="snr-title">The 23-bit shift register</div>' +
    '  <canvas class="snr-reg" role="img" aria-label="The 23-bit noise shift register"></canvas>' +
    '  <div class="snr-btns">' +
    '    <button data-k="step">Step once</button>' +
    '    <button data-k="run" aria-pressed="false">Run slowly</button>' +
    '    <span class="snr-small" data-k="count">step 0</span>' +
    '  </div>' +
    '</div>' +
    '<div class="snr-btns">' +
    '  <span>listen</span>' +
    '  <button data-k="playSid" aria-pressed="false">SID noise</button>' +
    '  <button class="snr-white" data-k="playWhite" aria-pressed="false">Ordinary noise</button>' +
    '</div>' +
    '<div class="snr-vol">' +
    '  <span class="snr-vlabel">volume</span>' +
    '  <input data-k="vol" type="range" min="0" max="1" step="0.01" value="0.5" aria-label="Volume">' +
    '  <span class="snr-vlabel" data-k="volVal">50%</span>' +
    '</div>' +
    '<div class="snr-note" data-k="note" aria-live="polite"></div>';

  // ---------- the SID noise register ----------
  var OUT_BITS = [20, 18, 14, 11, 9, 5, 2, 0];   // -> output bits 7..0
  function stepReg(reg) {
    var bit0 = ((reg >>> 22) ^ (reg >>> 17)) & 1;
    return ((reg << 1) | bit0) & 0x7fffff;
  }
  function outByte(reg) {
    var v = 0;
    for (var i = 0; i < 8; i++) v = (v << 1) | ((reg >>> OUT_BITS[i]) & 1);
    return v;
  }
  // reSID resets the register to all ones; run it a while so the demo starts mid-sequence.
  function warmReg() { var r = 0x7fffff; for (var i = 0; i < 4000; i++) r = stepReg(r); return r; }

  // deterministic "ordinary noise" for the drawing, so it doesn't flicker on redraw
  function hashNoise(i) { var x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return (x - Math.floor(x)) * 2 - 1; }

  function mount(host) {
    injectCSS();
    host.setAttribute("data-mounted", "");
    host.classList.add("snr");
    host.innerHTML = HTML;

    var q = function (k) { return host.querySelector('[data-k="' + k + '"]'); };
    var cTime = host.querySelector("canvas.snr-time"), cReg = host.querySelector("canvas.snr-reg");
    var freqEl = q("freq");
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var SR_DRAW = 48000, WINDOW = 0.004;          // the drawing shows 4 ms at 48 kHz
    var REG0 = warmReg();
    var stepIdx = 0, reg = REG0, runOn = false, runAcc = 0;
    var C = {};
    function readColors() {
      var s = getComputedStyle(host);
      ["ink", "muted", "rule", "accent", "soft", "warm", "warm-soft"].forEach(function (k) { C[k] = s.getPropertyValue("--snr-" + k).trim(); });
    }
    readColors();
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () { readColors(); drawAll(); });

    function mono(px) { return px + "px ui-monospace, 'SF Mono', Menlo, monospace"; }
    function freq() { return 55 * Math.pow(2, parseFloat(freqEl.value) * 4); } // 55..880 Hz
    function stepRate() { return 16 * freq(); }

    function sizeCanvas(cv) {
      var dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
      if (!w || !h) return null;
      if (cv.width !== Math.round(w * dpr)) cv.width = Math.round(w * dpr);
      if (cv.height !== Math.round(h * dpr)) cv.height = Math.round(h * dpr);
      var ctx = cv.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      return { ctx: ctx, w: w, h: h };
    }

    // values of the SID staircase for the first N steps from REG0
    function sidSteps(n) {
      var out = [], r = REG0;
      for (var i = 0; i < n; i++) { out.push(outByte(r) / 127.5 - 1); r = stepReg(r); }
      return out;
    }

    function drawTime() {
      var c = sizeCanvas(cTime); if (!c) return;
      var ctx = c.ctx, w = c.w, h = c.h;
      var narrow = w < 560;
      // wide: labels in a left column; narrow: one-line label above each lane
      var padL = narrow ? 4 : 132, padR = 8, labH = narrow ? 18 : 0, axisH = 18;
      var laneH = (h - axisH - 12 - 2 * labH) / 2;
      var lanes = [
        { y0: labH, label: ["ordinary noise", "new value", "every sample"], color: C.warm },
        { y0: labH * 2 + laneH + 12, label: ["SID noise", "new value", "16× per cycle"], color: C.accent }
      ];
      var tx = function (t) { return padL + (t / WINDOW) * (w - padL - padR); };

      lanes.forEach(function (L, li) {
        var mid = L.y0 + laneH / 2, amp = laneH / 2 - 6;
        if (narrow) {
          ctx.textAlign = "left"; ctx.textBaseline = "bottom";
          ctx.fillStyle = L.color; ctx.font = "600 " + mono(12);
          ctx.fillText(L.label[0], padL, L.y0 - 3);
          var lw = ctx.measureText(L.label[0]).width;
          ctx.fillStyle = C.muted; ctx.font = mono(11);
          ctx.fillText(" · " + L.label[1] + " " + L.label[2], padL + lw, L.y0 - 3);
        } else {
          ctx.textAlign = "right"; ctx.textBaseline = "middle";
          ctx.fillStyle = L.color; ctx.font = "600 " + mono(12);
          ctx.fillText(L.label[0], padL - 14, mid - 14);
          ctx.fillStyle = C.muted; ctx.font = mono(11);
          ctx.fillText(L.label[1], padL - 14, mid + 2); ctx.fillText(L.label[2], padL - 14, mid + 16);
        }
        ctx.strokeStyle = C.rule; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(padL, mid); ctx.lineTo(w - padR, mid); ctx.stroke();

        ctx.strokeStyle = L.color; ctx.lineWidth = li ? 2.2 : 1.1;
        ctx.beginPath();
        if (li === 0) {
          var N = Math.round(SR_DRAW * WINDOW);
          for (var i = 0; i <= N; i++) {
            var y = mid - hashNoise(i) * amp * 0.95, x = tx(i / SR_DRAW);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
        } else {
          var dt = 1 / stepRate(), n = Math.ceil(WINDOW / dt) + 1, vals = sidSteps(n);
          // oscillator-cycle boundaries every 16 steps
          ctx.save(); ctx.strokeStyle = C.muted; ctx.globalAlpha = 0.7; ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
          for (var k = 0; k * 16 * dt <= WINDOW; k++) { var xb = tx(k * 16 * dt); ctx.beginPath(); ctx.moveTo(xb, L.y0); ctx.lineTo(xb, L.y0 + laneH); ctx.stroke(); }
          ctx.restore();
          // highlight the step the register is on (Step once / Run slowly)
          if (stepIdx < n) {
            var xa = tx(stepIdx * dt), xb2 = Math.min(tx((stepIdx + 1) * dt), w - padR);
            if (xa < w - padR) { ctx.fillStyle = C.soft; ctx.fillRect(xa, L.y0, Math.max(2, xb2 - xa), laneH); }
          }
          ctx.strokeStyle = L.color; ctx.beginPath();
          for (var s = 0; s < n; s++) {
            var t0 = s * dt, t1 = Math.min((s + 1) * dt, WINDOW);
            if (t0 > WINDOW) break;
            var ys = mid - vals[s] * amp;
            if (s === 0) ctx.moveTo(tx(t0), ys); else ctx.lineTo(tx(t0), ys);
            ctx.lineTo(tx(t1), ys);
          }
          ctx.stroke();
        }
      });
      // time axis, plus the length of one oscillator cycle
      var axY = h - axisH + 4, ticks = narrow ? [0, 2, 4] : [0, 1, 2, 3, 4];
      ctx.fillStyle = C.muted; ctx.font = mono(11); ctx.textBaseline = "top";
      ticks.forEach(function (ms, i) {
        ctx.textAlign = i === 0 ? "left" : i === ticks.length - 1 ? "right" : "center";
        ctx.fillText(ms + " ms", tx(ms / 1000), axY);
      });
    }

    function drawReg() {
      var c = sizeCanvas(cReg); if (!c) return;
      var ctx = c.ctx, w = c.w, h = c.h;
      var cells = 23, padX = 8, cellW = (w - 2 * padX) / cells, top = 34, cellH = Math.min(30, cellW * 1.15);
      var outSet = {}; OUT_BITS.forEach(function (b, i) { outSet[b] = 7 - i; });
      var fbBit = ((reg >>> 22) ^ (reg >>> 17)) & 1;

      for (var i = 0; i < cells; i++) {
        var bit = 22 - i, x = padX + i * cellW, v = (reg >>> bit) & 1, isOut = bit in outSet;
        ctx.fillStyle = isOut ? C.soft : "transparent";
        ctx.fillRect(x + 1, top, cellW - 2, cellH);
        ctx.strokeStyle = isOut ? C.accent : C.rule; ctx.lineWidth = isOut ? 1.6 : 1;
        ctx.strokeRect(x + 1, top, cellW - 2, cellH);
        ctx.fillStyle = v ? C.ink : C.muted; ctx.font = (v ? "600 " : "") + mono(Math.max(10, Math.min(15, cellW * 0.5)));
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(String(v), x + cellW / 2, top + cellH / 2);
        if (cellW > 18 || bit % 2 === 0) {
          ctx.fillStyle = C.muted; ctx.font = mono(Math.max(9, Math.min(11, cellW * 0.38))); ctx.textBaseline = "top";
          ctx.fillText(String(bit), x + cellW / 2, top + cellH + 4);
        }
        if (bit === 22 || bit === 17) {
          ctx.fillStyle = C.warm; ctx.font = "600 " + mono(11); ctx.textBaseline = "bottom";
          ctx.fillText("⊕", x + cellW / 2, top - 4);
        }
      }
      // feedback label + new bit going into bit 0
      ctx.fillStyle = C.warm; ctx.font = mono(11); ctx.textBaseline = "bottom"; ctx.textAlign = "left";
      ctx.fillText(w < 560 ? "22 ⊕ 17 = " + fbBit + " → next bit 0" : "bit 22 ⊕ bit 17 = " + fbBit + "  → shifts into bit 0 on the next step", padX, 14);

      // output value
      var ob = outByte(reg);
      ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.font = mono(12);
      var y = top + cellH + 22;
      ctx.fillStyle = C.accent;
      var bin = ob.toString(2).padStart(8, "0");
      if (w < 560) {
        ctx.fillText("output bits 20 18 14 11 9 5 2 0", padX, y);
        ctx.fillText("→ " + bin + " = " + ob + " / 255", padX, y + 16);
      } else {
        ctx.fillText("output = bits 20 18 14 11 9 5 2 0 → " + bin + " = " + ob + " / 255", padX, y);
      }
      q("count").textContent = "step " + stepIdx;
    }

    function drawAll() { drawTime(); drawReg(); }

    function fmtInt(n) { return Math.round(n).toLocaleString("en-US"); }
    function updateText() {
      var f = freq(), rate = stepRate();
      q("freqVal").textContent = Math.round(f) + " Hz";
      q("rate").textContent = fmtInt(rate);
      q("stepLen").textContent = Math.round(1e6 / rate) + " µs";
      var secs = 8388607 / rate;
      q("repeat").textContent = secs >= 3600 ? (secs / 3600).toFixed(1) + " h" : secs >= 60 ? Math.round(secs / 60) + " min" : Math.round(secs) + " s";
    }

    function advance() {
      reg = stepReg(reg); stepIdx++;
      var n = Math.ceil(WINDOW * stepRate());
      if (stepIdx >= n) { stepIdx = 0; reg = REG0; }   // wrap back to the start of the drawn window
      drawAll();
    }
    q("step").addEventListener("click", function () { runOff(); advance(); });
    function runOff() { if (runOn) { runOn = false; q("run").setAttribute("aria-pressed", "false"); } }
    q("run").addEventListener("click", function () {
      runOn = !runOn; q("run").setAttribute("aria-pressed", String(runOn));
    });

    freqEl.addEventListener("input", function () {
      updateText();
      var n = Math.ceil(WINDOW * stepRate());
      if (stepIdx >= n) { stepIdx = 0; reg = REG0; }
      drawAll();
      if (playing === "sid") restartSource();
    });

    // ---------- sound ----------
    var actx = null, src = null, amp = null, playing = null;
    // Same hard ceiling as the other demos: about -36 dBFS at 100%.
    var MAX_GAIN = 0.015, volEl = q("vol");
    function gainFromVol() { var v = parseFloat(volEl.value); return MAX_GAIN * v * v; } // squared = smoother taper
    volEl.addEventListener("input", function () {
      q("volVal").textContent = Math.round(parseFloat(volEl.value) * 100) + "%";
      if (amp) amp.gain.setTargetAtTime(playing ? gainFromVol() : 0, actx.currentTime, 0.02);
    });

    function makeBuffer(kind) {
      var sr = actx.sampleRate, len = Math.round(sr * 2), buf = actx.createBuffer(1, len, sr), d = buf.getChannelData(0);
      if (kind === "white") { for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; return buf; }
      var r = REG0, ph = 0, inc = stepRate() / sr, val = outByte(r) / 127.5 - 1;
      for (var j = 0; j < len; j++) {
        d[j] = val;
        ph += inc;
        while (ph >= 1) { ph -= 1; r = stepReg(r); val = outByte(r) / 127.5 - 1; }
      }
      return buf;
    }
    function startSource() {
      src = actx.createBufferSource();
      src.buffer = makeBuffer(playing);
      src.loop = true; src.connect(amp); src.start();
    }
    function restartSource() {
      if (!src) return;
      var old = src; startSource();
      setTimeout(function () { try { old.stop(); } catch (e) {} }, 30);
    }
    function stopSound() {
      if (!src) return;
      amp.gain.setTargetAtTime(0, actx.currentTime, 0.02);
      var o = src; src = null; setTimeout(function () { try { o.stop(); } catch (e) {} }, 150);
      playing = null;
      q("playSid").setAttribute("aria-pressed", "false"); q("playWhite").setAttribute("aria-pressed", "false");
    }
    function play(kind) {
      if (playing === kind) { stopSound(); return; }
      try {
        actx = actx || new (window.AudioContext || window.webkitAudioContext)();
        actx.resume().then(function () {
          if (!amp) { amp = actx.createGain(); amp.gain.value = 0; amp.connect(actx.destination); }
          var was = playing; playing = kind;
          if (src && was) restartSource(); else startSource();
          amp.gain.setTargetAtTime(gainFromVol(), actx.currentTime, 0.02);
          q("playSid").setAttribute("aria-pressed", String(kind === "sid"));
          q("playWhite").setAttribute("aria-pressed", String(kind === "white"));
          q("note").textContent = kind === "sid" ? "Move the pitch slider: the noise changes colour with it." : "";
        });
      } catch (e) { q("note").textContent = "Sound could not start in this browser."; }
    }
    q("playSid").addEventListener("click", function () { play("sid"); });
    q("playWhite").addEventListener("click", function () { play("white"); });

    var last = performance.now();
    function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (runOn) { runAcc += dt; if (runAcc >= 0.35) { runAcc = 0; advance(); } }
      requestAnimationFrame(frame);
    }

    if (window.ResizeObserver) new ResizeObserver(drawAll).observe(host);
    updateText(); drawAll();
    requestAnimationFrame(frame);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountAll);
  else mountAll();
})();
