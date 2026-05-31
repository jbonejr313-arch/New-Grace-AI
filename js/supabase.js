// Grace.AI — Supabase Client
// Config values are set during deployment

var SUPABASE_URL = 'https://xljoppwbygtqpdrlllkz.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsam9wcHdieWd0cXBkcmxsbGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxODk4NzMsImV4cCI6MjA5NTc2NTg3M30.sSUhnrbNkm7npzPNzaqIUak_8sOibA6aB5e3dN09dsQ';

var _supabaseClient = null;

function initSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  if (_supabaseClient) return _supabaseClient;
  var lib = window.supabase;
  if (!lib || !lib.createClient) return null;
  _supabaseClient = lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _supabaseClient;
}

// ── Auth Helpers ──

async function getUser() {
  var sb = initSupabase();
  if (!sb) return null;
  try {
    var result = await sb.auth.getUser();
    return result.data.user || null;
  } catch (e) {
    return null;
  }
}

async function getSession() {
  var sb = initSupabase();
  if (!sb) return null;
  try {
    var result = await sb.auth.getSession();
    return result.data.session || null;
  } catch (e) {
    return null;
  }
}

async function signUp(email, password) {
  var sb = initSupabase();
  if (!sb) throw new Error('Supabase not initialized');
  var result = await sb.auth.signUp({ email: email, password: password });
  if (result.error) throw result.error;
  return result.data;
}

async function signIn(email, password) {
  var sb = initSupabase();
  if (!sb) throw new Error('Supabase not initialized');
  var result = await sb.auth.signInWithPassword({ email: email, password: password });
  if (result.error) throw result.error;
  return result.data;
}

async function signOut() {
  var sb = initSupabase();
  if (!sb) return;
  await sb.auth.signOut();
}

function onAuthStateChange(callback) {
  var sb = initSupabase();
  if (!sb) return;
  sb.auth.onAuthStateChange(function(event, session) {
    callback(event, session);
  });
}

// ── Conversation Persistence ──

async function saveConversation(id, title, messages) {
  var sb = initSupabase();
  if (!sb) return null;
  var user = await getUser();
  if (!user) return null;

  var result = await sb.from('conversations').upsert({
    id: id,
    user_id: user.id,
    title: title,
    messages: messages,
    updated_at: new Date().toISOString()
  }, { onConflict: 'id' }).select().single();

  return result.data;
}

async function loadConversations() {
  var sb = initSupabase();
  if (!sb) return [];
  var user = await getUser();
  if (!user) return [];

  var result = await sb.from('conversations')
    .select('id, title, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(50);

  return result.data || [];
}

async function loadConversation(id) {
  var sb = initSupabase();
  if (!sb) return null;
  var user = await getUser();
  if (!user) return null;

  var result = await sb.from('conversations')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  return result.data;
}

async function deleteConversation(id) {
  var sb = initSupabase();
  if (!sb) return;
  var user = await getUser();
  if (!user) return;

  await sb.from('conversations')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
}

// ── Study Persistence ──

async function saveStudy(title, studyData) {
  var sb = initSupabase();
  if (!sb) return null;
  var user = await getUser();
  if (!user) return null;

  var result = await sb.from('studies').insert({
    user_id: user.id,
    title: title,
    study_data: studyData,
    created_at: new Date().toISOString()
  }).select().single();

  return result.data;
}

async function loadStudies() {
  var sb = initSupabase();
  if (!sb) return [];
  var user = await getUser();
  if (!user) return [];

  var result = await sb.from('studies')
    .select('id, title, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  return result.data || [];
}

// ── Devotional Streak ──

async function recordDevotionalView() {
  var sb = initSupabase();
  if (!sb) return null;
  var user = await getUser();
  if (!user) return null;

  var today = new Date().toISOString().split('T')[0];
  var result = await sb.from('devotional_views')
    .upsert({ user_id: user.id, viewed_date: today }, { onConflict: 'user_id,viewed_date' })
    .select().single();

  return result.data;
}

async function getStreak() {
  var sb = initSupabase();
  if (!sb) return { current: 0, longest: 0 };
  var user = await getUser();
  if (!user) return { current: 0, longest: 0 };

  var result = await sb.from('devotional_views')
    .select('viewed_date')
    .eq('user_id', user.id)
    .order('viewed_date', { ascending: false })
    .limit(365);

  if (!result.data || result.data.length === 0) return { current: 0, longest: 0 };

  var dates = result.data.map(function(r) { return r.viewed_date; });
  var current = 0;
  var longest = 0;
  var streak = 1;

  var today = new Date().toISOString().split('T')[0];
  var yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  if (dates[0] !== today && dates[0] !== yesterday) {
    return { current: 0, longest: calcLongest(dates) };
  }

  current = 1;
  for (var i = 1; i < dates.length; i++) {
    var prev = new Date(dates[i - 1]);
    var curr = new Date(dates[i]);
    var diff = (prev - curr) / 86400000;
    if (diff === 1) {
      current++;
    } else {
      break;
    }
  }

  longest = calcLongest(dates);
  return { current: current, longest: Math.max(current, longest) };
}

function calcLongest(dates) {
  if (dates.length === 0) return 0;
  var longest = 1;
  var run = 1;
  for (var i = 1; i < dates.length; i++) {
    var prev = new Date(dates[i - 1]);
    var curr = new Date(dates[i]);
    var diff = (prev - curr) / 86400000;
    if (diff === 1) {
      run++;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }
  return longest;
}

// ── Profile / Plan ──

async function getUserPlan() {
  var sb = initSupabase();
  if (!sb) return 'free';
  var user = await getUser();
  if (!user) return 'free';

  var result = await sb.from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single();

  return (result.data && result.data.plan) || 'free';
}

// ── Stripe Checkout ──

async function startCheckout() {
  var user = await getUser();
  if (!user) {
    if (typeof openAuthModal === 'function') openAuthModal('signin');
    return;
  }

  try {
    var response = await fetch('/.netlify/functions/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, email: user.email })
    });
    var data = await response.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      console.error('Checkout failed:', data.error);
    }
  } catch (e) {
    console.error('Checkout error:', e);
  }
}

// ── Dashboard Stats ──

async function getDashboardStats() {
  var sb = initSupabase();
  if (!sb) return null;
  var user = await getUser();
  if (!user) return null;

  var convos = await sb.from('conversations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  var studies = await sb.from('studies')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  return {
    conversations: convos.count || 0,
    studies: studies.count || 0
  };
}
