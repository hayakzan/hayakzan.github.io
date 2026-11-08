/*
 * sid-pulse-phase.js — how the C64 SID makes its pulse wave
 *
 * The phase (top 12 bits of the 24-bit accumulator) climbs 0 → 4095 once
 * per cycle. The pulse-width register is a threshold:
 *     (accumulator >> 12) >= pw  →  high
 *
 * Usage (anywhere in a page or blog post):
 *   <div data-sid-pulse-phase></div>
 *   <script src="sid-pulse-phase.js"></script>
 *
 * If no element with data-sid-pulse-phase exists, the demo is inserted
 * right after the <script> tag. No dependencies.
 */
(function () {
  "use strict";

  var script = document.currentScript;

  function mountAll() {
    var hosts = document.querySelectorAll("[data-sid-pulse-phase]:not([data-mounted])");
    if (!hosts.length && script) {
      var div = document.createElement("div");
      div.setAttribute("data-sid-pulse-phase", "");
      script.parentNode.insertBefore(div, script.nextSibling);
      hosts = [div];
    }
    for (var i = 0; i < hosts.length; i++) mount(hosts[i]);
  }

  // ---------- styles (scoped under .spp) ----------
  var CSS = [
    ".spp{--spp-bg:#f8f8fc;--spp-ink:#1c1940;--spp-muted:#5c5880;--spp-rule:#d4d1e6;--spp-accent:#40318d;--spp-low:#a39fc0;--spp-warn:#a2512c;--spp-soft:rgba(64,49,141,.12);",
    "font:15px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif;color:var(--spp-ink);background:var(--spp-bg);border:1px solid var(--spp-rule);border-radius:10px;padding:16px;display:grid;gap:12px;max-width:980px;margin:1.5em 0}",
    "@media (prefers-color-scheme:dark){.spp{--spp-bg:#1d1a4a;--spp-ink:#dcd8f7;--spp-muted:#9c97c8;--spp-rule:#322e66;--spp-accent:#8b80ee;--spp-low:#4f4a86;--spp-warn:#e39268;--spp-soft:rgba(139,128,238,.16)}}",
    ".spp *{box-sizing:border-box}",
    ".spp canvas{width:100%;height:240px;display:block}",
    ".spp-row{display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center}",
    ".spp-row label{font-weight:600;font-size:15px}",
    ".spp-val{font:500 15px ui-monospace,'SF Mono',Menlo,monospace;font-variant-numeric:tabular-nums;color:var(--spp-warn);min-width:11ch;text-align:right}",
    ".spp input[type=range]{width:100%;min-width:0;accent-color:var(--spp-accent)}",
    ".spp input:focus-visible{outline:2px solid var(--spp-accent);outline-offset:2px}",
    ".spp-line{font:13px ui-monospace,'SF Mono',Menlo,monospace;font-variant-numeric:tabular-nums;color:var(--spp-ink)}",
    ".spp-code{font:13px ui-monospace,'SF Mono',Menlo,monospace;background:var(--spp-soft);border-radius:8px;padding:10px 12px;overflow-x:auto;white-space:pre;color:var(--spp-ink)}",
    ".spp-code b{color:var(--spp-accent);font-weight:500}",
    "@media (max-width:600px){.spp canvas{height:210px}.spp-row{grid-template-columns:1fr auto}.spp-row label{grid-column:1/-1}}"
  ].join("\n");

  function injectCSS() {
    if (document.getElementById("spp-style")) return;
    var s = document.createElement("style");
    s.id = "spp-style";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  var HTML =
    '<canvas role="img" aria-label="Phase ramp from 0 to 4095 compared against the pulse width register"></canvas>' +
    '<div class="spp-row">' +
    '  <label>Pulse-width register</label>' +
    '  <input data-k="pw" type="range" min="0" max="4095" step="1" value="2048" aria-label="Pulse width register, 0 to 4095">' +
    '  <span class="spp-val" data-k="pwVal">2048 ($800)</span>' +
    '</div>' +
    '<div class="spp-line" data-k="line"></div>' +
    '<div class="spp-code" data-k="code"></div>';

  function hex(n, d) { return "$" + n.toString(16).toUpperCase().padStart(d, "0"); }

  function mount(host) {
    injectCSS();
    host.setAttribute("data-mounted", "");
    host.classList.add("spp");
    host.innerHTML = HTML;

    var q = function (k) { return host.querySelector('[data-k="' + k + '"]'); };
    var canvas = host.querySelector("canvas");
    var pwEl = q("pw");
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var pw = 2048, playhead = 0.18;
    var C = {};
    function readColors() {
      var s = getComputedStyle(host);
      ["ink", "muted", "rule", "accent", "low", "warn", "bg"].forEach(function (k) { C[k] = s.getPropertyValue("--spp-" + k).trim(); });
    }
    readColors();
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () { readColors(); draw(); });

    function mono(px) { return px + "px ui-monospace, 'SF Mono', Menlo, monospace"; }

    function draw() {
      var dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
      if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
      var ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      var padL = 46, padR = 10, top = 16, bot = h - 52;
      function X(p) { return padL + p * (w - padL - padR); }
      function Y(v) { return bot - (v / 4096) * (bot - top); }
      var split = pw / 4096;

      // gridlines
      ctx.font = mono(10.5); ctx.textAlign = "right"; ctx.textBaseline = "middle";
      [0, 1024, 2048, 3072, 4095].forEach(function (v) {
        ctx.strokeStyle = C.rule; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(padL, Y(v)); ctx.lineTo(w - padR, Y(v)); ctx.stroke();
        ctx.fillStyle = C.muted; ctx.fillText(String(v), padL - 6, Y(v));
      });

      // the ramp: the phase climbing once per cycle; colored by output state
      ctx.lineWidth = 2.5; ctx.lineCap = "round";
      ctx.strokeStyle = C.low; ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(split), Y(pw)); ctx.stroke();
      ctx.strokeStyle = C.accent; ctx.beginPath(); ctx.moveTo(X(split), Y(pw)); ctx.lineTo(X(1), Y(4095)); ctx.stroke();
      // the wrap back to 0
      ctx.strokeStyle = C.rule; ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(X(1), Y(4095)); ctx.lineTo(X(1), Y(0)); ctx.stroke(); ctx.setLineDash([]);

      // pw threshold
      ctx.strokeStyle = C.warn; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(padL, Y(pw)); ctx.lineTo(w - padR, Y(pw)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = C.warn; ctx.font = mono(11); ctx.textAlign = "left";
      var labelBelow = Y(pw) - 16 < top;
      ctx.textBaseline = labelBelow ? "top" : "bottom";
      ctx.fillText("pw = " + pw, padL + 6, Y(pw) + (labelBelow ? 4 : -4));

      // output strip
      var sy = bot + 14, sh = 14;
      ctx.fillStyle = C.low; ctx.fillRect(X(0), sy, X(split) - X(0), sh);
      ctx.fillStyle = C.accent; ctx.fillRect(X(split), sy, X(1) - X(split), sh);
      ctx.fillStyle = C.muted; ctx.font = mono(10.5); ctx.textAlign = "right"; ctx.textBaseline = "middle";
      ctx.fillText("out", padL - 6, sy + sh / 2);
      ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillText("low", X(0) + 4, sy + sh + 4);
      ctx.textAlign = "right"; ctx.fillText("high", X(1) - 2, sy + sh + 4);
      ctx.textAlign = "center"; ctx.fillText("one cycle →", (X(0) + X(1)) / 2, sy + sh + 4);

      // moving phase cursor
      var ph = Math.floor(playhead * 4096), hi = ph >= pw;
      if (!reduceMotion) {
        ctx.strokeStyle = C.ink; ctx.globalAlpha = 0.4; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(X(playhead), Y(ph)); ctx.lineTo(X(playhead), sy + sh); ctx.stroke(); ctx.globalAlpha = 1;
        ctx.fillStyle = hi ? C.accent : C.bg; ctx.strokeStyle = hi ? C.accent : C.ink; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(X(playhead), Y(ph), 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }

      // live comparison text
      q("code").innerHTML =
        "(accumulator &gt;&gt; 12) &gt;= pw ? 0xfff : 0x000\n" +
        "<b>" + ph + "</b> " + (hi ? "&gt;=" : "&lt; ") + " " + pw + "  →  <b>" + (hi ? "0xfff (high)" : "0x000 (low)") + "</b>";
    }

    function update() {
      q("pwVal").textContent = pw + " (" + hex(pw, 3) + ")";
      var high = (1 - pw / 4096) * 100;
      q("line").textContent = "high for 1 − " + pw + "/4096 = " + high.toFixed(1) + "% of every cycle · low for " + (100 - high).toFixed(1) + "%";
      draw();
    }
    pwEl.addEventListener("input", function () { pw = parseInt(pwEl.value, 10); update(); });

    var last = performance.now();
    function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      playhead = (playhead + dt * 0.3) % 1;
      draw();
      requestAnimationFrame(frame);
    }

    if (window.ResizeObserver) new ResizeObserver(draw).observe(host);
    update();
    if (!reduceMotion) requestAnimationFrame(frame);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountAll);
  else mountAll();
})();
