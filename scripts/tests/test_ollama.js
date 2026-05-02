const axios = require('axios');

async function test() {
  console.log("--- Testing Ollama API ---");
  try {
    const res = await axios.post('http://localhost:11434/v1/chat/completions', {
      model: "llama3.1:8b",
      messages: [{ role: "user", content: "oi" }],
      stream: false
    });
    console.log("Response:", res.data.choices[0].message.content);
  } catch (err) {
    console.error("Error:", err.response?.status, err.response?.data || err.message);
  }
}

test();
