/* Клієнтська пагінація списків. Усі елементи є в HTML (видимі без JS і для пошукових систем),
   скрипт лише показує поточну сторінку. Розмітка: <div data-paginate="12" data-paginate-anchor="id"> ... </div>
   Елементи можна виключати з показу атрибутом data-filtered="true" (див. фільтр у блозі). */
(function () {
  var PARAM = 'page';

  function init(container) {
    var size = parseInt(container.getAttribute('data-paginate'), 10) || 10;
    var items = Array.prototype.slice.call(container.children);
    var anchor = document.getElementById(container.getAttribute('data-paginate-anchor') || '') || container;
    var nav = document.createElement('nav');
    nav.className = 'pagination';
    nav.setAttribute('aria-label', 'Сторінки списку');
    container.parentNode.insertBefore(nav, container.nextSibling);

    var page = readPage();

    function readPage() {
      var n = parseInt(new URLSearchParams(location.search).get(PARAM), 10);
      return n > 0 ? n : 1;
    }

    function matching() {
      return items.filter(function (el) { return el.getAttribute('data-filtered') !== 'true'; });
    }

    function pageHref(n) {
      var url = new URL(location.href);
      if (n > 1) url.searchParams.set(PARAM, n); else url.searchParams.delete(PARAM);
      return url.pathname + url.search;
    }

    function link(n, label, aria, current) {
      var a = document.createElement('a');
      a.href = pageHref(n);
      a.textContent = label;
      if (aria) a.setAttribute('aria-label', aria);
      if (current) { a.className = 'is-current'; a.setAttribute('aria-current', 'page'); }
      a.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
        e.preventDefault();
        go(n, true);
      });
      return a;
    }

    function inert(label, cls, aria) {
      var s = document.createElement('span');
      s.textContent = label;
      s.className = cls;
      if (aria) s.setAttribute('aria-hidden', 'true');
      return s;
    }

    function numbers(total, cur) {
      var set = {};
      [1, total, cur - 1, cur, cur + 1].forEach(function (n) { if (n >= 1 && n <= total) set[n] = true; });
      var list = Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
      var out = [];
      list.forEach(function (n, i) {
        if (i && n - list[i - 1] > 1) out.push(null);
        out.push(n);
      });
      return out;
    }

    function render(total) {
      nav.textContent = '';
      nav.hidden = total <= 1;
      if (total <= 1) return;
      nav.appendChild(page > 1 ? link(page - 1, '←', 'Попередня сторінка') : inert('←', 'is-disabled', true));
      numbers(total, page).forEach(function (n) {
        nav.appendChild(n === null ? inert('…', 'is-gap', true) : link(n, String(n), 'Сторінка ' + n, n === page));
      });
      nav.appendChild(page < total ? link(page + 1, '→', 'Наступна сторінка') : inert('→', 'is-disabled', true));
    }

    function draw() {
      var list = matching();
      var total = Math.max(1, Math.ceil(list.length / size));
      if (page > total) page = total;
      var from = (page - 1) * size, to = from + size;
      var last = null;
      items.forEach(function (el) { el.hidden = true; el.classList.remove('is-last'); });
      list.forEach(function (el, i) {
        var show = i >= from && i < to;
        el.hidden = !show;
        if (show) last = el;
      });
      if (last) last.classList.add('is-last');
      render(total);
    }

    function go(n, scroll) {
      page = n;
      draw();
      history.pushState({ page: page }, '', pageHref(page));
      if (scroll) anchor.scrollIntoView({ block: 'start' });
    }

    container.addEventListener('paginate:refresh', function () {
      page = 1;
      if (new URLSearchParams(location.search).has(PARAM)) history.replaceState(null, '', pageHref(1));
      draw();
    });

    window.addEventListener('popstate', function () { page = readPage(); draw(); });

    draw();
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-paginate]'), init);
})();
