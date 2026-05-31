// Grace.AI API Layer

const HISTORY_KEY = 'graceai_history';

const conversationHistory = (function() {
  try {
    const stored = sessionStorage.getItem(HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
})();

function saveHistory() {
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(conversationHistory));
  } catch (e) {
    console.warn('Could not save history:', e);
  }
}

function clearHistory() {
  conversationHistory.length = 0;
  sessionStorage.removeItem(HISTORY_KEY);
}

async function sendMessage(message) {
  try {
    const response = await fetch('/.netlify/functions/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: message,
        history: conversationHistory.slice(-10)
      }),
    });

    if (!response.ok) {
      throw new Error('Request failed with status ' + response.status);
    }

    const data = await response.json();

    conversationHistory.push({ role: 'user', text: message });
    conversationHistory.push({ role: 'model', text: data.message });
    saveHistory();

    return data.message;
  } catch (error) {
    console.error('API error:', error);
    throw error;
  }
}
