/* Shared data used by question sections and scoring. */
(function () {
  const RECALL_WORDS = ['ช้าง', 'พัดลม', 'ทะเล'];
  
  const THAI_DAYS = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
  const THAI_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
    'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  
  /* ชุดคำถาม "หาภาพที่ถูกบดบัง" (ส่วนที่ 5 หมวดมิติสัมพันธ์)
     แต่ละข้อมี 4 รูป โดยมี 1 รูปถูกแปะแผ่นสีเทาบังบางส่วนไว้ (occludedIndex)
     ผู้ทำแบบทดสอบต้องแตะรูปที่ถูกบดบัง เพื่อวัดความใส่ใจเชิงพื้นที่/การมองเห็น
     หมายเหตุ: ใช้อิโมจิแทนภาพถ่ายจริงเพื่อความเบาและไม่ต้องพึ่ง asset ภายนอก
     ทีม content สามารถสลับเป็นภาพถ่ายจริงได้ภายหลังโดยคงโครงสร้าง icons/occludedIndex เดิม */
  const VISUOSPATIAL_SETS = [
    {
      icons: [{emoji:'🍎',name:'แอปเปิ้ล'},{emoji:'🍅',name:'มะเขือเทศ'},{emoji:'🍑',name:'พีช'},{emoji:'🍊',name:'ส้ม'}],
      occludedIndex: 1,
      occlusion: { right: '20%', bottom: '18%', width: '34%', height: '34%', rotate: '-14deg' },
    },
    {
      icons: [{emoji:'🐘',name:'ช้าง'},{emoji:'🦏',name:'แรด'},{emoji:'🦛',name:'ฮิปโป'},{emoji:'🐃',name:'ควาย'}],
      occludedIndex: 2,
      occlusion: { left: '18%', bottom: '22%', width: '36%', height: '32%', rotate: '18deg' },
    },
    {
      icons: [{emoji:'🔑',name:'กุญแจ'},{emoji:'🗝️',name:'ลูกกุญแจ'},{emoji:'🔐',name:'แม่กุญแจ'},{emoji:'🪛',name:'ไขควง'}],
      occludedIndex: 0,
      occlusion: { right: '26%', top: '22%', width: '32%', height: '34%', rotate: '10deg' },
    },
    {
      icons: [{emoji:'📱',name:'โทรศัพท์มือถือ'},{emoji:'☎️',name:'โทรศัพท์บ้าน'},{emoji:'⌚',name:'นาฬิกาอัจฉริยะ'},{emoji:'🖥️',name:'จอคอมพิวเตอร์'}],
      occludedIndex: 3,
      occlusion: { left: '24%', top: '28%', width: '36%', height: '30%', rotate: '-8deg' },
    },
    {
      icons: [{emoji:'🕯️',name:'เทียน'},{emoji:'💡',name:'หลอดไฟ'},{emoji:'🔦',name:'ไฟฉาย'},{emoji:'🧯',name:'ถังดับเพลิง'}],
      occludedIndex: 1,
      occlusion: { right: '24%', bottom: '24%', width: '33%', height: '33%', rotate: '16deg' },
    },
  ];
  
  function shuffleArray(array) {
    const copy = array.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
  
  const MATCH_PAIR_SETS = [
    {
      left: [
        { emoji: '🪥', label: 'แปรงสีฟัน' },
        { emoji: '🍚', label: 'ข้าว' },
        { emoji: '🧦', label: 'ถุงเท้า' },
      ],
      right: [
        { emoji: '🦷', label: 'ฟัน' },
        { emoji: '🥄', label: 'ช้อน' },
        { emoji: '👟', label: 'รองเท้า' },
      ],
    },
    {
      left: [
        { emoji: '🌱', label: 'ต้นไม้' },
        { emoji: '🐟', label: 'ปลา' },
        { emoji: '📷', label: 'กล้องถ่ายรูป' },
      ],
      right: [
        { emoji: '💧', label: 'น้ำ' },
        { emoji: '🌊', label: 'น้ำทะเล' },
        { emoji: '🖼️', label: 'รูปภาพ' },
      ],
    },
    {
      left: [
        { emoji: '🧵', label: 'ด้าย' },
        { emoji: '🔌', label: 'ปลั๊กไฟ' },
        { emoji: '✉️', label: 'จดหมาย' },
      ],
      right: [
        { emoji: '🪡', label: 'เข็ม' },
        { emoji: '💡', label: 'หลอดไฟ' },
        { emoji: '📮', label: 'ตู้ไปรษณีย์' },
      ],
    },
  ];
  
  const SEQUENCE_SETS = [
    {
      title: 'การชงกาแฟด้วยเครื่องชง',
      steps: [
        { id: 'step1-1', label: 'เตรียมกาแฟและอุปกรณ์' },
        { id: 'step1-2', label: 'เติมน้ำลงในหม้อหรือเครื่องชง' },
        { id: 'step1-3', label: 'ใส่ผงกาแฟลงในกรอง' },
        { id: 'step1-4', label: 'เปิดเครื่องหรือต้มน้ำให้เดือด' },
        { id: 'step1-5', label: 'รินกาแฟใส่ถ้วยและคนให้เข้ากัน' },
      ],
      correctOrder: ['step1-1','step1-2','step1-3','step1-4','step1-5'],
    },
    {
      title: 'กิจวัตรตอนเช้าหลังตื่นนอน',
      steps: [
        { id: 'step2-1', label: 'ลุกจากเตียง' },
        { id: 'step2-2', label: 'ล้างหน้าและแปรงฟัน' },
        { id: 'step2-3', label: 'แต่งตัว' },
        { id: 'step2-4', label: 'ทานอาหารเช้า' },
        { id: 'step2-5', label: 'เตรียมของและออกจากบ้าน' },
      ],
      correctOrder: ['step2-1','step2-2','step2-3','step2-4','step2-5'],
    },
    {
      title: 'การชงกาแฟแบบเติมนมและน้ำตาล',
      steps: [
        { id: 'step3-1', label: 'เลือกรสชาติกาแฟที่ต้องการ' },
        { id: 'step3-2', label: 'ตวงผงกาแฟลงในกรอง' },
        { id: 'step3-3', label: 'เติมน้ำร้อนลงในปริมาณที่เหมาะสม' },
        { id: 'step3-4', label: 'คนกาแฟให้เข้ากัน' },
        { id: 'step3-5', label: 'เติมนมและน้ำตาลตามชอบ' },
      ],
      correctOrder: ['step3-1','step3-2','step3-3','step3-4','step3-5'],
    },
    {
      title: 'การเตรียมตัวออกไปทำกิจกรรมตอนเช้า',
      steps: [
        { id: 'step4-1', label: 'ตื่นนอนและยืดแขนขา' },
        { id: 'step4-2', label: 'ล้างหน้าและแปรงฟัน' },
        { id: 'step4-3', label: 'สวมใส่เสื้อผ้า' },
        { id: 'step4-4', label: 'เตรียมอาหารเช้า' },
        { id: 'step4-5', label: 'ออกไปเดินเล่นหรือทำกิจกรรมเบาๆ' },
      ],
      correctOrder: ['step4-1','step4-2','step4-3','step4-4','step4-5'],
    },
    {
      title: 'การเตรียมตัวก่อนออกจากบ้าน',
      steps: [
        { id: 'step5-1', label: 'ดื่มน้ำก่อนเริ่มกิจกรรม' },
        { id: 'step5-2', label: 'อาบน้ำและแต่งตัว' },
        { id: 'step5-3', label: 'เตรียมถุงกาแฟหรือขนมสำหรับเดินทาง' },
        { id: 'step5-4', label: 'ล็อกประตูและเตรียมกุญแจ' },
        { id: 'step5-5', label: 'ออกจากบ้านอย่างระมัดระวัง' },
      ],
      correctOrder: ['step5-1','step5-2','step5-3','step5-4','step5-5'],
    },
  ];

  window.DemenScanData = {
    RECALL_WORDS,
    THAI_DAYS,
    THAI_MONTHS,
    VISUOSPATIAL_SETS,
    MATCH_PAIR_SETS,
    SEQUENCE_SETS,
    shuffleArray,
  };
  window.DemenScanSections = [];
})();
