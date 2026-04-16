import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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

let currentUser = null;
let userPoints = 0;
let userTitles = [];
let equippedTitle = null;

const titlePool = {
    common: { class: 'title-common', names: ["นักชิมฝึกหัด", "สายกิน", "คนหิว 24 ชม.", "เน้นกินไม่เน้นคุย"] },
    uncommon: { class: 'title-uncommon', names: ["นักล่าของอร่อย", "สายคาเฟ่", "กระเพาะเหล็ก", "สายบุฟเฟต์"] },
    rare: { class: 'title-rare', names: ["กูรูจานเด็ด", "ลิ้นทองคำ", "รีวิวเวอร์ตัวยง", "นักชิมตาเหยี่ยว"] },
    sr: { class: 'title-sr', names: ["ตำนานกระเพาะไร้ก้น", "เทพเจ้าสายแหลก", "มิชลินเดินได้"] },
    ur: { class: 'title-ur', names: ["ปรมาจารย์ด้านอาหาร", "เทพเจ้าแห่งรสชาติ"] },
    sec: { class: 'title-sec', names: ["✨ จักรพรรดิแห่งวงการอาหาร ✨", "🌟 แสงสว่างแห่งวงการนักชิม 🌟"] } 
};

const rarityWeight = {
    'title-special': 7, 'title-sec': 6, 'title-ur': 5, 'title-sr': 4,
    'title-rare': 3, 'title-uncommon': 2, 'title-common': 1
};

function showToast(message) {
    const toast = document.getElementById("toastNotification");
    if (!toast) return;
    toast.innerText = message;
    toast.classList.add("show");
    setTimeout(() => { toast.classList.remove("show"); }, 3500); 
}

onAuthStateChanged(auth, async (user) => {
    if (!user || user.isAnonymous) {
        window.location.href = "index.html"; 
        return;
    }
    currentUser = user;
    await loadUserData();
});

async function loadUserData() {
    const userRef = doc(db, "users", currentUser.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        const userData = userSnap.data();

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

        userPoints = userData.points || 0;
        userTitles = userData.titles || [];
        equippedTitle = userData.equippedTitle || null;

        document.getElementById('userNameDisplay').innerText = userData.name || "นักชิม";
        document.getElementById('userAvatar').src = userData.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=d2a679&color=fff`;
        
        updatePointsUI();
        renderInventory();
    }
}

function updatePointsUI() {
    document.getElementById('userPointsDisplay').innerText = `${userPoints} แต้ม`;
    document.getElementById('shopPoints').innerText = userPoints;
}

const gachaBtn = document.getElementById('gachaRollBtn');
const rewardModal = document.getElementById('rewardModal');
const rewardTag = document.getElementById('rewardTag');
const gachaKnob = document.getElementById('gachaKnob');
const gDropBall = document.getElementById('gDropBall');
const allBalls = document.querySelectorAll('.g-ball');

gachaBtn.onclick = async () => {
    if (userPoints < 50) {
        return showToast("[แจ้งเตือน] แต้มของคุณไม่พอ (ต้องการ 50 แต้ม)");
    }

    userPoints -= 50;
    updatePointsUI();
    gachaBtn.disabled = true;
    
    gachaKnob.classList.add('turning');
    allBalls.forEach(ball => ball.classList.add('rumble'));
    gDropBall.classList.remove('dropping');

    setTimeout(() => {
        gachaKnob.classList.remove('turning');
        allBalls.forEach(ball => ball.classList.remove('rumble'));
        gDropBall.classList.add('dropping');
        
        setTimeout(async () => {
            const roll = Math.random() * 100;
            let resultTier;
            if (roll < 0.5) resultTier = 'sec';          
            else if (roll < 3.0) resultTier = 'ur';      
            else if (roll < 8.0) resultTier = 'sr';      
            else if (roll < 20.0) resultTier = 'rare';   
            else if (roll < 50.0) resultTier = 'uncommon'; 
            else resultTier = 'common';                  

            const pool = titlePool[resultTier];
            const finalTitle = pool.names[Math.floor(Math.random() * pool.names.length)];

            rewardTag.className = `title-tag ${pool.class}`;
            rewardTag.innerText = finalTitle;
            rewardModal.style.display = "block";

            const newTitleObj = { name: finalTitle, class: pool.class };
            const isDuplicate = userTitles.some(t => t.name === finalTitle);
            
            if (!isDuplicate) {
                userTitles.push(newTitleObj);
            } else {
                userPoints += 10;
                updatePointsUI(); 
                showToast("[แจ้งเตือน] ได้ฉายาซ้ำ! ระบบคืนพ้อยท์ให้ 10 แต้มปลอบใจ");
            }

            const userRef = doc(db, "users", currentUser.uid);
            await updateDoc(userRef, {
                points: userPoints,
                titles: userTitles
            });

            renderInventory();
            gachaBtn.disabled = false;
        }, 1200); 

    }, 1500); 
};

document.getElementById('closeRewardBtn').onclick = () => { rewardModal.style.display = "none"; };

function renderInventory() {
    const container = document.getElementById('inventoryContainer');
    const displayTag = document.getElementById('currentEquippedTag');

    if (equippedTitle) {
        displayTag.className = `title-tag ${equippedTitle.class}`;
        displayTag.innerText = equippedTitle.name;
    } else {
        displayTag.className = `title-tag title-common`;
        displayTag.innerText = "ไม่มีฉายา";
    }

    if (userTitles.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #aaa;">คุณยังไม่มีฉายา ลองสุ่มตู้กาชาดูสิ!</p>';
        return;
    }

    userTitles.sort((a, b) => {
        const weightA = rarityWeight[a.class] || 0;
        const weightB = rarityWeight[b.class] || 0;
        return weightB - weightA; 
    });

    container.innerHTML = '';
    userTitles.forEach(t => {
        const isEquipped = equippedTitle && equippedTitle.name === t.name;
        const div = document.createElement('div');
        div.className = `inventory-item ${isEquipped ? 'equipped' : ''}`;
        div.innerHTML = `<span class="title-tag ${t.class}">${t.name}</span>`;
        
        // 🌟 ส่วนที่ปรับแก้: ระบบกดถอด/ใส่ฉายา (Toggle) 🌟
        div.onclick = async () => {
            const userRef = doc(db, "users", currentUser.uid);
            
            if (isEquipped) {
                // ถ้าใส่อยู่แล้วให้ "ถอดออก"
                equippedTitle = null;
                renderInventory(); 
                await updateDoc(userRef, { equippedTitle: null });
                showToast(`[สำเร็จ] ถอดฉายาออกแล้ว`);
            } else {
                // ถ้ายังไม่ได้ใส่ ให้ "สวมใส่"
                equippedTitle = t;
                renderInventory(); 
                await updateDoc(userRef, { equippedTitle: t });
                showToast(`[สำเร็จ] สวมใส่ฉายา: ${t.name}`);
            }
        };

        container.appendChild(div);
    });
}

const viewDexBtn = document.getElementById('viewDexBtn');
const dexModal = document.getElementById('dexModal');
const closeDexModal = document.getElementById('closeDexModal');
const dexContainer = document.getElementById('dexContainer');

viewDexBtn.onclick = () => {
    renderDex();
    dexModal.style.display = "block";
};

closeDexModal.onclick = () => { dexModal.style.display = "none"; };
window.addEventListener('click', (e) => { if (e.target == dexModal) dexModal.style.display = "none"; });

function renderDex() {
    dexContainer.innerHTML = '';
    const rarityLabels = {
        common: '⚪ Common (หาง่าย - 50%)',
        uncommon: '🟢 Uncommon (ทั่วไป - 30%)',
        rare: '🔵 Rare (หายาก - 12%)',
        sr: '🟣 Super Rare (หายากมาก - 5%)',
        ur: '🟡 Ultra Rare (ระดับตำนาน - 2.5%)',
        sec: '🌈 Secret Rare (ระดับเทพเจ้า - 0.5%)'
    };

    for (const [rarity, data] of Object.entries(titlePool)) {
        let titlesHtml = data.names.map(name => `<span class="title-tag ${data.class}" style="margin: 5px;">${name}</span>`).join('');
        const groupDiv = document.createElement('div');
        groupDiv.style.cssText = "background: #fffaf5; border: 1px solid #f1e6d9; padding: 15px; border-radius: 8px;";
        groupDiv.innerHTML = `
            <h4 style="color: #6f4e37; margin-bottom: 10px; border-bottom: 1px dashed #d2a679; padding-bottom: 5px;">${rarityLabels[rarity]}</h4>
            <div style="line-height: 2.2;">${titlesHtml}</div>
        `;
        dexContainer.appendChild(groupDiv);
    }
}

// ==========================================
// 🌟 ระบบสลับแท็บ
// ==========================================
const tabGachaBtn = document.getElementById('tabGachaBtn');
const tabRedeemBtn = document.getElementById('tabRedeemBtn');
const tabGachaContent = document.getElementById('tabGachaContent');
const tabRedeemContent = document.getElementById('tabRedeemContent');

if (tabGachaBtn && tabRedeemBtn) {
    tabGachaBtn.addEventListener('click', () => {
        tabGachaBtn.classList.add('active');
        tabRedeemBtn.classList.remove('active');
        tabGachaContent.style.display = 'block';
        tabRedeemContent.style.display = 'none';
    });

    tabRedeemBtn.addEventListener('click', () => {
        tabRedeemBtn.classList.add('active');
        tabGachaBtn.classList.remove('active');
        tabRedeemContent.style.display = 'block';
        tabGachaContent.style.display = 'none';
    });
}

//เพิ่มใหม่ ❓❓
document.addEventListener("DOMContentLoaded", () => {
    const userPointsDisplay = document.getElementById("userPointsDisplay");
    const profileHeaderCard = document.querySelector(".profile-header-card");

    // เช็กให้ชัวร์ว่ามี Element เหล่านี้อยู่จริงเพื่อป้องกัน Error
    if (!userPointsDisplay || !profileHeaderCard) return;

    // 1. ตั้งค่าเริ่มต้น: ซ่อนแต้มบน Navbar ไว้ก่อน และใส่ Transition ให้มันค่อยๆ โผล่มาอย่างนุ่มนวล
    userPointsDisplay.style.opacity = "0";
    userPointsDisplay.style.visibility = "hidden";
    userPointsDisplay.style.transition = "opacity 0.3s ease, visibility 0.3s ease";

    // 2. สร้าง Observer และฟังก์ชั่น
    const observer = new IntersectionObserver((entries) => {
        const entry = entries[0];
        
        // entry.isIntersecting จะมีค่าเป็น false เมื่อ .profile-header-card หลุดออกจากหน้าจอไปแล้ว
        if (!entry.isIntersecting) {
            // เลื่อนลงมาผ่านไปแล้ว -> แสดงข้อความ
            userPointsDisplay.style.opacity = "1";
            userPointsDisplay.style.visibility = "visible";
        } else {
            // เลื่อนขึ้นมาเจอการ์ดอีกครั้ง -> ซ่อนข้อความ
            userPointsDisplay.style.opacity = "0";
            userPointsDisplay.style.visibility = "hidden";
        }
    }, {
        root: null,
        threshold: 0 // ค่า 0 หมายถึงให้ฟังก์ชันทำงานทันทีที่ element หลุดออกจากหน้าจอแบบ 100%
    });

    // 3. สั่งให้เริ่มสังเกตการณ์ .profile-header-card โดยเรียกใช้ฟังก์ชั่น observer
    observer.observe(profileHeaderCard);
});