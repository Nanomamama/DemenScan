/* ==========================================================
   DemenScan — TTS proxy server (ElevenLabs)

   หน้าที่:
   1) เสิร์ฟไฟล์เว็บสถิต (public/index.html, style.css, app.js)
   2) เปิดเอนด์พอยต์ POST /api/tts รับ { text } แล้วไปเรียก
      ElevenLabs Text-to-Speech API แทนฝั่ง client (กัน API key รั่ว)
      แล้วส่งไฟล์เสียง (audio/mpeg) กลับไปให้เบราว์เซอร์เล่น
   ========================================================== */

require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID; // ดู README.md วิธีหา voice id เสียงไทย
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';

if (!ELEVENLABS_API_KEY) {
  console.warn('⚠️  ยังไม่ได้ตั้งค่า ELEVENLABS_API_KEY ใน .env — /api/tts จะใช้งานไม่ได้');
}
if (!VOICE_ID) {
  console.warn('⚠️  ยังไม่ได้ตั้งค่า ELEVENLABS_VOICE_ID ใน .env — /api/tts จะใช้งานไม่ได้');
}

// แคชผลลัพธ์เสียงในหน่วยความจำฝั่งเซิร์ฟเวอร์ด้วย (นอกเหนือจากแคชฝั่ง browser)
// ประหยัดโควตา ElevenLabs เวลามีผู้ใช้หลายคนฟังคำถามเดิม เช่น "ฟังคำอธิบาย" หน้าแรก
const serverAudioCache = new Map(); // text -> Buffer
const MAX_CACHE_ENTRIES = 200;

app.post('/api/tts', async (req, res) => {
  const { text } = req.body || {};

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'ต้องส่ง text ที่ไม่ว่างเปล่า' });
  }
  const cleanText = text.trim();
  if (cleanText.length > 1000) {
    return res.status(400).json({ error: 'ข้อความยาวเกินไป (จำกัด 1000 ตัวอักษร ต่อการเรียก 1 ครั้ง)' });
  }
  if (!ELEVENLABS_API_KEY || !VOICE_ID) {
    return res.status(500).json({ error: 'เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID' });
  }

  try {
    if (serverAudioCache.has(cleanText)) {
      res.set('Content-Type', 'audio/mpeg');
      return res.send(serverAudioCache.get(cleanText));
    }

    const elResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: MODEL_ID,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.2,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!elResponse.ok) {
      const errText = await elResponse.text().catch(() => '');
      console.error('ElevenLabs API error:', elResponse.status, errText);
      return res.status(502).json({ error: 'เรียก ElevenLabs API ไม่สำเร็จ' });
    }

    const audioBuffer = Buffer.from(await elResponse.arrayBuffer());

    if (serverAudioCache.size >= MAX_CACHE_ENTRIES) {
      serverAudioCache.delete(serverAudioCache.keys().next().value); // ทิ้งอันเก่าสุดแบบง่ายๆ
    }
    serverAudioCache.set(cleanText, audioBuffer);

    res.set('Content-Type', 'audio/mpeg');
    res.send(audioBuffer);
  } catch (err) {
    console.error('TTS proxy error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
  }
});

// เสิร์ฟหน้าเว็บ DemenScan จากโฟลเดอร์ public/ (อยู่ระดับเดียวกับ server/)
app.use(express.static(path.join(__dirname, '..', 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ DemenScan (+ AI TTS) กำลังรันที่ http://localhost:${PORT}`);
});
