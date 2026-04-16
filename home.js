import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc, collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBnt-QqUiwJOOsVvNaXxlkEBjtTXG3gOhA",
  authDomain: "foodie-station-d63ae.firebaseapp.com",
  projectId: "foodie-station-d63ae",
  storageBucket: "foodie-station-d63ae.firebasestorage.app",
  messagingSenderId: "204905312487",
  appId: "1:204905312487:web:bb60e8fbae5dec0c217242"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// 🔑 API Key ของ ImgBB
const IMGBB_API_KEY = "b4fd4fb8c360b801d01583c9f0379bb0"; 

let currentUser = null;

const DAILY_QUESTS = [
    { id: 'q_login', title: 'เข้าสู่ระบบรายวัน', reward: 10, target: 1 },
    { id: 'q_review', title: 'รีวิวร้านอาหาร 1 ครั้ง', reward: 20, target: 1 }
];

function showToast(message) {
    const toast = document.getElementById("toastNotification");
    if (!toast) return;
    toast.innerText = message;
    toast.classList.add("show");
    setTimeout(() => { toast.classList.remove("show"); }, 3500); 
}

// ฟังก์ชันอัปโหลดรูปขึ้น ImgBB
async function uploadToImgBB(file) {
    const formData = new FormData();
    formData.append('image', file);
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: 'POST',
        body: formData
    });
    const data = await response.json();
    if (data.success) return data.data.url;
    throw new Error("Upload failed");
}

function renderQuests(questData) {
    const container = document.getElementById('questListContainer');
    if(!container) return;
    container.innerHTML = '';
    
    DAILY_QUESTS.forEach(q => {
        const progress = questData[q.id] || 0;
        const isCompleted = progress >= q.target;
        const statusClass = isCompleted ? 'completed' : 'pending';
        const statusIcon = isCompleted ? '✓' : `${progress}/${q.target}`;
        
        const div = document.createElement('div');
        div.className = 'quest-item';
        div.innerHTML = `
            <div class="quest-info">
                <div class="quest-title">${q.title}</div>
                <div class="quest-reward" style="display:inline-flex; align-items:center; gap:4px;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="#b78a5b" stroke="#b78a5b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                    +${q.reward} แต้ม
                </div>
            </div>
            <div class="quest-status ${statusClass}">${statusIcon}</div>
        `;
        container.appendChild(div);
    });
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const guestLoginBtnUI = document.getElementById('guestLoginBtnUI');
        const loggedInUserUI = document.getElementById('loggedInUserUI');
        const questWidget = document.getElementById('questWidget');
        const guestQuestWidget = document.getElementById('guestQuestWidget');
        
        const adminPanelBtnUI = document.getElementById('adminPanelBtnUI');

        if (user.isAnonymous) {
            if(guestLoginBtnUI) guestLoginBtnUI.style.display = 'flex';
            if(loggedInUserUI) loggedInUserUI.style.display = 'none';
            if(questWidget) questWidget.style.display = 'none';
            if(guestQuestWidget) guestQuestWidget.style.display = 'block';
            if(adminPanelBtnUI) adminPanelBtnUI.style.display = 'none'; 
        } else {
            if(guestLoginBtnUI) guestLoginBtnUI.style.display = 'none';
            if(loggedInUserUI) loggedInUserUI.style.display = 'flex';
            if(questWidget) questWidget.style.display = 'block';
            if(guestQuestWidget) guestQuestWidget.style.display = 'none';
            
            // 🌟 ซ่อนปุ่มแอดมินไว้ก่อน จนกว่าจะไปดึงข้อมูลจากฐานข้อมูลเสร็จ
            if(adminPanelBtnUI) adminPanelBtnUI.style.display = 'none';

            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);

            let displayName = "นักชิม";
            let userPoints = 0;
            let photoUrl = "";
            let questData = { q_login: 0, q_review: 0 };
            
            const now = new Date();
            const currentDateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

            if (userSnap.exists()) {
                const userData = userSnap.data();

                // 🌟🌟 เช็คสิทธิ์แอดมินแบบใหม่ (ตรวจสอบจาก role) 🌟🌟
                if (adminPanelBtnUI && userData.role === 'admin') {
                    adminPanelBtnUI.style.display = 'flex';
                }

                // --- 🌟 ระบบตรวจสอบการแบน 🌟 ---
                if (userData.banStatus && userData.banStatus.isBanned) {
                    const nowTime = Date.now();
                    if (!userData.banStatus.expiry || nowTime < userData.banStatus.expiry) {
                        const timeLeft = userData.banStatus.expiry ? 
                            `เหลือเวลาอีก ${Math.ceil((userData.banStatus.expiry - nowTime) / 60000)} นาที` : "เป็นการแบนถาวร";
                        showToast(`[แจ้งเตือน] บัญชีของคุณถูกระงับการใช้งาน: ${timeLeft}`);
                        setTimeout(() => { signOut(auth).then(() => window.location.href = "index.html"); }, 3000);
                        return; 
                    } else {
                        await updateDoc(userRef, { banStatus: { isBanned: false, expiry: null } });
                    }
                }

                displayName = userData.name || user.displayName || "นักชิม";
                userPoints = userData.points || 0;
                photoUrl = userData.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=d2a679&color=fff`;
                
                let lastActive = userData.lastActiveDate || "";
                questData = userData.quests || { q_login: 0, q_review: 0 };
                let needUpdate = false;

                if (lastActive !== currentDateStr) {
                    questData = { q_login: 0, q_review: 0 };
                    lastActive = currentDateStr;
                    needUpdate = true;
                }

                if ((questData.q_login || 0) < 1) {
                    questData.q_login = 1;
                    userPoints += 10;
                    needUpdate = true;
                    setTimeout(() => showToast("[สำเร็จ] ล็อกอินรายวันสำเร็จ! รับ 10 แต้ม"), 1500);
                }

                if (needUpdate) {
                    await updateDoc(userRef, { 
                        quests: questData, 
                        lastActiveDate: lastActive,
                        points: userPoints 
                    });
                }
            }

            const nameDisplay = document.getElementById('userNameDisplay');
            const pointsDisplay = document.getElementById('userPointsDisplay');
            const avatarImg = document.getElementById('userAvatar');

            nameDisplay.innerText = displayName;
            pointsDisplay.innerText = `${userPoints} แต้ม`;
            avatarImg.src = photoUrl;

            avatarImg.style.cursor = "pointer";
            avatarImg.onclick = () => window.location.href = "profile.html";
            nameDisplay.style.cursor = "pointer";
            nameDisplay.onclick = () => window.location.href = "profile.html";

            renderQuests(questData);
        }
    } else {
        window.location.href = "index.html";
    }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem('randomRestaurantOrder'); 
    signOut(auth).then(() => { window.location.href = "index.html"; });
});

const feedContainer = document.getElementById('restaurantFeed');
const provinceSelect = document.getElementById('provinceSelect');
const newProvinceSelect = document.getElementById('newProvince');

const thaiGeoData = {
    "กรุงเทพมหานคร": ["เขตพระนคร", "เขตดุสิต", "เขตหนองจอก", "เขตบางรัก", "เขตบางเขน", "เขตบางกะปิ", "เขตปทุมวัน", "เขตป้อมปราบศัตรูพ่าย", "เขตพระโขนง", "เขตมีนบุรี", "เขตลาดกระบัง", "เขตยานนาวา", "เขตสัมพันธวงศ์", "เขตพญาไท", "เขตธนบุรี", "เขตบางกอกใหญ่", "เขตห้วยขวาง", "เขตคลองสาน", "เขตตลิ่งชัน", "เขตบางกอกน้อย", "เขตบางขุนเทียน", "เขตภาษีเจริญ", "เขตหนองแขม", "เขตราษฎร์บูรณะ", "เขตบางพลัด", "เขตดินแดง", "เขตบึงกุ่ม", "เขตสาทร", "เขตบางซื่อ", "เขตจตุจักร", "เขตบางคอแหลม", "เขตประเวศ", "เขตคลองเตย", "เขตสวนหลวง", "เขตจอมทอง", "เขตดอนเมือง", "เขตราชเทวี", "เขตลาดพร้าว", "เขตวัฒนา", "เขตบางแค", "เขตหลักสี่", "เขตสายไหม", "เขตคันนายาว", "เขตสะพานสูง", "เขตวังทองหลาง", "เขตคลองสามวา", "เขตบางนา", "เขตทวีวัฒนา", "เขตทุ่งครุ", "เขตบางบอน"],
    "กระบี่": ["เมืองกระบี่", "เขาพนม", "เกาะลันตา", "คลองท่อม", "อ่าวลึก", "ปลายพระยา", "ลำทับ", "เหนือคลอง"],
    "กาญจนบุรี": ["เมืองกาญจนบุรี", "ไทรโยค", "บ่อพลอย", "ศรีสวัสดิ์", "ท่ามะกา", "ท่าม่วง", "ทองผาภูมิ", "สังขละบุรี", "พนมทวน", "เลาขวัญ", "ด่านมะขามเตี้ย", "หนองปรือ", "ห้วยกระเจา"],
    "กาฬสินธุ์": ["เมืองกาฬสินธุ์", "นามน", "กมลาไสย", "ร่องคำ", "กุฉินารายณ์", "เขาวง", "ยางตลาด", "ห้วยเม็ก", "สหัสขันธ์", "คำม่วง", "ท่าคันโท", "หนองกุงศรี", "สมเด็จ", "ห้วยผึ้ง", "สามชัย", "นาคู", "ดอนจาน", "ฆ้องชัย"],
    "กำแพงเพชร": ["เมืองกำแพงเพชร", "ไทรงาม", "คลองลาน", "ขาณุวรลักษบุรี", "คลองขลุง", "พรานกระต่าย", "ลานกระบือ", "ทรายทองวัฒนา", "ปางศิลาทอง", "บึงสามัคคี", "โกสัมพีนคร"],
    "ขอนแก่น": ["เมืองขอนแก่น", "บ้านฝาง", "พระยืน", "หนองเรือ", "ชุมแพ", "สีชมพู", "น้ำพอง", "อุบลรัตน์", "กระนวน", "บ้านไผ่", "เปือยน้อย", "พล", "แวงใหญ่", "แวงน้อย", "หนองสองห้อง", "ภูเวียง", "มัญจาคีรี", "ชนบท", "เขาสวนกวาง", "ภูผาม่าน", "ซำสูง", "โคกโพธิ์ไชย", "หนองนาคำ", "บ้านแฮด", "โนนศิลา", "เวียงเก่า"],
    "จันทบุรี": ["เมืองจันทบุรี", "ขลุง", "ท่าใหม่", "โป่งน้ำร้อน", "มะขาม", "แหลมสิงห์", "สอยดาว", "แก่งหางแมว", "นายายอาม", "เขาคิชฌกูฏ"],
    "ฉะเชิงเทรา": ["เมืองฉะเชิงเทรา", "บางคล้า", "บางน้ำเปรี้ยว", "บางปะกง", "บ้านโพธิ์", "พนมสารคาม", "ราชสาส์น", "สนามชัยเขต", "แปลงยาว", "ท่าตะเกียบ", "คลองเขื่อน"],
    "ชลบุรี": ["เมืองชลบุรี", "บ้านบึง", "หนองใหญ่", "บางละมุง", "พานทอง", "พนัสนิคม", "ศรีราชา", "เกาะสีชัง", "สัตหีบ", "บ่อทอง", "เกาะจันทร์"],
    "ชัยนาท": ["เมืองชัยนาท", "มโนรมย์", "วัดสิงห์", "สรรพยา", "สรรคบุรี", "หันคา", "หนองมะโมง", "เนินขาม"],
    "ชัยภูมิ": ["เมืองชัยภูมิ", "บ้านเขว้า", "คอนสวรรค์", "เกษตรสมบูรณ์", "หนองบัวแดง", "จัตุรัส", "บำเหน็จณรงค์", "หนองบัวระเหว", "เทพสถิต", "ภูเขียว", "บ้านแท่น", "แก้งคร้อ", "คอนสาร", "ภักดีชุมพล", "เนินสง่า", "ซับใหญ่"],
    "ชุมพร": ["เมืองชุมพร", "ท่าแซะ", "ปะทิว", "หลังสวน", "ละแม", "พะโต๊ะ", "สวี", "ทุ่งตะโก"],
    "เชียงราย": ["เมืองเชียงราย", "เวียงชัย", "เชียงของ", "เทิง", "พาน", "ป่าแดด", "แม่จัน", "เชียงแสน", "แม่สาย", "แม่สรวย", "เวียงป่าเป้า", "พญาเม็งราย", "เวียงแก่น", "ขุนตาล", "แม่ฟ้าหลวง", "แม่ลาว", "เวียงเชียงรุ้ง", "ดอยหลวง"],
    "เชียงใหม่": ["เมืองเชียงใหม่", "จอมทอง", "แม่แจ่ม", "เชียงดาว", "ดอยสะเก็ด", "แม่แตง", "แม่ริม", "สะเมิง", "ฝาง", "แม่อาย", "พร้าว", "สันป่าตอง", "สันกำแพง", "สันทราย", "หางดง", "ฮอด", "ดอยเต่า", "อมก๋อย", "สารภี", "เวียงแหง", "ไชยปราการ", "แม่วาง", "แม่ออน", "ดอยหล่อ", "กัลยาณิวัฒนา"],
    "ตรัง": ["เมืองตรัง", "กันตัง", "ย่านตาขาว", "ปะเหลียน", "สิเกา", "ห้วยยอด", "วังวิเศษ", "นาโยง", "รัษฎา", "หาดสำราญ"],
    "ตราด": ["เมืองตราด", "คลองใหญ่", "เขาสมิง", "บ่อไร่", "แหลมงอบ", "เกาะกูด", "เกาะช้าง"],
    "ตาก": ["เมืองตาก", "บ้านตาก", "สามเงา", "แม่ระมาด", "ท่าสองยาง", "แม่สอด", "พบพระ", "อุ้มผาง", "วังเจ้า"],
    "นครนายก": ["เมืองนครนายก", "ปากพลี", "บ้านนา", "องครักษ์"],
    "นครปฐม": ["เมืองนครปฐม", "กำแพงแสน", "นครชัยศรี", "ดอนตูม", "บางเลน", "สามพราน", "พุทธมณฑล"],
    "นครพนม": ["เมืองนครพนม", "ปลาปาก", "ท่าอุเทน", "บ้านแพง", "ธาตุพนม", "เรณูนคร", "นาแก", "ศรีสงคราม", "นาหว้า", "โพนสวรรค์", "นาทม", "วังยาง"],
    "นครราชสีมา": ["เมืองนครราชสีมา", "ครบุรี", "เสิงสาง", "คง", "บ้านเหลื่อม", "จักราช", "โชคชัย", "ด่านขุนทด", "โนนไทย", "โนนสูง", "ขามสะแกแสง", "บัวใหญ่", "ประทาย", "ปักธงชัย", "พิมาย", "ห้วยแถลง", "ชุมพวง", "สูงเนิน", "ขามทะเลสอ", "สีคิ้ว", "ปากช่อง", "หนองบุญมาก", "แก้งสนามนาง", "โนนแดง", "วังน้ำเขียว", "เทพารักษ์", "เมืองยาง", "พระทองคำ", "ลำทะเมนชัย", "บัวลาย", "สีดา", "เฉลิมพระเกียรติ"],
    "นครศรีธรรมราช": ["เมืองนครศรีธรรมราช", "พรหมคีรี", "ลานสกา", "ฉวาง", "พิปูน", "เชียรใหญ่", "ชะอวด", "ท่าศาลา", "ทุ่งสง", "นาบอน", "ทุ่งใหญ่", "ปากพนัง", "ร่อนพิบูลย์", "สิชล", "ขนอม", "หัวไทร", "บางขัน", "ถ้ำพรรณรา", "จุฬาภรณ์", "พระพรหม", "นบพิตำ", "ช้างกลาง", "เฉลิมพระเกียรติ"],
    "นครสวรรค์": ["เมืองนครสวรรค์", "โกรกพระ", "ชุมแสง", "หนองบัว", "บรรพตพิสัย", "เก้าเลี้ยว", "ตาคลี", "ท่าตะโก", "ไพศาลี", "พยุหะคีรี", "ลาดยาว", "ตากฟ้า", "แม่วงก์", "แม่เปิน", "ชุมตาบง"],
    "นนทบุรี": ["เมืองนนทบุรี", "บางกรวย", "บางใหญ่", "บางบัวทอง", "ไทรน้อย", "ปากเกร็ด"],
    "นราธิวาส": ["เมืองนราธิวาส", "ตากใบ", "บาเจาะ", "ยี่งอ", "ระแงะ", "รือเสาะ", "ศรีสาคร", "แว้ง", "สุคิริน", "สุไหงโก-ลก", "สุไหงปาดี", "จะแนะ", "เจาะไอร้อง"],
    "น่าน": ["เมืองน่าน", "แม่จริม", "บ้านหลวง", "นาน้อย", "ปัว", "ท่าวังผา", "เวียงสา", "ทุ่งช้าง", "เชียงกลาง", "นาหมื่น", "สันติสุข", "บ่อเกลือ", "สองแคว", "ภูเพียง", "เฉลิมพระเกียรติ"],
    "บึงกาฬ": ["เมืองบึงกาฬ", "พรเจริญ", "โซ่พิสัย", "เซกา", "ปากคาด", "บึงโขงหลง", "ศรีวิไล", "บุ่งคล้า"],
    "บุรีรัมย์": ["เมืองบุรีรัมย์", "คูเมือง", "กระสัง", "นางรอง", "หนองกี่", "ละหานทราย", "ประโคนชัย", "บ้านกรวด", "พุทไธสง", "ลำปลายมาศ", "สตึก", "ปะคำ", "นาโพธิ์", "หนองหงส์", "พลับพลาชัย", "ห้วยราช", "โนนสุวรรณ", "ชำนิ", "บ้านใหม่ไชยพจน์", "โนนดินแดง", "บ้านด่าน", "แคนดง", "เฉลิมพระเกียรติ"],
    "ปทุมธานี": ["เมืองปทุมธานี", "คลองหลวง", "ธัญบุรี", "หนองเสือ", "ลาดหลุมแก้ว", "ลำลูกกา", "สามโคก"],
    "ประจวบคีรีขันธ์": ["เมืองประจวบคีรีขันธ์", "กุยบุรี", "ทับสะแก", "บางสะพาน", "บางสะพานน้อย", "ปราณบุรี", "หัวหิน", "สามร้อยยอด"],
    "ปราจีนบุรี": ["เมืองปราจีนบุรี", "กบินทร์บุรี", "นาดี", "บ้านสร้าง", "ประจันตคาม", "ศรีมหาโพธิ", "ศรีมโหสถ"],
    "ปัตตานี": ["เมืองปัตตานี", "โคกโพธิ์", "หนองจิก", "ปะนาเระ", "มายอ", "ทุ่งยางแดง", "สายบุรี", "ไม้แก่น", "ยะหริ่ง", "ยะรัง", "กะพ้อ", "แม่ลาน"],
    "พระนครศรีอยุธยา": ["พระนครศรีอยุธยา", "ท่าเรือ", "นครหลวง", "บางไทร", "บางบาล", "บางปะอิน", "บางปะหัน", "ผักไห่", "ภาชี", "ลาดบัวหลวง", "วังน้อย", "เสนา", "บางซ้าย", "อุทัย", "มหาราช", "บ้านแพรก"],
    "พะเยา": ["เมืองพะเยา", "จุน", "เชียงคำ", "เชียงม่วน", "ดอกคำใต้", "ปง", "แม่ใจ", "ภูซาง", "ภูกามยาว"],
    "พังงา": ["เมืองพังงา", "เกาะยาว", "กะปง", "ตะกั่วทุ่ง", "ตะกั่วป่า", "คุระบุรี", "ทับปุด", "ท้ายเหมือง"],
    "พัทลุง": ["เมืองพัทลุง", "กงหรา", "เขาชัยสน", "ตะโหมด", "ควนขนุน", "ปากพะยูน", "ศรีบรรพต", "ป่าบอน", "บางแก้ว", "ป่าพะยอม", "ศรีนครินทร์"],
    "พิจิตร": ["เมืองพิจิตร", "วังทรายพูน", "โพธิ์ประทับช้าง", "ตะพานหิน", "บางมูลนาก", "โพทะเล", "สามง่าม", "ทับคล้อ", "สากเหล็ก", "บึงนาราง", "ดงเจริญ"],
    "พิษณุโลก": ["เมืองพิษณุโลก", "นครไทย", "ชาติตระการ", "บางระกำ", "บางกระทุ่ม", "พรหมพิราม", "วัดโบสถ์", "วังทอง", "เนินมะปราง"],
    "เพชรบุรี": ["เมืองเพชรบุรี", "เขาย้อย", "หนองหญ้าปล้อง", "ชะอำ", "ท่ายาง", "บ้านลาด", "บ้านแหลม", "แก่งกระจาน"],
    "เพชรบูรณ์": ["เมืองเพชรบูรณ์", "ชนแดน", "หล่มสัก", "หล่มเก่า", "วิเชียรบุรี", "ศรีเทพ", "หนองไผ่", "บึงสามพัน", "น้ำหนาว", "วังโป่ง", "เขาค้อ"],
    "แพร่": ["เมืองแพร่", "ร้องกวาง", "ลอง", "สูงเม่น", "เด่นชัย", "สอง", "วังชิ้น", "หนองม่วงไข่"],
    "ภูเก็ต": ["เมืองภูเก็ต", "กะทู้", "ถลาง"],
    "มหาสารคาม": ["เมืองมหาสารคาม", "แกดำ", "โกสุมพิสัย", "กันทรวิชัย", "เชียงยืน", "บรบือ", "นาเชือก", "พยัคฆภูมิพิสัย", "วาปีปทุม", "นาดูน", "ยางสีสุราช", "กุดรัง", "ชื่นชม"],
    "มุกดาหาร": ["เมืองมุกดาหาร", "นิคมคำสร้อย", "ดอนตาล", "ดงหลวง", "คำชะอี", "หว้านใหญ่", "หนองสูง"],
    "แม่ฮ่องสอน": ["เมืองแม่ฮ่องสอน", "ขุนยวม", "ปาย", "แม่สะเรียง", "แม่ลาน้อย", "สบเมย", "ปางมะผ้า"],
    "ยโสธร": ["เมืองยโสธร", "ทรายมูล", "กุดชุม", "คำเขื่อนแก้ว", "ป่าติ้ว", "มหาชนะชัย", "ค้อวัง", "เลิงนกทา", "ไทยเจริญ"],
    "ยะลา": ["เมืองยะลา", "เบตง", "บันนังสตา", "ธารโต", "ยะหา", "รามัน", "กาบัง", "กรงปินัง"],
    "ร้อยเอ็ด": ["เมืองร้อยเอ็ด", "เกษตรวิสัย", "ปทุมรัตต์", "จตุรพักตรพิมาน", "ธวัชบุรี", "พนมไพร", "โพนทอง", "โพธิ์ชัย", "หนองพอก", "เสลภูมิ", "สุวรรณภูมิ", "เมืองสรวง", "โพนทราย", "อาจสามารถ", "เมยวดี", "ศรีสมเด็จ", "จังหาร", "เชียงขวัญ", "หนองฮี", "ทุ่งเขาหลวง"],
    "ระนอง": ["เมืองระนอง", "ละอุ่น", "กะเปอร์", "กระบุรี", "สุขสำราญ"],
    "ระยอง": ["เมืองระยอง", "บ้านฉาง", "แกลง", "วังจันทร์", "บ้านค่าย", "ปลวกแดง", "เขาชะเมา", "นิคมพัฒนา"],
    "ราชบุรี": ["เมืองราชบุรี", "จอมบึง", "สวนผึ้ง", "ดำเนินสะดวก", "บ้านโป่ง", "บางแพ", "โพธาราม", "ปากท่อ", "วัดเพลง", "บ้านคา"],
    "ลพบุรี": ["เมืองลพบุรี", "พัฒนานิคม", "โคกสำโรง", "ชัยบาดาล", "ท่าวุ้ง", "บ้านหมี่", "ท่าหลวง", "สระโบสถ์", "โคกเจริญ", "ลำสนธิ", "หนองม่วง"],
    "ลำปาง": ["เมืองลำปาง", "แม่เมาะ", "เกาะคา", "เสริมงาม", "งาว", "แจ้ห่ม", "วังเหนือ", "เถิน", "แม่พริก", "แม่ตุ๋ม", "ห้างฉัตร", "เมืองปาน"],
    "ลำพูน": ["เมืองลำพูน", "แม่ทา", "บ้านโฮ่ง", "ลี้", "ทุ่งหัวช้าง", "ป่าซาง", "บ้านธิ", "เวียงหนองล่อง"],
    "เลย": ["เมืองเลย", "นาด้วง", "เชียงคาน", "ปากชม", "ด่านซ้าย", "นาแห้ว", "ภูเรือ", "ท่าลี่", "วังสะพุง", "ภูกระดึง", "ภูหลวง", "ผาขาว", "เอราวัณ", "หนองหิน"],
    "ศรีสะเกษ": ["เมืองศรีสะเกษ", "ยางชุมน้อย", "กันทรารมย์", "กันทรลักษ์", "ขุขันธ์", "ไพรบึง", "ปรางค์กู่", "ขุนหาญ", "ราษีไศล", "อุทุมพรพิสัย", "บึงบูรพ์", "ห้วยทับทัน", "โนนคูณ", "ศรีรัตนะ", "น้ำเกลี้ยง", "วังหิน", "ภูสิงห์", "เมืองจันทร์", "เบญจลักษ์", "พยุห์", "โพธิ์ศรีสุวรรณ", "ศิลาลาด"],
    "สกลนคร": ["เมืองสกลนคร", "กุสุมาลย์", "กุดบาก", "พรรณานิคม", "พังโคน", "วาริชภูมิ", "นิคมน้ำอูน", "วานรนิวาส", "คำตากล้า", "บ้านม่วง", "อากาศอำนวย", "สว่างแดนดิน", "เจริญศิลป์", "เต่างอย", "โคกศรีสุพรรณ", "โพนนาแก้ว", "ภูพาน"],
    "สงขลา": ["เมืองสงขลา", "สทิงพระ", "จะนะ", "นาทวี", "เทพา", "สะบ้าย้อย", "ระโนด", "กระแสสินธุ์", "รัตภูมิ", "สะเดา", "หาดใหญ่", "นาหม่อม", "ควนเนียง", "บางกล่ำ", "สิงหนคร", "คลองหอยโข่ง"],
    "สตูล": ["เมืองสตูล", "ควนโดน", "ควนกาหลง", "ท่าแพ", "ละงู", "ทุ่งหว้า", "มะนัง"],
    "สมุทรปราการ": ["เมืองสมุทรปราการ", "บางบ่อ", "บางพลี", "พระประแดง", "พระสมุทรเจดีย์", "บางเสาธง"],
    "สมุทรสงคราม": ["เมืองสมุทรสงคราม", "บางคนที", "อัมพวา"],
    "สมุทรสาคร": ["เมืองสมุทรสาคร", "กระทุ่มแบน", "บ้านแพ้ว"],
    "สระแก้ว": ["เมืองสระแก้ว", "คลองหาด", "ตาพระยา", "วังน้ำเย็น", "วัฒนานคร", "อรัญประเทศ", "เขาฉกรรจ์", "โคกสูง", "วังสมบูรณ์"],
    "สระบุรี": ["เมืองสระบุรี", "แก่งคอย", "หนองแค", "วิหารแดง", "หนองแซง", "บ้านหมอ", "ดอนพุด", "หนองโดน", "พระพุทธบาท", "เสาไห้", "มวกเหล็ก", "วังม่วง", "เฉลิมพระเกียรติ"],
    "สิงห์บุรี": ["เมืองสิงห์บุรี", "บางระจัน", "ค่ายบางระจัน", "พรหมบุรี", "ท่าช้าง", "อินทร์บุรี"],
    "สุโขทัย": ["เมืองสุโขทัย", "บ้านด่านลานหอย", "คีรีมาศ", "กงไกรลาศ", "ศรีสัชนาลัย", "ศรีสำโรง", "สวรรคโลก", "ศรีนคร", "ทุ่งเสลี่ยม"],
    "สุพรรณบุรี": ["เมืองสุพรรณบุรี", "เดิมบางนางบวช", "ด่านช้าง", "บางปลาม้า", "ศรีประจันต์", "ดอนเจดีย์", "สองพี่น้อง", "สามชุก", "อู่ทอง", "หนองหญ้าไซ"],
    "สุราษฎร์ธานี": ["เมืองสุราษฎร์ธานี", "กาญจนดิษฐ์", "ดอนสัก", "เกาะสมุย", "เกาะพะงัน", "ไชยา", "ท่าชนะ", "คีรีรัฐนิคม", "บ้านตาขุน", "พนม", "ท่าฉาง", "บ้านนาสาร", "บ้านนาเดิม", "เคียนซา", "เวียงสระ", "พระแสง", "พุนพิน", "ชัยบุรี", "วิภาวดี"],
    "สุรินทร์": ["เมืองสุรินทร์", "ชุมพลบุรี", "ท่าตูม", "จอมพระ", "ปราสาท", "กาบเชิง", "รัตนบุรี", "สนม", "ศีขรภูมิ", "สังขะ", "ลำดวน", "สำโรงทาบ", "บัวเชด", "พนมดงรัก", "ศรีณรงค์", "เขวาสินรินทร์", "โนนนารายณ์"],
    "หนองคาย": ["เมืองหนองคาย", "ท่าบ่อ", "โพนพิสัย", "ศรีเชียงใหม่", "สังคม", "สระใคร", "เฝ้าไร่", "รัตนวาปี", "โพธิ์ตาก"],
    "หนองบัวลำภู": ["เมืองหนองบัวลำภู", "นากลาง", "โนนสัง", "ศรีบุญเรือง", "สุวรรณคูหา", "นาวัง"],
    "อ่างทอง": ["เมืองอ่างทอง", "ไชโย", "ป่าโมก", "โพธิ์ทอง", "แสวงหา", "วิเศษชัยชาญ", "สามโก้"],
    "อำนาจเจริญ": ["เมืองอำนาจเจริญ", "ชานุมาน", "ปทุมราชวงศา", "พนา", "เสนางคนิคม", "หัวตะพาน", "ลืออำนาจ"],
    "อุดรธานี": ["เมืองอุดรธานี", "กุมภวาปี", "หนองหาน", "บ้านดุง", "บ้านผือ", "เพ็ญ", "สร้างคอม", "หนองแสง", "นายูง", "พิบูลรักษ์", "น้ำโสม", "กุดจับ", "โนนสะอาด", "วังสามหมอ", "ทุ่งฝน", "ไชยวาน", "กู่แก้ว", "ประจักษ์ศิลปาคม"],
    "อุตรดิตถ์": ["เมืองอุตรดิตถ์", "ตรอน", "ท่าปลา", "น้ำปาด", "ฟากท่า", "บ้านโคก", "พิชัย", "ลับแล", "ทองแสนขัน"],
    "อุทัยธานี": ["เมืองอุทัยธานี", "ทัพทัน", "สว่างอารมณ์", "หนองขาหย่าง", "บ้านไร่", "ห้วยคต", "ลานสัก"],
    "อุบลราชธานี": ["เมืองอุบลราชธานี", "ศรีเมืองใหม่", "โขงเจียม", "เขื่องใน", "เขมราฐ", "เดชอุดม", "นาจะหลวย", "น้ำยืน", "บุณฑริก", "ตระการพืชผล", "กุดข้าวปุ้น", "ม่วงสามสิบ", "วารินชำราบ", "พิบูลมังสาหาร", "ตาลสุม", "โพธิ์ไทร", "สำโรง", "ดอนมดแดง", "สิรินธร", "ทุ่งศรีอุดม", "นาเยีย", "นาตาล", "เหล่าเสือโก้ก", "สว่างวีระวงศ์", "น้ำขุ่น"]
};

function initProvinceDropdowns() {
    const provinces = Object.keys(thaiGeoData).sort((a, b) => a.localeCompare(b));
    provinces.forEach(prov => {
        const opt1 = document.createElement('option');
        opt1.value = prov;
        opt1.innerText = `${prov} (0)`; 
        opt1.setAttribute('data-base-text', prov); 
        provinceSelect.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = prov;
        opt2.innerText = prov;
        newProvinceSelect.appendChild(opt2);
    });
}
initProvinceDropdowns(); 

function getDistrictsForProvince(provinceName) {
    return thaiGeoData[provinceName] || ["เขต/อำเภออื่นๆ"];
}

newProvinceSelect.addEventListener('change', (e) => {
    const prov = e.target.value;
    const distSelect = document.getElementById('newDistrict');
    const districts = getDistrictsForProvince(prov);
    
    distSelect.innerHTML = '<option value="" disabled selected>-- เลือกเขต/อำเภอ --</option>';
    districts.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.innerText = d;
        distSelect.appendChild(opt);
    });
});

const cuisineMap = {
    'thai': 'อาหารไทย', 'japan': 'อาหารญี่ปุ่น', 'korean': 'อาหารเกาหลี',
    'chinese': 'อาหารจีน', 'western': 'อาหารตะวันตก/ฝรั่ง', 'seafood': 'ซีฟู้ด',
    'shabu_bbq': 'ชาบู/ปิ้งย่าง', 'fastfood': 'ฟาสต์ฟู้ด', 'cafe': 'คาเฟ่/ของหวาน', 'bar': 'เครื่องดื่ม/บาร์'
};

const oldProvinceMap = {
    'bkk': 'กรุงเทพมหานคร', 'cnx': 'เชียงใหม่', 'hkt': 'ภูเก็ต',
    'cbi': 'ชลบุรี', 'kkn': 'ขอนแก่น', 'aya': 'พระนครศรีอยุธยา', 'pkn': 'ประจวบคีรีขันธ์'
};

let allFetchedPlaces = []; 
let filteredPlaces = []; 
let currentPage = 1;
const itemsPerPage = 5; 
let userLat = null; let userLng = null;

const mockRestaurants = [
    { name: "เจ๊โอว ข้าวต้มเป็ด", province: "กรุงเทพมหานคร", district: "เขตปทุมวัน", cuisine: "thai", location: "ซอยจรัสเมือง", rating: "★ 4.9", img: "https://images.unsplash.com/photo-1559314809-0d155014e29e?q=80&w=800", tel: "064-118-5888", openTime: "16:30 - 00:00", lat: 13.7426, lng: 100.5225 },
    { name: "ทิพย์สมัย ผัดไทยประตูผี", province: "กรุงเทพมหานคร", district: "เขตพระนคร", cuisine: "thai", location: "ถนนมหาไชย สำราญราษฎร์", rating: "★ 4.8", img: "https://images.unsplash.com/photo-1555126634-323283e090fa?q=80&w=800", tel: "02-226-6666", openTime: "10:00 - 24:00", lat: 13.7526, lng: 100.5046 }
];

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180; const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))); 
}

async function seedDatabaseIfEmpty() {
    try {
        const querySnapshot = await getDocs(collection(db, "restaurants"));
        if (querySnapshot.empty) {
            for (const rest of mockRestaurants) { await addDoc(collection(db, "restaurants"), rest); }
        }
        fetchRestaurantsFromDB('random'); 
    } catch (e) { console.error(e); }
}

provinceSelect.addEventListener('change', (e) => {
    const selected = e.target.value;
    const districtFilterGroup = document.getElementById('districtFilterGroup');
    const districtCheckboxes = document.getElementById('districtCheckboxes');

    if (selected === 'near_me' || selected === '') {
        districtFilterGroup.style.display = 'none'; 
        if (selected === 'near_me') {
            if (navigator.geolocation) {
                feedContainer.innerHTML = '<p style="text-align:center; padding:20px; color:#8b5a2b;">กำลังขอพิกัดปัจจุบันของคุณ...</p>';
                navigator.geolocation.getCurrentPosition(
                    (position) => { userLat = position.coords.latitude; userLng = position.coords.longitude; fetchRestaurantsFromDB('near_me'); },
                    (error) => { alert("กรุณาอนุญาต (Allow) การระบุตำแหน่งเพื่อค้นหาร้านรอบตัว"); provinceSelect.value = ""; fetchRestaurantsFromDB('random'); }
                );
            }
        } else {
            fetchRestaurantsFromDB(selected);
        }
    } else {
        districtFilterGroup.style.display = 'block';
        const districts = getDistrictsForProvince(selected);
        
        districtCheckboxes.innerHTML = districts.map(d => 
            `<label class="checkbox-container"><input type="checkbox" class="district-filter" value="${d}"> ${d}</label>`
        ).join('');
        
        document.querySelectorAll('.district-filter').forEach(cb => {
            cb.addEventListener('change', applyFilters);
        });

        fetchRestaurantsFromDB(selected);
    }
});

async function fetchRestaurantsFromDB(provinceCode) {
    feedContainer.innerHTML = '<p style="text-align:center; padding:20px; color:#8b5a2b;">กำลังค้นหาร้านอาหาร...</p>';
    allFetchedPlaces = []; 
    let provinceCounts = {}; 

    try {
        const querySnapshot = await getDocs(collection(db, "restaurants"));
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            data.id = doc.id; 
            if (data.status === "pending") return; 

            if (oldProvinceMap[data.province]) {
                data.province = oldProvinceMap[data.province];
            }

            if (data.province) {
                provinceCounts[data.province] = (provinceCounts[data.province] || 0) + 1;
            }
            
            if (provinceCode === "near_me") {
                if (data.lat && data.lng && userLat && userLng) {
                    const dist = calculateDistance(userLat, userLng, data.lat, data.lng);
                    if (dist <= 15) { data.distance = dist; allFetchedPlaces.push(data); }
                }
            } else if (provinceCode === "random" || data.province === provinceCode) {
                allFetchedPlaces.push(data);
            }
        });

        const filterOptions = provinceSelect.querySelectorAll('option');
        filterOptions.forEach(opt => {
            if (opt.value && opt.value !== "near_me" && opt.value !== "") {
                const count = provinceCounts[opt.value] || 0;
                const baseText = opt.getAttribute('data-base-text');
                opt.innerText = `${baseText} (${count})`; 
            }
        });

        if (provinceCode === "near_me") {
            allFetchedPlaces.sort((a, b) => a.distance - b.distance); 
        } else if (provinceCode === "random") {
            const savedOrderStr = sessionStorage.getItem('randomRestaurantOrder');
            if (savedOrderStr) {
                const savedOrder = JSON.parse(savedOrderStr);
                allFetchedPlaces.sort((a, b) => {
                    const indexA = savedOrder.indexOf(a.id);
                    const indexB = savedOrder.indexOf(b.id);
                    const valA = indexA !== -1 ? indexA : Infinity;
                    const valB = indexB !== -1 ? indexB : Infinity;
                    return valA - valB;
                });
            } else {
                shuffleArray(allFetchedPlaces);
                const newOrder = allFetchedPlaces.map(place => place.id);
                sessionStorage.setItem('randomRestaurantOrder', JSON.stringify(newOrder));
            }
        }
        
        currentPage = 1; applyFilters(); 
    } catch (e) { console.error(e); }
}

function applyFilters() {
    const selectedCuisines = Array.from(document.querySelectorAll('.cuisine-filter:checked')).map(cb => cb.value);
    const selectedDistricts = Array.from(document.querySelectorAll('.district-filter:checked')).map(cb => cb.value); 
    const ratingElement = document.querySelector('input[name="rating-filter"]:checked');
    const minRating = ratingElement ? parseFloat(ratingElement.value) : 0;
    const searchKeyword = document.getElementById('searchInput').value.trim().toLowerCase();

    filteredPlaces = allFetchedPlaces.filter(place => {
        const passCuisine = selectedCuisines.length === 0 || selectedCuisines.includes(place.cuisine);
        const passDistrict = selectedDistricts.length === 0 || (place.district && selectedDistricts.includes(place.district)); 
        
        let numericRating = 0;
        if (place.rating) {numericRating = parseFloat(String(place.rating).replace(/[^0-9.]/g, '')) || 0;}
        const passRating = numericRating >= minRating;

        let passSearch = true;
        if (searchKeyword !== "") {
            const pName = (place.name || "").toLowerCase();
            const pProv = (place.province || "").toLowerCase();
            const pDist = (place.district || "").toLowerCase(); 
            const pLoc = (place.location || "").toLowerCase();
            const pDesc = (place.description || "").toLowerCase();
            const pCuisine = (cuisineMap[place.cuisine] || "").toLowerCase(); 
            
            passSearch = pName.includes(searchKeyword) || 
                         pProv.includes(searchKeyword) || 
                         pDist.includes(searchKeyword) ||
                         pLoc.includes(searchKeyword) || 
                         pDesc.includes(searchKeyword) || 
                         pCuisine.includes(searchKeyword);
        }

        return passCuisine && passRating && passSearch && passDistrict;
    });

    currentPage = 1; 
    displayRestaurants();
}

document.querySelectorAll('.cuisine-filter, input[name="rating-filter"]').forEach(input => {
    input.addEventListener('change', applyFilters);
});

document.getElementById('searchInput').addEventListener('input', applyFilters);
document.getElementById('searchBtn').addEventListener('click', applyFilters);

// 🌟 ฟังก์ชันป้องกันการแฮ็ก XSS 
function escapeHTML(str) {
    if (!str) return "";
    return String(str).replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag]));
}

function displayRestaurants() {
    feedContainer.innerHTML = '';
    if (filteredPlaces.length === 0) {
        feedContainer.innerHTML = '<p style="text-align:center; padding:20px; color:#8b5a2b; font-size: 1.1rem;">ไม่พบร้านอาหารที่คุณค้นหา ลองเปลี่ยนคำค้นหาดูนะครับ</p>'; return;
    }
    const startIndex = (currentPage - 1) * itemsPerPage;
    const placesToDisplay = filteredPlaces.slice(startIndex, startIndex + itemsPerPage);

    placesToDisplay.forEach((place) => {
        let cuisineTh = cuisineMap[place.cuisine] || 'อื่นๆ';
        let distanceHtml = place.distance ? `<span style="color: #d2a679; font-weight: bold; margin-left: 10px;">| ห่างไป ${place.distance.toFixed(1)} กม.</span>` : '';
        let cleanRating = (place.rating || "ไม่มีคะแนน").replace(/⭐/g, '★');
        
        let districtHtml = place.district ? `${place.district}, ` : '';

        // 🌟 ป้องกันการแฮก XSS ก่อนวาดขึ้นหน้าจอ
        const safeName = escapeHTML(place.name);
        const safeProvince = escapeHTML(place.province);
        const safeDistrict = escapeHTML(place.district);
        const safeLocation = escapeHTML(place.location);
        const safeTel = escapeHTML(place.tel);
        const safeOpenTime = escapeHTML(place.openTime);

        const card = document.createElement('div');
        card.className = 'restaurant-card';
        card.onclick = () => { window.location.href = `detail.html?id=${place.id}`; };

        card.innerHTML = `
            <div class="card-images"><img src="${place.img}" class="main-img" alt="${safeName}"></div>
            <div class="card-details">
                <h2 class="rest-name">${safeName}</h2>
                <div class="rest-meta"><span class="rating">${cleanRating}</span><span class="dot">•</span><span class="reviews">(อัปเดตล่าสุด)</span>${distanceHtml}</div>
                
                <p class="rest-desc" style="display: flex; align-items: flex-start; gap: 6px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8c8c8c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-top: 3px; flex-shrink: 0;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                    <span>${safeDistrict ? safeDistrict + ', ' : ''}${safeProvince} | ${safeLocation}</span>
                </p>
                
                <div style="background-color: #fffaf5; padding: 10px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #f3e9dc;">
                    <p style="font-size: 0.9rem; color: #6f4e37; margin-bottom: 4px;"><strong>โทรศัพท์:</strong> ${safeTel || '-'}</p>
                    <p style="font-size: 0.9rem; color: #6f4e37;"><strong>เวลาทำการ:</strong> ${safeOpenTime || '-'}</p>
                </div>
                <div class="tags"><span class="tag">${cuisineTh}</span></div>
            </div>`;
        feedContainer.appendChild(card);
    });
    renderPagination();
}

function renderPagination() {
    const totalPages = Math.ceil(filteredPlaces.length / itemsPerPage);
    if (totalPages <= 1) return; 
    const paginationContainer = document.createElement('div');
    paginationContainer.style = 'display: flex; justify-content: center; gap: 150px; margin-top: 30px; padding-bottom: 30px;';
    const btnStyle = 'background: transparent; border: none; color: #8b5a2b; font-family: Kanit, sans-serif; font-size: 16px; font-weight: 500; cursor: pointer; transition: color 0.2s ease; padding: 10px;';

    const prevBtn = document.createElement('button'); prevBtn.innerText = '< ย้อนกลับ';
    if (currentPage > 1) { prevBtn.style = btnStyle; prevBtn.onclick = () => { currentPage--; displayRestaurants(); window.scrollTo({ top: 0, behavior: 'smooth' }); }; } 
    else { prevBtn.style = btnStyle; prevBtn.style.visibility = 'hidden'; }
    paginationContainer.appendChild(prevBtn);

    const nextBtn = document.createElement('button'); nextBtn.innerText = 'ถัดไป >';
    if (currentPage < totalPages) { nextBtn.style = btnStyle; nextBtn.onclick = () => { currentPage++; displayRestaurants(); window.scrollTo({ top: 0, behavior: 'smooth' }); }; } 
    else { nextBtn.style = btnStyle; nextBtn.style.visibility = 'hidden'; }
    paginationContainer.appendChild(nextBtn);
    feedContainer.appendChild(paginationContainer);
}

const badWordsList = ["คำหยาบ", "สแปม", "คาสิโน", "บาคาร่า", "หวยออนไลน์", "เว็บพนัน", "หี", "ควย", "เย็ด", "สัส", "เหี้ย", "โป๊", "คลิปหลุด" , "nika" , "nicka"];
function containsBadWords(text) { return badWordsList.some(badWord => text.toLowerCase().includes(badWord.toLowerCase())); }

// --- จัดการรูปภาพและการเพิ่มร้านอาหาร ---
const addRestBtn = document.getElementById('addRestBtn');
const addRestModal = document.getElementById('addRestModal');
const closeAddModal = document.getElementById('closeAddModal');
const addRestForm = document.getElementById('addRestForm');

const newImgFile = document.getElementById('newImgFile');
const newImgUrl = document.getElementById('newImgUrl');
const newImgPreviewContainer = document.getElementById('newImgPreviewContainer');
const newImgPreview = document.getElementById('newImgPreview');

addRestBtn.onclick = () => {
    if (currentUser && currentUser.isAnonymous) {
        showToast("[แจ้งเตือน] กรุณาเข้าสู่ระบบด้วยบัญชีสมาชิกก่อนเพิ่มร้านอาหารครับ");
        return;
    }
    // รีเซ็ตค่ารูปภาพทุกครั้งที่เปิด Modal ใหม่
    if (newImgFile) newImgFile.value = "";
    if (newImgUrl) newImgUrl.value = "";
    if (newImgPreviewContainer) newImgPreviewContainer.style.display = 'none';
    addRestModal.style.display = "block";
};

closeAddModal.onclick = () => addRestModal.style.display = "none";

// แสดงพรีวิวเมื่อเลือกไฟล์
if (newImgFile) {
    newImgFile.onchange = function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => { 
                newImgPreview.src = e.target.result; 
                newImgPreviewContainer.style.display = 'block'; 
            };
            reader.readAsDataURL(file);
            newImgUrl.value = ""; 
        }
    };
}

// แสดงพรีวิวเมื่อกรอกลิงก์
if (newImgUrl) {
    newImgUrl.oninput = function() {
        const url = this.value.trim();
        if (url && url.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
            newImgPreview.src = url;
            newImgPreviewContainer.style.display = 'block';
            newImgFile.value = ""; 
        } else {
            newImgPreviewContainer.style.display = 'none';
        }
    };
}

addRestForm.onsubmit = async (e) => {
    e.preventDefault();
    
    const inputName = document.getElementById('newName').value.trim();
    const inputLocation = document.getElementById('newLocation').value.trim();
    const inputDesc = document.getElementById('newDesc').value.trim();
    const inputMapUrl = document.getElementById('newMapUrl').value || ""; 

    if (containsBadWords(inputName + " " + inputLocation + " " + inputDesc)) { 
        showToast("[แจ้งเตือน] ระบบตรวจพบคำไม่เหมาะสม กรุณาแก้ไขข้อมูลครับ"); return; 
    }

    // หาปุ่ม submit ของฟอร์มนี้ (สมมติว่าเป็นปุ่มเดียวในฟอร์ม)
    const submitBtn = addRestForm.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = "กำลังส่งข้อมูล...";
    }

    try {
        let finalImgUrl = "";

        // 1. ตรวจสอบการอัปโหลดไฟล์
        if (newImgFile && newImgFile.files[0]) {
            if (submitBtn) submitBtn.innerText = "กำลังอัปโหลดรูปภาพ...";
            finalImgUrl = await uploadToImgBB(newImgFile.files[0]);
        } 
        // 2. ตรวจสอบการใช้ลิงก์
        else if (newImgUrl && newImgUrl.value.trim()) {
            const url = newImgUrl.value.trim();
            if (!url.match(/\.(jpeg|jpg|gif|png|webp)$/i)) { 
                throw new Error("Invalid URL"); 
            }
            finalImgUrl = url;
        } 
        // 3. ถ้าไม่ได้ใส่อะไรเลย
        else {
            showToast("[แจ้งเตือน] กรุณาใส่รูปภาพ หรือ เลือกลิงก์รูปภาพครับ");
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = "ส่งข้อมูลร้านอาหาร"; }
            return;
        }

        const newPlace = {
            name: inputName, 
            description: inputDesc, 
            province: document.getElementById('newProvince').value, 
            district: document.getElementById('newDistrict').value, 
            cuisine: document.getElementById('newCuisine').value,
            location: inputLocation, 
            mapUrl: inputMapUrl, 
            rating: "★ 5.0", 
            img: finalImgUrl, 
            gallery: [], 
            tel: document.getElementById('newTel').value, 
            openTime: document.getElementById('newOpenTime').value,
            lat: 0, lng: 0, status: "pending" 
        };

        await addDoc(collection(db, "restaurants"), newPlace);
        addRestModal.style.display = "none"; 
        showToast("[สำเร็จ] ส่งข้อมูลสำเร็จ! กรุณารอแอดมินตรวจสอบก่อนแสดงผลครับ");
        addRestForm.reset(); 
        if (newImgPreviewContainer) newImgPreviewContainer.style.display = 'none';
        
    } catch (error) { 
        if (error.message === "Invalid URL") {
            showToast("[แจ้งเตือน] กรุณาใส่ 'ลิงก์รูปภาพโดยตรง' ที่ลงท้ายด้วยนามสกุลรูปภาพครับ");
        } else {
            showToast("[ผิดพลาด] ไม่สามารถบันทึกข้อมูลได้ กรุณาตรวจสอบอินเทอร์เน็ต"); 
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = "ส่งข้อมูลร้านอาหาร"; // ปรับให้ตรงกับข้อความบนปุ่มคุณ
        }
    }
};

//เพิ่มใหม่ ❓❓
document.addEventListener("DOMContentLoaded", () => {
    const communityButton = document.querySelector(".communityButton");
    const communityBanner = document.querySelector(".communityBanner");

    // เช็กให้ชัวร์ว่ามี Element เหล่านี้อยู่จริงเพื่อป้องกัน Error
    if (!communityButton || !communityBanner) return;

    // 1. ตั้งค่าเริ่มต้น: ซ่อนแต้มบน Navbar ไว้ก่อน และใส่ Transition ให้มันค่อยๆ โผล่มาอย่างนุ่มนวล
    communityButton.style.opacity = "0";
    communityButton.style.visibility = "hidden";
    communityButton.style.transition = "opacity 0.3s ease, visibility 0.3s ease";

    // 2. สร้าง Observer และฟังก์ชั่น
    const observer = new IntersectionObserver((entries) => {
        const entry = entries[0];
        
        // entry.isIntersecting จะมีค่าเป็น false เมื่อ .profile-header-card หลุดออกจากหน้าจอไปแล้ว
        if (!entry.isIntersecting) {
            // เลื่อนลงมาผ่านไปแล้ว -> แสดงข้อความ
            communityButton.style.opacity = "1";
            communityButton.style.visibility = "visible";
        } else {
            // เลื่อนขึ้นมาเจอการ์ดอีกครั้ง -> ซ่อนข้อความ
            communityButton.style.opacity = "0";
            communityButton.style.visibility = "hidden";
        }
    }, {
        root: null,
        threshold: 0 // ค่า 0 หมายถึงให้ฟังก์ชันทำงานทันทีที่ element หลุดออกจากหน้าจอแบบ 100%
    });

    // 3. สั่งให้เริ่มสังเกตการณ์ .profile-header-card โดยเรียกใช้ฟังก์ชั่น observer
    observer.observe(communityBanner);
});

seedDatabaseIfEmpty();