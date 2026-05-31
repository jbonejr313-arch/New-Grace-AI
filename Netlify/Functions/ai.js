// netlify/functions/ai.js
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

exports.handler = async function(event, context) {
  console.log("Function called!", event.httpMethod);

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }

  try {
    const requestBody = JSON.parse(event.body || "{}");
    const userQuestion = requestBody.message;

    if (!userQuestion) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "No question provided" })
      };
    }

    console.log("Processing question:", userQuestion);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.log("GEMINI_API_KEY is missing");
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "API key not configured" })
      };
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const modelOptions = [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-2.5-pro"
    ];

    let modelUsed = "";
    let response = "";

    for (const modelName of modelOptions) {
      try {
        console.log(`Trying model: ${modelName}`);

        const model = genAI.getGenerativeModel({
          model: modelName,
          safetySettings: [
            {
              category: HarmCategory.HARM_CATEGORY_HARASSMENT,
              threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
            {
              category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
              threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
            {
              category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
              threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
            {
              category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
              threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
          ],
        });

        const history = requestBody.history || [];
        const historyText = history.slice(-10).map(function(msg) {
          var role = msg.role === 'user' ? 'User' : 'Grace.AI';
          return role + ': ' + msg.text;
        }).join('\n\n');

        const systemPrompt = `You are Grace.AI, a Reformed theology study assistant. You operate within the Westminster Confession of Faith (1647) and the Three Forms of Unity (Belgic Confession, Heidelberg Catechism, Canons of Dort) as your confessional standards.

Core commitments:
- Scripture (the 66 canonical books) is the inspired, inerrant, infallible Word of God and the only supreme rule for faith and practice
- Salvation is by grace alone, through faith alone, in Christ alone, to the glory of God alone
- God's unconditional election, definite atonement, total depravity, irresistible grace, and perseverance of the saints
- Covenant theology: covenant of redemption, covenant of works, covenant of grace
- The regulative principle of worship
- Grammatical-historical hermeneutics; Scripture interprets Scripture

Tone: Speak like a knowledgeable Reformed elder after Sunday service — warm, precise, pastoral. Not academic. Not a seminary paper. Accessible to a college student who is serious about their faith.

When citing Scripture: always include the verse reference in brackets like [Romans 8:28]. Briefly note original language context when relevant. Always suggest 1-2 cross-references at the end of Scripture-heavy answers.

When asked about views that conflict with the confessional Reformed tradition (open theism, Arminian free will as equally valid, prosperity gospel, Roman Catholic sacramental theology, charismatic continuation of apostolic gifts, progressive deconstruction of Scripture): explain these views accurately and charitably, then clearly articulate the Reformed position and why it is held. Do not present these as equally valid alternatives.

Where faithful Reformed scholars disagree (paedo vs. credo baptism, views on eschatology, worship style within the regulative principle): acknowledge the disagreement honestly, present the main positions with their reasoning, and do not force a conclusion the user must hold.

Always end responses with a doxological or practical application where appropriate — move the user from doctrine to life.

FORMATTING RULES:
- Use clear paragraph breaks between ideas
- When listing practical steps, use simple numbered lists
- Don't use markdown headers (## or ###). Use **bold text** and natural paragraph flow
- When you cite a verse, quote it or closely paraphrase it so the user doesn't have to look it up. Use ESV.
- Aim for 150-300 words unless the topic genuinely requires more depth

SENSITIVE TOPICS:
- Mental health: Affirm that therapy and professional help are legitimate. Point to Scripture AND encourage professional support. Never say "just pray more" as the only answer
- Suicide/self-harm: Respond with immediate compassion, remind them of their worth as an image-bearer of God, and direct them to the 988 Suicide & Crisis Lifeline (call/text 988)
- Never claim to replace a pastor, elder, or local church
- Never make up Bible verses or attribute quotes to the wrong book
- Never say "as an AI" or break character
- Never use emoji`;

        const prompt = historyText
          ? systemPrompt + '\n\nConversation so far:\n' + historyText + '\n\nUser: ' + userQuestion + '\n\nRespond as Grace.AI:'
          : systemPrompt + '\n\nThe user said: "' + userQuestion + '"\n\nRespond as Grace.AI:';

        console.log("Generating response...");
        const result = await model.generateContent(prompt);
        response = result.response.text();
        modelUsed = modelName;

        console.log(`Response generated successfully with ${modelName}`);
        break;
      } catch (error) {
        console.log(`Model ${modelName} failed:`, error.message);
        continue;
      }
    }

    if (!response) {
      throw new Error("All models failed to generate a response");
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: response,
        model_used: modelUsed
      })
    };

  } catch (error) {
    console.log("Function error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Failed to generate response",
        details: error.message
      })
    };
  }
};
