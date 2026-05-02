const https = require("https");
require("dotenv").config();

const API_KEY = process.env.HERMES_API_KEY;
const MODEL = "llama-3.1-8b-instant";

console.log("Testing Groq with Key:", API_KEY ? API_KEY.slice(0, 10) + "..." : "MISSING");

const data = JSON.stringify({
  model: MODEL,
  messages: [{ role: "user", content: "oi, tudo bem?" }],
  stream: false
});

const options = {
  hostname: "api.groq.com",
  port: 443,
  path: "/openai/v1/chat/completions",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${API_KEY}`,
    "Content-Length": data.length
  }
};

const req = https.request(options, (res) => {
  console.log("Status Code:", res.statusCode);
  let body = "";
  res.on("data", (chunk) => body += chunk);
  res.on("end", () => {
    console.log("Response Body:", body);
    try {
      const json = JSON.parse(body);
      if (json.choices) {
        console.log("SUCCESS! AI says:", json.choices[0].message.content);
      } else {
        console.log("FAILED. Error:", json.error ? json.error.message : "No choices");
      }
    } catch (e) {
      console.log("JSON Parse Error:", e.message);
    }
  });
});

req.on("error", (e) => {
  console.error("Connection Error:", e.message);
});

req.write(data);
req.end();
