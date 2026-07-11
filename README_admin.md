# README Admin - DemenScan

เอกสารนี้ออกแบบระบบหลังบ้านสำหรับผู้ดูแลระบบของ DemenScan โดยอิงจากโปรเจกต์ปัจจุบันที่เป็นหน้าเว็บแบบ frontend อย่างเดียว (`index.html`, `app.js`, `sections/*.js`) และยังไม่บันทึกผลประเมินลงฐานข้อมูล ดังนั้นงาน admin ต้องเริ่มจากการเพิ่ม backend/database ก่อน แล้วจึงทำหน้า login, dashboard, filter และ export Excel

## เป้าหมายของระบบ

1. ให้ admin เข้าสู่ระบบได้อย่างปลอดภัย
2. บันทึกผลแบบประเมินที่ user ทำเสร็จลงฐานข้อมูล
3. ให้ admin ดูรายการผลประเมินทั้งหมดได้
4. ให้ admin กรองข้อมูลตามเงื่อนไขที่ใช้งานจริงได้
5. ให้ admin ดูรายละเอียดคำตอบรายคนได้
6. ให้ admin export ข้อมูลออกเป็นไฟล์ Excel ได้

## สถานะโปรเจกต์ปัจจุบัน

- แอปหลักเป็น static frontend ไม่มี backend
- คำถามอยู่ใน `sections/section1.js` ถึง `sections/section6.js`
- flow และการคำนวณคะแนนอยู่ใน `app.js`
- คำตอบทั้งหมดอยู่ใน memory ผ่าน `state.answers`
- คะแนนรวมคำนวณจากส่วนที่ 4, 5, 6 เท่านั้น รวม 97 คะแนน
- ระดับความเสี่ยงปัจจุบันแบ่งเป็น
  - `low`: 78 - 97 คะแนน
  - `moderate`: 59 - 77 คะแนน
  - `high`: 58 คะแนนหรือน้อยกว่า
- หน้า result แสดงคะแนนรวม, ระดับความเสี่ยง, คะแนนราย section และคำแนะนำเฉพาะบุคคล

## แนวทางเทคโนโลยีที่เหมาะกับโปรเจกต์นี้

เนื่องจากโปรเจกต์อยู่ใน `D:\xampp\htdocs\DemenScan` แนะนำให้ใช้ stack นี้ก่อน:

- Backend: PHP
- Database: MySQL/MariaDB ผ่าน XAMPP
- Admin UI: HTML/CSS/JavaScript หรือ PHP template
- Session login: PHP session
- Password: `password_hash()` และ `password_verify()`
- Export Excel:
  - ระยะเริ่มต้นใช้ `.csv` ที่ Excel เปิดได้ทันที
  - ถ้าต้องการ `.xlsx` จริง ให้ใช้ Composer package `phpoffice/phpspreadsheet`

## โครงสร้างไฟล์ที่ควรเพิ่ม

```text
DemenScan/
  admin/
    login.php
    logout.php
    index.php
    submissions.php
    submission-detail.php
    export.php
  api/
    assessment-submit.php
    admin-submissions.php
    admin-submission-detail.php
  config/
    database.php
    auth.php
  database/
    schema.sql
    seed_admin.sql
  README_admin.md
```

หมายเหตุ: หากต้องการแยก frontend ให้สะอาดกว่านี้ อาจเก็บหน้า admin เป็น `admin/*.php` และให้ API อยู่ใน `api/*.php`

## บทบาทผู้ใช้

### User ทั่วไป

- เข้าใช้งานหน้า `index.html`
- ทำแบบประเมินทั้ง 6 ส่วน
- เมื่อถึงหน้า result ระบบส่งผลประเมินไปบันทึกในฐานข้อมูล
- ไม่ต้อง login
- ไม่ควรเห็นข้อมูล admin

### Admin

- เข้า `/admin/login.php`
- ดู dashboard ภาพรวมผลประเมิน
- ดูตารางรายการผู้ทำแบบประเมิน
- กรองข้อมูล
- เปิดดูรายละเอียดคำตอบ
- export Excel ตามผลลัพธ์ที่กรองอยู่

## ข้อมูลที่ควรบันทึก

ควรแยกข้อมูลเป็น 2 ระดับ: summary และ answers

### 1. Summary ของผลประเมิน

เก็บในตาราง `assessment_submissions`

ข้อมูลหลัก:

- `id`
- `submission_code` รหัสอ้างอิง เช่น `DS-20260704-000001`
- `created_at`
- `total_score`
- `risk_level` เช่น `low`, `moderate`, `high`
- `section4_score`
- `section5_score`
- `section6_score`
- `max_score` ค่าเริ่มต้น 97
- `age`
- `gender`
- `education`
- `marital_status`
- `monthly_income`
- `family_dementia_history`
- `sleep_time`
- `wake_time`
- `smoking`
- `alcohol`
- `exercise_frequency`
- `diseases`
- `feedback_json`
- `user_agent`
- `ip_address`

ข้อควรระวัง: หน้าเว็บปัจจุบันระบุว่าไม่เก็บชื่อ นามสกุล หรือข้อมูลระบุตัวตน ดังนั้น admin version ควรยังคงไม่เก็บ PII ยกเว้นมีการเพิ่มหน้าขอความยินยอมและระบุวัตถุประสงค์ชัดเจน

### 2. รายละเอียดคำตอบ

เก็บในตาราง `assessment_answers`

ข้อมูลหลัก:

- `id`
- `submission_id`
- `section_id`
- `question_id`
- `question_text`
- `answer_value`
- `score`
- `created_at`

`answer_value` ควรเก็บเป็น JSON/text เพื่อรองรับคำตอบหลายรูปแบบ เช่น choice, multi-choice, input 3 ช่อง, drag/drop sequence, pair matching

## ตัวอย่าง schema เบื้องต้น

```sql
CREATE TABLE admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(150) NOT NULL,
  role ENUM('admin', 'super_admin') NOT NULL DEFAULT 'admin',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE assessment_submissions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  submission_code VARCHAR(40) NOT NULL UNIQUE,
  total_score INT NOT NULL,
  max_score INT NOT NULL DEFAULT 97,
  risk_level ENUM('low', 'moderate', 'high') NOT NULL,
  section4_score INT NOT NULL DEFAULT 0,
  section5_score INT NOT NULL DEFAULT 0,
  section6_score INT NOT NULL DEFAULT 0,
  age INT NULL,
  gender VARCHAR(50) NULL,
  education VARCHAR(150) NULL,
  marital_status VARCHAR(100) NULL,
  monthly_income VARCHAR(100) NULL,
  family_dementia_history VARCHAR(50) NULL,
  sleep_time TIME NULL,
  wake_time TIME NULL,
  smoking VARCHAR(100) NULL,
  alcohol VARCHAR(100) NULL,
  exercise_frequency VARCHAR(100) NULL,
  diseases TEXT NULL,
  feedback_json JSON NULL,
  user_agent TEXT NULL,
  ip_address VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_created_at (created_at),
  INDEX idx_risk_level (risk_level),
  INDEX idx_total_score (total_score),
  INDEX idx_age (age)
);

CREATE TABLE assessment_answers (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  submission_id BIGINT NOT NULL,
  section_id INT NOT NULL,
  question_id VARCHAR(30) NOT NULL,
  question_text TEXT NOT NULL,
  answer_value JSON NULL,
  score INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES assessment_submissions(id) ON DELETE CASCADE,
  INDEX idx_submission_id (submission_id),
  INDEX idx_question_id (question_id)
);
```

## Flow การบันทึกผลประเมิน

1. User ทำแบบประเมินจนถึงหน้า result
2. `app.js` คำนวณคะแนนด้วย `computeCognitiveScore()`
3. ระบบสร้าง payload จาก `state.answers`, คะแนนรวม, คะแนนราย section, risk level และ feedback
4. ส่ง `POST` ไปที่ `api/assessment-submit.php`
5. Backend validate payload
6. Backend บันทึกลง `assessment_submissions`
7. Backend บันทึกคำตอบทั้งหมดลง `assessment_answers`
8. Backend ส่ง `submission_code` กลับมา
9. หน้า result อาจแสดงรหัสอ้างอิงให้ user เก็บไว้

## Payload ที่ frontend ควรส่ง

```json
{
  "total_score": 82,
  "max_score": 97,
  "risk_level": "low",
  "section_scores": {
    "4": 10,
    "5": 22,
    "6": 50
  },
  "profile": {
    "age": 68,
    "gender": "หญิง",
    "education": "ประถมศึกษา",
    "marital_status": "สมรส",
    "monthly_income": "5,001 - 10,000 บาท",
    "family_dementia_history": "ไม่มี",
    "sleep_time": "21:30",
    "wake_time": "05:30",
    "smoking": "ไม่สูบเลย",
    "alcohol": "ไม่ดื่มเลย",
    "exercise_frequency": "3 วัน/สัปดาห์",
    "diseases": ["ความดันโลหิตสูง"]
  },
  "answers": [
    {
      "section_id": 1,
      "question_id": "s1q1",
      "question_text": "เพศ",
      "answer_value": "หญิง",
      "score": 0
    }
  ],
  "feedback": []
}
```

## หน้า Admin ที่ต้องมี

## การเปิดใช้งานหลัง implement

1. เปิด MySQL ใน XAMPP
2. Import `database/schema.sql`
3. Import `database/seed_admin.sql`
4. เข้าใช้งานที่ `/DemenScan/admin/login.php`
5. บัญชีเริ่มต้น:
   - Username: `admin`
   - Password: `admin1234`
6. หลังเข้าได้แล้วควรเปลี่ยนรหัสผ่านในฐานข้อมูลหรือเพิ่มหน้าจัดการ admin ในรอบถัดไป

### 1. Login

Path: `/admin/login.php`

สิ่งที่ต้องมี:

- ช่อง username
- ช่อง password
- ปุ่มเข้าสู่ระบบ
- ข้อความแจ้ง error เมื่อ login ไม่สำเร็จ
- redirect ไป dashboard เมื่อ login สำเร็จ
- redirect ออกจากหน้า admin หากยังไม่ login

ความปลอดภัย:

- ใช้ PHP session
- hash password ใน database
- ป้องกัน brute force เบื้องต้น เช่น delay หรือจำกัดจำนวนครั้ง
- ป้องกัน session fixation ด้วย `session_regenerate_id(true)` หลัง login

### 2. Dashboard

Path: `/admin/index.php`

ข้อมูลที่ควรแสดง:

- จำนวนผู้ทำแบบประเมินทั้งหมด
- จำนวนผู้ทำวันนี้
- คะแนนเฉลี่ย
- จำนวนแยกตามระดับความเสี่ยง
- กราฟ/summary ระดับความเสี่ยง
- รายการผลประเมินล่าสุด 10 รายการ

### 3. ตารางผลประเมิน

Path: `/admin/submissions.php`

คอลัมน์แนะนำ:

- วันที่ทำแบบประเมิน
- รหัสอ้างอิง
- อายุ
- เพศ
- ระดับการศึกษา
- คะแนนรวม
- คะแนนส่วนที่ 4
- คะแนนส่วนที่ 5
- คะแนนส่วนที่ 6
- ระดับความเสี่ยง
- ปุ่มดูรายละเอียด

ควรมี pagination เช่น 20, 50, 100 รายการต่อหน้า

### 4. หน้ารายละเอียดผลประเมิน

Path: `/admin/submission-detail.php?id=...`

ข้อมูลที่ควรแสดง:

- summary ของผลประเมิน
- คะแนนรวมและระดับความเสี่ยง
- คะแนนราย section
- ข้อมูลทั่วไปจาก section 1
- คำตอบทั้งหมดแยกตาม section
- คำแนะนำเฉพาะบุคคลที่ระบบสร้างให้
- ปุ่มกลับไปหน้ารายการ

### 5. Export Excel

Path: `/admin/export.php`

พฤติกรรมที่ต้องการ:

- export ตาม filter ที่ admin เลือกอยู่
- ถ้าไม่เลือก filter ให้ export ทั้งหมด
- ไฟล์ควรมีชื่อเช่น `demenscan-submissions-2026-07-04.xlsx`
- ระยะเริ่มต้นสามารถออกเป็น `.csv` ได้ก่อน

## ระบบกรองข้อมูล

ตัวกรองที่ควรมีในหน้า `/admin/submissions.php`

- วันที่เริ่มต้น
- วันที่สิ้นสุด
- ระดับความเสี่ยง: ทั้งหมด, ต่ำ, ปานกลาง, สูง
- ช่วงคะแนนรวม เช่น min/max
- ช่วงอายุ เช่น min/max
- เพศ
- ระดับการศึกษา
- ประวัติครอบครัวมีภาวะสมองเสื่อม
- โรคประจำตัว
- คำค้นหาโดยรหัสอ้างอิง

หลักการทำงาน:

- filter ต้องใช้ query string เช่น `?date_from=2026-07-01&date_to=2026-07-04&risk_level=high`
- ปุ่ม export ต้องแนบ query string ชุดเดียวกันไปด้วย
- backend ต้อง validate ค่า filter ทุกตัวก่อนนำไป query
- query ต้องใช้ prepared statement เท่านั้น

## Columns สำหรับ Excel

Sheet แรก: `Submissions`

- Submission Code
- Created At
- Total Score
- Max Score
- Risk Level
- Section 4 Score
- Section 5 Score
- Section 6 Score
- Age
- Gender
- Education
- Marital Status
- Monthly Income
- Family Dementia History
- Sleep Time
- Wake Time
- Smoking
- Alcohol
- Exercise Frequency
- Diseases

Sheet ที่สอง: `Answers` ถ้าใช้ `.xlsx`

- Submission Code
- Section ID
- Question ID
- Question Text
- Answer Value
- Score

ถ้าใช้ `.csv` ก่อน ให้เริ่มจาก export เฉพาะ summary ใน `assessment_submissions` เพื่อให้ใช้งานได้เร็ว แล้วค่อยเพิ่ม export รายละเอียดในรอบถัดไป

## API ที่ควรมี

### `POST /api/assessment-submit.php`

ใช้บันทึกผลประเมินจากหน้า user

Response สำเร็จ:

```json
{
  "ok": true,
  "submission_code": "DS-20260704-000001"
}
```

### `GET /api/admin-submissions.php`

ใช้ดึงรายการผลประเมินแบบ JSON สำหรับหน้า admin

Query parameters:

- `date_from`
- `date_to`
- `risk_level`
- `score_min`
- `score_max`
- `age_min`
- `age_max`
- `gender`
- `education`
- `q`
- `page`
- `per_page`

### `GET /api/admin-submission-detail.php?id=...`

ใช้ดึงข้อมูลละเอียดของ submission เดียว

## งานที่ต้องแก้ใน frontend เดิม

### `app.js`

ต้องเพิ่ม logic หลังคำนวณผลลัพธ์:

- สร้าง payload สำหรับส่ง backend
- map `state.answers` ให้เป็นรายการคำตอบที่มี section/question text
- ส่งข้อมูลไป `api/assessment-submit.php`
- ป้องกันการส่งซ้ำเมื่อ render result หลายครั้ง
- แสดงสถานะบันทึกผล เช่น กำลังบันทึก, บันทึกแล้ว, บันทึกไม่สำเร็จ

### `index.html`

อาจเพิ่มจุดแสดงรหัสอ้างอิงในหน้า result เช่น:

```html
<p id="submission-code" hidden></p>
```

### `style.css`

เพิ่ม style สำหรับสถานะการบันทึกผลและรหัสอ้างอิง

## ลำดับการพัฒนาที่แนะนำ

### Phase 1: Database และ admin login

1. สร้าง `database/schema.sql`
2. สร้าง `config/database.php`
3. สร้าง `admins` table
4. เพิ่ม admin เริ่มต้นด้วย password hash
5. ทำ `/admin/login.php`
6. ทำ `/admin/logout.php`
7. ทำ `config/auth.php` สำหรับเช็ค session

ผลลัพธ์ที่ต้องได้: admin login/logout ได้จริง

### Phase 2: บันทึกผลประเมินจากหน้า user

1. สร้าง `assessment_submissions`
2. สร้าง `assessment_answers`
3. สร้าง `api/assessment-submit.php`
4. แก้ `app.js` ให้ส่งผลประเมินหลังจบแบบทดสอบ
5. แสดง `submission_code` ในหน้า result

ผลลัพธ์ที่ต้องได้: user ทำแบบประเมินแล้วข้อมูลถูกบันทึกลง database

### Phase 3: Dashboard และตารางผลประเมิน

1. สร้าง `/admin/index.php`
2. สร้าง `/admin/submissions.php`
3. ทำ pagination
4. ทำ summary cards
5. ทำ risk badge สีต่างกัน

ผลลัพธ์ที่ต้องได้: admin เห็นข้อมูลที่ user ทำแบบประเมินมา

### Phase 4: Filter

1. เพิ่มฟอร์ม filter ใน `/admin/submissions.php`
2. ทำ backend query ด้วย prepared statement
3. sync filter กับ query string
4. ทำปุ่ม clear filter

ผลลัพธ์ที่ต้องได้: admin กรองข้อมูลตามวันที่ คะแนน อายุ เพศ และระดับความเสี่ยงได้

### Phase 5: Detail และ Export Excel

1. สร้าง `/admin/submission-detail.php`
2. ดึงคำตอบจาก `assessment_answers`
3. สร้าง `/admin/export.php`
4. export ตาม filter ปัจจุบัน
5. เริ่มจาก `.csv` หรือทำ `.xlsx` ด้วย PhpSpreadsheet

ผลลัพธ์ที่ต้องได้: admin ดูรายละเอียดรายคนและ export ข้อมูลออกไปเปิดใน Excel ได้

## เกณฑ์ทดสอบก่อนส่งงาน

- ทำแบบประเมินจนครบแล้วมี record ใน `assessment_submissions`
- จำนวนคำตอบใน `assessment_answers` ตรงกับจำนวนคำถามที่ตอบ
- คะแนนรวมใน database ตรงกับคะแนนที่หน้า result แสดง
- risk level ใน database ตรงกับ rule ปัจจุบัน
- admin login สำเร็จด้วยบัญชีที่ seed ไว้
- คนที่ไม่ login เปิด `/admin/index.php` ไม่ได้
- filter วันที่ทำงานถูกต้อง
- filter risk level ทำงานถูกต้อง
- export แล้ว Excel เปิดอ่านภาษาไทยได้ถูกต้อง
- export ใช้ filter ชุดเดียวกับหน้ารายการ

## ประเด็นที่ต้องตัดสินใจก่อนลงมือทำจริง

1. ต้องการเก็บข้อมูลระบุตัวตนหรือไม่ เช่น ชื่อ, เบอร์โทร, รหัสผู้ป่วย
2. ต้องการ export เป็น `.csv` ก่อน หรือทำ `.xlsx` จริงทันที
3. ต้องการ admin หลายคนหรือมีแค่บัญชีเดียว
4. ต้องการแยกสิทธิ์ `admin` กับ `super_admin` หรือไม่
5. ต้องการลบข้อมูลผลประเมินจากหน้า admin ได้หรือไม่

## คำแนะนำเบื้องต้น

ให้เริ่มแบบ conservative:

- ไม่เก็บชื่อ/เบอร์โทรก่อน เพื่อให้สอดคล้องกับหน้าเว็บปัจจุบัน
- ใช้ PHP + MySQL เพราะอยู่บน XAMPP แล้ว
- ทำ `.csv` ก่อนเพื่อให้ export ใช้งานได้เร็ว
- เก็บคำตอบ raw เป็น JSON เพื่อรองรับชนิดคำถามที่หลากหลาย
- ใช้ prepared statement ทุก query
- แยกไฟล์ auth/database ออกมาเพื่อลดโค้ดซ้ำ
