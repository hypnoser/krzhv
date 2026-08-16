(function () {
  var data = window.KVIZ_DATA;
  var app = document.getElementById('kviz-app');
  if (!data || !app) return;

  var answers = new Array(data.questions.length).fill(null);
  var currentStep = 0; // 0..N-1 = questions, N = result

  function render() {
    if (currentStep < data.questions.length) {
      renderQuestion(currentStep);
    } else {
      renderResult();
    }
  }

  function renderQuestion(idx) {
    var q = data.questions[idx];
    var progress = Math.round((idx / data.questions.length) * 100);
    var html = '';
    html += '<div class="kviz-progress"><div class="kviz-progress-bar" style="width:' + progress + '%"></div></div>';
    html += '<div class="kviz-progress-label">Питання ' + (idx + 1) + ' з ' + data.questions.length + '</div>';
    html += '<div class="kviz-question">';
    html += '<h2>' + q.text + '</h2>';
    html += '<div class="kviz-options">';
    data.options.forEach(function (opt, optIdx) {
      var selected = answers[idx] === optIdx ? ' selected' : '';
      html += '<button class="kviz-option' + selected + '" data-value="' + optIdx + '">' + opt + '</button>';
    });
    html += '</div>';
    html += '<div class="kviz-nav">';
    html += '<button class="kviz-btn-back" ' + (idx === 0 ? 'disabled' : '') + '>← Назад</button>';
    html += '</div>';
    html += '</div>';
    app.innerHTML = html;

    app.querySelectorAll('.kviz-option').forEach(function (btn) {
      btn.addEventListener('click', function () {
        answers[idx] = parseInt(btn.getAttribute('data-value'), 10);
        currentStep = idx + 1;
        render();
        window.scrollTo({ top: app.offsetTop - 100, behavior: 'smooth' });
      });
    });
    var backBtn = app.querySelector('.kviz-btn-back');
    if (backBtn && idx > 0) {
      backBtn.addEventListener('click', function () {
        currentStep = idx - 1;
        render();
      });
    }
  }

  function renderResult() {
    var total = answers.reduce(function (sum, a) { return sum + (a || 0); }, 0);
    var band = data.bands.find(function (b) { return total >= b.min && total <= b.max; });

    // Crisis check: if a risk question index is defined and answer > 0, show crisis block
    var showCrisis = false;
    if (typeof data.riskQuestionIndex === 'number') {
      var riskAnswer = answers[data.riskQuestionIndex];
      if (riskAnswer !== null && riskAnswer > 0) showCrisis = true;
    }

    var html = '<div class="kviz-result">';
    html += '<div class="kviz-result-score">';
    html += '<div class="kviz-result-num">' + total + '</div>';
    html += '<div class="kviz-result-max">з ' + data.maxScore + '</div>';
    html += '</div>';
    html += '<h2 class="kviz-result-band" style="color:' + band.color + '">' + band.label + '</h2>';
    html += '<p class="kviz-result-desc">' + band.description + '</p>';

    if (showCrisis) {
      html += '<div class="kviz-crisis">';
      html += '<strong>Якщо зараз важко — це важливо.</strong> ';
      html += 'Безкоштовна лінія психологічної підтримки в Україні: <a href="tel:0800500335">0-800-500-335</a>, цілодобово. ';
      html += 'Ви також можете написати мені напряму: <a href="https://t.me/krzhvs">Telegram</a>.';
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
      answers = new Array(data.questions.length).fill(null);
      currentStep = 0;
      render();
    });
  }

  render();
})();
