// Grace.AI — Bible Study Builder

(function() {
  var form = document.getElementById('study-form');
  var stepSetup = document.getElementById('step-setup');
  var stepLoading = document.getElementById('step-loading');
  var stepOutput = document.getElementById('step-output');
  var loadingStatus = document.getElementById('loading-status');
  var generateBtn = document.getElementById('generate-btn');
  var dayCardsEl = document.getElementById('day-cards');
  var outputTitle = document.getElementById('output-title');
  var outputOverview = document.getElementById('output-overview');

  var dots = [
    document.getElementById('step-dot-1'),
    document.getElementById('step-dot-2'),
    document.getElementById('step-dot-3')
  ];
  var lines = [
    document.getElementById('step-line-1'),
    document.getElementById('step-line-2')
  ];

  function setStep(num) {
    dots.forEach(function(d, i) {
      d.classList.remove('active', 'completed');
      if (i + 1 === num) d.classList.add('active');
      else if (i + 1 < num) d.classList.add('completed');
    });
    lines.forEach(function(l, i) {
      l.classList.toggle('completed', i + 1 < num);
    });

    stepSetup.style.display = num === 1 ? 'block' : 'none';
    stepLoading.classList.toggle('active', num === 2);
    stepLoading.style.display = num === 2 ? 'flex' : 'none';
    stepOutput.classList.toggle('active', num === 3);
  }

  var statusMessages = [
    'Selecting passages...',
    'Building study structure...',
    'Writing discussion questions...',
    'Adding confessional anchors...',
    'Finalizing your study...'
  ];

  function animateLoading() {
    var idx = 0;
    loadingStatus.textContent = statusMessages[0];
    return setInterval(function() {
      idx = (idx + 1) % statusMessages.length;
      loadingStatus.textContent = statusMessages[idx];
    }, 2500);
  }

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    var topic = document.getElementById('study-topic').value.trim();
    if (!topic) return;

    var audience = document.querySelector('input[name="audience"]:checked').value;
    var length = document.querySelector('input[name="length"]:checked').value;
    var depth = document.querySelector('input[name="depth"]:checked').value;

    generateBtn.disabled = true;
    setStep(2);
    var loadInterval = animateLoading();

    try {
      var response = await fetch('/.netlify/functions/study-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic, audience: audience, length: length, depth: depth })
      });

      if (!response.ok) throw new Error('Generation failed');
      var data = await response.json();

      clearInterval(loadInterval);
      renderStudy(data.study);
      setStep(3);

      if (typeof postToAllGroups === 'function') {
        postToAllGroups('study_completed', {
          title: data.study.title,
          days: data.study.days ? data.study.days.length : 0
        }).catch(function() {});
      }
    } catch (err) {
      clearInterval(loadInterval);
      loadingStatus.textContent = 'Something went wrong. Please try again.';
      setTimeout(function() {
        setStep(1);
        generateBtn.disabled = false;
      }, 2000);
    }
  });

  var currentStudyData = null;

  function renderStudy(study) {
    currentStudyData = study;
    outputTitle.textContent = study.title;
    outputOverview.textContent = study.overview;
    dayCardsEl.innerHTML = '';

    study.days.forEach(function(day) {
      var card = document.createElement('div');
      card.className = 'day-card';

      var obsHtml = listHtml(day.observation_questions, 'ol');
      var interpHtml = listHtml(day.interpretation_questions, 'ol');
      var appHtml = listHtml(day.application_prompts, 'ul');

      var anchorHtml = '';
      if (day.confessional_anchor) {
        anchorHtml = '<div class="confessional-anchor">' +
          '<div class="anchor-source">' + esc(day.confessional_anchor.source) + '</div>' +
          '<div class="anchor-quote">"' + esc(day.confessional_anchor.quote) + '"</div>' +
          '</div>';
      }

      var quoteHtml = '';
      if (day.theologian_quote) {
        quoteHtml = '<div class="theologian-quote">' +
          '<blockquote>"' + esc(day.theologian_quote.quote) + '"</blockquote>' +
          '<cite>' + esc(day.theologian_quote.author) + (day.theologian_quote.source ? ', ' + esc(day.theologian_quote.source) : '') + '</cite>' +
          '</div>';
      }

      card.innerHTML =
        '<div class="day-card-header">' +
          '<div class="day-number">' + day.day + '</div>' +
          '<h3>' + esc(day.title) + '</h3>' +
        '</div>' +
        '<div class="day-passage">' +
          '<div class="passage-label">Primary Passage</div>' +
          '<div class="passage-ref">' + esc(day.passage) + '</div>' +
        '</div>' +
        '<div class="day-section"><h4>Observation Questions</h4>' + obsHtml + '</div>' +
        '<div class="day-section"><h4>Interpretation Questions</h4>' + interpHtml + '</div>' +
        '<div class="day-section"><h4>Application &amp; Journaling</h4>' + appHtml + '</div>' +
        anchorHtml + quoteHtml;

      dayCardsEl.appendChild(card);
    });

    generateBtn.disabled = false;
  }

  function listHtml(items, tag) {
    if (!items || !items.length) return '';
    var html = '<' + tag + '>';
    items.forEach(function(item) {
      html += '<li>' + esc(item) + '</li>';
    });
    html += '</' + tag + '>';
    return html;
  }

  function esc(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // New Study button
  document.getElementById('btn-new-study').addEventListener('click', function() {
    setStep(1);
    document.getElementById('study-topic').value = '';
    document.getElementById('study-topic').focus();
  });

  // Save button
  document.getElementById('btn-save-study').addEventListener('click', async function() {
    if (!currentStudyData) return;
    if (typeof saveStudy !== 'function') return;

    var user = await getUser();
    if (!user) {
      if (typeof openAuthModal === 'function') openAuthModal('signin');
      return;
    }

    var btn = document.getElementById('btn-save-study');
    var origHtml = btn.innerHTML;
    btn.textContent = 'Saving...';
    btn.disabled = true;

    try {
      await saveStudy(currentStudyData.title, currentStudyData);
      btn.textContent = 'Saved!';
      setTimeout(function() { btn.innerHTML = origHtml; btn.disabled = false; }, 2000);
    } catch (e) {
      btn.textContent = 'Save failed';
      setTimeout(function() { btn.innerHTML = origHtml; btn.disabled = false; }, 2000);
    }
  });

  // Export PDF button
  document.getElementById('btn-print').addEventListener('click', function() {
    window.print();
  });
})();
