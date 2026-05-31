// Grace.AI — Auth UI
// Creates modal, handles sign up/in/out, updates page UI

(function() {
  var modal = null;
  var currentTab = 'signin';

  function createModal() {
    if (modal) return;

    var overlay = document.createElement('div');
    overlay.id = 'auth-modal-overlay';
    overlay.className = 'auth-overlay';
    overlay.innerHTML =
      '<div class="auth-modal">' +
        '<button class="auth-close" id="auth-close" aria-label="Close">&times;</button>' +
        '<div class="auth-header">' +
          '<div class="auth-logo">GRACE<span class="logo-dot">.</span>AI</div>' +
        '</div>' +
        '<div class="auth-tabs">' +
          '<button class="auth-tab active" data-tab="signin">Sign In</button>' +
          '<button class="auth-tab" data-tab="signup">Create Account</button>' +
        '</div>' +
        '<div class="auth-body">' +
          '<div class="auth-panel" id="auth-signin" style="display:block;">' +
            '<form id="signin-form">' +
              '<div class="auth-field">' +
                '<label for="signin-email">Email</label>' +
                '<input type="email" id="signin-email" class="form-input" required placeholder="you@example.com">' +
              '</div>' +
              '<div class="auth-field">' +
                '<label for="signin-password">Password</label>' +
                '<input type="password" id="signin-password" class="form-input" required placeholder="Your password" minlength="6">' +
              '</div>' +
              '<div class="auth-error" id="signin-error"></div>' +
              '<button type="submit" class="btn btn-primary auth-submit">Sign In</button>' +
            '</form>' +
          '</div>' +
          '<div class="auth-panel" id="auth-signup" style="display:none;">' +
            '<form id="signup-form">' +
              '<div class="auth-field">' +
                '<label for="signup-email">Email</label>' +
                '<input type="email" id="signup-email" class="form-input" required placeholder="you@example.com">' +
              '</div>' +
              '<div class="auth-field">' +
                '<label for="signup-password">Password</label>' +
                '<input type="password" id="signup-password" class="form-input" required placeholder="At least 6 characters" minlength="6">' +
              '</div>' +
              '<div class="auth-field">' +
                '<label for="signup-confirm">Confirm Password</label>' +
                '<input type="password" id="signup-confirm" class="form-input" required placeholder="Confirm your password" minlength="6">' +
              '</div>' +
              '<div class="auth-error" id="signup-error"></div>' +
              '<button type="submit" class="btn btn-primary auth-submit">Create Account</button>' +
            '</form>' +
            '<div class="auth-success" id="signup-success" style="display:none;">' +
              '<p>Check your email for a confirmation link to activate your account.</p>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    modal = overlay;

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeAuthModal();
    });

    overlay.querySelector('#auth-close').addEventListener('click', closeAuthModal);

    var tabs = overlay.querySelectorAll('.auth-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function() {
        switchTab(this.getAttribute('data-tab'));
      });
    }

    overlay.querySelector('#signin-form').addEventListener('submit', handleSignIn);
    overlay.querySelector('#signup-form').addEventListener('submit', handleSignUp);
  }

  function switchTab(tab) {
    currentTab = tab;
    var tabs = modal.querySelectorAll('.auth-tab');
    var panels = modal.querySelectorAll('.auth-panel');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('active', tabs[i].getAttribute('data-tab') === tab);
    }
    document.getElementById('auth-signin').style.display = tab === 'signin' ? 'block' : 'none';
    document.getElementById('auth-signup').style.display = tab === 'signup' ? 'block' : 'none';
    clearErrors();
  }

  function clearErrors() {
    var errors = modal.querySelectorAll('.auth-error');
    for (var i = 0; i < errors.length; i++) {
      errors[i].textContent = '';
      errors[i].style.display = 'none';
    }
  }

  function showError(id, message) {
    var el = document.getElementById(id);
    el.textContent = message;
    el.style.display = 'block';
  }

  async function handleSignIn(e) {
    e.preventDefault();
    var email = document.getElementById('signin-email').value.trim();
    var password = document.getElementById('signin-password').value;
    var btn = modal.querySelector('#auth-signin .auth-submit');

    btn.disabled = true;
    btn.textContent = 'Signing in...';
    clearErrors();

    try {
      await signIn(email, password);
      closeAuthModal();
      updateAuthUI();
    } catch (err) {
      showError('signin-error', err.message || 'Sign in failed. Check your credentials.');
    }

    btn.disabled = false;
    btn.textContent = 'Sign In';
  }

  async function handleSignUp(e) {
    e.preventDefault();
    var email = document.getElementById('signup-email').value.trim();
    var password = document.getElementById('signup-password').value;
    var confirm = document.getElementById('signup-confirm').value;
    var btn = modal.querySelector('#auth-signup .auth-submit');

    if (password !== confirm) {
      showError('signup-error', 'Passwords do not match.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Creating account...';
    clearErrors();

    try {
      await signUp(email, password);
      document.getElementById('signup-form').style.display = 'none';
      document.getElementById('signup-success').style.display = 'block';
    } catch (err) {
      showError('signup-error', err.message || 'Sign up failed. Try a different email.');
    }

    btn.disabled = false;
    btn.textContent = 'Create Account';
  }

  // ── Public API ──

  window.openAuthModal = function(tab) {
    createModal();
    if (tab) switchTab(tab);
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  function closeAuthModal() {
    if (!modal) return;
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  window.updateAuthUI = async function() {
    var user = await getUser();

    // Update sidebar user area (chat page)
    var sidebarName = document.querySelector('.sidebar-user-name');
    var sidebarPlan = document.querySelector('.sidebar-user-plan');
    var sidebarAvatar = document.querySelector('.sidebar-avatar');
    if (sidebarName) {
      if (user) {
        var displayName = user.email.split('@')[0];
        sidebarName.textContent = displayName;
        sidebarPlan.textContent = 'Free Plan';
        sidebarAvatar.textContent = displayName.charAt(0).toUpperCase();
      } else {
        sidebarName.textContent = 'Guest';
        sidebarPlan.textContent = 'Sign in to save';
        sidebarAvatar.textContent = 'G';
      }
    }

    // Update nav auth buttons
    var authBtns = document.querySelectorAll('.nav-auth-btn');
    for (var i = 0; i < authBtns.length; i++) {
      if (user) {
        authBtns[i].textContent = 'Sign Out';
        authBtns[i].onclick = async function() {
          await signOut();
          window.location.reload();
        };
      } else {
        authBtns[i].textContent = 'Sign In';
        authBtns[i].onclick = function() { openAuthModal('signin'); };
      }
    }

    // Update dashboard if present
    var dashEmpty = document.querySelector('.dash-empty');
    if (dashEmpty) {
      if (user) {
        dashEmpty.querySelector('h3').textContent = 'Welcome, ' + user.email.split('@')[0];
        dashEmpty.querySelector('p').textContent = 'Start building studies and chatting to see your progress here.';
      }
    }
  };

  window.handleSignOutClick = async function() {
    await signOut();
    window.location.reload();
  };

  // ── Init on page load ──
  document.addEventListener('DOMContentLoaded', function() {
    initSupabase();
    updateAuthUI();

    onAuthStateChange(function(event) {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        updateAuthUI();
      }
    });

    // Bind any existing sign-in buttons
    var signInBtns = document.querySelectorAll('[data-action="signin"]');
    for (var i = 0; i < signInBtns.length; i++) {
      signInBtns[i].addEventListener('click', function(e) {
        e.preventDefault();
        openAuthModal('signin');
      });
    }

    var signUpBtns = document.querySelectorAll('[data-action="signup"]');
    for (var i = 0; i < signUpBtns.length; i++) {
      signUpBtns[i].addEventListener('click', function(e) {
        e.preventDefault();
        openAuthModal('signup');
      });
    }
  });
})();
