import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, doc, getDoc, updateDoc, deleteDoc, arrayUnion, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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

let allPendingRests = [];
let currentRestPage = 1;
let searchRestTerm = "";
const restsPerPage = 5;

let allUsersData = [];
let currentUserPage = 1;
let searchUserTerm = "";
let currentStatusFilter = "all"; 
const usersPerPage = 5;

let allBoardThreads = [];
let currentBoardPage = 1;
let searchBoardTerm = "";
const boardPerPage = 5;

let allReviewsData = [];
let currentReviewPage = 1;
let searchReviewTerm = "";
const reviewsPerPage = 5;

const pendingContainer = document.getElementById('pendingListContainer');
const usersContainer = document.getElementById('usersListContainer');
const boardContainer = document.getElementById('boardListContainer');
const reviewContainer = document.getElementById('reviewListContainer');

const restPagination = document.getElementById('restPagination');
const userPagination = document.getElementById('userPagination');
const boardPagination = document.getElementById('boardPagination');
const reviewPagination = document.getElementById('reviewPagination');

function showToast(message) {
    const toast = document.getElementById("toastNotification");
    if (!toast) return;
    toast.innerText = message;
    toast.classList.add("show");
    setTimeout(() => { toast.classList.remove("show"); }, 3500); 
}

let confirmCallback = null;
function showConfirmModal(title, message, callback) {
    document.getElementById('confirmTitle').innerText = title;
    document.getElementById('confirmMessage').innerText = message;
    confirmCallback = callback;
    document.getElementById('confirmModal').style.display = 'block';
}

document.getElementById('cancelConfirmBtn').addEventListener('click', () => {
    document.getElementById('confirmModal').style.display = 'none';
    confirmCallback = null;
});

document.getElementById('okConfirmBtn').addEventListener('click', () => {
    document.getElementById('confirmModal').style.display = 'none';
    if (confirmCallback) confirmCallback();
});

// เช็คสิทธิ์แบบใหม่ (role === 'admin')
onAuthStateChanged(auth, async (user) => {
    if (!user || user.isAnonymous) {
        showToast("[แจ้งเตือน] ไม่มีสิทธิ์เข้าถึง กรุณาเข้าสู่ระบบ");
        if (pendingContainer) pendingContainer.innerHTML = '<p style="text-align:center; color:red; padding:40px;">ไม่มีสิทธิ์เข้าถึง กำลังพากลับไปหน้าเข้าสู่ระบบ...</p>';
        setTimeout(() => { window.location.href = "index.html"; }, 2000);
        return;
    }

    try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists() || userSnap.data().role !== 'admin') {
            showToast("[แจ้งเตือน] บัญชีของคุณไม่มีสิทธิ์ใช้งานส่วนผู้ดูแลระบบ");
            if (pendingContainer) pendingContainer.innerHTML = '<p style="text-align:center; color:red; padding:40px;">บัญชีของคุณไม่มีสิทธิ์เข้าถึงส่วนนี้ กำลังพากลับหน้าหลัก...</p>';
            setTimeout(() => { window.location.href = "home.html"; }, 2000);
            return;
        }

        fetchAllData();
        loadAdmins(); 
    } catch (e) {
        showToast("เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์");
    }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    signOut(auth).then(() => { window.location.href = "index.html"; });
});

// --- ระบบสลับ Tab ---
const tabRestBtn = document.getElementById('tabRestBtn');
const tabUserBtn = document.getElementById('tabUserBtn');
const tabBoardBtn = document.getElementById('tabBoardBtn');
const tabReviewBtn = document.getElementById('tabReviewBtn');
const tabAdminRoleBtn = document.getElementById('tabAdminRoleBtn'); 

const tabRestContent = document.getElementById('tabRestContent');
const tabUserContent = document.getElementById('tabUserContent');
const tabBoardContent = document.getElementById('tabBoardContent');
const tabReviewContent = document.getElementById('tabReviewContent');
const tabAdminRoleContent = document.getElementById('tabAdminRoleContent'); 

function switchAdminTab(activeBtn, activeContent) {
    [tabRestBtn, tabUserBtn, tabBoardBtn, tabReviewBtn, tabAdminRoleBtn].forEach(btn => btn.classList.remove('active'));
    [tabRestContent, tabUserContent, tabBoardContent, tabReviewContent, tabAdminRoleContent].forEach(content => content.classList.remove('active'));
    activeBtn.classList.add('active');
    activeContent.classList.add('active');
}

tabRestBtn.addEventListener('click', () => switchAdminTab(tabRestBtn, tabRestContent));
tabUserBtn.addEventListener('click', () => switchAdminTab(tabUserBtn, tabUserContent));
tabBoardBtn.addEventListener('click', () => switchAdminTab(tabBoardBtn, tabBoardContent));
tabReviewBtn.addEventListener('click', () => switchAdminTab(tabReviewBtn, tabReviewContent));
tabAdminRoleBtn.addEventListener('click', () => switchAdminTab(tabAdminRoleBtn, tabAdminRoleContent));

document.getElementById('searchRestInput').addEventListener('input', (e) => {
    searchRestTerm = e.target.value.trim().toLowerCase();
    currentRestPage = 1;
    renderRestaurants();
});

document.getElementById('searchUserInput').addEventListener('input', (e) => {
    searchUserTerm = e.target.value.trim().toLowerCase();
    currentUserPage = 1;
    renderUsers();
});

document.getElementById('statusFilterSelect').addEventListener('change', (e) => {
    currentStatusFilter = e.target.value;
    currentUserPage = 1;
    renderUsers();
});

document.getElementById('searchBoardInput').addEventListener('input', (e) => {
    searchBoardTerm = e.target.value.trim().toLowerCase();
    currentBoardPage = 1;
    renderBoardThreads();
});

document.getElementById('searchReviewInput').addEventListener('input', (e) => {
    searchReviewTerm = e.target.value.trim().toLowerCase();
    currentReviewPage = 1;
    renderReviews();
});

async function fetchAllData() {
    try {
        const qRest = query(collection(db, "restaurants"), where("status", "==", "pending"));
        const snapRest = await getDocs(qRest);
        allPendingRests = snapRest.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const snapUsers = await getDocs(collection(db, "users"));
        allUsersData = snapUsers.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const snapThreads = await getDocs(query(collection(db, "threads"), orderBy("createdAt", "desc")));
        allBoardThreads = snapThreads.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const snapReviews = await getDocs(query(collection(db, "reviews"), orderBy("date", "desc")));
        allReviewsData = snapReviews.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        renderRestaurants();
        renderUsers();
        renderBoardThreads();
        renderReviews();
    } catch (e) {
        showToast("[ผิดพลาด] เกิดข้อผิดพลาดในการโหลดข้อมูล");
    }
}

function renderRestaurants() {
    let filtered = allPendingRests;
    if (searchRestTerm) {
        filtered = filtered.filter(r => 
            (r.name || "").toLowerCase().includes(searchRestTerm) ||
            (r.province || "").toLowerCase().includes(searchRestTerm) ||
            (r.district || "").toLowerCase().includes(searchRestTerm) ||
            (r.cuisine || "").toLowerCase().includes(searchRestTerm) ||
            (r.description || "").toLowerCase().includes(searchRestTerm)
        );
    }

    if (filtered.length === 0) {
        pendingContainer.innerHTML = '<div style="text-align:center; padding:40px; background:white; border-radius:12px; border:1px solid #eee;"><h3 style="color:#8c8c8c;">ไม่พบรายการที่ค้นหา</h3></div>';
        restPagination.innerHTML = '';
        return;
    }

    const startIndex = (currentRestPage - 1) * restsPerPage;
    const paginatedItems = filtered.slice(startIndex, startIndex + restsPerPage);

    pendingContainer.innerHTML = paginatedItems.map(data => `
        <div class="admin-card">
            <img src="${data.img}" alt="รูปภาพร้าน" onerror="this.src='https://via.placeholder.com/200x150?text=No+Image'">
            <div class="admin-details">
                <h3 style="color:#8b5a2b; margin-bottom: 10px;">${data.name}</h3>
                <div class="data-row"><strong>หมวดหมู่:</strong> ${data.cuisine}</div>
                <div class="data-row"><strong>จังหวัด/พื้นที่:</strong> ${data.province} | ${data.district}</div>
                <div class="data-row"><strong>ที่อยู่ละเอียด:</strong> ${data.location}</div>
                <div class="data-row"><strong>เบอร์ติดต่อ:</strong> ${data.tel || '-'}</div>
                <div class="data-row"><strong>เวลาทำการ:</strong> ${data.openTime || '-'}</div>
                <div class="data-row"><strong>คำบรรยาย:</strong> <span style="color:#666;">${data.description}</span></div>
            </div>
            <div class="admin-actions">
                <button class="btn-approve approve-rest-btn" data-id="${data.id}">[ อนุมัติร้านนี้ ]</button>
                <button class="btn-reject reject-rest-btn" data-id="${data.id}">[ ปฏิเสธคำขอ ]</button>
            </div>
        </div>
    `).join('');

    const totalPages = Math.ceil(filtered.length / restsPerPage);
    restPagination.innerHTML = `
        <button class="btn-page prev-rest-btn" ${currentRestPage === 1 ? 'disabled' : ''}>ก่อนหน้า</button>
        <span style="align-self:center; color:#6f4e37; font-weight:bold;">หน้า ${currentRestPage} / ${totalPages}</span>
        <button class="btn-page next-rest-btn" ${currentRestPage === totalPages ? 'disabled' : ''}>ถัดไป</button>
    `;
}

function renderUsers() {
    let filtered = allUsersData;
    
    if (searchUserTerm) {
        filtered = filtered.filter(u => 
            (u.name || "").toLowerCase().includes(searchUserTerm) ||
            (u.email || "").toLowerCase().includes(searchUserTerm) ||
            (u.id || "").toLowerCase().includes(searchUserTerm)
        );
    }

    if (currentStatusFilter === "banned") {
        filtered = filtered.filter(u => u.banStatus && u.banStatus.isBanned);
    } else if (currentStatusFilter === "normal") {
        filtered = filtered.filter(u => !u.banStatus || !u.banStatus.isBanned);
    }

    if (filtered.length === 0) {
        usersContainer.innerHTML = '<div style="text-align:center; padding:40px; background:white; border-radius:12px; border:1px solid #eee;"><h3 style="color:#8c8c8c;">ไม่พบสมาชิกที่ค้นหา</h3></div>';
        userPagination.innerHTML = '';
        return;
    }

    const startIndex = (currentUserPage - 1) * usersPerPage;
    const paginatedItems = filtered.slice(startIndex, startIndex + usersPerPage);

    usersContainer.innerHTML = paginatedItems.map(data => {
        const isBanned = data.banStatus && data.banStatus.isBanned;
        let banBadge = '';
        let banDetailHtml = '';

        if (isBanned) {
            const expiry = data.banStatus.expiry;
            const reason = data.banStatus.reason || "ไม่ระบุเหตุผล";
            const timeStr = expiry ? new Date(expiry).toLocaleString('th-TH') : "ถาวร";
            banBadge = `<span style="background:#fee2e2; color:#dc2626; padding:2px 10px; border-radius:12px; font-size:0.8rem; font-weight:bold; margin-left:10px;">BANNED</span>`;
            banDetailHtml = `
                <div style="background:#fff1f2; border:1px solid #fecdd3; padding:10px; border-radius:8px; margin-top:10px; font-size:0.85rem;">
                    <p style="color:#be123c;"><strong>สาเหตุ:</strong> ${reason}</p>
                    <p style="color:#e11d48; margin-top:3px;"><strong>ปลดแบนเมื่อ:</strong> ${timeStr}</p>
                </div>
            `;
        }

        return `
        <div class="admin-card user-card">
            <img src="${data.photoUrl || 'https://ui-avatars.com/api/?name=User&background=ccc&color=fff'}">
            <div class="admin-details">
                <h3 style="color:#8b5a2b; margin-bottom: 5px; display:flex; align-items:center;">
                    ${data.name || 'ไม่มีชื่อ'} ${banBadge}
                </h3>
                <div class="data-row" style="margin-bottom: 8px;">
                    <span style="font-size: 0.75rem; background: #f3f4f6; padding: 2px 8px; border-radius: 12px; color: #6b7280; font-family: monospace;">UID: ${data.id}</span>
                </div>
                <div class="data-row"><strong>พ้อยท์ปัจจุบัน:</strong> ${(data.points || 0).toLocaleString()} แต้ม</div>
                
                ${banDetailHtml}

                <div style="display:flex; flex-direction:column; gap:15px; margin-top:15px;">
                    
                    <div style="background:#f3f4f6; padding:10px; border-radius:8px; border:1px solid #e5e7eb; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                        ${isBanned ? 
                            `<button class="btn-approve unban-user-btn" data-id="${data.id}" style="background:#2563eb; width:100%;">ปลดแบน</button>` : 
                            `
                            <input type="text" class="ban-reason-input" data-id="${data.id}" placeholder="ระบุสาเหตุการแบน..." style="flex: 1; max-width:150px; padding:6px; border:1px solid #d1d5db; border-radius:6px; font-size:0.85rem;">
                            <select class="ban-duration-select" data-id="${data.id}" style="flex: 1; max-width:100px; padding:6px; border:1px solid #d1d5db; border-radius:6px; font-size:0.85rem;">
                                <option value="5">5 นาที</option>
                                <option value="10">10 นาที</option>
                                <option value="60">1 ชั่วโมง</option>
                                <option value="1440">1 วัน</option>
                                <option value="perm">ถาวร</option>
                            </select>
                            <button class="btn-reject ban-user-btn" data-id="${data.id}" style="max-width:120px; white-space: nowrap;">แบนผู้ใช้</button>
                            `
                        }
                    </div>

                    <div style="background:#fffaf5; padding:10px; border-radius:8px; border:1px solid #f1e6d9; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                        <input type="number" class="points-input" data-id="${data.id}" placeholder="ระบุพ้อยท์" style="flex: 1; max-width:150px; padding:6px; border:1px solid #d2a679; border-radius:6px;">
                        <button class="btn-approve add-pts-btn" data-id="${data.id}" data-current="${data.points || 0}" style="flex: 1; max-width:120px; padding:6px 12px; white-space: nowrap;">เพิ่ม/ลดแต้ม</button>
                    </div>

                    <div style="background:#fffaf5; padding:10px; border-radius:8px; border:1px solid #f1e6d9; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                            <select class="title-class-select" data-id="${data.id}" style="flex: 1; max-width:180px; padding:6px; border:1px solid #d2a679; border-radius:6px; font-family:'Kanit';">
                                <option value="" disabled selected>-- มอบฉายา --</option>
                                <option value="title-special">Special</option>
                                <option value="title-sec">SEC</option>
                                <option value="title-ur">UR</option>
                                <option value="title-sr">SR</option>
                                <option value="title-rare">Rare</option>
                                <option value="title-uncommon">Uncommon</option>
                                <option value="title-common">Common</option>
                            </select>
                            <input type="text" class="title-name-input" data-id="${data.id}" placeholder="ระบุชื่อฉายา..." style="flex: 1; max-width: 150px; padding:6px; border:1px solid #d2a679; border-radius:6px;">
                            <button class="btn-approve add-title-btn" data-id="${data.id}" style="max-width:120px; padding:6px 12px; white-space: nowrap;">ส่งฉายาให้</button>
                    </div>

                </div>
            </div>
        </div>`;
    }).join('');

    const totalPages = Math.ceil(filtered.length / usersPerPage);
    userPagination.innerHTML = `
        <button class="btn-page prev-user-btn" ${currentUserPage === 1 ? 'disabled' : ''}>ก่อนหน้า</button>
        <span style="align-self:center; color:#6f4e37; font-weight:bold;">หน้า ${currentUserPage} / ${totalPages}</span>
        <button class="btn-page next-user-btn" ${currentUserPage === totalPages ? 'disabled' : ''}>ถัดไป</button>
    `;
}

function renderBoardThreads() {
    let filtered = allBoardThreads;
    if (searchBoardTerm) {
        filtered = filtered.filter(t => {
            if ((t.title || "").toLowerCase().includes(searchBoardTerm)) return true;
            if ((t.content || "").toLowerCase().includes(searchBoardTerm)) return true;
            if ((t.authorName || "").toLowerCase().includes(searchBoardTerm)) return true;
            if (t.replies) {
                return t.replies.some(r => 
                    (r.content || "").toLowerCase().includes(searchBoardTerm) || 
                    (r.authorName || "").toLowerCase().includes(searchBoardTerm)
                );
            }
            return false;
        });
    }

    if (filtered.length === 0) {
        boardContainer.innerHTML = '<div style="text-align:center; padding:40px; background:white; border-radius:12px; border:1px solid #eee;"><h3 style="color:#8c8c8c;">ไม่พบกระทู้ที่ค้นหา</h3></div>';
        boardPagination.innerHTML = '';
        return;
    }

    const startIndex = (currentBoardPage - 1) * boardPerPage;
    const paginatedItems = filtered.slice(startIndex, startIndex + boardPerPage);

    boardContainer.innerHTML = paginatedItems.map(data => {
        const dateStr = new Date(data.createdAt).toLocaleDateString('th-TH');
        
        let repliesHtml = '';
        if (data.replies && data.replies.length > 0) {
            repliesHtml = `
            <div style="margin-top: 15px; border-top: 1px solid #f1e6d9; padding-top: 10px;">
                <h4 style="color: #6f4e37; margin-bottom: 10px; font-size: 0.9rem;">รายการคอมเมนต์ในกระทู้นี้:</h4>
                ${data.replies.map((r, index) => `
                    <div style="background: #faf8f5; padding: 10px; border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; gap: 15px;">
                        <div style="flex: 1;">
                            <strong style="color: #8b5a2b; font-size: 0.85rem;">${r.authorName}:</strong>
                            <span style="color: #4a4a4a; font-size: 0.85rem; margin-left: 5px; word-break: break-word;">${r.content}</span>
                        </div>
                        <button class="btn-reject delete-reply-btn" data-thread-id="${data.id}" data-reply-index="${index}" style="padding: 4px 10px; font-size: 0.75rem; white-space: nowrap;">ลบคอมเมนต์</button>
                    </div>
                `).join('')}
            </div>`;
        }

        return `
        <div class="admin-card" style="flex-direction: column; gap: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3 style="color:#8b5a2b; margin:0; font-size: 1.15rem;">${data.title}</h3>
                <span style="background: #f3f4f6; color: #6f4e37; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; border: 1px solid #eee;">#${data.tag}</span>
            </div>
            <p style="color:#4a4a4a; font-size: 0.95rem; line-height: 1.5;">${data.content}</p>
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #f1e6d9; padding-top: 12px; margin-top: 5px;">
                <span style="font-size: 0.85rem; color: #8c8c8c;">ตั้งโดย: <strong>${data.authorName}</strong> | เมื่อ: ${dateStr}</span>
                <button class="btn-reject delete-thread-btn" data-id="${data.id}" style="padding: 6px 15px; font-size: 0.85rem;">ลบกระทู้นี้ (รวมคอมเมนต์ทั้งหมด)</button>
            </div>
            ${repliesHtml}
        </div>`;
    }).join('');

    const totalPages = Math.ceil(filtered.length / boardPerPage);
    boardPagination.innerHTML = `
        <button class="btn-page prev-board-btn" ${currentBoardPage === 1 ? 'disabled' : ''}>ก่อนหน้า</button>
        <span style="align-self:center; color:#6f4e37; font-weight:bold;">หน้า ${currentBoardPage} / ${totalPages}</span>
        <button class="btn-page next-board-btn" ${currentBoardPage === totalPages ? 'disabled' : ''}>ถัดไป</button>
    `;
}

function renderReviews() {
    let filtered = allReviewsData;
    if (searchReviewTerm) {
        filtered = filtered.filter(r => {
            if ((r.name || "").toLowerCase().includes(searchReviewTerm)) return true;
            if ((r.text || "").toLowerCase().includes(searchReviewTerm)) return true;
            if (r.replies) {
                return r.replies.some(reply => 
                    (reply.content || reply.text || "").toLowerCase().includes(searchReviewTerm) || 
                    (reply.authorName || reply.name || "").toLowerCase().includes(searchReviewTerm)
                );
            }
            return false;
        });
    }

    if (filtered.length === 0) {
        reviewContainer.innerHTML = '<div style="text-align:center; padding:40px; background:white; border-radius:12px; border:1px solid #eee;"><h3 style="color:#8c8c8c;">ไม่พบรีวิวที่ค้นหา</h3></div>';
        reviewPagination.innerHTML = '';
        return;
    }

    const startIndex = (currentReviewPage - 1) * reviewsPerPage;
    const paginatedItems = filtered.slice(startIndex, startIndex + reviewsPerPage);

    reviewContainer.innerHTML = paginatedItems.map(data => {
        const dateStr = new Date(data.date).toLocaleDateString('th-TH');
        let starsHtml = '★'.repeat(data.rating) + '☆'.repeat(5 - data.rating);
        
        let repliesHtml = '';
        if (data.replies && data.replies.length > 0) {
            repliesHtml = `
            <div style="margin-top: 15px; border-top: 1px solid #f1e6d9; padding-top: 10px;">
                <h4 style="color: #6f4e37; margin-bottom: 10px; font-size: 0.9rem;">รายการคอมเมนต์ในรีวิวนี้:</h4>
                ${data.replies.map((r, index) => `
                    <div style="background: #faf8f5; padding: 10px; border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; gap: 15px;">
                        <div style="flex: 1;">
                            <strong style="color: #8b5a2b; font-size: 0.85rem;">${r.authorName || r.name}:</strong>
                            <span style="color: #4a4a4a; font-size: 0.85rem; margin-left: 5px; word-break: break-word;">${r.content || r.text}</span>
                        </div>
                        <button class="btn-reject delete-review-reply-btn" data-review-id="${data.id}" data-reply-index="${index}" style="padding: 4px 10px; font-size: 0.75rem; white-space: nowrap;">ลบคอมเมนต์</button>
                    </div>
                `).join('')}
            </div>`;
        }

        return `
        <div class="admin-card" style="flex-direction: column; gap: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3 style="color:#8b5a2b; margin:0; font-size: 1.15rem;">รีวิวโดย: ${data.name}</h3>
                <span style="color: #d2a679; font-weight: bold; font-size: 1rem;">${starsHtml}</span>
            </div>
            <p style="color:#4a4a4a; font-size: 0.95rem; line-height: 1.5; background: #faf8f5; padding: 10px; border-radius: 8px;">"${data.text}"</p>
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #f1e6d9; padding-top: 12px; margin-top: 5px;">
                <span style="font-size: 0.85rem; color: #8c8c8c;">วันที่รีวิว: ${dateStr} | อ้างอิงร้าน: ${data.restId}</span>
                <button class="btn-reject delete-review-btn" data-id="${data.id}" style="padding: 6px 15px; font-size: 0.85rem;">ลบรีวิวนี้</button>
            </div>
            ${repliesHtml}
        </div>`;
    }).join('');

    const totalPages = Math.ceil(filtered.length / reviewsPerPage);
    reviewPagination.innerHTML = `
        <button class="btn-page prev-review-btn" ${currentReviewPage === 1 ? 'disabled' : ''}>ก่อนหน้า</button>
        <span style="align-self:center; color:#6f4e37; font-weight:bold;">หน้า ${currentReviewPage} / ${totalPages}</span>
        <button class="btn-page next-review-btn" ${currentReviewPage === totalPages ? 'disabled' : ''}>ถัดไป</button>
    `;
}

tabRestContent.addEventListener('click', (e) => {
    if (e.target.classList.contains('approve-rest-btn')) {
        const restId = e.target.getAttribute('data-id');
        showConfirmModal("อนุมัติร้านอาหาร", "ยืนยันที่จะ 'อนุมัติ' ร้านอาหารนี้ให้แสดงบนหน้าเว็บใช่หรือไม่?", async () => {
            try {
                await updateDoc(doc(db, "restaurants", restId), { status: "approved" });
                showToast("[สำเร็จ] อนุมัติร้านอาหารเรียบร้อยแล้ว");
                allPendingRests = allPendingRests.filter(r => r.id !== restId);
                renderRestaurants();
            } catch (err) { showToast("[ผิดพลาด] ไม่สามารถอนุมัติได้"); }
        });
    }

    if (e.target.classList.contains('reject-rest-btn')) {
        const restId = e.target.getAttribute('data-id');
        showConfirmModal("ปฏิเสธคำขอ", "คุณต้องการ 'ปฏิเสธ' และลบข้อมูลร้านอาหารนี้ทิ้งใช่หรือไม่?", async () => {
            try {
                await deleteDoc(doc(db, "restaurants", restId));
                showToast("[สำเร็จ] ปฏิเสธและลบข้อมูลเรียบร้อยแล้ว");
                allPendingRests = allPendingRests.filter(r => r.id !== restId);
                renderRestaurants();
            } catch (err) { showToast("[ผิดพลาด] ไม่สามารถลบข้อมูลได้"); }
        });
    }

    if (e.target.classList.contains('prev-rest-btn')) { currentRestPage--; renderRestaurants(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    if (e.target.classList.contains('next-rest-btn')) { currentRestPage++; renderRestaurants(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
});

tabUserContent.addEventListener('click', (e) => {
    if (e.target.classList.contains('ban-user-btn')) {
        const userId = e.target.getAttribute('data-id');
        const reason = document.querySelector(`.ban-reason-input[data-id="${userId}"]`).value.trim();
        const duration = document.querySelector(`.ban-duration-select[data-id="${userId}"]`).value;

        if (!reason) return showToast("[แจ้งเตือน] กรุณาระบุสาเหตุในการระงับการใช้งาน");
        const durationText = duration === 'perm' ? 'ถาวร' : (duration >= 60 ? `${duration/60} ชั่วโมง` : `${duration} นาที`);
        
        showConfirmModal("ระงับการใช้งาน", `ยืนยันการแบนสมาชิกท่านนี้ด้วยสาเหตุ: "${reason}" (${durationText})`, async () => {
            try {
                const expiry = duration === 'perm' ? null : Date.now() + (parseInt(duration) * 60 * 1000);
                await updateDoc(doc(db, "users", userId), {
                    banStatus: { isBanned: true, reason: reason, expiry: expiry, timestamp: Date.now() }
                });
                showToast(`[สำเร็จ] ระงับการใช้งานเรียบร้อย (${durationText})`);
                fetchAllData();
            } catch (err) { showToast("[ผิดพลาด] ไม่สามารถดำเนินการได้"); }
        });
    }

    if (e.target.classList.contains('unban-user-btn')) {
        const userId = e.target.getAttribute('data-id');
        showConfirmModal("ปลดการระงับ", "ยืนยันการปลดแบนและคืนสิทธิ์การเข้าใช้งานให้สมาชิกท่านนี้?", async () => {
            try {
                await updateDoc(doc(db, "users", userId), {
                    banStatus: { isBanned: false, reason: null, expiry: null }
                });
                showToast("[สำเร็จ] ปลดแบนเรียบร้อยแล้ว");
                fetchAllData();
            } catch (err) { showToast("[ผิดพลาด] ไม่สามารถดำเนินการได้"); }
        });
    }

    if (e.target.classList.contains('add-pts-btn')) {
        const userId = e.target.getAttribute('data-id');
        const currentPoints = parseInt(e.target.getAttribute('data-current'));
        const inputEl = document.querySelector(`.points-input[data-id="${userId}"]`);
        const pointsToAdd = parseInt(inputEl.value);

        if (!pointsToAdd || pointsToAdd === 0) return showToast("[แจ้งเตือน] กรุณาระบุจำนวนพ้อยท์ให้ถูกต้อง (ใส่ติดลบเพื่อลดแต้มได้)");

        let newPoints = currentPoints + pointsToAdd;
        newPoints = Math.max(0, Math.min(10000000, newPoints));

        if (newPoints === currentPoints) {
            return showToast(`[แจ้งเตือน] ไม่สามารถดำเนินการได้ เนื่องจากแต้มของผู้ใช้ตันอยู่ที่ ${newPoints.toLocaleString()} แต้มแล้วครับ`);
        }

        showConfirmModal("จัดการพ้อยท์สะสม", `ยืนยันการ ${pointsToAdd > 0 ? 'เพิ่ม' : 'ลด'} ${Math.abs(pointsToAdd).toLocaleString()} แต้ม ให้กับสมาชิกท่านนี้ใช่หรือไม่?`, async () => {
            try {
                await updateDoc(doc(db, "users", userId), { points: newPoints });
                showToast(`[สำเร็จ] อัปเดตพ้อยท์เรียบร้อยแล้ว (ยอดใหม่: ${newPoints.toLocaleString()} แต้ม)`);
                const userIndex = allUsersData.findIndex(u => u.id === userId);
                if(userIndex > -1) allUsersData[userIndex].points = newPoints;
                
                inputEl.value = '';
                renderUsers();
            } catch (err) { 
                showToast("[ผิดพลาด] ไม่สามารถจัดการพ้อยท์ได้"); 
            }
        });
    }

    // 🌟 🌟 🌟 เพิ่ม Event สำหรับมอบฉายาตรงนี้ครับ 🌟 🌟 🌟
    if (e.target.classList.contains('add-title-btn')) {
        const userId = e.target.getAttribute('data-id');
        const classSelect = document.querySelector(`.title-class-select[data-id="${userId}"]`);
        const nameInput = document.querySelector(`.title-name-input[data-id="${userId}"]`);
        
        const titleClass = classSelect.value;
        const titleName = nameInput.value.trim();

        if (!titleClass) return showToast("[แจ้งเตือน] กรุณาเลือกระดับความหายาก");
        if (!titleName) return showToast("[แจ้งเตือน] กรุณาพิมพ์ชื่อฉายา");

        showConfirmModal("มอบฉายาพิเศษ", `ยืนยันการมอบฉายา "${titleName}" ให้กับสมาชิกท่านนี้ใช่หรือไม่?`, async () => {
            try {
                const newTitleObj = { class: titleClass, name: titleName };
                await updateDoc(doc(db, "users", userId), { titles: arrayUnion(newTitleObj) });
                showToast(`[สำเร็จ] มอบฉายา "${titleName}" เรียบร้อยแล้ว`);
                classSelect.value = '';
                nameInput.value = '';
            } catch (err) { showToast("[ผิดพลาด] ไม่สามารถมอบฉายาได้"); }
        });
    }

    if (e.target.classList.contains('prev-user-btn')) { currentUserPage--; renderUsers(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    if (e.target.classList.contains('next-user-btn')) { currentUserPage++; renderUsers(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
});

tabBoardContent.addEventListener('click', (e) => {
    if (e.target.classList.contains('delete-thread-btn')) {
        const threadId = e.target.getAttribute('data-id');
        showConfirmModal("ลบกระทู้", "ยืนยันการลบกระทู้นี้ออกจากระบบอย่างถาวรใช่หรือไม่?", async () => {
            try {
                await deleteDoc(doc(db, "threads", threadId));
                showToast("[สำเร็จ] ลบกระทู้เรียบร้อยแล้ว");
                allBoardThreads = allBoardThreads.filter(t => t.id !== threadId);
                renderBoardThreads();
            } catch (err) { showToast("[ผิดพลาด] ไม่สามารถลบกระทู้ได้"); }
        });
    }

    if (e.target.classList.contains('delete-reply-btn')) {
        const threadId = e.target.getAttribute('data-thread-id');
        const replyIndex = parseInt(e.target.getAttribute('data-reply-index'));
        showConfirmModal("ลบคอมเมนต์", "ยืนยันการลบคอมเมนต์นี้ออกจากระบบใช่หรือไม่?", async () => {
            try {
                const threadRef = doc(db, "threads", threadId);
                const threadSnap = await getDoc(threadRef);
                if (threadSnap.exists()) {
                    let currentReplies = threadSnap.data().replies || [];
                    currentReplies.splice(replyIndex, 1); 
                    await updateDoc(threadRef, { replies: currentReplies });
                    showToast("[สำเร็จ] ลบคอมเมนต์เรียบร้อยแล้ว");
                    
                    const tIndex = allBoardThreads.findIndex(t => t.id === threadId);
                    if (tIndex > -1) allBoardThreads[tIndex].replies = currentReplies;
                    renderBoardThreads();
                }
            } catch (err) { showToast("[ผิดพลาด] ไม่สามารถลบคอมเมนต์ได้"); }
        });
    }

    if (e.target.classList.contains('prev-board-btn')) { currentBoardPage--; renderBoardThreads(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    if (e.target.classList.contains('next-board-btn')) { currentBoardPage++; renderBoardThreads(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
});

tabReviewContent.addEventListener('click', (e) => {
    if (e.target.classList.contains('delete-review-btn')) {
        const reviewId = e.target.getAttribute('data-id');
        showConfirmModal("ลบรีวิว", "ยืนยันการลบรีวิวนี้ออกจากระบบอย่างถาวรใช่หรือไม่?", async () => {
            try {
                await deleteDoc(doc(db, "reviews", reviewId));
                showToast("[สำเร็จ] ลบรีวิวเรียบร้อยแล้ว");
                allReviewsData = allReviewsData.filter(r => r.id !== reviewId);
                renderReviews();
            } catch (err) { showToast("[ผิดพลาด] ไม่สามารถลบรีวิวได้"); }
        });
    }

    if (e.target.classList.contains('delete-review-reply-btn')) {
        const reviewId = e.target.getAttribute('data-review-id');
        const replyIndex = parseInt(e.target.getAttribute('data-reply-index'));
        showConfirmModal("ลบคอมเมนต์", "ยืนยันการลบคอมเมนต์นี้ออกจากระบบใช่หรือไม่?", async () => {
            try {
                const reviewRef = doc(db, "reviews", reviewId);
                const reviewSnap = await getDoc(reviewRef);
                if (reviewSnap.exists()) {
                    let currentReplies = reviewSnap.data().replies || [];
                    currentReplies.splice(replyIndex, 1); 
                    await updateDoc(reviewRef, { replies: currentReplies });
                    showToast("[สำเร็จ] ลบคอมเมนต์เรียบร้อยแล้ว");
                    
                    const rIndex = allReviewsData.findIndex(r => r.id === reviewId);
                    if (rIndex > -1) allReviewsData[rIndex].replies = currentReplies;
                    renderReviews();
                }
            } catch (err) { showToast("[ผิดพลาด] ไม่สามารถลบคอมเมนต์ได้"); }
        });
    }

    if (e.target.classList.contains('prev-review-btn')) { currentReviewPage--; renderReviews(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    if (e.target.classList.contains('next-review-btn')) { currentReviewPage++; renderReviews(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
});


// 🌟🌟🌟 ระบบจัดการสิทธิ์ทีมงาน (แต่งตั้ง/ปลด Admin) 🌟🌟🌟

async function loadAdmins() {
    const container = document.getElementById('adminListContainer');
    try {
        const q = query(collection(db, "users"), where("role", "==", "admin"));
        const snap = await getDocs(q);
        container.innerHTML = '';
        
        if (snap.empty) {
            container.innerHTML = '<p style="text-align:center; color:#aaa; padding:20px;">ยังไม่มีผู้ดูแลระบบในระบบ</p>';
            return;
        }

        snap.forEach(userDoc => {
            const data = userDoc.data();
            container.innerHTML += `
                <div class="user-row">
                    <div style="display:flex; align-items:center; gap:15px;">
                        <img src="${data.photoUrl || 'https://ui-avatars.com/api/?name=Admin&background=dc2626&color=fff'}" style="width:45px; height:45px; border-radius:50%; object-fit:cover;">
                        <div class="user-info">
                            <strong style="color:#1f2937; font-size:1.05rem;">${data.name || 'ไม่มีชื่อ'}</strong> <span class="badge-admin">ADMIN</span><br>
                            <small style="color:#6b7280; font-family:monospace; background:#f3f4f6; padding:2px 6px; border-radius:4px;">UID: ${userDoc.id}</small>
                        </div>
                    </div>
                    <button class="btn-demote demote-admin-btn" data-uid="${userDoc.id}" style="padding: 8px 15px;">ปลดจากแอดมิน</button>
                </div>
            `;
        });
    } catch (e) {
        container.innerHTML = '<p style="text-align:center; color:red;">ไม่สามารถโหลดรายชื่อแอดมินได้</p>';
    }
}

document.getElementById('adminSearchBtn').addEventListener('click', async () => {
    const keyword = document.getElementById('adminSearchInput').value.trim();
    const resultDiv = document.getElementById('adminSearchResultContainer');
    if (!keyword) return;

    resultDiv.innerHTML = '<p style="text-align:center; color:#8b5a2b;">กำลังค้นหา...</p>';
    
    try {
        const userRef = doc(db, "users", keyword);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const data = userSnap.data();
            resultDiv.innerHTML = `
                <div class="user-row" style="background: #f0fdf4; border: 1px solid #bbf7d0; box-shadow: 0 4px 6px rgba(22, 163, 74, 0.1);">
                    <div style="display:flex; align-items:center; gap:15px;">
                        <img src="${data.photoUrl || 'https://ui-avatars.com/api/?name=User&background=ccc&color=fff'}" style="width:45px; height:45px; border-radius:50%; object-fit:cover;">
                        <div class="user-info">
                            <strong style="color:#166534; font-size:1.05rem;">${data.name || 'ไม่มีชื่อ'}</strong> 
                            ${data.role === 'admin' ? '<span class="badge-admin">ADMIN</span>' : ''}<br>
                            <small style="color:#6b7280; font-family:monospace;">UID: ${userSnap.id}</small>
                        </div>
                    </div>
                    ${data.role !== 'admin' 
                        ? `<button class="btn-promote promote-admin-btn" data-uid="${userSnap.id}" style="padding: 10px 20px; font-weight:bold; box-shadow: 0 2px 4px rgba(5, 150, 105, 0.2);">✨ แต่งตั้งเป็นแอดมิน</button>` 
                        : '<span style="color:#16a34a; font-weight:bold; background:#dcfce7; padding:8px 15px; border-radius:8px;">✅ เป็นแอดมินอยู่แล้ว</span>'
                    }
                </div>
            `;
        } else {
            resultDiv.innerHTML = '<p style="text-align:center; color:#dc2626; background:#fee2e2; padding:15px; border-radius:8px;">❌ ไม่พบผู้ใช้งาน! กรุณาตรวจสอบ UID ให้ถูกต้อง (คัดลอก UID ได้จากหน้าโปรไฟล์ของผู้ใช้)</p>';
        }
    } catch (e) {
        resultDiv.innerHTML = '<p style="text-align:center; color:#dc2626;">เกิดข้อผิดพลาดในการค้นหา</p>';
    }
});

tabAdminRoleContent.addEventListener('click', (e) => {
    if (e.target.classList.contains('promote-admin-btn')) {
        const uid = e.target.getAttribute('data-uid');
        showConfirmModal("แต่งตั้งผู้ดูแลระบบ", "คุณแน่ใจหรือไม่ที่จะแต่งตั้งให้สมาชิกท่านนี้เป็น 'แอดมิน'?\n(จะสามารถเข้าถึงระบบหลังบ้าน แบน แอดแต้ม และปลดแอดมินคนอื่นได้)", async () => {
            try {
                await updateDoc(doc(db, "users", uid), { role: 'admin' });
                showToast("[สำเร็จ] แต่งตั้งแอดมินเรียบร้อยแล้ว!");
                document.getElementById('adminSearchResultContainer').innerHTML = ''; 
                document.getElementById('adminSearchInput').value = '';
                loadAdmins(); 
            } catch (err) { showToast("[ผิดพลาด] ไม่สามารถแต่งตั้งได้"); }
        });
    }

    if (e.target.classList.contains('demote-admin-btn')) {
        const uid = e.target.getAttribute('data-uid');
        showConfirmModal("ปลดสิทธิ์ผู้ดูแลระบบ", "คุณแน่ใจหรือไม่ที่จะ 'ปลด' สิทธิ์แอดมินของสมาชิกท่านนี้?\n(จะทำให้ผู้ใช้นี้ไม่สามารถเข้าหน้าระบบหลังบ้านได้อีก)", async () => {
            try {
                await updateDoc(doc(db, "users", uid), { role: null }); 
                showToast("[สำเร็จ] ปลดสิทธิ์แอดมินเรียบร้อยแล้ว!");
                loadAdmins(); 
            } catch (err) { showToast("[ผิดพลาด] ไม่สามารถปลดสิทธิ์ได้"); }
        });
    }
});