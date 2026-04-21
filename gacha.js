import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

const provincesList = [
    "กรุงเทพมหานคร", "นนทบุรี", "ปทุมธานี", "สมุทรปราการ", "ชลบุรี", "เชียงใหม่", "ภูเก็ต", "ขอนแก่น", "นครราชสีมา"
    /* ... เพิ่มจังหวัดอื่นๆ ได้ตามต้องการ ... */
];

let userLat = null, userLon = null;
let isSpinning = false;
let gachaTimeout;

const provinceSelect = document.getElementById('provinceSelect');
const distanceBox = document.getElementById('distanceFilterBox');
const distRange = document.getElementById('distRange');
const distVal = document.getElementById('distVal');

const mainGifContainer = document.getElementById('mainGifContainer');
const hintText = document.getElementById('hintText');
const mediaModal = document.getElementById('mediaModal');
const videoPopup = document.getElementById('videoPopup');
const skipBtn = document.getElementById('skipGachaBtn');

// 🌟 1. เตรียมข้อมูลหน้าเว็บ
provincesList.forEach(p => {
    let opt = document.createElement('option');
    opt.value = p; opt.innerText = p;
    provinceSelect.appendChild(opt);
});

distRange.oninput = () => distVal.innerText = distRange.value + " กม.";

// 🌟 2. ขอสิทธิ์ GPS ทันที (พร้อมเช็กว่าเคยเตือนหรือยัง)
navigator.geolocation.getCurrentPosition(
    (pos) => { userLat = pos.coords.latitude; userLon = pos.coords.longitude; },
    () => { 
        if (!sessionStorage.getItem('gpsAlertShown')) {
            alert("[แจ้งเตือน] ไม่ได้เปิด GPS ระบบจะเลือก 'กรุงเทพมหานคร' ให้แทนนะครับ");
            sessionStorage.setItem('gpsAlertShown', 'true');
        }
        provinceSelect.value = "กรุงเทพมหานคร";
        distanceBox.style.display = "none";
    }
);

provinceSelect.onchange = () => {
    distanceBox.style.display = (provinceSelect.value === "near_me") ? "flex" : "none";
};

// 🌟 3. ผูก Event กดที่ตัวลุง Tako (ใช้ addEventListener ช่วยให้มือถือตอบสนองดีขึ้น)
function handleStartGacha() {
    if (!isSpinning) startGacha();
}
mainGifContainer.addEventListener('click', handleStartGacha);
hintText.addEventListener('click', handleStartGacha);

skipBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearTimeout(gachaTimeout);
    processGachaResult();
});

function startGacha() {
    isSpinning = true;
    
    mediaModal.style.display = 'flex';
    videoPopup.classList.remove('hide');
    videoPopup.classList.add('show');

    const video = document.getElementById('gachaVideo');
    if (video) {
        video.currentTime = 0; 
        
        // 🌟 ป้องกัน JS ค้างบนมือถือ (ดักจับ Error กรณีมือถือบล็อกวิดีโอ)
        let playPromise = video.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.warn("มือถือบล็อกการเล่นวิดีโอชั่วคราว:", error);
            });
        }
    }

    setTimeout(() => skipBtn.classList.add('show'), 1500); 
    gachaTimeout = setTimeout(processGachaResult, 9000); 
}

async function processGachaResult() {
    const video = document.getElementById('gachaVideo');
    if (video) { 
        try { 
            video.pause(); 
            video.currentTime = 0; 
        } catch(e) {} 
    }
    
    skipBtn.classList.remove('show');
    
    videoPopup.classList.remove('show');
    videoPopup.classList.add('hide');

    setTimeout(() => { mediaModal.style.display = 'none'; }, 200);

    const flash = document.getElementById('flashOverlay');
    flash.style.animation = "none"; 
    void flash.offsetWidth; 
    flash.style.animation = "flashEffect 0.6s forwards";
    
    try {
        const snap = await getDocs(collection(db, "restaurants"));
        let list = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.status !== "pending");

        // 🌟 คำนวณระยะทางไว้ล่วงหน้าเสมอ
        list = list.map(r => {
            if (userLat && userLon && r.lat && r.lng) {
                r.dist = calculateDistance(userLat, userLon, r.lat, r.lng);
            }
            return r;
        });

        const mode = provinceSelect.value;
        // 🌟 แก้บั๊ก: ถ้าเลือก "ใกล้ฉัน" แต่ไม่มี GPS ให้ดึงร้านใน กทม. แทน (กันบั๊กหน้าว่าง)
        if (mode === "near_me") {
            if (userLat) {
                const maxD = parseInt(distRange.value);
                list = list.filter(r => r.dist !== undefined && r.dist <= maxD);
            } else {
                list = list.filter(r => r.province === "กรุงเทพมหานคร");
            }
        } else {
            list = list.filter(r => r.province === mode);
        }

        // Shuffle Bag Algorithm
        let seenIds = JSON.parse(sessionStorage.getItem('gachaSeenIds') || '[]');
        let unseenList = list.filter(r => !seenIds.includes(r.id));

        if (unseenList.length === 0 && list.length > 0) {
            seenIds = []; 
            unseenList = list;
        }

        displayResult(unseenList, mode);
    } catch (e) { console.error(e); }
}

function displayResult(unseenList, mode) {
    const container = document.getElementById('restaurantInfo');
    if (unseenList.length === 0) {
        container.innerHTML = `<h3 style="color:#8b5a2b; margin-top:20px;">ไม่พบร้านในพื้นที่นี้</h3><p style="color:#8c8c8c;">ลอง${mode === "near_me" ? "ขยายระยะทาง" : "เปลี่ยนจังหวัด"}ดูใหม่นะ!</p>`;
    } else {
        const res = unseenList[Math.floor(Math.random() * unseenList.length)];
        
        let seenIds = JSON.parse(sessionStorage.getItem('gachaSeenIds') || '[]');
        seenIds.push(res.id);
        sessionStorage.setItem('gachaSeenIds', JSON.stringify(seenIds));

        const stars = "★".repeat(Math.round(parseFloat(res.rating) || 5)).padEnd(5, "☆");
        
        let mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(res.name + " " + (res.province || ""))}`;
        if (res.lat && res.lng) {
            mapUrl = `https://www.google.com/maps/search/?api=1&query=${res.lat},${res.lng}`;
        }

        let distHtml = "";
        if (res.dist !== undefined) {
            distHtml = `<div style="margin-top:10px;"><span class="dist-badge">ห่างจากคุณ ${res.dist.toFixed(1)} กม.</span></div>`;
        }

        container.innerHTML = `
            <img src="${res.img}" style="width:100%; height:200px; object-fit:cover; border-radius:15px; border: 1px solid #eee;">
            <h2 style="margin:15px 0 5px; color:#6f4e37;">"${res.name}"</h2>
            <div class="star-gold">${stars}</div>
            <p style="color:#8c8c8c; font-size:0.9rem;">📍 ${res.location || res.district || res.province}</p>
            
            ${distHtml}
            
            <a href="${mapUrl}" target="_blank" class="btn-primary" style="display:flex; justify-content:center; align-items:center; gap:8px; margin-top:20px; text-decoration:none; border-radius: 50px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                เปิดแผนที่ร้าน
            </a>
            <a href="detail.html?id=${res.id}" class="btn-outline" style="display:block; margin-top:10px; text-decoration:none; border-radius: 50px; padding: 10px;">ดูรายละเอียดเพิ่มเติม</a>
        `;
    }
    document.getElementById('resultModal').style.display = 'flex';
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2-lat1) * Math.PI / 180;
    const dLon = (lon2-lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

document.getElementById('retryGachaBtn').onclick = () => {
    document.getElementById('resultModal').style.display = 'none'; 
    isSpinning = false; 
    startGacha();
};

document.getElementById('backToHomeBtn').onclick = () => {
    location.href = 'home.html';
};