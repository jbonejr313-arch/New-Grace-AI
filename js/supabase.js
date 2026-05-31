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
