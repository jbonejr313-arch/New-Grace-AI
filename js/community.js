// Grace.AI — Community Page (v2)

(function() {
  var signinEl = document.getElementById('community-signin');
  var nameSetup = document.getElementById('name-setup');
  var mainEl = document.getElementById('community-main');
  var onboardingEl = document.getElementById('onboarding');
  var groupsView = document.getElementById('groups-view');
  var groupDetail = document.getElementById('group-detail');
  var groupsGrid = document.getElementById('groups-grid');
  var feedList = document.getElementById('feed-list');
  var currentGroupId = null;
  var currentGroupRole = null;
  var currentUserId = null;
  var pendingPhotoFile = null;

  // ── Helpers ──
  function timeAgo(dateStr) {
    var now = Date.now();
    var then = new Date(dateStr).getTime();
    var diff = Math.floor((now - then) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 172800) return 'yesterday';
    return Math.floor(diff / 86400) + 'd ago';
  }

  function esc(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ── Init ──
  function init() {
    if (typeof onAuthStateChange === 'function') {
      onAuthStateChange(function(event) {
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          checkAuth();
        }
      });
    }
    setTimeout(checkAuth, 500);
  }

  async function checkAuth() {
    var user = null;
    try { user = await getUser(); } catch (e) { user = null; }

    if (!user) {
      signinEl.style.display = 'block';
      mainEl.style.display = 'none';
      nameSetup.style.display = 'none';
      onboardingEl.style.display = 'none';
      return;
    }

    currentUserId = user.id;
    signinEl.style.display = 'none';

    try {
      var displayName = await getDisplayName();
      if (!displayName || displayName === user.email.split('@')[0]) {
        nameSetup.style.display = 'block';
        document.getElementById('display-name-input').value = displayName || '';
      } else {
        nameSetup.style.display = 'none';
      }

      // Check onboarding
      var groups = await getMyGroups();
      var onboarded = await isOnboardingComplete();
      if (!onboarded && groups.length === 0) {
        onboardingEl.style.display = 'flex';
        mainEl.style.display = 'none';
        return;
      }
    } catch (e) {
      // Never strand a signed-in user on a blank page — if any check fails
      // (slow connection, transient error), still show the main view so the
      // Create / Join buttons and feed are available.
      console.error('Community init partial failure:', e);
      nameSetup.style.display = 'none';
    }

    onboardingEl.style.display = 'none';
    mainEl.style.display = 'block';
    try { loadGroups(); } catch (e) {}
    try { loadFeed(); } catch (e) {}
  }

  // ── Display Name ──
  document.getElementById('save-name-btn').addEventListener('click', async function() {
    var name = document.getElementById('display-name-input').value.trim();
    if (!name) return;
    await setDisplayName(name);
    nameSetup.style.display = 'none';
  });

  // ── Onboarding ──
  document.getElementById('onboard-create').addEventListener('click', function() {
    onboardingEl.style.display = 'none';
    mainEl.style.display = 'block';
    loadGroups();
    loadFeed();
    document.getElementById('btn-create-group').click();
  });

  document.getElementById('onboard-join').addEventListener('click', function() {
    onboardingEl.style.display = 'none';
    mainEl.style.display = 'block';
    loadGroups();
    loadFeed();
    document.getElementById('btn-join-group').click();
  });

  document.getElementById('onboard-skip').addEventListener('click', function(e) {
    e.preventDefault();
    completeOnboarding();
    onboardingEl.style.display = 'none';
    mainEl.style.display = 'block';
    loadGroups();
    loadFeed();
  });

  // ── Load Groups ──
  async function loadGroups() {
    var groups = await getMyGroups();
    if (groups.length === 0) {
      groupsGrid.innerHTML =
        '<div class="groups-empty">' +
          '<p>You haven\'t joined any groups yet. Create one or join with an invite code.</p>' +
          '<div style="display:flex;gap:var(--space-3);justify-content:center;">' +
            '<button class="btn btn-primary" onclick="document.getElementById(\'btn-create-group\').click()">Create a Group</button>' +
            '<button class="btn btn-secondary" onclick="document.getElementById(\'btn-join-group\').click()">Join a Group</button>' +
          '</div>' +
        '</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      var count = await getGroupMemberCount(g.id);
      html +=
        '<div class="group-card" data-group-id="' + g.id + '">' +
          '<div class="group-card-name">' + esc(g.name) + '</div>' +
          '<div class="group-card-desc">' + esc(g.description || 'No description') + '</div>' +
          '<div class="group-card-meta">' +
            '<span>' + count + ' member' + (count !== 1 ? 's' : '') + '</span>' +
            (g.role === 'leader' ? '<span class="group-card-role">Leader</span>' : '') +
          '</div>' +
        '</div>';
    }
    groupsGrid.innerHTML = html;

    var cards = groupsGrid.querySelectorAll('.group-card');
    for (var j = 0; j < cards.length; j++) {
      cards[j].addEventListener('click', function() {
        openGroupDetail(this.getAttribute('data-group-id'));
      });
    }
  }

  // ── Load Feed ──
  async function loadFeed(groupId) {
    var targetEl = groupId ? document.getElementById('group-feed-list') : feedList;
    targetEl.innerHTML = '<div class="feed-empty">Loading...</div>';

    var feed = await getFeed(groupId, 30);
    if (feed.length === 0) {
      targetEl.innerHTML = '<div class="feed-empty">No activity yet. Share a post or complete a study to get started.</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < feed.length; i++) {
      html += renderFeedItem(feed[i]);
    }
    targetEl.innerHTML = html;
    bindReactions(targetEl);
    bindPrayerAnswered(targetEl);
  }

  function renderFeedItem(item) {
    var initial = item.is_anonymous ? '?' : (item.display_name ? item.display_name.charAt(0).toUpperCase() : '?');
    var avatarClass = item.is_anonymous ? ' feed-avatar-anon' : '';
    var bodyHtml = '';

    switch (item.activity_type) {
      case 'freeform_post':
        bodyHtml = '<div class="feed-post-text">' + esc(item.content.text || '') + '</div>';
        break;
      case 'prayer_request':
        bodyHtml = '<div class="feed-prayer-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg> Prayer Request' +
          (item.is_answered ? '<span class="prayer-answered-badge">Answered</span>' : '') +
          '</div>' +
          '<div class="feed-post-text">' + esc(item.content.text || '') + '</div>';
        if (!item.is_answered && item.user_id === currentUserId) {
          bodyHtml += '<button class="mark-answered-btn" data-activity-id="' + item.id + '">Mark as Answered</button>';
        }
        break;
      case 'study_completed':
        bodyHtml = '<span class="feed-highlight">' + esc(item.display_name) + '</span> completed a study: <span class="feed-highlight">' + esc(item.content.title || 'Untitled') + '</span>';
        break;
      case 'streak_milestone':
        bodyHtml = '<span class="feed-highlight">' + esc(item.display_name) + '</span> reached a <span class="feed-streak-badge">' + esc(String(item.content.days)) + '-day streak</span>';
        break;
      case 'reflection':
        bodyHtml = '<span class="feed-highlight">' + esc(item.display_name) + '</span> shared a reflection';
        if (item.content.text) {
          bodyHtml += '<div class="feed-reflection-text">"' + esc(item.content.text) + '"</div>';
        }
        break;
      case 'joined_group':
        bodyHtml = '<span class="feed-highlight">' + esc(item.content.display_name || item.display_name) + '</span> joined the group';
        break;
      case 'weekly_checkin':
        bodyHtml = '<div class="feed-checkin-question">' + esc(item.content.question || '') + '</div>' +
          '<div class="feed-post-text">' + esc(item.content.text || '') + '</div>';
        break;
      case 'reading_day_completed':
        bodyHtml = '<span class="feed-highlight">' + esc(item.display_name) + '</span> completed Day ' + esc(String(item.content.day || '')) + ' of <span class="feed-highlight">' + esc(item.content.title || '') + '</span>';
        break;
      case 'reading_plan_completed':
        bodyHtml = '<span class="feed-highlight">' + esc(item.display_name) + '</span> finished the reading plan <span class="feed-highlight">' + esc(item.content.title || '') + '</span>';
        break;
      default:
        bodyHtml = '<span class="feed-highlight">' + esc(item.display_name) + '</span> did something';
    }

    var imgHtml = '';
    if (item.image_url) {
      imgHtml = '<img class="feed-image" src="' + esc(item.image_url) + '" alt="Shared photo" loading="lazy">';
    }

    var amenActive = item.reactions.user_amen ? ' active' : '';
    var prayingActive = item.reactions.user_praying ? ' active' : '';

    return (
      '<div class="feed-item" data-activity-id="' + item.id + '">' +
        '<div class="feed-item-header">' +
          '<div class="feed-avatar' + avatarClass + '">' + initial + '</div>' +
          '<div class="feed-meta">' +
            '<div class="feed-user">' + esc(item.display_name) + '</div>' +
            '<div class="feed-time">' + timeAgo(item.created_at) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="feed-body">' + bodyHtml + '</div>' +
        imgHtml +
        '<div class="feed-reactions">' +
          '<button class="reaction-btn' + amenActive + '" data-type="amen">' +
            '<span class="reaction-emoji">&#128591;</span> Amen' +
            (item.reactions.amen > 0 ? ' <span class="reaction-count">' + item.reactions.amen + '</span>' : '') +
          '</button>' +
          '<button class="reaction-btn' + prayingActive + '" data-type="praying">' +
            '<span class="reaction-emoji">&#128591;</span> Praying' +
            (item.reactions.praying > 0 ? ' <span class="reaction-count">' + item.reactions.praying + '</span>' : '') +
          '</button>' +
        '</div>' +
      '</div>'
    );
  }

  function bindReactions(container) {
    var btns = container.querySelectorAll('.reaction-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function() {
        var feedItem = this.closest('.feed-item');
        var activityId = feedItem.getAttribute('data-activity-id');
        var type = this.getAttribute('data-type');
        var btn = this;
        toggleReaction(activityId, type).then(function(added) {
          btn.classList.toggle('active', added);
        });
      });
    }
  }

  function bindPrayerAnswered(container) {
    var btns = container.querySelectorAll('.mark-answered-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function() {
        var activityId = this.getAttribute('data-activity-id');
        var btn = this;
        markPrayerAnswered(activityId).then(function() {
          btn.textContent = 'Answered!';
          btn.disabled = true;
          btn.style.color = '#4ade80';
          var label = btn.closest('.feed-item').querySelector('.feed-prayer-label');
          if (label && !label.querySelector('.prayer-answered-badge')) {
            label.insertAdjacentHTML('beforeend', '<span class="prayer-answered-badge">Answered</span>');
          }
        });
      });
    }
  }

  // ── Compose Box ──
  var composeTabs = document.querySelectorAll('.compose-tab');
  var activeComposeTab = 'post';

  for (var t = 0; t < composeTabs.length; t++) {
    composeTabs[t].addEventListener('click', function() {
      for (var k = 0; k < composeTabs.length; k++) composeTabs[k].classList.remove('active');
      this.classList.add('active');
      activeComposeTab = this.getAttribute('data-tab');
      if (activeComposeTab === 'prayer') {
        document.getElementById('compose-anon-wrap').style.display = 'inline-flex';
        document.getElementById('compose-text').placeholder = 'Share a prayer request with your group...';
      } else {
        document.getElementById('compose-anon-wrap').style.display = 'none';
        document.getElementById('compose-text').placeholder = 'Share with your group...';
      }
    });
  }

  document.getElementById('compose-photo').addEventListener('change', function() {
    var file = this.files[0];
    if (!file) return;
    pendingPhotoFile = file;
    var reader = new FileReader();
    reader.onload = function(e) {
      document.getElementById('compose-preview-img').src = e.target.result;
      document.getElementById('compose-preview').style.display = 'block';
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('compose-remove-img').addEventListener('click', function() {
    pendingPhotoFile = null;
    document.getElementById('compose-preview').style.display = 'none';
    document.getElementById('compose-photo').value = '';
  });

  document.getElementById('compose-submit').addEventListener('click', async function() {
    var text = document.getElementById('compose-text').value.trim();
    if (!text && !pendingPhotoFile) return;

    var btn = this;
    btn.disabled = true;
    btn.textContent = 'Sharing...';

    try {
      var imageUrl = null;
      if (pendingPhotoFile) {
        var blob = await resizeImageAsync(pendingPhotoFile, 1200);
        imageUrl = await uploadCommunityPhoto(blob);
      }

      if (activeComposeTab === 'prayer') {
        var isAnon = document.getElementById('compose-anon').checked;
        await postPrayerRequest(currentGroupId, text, isAnon, imageUrl);
      } else {
        await postFreeform(currentGroupId, text, imageUrl);
      }

      document.getElementById('compose-text').value = '';
      pendingPhotoFile = null;
      document.getElementById('compose-preview').style.display = 'none';
      document.getElementById('compose-photo').value = '';
      document.getElementById('compose-anon').checked = false;

      loadFeed(currentGroupId);
    } catch (e) {
      console.error('Post failed:', e);
    }

    btn.disabled = false;
    btn.textContent = 'Share';
  });

  function resizeImageAsync(file, maxWidth) {
    return new Promise(function(resolve) {
      var reader = new FileReader();
      reader.onload = function(e) {
        var img = new Image();
        img.onload = function() {
          if (img.width <= maxWidth) {
            resolve(file);
            return;
          }
          var canvas = document.createElement('canvas');
          var scale = maxWidth / img.width;
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(function(blob) {
            resolve(blob);
          }, 'image/jpeg', 0.85);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // ── Weekly Check-in ──
  document.getElementById('checkin-submit').addEventListener('click', async function() {
    var text = document.getElementById('checkin-text').value.trim();
    if (!text) return;

    var btn = this;
    btn.disabled = true;
    btn.textContent = 'Sharing...';

    try {
      await postWeeklyCheckin(currentGroupId, text);
      document.getElementById('checkin-prompt').style.display = 'none';
      loadFeed(currentGroupId);
    } catch (e) {
      console.error('Check-in failed:', e);
    }

    btn.disabled = false;
    btn.textContent = 'Share';
  });

  // ── Group Detail ──
  async function openGroupDetail(groupId) {
    currentGroupId = groupId;
    groupsView.style.display = 'none';
    groupDetail.classList.add('active');

    var groups = await getMyGroups();
    var group = null;
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].id === groupId) { group = groups[i]; break; }
    }
    if (!group) return;

    currentGroupRole = group.role;

    document.getElementById('detail-name').textContent = group.name;
    document.getElementById('detail-desc').textContent = group.description || '';
    document.getElementById('detail-code').textContent = group.invite_code;

    // Invite code visible to leader
    document.getElementById('detail-invite').style.display = group.role === 'leader' ? 'flex' : 'none';

    // Leader tabs
    var tabsEl = document.getElementById('group-tabs');
    if (group.role === 'leader') {
      tabsEl.style.display = 'flex';
    } else {
      tabsEl.style.display = 'none';
    }

    // Show compose box
    document.getElementById('compose-box').style.display = 'block';

    // Members
    var members = await getGroupMembers(groupId);
    var membersHtml = '';
    for (var j = 0; j < members.length; j++) {
      var m = members[j];
      var chipClass = m.role === 'leader' ? ' member-chip-leader' : '';
      membersHtml +=
        '<div class="member-chip' + chipClass + '">' +
          '<div class="member-chip-avatar">' + esc(m.display_name.charAt(0).toUpperCase()) + '</div>' +
          '<span>' + esc(m.display_name) + '</span>' +
          (m.role === 'leader' ? '<span class="group-card-role">Leader</span>' : '') +
        '</div>';
    }
    document.getElementById('members-row').innerHTML = membersHtml;

    // Show feed tab by default
    switchTab('feed');

    // Weekly check-in prompt
    var checkedIn = await hasCheckedInThisWeek(groupId);
    if (!checkedIn) {
      document.getElementById('checkin-question').textContent = getWeeklyPrompt();
      document.getElementById('checkin-prompt').style.display = 'block';
    } else {
      document.getElementById('checkin-prompt').style.display = 'none';
    }

    // Reading plans (show for all, create button for leaders)
    loadReadingPlans(groupId);

    // Load feed
    loadFeed(groupId);

    // Mark onboarding complete
    completeOnboarding().catch(function() {});
  }

  // ── Tab Switching ──
  var tabBtns = document.querySelectorAll('.group-tab');
  for (var tb = 0; tb < tabBtns.length; tb++) {
    tabBtns[tb].addEventListener('click', function() {
      switchTab(this.getAttribute('data-tab'));
    });
  }

  function switchTab(tab) {
    var tabs = document.querySelectorAll('.group-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('active', tabs[i].getAttribute('data-tab') === tab);
    }

    document.getElementById('feed-section').style.display = tab === 'feed' ? 'block' : 'none';
    document.getElementById('compose-box').style.display = tab === 'feed' ? 'block' : 'none';
    document.getElementById('checkin-prompt').style.display = 'none';
    document.getElementById('reading-plans-section').style.display = tab === 'plans' ? 'block' : 'none';
    document.getElementById('group-stats-panel').style.display = tab === 'stats' ? 'block' : 'none';

    if (tab === 'stats') loadGroupStats();
    if (tab === 'plans') loadReadingPlans(currentGroupId);
    if (tab === 'feed') {
      hasCheckedInThisWeek(currentGroupId).then(function(done) {
        if (!done) {
          document.getElementById('checkin-question').textContent = getWeeklyPrompt();
          document.getElementById('checkin-prompt').style.display = 'block';
        }
      });
    }
  }

  // ── Group Stats ──
  async function loadGroupStats() {
    var stats = await getGroupStats(currentGroupId);
    if (!stats) return;

    document.getElementById('gstat-studies').textContent = stats.studies;
    document.getElementById('gstat-streak').textContent = stats.totalStreak;
    document.getElementById('gstat-active').textContent = stats.activeThisWeek + '/' + stats.totalMembers;
    document.getElementById('gstat-reflections').textContent = stats.reflections;
    document.getElementById('gstat-prayers').textContent = stats.prayers;
    document.getElementById('gstat-mvp').textContent = stats.mvp;
  }

  // ── Reading Plans ──
  async function loadReadingPlans(groupId) {
    var plans = await getGroupReadingPlans(groupId);
    var listEl = document.getElementById('reading-plans-list');
    var createBtn = document.getElementById('btn-create-plan');

    document.getElementById('reading-plans-section').style.display = 'block';
    createBtn.style.display = currentGroupRole === 'leader' ? 'inline-flex' : 'none';

    if (plans.length === 0) {
      listEl.innerHTML = '<div class="feed-empty">No reading plans yet.' + (currentGroupRole === 'leader' ? ' Create one to get your group reading together.' : '') + '</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < plans.length; i++) {
      var plan = plans[i];
      var myProgress = await getMyReadingProgress(plan.id);
      var allProgress = await getReadingProgress(plan.id);
      html += renderReadingPlan(plan, myProgress, allProgress);
    }
    listEl.innerHTML = html;

    // Bind day checkboxes
    var checkboxes = listEl.querySelectorAll('.reading-day-check');
    for (var c = 0; c < checkboxes.length; c++) {
      checkboxes[c].addEventListener('change', function() {
        if (!this.checked) { this.checked = true; return; }
        var planId = this.getAttribute('data-plan-id');
        var dayNum = parseInt(this.getAttribute('data-day'));
        var cb = this;
        cb.disabled = true;
        markReadingComplete(planId, dayNum, currentGroupId).then(function() {
          cb.closest('.reading-day').classList.add('completed');
        }).catch(function() {
          cb.checked = false;
          cb.disabled = false;
        });
      });
    }
  }

  function renderReadingPlan(plan, myProgress, allProgress) {
    var readings = plan.readings || [];
    var totalDays = readings.length;
    var completedDays = myProgress.length;
    var pct = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;

    var today = new Date();
    var startDate = new Date(plan.start_date);
    var daysSinceStart = Math.floor((today - startDate) / 86400000);

    var daysHtml = '';
    for (var d = 0; d < readings.length; d++) {
      var reading = readings[d];
      var dayNum = d + 1;
      var isCompleted = myProgress.indexOf(dayNum) !== -1;
      var isCurrent = dayNum === daysSinceStart + 1;
      var cls = 'reading-day' + (isCompleted ? ' completed' : '') + (isCurrent ? ' current' : '');

      daysHtml +=
        '<div class="' + cls + '">' +
          '<label class="reading-day-label">' +
            '<input type="checkbox" class="reading-day-check" data-plan-id="' + plan.id + '" data-day="' + dayNum + '"' + (isCompleted ? ' checked disabled' : '') + '>' +
            '<span class="reading-day-num">Day ' + dayNum + '</span>' +
            '<span class="reading-day-passage">' + esc(reading.passage || reading) + '</span>' +
          '</label>' +
        '</div>';
    }

    return (
      '<div class="reading-plan-card">' +
        '<div class="reading-plan-header">' +
          '<h3>' + esc(plan.title) + '</h3>' +
          (plan.description ? '<p>' + esc(plan.description) + '</p>' : '') +
        '</div>' +
        '<div class="reading-plan-progress">' +
          '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div>' +
          '<span class="progress-text">' + completedDays + '/' + totalDays + ' days (' + pct + '%)</span>' +
        '</div>' +
        '<div class="reading-days">' + daysHtml + '</div>' +
      '</div>'
    );
  }

  // ── Reading Plan Modal ──
  var planModal = document.getElementById('plan-modal');
  var planDayCount = 3;

  document.getElementById('btn-create-plan').addEventListener('click', function() {
    planModal.classList.add('open');
    document.getElementById('plan-title').focus();
    document.getElementById('plan-start').value = new Date().toISOString().split('T')[0];
  });

  document.getElementById('plan-modal-close').addEventListener('click', closePlanModal);
  document.getElementById('plan-cancel').addEventListener('click', closePlanModal);
  planModal.addEventListener('click', function(e) { if (e.target === planModal) closePlanModal(); });

  function closePlanModal() {
    planModal.classList.remove('open');
    document.getElementById('plan-title').value = '';
    document.getElementById('plan-desc').value = '';
    document.getElementById('plan-error').style.display = 'none';
    resetPlanDays();
  }

  function resetPlanDays() {
    planDayCount = 3;
    var container = document.getElementById('plan-days');
    container.innerHTML = '';
    for (var i = 1; i <= 3; i++) {
      container.innerHTML += '<div class="plan-day-row"><span class="plan-day-label">Day ' + i + '</span><input type="text" class="plan-day-input" placeholder="e.g. Romans ' + i + '"></div>';
    }
  }

  document.getElementById('plan-add-day').addEventListener('click', function() {
    planDayCount++;
    var row = document.createElement('div');
    row.className = 'plan-day-row';
    row.innerHTML = '<span class="plan-day-label">Day ' + planDayCount + '</span><input type="text" class="plan-day-input" placeholder="e.g. Romans ' + planDayCount + '">';
    document.getElementById('plan-days').appendChild(row);
  });

  document.getElementById('plan-submit').addEventListener('click', async function() {
    var title = document.getElementById('plan-title').value.trim();
    if (!title) {
      document.getElementById('plan-error').textContent = 'Please enter a plan title.';
      document.getElementById('plan-error').style.display = 'block';
      return;
    }

    var inputs = document.querySelectorAll('.plan-day-input');
    var readings = [];
    for (var i = 0; i < inputs.length; i++) {
      var val = inputs[i].value.trim();
      if (val) {
        readings.push({ day: i + 1, passage: val });
      }
    }

    if (readings.length < 1) {
      document.getElementById('plan-error').textContent = 'Add at least one reading.';
      document.getElementById('plan-error').style.display = 'block';
      return;
    }

    var btn = document.getElementById('plan-submit');
    btn.disabled = true;
    btn.textContent = 'Creating...';

    try {
      var desc = document.getElementById('plan-desc').value.trim();
      var startDate = document.getElementById('plan-start').value;
      await createReadingPlan(currentGroupId, title, desc, readings, startDate);
      closePlanModal();
      loadReadingPlans(currentGroupId);
    } catch (e) {
      document.getElementById('plan-error').textContent = e.message || 'Failed to create plan.';
      document.getElementById('plan-error').style.display = 'block';
    }

    btn.disabled = false;
    btn.textContent = 'Create Plan';
  });

  // ── Back button ──
  document.getElementById('group-back').addEventListener('click', function() {
    currentGroupId = null;
    currentGroupRole = null;
    groupDetail.classList.remove('active');
    groupsView.style.display = 'block';
    document.getElementById('compose-box').style.display = 'none';
    document.getElementById('checkin-prompt').style.display = 'none';
    document.getElementById('group-tabs').style.display = 'none';
    document.getElementById('group-stats-panel').style.display = 'none';
    document.getElementById('reading-plans-section').style.display = 'none';
    loadGroups();
    loadFeed();
  });

  document.getElementById('copy-invite').addEventListener('click', function() {
    var code = document.getElementById('detail-code').textContent;
    navigator.clipboard.writeText(code).then(function() {
      var btn = document.getElementById('copy-invite');
      btn.textContent = 'Copied!';
      setTimeout(function() { btn.textContent = 'Copy'; }, 2000);
    });
  });

  // ── Create Group Modal ──
  var createModal = document.getElementById('create-modal');

  document.getElementById('btn-create-group').addEventListener('click', function() {
    createModal.classList.add('open');
    document.getElementById('create-name').focus();
  });

  document.getElementById('create-modal-close').addEventListener('click', closeCreateModal);
  document.getElementById('create-cancel').addEventListener('click', closeCreateModal);
  createModal.addEventListener('click', function(e) { if (e.target === createModal) closeCreateModal(); });

  function closeCreateModal() {
    createModal.classList.remove('open');
    document.getElementById('create-name').value = '';
    document.getElementById('create-desc').value = '';
    document.getElementById('create-error').style.display = 'none';
  }

  document.getElementById('create-submit').addEventListener('click', async function() {
    var name = document.getElementById('create-name').value.trim();
    if (!name) {
      document.getElementById('create-error').textContent = 'Please enter a group name.';
      document.getElementById('create-error').style.display = 'block';
      return;
    }

    var desc = document.getElementById('create-desc').value.trim();
    var btn = document.getElementById('create-submit');
    btn.disabled = true;
    btn.textContent = 'Creating...';

    try {
      var group = await createGroup(name, desc);
      closeCreateModal();
      openGroupDetail(group.id);
    } catch (e) {
      document.getElementById('create-error').textContent = e.message || 'Failed to create group.';
      document.getElementById('create-error').style.display = 'block';
    }

    btn.disabled = false;
    btn.textContent = 'Create Group';
  });

  // ── Join Group Modal ──
  var joinModal = document.getElementById('join-modal');

  document.getElementById('btn-join-group').addEventListener('click', function() {
    joinModal.classList.add('open');
    document.getElementById('join-code').focus();
  });

  document.getElementById('join-modal-close').addEventListener('click', closeJoinModal);
  document.getElementById('join-cancel').addEventListener('click', closeJoinModal);
  joinModal.addEventListener('click', function(e) { if (e.target === joinModal) closeJoinModal(); });

  function closeJoinModal() {
    joinModal.classList.remove('open');
    document.getElementById('join-code').value = '';
    document.getElementById('join-error').style.display = 'none';
  }

  document.getElementById('join-submit').addEventListener('click', async function() {
    var code = document.getElementById('join-code').value.trim();
    if (!code || code.length < 6) {
      document.getElementById('join-error').textContent = 'Please enter a 6-character invite code.';
      document.getElementById('join-error').style.display = 'block';
      return;
    }

    var btn = document.getElementById('join-submit');
    btn.disabled = true;
    btn.textContent = 'Joining...';

    try {
      var group = await joinGroup(code);
      closeJoinModal();
      openGroupDetail(group.id);
    } catch (e) {
      document.getElementById('join-error').textContent = e.message || 'Invalid invite code.';
      document.getElementById('join-error').style.display = 'block';
    }

    btn.disabled = false;
    btn.textContent = 'Join Group';
  });

  // ── Start ──
  document.addEventListener('DOMContentLoaded', init);
})();
