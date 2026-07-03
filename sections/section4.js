/* Section 4: การประเมินสติปัญญาเบื้องต้น */
(function () {
  const { RECALL_WORDS } = window.DemenScanData;
  window.DemenScanSections.push(
    {
        id: 4, title: 'การประเมินสติปัญญาเบื้องต้น', scored: true, maxPoints: 12,
        questions: [
          { id:'s4q1', text:'มื้อเย็นเมื่อวานนี้ ท่านทานอาหารเวลาประมาณกี่นาฬิกา?', type:'self-check', hint:'ไม่มีคำตอบตายตัว — ผู้ดูแล/ตัวท่านเองยืนยันว่าตอบได้อย่างสมเหตุสมผล' },
          { id:'s4q2', text:'ฤดูกาลของประเทศไทยตามปกติมีทั้งหมดกี่ฤดู?', type:'choice', options:['4','5','6','3','2'], answer:'3' },
          { id:'s4q3', text:'โปรดเติมตัวเลขที่หายไป: 2, 4, 6, ___, 10, ___', type:'multi-choice-exact', options:['7','8','9','11','12','13'], answer:['8','12'], hint:'เลือกตัวเลขที่หายไปให้ครบ 2 ตัว' },
          { id:'s4q4', text:'ท่านใช้แอปพลิเคชันในมือถือเป็นกี่แอป? (ตอบเป็นตัวเลข)', type:'self-check', hint:'ไม่มีคำตอบตายตัว ใช้เพื่อดูความสามารถในการนับ/ตระหนักรู้' },
          { id:'s4q5', text:'จังหวัดเชียงใหม่ตั้งอยู่ทางภาคใต้ของประเทศไทย', type:'boolean', answer:false },
          { id:'s4q6', text:'เมื่อวานนี้คือวันอะไรในสัปดาห์?', type:'dynamic-day' },
          { id:'s4q7', text:'เดือนหน้าคือเดือนอะไร?', type:'dynamic-month' },
          { id:'s4q8', text:'ปัจจุบันท่านพักอาศัยอยู่ในประเทศอะไร?', type:'choice', options:['อินเดีย','จีน','อินโดนีเซีย','ญี่ปุ่น','ไทย'], answer:'ไทย' },
          { id:'s4q9', text:`กรุณาจำคำ 3 คำนี้ แล้วพิมพ์ซ้ำ: "${RECALL_WORDS.join(', ')}"`, type:'recall-three-inputs', answer:RECALL_WORDS },
          { id:'s4q10', text:'50 ลบออก 5 เหลือเท่าไร?', type:'number', answer:45 },
          { id:'s4q11', text:'กรุณาทวนคำศัพท์ 3 คำที่ให้จำเมื่อสักครู่นี้อีกครั้ง (ไม่ดูคำใบ้)', type:'recall-three-inputs', answer:RECALL_WORDS },
          { id:'s4q12', text:'ให้พิมพ์ชื่อผลไม้ที่ท่านชอบที่สุดมา 1 ชนิด', type:'text-presence', hint:'พิมพ์คำตอบ 1 ชนิด หากไม่ตอบจะได้ 0 คะแนน' },
        ]
      }
  );
})();
