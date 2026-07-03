# DemenScan — ตั้งค่า AI Text-to-Speech (ElevenLabs)

โปรเจกต์นี้เปลี่ยนจาก Web Speech API ของเบราว์เซอร์ (เสียงหุ่นยนต์, ขึ้นกับเครื่องผู้ใช้)
มาเป็น **ElevenLabs AI TTS** (เสียงธรรมชาติ, เหมือนกันทุกเครื่อง) โดยมี Node.js
backend เล็ก ๆ คั่นกลางไว้เก็บ API key อย่างปลอดภัย

```
project/
├── public/          ← หน้าเว็บเดิม (index.html, style.css, app.js ที่แก้ TTS แล้ว)
└── server/          ← backend proxy สำหรับเรียก ElevenLabs
    ├── index.js
    ├── package.json
    └── .env.example
```

## ทำไมต้องมี backend คั่นกลาง

ElevenLabs API key **ห้ามใส่ในโค้ด JavaScript ฝั่งเบราว์เซอร์เด็ดขาด** เพราะใครก็เปิด
"View Source" หรือ DevTools มาก็อปคีย์ไปใช้แทนเราได้ทันที (แล้วโดนเรียกเก็บเงินแทน)
วิธีที่ถูกต้องคือให้ backend ของเราถือคีย์ไว้ แล้วหน้าเว็บยิง request มาที่ backend
ของเราเอง (`/api/tts`) แทน

## ขั้นตอนติดตั้ง

### 1. สมัคร ElevenLabs และหา API key
1. สมัครที่ https://elevenlabs.io (มีแพ็กเกจฟรีให้ทดลองใช้จำนวนตัวอักษรจำกัดต่อเดือน)
2. ไปที่ Settings → API Keys → คัดลอกคีย์มาเก็บไว้

### 2. หา Voice ID เสียงภาษาไทย
1. เข้า https://elevenlabs.io/app/voice-library
2. ค้นหา "Thai" หรือฟังตัวอย่างเสียงหลายๆ เสียง (โมเดล `eleven_multilingual_v2`
   รองรับภาษาไทยได้ดี แม้จะไม่ใช่เสียงที่ติดป้าย "Thai" โดยเฉพาะ ลองเทียบเสียงดูได้)
3. กด "Add to my voices" แล้วไปที่ VoiceLab เพื่อคัดลอก **Voice ID** (สายอักขระยาวๆ)
   มาใส่ในไฟล์ `.env`

### 3. ตั้งค่า backend
```bash
cd server
cp .env.example .env
# แก้ .env ใส่ ELEVENLABS_API_KEY และ ELEVENLABS_VOICE_ID ของจริง
npm install
npm start
```
เปิดเบราว์เซอร์ไปที่ `http://localhost:3000` จะเห็นหน้าเว็บ DemenScan รันอยู่
(server เสิร์ฟทั้งหน้าเว็บและ API จากที่เดียวกัน ไม่ต้องตั้งค่า CORS เพิ่ม)

### 4. ทดสอบ
กดปุ่ม 🔊 หน้าไหนก็ได้ในแอป — ปุ่มจะขึ้น "⏳ กำลังโหลดเสียง..." สักครู่ (ครั้งแรกของ
ข้อความนั้น) แล้วเล่นเสียงจาก ElevenLabs ครั้งถัดไปที่กดข้อความเดิมจะเร็วขึ้นมาก
เพราะมีการแคชเสียงไว้ทั้งฝั่ง browser และฝั่ง server

## Deploy ขึ้นจริง (โน้ตสั้นๆ)
- Deploy โฟลเดอร์ `server/` ขึ้น hosting ที่รัน Node ได้ เช่น Render, Railway, Fly.io,
  หรือ VPS ของคุณเอง — ตั้งค่า environment variables (`ELEVENLABS_API_KEY`,
  `ELEVENLABS_VOICE_ID`) ในหน้า dashboard ของ hosting นั้นแทนไฟล์ `.env`
- ถ้าจะแยกโฮสต์หน้าเว็บ (เช่น Netlify/Vercel) กับ backend คนละที่ ต้องแก้
  `TTS_ENDPOINT` ใน `public/app.js` ให้ชี้ไป URL เต็มของ backend เช่น
  `https://your-backend.onrender.com/api/tts` และเปิด CORS ใน `server/index.js`
  (เพิ่ม `const cors = require('cors'); app.use(cors());` — ต้อง `npm install cors` ด้วย)

## Fallback
ถ้า backend ล่มหรือ ElevenLabs ตอบผิดพลาด แอปจะสลับไปใช้ Web Speech API ของ
เบราว์เซอร์โดยอัตโนมัติ ผู้ใช้ยังฟังเสียงคำถามได้เสมอ เพียงแต่คุณภาพเสียงจะลดลง
