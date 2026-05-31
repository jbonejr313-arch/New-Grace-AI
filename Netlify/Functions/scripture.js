const https = require('https');

function httpsGet(url, headers) {
  return new Promise(function(resolve, reject) {
    const req = https.get(url, { headers: headers || {} }, function(res) {
      let data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() { resolve({ status: res.statusCode, body: data }); });
    });
    req.on('error', reject);
    req.setTimeout(8000, function() { req.destroy(); reject(new Error('Timeout')); });
  });
}

function normalizeRef(ref) {
  return ref.trim()
    .replace(/\s+/g, '+')
    .replace(/^(\d)\+/, '$1')
    .replace(/(\d)\+([A-Za-z])/, '$1$2');
}

exports.handler = async function(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Cache-Control': 'public, max-age=86400'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const ref = (event.queryStringParameters || {}).ref;
  if (!ref) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'No ref provided' }) };
  }

  try {
    const esvKey = process.env.ESV_API_KEY;

    if (esvKey) {
      const encoded = encodeURIComponent(ref);
      const url = 'https://api.esv.org/v3/passage/text/?q=' + encoded +
        '&include-passage-references=true&include-footnotes=false' +
        '&include-headings=false&include-short-copyright=true' +
        '&indent-paragraphs=0&indent-poetry=false';

      const res = await httpsGet(url, { 'Authorization': 'Token ' + esvKey });

      if (res.status === 200) {
        const data = JSON.parse(res.body);
        if (data.passages && data.passages.length > 0) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              text: data.passages[0].trim(),
              reference: data.canonical || ref,
              translation: 'ESV'
            })
          };
        }
      }
    }

    const normalized = normalizeRef(ref);
    const url = 'https://bible-api.com/' + encodeURIComponent(normalized) + '?translation=web';
    const res = await httpsGet(url);

    if (res.status === 200) {
      const data = JSON.parse(res.body);
      if (data.text) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            text: data.text.trim(),
            reference: data.reference || ref,
            translation: 'WEB'
          })
        };
      }
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Verse not found', ref: ref })
    };
  } catch (error) {
    console.error('Scripture lookup error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Lookup failed', details: error.message })
    };
  }
};
