/*
 * sid-noise-clock.js — scrub through the SID's phase accumulator and watch the
 * noise shift register step.
 *
 * Usage (anywhere in a page or blog post):
 *   <div data-sid-noise-clock></div>
 *   <script src="sid-noise-clock.js"></script>
 *
 * If no element with data-sid-noise-clock exists, the demo is inserted right
 * after the <script> tag. No dependencies.
 *
 * Model (after reSID's wave.h): every chip clock (985,248 Hz on a PAL C64) the
 * 24-bit accumulator adds the voice's frequency value. Each time accumulator
 * bit 19 goes from 0 to 1, the 23-bit noise register shifts once:
 *   bit0 = bit22 XOR bit17;  reg = (reg << 1 | bit0) & 0x7fffff
 * Output = register bits 20,18,14,11,9,5,2,0, held between steps.
 */
(function () {
  "use strict";

  var script = document.currentScript;

  function mountAll() {
    var hosts = document.querySelectorAll("[data-sid-noise-clock]:not([data-mounted])");
    if (!hosts.length && script) {
      var div = document.createElement("div");
      div.setAttribute("data-sid-noise-clock", "");
      script.parentNode.insertBefore(div, script.nextSibling);
      hosts = [div];
    }
    for (var i = 0; i < hosts.length; i++) mount(hosts[i]);
  }

  // ---------- styles (scoped under .snc) ----------
  var CSS = [
    ".snc{--snc-bg:#f8f8fc;--snc-ink:#1c1940;--snc-muted:#5c5880;--snc-rule:#d4d1e6;--snc-accent:#40318d;--snc-soft:rgba(64,49,141,.12);--snc-warm:#a2512c;--snc-warm-soft:rgba(162,81,44,.14);",
    "font:15px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif;color:var(--snc-ink);background:var(--snc-bg);border:1px solid var(--snc-rule);border-radius:10px;padding:16px;display:grid;gap:16px;max-width:980px;margin:1.5em 0}",
    "@media (prefers-color-scheme:dark){.snc{--snc-bg:#1d1a4a;--snc-ink:#dcd8f7;--snc-muted:#9c97c8;--snc-rule:#322e66;--snc-accent:#8b80ee;--snc-soft:rgba(139,128,238,.16);--snc-warm:#e39268;--snc-warm-soft:rgba(227,146,104,.16)}}",
    ".snc *{box-sizing:border-box}",
    ".snc-sec{border-bottom:1px solid var(--snc-rule);padding-bottom:12px;display:grid;gap:6px}",
    ".snc-sec:last-child{border-bottom:0;padding-bottom:0}",
    ".snc-title{font:600 13px ui-monospace,'SF Mono',Menlo,monospace;color:var(--snc-muted);letter-spacing:.02em}",
    ".snc canvas{width:100%;display:block}",
    ".snc canvas.snc-acc{height:90px}",
    ".snc canvas.snc-line{height:150px}",
    ".snc canvas.snc-reg{height:96px}",
    ".snc-read{display:flex;flex-wrap:wrap;gap:6px 22px;font:13px ui-monospace,'SF Mono',Menlo,monospace;color:var(--snc-muted)}",
    ".snc-read strong{color:var(--snc-ink);font-weight:500;font-variant-numeric:tabular-nums}",
    ".snc-read .hi strong{color:var(--snc-accent)}",
    ".snc-row{display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:center}",
    ".snc-row label{font-weight:600;font-size:17px}",
    ".snc input[type=range]{width:100%;min-width:0;accent-color:var(--snc-accent)}",
    ".snc-btns{display:flex;flex-wrap:wrap;gap:8px;align-items:center}",
    ".snc button{font:500 13px ui-monospace,'SF Mono',Menlo,monospace;color:var(--snc-ink);background:var(--snc-bg);border:1px solid var(--snc-rule);border-radius:999px;padding:6px 12px;cursor:pointer}",
    ".snc button:hover{border-color:var(--snc-accent)}",
    ".snc button:focus-visible,.snc input:focus-visible{outline:2px solid var(--snc-accent);outline-offset:2px}",
    ".snc-event{font:13px ui-monospace,'SF Mono',Menlo,monospace;color:var(--snc-warm);min-height:1.5em}",
    "@media (max-width:600px){.snc canvas.snc-acc{height:84px}.snc canvas.snc-reg{height:112px}}"
  ].join("\n");

  function injectCSS() {
    if (document.getElementById("snc-style")) return;
    var s = document.createElement("style");
    s.id = "snc-style";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  var HTML =
    '<div class="snc-sec">' +
    '  <div class="snc-title">Phase accumulator (24 bits)</div>' +
    '  <canvas class="snc-acc" role="img" aria-label="The 24-bit phase accumulator"></canvas>' +
    '  <div class="snc-read">' +
    '    <span>adds <strong data-k="fval">3,746</strong> every clock</span>' +
    '    <span>clock <strong data-k="tick">0</strong></span>' +
    '    <span class="hi">cycle <strong data-k="cyc">1</strong>, <strong data-k="pct">0%</strong> through</span>' +
    '  </div>' +
    '</div>' +
    '<div class="snc-sec">' +
    '  <div class="snc-title">Two cycles at 220 Hz</div>' +
    '  <canvas class="snc-line" role="img" aria-label="Bit 19 and the noise output over two cycles"></canvas>' +
    '  <div class="snc-row">' +
    '    <label>Time</label>' +
    '    <input data-k="pos" type="range" min="0" max="8957" step="1" value="0" aria-label="Clock ticks">' +
    '  </div>' +
    '  <div class="snc-btns">' +
    '    <button data-k="prev">◀ previous step</button>' +
    '    <button data-k="next">next step ▶</button>' +
    '  </div>' +
    '  <div class="snc-event" data-k="event" aria-live="polite"></div>' +
    '</div>' +
    '<div class="snc-sec">' +
    '  <div class="snc-title">Noise shift register (23 bits)</div>' +
    '  <canvas class="snc-reg" role="img" aria-label="The 23-bit noise shift register"></canvas>' +
    '  <div class="snc-read">' +
    '    <span class="hi">steps so far <strong data-k="steps">0</strong></span>' +
    '    <span>output <strong data-k="out">0</strong> / 255</span>' +
    '  </div>' +
    '</div>';

  // ---------- the chip ----------
  var CLOCK = 985248;                        // PAL C64
  var NOTE = 220;
  var F = Math.round(NOTE * 16777216 / CLOCK); // frequency register value: 3746
  var ACC = 16777216, B19 = 524288, B20 = 1048576;
  var CYCLES = 2, MAX_TICK = Math.floor(CYCLES * ACC / F);
  var OUT_BITS = [20, 18, 14, 11, 9, 5, 2, 0];

  function stepReg(reg) {
    var bit0 = ((reg >>> 22) ^ (reg >>> 17)) & 1;
    return ((reg << 1) | bit0) & 0x7fffff;
  }
  function outByte(reg) {
    var v = 0;
    for (var i = 0; i < 8; i++) v = (v << 1) | ((reg >>> OUT_BITS[i]) & 1);
    return v;
  }
  // start mid-sequence (reSID resets the register to all ones)
  var REG0 = (function () { var r = 0x7fffff; for (var i = 0; i < 4000; i++) r = stepReg(r); return r; })();
  var MAX_STEPS = Math.floor((CYCLES * ACC + B19) / B20) + 1;
  var REGS = [REG0];
  for (var s = 1; s <= MAX_STEPS; s++) REGS.push(stepReg(REGS[s - 1]));

  // steps taken after `total` accumulator units (not wrapped): one per 0->1 edge of bit 19,
  // and bit 19 first goes high at 2^19, then every 2^20.
  function stepsAt(total) { return Math.floor((total + B19) / B20); }
  // first clock tick at which the k-th step (1-based) has happened
  function tickOfStep(k) { return Math.ceil(((2 * k - 1) * B19) / F); }

  function mount(host) {
    injectCSS();
    host.setAttribute("data-mounted", "");
    host.classList.add("snc");
    host.innerHTML = HTML;

    var q = function (k) { return host.querySelector('[data-k="' + k + '"]'); };
    var cAcc = host.querySelector("canvas.snc-acc"), cLine = host.querySelector("canvas.snc-line"), cReg = host.querySelector("canvas.snc-reg");
    var posEl = q("pos");
    posEl.max = String(MAX_TICK);
    q("fval").textContent = F.toLocaleString("en-US");

    var C = {};
    function readColors() {
      var st = getComputedStyle(host);
      ["ink", "muted", "rule", "accent", "soft", "warm", "warm-soft"].forEach(function (k) { C[k] = st.getPropertyValue("--snc-" + k).trim(); });
    }
    readColors();
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () { readColors(); drawAll(); });

    function mono(px) { return px + "px ui-monospace, 'SF Mono', Menlo, monospace"; }
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

    function state() {
      var tick = parseInt(posEl.value, 10), total = tick * F;
      var steps = stepsAt(total);
      return { tick: tick, total: total, acc: total % ACC, cycle: Math.floor(total / ACC), steps: steps, reg: REGS[steps] };
    }

    // a row of bit cells, most significant first
    function drawCells(ctx, x0, y, cellW, cellH, n, value, style) {
      for (var i = 0; i < n; i++) {
        var bit = n - 1 - i, x = x0 + i * cellW, v = Math.floor(value / Math.pow(2, bit)) % 2;
        var s = style(bit);
        ctx.fillStyle = s.fill || "transparent";
        ctx.fillRect(x + 1, y, cellW - 2, cellH);
        ctx.strokeStyle = s.stroke || C.rule; ctx.lineWidth = s.lw || 1;
        ctx.strokeRect(x + 1, y, cellW - 2, cellH);
        ctx.fillStyle = v ? (s.ink || C.ink) : C.muted;
        ctx.font = (v ? "600 " : "") + mono(Math.max(10, Math.min(15, cellW * 0.5)));
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(String(v), x + cellW / 2, y + cellH / 2 + 1);
        if (cellW > 18 || bit % 2 === 0 || s.label) {
          ctx.fillStyle = s.label ? (s.stroke || C.muted) : C.muted;
          ctx.font = (s.label ? "600 " : "") + mono(Math.max(9, Math.min(11, cellW * 0.38)));
          ctx.textBaseline = "top";
          ctx.fillText(String(bit), x + cellW / 2, y + cellH + 4);
        }
      }
    }

    function drawAcc(S) {
      var c = sizeCanvas(cAcc); if (!c) return;
      var ctx = c.ctx, w = c.w, padX = 2, n = 24, cellW = (w - 2 * padX) / n, top = 26, cellH = Math.min(30, cellW * 1.15);
      var narrow = w < 560;
      // brackets: top 4 bits = which sixteenth of the cycle; bit 19 = noise clock
      ctx.font = mono(11); ctx.textBaseline = "bottom";
      var xOf = function (bit) { return padX + (n - 1 - bit) * cellW; };
      ctx.strokeStyle = C.accent; ctx.fillStyle = C.accent; ctx.lineWidth = 1;
      var a0 = xOf(23) + 2, a1 = xOf(20) + cellW - 2;
      ctx.beginPath(); ctx.moveTo(a0, top - 4); ctx.lineTo(a0, top - 8); ctx.lineTo(a1, top - 8); ctx.lineTo(a1, top - 4); ctx.stroke();
      ctx.textAlign = "left";
      ctx.fillText(narrow ? "16ths" : "which 16th", a0, top - 10);
      ctx.fillStyle = C.warm; ctx.textAlign = "center";
      ctx.fillText(narrow ? "↓" : "noise clock ↓", xOf(19) + cellW / 2, top - 10);

      drawCells(ctx, padX, top, cellW, cellH, n, S.acc, function (bit) {
        if (bit === 19) return { fill: C["warm-soft"], stroke: C.warm, lw: 1.8, ink: C.warm, label: true };
        if (bit >= 20) return { fill: C.soft, stroke: C.accent, lw: 1.2 };
        return {};
      });

      var sixteenth = Math.floor(S.acc / B20);
      ctx.fillStyle = C.muted; ctx.font = mono(12); ctx.textAlign = "left"; ctx.textBaseline = "top";
      var y = top + cellH + 22;
      var hex = "0x" + S.acc.toString(16).toUpperCase().padStart(6, "0");
      ctx.fillText(narrow ? hex + " · 16th #" + (sixteenth + 1) : "value " + hex + " = " + S.acc.toLocaleString("en-US") + " of 16,777,216 · in 16th #" + (sixteenth + 1), padX + 2, y);
    }

    function drawLine(S) {
      var c = sizeCanvas(cLine); if (!c) return;
      var ctx = c.ctx, w = c.w, h = c.h, narrow = w < 560;
      var padL = narrow ? 4 : 110, padR = 6;
      var total = CYCLES * ACC;
      var tx = function (u) { return padL + (u / total) * (w - padL - padR); };
      var r1 = { y0: narrow ? 16 : 6, h: 34 }, r2 = { y0: narrow ? 74 : 54, h: narrow ? 52 : 70 };

      // labels
      ctx.font = "600 " + mono(12); ctx.textBaseline = narrow ? "bottom" : "middle";
      if (narrow) {
        ctx.textAlign = "left";
        ctx.fillStyle = C.warm; ctx.fillText("bit 19", padL, r1.y0 - 2);
        ctx.fillStyle = C.accent; ctx.fillText("noise output", padL, r2.y0 - 2);
      } else {
        ctx.textAlign = "right";
        ctx.fillStyle = C.warm; ctx.fillText("bit 19", padL - 14, r1.y0 + r1.h / 2);
        ctx.fillStyle = C.accent; ctx.fillText("noise output", padL - 14, r2.y0 + r2.h / 2);
      }

      // cycle boundaries
      ctx.save(); ctx.strokeStyle = C.muted; ctx.globalAlpha = 0.6; ctx.setLineDash([3, 3]);
      for (var k = 0; k <= CYCLES; k++) {
        var xb = tx(k * ACC); ctx.beginPath(); ctx.moveTo(xb, r1.y0); ctx.lineTo(xb, r2.y0 + r2.h); ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = C.muted; ctx.font = mono(11); ctx.textBaseline = "top";
      for (k = 0; k < CYCLES; k++) {
        ctx.textAlign = "center";
        ctx.fillText("cycle " + (k + 1), (tx(k * ACC) + tx((k + 1) * ACC)) / 2, h - 16);
      }

      // bit 19 square wave + rising-edge dots
      var hi = r1.y0 + 4, lo = r1.y0 + r1.h - 4, half = B19;
      ctx.strokeStyle = C.warm; ctx.lineWidth = 1.5; ctx.beginPath();
      ctx.moveTo(tx(0), lo);
      for (var u = half; u <= total; u += half) {
        var on = Math.floor((u - 1) / half) % 2 === 1;   // level just before u
        var yPrev = on ? hi : lo, yNext = on ? lo : hi;
        ctx.lineTo(tx(u), yPrev); if (u < total) ctx.lineTo(tx(u), yNext);
      }
      ctx.stroke();

      // noise staircase: solid up to the playhead, faint after
      var amp = r2.h / 2 - 4, mid = r2.y0 + r2.h / 2;
      var yOf = function (s) { return mid - (outByte(REGS[s]) / 127.5 - 1) * amp; };
      function stair(from, to) {
        ctx.beginPath();
        var s = stepsAt(from);
        ctx.moveTo(tx(from), yOf(s));
        while (true) {
          var edge = (2 * (s + 1) - 1) * B19;      // where step s+1 happens
          if (edge >= to) { ctx.lineTo(tx(to), yOf(s)); break; }
          ctx.lineTo(tx(edge), yOf(s)); s++; ctx.lineTo(tx(edge), yOf(s));
        }
        ctx.stroke();
      }
      ctx.lineWidth = 2;
      ctx.strokeStyle = C.rule; stair(Math.max(0, S.total), total);
      ctx.strokeStyle = C.accent; if (S.total > 0) stair(0, S.total);

      // rising-edge markers: filled = already happened
      for (var e = 1; (2 * e - 1) * B19 <= total; e++) {
        var xe = tx((2 * e - 1) * B19), done = e <= S.steps;
        ctx.beginPath(); ctx.arc(xe, hi - 0.5, done ? 2.6 : 2.2, 0, Math.PI * 2);
        ctx.fillStyle = done ? C.warm : C.bg || "transparent";
        if (done) ctx.fill(); else { ctx.strokeStyle = C.warm; ctx.lineWidth = 1; ctx.stroke(); }
      }

      // playhead
      var xp = tx(S.total);
      ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(xp, r1.y0 - 2); ctx.lineTo(xp, r2.y0 + r2.h + 2); ctx.stroke();
    }

    function drawReg(S) {
      var c = sizeCanvas(cReg); if (!c) return;
      var ctx = c.ctx, w = c.w, narrow = w < 560, reg = S.reg;
      var padX = 2, n = 23, cellW = (w - 2 * padX) / n, top = 30, cellH = Math.min(30, cellW * 1.15);
      var outSet = {}; OUT_BITS.forEach(function (b) { outSet[b] = 1; });
      var fb = ((reg >>> 22) ^ (reg >>> 17)) & 1;
      var xOf = function (bit) { return padX + (n - 1 - bit) * cellW; };

      ctx.fillStyle = C.warm; ctx.font = "600 " + mono(11); ctx.textAlign = "center"; ctx.textBaseline = "bottom";
      ctx.fillText("⊕", xOf(22) + cellW / 2, top - 3); ctx.fillText("⊕", xOf(17) + cellW / 2, top - 3);
      ctx.font = mono(11); ctx.textAlign = "left";
      var fx = xOf(17) + cellW + 4;
      ctx.fillText(narrow ? "= " + fb + " → bit 0 next" : "bit 22 ⊕ bit 17 = " + fb + " → becomes bit 0 at the next step", fx, top - 3);

      drawCells(ctx, padX, top, cellW, cellH, n, reg, function (bit) {
        return outSet[bit] ? { fill: C.soft, stroke: C.accent, lw: 1.6 } : {};
      });

      var ob = outByte(reg), bin = ob.toString(2).padStart(8, "0");
      ctx.fillStyle = C.accent; ctx.font = mono(12); ctx.textAlign = "left"; ctx.textBaseline = "top";
      var y = top + cellH + 22;
      if (narrow) {
        ctx.fillText("output bits 20 18 14 11 9 5 2 0", padX + 2, y);
        ctx.fillText("→ " + bin + " = " + ob + " / 255", padX + 2, y + 16);
      } else {
        ctx.fillText("output = bits 20 18 14 11 9 5 2 0 → " + bin + " = " + ob + " / 255", padX + 2, y);
      }
    }

    var lastSteps = 0;
    function drawAll() {
      var S = state();
      drawAcc(S); drawLine(S); drawReg(S);
      q("tick").textContent = S.tick.toLocaleString("en-US");
      q("cyc").textContent = String(Math.min(CYCLES, S.cycle + 1));
      q("pct").textContent = Math.floor((S.acc / ACC) * 100) + "%";
      q("steps").textContent = String(S.steps);
      q("out").textContent = String(outByte(S.reg));
      var ev = "";
      if (S.steps !== lastSteps) {
        var ticks = Math.abs(S.steps - lastSteps);
        ev = ticks === 1
          ? (S.steps > lastSteps ? "bit 19 went 0 → 1: the register shifted once" : "back before that step: the register is one step earlier")
          : "the register moved " + ticks + " steps";
      } else if (S.tick > 0 && S.acc < F) {
        ev = "the accumulator wrapped: a new cycle starts, but the register just carries on";
      }
      if (ev) q("event").textContent = ev;
      lastSteps = S.steps;
    }

    posEl.addEventListener("input", drawAll);
    q("next").addEventListener("click", function () {
      var S = state(), t = tickOfStep(S.steps + 1);
      posEl.value = String(Math.min(MAX_TICK, t)); drawAll();
    });
    q("prev").addEventListener("click", function () {
      var S = state();
      // if we're exactly on a step, go to the one before it
      var k = (S.steps > 0 && tickOfStep(S.steps) === S.tick) ? S.steps - 1 : S.steps;
      posEl.value = String(k > 0 ? tickOfStep(k) : 0); drawAll();
    });

    if (window.ResizeObserver) new ResizeObserver(drawAll).observe(host);
    drawAll();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountAll);
  else mountAll();
})();
