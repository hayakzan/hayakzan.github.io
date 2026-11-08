/*
 * accumulator-mask.js — what `accumulator &= 0xffffff` does
 *
 * Shows a 32-bit variable (as on an ordinary computer) holding the SID's
 * 24-bit accumulator. Each tick adds freq; the AND with 0x00ffffff clears
 * everything from bit 24 up, which is what makes the count wrap.
 * Turn the mask off to see the variable keep counting past the top.
 *
 * Usage:
 *   <div data-accumulator-mask></div>
 *   <script src="accumulator-mask.js"></script>
 */
(function () {
  "use strict";

  var script = document.currentScript;

  function mountAll() {
    var hosts = document.querySelectorAll("[data-accumulator-mask]:not([data-mounted])");
    if (!hosts.length && script) {
      var div = document.createElement("div");
      div.setAttribute("data-accumulator-mask", "");
      script.parentNode.insertBefore(div, script.nextSibling);
      hosts = [div];
    }
    for (var i = 0; i < hosts.length; i++) mount(hosts[i]);
  }

  var MONO = "ui-monospace,'SF Mono',Menlo,monospace";
  var MASK = 0xffffff, START = 16775000, FREQ = 7493;

  var CSS = [
    ".amsk{--amsk-bg:#f8f8fc;--amsk-ink:#1c1940;--amsk-muted:#5c5880;--amsk-rule:#d4d1e6;--amsk-accent:#40318d;--amsk-warn:#a2512c;--amsk-soft:rgba(64,49,141,.12);--amsk-cell:#e6e4f2;",
    "font:15px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif;color:var(--amsk-ink);background:var(--amsk-bg);border:1px solid var(--amsk-rule);border-radius:10px;padding:16px;display:grid;gap:12px;max-width:980px;margin:1.5em 0}",
    "@media (prefers-color-scheme:dark){.amsk{--amsk-bg:#1d1a4a;--amsk-ink:#dcd8f7;--amsk-muted:#9c97c8;--amsk-rule:#322e66;--amsk-accent:#8b80ee;--amsk-warn:#e39268;--amsk-soft:rgba(139,128,238,.16);--amsk-cell:#26225a}}",
    ".amsk *{box-sizing:border-box}",
    ".amsk-grid{display:grid;grid-template-columns:auto 1fr auto;gap:6px 10px;align-items:center;font:12px " + MONO + "}",
    ".amsk-lab{color:var(--amsk-muted);white-space:nowrap}",
    ".amsk-num{color:var(--amsk-ink);font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}",
    ".amsk-bits{display:grid;grid-template-columns:repeat(32,1fr);gap:1px}",
    ".amsk-bits span{text-align:center;padding:3px 0;border-radius:2px;background:var(--amsk-cell);color:var(--amsk-muted);font-variant-numeric:tabular-nums}",
    ".amsk-bits span:nth-child(4n){margin-right:3px}",
    ".amsk-bits span:last-child{margin-right:0}",
    ".amsk-bits .hi{background:transparent;border:1px dashed var(--amsk-rule)}",   // bits 24..31: not on the chip
    ".amsk-bits .one{color:var(--amsk-ink);font-weight:600}",
    ".amsk-bits .cleared{background:var(--amsk-warn);color:var(--amsk-bg);border-color:var(--amsk-warn)}",
    ".amsk-bits .kept{background:var(--amsk-soft)}",
    ".amsk-bits.mask .one{background:var(--amsk-accent);color:var(--amsk-bg)}",
    ".amsk-idx{display:grid;grid-template-columns:repeat(32,1fr);gap:1px;font:10px " + MONO + ";color:var(--amsk-muted);text-align:center}",
    ".amsk-idx span:nth-child(4n){margin-right:3px}",
    ".amsk-idx span:last-child{margin-right:0}",
    ".amsk-note{font:12.5px " + MONO + ";color:var(--amsk-muted);min-height:1.5em}",
    ".amsk-note b{color:var(--amsk-warn);font-weight:500}",
    ".amsk-btns{display:flex;flex-wrap:wrap;gap:8px;align-items:center}",
    ".amsk button{font:500 13px " + MONO + ";color:var(--amsk-ink);background:var(--amsk-bg);border:1px solid var(--amsk-rule);border-radius:999px;padding:6px 12px;cursor:pointer}",
    ".amsk button:hover{border-color:var(--amsk-accent)}",
    ".amsk button:focus-visible{outline:2px solid var(--amsk-accent);outline-offset:2px}",
    ".amsk button[aria-pressed=true]{background:var(--amsk-accent);color:var(--amsk-bg);border-color:var(--amsk-accent)}",
    "@media (max-width:600px){.amsk-grid{grid-template-columns:1fr;gap:2px}.amsk-num{text-align:left;margin-bottom:6px}.amsk-bits,.amsk-idx{font-size:9px}.amsk-bits span:nth-child(4n),.amsk-idx span:nth-child(4n){margin-right:1px}}"
  ].join("\n");

  function injectCSS() {
    if (document.getElementById("amsk-style")) return;
    var s = document.createElement("style");
    s.id = "amsk-style";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function row(label, key, cls) {
    return '<span class="amsk-lab">' + label + '</span>' +
      '<div class="amsk-bits ' + (cls || "") + '" data-k="' + key + '" aria-hidden="true"></div>' +
      '<span class="amsk-num" data-k="' + key + 'Num"></span>';
  }

  var idx = "";
  for (var b = 31; b >= 0; b--) idx += "<span>" + (b === 31 || b === 24 || b === 23 || b === 0 ? b : "") + "</span>";

  var HTML =
    '<div class="amsk-grid">' +
    '  <span></span><div class="amsk-idx" aria-hidden="true">' + idx + '</div><span></span>' +
    row("before", "before") +
    row("+ freq", "freq") +
    row("= sum", "sum") +
    row("& mask", "mask", "mask") +
    row("= after", "after") +
    '</div>' +
    '<div class="amsk-note" data-k="note" aria-live="polite"></div>' +
    '<div class="amsk-btns">' +
    '  <button data-k="tick">Tick (+7493)</button>' +
    '  <button data-k="maskBtn" aria-pressed="true">Mask on</button>' +
    '  <button data-k="reset">Reset</button>' +
    '</div>';

  function hex8(n) { return "0x" + (n >>> 0).toString(16).toUpperCase().padStart(8, "0"); }

  function mount(host) {
    injectCSS();
    host.setAttribute("data-mounted", "");
    host.classList.add("amsk");
    host.innerHTML = HTML;
    var q = function (k) { return host.querySelector('[data-k="' + k + '"]'); };

    var acc = START, maskOn = true, last = null;

    function paint(key, n, extra) {
      var el = q(key), html = "";
      for (var bit = 31; bit >= 0; bit--) {
        var one = (n >>> bit) & 1, cls = [];
        if (bit >= 24) cls.push("hi");
        if (one) cls.push("one");
        if (extra) { var c = extra(bit, one); if (c) cls.push(c); }
        html += '<span class="' + cls.join(" ") + '">' + one + "</span>";
      }
      el.innerHTML = html;
      q(key + "Num").textContent = hex8(n) + "  " + (n >>> 0).toLocaleString("en-US");
    }

    function render() {
      var before = last ? last.before : acc;
      var sum = last ? last.sum : acc;
      var after = last ? last.after : acc;
      var mask = maskOn ? MASK : 0xffffffff;
      paint("before", before);
      paint("freq", last ? FREQ : 0);
      paint("sum", sum, function (bit, one) { return bit >= 24 && one && maskOn ? "cleared" : ""; });
      paint("mask", mask);
      paint("after", after);

      var note = "";
      if (!last) note = "Bits 24–31 (dashed) exist in the computer's 32-bit variable, but not on the chip. Press Tick.";
      else if (maskOn && last.sum > MASK)
        note = "The sum spilled into bit 24. <b>The mask clears it</b>, so the count wraps to " +
          last.after.toLocaleString("en-US") + ", the leftover past the top.";
      else if (maskOn) note = "Nothing above bit 23 yet, so the mask changes nothing.";
      else if (last.after > MASK) note = "No mask: the variable keeps counting past 16,777,215. <b>It never wraps</b>, so it never finishes a cycle.";
      else note = "No mask: nothing has spilled past bit 23 yet.";
      q("note").innerHTML = note;
    }

    q("tick").addEventListener("click", function () {
      var before = acc, sum = (acc + FREQ) >>> 0, after = maskOn ? (sum & MASK) : sum;
      acc = after; last = { before: before, sum: sum, after: after };
      render();
    });
    q("maskBtn").addEventListener("click", function () {
      maskOn = !maskOn;
      q("maskBtn").setAttribute("aria-pressed", String(maskOn));
      q("maskBtn").textContent = maskOn ? "Mask on" : "Mask off";
      acc = acc & MASK; last = null; acc = START; render();
    });
    q("reset").addEventListener("click", function () { acc = START; last = null; render(); });

    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountAll);
  else mountAll();
})();
