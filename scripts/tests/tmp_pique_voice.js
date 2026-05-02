const axios = require('axios');
async function run() {
  const API_KEY = "sk-api-jSafHRjNogPHDOKYgRYD5riY88ZOADQJ9Db6U5CtqmI2ouqSNTBZO8X97VqhuxMtdHx1aGY6B7K9p1CMCn4c4n3aqdOWOZxeuXdrjOkau0mXLWBJWsD11dQ";
  try {
      const res = await axios.post('https://api.minimax.io/v1/get_voice', { voice_type: 'all' }, { headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' }});
      console.log(JSON.stringify(res.data.voice_cloning, null, 2));
  } catch (e) { console.log(e.response ? e.response.data : e.message); }
}
run();
