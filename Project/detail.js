import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
// 🌟 เพิ่ม arrayUnion และ arrayRemove ในบรรทัดนี้
import { getFirestore, doc, getDoc, updateDoc, collection, addDoc, query, where, getDocs, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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

const urlParams = new URLSearchParams(window.location.search);
const restId = urlParams.get('id');

let currentRestaurantData = null;
let currentUser = null; 
let currentUserPhoto = ""; 
let currentUserTitle = null; 

function showToast(message) {
    const toast = document.getElementById("toastNotification");
    if (!toast) return;
    toast.innerText = message;
    toast.classList.add("show");
    setTimeout(() => { toast.classList.remove("show"); }, 3500); 
}

// 🌟 เพิ่มฟังก์ชัน ป้องกันการแฮ็ก XSS (Sanitize HTML)
function escapeHTML(str) {
    if (!str) return "";
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag]));
}

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

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const guestLoginBtnUI = document.getElementById('guestLoginBtnUI');
        const loggedInUserUI = document.getElementById('loggedInUserUI');

        if (user.isAnonymous) {
            if(guestLoginBtnUI) guestLoginBtnUI.style.display = 'flex';
            if(loggedInUserUI) loggedInUserUI.style.display = 'none';
        } else {
            if(guestLoginBtnUI) guestLoginBtnUI.style.display = 'none';
            if(loggedInUserUI) loggedInUserUI.style.display = 'flex';
            
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);

            let displayName = "นักชิม";
            let userPoints = 0;
            let photoUrl = "";
            let userBookmarks = []; 

            if (userSnap.exists()) {
                const userData = userSnap.data();

                if (userData.banStatus && userData.banStatus.isBanned) {
                    const nowTime = Date.now();
                    if (!userData.banStatus.expiry || nowTime < userData.banStatus.expiry) {
                        const timeLeft = userData.banStatus.expiry ? 
                            `เหลือเวลาอีก ${Math.ceil((userData.banStatus.expiry - nowTime) / 60000)} นาที` : "เป็นการแบนถาวร";
                        
                        showToast(`[แจ้งเตือน] บัญชีของคุณถูกระงับการใช้งาน: ${timeLeft}`);
                        
                        setTimeout(() => {
                            signOut(auth).then(() => window.location.href = "index.html");
                        }, 3000);
                        return;
                    } else {
                        await updateDoc(userRef, { banStatus: { isBanned: false, expiry: null } });
                    }
                }

                displayName = userData.name || user.displayName || "นักชิม";
                userPoints = userData.points || 0;
                photoUrl = userData.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=d2a679&color=fff`;
                userBookmarks = userData.bookmarks || [];
                currentUserTitle = userData.equippedTitle || null; 
            }

            currentUserPhoto = photoUrl; 

            const nameDisplay = document.getElementById('userNameDisplay');
            const pointsDisplay = document.getElementById('userPointsDisplay');
            const avatarImg = document.getElementById('userAvatar');

            nameDisplay.innerText = displayName;
            pointsDisplay.innerText = `${userPoints} แต้ม`;
            avatarImg.src = photoUrl;

            avatarImg.style.cursor = "pointer";
            avatarImg.onclick = () => window.location.href = `profile.html?uid=${currentUser.uid}`;
            nameDisplay.style.cursor = "pointer";
            nameDisplay.onclick = () => window.location.href = `profile.html?uid=${currentUser.uid}`;

            if(document.getElementById('reviewerName')){
                document.getElementById('reviewerName').value = displayName;
            }

            const bookmarkBtn = document.getElementById('bookmarkBtn');
            if (bookmarkBtn) {
                bookmarkBtn.style.display = 'flex'; 
                let isBookmarked = userBookmarks.includes(restId);
                updateBookmarkUI(isBookmarked);

                bookmarkBtn.onclick = async () => {
                    bookmarkBtn.disabled = true;
                    if (isBookmarked) {
                        userBookmarks = userBookmarks.filter(id => id !== restId);
                        isBookmarked = false;
                        showToast("[สำเร็จ] ลบออกจากร้านโปรดแล้ว");
                    } else {
                        userBookmarks.push(restId);
                        isBookmarked = true;
                        showToast("[สำเร็จ] บันทึกร้านโปรดเรียบร้อย!");
                    }
                    updateBookmarkUI(isBookmarked);
                    
                    try {
                        await updateDoc(userRef, { bookmarks: userBookmarks });
                    } catch (e) {
                        showToast("[ผิดพลาด] เกิดข้อผิดพลาดในการบันทึก");
                    }
                    bookmarkBtn.disabled = false;
                };

                function updateBookmarkUI(isSaved) {
                    if (isSaved) {
                        bookmarkBtn.classList.add('saved');
                        bookmarkBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg> <span>บันทึกแล้ว</span>`;
                    } else {
                        bookmarkBtn.classList.remove('saved');
                        bookmarkBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg> <span>บันทึกร้าน</span>`;
                    }
                }
            }
        }
    } else {
        window.location.href = "index.html";
    }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    signOut(auth).then(() => { window.location.href = "index.html"; });
});

const cuisineMap = {
    'thai': 'อาหารไทย', 'japan': 'อาหารญี่ปุ่น', 'korean': 'อาหารเกาหลี',
    'chinese': 'อาหารจีน', 'western': 'อาหารตะวันตก/ฝรั่ง', 'seafood': 'ซีฟู้ด',
    'shabu_bbq': 'ชาบู/ปิ้งย่าง', 'fastfood': 'ฟาสต์ฟู้ด', 'cafe': 'คาเฟ่/ของหวาน', 'bar': 'เครื่องดื่ม/บาร์'
};

if (!restId) {
    window.location.href = 'home.html';
} else {
    loadRestaurantData();
}

async function loadRestaurantData() {
    try {
        const docRef = doc(db, "restaurants", restId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            currentRestaurantData = docSnap.data();
            document.getElementById('detailMainImg').src = currentRestaurantData.img;
            
            // 🌟 ป้องกัน XSS ในชื่อและรายละเอียดร้าน
            document.getElementById('detailName').innerText = currentRestaurantData.name;
            
            const ratingText = currentRestaurantData.rating || "★ 5.0";
            document.getElementById('detailRating').innerText = ratingText.replace('⭐', '★');
            const numericScore = ratingText.replace(/[^0-9.]/g, '') || "5.0";
            document.getElementById('avgScoreBig').innerText = parseFloat(numericScore).toFixed(1);
            document.getElementById('detailCuisine').innerText = cuisineMap[currentRestaurantData.cuisine] || 'อื่นๆ';
            document.getElementById('detailDesc').innerText = currentRestaurantData.description || "ร้านนี้ยังไม่มีคำบรรยายเพิ่มเติม แต่รับประกันความอร่อย!";
            document.getElementById('detailLocation').innerText = currentRestaurantData.location;
            document.getElementById('detailTel').innerText = currentRestaurantData.tel || "-";
            document.getElementById('detailTime').innerText = currentRestaurantData.openTime || "-";
            const mapPreviewUrl = `https://maps.google.com/maps?q=$${encodeURIComponent(currentRestaurantData.location)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
            document.getElementById('detailMapFrame').src = mapPreviewUrl;
            const mapDirectLink = currentRestaurantData.mapUrl || `https://maps.google.com/maps?q=$${encodeURIComponent(currentRestaurantData.location)}`;
            document.getElementById('detailMapLink').href = mapDirectLink;
            renderGallery(currentRestaurantData.gallery || []);
            loadReviews();
        } else {
            alert("ไม่พบข้อมูลร้านอาหารนี้");
            window.location.href = 'home.html';
        }
    } catch (error) {
        console.error(error);
    }
}

let currentGalleryArray = [];
let lightboxIndex = 0;
let pendingDeletedImages = []; // เก็บ URL ที่รอการลบ

function renderGallery(galleryArray) {
    currentGalleryArray = galleryArray; // อัปเดตข้อมูลล่าสุด
    const galleryGrid = document.getElementById('detailGalleryGrid');
    galleryGrid.innerHTML = '';
    
    if(galleryArray.length === 0) {
        galleryGrid.innerHTML = '<p style="color:#aaa; font-size:0.9rem;">ยังไม่มีรูปภาพเพิ่มเติม (คุณสามารถเป็นคนแรกที่เพิ่มรูปได้!)</p>';
        return;
    }
    
    galleryArray.forEach((imgUrl, index) => {
        const imgEl = document.createElement('img');
        imgEl.src = imgUrl; // URL ไม่ถือว่ามีความเสี่ยง XSS จากข้อความ 
        imgEl.style.cursor = 'pointer';
        imgEl.onclick = () => openLightbox(index);
        galleryGrid.appendChild(imgEl);
    });
}

// ==========================================
// 🌟 1. ลอจิก Lightbox (ดูรูปเต็มจอ)
// ==========================================
const lightboxModal = document.getElementById('lightboxModal');
const lightboxImg = document.getElementById('lightboxImg');

function openLightbox(index) {
    lightboxIndex = index;
    updateLightboxImage();
    lightboxModal.style.display = 'flex'; // ใช้ flex เพื่อให้อยู่ตรงกลาง
}

function updateLightboxImage() {
    lightboxImg.src = currentGalleryArray[lightboxIndex];
}

document.getElementById('closeLightbox').onclick = () => {
    lightboxModal.style.display = 'none';
};

document.getElementById('lightboxNext').onclick = () => {
    // อัลกอริทึม Modulo สำหรับวนขวาสุดกลับมาซ้ายสุด O(1)
    lightboxIndex = (lightboxIndex + 1) % currentGalleryArray.length;
    updateLightboxImage();
};

document.getElementById('lightboxPrev').onclick = () => {
    // อัลกอริทึม Modulo แบบบวกความยาวเข้าไปก่อน เพื่อป้องกันค่าติดลบ O(1)
    lightboxIndex = (lightboxIndex - 1 + currentGalleryArray.length) % currentGalleryArray.length;
    updateLightboxImage();
};

// ==========================================
// 🌟 2. ลอจิกจัดการ/ลบรูปภาพ
// ==========================================
const managePhotoBtn = document.getElementById('managePhotoBtn');
const managePhotoModal = document.getElementById('managePhotoModal');
const manageGalleryGrid = document.getElementById('manageGalleryGrid');

if (managePhotoBtn) {
    managePhotoBtn.onclick = () => {
        if (!currentUser || currentUser.isAnonymous) {
            return showToast("[แจ้งเตือน] กรุณาเข้าสู่ระบบก่อนจัดการรูปภาพครับ");
        }
        if (currentGalleryArray.length === 0) {
            return showToast("[แจ้งเตือน] ยังไม่มีรูปภาพให้จัดการครับ");
        }
        
        pendingDeletedImages = []; // ล้างค่าที่รอการลบ
        renderManageGrid();
        managePhotoModal.style.display = 'block';
    };
}

function renderManageGrid() {
    manageGalleryGrid.innerHTML = '';
    currentGalleryArray.forEach((imgUrl) => {
        const wrap = document.createElement('div');
        wrap.className = 'manage-img-wrap';
        
        const isDeleted = pendingDeletedImages.includes(imgUrl);
        if (isDeleted) wrap.classList.add('deleted-mark');

        wrap.innerHTML = `
            <img src="${imgUrl}">
            <div class="delete-img-btn" title="${isDeleted ? 'ยกเลิกการลบ' : 'ลบรูปนี้'}">
                ${isDeleted ? '↺' : '×'}
            </div>
        `;

        wrap.querySelector('.delete-img-btn').onclick = () => {
            if (isDeleted) {
                // เอากลับคืน
                pendingDeletedImages = pendingDeletedImages.filter(url => url !== imgUrl);
            } else {
                // เพิ่มเข้าคิวลบ
                pendingDeletedImages.push(imgUrl);
            }
            renderManageGrid(); // วาด UI ซ้ำ (รวดเร็วมาก ไม่ต้องกังวลเรื่อง Performance ตรงนี้)
        };
        
        manageGalleryGrid.appendChild(wrap);
    });
}

document.getElementById('cancelManageBtn').onclick = () => {
    managePhotoModal.style.display = 'none';
    pendingDeletedImages = [];
};

document.getElementById('confirmManageBtn').onclick = async () => {
    if (pendingDeletedImages.length === 0) {
        managePhotoModal.style.display = 'none';
        return;
    }

    const confirmBtn = document.getElementById('confirmManageBtn');
    confirmBtn.disabled = true;
    confirmBtn.innerText = "กำลังลบ...";

    try {
        // คัดแยกเอารูปที่ไม่ได้อยู่ในคิวลบ ไว้เป็นข้อมูลชุดใหม่
        const newGalleryData = currentGalleryArray.filter(url => !pendingDeletedImages.includes(url));
        
        const restRef = doc(db, "restaurants", restId);
        await updateDoc(restRef, { gallery: newGalleryData });

        currentRestaurantData.gallery = newGalleryData;
        renderGallery(newGalleryData); // วาด UI หน้าหลักใหม่
        
        managePhotoModal.style.display = 'none';
        showToast(`[สำเร็จ] ลบรูปภาพเรียบร้อยแล้ว ${pendingDeletedImages.length} รูป`);
    } catch (e) {
        showToast("[ผิดพลาด] เกิดข้อผิดพลาดในการลบรูปภาพ");
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerText = "ยืนยันการลบ";
    }
};

// ปิด Modal เมื่อคลิกพื้นที่ว่างด้านนอก
window.addEventListener('click', (event) => {
    if (event.target == lightboxModal) lightboxModal.style.display = "none";
    if (event.target == managePhotoModal) managePhotoModal.style.display = "none";
});

const addPhotoModal = document.getElementById('addPhotoModal');
const closePhotoModal = document.getElementById('closePhotoModal');
const submitPhotoBtn = document.getElementById('submitPhotoBtn');

const newPhotoFileInput = document.getElementById('newPhotoFile');
const newPhotoUrlInput = document.getElementById('newPhotoUrl');
const newPhotoPreviewContainer = document.getElementById('newPhotoPreviewContainer');
const newPhotoPreview = document.getElementById('newPhotoPreview');

document.getElementById('addPhotoBtn').onclick = () => {
    if (currentUser && currentUser.isAnonymous) {
        showToast("[แจ้งเตือน] กรุณาเข้าสู่ระบบก่อนเพิ่มรูปภาพครับ");
        return;
    }
    if(newPhotoFileInput) newPhotoFileInput.value = "";
    if(newPhotoUrlInput) newPhotoUrlInput.value = "";
    if(newPhotoPreviewContainer) newPhotoPreviewContainer.style.display = "none";
    addPhotoModal.style.display = "block";
};

closePhotoModal.onclick = () => { addPhotoModal.style.display = "none"; };
window.onclick = (event) => { if (event.target == addPhotoModal) addPhotoModal.style.display = "none"; };

if (newPhotoFileInput) {
    newPhotoFileInput.onchange = function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                newPhotoPreview.src = e.target.result;
                newPhotoPreviewContainer.style.display = 'block';
            };
            reader.readAsDataURL(file);
            newPhotoUrlInput.value = ""; 
        }
    };
}

if (newPhotoUrlInput) {
    newPhotoUrlInput.oninput = function() {
        const url = this.value.trim();
        if (url && url.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
            newPhotoPreview.src = url;
            newPhotoPreviewContainer.style.display = 'block';
            newPhotoFileInput.value = ""; 
        } else {
            newPhotoPreviewContainer.style.display = 'none';
        }
    };
}

submitPhotoBtn.onclick = async () => {
    submitPhotoBtn.innerText = "กำลังประมวลผล...";
    submitPhotoBtn.disabled = true;

    try {
        let finalImgUrl = "";

        if (newPhotoFileInput && newPhotoFileInput.files[0]) {
            submitPhotoBtn.innerText = "กำลังอัปโหลดรูปภาพ...";
            finalImgUrl = await uploadToImgBB(newPhotoFileInput.files[0]);
        } else if (newPhotoUrlInput && newPhotoUrlInput.value.trim()) {
            const url = newPhotoUrlInput.value.trim();
            if (!url.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
                throw new Error("Invalid URL");
            }
            finalImgUrl = url;
        } else {
            showToast("[แจ้งเตือน] กรุณาเลือกรูปภาพหรือใส่ลิงก์ก่อนครับ");
            submitPhotoBtn.innerText = "อัปโหลดรูปภาพ";
            submitPhotoBtn.disabled = false;
            return;
        }
        
        if (currentRestaurantData.gallery && currentRestaurantData.gallery.includes(finalImgUrl)) {
            showToast("[แจ้งเตือน] รูปภาพนี้มีอยู่ในแกลเลอรีของร้านแล้วครับ");
            submitPhotoBtn.innerText = "อัปโหลดรูปภาพ";
            submitPhotoBtn.disabled = false;
            return;
        }

        const updatedGallery = currentRestaurantData.gallery ? [...currentRestaurantData.gallery, finalImgUrl] : [finalImgUrl];
        const restRef = doc(db, "restaurants", restId);
        await updateDoc(restRef, { gallery: updatedGallery });
        
        currentRestaurantData.gallery = updatedGallery;
        renderGallery(updatedGallery);
        
        addPhotoModal.style.display = "none";
        showToast("[สำเร็จ] เพิ่มรูปภาพสำเร็จแล้ว!");

    } catch (e) {
        if (e.message === "Invalid URL") {
            showToast("[แจ้งเตือน] กรุณาใช้ลิงก์รูปภาพโดยตรง (.jpg, .png)");
        } else {
            showToast("[ผิดพลาด] เกิดข้อผิดพลาดในการบันทึกรูปภาพ");
        }
    } finally {
        submitPhotoBtn.innerText = "อัปโหลดรูปภาพ";
        submitPhotoBtn.disabled = false;
    }
};

const stars = document.querySelectorAll('#starRatingInput span');
const ratingInput = document.getElementById('reviewStars');
stars.forEach(s => s.classList.add('active'));
stars.forEach(star => {
    star.addEventListener('mouseover', function() {
        const val = this.getAttribute('data-value');
        stars.forEach(s => { s.classList.toggle('hover', s.getAttribute('data-value') <= val); });
    });
    star.addEventListener('mouseout', function() { stars.forEach(s => s.classList.remove('hover')); });
    star.addEventListener('click', function() {
        const val = this.getAttribute('data-value');
        ratingInput.value = val; 
        stars.forEach(s => { s.classList.toggle('active', s.getAttribute('data-value') <= val); });
    });
});

const badWordsList = ["คำหยาบ", "สแปม", "คาสิโน", "บาคาร่า", "หวยออนไลน์", "เว็บพนัน", "หี", "ควย", "เย็ด", "สัส", "เหี้ย", "โป๊", "คลิปหลุด"];
function containsBadWords(text) { return badWordsList.some(badWord => text.toLowerCase().includes(badWord.toLowerCase())); }

async function loadReviews() {
    const reviewList = document.getElementById('reviewList');
    reviewList.innerHTML = '<p style="text-align:center; color:#aaa;">กำลังโหลดรีวิว...</p>';
    try {
        const q = query(collection(db, "reviews"), where("restId", "==", restId));
        const querySnapshot = await getDocs(q);
        reviewList.innerHTML = '';
        let count = 0;

        querySnapshot.forEach((docSnap) => {
            count++;
            const rev = docSnap.data();
            const revId = docSnap.id; 
            let starsHtml = '★'.repeat(rev.rating) + '☆'.repeat(5 - rev.rating);
            
            const likesCount = rev.likes ? rev.likes.length : 0;
            const isLiked = (currentUser && !currentUser.isAnonymous && rev.likes && rev.likes.includes(currentUser.uid));
            const heartClass = isLiked ? 'liked' : '';
            const heartIcon = isLiked ? 
                `<svg width="16" height="16" viewBox="0 0 24 24" fill="#e63946" stroke="#e63946" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>` : 
                `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;

            // 🌟 ป้องกัน XSS จากข้อความคนรีวิว
            const safeRevName = escapeHTML(rev.name);
            const safeRevText = escapeHTML(rev.text);

            let repliesHtml = '';
            if (rev.replies && rev.replies.length > 0) {
                rev.replies.forEach(reply => {
                    const rPhoto = reply.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(reply.name)}`;
                    const rTitle = reply.userTitle ? `<span class="title-tag ${reply.userTitle.class}">${reply.userTitle.name}</span>` : '';
                    const rProfileLink = reply.authorUid ? `profile.html?uid=${reply.authorUid}` : `profile.html?user=${encodeURIComponent(reply.name)}`;

                    // 🌟 ป้องกัน XSS จากข้อความคนตอบกลับ
                    const safeReplyName = escapeHTML(reply.name);
                    const safeReplyText = escapeHTML(reply.text);

                    repliesHtml += `
                        <div class="reply-item">
                            <div class="reply-header">
                                <img src="${rPhoto}" class="reply-avatar" style="cursor:pointer;" onclick="window.location.href='${rProfileLink}'">
                                <span class="reply-name" style="cursor:pointer;" onclick="window.location.href='${rProfileLink}'">${safeReplyName}</span>
                                ${rTitle} <span class="reply-date">${new Date(reply.date).toLocaleDateString('th-TH')}</span>
                            </div>
                            <p class="reply-text">${safeReplyText}</p>
                        </div>
                    `;
                });
            }

            const div = document.createElement('div');
            div.className = 'review-item';
            const revPhoto = rev.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(rev.name)}&background=d2a679&color=fff`;
            const revTitle = rev.userTitle ? `<span class="title-tag ${rev.userTitle.class}">${rev.userTitle.name}</span>` : '';
            const profileLink = rev.authorUid ? `profile.html?uid=${rev.authorUid}` : `profile.html?user=${encodeURIComponent(rev.name)}`;

            div.innerHTML = `
                <div class="review-header">
                    <img src="${revPhoto}" class="reviewer-avatar" style="cursor:pointer;" onclick="window.location.href='${profileLink}'">
                    <div class="reviewer-info-meta">
                        <div style="display: flex; align-items: center; flex-wrap: wrap;">
                            <span class="reviewer-name" style="cursor:pointer;" onclick="window.location.href='${profileLink}'">${safeRevName}</span>
                            ${revTitle}
                        </div>
                        <div class="review-meta-row">
                            <span class="review-stars">${starsHtml}</span>
                            <span class="review-date">${new Date(rev.date).toLocaleDateString('th-TH')}</span>
                        </div>
                    </div>
                </div>
                <p class="review-text">${safeRevText}</p>
                
                <div class="review-actions">
                    <button class="action-btn btn-like ${heartClass}" data-revid="${revId}">
                        ${heartIcon} <span>${likesCount} ถูกใจ</span>
                    </button>
                    <button class="action-btn btn-reply-toggle" data-revid="${revId}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                        ตอบกลับ
                    </button>
                </div>
                
                <div class="replies-section">
                    ${repliesHtml}
                    <div class="reply-input-container" id="reply-box-${revId}" style="display: none;">
                        <input type="text" id="reply-input-${revId}" class="reply-input" placeholder="เขียนคำตอบกลับ...">
                        <button class="send-reply-btn" data-revid="${revId}">ส่ง</button>
                    </div>
                </div>
            `;
            reviewList.appendChild(div);
        });

        document.getElementById('reviewCount').innerText = count;
        if(count === 0) reviewList.innerHTML = '<p style="color:#aaa; font-size:0.9rem;">ยังไม่มีรีวิว มารีวิวเป็นคนแรกเลย!</p>';

        bindSocialEvents();

    } catch (e) { 
        reviewList.innerHTML = '<p style="color:red;">ไม่สามารถโหลดรีวิวได้</p>'; 
    }
}

function bindSocialEvents() {
    document.querySelectorAll('.btn-like').forEach(btn => {
        btn.onclick = async function() {
            if (!currentUser || currentUser.isAnonymous) {
                return showToast("[แจ้งเตือน] กรุณาเข้าสู่ระบบก่อนกดถูกใจครับ");
            }
            const revId = this.getAttribute('data-revid');
            this.disabled = true;
            try {
                const revRef = doc(db, "reviews", revId);
                const revSnap = await getDoc(revRef);
                if(revSnap.exists()) {
                    let likes = revSnap.data().likes || [];
                    
                    // 🌟 ใช้ arrayUnion และ arrayRemove ป้องกันการแย่งกันไลก์
                    if (likes.includes(currentUser.uid)) {
                        await updateDoc(revRef, { likes: arrayRemove(currentUser.uid) });
                    } else {
                        await updateDoc(revRef, { likes: arrayUnion(currentUser.uid) });
                    }
                    
                    loadReviews(); 
                }
            } catch (e) {
                showToast("[ผิดพลาด] เกิดข้อผิดพลาด");
                this.disabled = false;
            }
        };
    });

    document.querySelectorAll('.btn-reply-toggle').forEach(btn => {
        btn.onclick = function() {
            const revId = this.getAttribute('data-revid');
            const box = document.getElementById(`reply-box-${revId}`);
            box.style.display = box.style.display === 'none' ? 'flex' : 'none';
            if (box.style.display === 'flex') {
                document.getElementById(`reply-input-${revId}`).focus();
            }
        };
    });

    document.querySelectorAll('.send-reply-btn').forEach(btn => {
        btn.onclick = async function() {
            if (!currentUser || currentUser.isAnonymous) {
                return showToast("[แจ้งเตือน] กรุณาเข้าสู่ระบบก่อนตอบกลับครับ");
            }
            const revId = this.getAttribute('data-revid');
            const inputEl = document.getElementById(`reply-input-${revId}`);
            const text = inputEl.value.trim();
            
            if(!text) return showToast("[แจ้งเตือน] กรุณาพิมพ์ข้อความก่อนส่งครับ");
            if(containsBadWords(text)) return showToast("[แจ้งเตือน] กรุณาใช้ถ้อยคำสุภาพครับ");

            this.disabled = true;
            this.innerText = "...";
            
            try {
                const revRef = doc(db, "reviews", revId);
                const revSnap = await getDoc(revRef);
                if(revSnap.exists()) {
                    let replies = revSnap.data().replies || [];
                    replies.push({
                        name: document.getElementById('userNameDisplay').innerText,
                        text: text, // เซฟลง DB เป็นตัวหนังสือปกติ แต่ตอนโหลดแสดงผลจะถูกดักด้วย escapeHTML
                        date: new Date().toISOString(),
                        photoUrl: currentUserPhoto,
                        userTitle: currentUserTitle,
                        authorUid: currentUser.uid 
                    });
                    await updateDoc(revRef, { replies: replies });
                    showToast("[สำเร็จ] ส่งคำตอบกลับเรียบร้อย!");
                    loadReviews(); 
                }
            } catch (e) {
                showToast("[ผิดพลาด] ส่งไม่สำเร็จ");
                this.disabled = false;
                this.innerText = "ส่ง";
            }
        };
    });
}

document.getElementById('reviewForm').onsubmit = async (e) => {
    e.preventDefault();
    if (currentUser && currentUser.isAnonymous) { showToast("[แจ้งเตือน] กรุณาเข้าสู่ระบบก่อนเขียนรีวิวครับ"); return; }

    const name = document.getElementById('reviewerName').value;
    const rating = parseInt(document.getElementById('reviewStars').value); 
    const text = document.getElementById('reviewText').value;

    if (containsBadWords(name + " " + text)) { showToast("[แจ้งเตือน] กรุณาใช้ถ้อยคำที่สุภาพในการรีวิวครับ"); return; }

    try {
        const newReview = { 
            restId: restId, 
            name: name, 
            rating: rating, 
            text: text, 
            date: new Date().toISOString(),
            photoUrl: currentUserPhoto,
            userTitle: currentUserTitle,
            authorUid: (currentUser && !currentUser.isAnonymous) ? currentUser.uid : null 
        };
        await addDoc(collection(db, "reviews"), newReview);

        const q = query(collection(db, "reviews"), where("restId", "==", restId));
        const querySnapshot = await getDocs(q);
        let totalStars = 0; let reviewCount = 0;
        querySnapshot.forEach((doc) => { totalStars += doc.data().rating; reviewCount++; });
        let avgRating = 5.0; 
        if (reviewCount > 0) { avgRating = (totalStars / reviewCount).toFixed(1); }

        const restRef = doc(db, "restaurants", restId);
        await updateDoc(restRef, { rating: `★ ${avgRating}` });

        if(currentUser && !currentUser.isAnonymous) {
            const userRef = doc(db, "users", currentUser.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                let userData = userSnap.data();
                let questData = userData.quests || {};
                const now = new Date();
                const currentDateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
                
                if (userData.lastActiveDate === currentDateStr && (questData.q_review || 0) < 1) {
                    questData.q_review = (questData.q_review || 0) + 1;
                    const newPoints = (userData.points || 0) + 20; 
                    await updateDoc(userRef, { quests: questData, points: newPoints });
                    showToast("[สำเร็จ] ทำเควสสำเร็จ: รีวิวร้านอาหาร รับ 20 แต้ม!");
                    document.getElementById('userPointsDisplay').innerText = `${newPoints} แต้ม`;
                } else {
                    showToast("[สำเร็จ] ขอบคุณสำหรับรีวิวครับ!");
                }
            }
        } else {
            showToast("[สำเร็จ] ขอบคุณสำหรับรีวิวครับ!");
        }

        document.getElementById('reviewForm').reset();
        if(currentUser && !currentUser.isAnonymous) { document.getElementById('reviewerName').value = document.getElementById('userNameDisplay').innerText; }
        ratingInput.value = 5; stars.forEach(s => s.classList.add('active'));
        loadReviews(); 
    } catch (e) { showToast("[ผิดพลาด] ส่งรีวิวไม่สำเร็จ กรุณาลองใหม่"); }
}