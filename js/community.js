// Grace.AI — Community Page

(function() {
  var signinEl = document.getElementById('community-signin');
  var nameSetup = document.getElementById('name-setup');
  var mainEl = document.getElementById('community-main');
  var groupsView = document.getElementById('groups-view');
  var groupDetail = document.getElementById('group-detail');
  var groupsGrid = document.getElementById('groups-grid');
  var feedList = document.getElementById('feed-list');
  var currentGroupId = null;

  // ── Time Formatting ──
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
    var user = await getUser();
    if (!user) {
      signinEl.style.display = 'block';
      mainEl.style.display = 'none';
      nameSetup.style.display = 'none';
      return;
    }

    signinEl.style.display = 'none';

    var displayName = await getDisplayName();
    if (!displayName || displayName === user.email.split('@')[0]) {
      nameSetup.style.display = 'block';
      document.getElementById('display-name-input').value = displayName || '';
    } else {
      nameSetup.style.display = 'none';
    }

    mainEl.style.display = 'block';
    loadGroups();
    loadFeed();
  }

  // ── Display Name ──
  document.getElementById('save-name-btn').addEventListener('click', async function() {
    var name = document.getElementById('display-name-input').value.trim();
    if (!name) return;
    await setDisplayName(name);
    nameSetup.style.display = 'none';
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
      targetEl.innerHTML = '<div class="feed-empty">No activity yet. Complete a study or share a reflection to get started.</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < feed.length; i++) {
      html += renderFeedItem(feed[i]);
    }
    targetEl.innerHTML = html;
    bindReactions(targetEl);
  }

  function renderFeedItem(item) {
    var initial = item.display_name ? item.display_name.charAt(0).toUpperCase() : '?';
    var bodyHtml = '';

    switch (item.activity_type) {
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
      case 'study_shared':
        bodyHtml = '<span class="feed-highlight">' + esc(item.display_name) + '</span> shared a study: <span class="feed-highlight">' + esc(item.content.title || 'Untitled') + '</span>';
        break;
      default:
        bodyHtml = '<span class="feed-highlight">' + esc(item.display_name) + '</span> did something';
    }

    var amenActive = item.reactions.user_amen ? ' active' : '';
    var prayingActive = item.reactions.user_praying ? ' active' : '';

    return (
      '<div class="feed-item" data-activity-id="' + item.id + '">' +
        '<div class="feed-item-header">' +
          '<div class="feed-avatar">' + initial + '</div>' +
          '<div class="feed-meta">' +
            '<div class="feed-user">' + esc(item.display_name) + '</div>' +
            '<div class="feed-time">' + timeAgo(item.created_at) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="feed-body">' + bodyHtml + '</div>' +
        '<div class="feed-reactions">' +
          '<button class="reaction-btn' + amenActive + '" data-type="amen">' +
            '<span class="reaction-emoji">&#128591;</span> Amen' +
            (item.reactions.amen > 0 ? ' <span class="reaction-count">' + item.reactions.amen + '</span>' : '') +
          '</button>' +
          '<button class="reaction-btn' + prayingActive + '" data-type="praying">' +
            '<span class="reaction-emoji">&#128722;</span> Praying' +
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

    document.getElementById('detail-name').textContent = group.name;
    document.getElementById('detail-desc').textContent = group.description || '';
    document.getElementById('detail-code').textContent = group.invite_code;

    if (group.role === 'leader') {
      document.getElementById('detail-invite').style.display = 'flex';
    } else {
      document.getElementById('detail-invite').style.display = 'none';
    }

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

    loadFeed(groupId);
  }

  document.getElementById('group-back').addEventListener('click', function() {
    currentGroupId = null;
    groupDetail.classList.remove('active');
    groupsView.style.display = 'block';
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
