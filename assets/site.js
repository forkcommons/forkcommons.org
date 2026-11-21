/* Fork Commons, small page behaviours. No dependencies. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---- Counted numbers in the hero byline ------------------------------ */

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function countUp(el) {
    var target = parseInt(el.getAttribute("data-count-to"), 10);
    if (isNaN(target)) return;
    var start = 0;
    var t0 = 0;
    var duration = 1000;

    function frame(now) {
      if (!t0) t0 = now;
      var t = Math.min((now - t0) / duration, 1);
      el.textContent = String(Math.round(start + (target - start) * easeOutCubic(t)));
      if (t < 1) window.requestAnimationFrame(frame);
      else el.textContent = String(target);
    }
    window.requestAnimationFrame(frame);
  }

  function setupCounters() {
    var nums = document.querySelectorAll("[data-count-to]");
    if (!nums.length) return;
    if (reduceMotion.matches) return;
    if (typeof window.IntersectionObserver !== "function") return;

    var started = false;
    var trigger = nums[0].parentNode;

    function start() {
      if (started) return;
      started = true;
      for (var i = 0; i < nums.length; i++) countUp(nums[i]);
    }

    for (var i = 0; i < nums.length; i++) nums[i].textContent = "0";

    var io = new IntersectionObserver(function (entries) {
      for (var j = 0; j < entries.length; j++) {
        if (!entries[j].isIntersecting) continue;
        start();
        io.disconnect();
        return;
      }
    }, { threshold: 0.5 });
    io.observe(trigger);
  }

  /* ---- Rail table of contents ------------------------------------------ */

  function slugify(text) {
    var s = String(text).toLowerCase().replace(/[^\w\s-]/g, "").trim();
    s = s.replace(/\s+/g, "-").replace(/-+/g, "-");
    return s || "section";
  }

  function uniqueId(base) {
    var id = base;
    var n = 2;
    while (document.getElementById(id)) id = base + "-" + n++;
    return id;
  }

  function setupRail() {
    var main = document.querySelector("main");
    if (!main) return;

    var heads = [];
    var all = main.querySelectorAll("h2");
    for (var i = 0; i < all.length; i++) {
      if (!all[i].closest(".rail-toc")) heads.push(all[i]);
    }
    if (heads.length < 4) return;

    var nav = document.createElement("nav");
    nav.className = "rail-toc";
    nav.setAttribute("aria-label", "On this page");

    var title = document.createElement("p");
    title.className = "rt-title";
    title.textContent = "On this page";
    nav.appendChild(title);

    var list = document.createElement("ul");
    var links = [];
    var byId = {};

    headingsLoop:
    for (var k = 0; k < heads.length; k++) {
      var h = heads[k];
      if (!h.id) h.id = uniqueId(slugify(h.textContent));
      else if (document.getElementById(h.id) !== h) {
        // An id already claimed by another element: leave the h2 alone and skip it.
        continue headingsLoop;
      }

      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = "#" + h.id;
      a.textContent = (h.textContent || "").trim();
      li.appendChild(a);
      list.appendChild(li);
      links.push(a);
      byId[h.id] = a;
    }

    if (links.length < 4) return;
    nav.appendChild(list);
    if (main.nextSibling) main.parentNode.insertBefore(nav, main.nextSibling);
    else main.parentNode.appendChild(nav);
    document.body.classList.add("has-rail");

    var current = null;

    function setActive(id) {
      if (!byId[id] || current === byId[id]) return;
      if (current) current.removeAttribute("aria-current");
      current = byId[id];
      current.setAttribute("aria-current", "true");
    }

    for (var m = 0; m < links.length; m++) {
      links[m].addEventListener("click", function () {
        setActive(this.getAttribute("href").slice(1));
      });
    }

    if (typeof window.IntersectionObserver !== "function") {
      setActive(heads[0].id);
      return;
    }

    var io = new IntersectionObserver(update, { rootMargin: "-100px 0px -55% 0px", threshold: 0 });
    var queued = false;

    function update() {
      var marker = Math.min(window.innerHeight * 0.35, 320);
      var best = null;
      for (var j = 0; j < heads.length; j++) {
        if (!byId[heads[j].id]) continue;
        if (!best) best = heads[j];
        if (heads[j].getBoundingClientRect().top <= marker) best = heads[j];
      }
      if (best) setActive(best.id);
    }

    function onScroll() {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(function () {
        queued = false;
        update();
      });
    }

    for (var n = 0; n < heads.length; n++) {
      if (byId[heads[n].id]) io.observe(heads[n]);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("hashchange", update);
    for (var f = 0; f < heads.length; f++) {
      if (byId[heads[f].id]) { setActive(heads[f].id); break; }
    }
  }

  function init() {
    setupCounters();
    setupRail();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
