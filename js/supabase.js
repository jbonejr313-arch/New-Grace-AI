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

// ── Display Name ──

async function getDisplayName() {
  var sb = initSupabase();
  if (!sb) return null;
  var user = await getUser();
  if (!user) return null;

  var result = await sb.from('profiles').select('display_name').eq('id', user.id).single();
  return (result.data && result.data.display_name) || user.email.split('@')[0];
}

async function setDisplayName(name) {
  var sb = initSupabase();
  if (!sb) return;
  var user = await getUser();
  if (!user) return;

  await sb.from('profiles').update({
    display_name: name,
    updated_at: new Date().toISOString()
  }).eq('id', user.id);
}

// ── Groups ──

function generateInviteCode() {
  var chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  var code = '';
  for (var i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function createGroup(name, description) {
  var sb = initSupabase();
  if (!sb) return null;
  var user = await getUser();
  if (!user) return null;

  var code = generateInviteCode();
  var result = await sb.from('groups').insert({
    name: name,
    description: description || '',
    invite_code: code,
    created_by: user.id
  }).select().single();

  if (result.error) throw result.error;
  var group = result.data;

  var displayName = await getDisplayName();
  await sb.from('group_members').insert({
    group_id: group.id,
    user_id: user.id,
    role: 'leader'
  });

  await postActivity(group.id, 'joined_group', { display_name: displayName });
  return group;
}

async function joinGroup(inviteCode) {
  var sb = initSupabase();
  if (!sb) return null;
  var user = await getUser();
  if (!user) return null;

  var groupResult = await sb.from('groups')
    .select('*')
    .eq('invite_code', inviteCode.toUpperCase().trim())
    .single();

  if (groupResult.error || !groupResult.data) throw new Error('Invalid invite code');
  var group = groupResult.data;

  var existing = await sb.from('group_members')
    .select('id')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .single();

  if (existing.data) throw new Error('You are already in this group');

  await sb.from('group_members').insert({
    group_id: group.id,
    user_id: user.id,
    role: 'member'
  });

  var displayName = await getDisplayName();
  await postActivity(group.id, 'joined_group', { display_name: displayName });
  return group;
}

async function leaveGroup(groupId) {
  var sb = initSupabase();
  if (!sb) return;
  var user = await getUser();
  if (!user) return;

  await sb.from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', user.id);
}

async function getMyGroups() {
  var sb = initSupabase();
  if (!sb) return [];
  var user = await getUser();
  if (!user) return [];

  var result = await sb.from('group_members')
    .select('group_id, role, groups(id, name, description, invite_code, created_at)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false });

  if (!result.data) return [];
  return result.data.map(function(m) {
    return { id: m.groups.id, name: m.groups.name, description: m.groups.description,
             invite_code: m.groups.invite_code, role: m.role, created_at: m.groups.created_at };
  });
}

async function getGroupMembers(groupId) {
  var sb = initSupabase();
  if (!sb) return [];

  var result = await sb.from('group_members')
    .select('user_id, role, joined_at')
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true });

  if (!result.data) return [];

  var members = [];
  for (var i = 0; i < result.data.length; i++) {
    var m = result.data[i];
    var profile = await sb.from('profiles')
      .select('display_name')
      .eq('id', m.user_id)
      .single();
    members.push({
      user_id: m.user_id,
      role: m.role,
      display_name: (profile.data && profile.data.display_name) || 'Member',
      joined_at: m.joined_at
    });
  }
  return members;
}

async function getGroupMemberCount(groupId) {
  var sb = initSupabase();
  if (!sb) return 0;

  var result = await sb.from('group_members')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', groupId);

  return result.count || 0;
}

// ── Activity Feed ──

async function postActivity(groupId, activityType, content) {
  var sb = initSupabase();
  if (!sb) return null;
  var user = await getUser();
  if (!user) return null;

  var result = await sb.from('activity_feed').insert({
    user_id: user.id,
    group_id: groupId,
    activity_type: activityType,
    content: content || {}
  }).select().single();

  return result.data;
}

async function postToAllGroups(activityType, content) {
  var groups = await getMyGroups();
  for (var i = 0; i < groups.length; i++) {
    await postActivity(groups[i].id, activityType, content);
  }
}

async function getFeed(groupId, limit) {
  var sb = initSupabase();
  if (!sb) return [];
  var user = await getUser();
  if (!user) return [];

  var query = sb.from('activity_feed')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit || 30);

  if (groupId) {
    query = query.eq('group_id', groupId);
  }

  var result = await query;
  if (!result.data) return [];

  var feed = [];
  var profileCache = {};
  for (var i = 0; i < result.data.length; i++) {
    var item = result.data[i];
    if (!profileCache[item.user_id]) {
      var p = await sb.from('profiles').select('display_name').eq('id', item.user_id).single();
      profileCache[item.user_id] = (p.data && p.data.display_name) || 'Member';
    }

    var rxResult = await sb.from('reactions')
      .select('reaction_type, user_id')
      .eq('activity_id', item.id);

    var amenCount = 0, prayingCount = 0, userAmen = false, userPraying = false;
    if (rxResult.data) {
      for (var j = 0; j < rxResult.data.length; j++) {
        if (rxResult.data[j].reaction_type === 'amen') {
          amenCount++;
          if (rxResult.data[j].user_id === user.id) userAmen = true;
        } else {
          prayingCount++;
          if (rxResult.data[j].user_id === user.id) userPraying = true;
        }
      }
    }

    feed.push({
      id: item.id,
      user_id: item.user_id,
      display_name: profileCache[item.user_id],
      activity_type: item.activity_type,
      content: item.content,
      created_at: item.created_at,
      reactions: { amen: amenCount, praying: prayingCount,
                   user_amen: userAmen, user_praying: userPraying }
    });
  }
  return feed;
}

// ── Reactions ──

async function toggleReaction(activityId, reactionType) {
  var sb = initSupabase();
  if (!sb) return;
  var user = await getUser();
  if (!user) return;

  var existing = await sb.from('reactions')
    .select('id')
    .eq('activity_id', activityId)
    .eq('user_id', user.id)
    .eq('reaction_type', reactionType)
    .single();

  if (existing.data) {
    await sb.from('reactions').delete().eq('id', existing.data.id);
    return false;
  } else {
    await sb.from('reactions').insert({
      activity_id: activityId,
      user_id: user.id,
      reaction_type: reactionType
    });
    return true;
  }
}

// ── Reflections ──

async function postReflection(groupId, text) {
  var sb = initSupabase();
  if (!sb) return null;
  var user = await getUser();
  if (!user) return null;

  var displayName = await getDisplayName();

  var result = await sb.from('reflections').insert({
    user_id: user.id,
    group_id: groupId,
    reflection_text: text
  }).select().single();

  if (result.error) throw result.error;

  await postActivity(groupId, 'reflection', {
    display_name: displayName,
    text: text.slice(0, 120) + (text.length > 120 ? '...' : '')
  });

  return result.data;
}

async function getGroupReflections(groupId, limit) {
  var sb = initSupabase();
  if (!sb) return [];

  var result = await sb.from('reflections')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(limit || 10);

  if (!result.data) return [];

  var reflections = [];
  var profileCache = {};
  for (var i = 0; i < result.data.length; i++) {
    var r = result.data[i];
    if (!profileCache[r.user_id]) {
      var p = await sb.from('profiles').select('display_name').eq('id', r.user_id).single();
      profileCache[r.user_id] = (p.data && p.data.display_name) || 'Member';
    }
    reflections.push({
      id: r.id,
      display_name: profileCache[r.user_id],
      text: r.reflection_text,
      date: r.devotional_date,
      created_at: r.created_at
    });
  }
  return reflections;
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
