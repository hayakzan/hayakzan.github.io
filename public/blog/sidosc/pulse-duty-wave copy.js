/*
 * pulse-duty-wave.js — interactive pulse wave / duty cycle demo
 *
 * Usage (anywhere in a page or blog post):
 *   <div data-pulse-duty-wave></div>
 *   <script src="pulse-duty-wave.js"></script>
 *
 * If no element with data-pulse-duty-wave exists, the demo is inserted
 * right after the <script> tag. No dependencies.
 *
 * Convention: each cycle starts low and switches high for the last
 * `duty` fraction of the cycle (the same order as the C64 SID).
 */
(function () {
  "use strict";

  var script = document.currentScript;

  function mountAll() {
    var hosts = document.querySelectorAll("[data-pulse-duty-wave]:not([data-mounted])");
    if (!hosts.length && script) {
      var div = document.createElement("div");
      div.setAttribute("data-pulse-duty-wave", "");
      script.parentNode.insertBefore(div, script.nextSibling);
      hosts = [div];
    }
    for (var i = 0; i < hosts.length; i++) mount(hosts[i]);
  }

  // ---------- styles (scoped under .pdw) ----------
  var CSS = [
    ".pdw{--pdw-bg:#f8f8fc;--pdw-ink:#1c1940;--pdw-muted:#5c5880;--pdw-rule:#d4d1e6;--pdw-accent:#40318d;--pdw-soft:rgba(64,49,141,.12);--pdw-warn:#a2512c;",
    "font:15px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif;color:var(--pdw-ink);background:var(--pdw-bg);border:1px solid var(--pdw-rule);border-radius:10px;padding:16px;display:grid;gap:16px;max-width:980px;margin:1.5em 0}",
    "@media (prefers-color-scheme:dark){.pdw{--pdw-bg:#1d1a4a;--pdw-ink:#dcd8f7;--pdw-muted:#9c97c8;--pdw-rule:#322e66;--pdw-accent:#8b80ee;--pdw-soft:rgba(139,128,238,.16);--pdw-warn:#e39268}}",
    ".pdw *{box-sizing:border-box}",
    ".pdw-scope{border-bottom:1px solid var(--pdw-rule);padding-bottom:12px;display:grid;gap:8px}",
    ".pdw canvas{width:100%;height:230px;display:block}",
    ".pdw-read{display:flex;flex-wrap:wrap;gap:6px 22px;font:13px ui-monospace,'SF Mono',Menlo,monospace;color:var(--pdw-muted)}",
    ".pdw-read strong{color:var(--pdw-ink);font-weight:500;font-variant-numeric:tabular-nums}",
    ".pdw-read .hi strong{color:var(--pdw-accent)}",
    ".pdw-note{font:12.5px ui-monospace,'SF Mono',Menlo,monospace;color:var(--pdw-warn);min-height:1.4em}",
    ".pdw-row{display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center}",
    ".pdw-row label{font-weight:600;font-size:17px}",
    ".pdw-val{font:500 22px ui-monospace,'SF Mono',Menlo,monospace;font-variant-numeric:tabular-nums;color:var(--pdw-accent);min-width:5.2ch;text-align:right}",
    ".pdw input[type=range]{width:100%;min-width:0;accent-color:var(--pdw-accent)}",
    ".pdw-chips{display:flex;flex-wrap:wrap;gap:8px;align-items:center}",
    ".pdw-chips span{font:12px ui-monospace,'SF Mono',Menlo,monospace;color:var(--pdw-muted);margin-right:4px}",
    ".pdw button{font:500 13px ui-monospace,'SF Mono',Menlo,monospace;color:var(--pdw-ink);background:var(--pdw-bg);border:1px solid var(--pdw-rule);border-radius:999px;padding:6px 12px;cursor:pointer}",
    ".pdw button:hover{border-color:var(--pdw-accent)}",
    ".pdw button:focus-visible,.pdw input:focus-visible{outline:2px solid var(--pdw-accent);outline-offset:2px}",
    ".pdw button[aria-pressed=true]{background:var(--pdw-accent);color:var(--pdw-bg);border-color:var(--pdw-accent)}",
    ".pdw-sound{display:grid;grid-template-columns:auto 1fr auto auto;gap:12px;align-items:center}",
    ".pdw-hz{font:13px ui-monospace,'SF Mono',Menlo,monospace;font-variant-numeric:tabular-nums;color:var(--pdw-muted);min-width:7ch;text-align:right}",
    ".pdw-vol{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;max-width:420px}",
    ".pdw-vol .pdw-vlabel{font:13px ui-monospace,'SF Mono',Menlo,monospace;color:var(--pdw-muted)}",
    "@media (max-width:600px){.pdw-sound{grid-template-columns:auto 1fr auto}.pdw-pwm{grid-column:1/-1;justify-self:start}.pdw canvas{height:190px}}"
  ].join("\n");

  function injectCSS() {
    if (document.getElementById("pdw-style")) return;
    var s = document.createElement("style");
    s.id = "pdw-style";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  var HTML =
    '<div class="pdw-scope">' +
    '  <canvas role="img" aria-label="One cycle of a pulse wave"></canvas>' +
    '  <div class="pdw-read">' +
    '    <span class="hi">high <strong data-k="high">50.0%</strong></span>' +
    '    <span>low <strong data-k="low">50.0%</strong></span>' +
    '  </div>' +
    '  <div class="pdw-note" data-k="note" aria-live="polite"></div>' +
    '</div>' +
    '<div class="pdw-row">' +
    '  <label>Duty cycle</label>' +
    '  <input data-k="duty" type="range" min="0" max="100" step="0.1" value="50" aria-label="Duty cycle">' +
    '  <span class="pdw-val" data-k="dutyVal">50.0%</span>' +
    '</div>' +
    '<div class="pdw-chips" role="group" aria-label="Presets">' +
    '  <span>presets</span>' +
    '  <button data-d="50">50% square</button><button data-d="33.3">33%</button><button data-d="25">25%</button>' +
    '  <button data-d="75">75%</button><button data-d="10">10%</button><button data-d="0">0%</button>' +
    '</div>' +
    '<div class="pdw-sound">' +
    '  <button data-k="play" aria-pressed="false">Play</button>' +
    '  <input data-k="freq" type="range" min="0" max="1" step="0.001" value="0.42" aria-label="Pitch">' +
    '  <span class="pdw-hz" data-k="freqVal">220 Hz</span>' +
    '  <button class="pdw-pwm" data-k="pwm" aria-pressed="false">Sweep (PWM)</button>' +
    '</div>' +
    '<div class="pdw-vol">' +
    '  <span class="pdw-vlabel">volume</span>' +
    '  <input data-k="vol" type="range" min="0" max="1" step="0.01" value="0.5" aria-label="Volume">' +
    '  <span class="pdw-hz" data-k="volVal">50%</span>' +
    '</div>';

  function mount(host) {
    injectCSS();
    host.setAttribute("data-mounted", "");
    host.classList.add("pdw");
    host.innerHTML = HTML;

    var q = function (k) { return host.querySelector('[data-k="' + k + '"]'); };
    var canvas = host.querySelector("canvas");
    var dutyEl = q("duty"), freqEl = q("freq");
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var duty = 0.5, playhead = 0, pwmOn = false, pwmPhase = 0;
    var C = {};
    function readColors() {
      var s = getComputedStyle(host);
      ["ink", "muted", "rule", "accent", "soft"].forEach(function (k) { C[k] = s.getPropertyValue("--pdw-" + k).trim(); });
    }
    readColors();
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () { readColors(); draw(); });

    function mono(px) { return px + "px ui-monospace, 'SF Mono', Menlo, monospace"; }
    function switchAt() { return 1 - duty; }
    function levelAt(p) { return duty >= 0.9995 ? 1 : duty <= 0.0005 ? 0 : (p >= switchAt() ? 1 : 0); }

    function draw() {
      var dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
      if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
      var ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      var padL = 44, padR = 12, top = 34, bot = h - 30;
      var cycles = 1, cw = (w - padL - padR) / cycles;
      var yHi = top + 6, yLo = bot - 6, sw = switchAt(), c, x, i;

      ctx.fillStyle = C.muted; ctx.font = mono(11); ctx.textBaseline = "middle"; ctx.textAlign = "right";
      ctx.fillText("high", padL - 8, yHi); ctx.fillText("low", padL - 8, yLo);

      ctx.strokeStyle = C.rule; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      for (c = 0; c <= cycles; c++) { x = padL + c * cw; ctx.beginPath(); ctx.moveTo(x, top - 4); ctx.lineTo(x, bot + 4); ctx.stroke(); }
      ctx.setLineDash([]);

      ctx.fillStyle = C.soft;
      if (duty > 0.0005) for (c = 0; c < Math.ceil(cycles); c++) {
        var x0 = padL + (c + (duty >= 0.9995 ? 0 : sw)) * cw, x1 = Math.min(padL + (c + 1) * cw, w - padR);
        if (x1 > x0) ctx.fillRect(x0, yHi, x1 - x0, yLo - yHi);
      }

      ctx.strokeStyle = C.accent; ctx.lineWidth = 2.5; ctx.beginPath();
      for (i = 0; i <= 2000; i++) {
        var t = Math.min(i / 2000, 0.99999) * cycles, p = t - Math.floor(t), y = levelAt(p) ? yHi : yLo;
        x = padL + t * cw;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // brackets under the first cycle; labels only where they fit
      ctx.font = mono(11);
      function bracket(bx0, bx1, by, label, color) {
        if (bx1 - bx0 < 2) return;
        ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(bx0, by - 4); ctx.lineTo(bx0, by); ctx.lineTo(bx1, by); ctx.lineTo(bx1, by - 4); ctx.stroke();
        ctx.textAlign = "center"; ctx.textBaseline = "top";
        if (ctx.measureText(label).width + 8 <= bx1 - bx0) ctx.fillText(label, (bx0 + bx1) / 2, by + 4);
        else if (ctx.measureText(label.split(" ")[1]).width + 6 <= bx1 - bx0) ctx.fillText(label.split(" ")[1], (bx0 + bx1) / 2, by + 4);
      }
      bracket(padL, padL + sw * cw, bot + 6, "low " + ((1 - duty) * 100).toFixed(1) + "%", C.muted);
      bracket(padL + sw * cw, padL + cw, bot + 6, "high " + (duty * 100).toFixed(1) + "%", C.accent);

      ctx.fillStyle = C.muted; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      ctx.fillText("← one cycle →", padL + cw / 2, top - 12);

      if (!reduceMotion) {
        x = padL + playhead * cw;
        ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.globalAlpha = 0.55;
        ctx.beginPath(); ctx.moveTo(x, top - 4); ctx.lineTo(x, bot + 4); ctx.stroke(); ctx.globalAlpha = 1;
        ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(x, levelAt(playhead) ? yHi : yLo, 4.5, 0, Math.PI * 2); ctx.fill();
      }
    }

    function updateText() {
      var pct = (duty * 100).toFixed(1);
      q("dutyVal").textContent = pct + "%";
      q("high").textContent = pct + "%";
      q("low").textContent = ((1 - duty) * 100).toFixed(1) + "%";
      var note = "";
      if (duty <= 0.001) note = "0%: never high. The output is a flat line, so you hear nothing.";
      else if (duty >= 0.999) note = "100%: always high. Also a flat line, also silent.";
      else if (duty < 0.03 || duty > 0.97) note = "Very thin pulse: mostly one level, with a short blip each cycle. It gets quiet and clicky.";
      q("note").textContent = note;
      host.querySelectorAll(".pdw-chips button").forEach(function (b) {
        b.setAttribute("aria-pressed", String(Math.abs(parseFloat(b.dataset.d) / 100 - duty) < 0.0006));
      });
    }

    function setDuty(d, fromSlider) {
      duty = Math.min(1, Math.max(0, d));
      if (!fromSlider) dutyEl.value = (duty * 100).toFixed(1);
      updateText(); draw(); updateWave();
    }
    dutyEl.addEventListener("input", function () { pwmOff(); setDuty(parseFloat(dutyEl.value) / 100, true); });
    host.querySelectorAll(".pdw-chips button").forEach(function (b) {
      b.addEventListener("click", function () { pwmOff(); setDuty(parseFloat(b.dataset.d) / 100); });
    });

    // ---------- sound: band-limited pulse via Fourier series ----------
    var actx = null, osc = null, amp = null;
    // Hard ceiling on output level: the knob at 100% peaks around -28 dBFS,
    // so even with the system volume all the way up it stays comfortable.
    var MAX_GAIN = 0.04, volEl = q("vol");
    function gainFromVol() { var v = parseFloat(volEl.value); return MAX_GAIN * v * v; } // squared = smoother taper
    volEl.addEventListener("input", function () {
      q("volVal").textContent = Math.round(parseFloat(volEl.value) * 100) + "%";
      if (osc) amp.gain.setTargetAtTime(gainFromVol(), actx.currentTime, 0.02);
    });
    function freqFromSlider() { return 55 * Math.pow(2, parseFloat(freqEl.value) * 4); } // 55..880 Hz
    function showFreq() { q("freqVal").textContent = Math.round(freqFromSlider()) + " Hz"; }
    showFreq();
    function buildWave() {
      var H = 64, real = new Float32Array(H + 1), imag = new Float32Array(H + 1);
      for (var n = 1; n <= H; n++) real[n] = (2 * Math.sin(n * Math.PI * duty)) / (n * Math.PI);
      return actx.createPeriodicWave(real, imag, { disableNormalization: true });
    }
    function updateWave() { if (osc) osc.setPeriodicWave(buildWave()); }
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
          osc = actx.createOscillator(); osc.frequency.value = freqFromSlider();
          osc.setPeriodicWave(buildWave()); osc.connect(amp); osc.start();
          amp.gain.setTargetAtTime(gainFromVol(), actx.currentTime, 0.02);
          btn.textContent = "Stop"; btn.setAttribute("aria-pressed", "true");
        });
      } catch (e) { q("note").textContent = "Sound could not start in this browser."; }
    });
    freqEl.addEventListener("input", function () {
      showFreq();
      if (osc) osc.frequency.setTargetAtTime(freqFromSlider(), actx.currentTime, 0.01);
    });

    // ---------- PWM sweep ----------
    function pwmOff() { if (pwmOn) { pwmOn = false; q("pwm").setAttribute("aria-pressed", "false"); } }
    q("pwm").addEventListener("click", function () {
      pwmOn = !pwmOn; q("pwm").setAttribute("aria-pressed", String(pwmOn));
      if (pwmOn) pwmPhase = Math.asin(Math.max(-1, Math.min(1, (duty - 0.5) / 0.4)));
    });

    var last = performance.now(), waveTick = 0;
    function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!reduceMotion) playhead = (playhead + dt * 0.35) % 1;
      if (pwmOn) {
        pwmPhase += dt * 2 * Math.PI * 0.25;           // 0.25 Hz sweep, 10%..90%
        duty = 0.5 + 0.4 * Math.sin(pwmPhase);
        dutyEl.value = (duty * 100).toFixed(1);
        updateText();
        if ((waveTick = (waveTick + 1) % 2) === 0) updateWave();
      }
      if (!reduceMotion || pwmOn) draw();
      requestAnimationFrame(frame);
    }

    if (window.ResizeObserver) new ResizeObserver(draw).observe(host);
    updateText(); draw();
    requestAnimationFrame(frame);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountAll);
  else mountAll();
})();
