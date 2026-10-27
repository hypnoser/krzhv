(function () {
  var data = window.KVIZ_DATA;
  var app = document.getElementById('kviz-app');
  if (!data || !app) return;

  /* Дані квізу (frontmatter quizData):
     options        — підписи відповідей за замовчуванням; q.options перекриває їх для окремого питання
     optionValues   — бали відповідей (за замовчуванням 0,1,2…); q.optionValues перекриває
     q.reverse      — зворотний пункт: бал = (мін + макс) − бал відповіді
     q.meta         — питання не входить у бали (напр. «чи працюєте ви з людьми?»)
     q.showIf       — {q: індекс, in: [індекси відповідей]}: питання показується лише за таких відповідей
     total          — {label, multiplier, max, bands:[…]} загальний результат (без scales: старий режим sum)
     scales         — [{title, items:[індекси], calc:'sum'|'mean', max, note, bands:[…], needs:[індекси]}]
     summary        — текст під результатами
     riskQuestionIndex — питання, відповідь на яке >0 показує кризовий блок (без змін) */
  var Q = data.questions, N = Q.length;
  var answers = new Array(N).fill(null);
  var current = 0; // індекс питання, N = результат

  function visible(i) {
    var q = Q[i];
    if (!q.showIf) return true;
    var a = answers[q.showIf.q];
    return a !== null && q.showIf.in.indexOf(a) >= 0;
  }
  function nextFrom(i) { for (var j = i; j < N; j++) if (visible(j)) return j; return N; }
  function prevFrom(i) { for (var j = i; j >= 0; j--) if (visible(j)) return j; return -1; }
  function optsOf(q) { return q.options || data.options; }
  function valsOf(q) {
    if (q.optionValues) return q.optionValues;
    if (data.optionValues && !q.options) return data.optionValues;
    return optsOf(q).map(function (_, i) { return i; });
  }
  function valueOf(i) {
    var q = Q[i], a = answers[i];
    if (a === null || !visible(i)) return null;
    var vals = valsOf(q), v = vals[a];
    if (q.reverse) v = Math.max.apply(null, vals) + Math.min.apply(null, vals) - v;
    return v;
  }
  function firstOf(i) { return nextFrom(0) === i; }

  function render() {
    if (current < N) renderQuestion(current); else renderResult();
  }

  function renderQuestion(idx) {
    var q = Q[idx];
    var vis = []; for (var k = 0; k < N; k++) if (visible(k)) vis.push(k);
    var pos = vis.indexOf(idx), total = vis.length;
    var progress = Math.round((pos / total) * 100);
    var html = '';
    html += '<div class="kviz-progress"><div class="kviz-progress-bar" style="width:' + progress + '%"></div></div>';
    html += '<div class="kviz-progress-label">Питання ' + (pos + 1) + ' з ' + total + '</div>';
    html += '<div class="kviz-question">';
    if (data.instruction && pos === 0) html += '<p class="kviz-instruction">' + data.instruction + '</p>';
    html += '<h2>' + q.text + '</h2>';
    html += '<div class="kviz-options">';
    optsOf(q).forEach(function (opt, optIdx) {
      var selected = answers[idx] === optIdx ? ' selected' : '';
      html += '<button class="kviz-option' + selected + '" data-value="' + optIdx + '">' + opt + '</button>';
    });
    html += '</div>';
    html += '<div class="kviz-nav">';
    html += '<button class="kviz-btn-back" ' + (firstOf(idx) ? 'disabled' : '') + '>← Назад</button>';
    html += '</div>';
    html += '</div>';
    app.innerHTML = html;

    app.querySelectorAll('.kviz-option').forEach(function (btn) {
      btn.addEventListener('click', function () {
        answers[idx] = parseInt(btn.getAttribute('data-value'), 10);
        current = nextFrom(idx + 1);
        render();
        window.scrollTo({ top: app.offsetTop - 100, behavior: 'smooth' });
      });
    });
    var backBtn = app.querySelector('.kviz-btn-back');
    if (backBtn && !firstOf(idx)) {
      backBtn.addEventListener('click', function () {
        current = prevFrom(idx - 1);
        render();
      });
    }
  }

  function bandOf(bands, score) {
    return (bands || []).find(function (b) { return score >= b.min && score <= b.max; });
  }
  function fmt(n) { return String(Math.round(n * 10) / 10).replace('.', ','); }

  function scaleValue(sc) {
    var vals = [];
    sc.items.forEach(function (i) { var v = valueOf(i); if (v !== null) vals.push(v); });
    if (!vals.length) return null;
    var s = vals.reduce(function (a, b) { return a + b; }, 0);
    return sc.calc === 'mean' ? s / vals.length : s;
  }

  function renderResult() {
    var html = '<div class="kviz-result">';
    var legacy = !data.scales && !data.total;

    if (legacy) {
      var total0 = 0;
      for (var i = 0; i < N; i++) { var v0 = valueOf(i); total0 += v0 || 0; }
      var band0 = bandOf(data.bands, total0);
      html += '<div class="kviz-result-score">';
      html += '<div class="kviz-result-num">' + total0 + '</div>';
      html += '<div class="kviz-result-max">з ' + data.maxScore + '</div>';
      html += '</div>';
      html += '<h2 class="kviz-result-band" style="color:' + band0.color + '">' + band0.label + '</h2>';
      html += '<p class="kviz-result-desc">' + band0.description + '</p>';
    } else {
      if (data.total) {
        var t = data.total, sum = 0;
        for (var j = 0; j < N; j++) { if (Q[j].meta) continue; var vj = valueOf(j); sum += vj || 0; }
        if (t.items) { sum = 0; t.items.forEach(function (ii) { sum += valueOf(ii) || 0; }); }
        var tv = sum * (t.multiplier || 1);
        var tb = bandOf(t.bands, tv);
        html += '<div class="kviz-result-score">';
        html += '<div class="kviz-result-num">' + fmt(tv) + '</div>';
        html += '<div class="kviz-result-max">з ' + t.max + (t.label ? ' · ' + t.label : '') + '</div>';
        html += '</div>';
        if (tb) {
          html += '<h2 class="kviz-result-band" style="color:' + tb.color + '">' + tb.label + '</h2>';
          html += '<p class="kviz-result-desc">' + tb.description + '</p>';
        }
      }
      if (data.scales) {
        html += '<div class="kviz-scales">';
        data.scales.forEach(function (sc) {
          if (sc.needs && sc.needs.some(function (i) { return !visible(i); })) return;
          var sv = scaleValue(sc);
          if (sv === null) return;
          var pct = Math.max(0, Math.min(100, (sv - (sc.min || 0)) / (sc.max - (sc.min || 0)) * 100));
          var sb = bandOf(sc.bands, sv);
          html += '<div class="kviz-scale">';
          html += '<div class="kviz-scale-head"><span class="kviz-scale-title">' + sc.title + '</span><span class="kviz-scale-num">' + fmt(sv) + ' <small>з ' + sc.max + '</small></span></div>';
          html += '<div class="kviz-scale-bar"><div style="width:' + pct + '%' + (sb ? ';background:' + sb.color : '') + '"></div></div>';
          if (sb) html += '<div class="kviz-scale-band" style="color:' + sb.color + '">' + sb.label + '</div>';
          if (sc.note) html += '<p class="kviz-scale-note">' + sc.note + '</p>';
          html += '</div>';
        });
        html += '</div>';
      }
      if (data.summary) html += '<p class="kviz-result-desc">' + data.summary + '</p>';
    }

    // Кризовий блок: якщо визначено питання ризику й відповідь > 0
    var showCrisis = false;
    if (typeof data.riskQuestionIndex === 'number') {
      var riskAnswer = answers[data.riskQuestionIndex];
      if (riskAnswer !== null && riskAnswer > 0) showCrisis = true;
    }
    if (showCrisis) {
      html += '<div class="kviz-crisis">';
      html += '<strong>Якщо зараз важко — це важливо.</strong> ';
      html += 'Контакти екстреної допомоги та ліній підтримки: <a href="/help/">сторінка «Термінова допомога»</a>. ';
      html += 'Ви також можете написати мені напряму: <a href="https://t.me/krzhv_bot?start=site_kviz-' + (location.pathname.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(5, 40) || 'result') + '_result">Telegram</a>.';
      html += '</div>';
    }

    html += '<div class="kviz-result-cta">';
    html += '<a href="/#contact" class="btn-primary">Записатись на консультацію</a>';
    html += '<a href="/" class="btn-ghost">На головну</a>';
    html += '</div>';

    html += '<button class="kviz-restart">Пройти ще раз</button>';
    html += '</div>';
    app.innerHTML = html;

    app.querySelector('.kviz-restart').addEventListener('click', function () {
      answers = new Array(N).fill(null);
      current = nextFrom(0);
      render();
    });
  }

  current = nextFrom(0);
  render();
})();
