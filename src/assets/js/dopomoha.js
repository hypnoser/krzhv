/* /dopomoha/ — покроковий майстер (поступове покращення).
   Без JS усі кроки видно списком, переходи працюють звичайними якорями.
   З JS показується один крок. Адреса (#tryvoha, #tryvoha-mozhu, #tryvoha-end…) — єдине джерело стану:
   посилання, оновлення сторінки й «Назад» у браузері працюють однаково.
   Таймер і дихальне коло працюють лише в браузері. Нічого не зберігається і нікуди не надсилається. */
(function () {
  var root = document.getElementById('dh');
  if (!root) return;

  var chooser = document.getElementById('vybir');
  var states = Array.prototype.slice.call(root.querySelectorAll('.dh-state'));
  var byId = {};
  states.forEach(function (s) {
    var aliases = {};
    try { aliases = JSON.parse(s.getAttribute('data-aliases') || '{}'); } catch (e) {}
    byId[s.id] = { el: s, start: s.getAttribute('data-start'), aliases: aliases };
  });
  var trail = []; // пройдені в цьому відвідуванні кроки — для кнопки «Назад»

  root.classList.add('dh-js');
  Array.prototype.forEach.call(root.querySelectorAll('[data-back], [data-print], [data-timer-start], [data-breath-toggle]'), function (el) {
    el.hidden = false;
  });

  function parse(hash) {
    var h = (hash || '').replace(/^#/, '');
    try { h = decodeURIComponent(h); } catch (e) { return null; }
    if (byId[h]) return { state: h, key: byId[h].start };
    for (var id in byId) {
      if (h.indexOf(id + '-') !== 0) continue;
      var key = h.slice(id.length + 1);
      if (byId[id].aliases[key]) key = byId[id].aliases[key];
      if (document.getElementById(id + '-' + key)) return { state: id, key: key };
    }
    return null; // невідомий фрагмент або #vybir — показуємо вибір
  }

  function scrollTop() {
    try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch (e) { window.scrollTo(0, 0); }
  }

  function focusEl(el) {
    if (!el) return;
    var go = function () { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } };
    go();
    (window.requestAnimationFrame || setTimeout)(function () { if (document.activeElement !== el) go(); });
  }

  function render(route, moveFocus) {
    stopAll();
    chooser.hidden = !!route;
    var target = null;
    states.forEach(function (section) {
      var active = !!route && section.id === route.state;
      section.hidden = !active;
      if (!active) return;
      Array.prototype.forEach.call(section.querySelectorAll('.dh-step'), function (step) {
        var on = step.getAttribute('data-key') === route.key;
        step.hidden = !on;
        if (on) target = step;
      });
      // На першому кроці «Назад» веде до вибору стану
      var back = target && target.querySelector('[data-back]');
      if (back) back.hidden = route.key === byId[route.state].start && trail.length < 2;
    });
    if (moveFocus) focusEl(route ? target.querySelector('h3') : document.getElementById('dh-title'));
    scrollTop();
  }

  function go() {
    var route = parse(location.hash);
    if (route) {
      var mark = route.state + '-' + route.key;
      if (trail[trail.length - 1] !== mark) trail.push(mark);
    } else {
      trail = [];
    }
    return route;
  }

  var initial = go();
  render(initial, false);
  // Браузер сам прокручує до якоря після завантаження — повертаємо сторінку на початок,
  // щоб було видно смугу термінової допомоги й назву стану
  if (location.hash) {
    (window.requestAnimationFrame || setTimeout)(scrollTop);
    window.addEventListener('load', function () { setTimeout(scrollTop, 0); }, { once: true });
  }

  window.addEventListener('hashchange', function () {
    var route = go();
    render(route, true);
  });

  root.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-back], [data-print], [data-timer-start], [data-breath-toggle]') : null;
    if (!t) return;
    if (t.hasAttribute('data-back')) {
      if (trail.length > 1) {
        trail.pop();
        location.hash = trail.pop();
      } else {
        var r = parse(location.hash);
        location.hash = r && r.key !== byId[r.state].start ? r.state : 'vybir';
      }
    } else if (t.hasAttribute('data-print')) {
      printState(t.closest('.dh-state'), t.closest('.dh-step'));
    } else if (t.hasAttribute('data-timer-start')) {
      startTimer(t.closest('.dh-timer'));
    } else if (t.hasAttribute('data-breath-toggle')) {
      toggleBreath(t.closest('.dh-breath'));
    }
  });

  // Друк: картка паніки — лише вона; з фінального екрана — усі кроки стану
  function printState(section, step) {
    root.classList.add('dh-print-mode');
    section.classList.add('dh-printing');
    if (step && step.classList.contains('dh-step-card')) step.classList.add('dh-print-target');
    else section.classList.add('dh-print-all');
    window.addEventListener('afterprint', function () {
      root.classList.remove('dh-print-mode');
      section.classList.remove('dh-printing', 'dh-print-all');
      if (step) step.classList.remove('dh-print-target');
    }, { once: true });
    window.print();
  }

  /* ---------- Таймер «відкласти на 5 хвилин» ---------- */
  var timer = null;
  function fmt(s) { var m = Math.floor(s / 60), r = s % 60; return m + ':' + (r < 10 ? '0' : '') + r; }
  function startTimer(box) {
    var total = parseInt(box.getAttribute('data-timer'), 10) || 300;
    var end = Date.now() + total * 1000;
    var timeEl = box.querySelector('.dh-timer-time');
    var bar = box.querySelector('.dh-timer-bar');
    var btn = box.querySelector('[data-timer-start]');
    var done = box.querySelector('.dh-timer-done');
    var after = box.parentNode.querySelector('.dh-after');
    btn.hidden = true;
    done.hidden = true;
    box.classList.add('running');
    function tick() {
      var left = Math.max(0, Math.round((end - Date.now()) / 1000));
      timeEl.textContent = fmt(left);
      bar.style.strokeDashoffset = String(100 - (left / total) * 100);
      if (left <= 0) {
        stopTimer();
        box.classList.remove('running');
        done.textContent = '5 хвилин минуло.';
        done.hidden = false;
        if (after) after.hidden = false;
        btn.textContent = 'Ще раз';
        btn.hidden = false;
      }
    }
    stopTimer();
    tick();
    timer = setInterval(tick, 1000);
  }
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
  function resetTimers() {
    stopTimer();
    Array.prototype.forEach.call(root.querySelectorAll('.dh-timer'), function (box) {
      box.classList.remove('running');
      box.querySelector('.dh-timer-time').textContent = '5:00';
      box.querySelector('.dh-timer-bar').style.strokeDashoffset = '0';
      var btn = box.querySelector('[data-timer-start]');
      btn.textContent = 'Запустити таймер';
      box.querySelector('.dh-timer-done').hidden = true;
      var after = box.parentNode.querySelector('.dh-after');
      if (after) after.hidden = true;
    });
  }

  // До запуску таймера підсумок «помітьте, яким стало бажання» схований
  Array.prototype.forEach.call(root.querySelectorAll('.dh-timer'), function (box) {
    var after = box.parentNode.querySelector('.dh-after');
    if (after) after.hidden = true;
  });

  /* ---------- Дихальне коло ---------- */
  var breath = null;
  function toggleBreath(box) {
    if (breath && breath.box === box) { stopBreath(); return; }
    stopBreath();
    var word = box.querySelector('.dh-breath-word');
    var btn = box.querySelector('[data-breath-toggle]');
    var phase = 0;
    box.classList.add('running', 'inhale');
    word.textContent = 'Вдих';
    btn.textContent = 'Зупинити';
    breath = {
      box: box,
      id: setInterval(function () {
        phase = 1 - phase;
        box.classList.toggle('inhale', phase === 0);
        box.classList.toggle('exhale', phase === 1);
        word.textContent = phase === 0 ? 'Вдих' : 'Видих';
      }, 5000),
    };
  }
  function stopBreath() {
    if (!breath) return;
    clearInterval(breath.id);
    breath.box.classList.remove('running', 'inhale', 'exhale');
    breath.box.querySelector('.dh-breath-word').textContent = 'Вдих';
    breath.box.querySelector('[data-breath-toggle]').textContent = 'Почати';
    breath = null;
  }

  function stopAll() { stopBreath(); resetTimers(); }

  /* ---------- Офлайн-доступ: service worker лише для /dopomoha/ ---------- */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('/dopomoha/sw.js', { scope: '/dopomoha/' }).then(function () {
      return navigator.serviceWorker.ready;
    }).then(function () {
      var note = root.querySelector('.dh-offline');
      if (note) note.hidden = false;
    }).catch(function () { /* без офлайну сторінка працює як звичайно */ });
  }
})();
