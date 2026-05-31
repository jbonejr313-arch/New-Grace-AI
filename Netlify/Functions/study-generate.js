const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async function(event) {
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
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const { topic, audience, length, depth } = JSON.parse(event.body || "{}");

    if (!topic) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "No topic provided" }) };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "API key not configured" }) };
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const prompt = `Generate a ${length}-day Reformed Bible study on "${topic}" for ${audience} at ${depth} level.

Return ONLY a valid JSON object with this exact structure (no markdown, no code fences, just the JSON):
{
  "title": "Study title",
  "overview": "2-3 sentence description",
  "days": [
    {
      "day": 1,
      "title": "Day title",
      "passage": "Book Chapter:Verse-Verse",
      "observation_questions": ["q1", "q2", "q3"],
      "interpretation_questions": ["q1", "q2"],
      "application_prompts": ["prompt1", "prompt2"],
      "confessional_anchor": {
        "source": "WCF Chapter X or Heidelberg Q&A XX",
        "quote": "Relevant excerpt"
      },
      "theologian_quote": {
        "author": "Name",
        "source": "Book title",
        "quote": "Quote text"
      }
    }
  ]
}

Requirements:
- Every question must be grounded in the Reformed confessional tradition (Westminster Confession 1647, Three Forms of Unity)
- Observation questions should be inductive (what does the text say?)
- Interpretation questions should surface theological depth and doctrinal implications
- Application prompts should connect doctrine to everyday life for a young adult
- Confessional anchors should reference specific WCF chapters or Heidelberg Catechism Q&A numbers
- Theologian quotes should come from Calvin, Owen, Bavinck, Sproul, Lloyd-Jones, Beeke, or similar Reformed authors
- Use ESV translation references
- Each day must have 3-4 observation questions, 2-3 interpretation questions, and 1-2 application prompts`;

    const modelOptions = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-pro"];
    let result = null;

    for (const modelName of modelOptions) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const genResult = await model.generateContent(prompt);
        const text = genResult.response.text();

        // Extract JSON from response (handle potential markdown wrapping)
        let jsonStr = text;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }

        result = JSON.parse(jsonStr);
        break;
      } catch (err) {
        console.log(`Model ${modelName} failed:`, err.message);
        continue;
      }
    }

    if (!result) {
      throw new Error("All models failed to generate a study");
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ study: result })
    };

  } catch (error) {
    console.error("Study generation error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to generate study", details: error.message })
    };
  }
};
