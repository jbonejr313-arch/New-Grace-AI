// Grace.AI Chat Page

(function() {
  const messagesArea = document.getElementById('chat-messages-area');
  const messagesContainer = document.getElementById('messages-container');
  const welcome = document.getElementById('chat-welcome');
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');
  const sidebar = document.getElementById('chat-sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const menuBtn = document.getElementById('chat-menu-btn');
  const newChatBtn = document.getElementById('new-chat-btn');
  const chips = document.querySelectorAll('.chip');

  const CHAT_KEY = 'graceai_chat_messages';
  let chatLog = loadChat();
  let isLoading = false;

  // ── Persistence ──
  function loadChat() {
    try {
      const stored = sessionStorage.getItem(CHAT_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  function saveChat() {
    try {
      sessionStorage.setItem(CHAT_KEY, JSON.stringify(chatLog));
    } catch (e) {}
  }

  // ── Formatting ──
  function formatResponse(text) {
    const blocks = text.split(/\n\n+/);
    let html = '';

    for (let i = 0; i < blocks.length; i++) {
      let block = blocks[i].trim();
      if (!block) continue;

      const lines = block.split('\n').filter(function(l) { return l.trim(); });
      const isNumbered = lines.every(function(l) { return /^\d+[\.\)]\s/.test(l.trim()); });
      const isBulleted = lines.every(function(l) { return /^[\-\*]\s/.test(l.trim()); });

      if (isNumbered) {
        html += '<ol>';
        for (var j = 0; j < lines.length; j++) {
          html += '<li>' + inlineFmt(lines[j].replace(/^\d+[\.\)]\s*/, '').trim()) + '</li>';
        }
        html += '</ol>';
      } else if (isBulleted) {
        html += '<ul>';
        for (var k = 0; k < lines.length; k++) {
          html += '<li>' + inlineFmt(lines[k].replace(/^[\-\*]\s*/, '').trim()) + '</li>';
        }
        html += '</ul>';
      } else if (block.startsWith('>')) {
        var quoteText = block.replace(/^>\s*/gm, '');
        html += '<blockquote class="inline-scripture"><div class="verse-text">' + inlineFmt(quoteText) + '</div></blockquote>';
      } else {
        html += '<p>' + inlineFmt(block.replace(/\n/g, '<br>')) + '</p>';
      }
    }

    return html;
  }

  function inlineFmt(text) {
    // Bold
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
    // Italic
    text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
    // Scripture references in brackets → gold badge
    text = text.replace(/\[(\d?\s?[A-Z][a-zA-Z]+\.?\s+\d+(?::\d+(?:-\d+)?)?(?:;\s*\d?\s?[A-Z][a-zA-Z]+\.?\s+\d+(?::\d+(?:-\d+)?)?)*)\]/g,
      '<span class="verse-ref-badge">$1</span>');
    // Scripture references in parentheses → gold badge
    text = text.replace(/\((\d?\s?[A-Z][a-zA-Z]+\.?\s+\d+:\d+(?:-\d+)?)\)/g,
      '<span class="verse-ref-badge">$1</span>');
    return text;
  }

  // ── Scripture Lookup Cache ──
  var VERSE_CACHE_KEY = 'graceai_verse_cache';

  function getVerseCache() {
    try { return JSON.parse(localStorage.getItem(VERSE_CACHE_KEY) || '{}'); }
    catch (e) { return {}; }
  }

  function setVerseCache(ref, data) {
    try {
      var cache = getVerseCache();
      cache[ref] = data;
      var keys = Object.keys(cache);
      if (keys.length > 200) { delete cache[keys[0]]; }
      localStorage.setItem(VERSE_CACHE_KEY, JSON.stringify(cache));
    } catch (e) {}
  }

  function fetchVerse(ref, badge) {
    if (badge.classList.contains('loading')) return;

    if (badge.classList.contains('expanded')) {
      var existing = badge.nextElementSibling;
      if (existing && existing.classList.contains('verse-expand')) {
        existing.remove();
      }
      badge.classList.remove('expanded');
      return;
    }

    var cached = getVerseCache()[ref];
    if (cached) {
      renderVerseExpand(badge, cached);
      return;
    }

    badge.classList.add('loading');
    fetch('/.netlify/functions/scripture?ref=' + encodeURIComponent(ref))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        badge.classList.remove('loading');
        if (data.error) return;
        setVerseCache(ref, data);
        renderVerseExpand(badge, data);
      })
      .catch(function() { badge.classList.remove('loading'); });
  }

  function renderVerseExpand(badge, data) {
    badge.classList.add('expanded');
    var callout = document.createElement('div');
    callout.className = 'verse-expand';
    callout.innerHTML =
      '<div class="verse-expand-text">' + escapeHtml(data.text) + '</div>' +
      '<div class="verse-expand-meta">' +
        '<span class="verse-expand-ref">' + escapeHtml(data.reference) + '</span>' +
        '<span class="verse-expand-translation">' + escapeHtml(data.translation) + '</span>' +
      '</div>';
    badge.parentNode.insertBefore(callout, badge.nextSibling);
  }

  function bindVerseBadges(container) {
    var badges = container.querySelectorAll('.verse-ref-badge');
    for (var i = 0; i < badges.length; i++) {
      (function(b) {
        b.style.cursor = 'pointer';
        b.title = 'Click to expand verse';
        b.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          fetchVerse(b.textContent.trim(), b);
        });
      })(badges[i]);
    }
  }

  // ── Message Rendering ──
  function addMessage(role, text, skipSave) {
    if (!skipSave) {
      chatLog.push({ role: role, text: text });
      saveChat();
    }

    welcome.style.display = 'none';
    messagesContainer.style.display = 'flex';

    var div = document.createElement('div');
    div.className = 'message ' + (role === 'user' ? 'msg-user' : 'msg-ai');

    var avatarLabel = role === 'user' ? 'You' : 'G';
    var formatted = role === 'user'
      ? '<p>' + escapeHtml(text) + '</p>'
      : formatResponse(text);

    div.innerHTML =
      '<div class="msg-avatar">' + avatarLabel + '</div>' +
      '<div class="msg-bubble">' + formatted + '</div>';

    messagesContainer.appendChild(div);
    if (role !== 'user') { bindVerseBadges(div); }
    scrollToBottom();
  }

  function addLoading() {
    welcome.style.display = 'none';
    messagesContainer.style.display = 'flex';

    var div = document.createElement('div');
    div.className = 'message msg-ai';
    div.id = 'loading-msg';
    div.innerHTML =
      '<div class="msg-avatar">G</div>' +
      '<div class="msg-bubble loading-dots"><span></span><span></span><span></span></div>';

    messagesContainer.appendChild(div);
    scrollToBottom();
    return div;
  }

  function removeLoading(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function addError(message, retryFn) {
    var div = document.createElement('div');
    div.className = 'message msg-ai';
    div.innerHTML =
      '<div class="msg-avatar">G</div>' +
      '<div class="msg-error">' +
        '<p>' + escapeHtml(message) + '</p>' +
        '<button class="retry-btn">Retry</button>' +
      '</div>';

    div.querySelector('.retry-btn').addEventListener('click', function() {
      div.parentNode.removeChild(div);
      if (retryFn) retryFn();
    });

    messagesContainer.appendChild(div);
    scrollToBottom();
  }

  function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function scrollToBottom() {
    requestAnimationFrame(function() {
      messagesArea.scrollTo({ top: messagesArea.scrollHeight, behavior: 'smooth' });
    });
  }

  // ── Send ──
  async function handleSend() {
    var text = input.value.trim();
    if (!text || isLoading) return;

    input.value = '';
    autoResize();
    addMessage('user', text);

    isLoading = true;
    sendBtn.disabled = true;
    var loader = addLoading();

    try {
      var response = await sendMessage(text);
      removeLoading(loader);
      addMessage('assistant', response);
    } catch (error) {
      removeLoading(loader);
      addError("Something went wrong. Please try again.", function() {
        input.value = text;
        handleSend();
      });
    }

    isLoading = false;
    sendBtn.disabled = false;
    input.focus();
  }

  // ── Auto-resize textarea ──
  function autoResize() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 150) + 'px';
  }

  // ── Event Listeners ──
  sendBtn.addEventListener('click', handleSend);

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  input.addEventListener('input', autoResize);

  chips.forEach(function(chip) {
    chip.addEventListener('click', function() {
      input.value = this.getAttribute('data-query');
      autoResize();
      handleSend();
    });
  });

  // ── New Chat ──
  newChatBtn.addEventListener('click', function() {
    chatLog = [];
    sessionStorage.removeItem(CHAT_KEY);
    clearHistory();
    messagesContainer.innerHTML = '';
    messagesContainer.style.display = 'none';
    welcome.style.display = 'flex';
    closeSidebar();
    input.focus();
  });

  // ── Sidebar ──
  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('open');
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  }

  menuBtn.addEventListener('click', openSidebar);
  overlay.addEventListener('click', closeSidebar);

  // ── Restore chat on load ──
  if (chatLog.length > 0) {
    chatLog.forEach(function(msg) {
      addMessage(msg.role, msg.text, true);
    });
  }

  // ── Focus input on desktop ──
  if (window.innerWidth > 768) {
    input.focus();
  }
})();
