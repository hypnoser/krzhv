/* /dopomoha/ — поступове покращення.
   Без JS усі вправи видно одразу, навігація працює звичайними якорями.
   З JS показується лише вибраний стан і крок. Адреса (#tryvoha, #tryvoha-simpler, #tryvoha-done…)
   — єдине джерело стану: посилання, оновлення сторінки й «Назад» у браузері працюють однаково.
   Нічого не зберігається і нікуди не надсилається. */
(function () {
  var root = document.getElementById('dh');
  if (!root) return;

  var chooser = document.getElementById('vybir');
  var states = Array.prototype.slice.call(root.querySelectorAll('.dh-state'));
  var ids = states.map(function (s) { return s.id; });
  var KINDS = ['main', 'simpler', 'extra', 'done'];
  var current = null;

  // Інтерактивні елементи, які мають сенс лише з JS
  Array.prototype.forEach.call(root.querySelectorAll('.dh-actions, [data-print]'), function (el) {
    el.hidden = false;
  });

  function parse(hash) {
    var h = (hash || '').replace(/^#/, '');
    try { h = decodeURIComponent(h); } catch (e) { return null; }
    if (ids.indexOf(h) !== -1) return { state: h, kind: 'main' };
    for (var i = 0; i < ids.length; i++) {
      var prefix = ids[i] + '-';
      if (h.indexOf(prefix) === 0 && KINDS.indexOf(h.slice(prefix.length)) !== -1) {
        return { state: ids[i], kind: h.slice(prefix.length) };
      }
    }
    return null; // невідомий фрагмент або #vybir — показуємо вибір
  }

  function scrollTo(el) {
    if (!el) { window.scrollTo(0, 0); return; }
    try { el.scrollIntoView({ block: 'start', behavior: 'instant' }); }
    catch (e) { el.scrollIntoView(true); }
  }

  function render(route, moveFocus) {
    var prev = current;
    current = route;

    chooser.hidden = !!route;
    var focusTarget = null;
    var scrollTarget = null;

    states.forEach(function (section) {
      var active = !!route && section.id === route.state;
      section.hidden = !active;
      if (!active) return;

      Array.prototype.forEach.call(section.querySelectorAll('.dh-ex'), function (ex) {
        ex.hidden = ex.getAttribute('data-kind') !== route.kind;
      });
      var done = section.querySelector('.dh-done');
      done.hidden = route.kind !== 'done';

      if (route.kind === 'done') {
        // Після додаткової вправи пропонуємо повернутися до основної, а не повторювати ту саму
        var fromExtra = prev && prev.state === route.state && prev.kind === 'extra';
        section.querySelector('[data-done-extra]').hidden = fromExtra;
        section.querySelector('[data-done-main]').hidden = !fromExtra;
      }

      if (route.kind === 'main') {
        focusTarget = section.querySelector('h2');
        scrollTarget = null; // на початок сторінки: так видно смугу «Потрібна термінова допомога»
      } else {
        var block = route.kind === 'done' ? done : section.querySelector('.dh-ex[data-kind="' + route.kind + '"]');
        focusTarget = block.querySelector('h3');
        scrollTarget = block;
      }
    });

    if (!route) {
      focusTarget = document.getElementById('dh-title');
      scrollTarget = null;
    }

    if (moveFocus && focusTarget) {
      // Після кадру: прихований тепер елемент, з якого перейшли, не забирає фокус назад на <body>
      var el = focusTarget;
      var doFocus = function () {
        try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
      };
      doFocus();
      (window.requestAnimationFrame || setTimeout)(function () {
        if (document.activeElement !== el) doFocus();
      });
    }
    return scrollTarget;
  }

  // Перше відкриття: показати стан з адреси, без перехоплення фокусу
  var initial = parse(location.hash);
  var target = render(initial, false);
  if (initial || (location.hash && location.hash !== '#vybir')) scrollTo(target);

  window.addEventListener('hashchange', function () {
    var route = parse(location.hash);
    scrollTo(render(route, true));
  });

  // «Зберегти або роздрукувати» — друкує лише поточну вправу (або картку)
  root.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('[data-print]') : null;
    if (!btn) return;
    var ex = btn.closest('.dh-ex');
    var section = btn.closest('.dh-state');
    root.classList.add('dh-print-mode');
    section.classList.add('dh-printing');
    ex.classList.add('dh-print-target');
    var cleaned = false;
    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      root.classList.remove('dh-print-mode');
      section.classList.remove('dh-printing');
      ex.classList.remove('dh-print-target');
    }
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print(); // класи впливають лише на друк, тож без afterprint нічого не ламається
  });

  // Офлайн-доступ: service worker лише для /dopomoha/
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('/dopomoha/sw.js', { scope: '/dopomoha/' }).then(function () {
      return navigator.serviceWorker.ready;
    }).then(function () {
      var note = root.querySelector('.dh-offline');
      if (note) note.hidden = false;
    }).catch(function () { /* без офлайну сторінка працює як звичайно */ });
  }
})();
