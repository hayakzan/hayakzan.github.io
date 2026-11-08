/*
 * phase-accumulator.js — the SID's 24-bit phase accumulator, in slow motion
 *
 * Every clock tick: accumulator = (accumulator + freq) & 0xffffff
 * Output pitch:     f_out = freq * f_clock / 2^24
 *
 * Usage (anywhere in a page or blog post):
 *   <div data-phase-accumulator></div>
 *   <script src="phase-accumulator.js"></script>
 *
 * If no element with data-phase-accumulator exists, the demo is inserted
 * right after the <script> tag. No dependencies.
 */
(function () {
  "use strict";

  var script = document.currentScript;

  function mountAll() {
    var hosts = document.querySelectorAll("[data-phase-accumulator]:not([data-mounted])");
    if (!hosts.length && script) {
      var div = document.createElement("div");
      div.setAttribute("data-phase-accumulator", "");
      script.parentNode.insertBefore(div, script.nextSibling);
      hosts = [div];
    }
    for (var i = 0; i < hosts.length; i++) mount(hosts[i]);
  }

  var MONO = "ui-monospace,'SF Mono',Menlo,monospace";

  // ---------- styles (scoped under .pacc) ----------
  var CSS = [
    ".pacc{--pacc-bg:#f8f8fc;--pacc-ink:#1c1940;--pacc-muted:#5c5880;--pacc-rule:#d4d1e6;--pacc-accent:#40318d;--pacc-low:#c9c6de;--pacc-warn:#a2512c;--pacc-soft:rgba(64,49,141,.12);",
    "font:15px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif;color:var(--pacc-ink);background:var(--pacc-bg);border:1px solid var(--pacc-rule);border-radius:10px;padding:16px;display:grid;gap:14px;max-width:980px;margin:1.5em 0}",
    "@media (prefers-color-scheme:dark){.pacc{--pacc-bg:#1d1a4a;--pacc-ink:#dcd8f7;--pacc-muted:#9c97c8;--pacc-rule:#322e66;--pacc-accent:#8b80ee;--pacc-low:#2f2b63;--pacc-warn:#e39268;--pacc-soft:rgba(139,128,238,.16)}}",
    ".pacc *{box-sizing:border-box}",
    // bit row
    ".pacc-bits{display:grid;grid-template-columns:repeat(24,1fr);gap:2px;font:12px " + MONO + "}",
    ".pacc-bit{text-align:center;padding:5px 0;border-radius:3px;background:var(--pacc-low);color:var(--pacc-muted);font-variant-numeric:tabular-nums}",
    ".pacc-bit.up{background:var(--pacc-soft);color:var(--pacc-ink)}",
    ".pacc-bit.up.on{background:var(--pacc-accent);color:var(--pacc-bg)}",
    ".pacc-bit.on{color:var(--pacc-ink)}",
    ".pacc-bitlab{display:grid;grid-template-columns:repeat(24,1fr);gap:2px;font:10px " + MONO + ";color:var(--pacc-muted);text-align:center}",
    ".pacc-brace{display:grid;grid-template-columns:1fr 1fr;gap:2px;font:11px " + MONO + ";color:var(--pacc-muted);text-align:center}",
    ".pacc-brace span{border-top:1px solid var(--pacc-rule);padding-top:3px}",
    ".pacc-brace .up{border-color:var(--pacc-accent);color:var(--pacc-accent)}",
    ".pacc-acc{font:13px " + MONO + ";font-variant-numeric:tabular-nums;color:var(--pacc-muted)}",
    ".pacc-acc strong{color:var(--pacc-ink);font-weight:500}",
    // canvas
    ".pacc canvas{width:100%;height:180px;display:block}",
    // controls
    ".pacc-row{display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center}",
    ".pacc-row label{font-weight:600;font-size:15px}",
    ".pacc input[type=range]{width:100%;min-width:0;accent-color:var(--pacc-accent)}",
    ".pacc input[type=number]{font:500 15px " + MONO + ";width:8ch;padding:3px 6px;border:1px solid var(--pacc-rule);border-radius:6px;background:var(--pacc-bg);color:var(--pacc-warn);text-align:right}",
    ".pacc input:focus-visible,.pacc button:focus-visible{outline:2px solid var(--pacc-accent);outline-offset:2px}",
    ".pacc-formula{font:13px " + MONO + ";background:var(--pacc-soft);border-radius:8px;padding:10px 12px;overflow-x:auto;white-space:pre;color:var(--pacc-ink)}",
    ".pacc-formula b{color:var(--pacc-accent);font-weight:500}",
    ".pacc-chips{display:flex;flex-wrap:wrap;gap:8px;align-items:center}",
    ".pacc-chips > span{font:12px " + MONO + ";color:var(--pacc-muted);margin-right:4px}",
    ".pacc button{font:500 13px " + MONO + ";color:var(--pacc-ink);background:var(--pacc-bg);border:1px solid var(--pacc-rule);border-radius:999px;padding:6px 12px;cursor:pointer}",
    ".pacc button:hover{border-color:var(--pacc-accent)}",
    ".pacc button[aria-pressed=true]{background:var(--pacc-accent);color:var(--pacc-bg);border-color:var(--pacc-accent)}",
    ".pacc-sound{display:grid;grid-template-columns:auto auto 1fr auto;gap:12px;align-items:center;max-width:520px}",
    ".pacc-sound span{font:13px " + MONO + ";font-variant-numeric:tabular-nums;color:var(--pacc-muted)}",
    ".pacc-sound [data-k=volVal]{min-width:4ch;text-align:right}",
    "@media (max-width:600px){.pacc-bits{font-size:9px}.pacc-bitlab{font-size:8px}.pacc canvas{height:150px}.pacc-row{grid-template-columns:1fr auto}.pacc-row label{grid-column:1/-1}}"
  ].join("\n");

  function injectCSS() {
    if (document.getElementById("pacc-style")) return;
    var s = document.createElement("style");
    s.id = "pacc-style";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  var bitCells = "", bitLabels = "";
  for (var b = 23; b >= 0; b--) {
    bitCells += '<div class="pacc-bit' + (b >= 12 ? " up" : "") + '" data-b="' + b + '">0</div>';
    bitLabels += "<span>" + (b === 23 || b === 19 || b === 12 || b === 11 || b === 0 ? b : "") + "</span>";
  }

  var HTML =
    '<div class="pacc-acc">accumulator <strong data-k="accHex">0x000000</strong> = <strong data-k="accDec">0</strong>' +
    ' &nbsp;·&nbsp; slowed down: one cycle every ~3 s</div>' +
    '<div>' +
    '  <div class="pacc-bitlab" aria-hidden="true">' + bitLabels + '</div>' +
    '  <div class="pacc-bits" role="img" aria-label="The 24 bits of the accumulator">' + bitCells + '</div>' +
    '  <div class="pacc-brace" aria-hidden="true"><span class="up">upper 12 bits → waveform</span><span>lower 12 bits</span></div>' +
    '</div>' +
    '<canvas role="img" aria-label="Upper 12 bits of the accumulator ramping from 0 to 4095 and wrapping"></canvas>' +
    '<div class="pacc-row">' +
    '  <label>Frequency register</label>' +
    '  <input data-k="slider" type="range" min="0" max="1" step="0.0001" aria-label="Frequency register">' +
    '  <input data-k="num" type="number" min="1" max="65535" step="1" aria-label="Frequency register value">' +
    '</div>' +
    '<div class="pacc-chips">' +
    '  <span>clock</span>' +
    '  <button data-clock="pal" aria-pressed="true">PAL</button><button data-clock="ntsc" aria-pressed="false">NTSC</button>' +
    '  <span style="margin-left:12px">presets</span>' +
    '  <button data-preset="a4">A 440 Hz</button><button data-preset="1">freq = 1</button><button data-preset="65535">max</button>' +
    '</div>' +
    '<div class="pacc-formula" data-k="formula"></div>' +
    '<div class="pacc-sound">' +
    '  <button data-k="play" aria-pressed="false">Play</button>' +
    '  <span>volume</span>' +
    '  <input data-k="vol" type="range" min="0" max="1" step="0.01" value="0.5" aria-label="Volume">' +
    '  <span data-k="volVal">50%</span>' +
    '</div>';

  var CLOCKS = { pal: 985248, ntsc: 1022727 };
  var TWO24 = 16777216;

  function mount(host) {
    injectCSS();
    host.setAttribute("data-mounted", "");
    host.classList.add("pacc");
    host.innerHTML = HTML;

    var q = function (k) { return host.querySelector('[data-k="' + k + '"]'); };
    var canvas = host.querySelector("canvas");
    var sliderEl = q("slider"), numEl = q("num");
    var cells = host.querySelectorAll(".pacc-bit");
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var freq = 7493, clock = "pal", acc = 0, tickDebt = 0;
    var C = {};
    function readColors() {
      var s = getComputedStyle(host);
      ["ink", "muted", "rule", "accent", "low", "warn", "bg"].forEach(function (k) { C[k] = s.getPropertyValue("--pacc-" + k).trim(); });
    }
    readColors();
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () { readColors(); draw(); });

    function mono(px) { return px + "px " + MONO; }
    function hz() { return freq * CLOCKS[clock] / TWO24; }

    // log-scaled slider so small register values are reachable
    function sliderToFreq(v) { return Math.max(1, Math.round(Math.pow(65535, v))); }
    function freqToSlider(f) { return Math.log(f) / Math.log(65535); }

    // ---------- drawing ----------
    function drawBits() {
      for (var i = 0; i < 24; i++) {
        var bit = 23 - i, on = (acc >>> bit) & 1;
        cells[i].textContent = on;
        cells[i].classList.toggle("on", !!on);
      }
      q("accHex").textContent = "0x" + acc.toString(16).toUpperCase().padStart(6, "0");
      q("accDec").textContent = acc.toLocaleString("en-US");
    }

    function draw() {
      drawBits();
      var dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
      if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
      var ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      var padL = 46, padR = 10, top = 12, bot = h - 28;
      var cycles = 2;
      function X(t) { return padL + (t / cycles) * (w - padL - padR); }
      function Y(v) { return bot - (v / 4096) * (bot - top); }

      ctx.font = mono(10.5); ctx.textAlign = "right"; ctx.textBaseline = "middle";
      [0, 2048, 4095].forEach(function (v) {
        ctx.strokeStyle = C.rule; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(padL, Y(v)); ctx.lineTo(w - padR, Y(v)); ctx.stroke();
        ctx.fillStyle = C.muted; ctx.fillText(String(v), padL - 6, Y(v));
      });

      // the ramp (= sawtooth), wrapping once per cycle
      ctx.strokeStyle = C.accent; ctx.lineWidth = 2.5; ctx.lineCap = "round";
      for (var c = 0; c < cycles; c++) {
        ctx.beginPath(); ctx.moveTo(X(c), Y(0)); ctx.lineTo(X(c + 1), Y(4095)); ctx.stroke();
        ctx.strokeStyle = C.rule; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(X(c + 1), Y(4095)); ctx.lineTo(X(c + 1), Y(0)); ctx.stroke();
        ctx.setLineDash([]); ctx.strokeStyle = C.accent; ctx.lineWidth = 2.5;
      }
      ctx.fillStyle = C.muted; ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.fillText("wrap", X(1), bot + 6);
      ctx.fillText("wrap", X(2) - 14, bot + 6);
      ctx.textAlign = "left"; ctx.fillText("accumulator >> 12", padL + 4, bot + 6);

      // cursor on the first cycle
      var up = acc >>> 12, t = acc / TWO24;
      ctx.strokeStyle = C.ink; ctx.globalAlpha = 0.4; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(X(t), Y(up)); ctx.lineTo(X(t), bot); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillStyle = C.accent; ctx.beginPath(); ctx.arc(X(t), Y(up), 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C.ink; ctx.font = mono(11); ctx.textAlign = X(t) > w - 90 ? "right" : "left"; ctx.textBaseline = "bottom";
      ctx.fillText(String(up), X(t) + (ctx.textAlign === "right" ? -8 : 8), Y(up) - 4);
    }

    function updateText() {
      var f = hz(), ticks = TWO24 / freq;
      q("formula").innerHTML =
        "f_out = freq × f_clock / 2²⁴\n" +
        "      = <b>" + freq + "</b> × " + CLOCKS[clock].toLocaleString("en-US") + " / 16,777,216 = <b>" +
        (f < 10 ? f.toFixed(3) : f.toFixed(2)) + " Hz</b>\n" +
        "one cycle = 2²⁴ / " + freq + " ≈ " + (ticks < 100 ? ticks.toFixed(1) : Math.round(ticks).toLocaleString("en-US")) +
        " ticks" + (f < 1 ? "  (" + (1 / f).toFixed(1) + " s)" : "") +
        (f < 20 ? "\nbelow hearing: Play uses 20 Hz instead" : "");
      host.querySelectorAll("[data-clock]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.clock === clock)); });
    }

    function setFreq(f, from) {
      freq = Math.min(65535, Math.max(1, Math.round(f)));
      if (from !== "slider") sliderEl.value = freqToSlider(freq);
      if (from !== "num") numEl.value = freq;
      updateText(); draw(); updatePitch();
    }
    sliderEl.addEventListener("input", function () { setFreq(sliderToFreq(parseFloat(sliderEl.value)), "slider"); });
    numEl.addEventListener("change", function () { var v = parseInt(numEl.value, 10); if (!isNaN(v)) setFreq(v, "num"); else numEl.value = freq; });

    host.querySelectorAll("[data-clock]").forEach(function (b) {
      // same register value, different clock: the pitch moves, just like a PAL tune on an NTSC machine
      b.addEventListener("click", function () { clock = b.dataset.clock; updateText(); updatePitch(); });
    });
    host.querySelectorAll("[data-preset]").forEach(function (b) {
      b.addEventListener("click", function () {
        var p = b.dataset.preset;
        setFreq(p === "a4" ? 440 * TWO24 / CLOCKS[clock] : parseInt(p, 10));
      });
    });

    // ---------- sound: band-limited sawtooth at the real pitch ----------
    // Same hard ceiling as the other widgets: 100% volume peaks around -36 dBFS.
    var MAX_GAIN = 0.015;
    var actx = null, osc = null, amp = null, volEl = q("vol");
    function gainFromVol() { var v = parseFloat(volEl.value); return MAX_GAIN * v * v; }
    function audibleHz() { return Math.max(20, hz()); } // below ~20 Hz you'd only hear clicks
    function updatePitch() { if (osc) osc.frequency.setTargetAtTime(audibleHz(), actx.currentTime, 0.01); }
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
          var H = 64, real = new Float32Array(H + 1), imag = new Float32Array(H + 1);
          for (var n = 1; n <= H; n++) imag[n] = -2 / (n * Math.PI) * 0.5; // rising ramp, peak ~0.5
          amp = actx.createGain(); amp.gain.value = 0; amp.connect(actx.destination);
          osc = actx.createOscillator(); osc.frequency.value = audibleHz();
          osc.setPeriodicWave(actx.createPeriodicWave(real, imag, { disableNormalization: true }));
          osc.connect(amp); osc.start();
          amp.gain.setTargetAtTime(gainFromVol(), actx.currentTime, 0.02);
          btn.textContent = "Stop"; btn.setAttribute("aria-pressed", "true");
        });
      } catch (e) { btn.textContent = "No sound"; btn.disabled = true; }
    });

    // ---------- slow-motion counting ----------
    // Real tick rate is ~1 MHz; here we run just enough ticks per second
    // that one cycle takes ~3 s, adding exactly `freq` on every tick.
    var SECONDS_PER_CYCLE = 3;
    var last = performance.now();
    function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      tickDebt += dt * (TWO24 / freq) / SECONDS_PER_CYCLE;
      var n = Math.floor(tickDebt); tickDebt -= n;
      if (n > 0) acc = (acc + ((n * freq) % TWO24)) % TWO24;
      draw();
      requestAnimationFrame(frame);
    }

    if (window.ResizeObserver) new ResizeObserver(draw).observe(host);
    setFreq(freq);
    if (!reduceMotion) requestAnimationFrame(frame);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountAll);
  else mountAll();
})();
