import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, doc, getDoc, updateDoc, addDoc, orderBy, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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
let currentDisplayName = "บุคคลทั่วไป";
let currentUserPhoto = "";
let currentUserTitle = null;
let myBookmarkedPlaces = [];
let currentFilterTag = "all";
let currentViewThreadId = null;

let allFetchedThreads = [];
let currentSortMode = "latest";
let currentSearchKeyword = "";

function showToast(message) {
    const toast = document.getElementById("toastNotification");
    if (!toast) return;
    toast.innerText = message;
    toast.classList.add("show");
    setTimeout(() => { toast.classList.remove("show"); }, 3500); 
}

const badWordsList = ["คำหยาบ", "สแปม", "คาสิโน", "บาคาร่า", "หวยออนไลน์", "เว็บพนัน", "หี", "ควย", "เย็ด", "สัส", "เหี้ย", "โป๊", "คลิปหลุด", "nika", "ไอดำ", "ตาย", "มึง", "ไร้"];
function containsBadWords(text) { return badWordsList.some(badWord => text.toLowerCase().includes(badWord.toLowerCase())); }

// 🌟 ป้องกันการแฮ็ก XSS
function escapeHTML(str) {
    if (!str) return "";
    return String(str).replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag]));
}

onAuthStateChanged(auth, async (user) => {
    if (!user || user.isAnonymous) {
        showToast("[แจ้งเตือน] กรุณาเข้าสู่ระบบเพื่อใช้งานกระดานสนทนา");
        setTimeout(() => { window.location.href = "index.html"; }, 2000);
        return;
    }

    currentUser = user;
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        const data = userSnap.data();

        if (data.banStatus && data.banStatus.isBanned) {
            const nowTime = Date.now();
            if (!data.banStatus.expiry || nowTime < data.banStatus.expiry) {
                const timeLeft = data.banStatus.expiry ? 
                    `เหลือเวลาอีก ${Math.ceil((data.banStatus.expiry - nowTime) / 60000)} นาที` : "เป็นการแบนถาวร";
                showToast(`[แจ้งเตือน] บัญชีของคุณถูกระงับการใช้งาน: ${timeLeft}`);
                setTimeout(() => { signOut(auth).then(() => window.location.href = "index.html"); }, 3000);
                return; 
            } else {
                await updateDoc(userRef, { banStatus: { isBanned: false, expiry: null } });
            }
        }

        currentDisplayName = data.name || "นักชิม";
        currentUserPhoto = data.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentDisplayName)}&background=d2a679&color=fff`;
        myBookmarkedPlaces = data.bookmarks || [];
        currentUserTitle = data.equippedTitle || null;
        
        document.getElementById('userNameDisplay').innerText = currentDisplayName;
        document.getElementById('userAvatar').src = currentUserPhoto;
    }

    loadThreads();
    prepareAttachDropdown();
});

const tagFilterMenu = document.getElementById('tagFilterMenu');
tagFilterMenu.addEventListener('click', (e) => {
    if (e.target.tagName === 'LI') {
        Array.from(tagFilterMenu.children).forEach(li => li.classList.remove('active'));
        e.target.classList.add('active');
        currentFilterTag = e.target.getAttribute('data-tag');
        loadThreads();
    }
});

document.getElementById('searchThreadInput').addEventListener('input', (e) => {
    currentSearchKeyword = e.target.value.trim().toLowerCase();
    renderFilteredThreads();
});

document.getElementById('sortThreadSelect').addEventListener('change', (e) => {
    currentSortMode = e.target.value;
    renderFilteredThreads();
});

async function loadThreads() {
    const container = document.getElementById('threadsContainer');
    container.innerHTML = '<p style="text-align: center; color: #aaa; padding: 40px;">กำลังโหลดกระทู้...</p>';

    try {
        let q;
        if (currentFilterTag === "all") {
            q = query(collection(db, "threads"), orderBy("createdAt", "desc"));
        } else {
            q = query(collection(db, "threads"), where("tag", "==", currentFilterTag));
        }

        const querySnapshot = await getDocs(q);
        
        allFetchedThreads = [];
        querySnapshot.forEach(doc => allFetchedThreads.push({ id: doc.id, ...doc.data() }));

        renderFilteredThreads();

    } catch (e) {
        container.innerHTML = '<p style="text-align: center; color: red;">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>';
    }
}

function renderFilteredThreads() {
    const container = document.getElementById('threadsContainer');

    let filtered = allFetchedThreads.filter(t => {
        if (currentSearchKeyword === "") return true;
        const titleMatch = (t.title || "").toLowerCase().includes(currentSearchKeyword);
        const contentMatch = (t.content || "").toLowerCase().includes(currentSearchKeyword);
        return titleMatch || contentMatch;
    });

    if (currentSortMode === "latest") {
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (currentSortMode === "popular") {
        filtered.sort((a, b) => (b.replies ? b.replies.length : 0) - (a.replies ? a.replies.length : 0));
    }

    if (filtered.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; background: white; border-radius: 12px; border: 1px solid #f1e6d9;"><h3 style="color: #8b5a2b;">ไม่พบกระทู้ที่ค้นหา</h3><p style="color: #8c8c8c;">ลองเปลี่ยนคำค้นหา หรือเลือกหมวดหมู่ใหม่ดูนะครับ</p></div>';
        return;
    }

    container.innerHTML = '';
    filtered.forEach(thread => {
        const replyCount = (thread.replies || []).length;
        const card = document.createElement('div');
        card.className = 'thread-card';
        card.onclick = () => openThread(thread);
        
        // 🌟 ป้องกัน XSS ก่อนวาดหน้าจอ
        const safeTag = escapeHTML(thread.tag);
        const safeTitle = escapeHTML(thread.title);
        const safeContent = escapeHTML(thread.content);
        const safeAuthor = escapeHTML(thread.authorName);

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <span class="thread-tag">#${safeTag}</span>
                    <h3 class="thread-title" style="margin-top: 10px;">${safeTitle}</h3>
                </div>
            </div>
            <p class="thread-content-preview">${safeContent}</p>
            <div class="thread-meta" style="margin-top: 15px; margin-bottom: 0;">
                <span style="color: #6f4e37; font-weight: 500;">โดย: ${safeAuthor}</span>
                <span>เมื่อ: ${new Date(thread.createdAt).toLocaleDateString('th-TH')}</span>
                <span style="margin-left: auto; color: #8b5a2b; font-weight: bold;">${replyCount} คำตอบ</span>
            </div>
        `;
        container.appendChild(card);
    });
}

const createPostModal = document.getElementById('createPostModal');
document.getElementById('openCreatePostBtn').addEventListener('click', () => { createPostModal.style.display = 'block'; });
document.getElementById('closeCreatePostModal').addEventListener('click', () => { createPostModal.style.display = 'none'; });

document.getElementById('createPostForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('postTitle').value.trim();
    const content = document.getElementById('postContent').value.trim();
    const tag = document.getElementById('postTag').value;

    if (containsBadWords(title + " " + content)) {
        return showToast("[แจ้งเตือน] ระบบตรวจพบคำไม่เหมาะสม กรุณาแก้ไขข้อความ");
    }

    const submitBtn = document.getElementById('submitPostBtn');
    submitBtn.disabled = true;
    submitBtn.innerText = "กำลังโพสต์...";

    try {
        const newThread = {
            title: title,
            content: content,
            tag: tag,
            authorUid: currentUser.uid,
            authorName: currentDisplayName,
            authorPhoto: currentUserPhoto,
            createdAt: new Date().toISOString(),
            replies: []
        };

        await addDoc(collection(db, "threads"), newThread);
        showToast("[สำเร็จ] ตั้งกระทู้เรียบร้อยแล้ว");
        
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const userData = userSnap.data();
            await updateDoc(userRef, { points: (userData.points || 0) + 10 });
        }

        document.getElementById('createPostForm').reset();
        createPostModal.style.display = 'none';
        loadThreads();
    } catch (err) {
        showToast("[ผิดพลาด] ไม่สามารถตั้งกระทู้ได้");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = "โพสต์กระทู้";
    }
});

const viewPostModal = document.getElementById('viewPostModal');
document.getElementById('closeViewPostModal').addEventListener('click', () => { viewPostModal.style.display = 'none'; });

async function openThread(thread) {
    currentViewThreadId = thread.id;
    document.getElementById('viewPostTag').innerText = `#${escapeHTML(thread.tag)}`;
    document.getElementById('viewPostTitle').innerText = escapeHTML(thread.title);
    document.getElementById('viewPostAuthor').innerText = `โดย: ${escapeHTML(thread.authorName)}`;
    document.getElementById('viewPostDate').innerText = `เมื่อ: ${new Date(thread.createdAt).toLocaleDateString('th-TH')}`;
    document.getElementById('viewPostContent').innerText = escapeHTML(thread.content);
    
    viewPostModal.style.display = 'block';
    renderReplies(thread.replies || []);
}

async function renderReplies(replies) {
    const container = document.getElementById('repliesContainer');
    document.getElementById('replyCount').innerText = replies.length;
    
    if (replies.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #aaa; padding: 20px;">ยังไม่มีการตอบกลับ เป็นคนแรกที่แนะนำเพื่อนเลย!</p>';
        return;
    }

    container.innerHTML = '';
    
    for (const reply of replies) {
        console.log("👉 ตรวจสอบข้อมูล Reply:", reply);
        let attachHtml = '';
        
        if (reply.attachedRestId) {
            try {
                const restSnap = await getDoc(doc(db, "restaurants", reply.attachedRestId));
                if (restSnap.exists()) {
                    const restData = restSnap.data();
                    const cleanRating = (restData.rating || "★ 5.0").replace('⭐', '★');
                    attachHtml = `
                        <a href="detail.html?id=${reply.attachedRestId}" target="_blank" class="attached-rest-card">
                            <img src="${escapeHTML(restData.img)}" class="attached-rest-img">
                            <div style="display: flex; flex-direction: column; justify-content: center;">
                                <h4 style="color: #8b5a2b; margin-bottom: 5px; font-size: 1rem;">${escapeHTML(restData.name)}</h4>
                                <span style="color: #d2a679; font-weight: bold; font-size: 0.9rem;">${cleanRating}</span>
                                <span style="color: #8c8c8c; font-size: 0.85rem;">พิกัด: ${escapeHTML(restData.province)}</span>
                            </div>
                        </a>
                    `;
                }
            } catch(e) {}
        }

        const replyTitleHtml = reply.userTitle 
            ? `<span class="title-tag ${escapeHTML(reply.userTitle.class)}">${escapeHTML(reply.userTitle.name)}</span>` 
            : '';
        const replyDiv = document.createElement('div');
        replyDiv.className = 'reply-card';
        replyDiv.innerHTML = `
            <div class="reply-header">
                <img src="${escapeHTML(reply.authorPhoto)}" class="reply-avatar">
                <div style="display: flex; align-items: center; gap: 5px; flex-wrap: wrap;">
                    <span style="font-weight: bold; color: #6f4e37; font-size: 0.95rem;">${escapeHTML(reply.authorName)}</span>
                ${replyTitleHtml}
                </div>
                <span style="font-size: 0.8rem; color: #aaa;">${new Date(reply.createdAt).toLocaleDateString('th-TH')}</span>
            </div>
            <p style="color: #4a4a4a; font-size: 0.95rem; line-height: 1.5;">${escapeHTML(reply.content)}</p>
            ${attachHtml}
        `;
        container.appendChild(replyDiv);
    }
}

async function prepareAttachDropdown() {
    const select = document.getElementById('replyAttachSelect');
    const checkbox = document.getElementById('attachRestCheck');

    checkbox.addEventListener('change', () => {
        select.style.display = checkbox.checked ? 'block' : 'none';
        if (!checkbox.checked) select.value = ""; 
    });

    if (myBookmarkedPlaces.length === 0) {
        select.innerHTML = '<option value="" disabled selected>ไม่มีร้านในรายการโปรด (Bookmark)</option>';
        return;
    }

    let optionsHtml = '<option value="" disabled selected>-- เลือกร้านอาหารที่ต้องการแนะนำ --</option>';
    for (const restId of myBookmarkedPlaces) {
        try {
            const restSnap = await getDoc(doc(db, "restaurants", restId));
            if (restSnap.exists()) {
                optionsHtml += `<option value="${restId}">${escapeHTML(restSnap.data().name)} (${escapeHTML(restSnap.data().province)})</option>`;
            }
        } catch(e) {}
    }
    select.innerHTML = optionsHtml;
}

document.getElementById('submitReplyBtn').addEventListener('click', async () => {
    const content = document.getElementById('replyContent').value.trim();
    const isAttachChecked = document.getElementById('attachRestCheck').checked;
    const attachedRestId = document.getElementById('replyAttachSelect').value;

    if (!content) return showToast("[แจ้งเตือน] กรุณาพิมพ์ข้อความตอบกลับ");
    if (containsBadWords(content)) return showToast("[แจ้งเตือน] ระบบตรวจพบคำไม่เหมาะสม กรุณาแก้ไขข้อความ");
    if (isAttachChecked && !attachedRestId) return showToast("[แจ้งเตือน] กรุณาเลือกร้านอาหารที่ต้องการแนบ");

    const submitBtn = document.getElementById('submitReplyBtn');
    submitBtn.disabled = true;
    submitBtn.innerText = "...";

    try {
        const newReply = {
            content: content,
            attachedRestId: isAttachChecked ? attachedRestId : null,
            authorUid: currentUser.uid,
            authorName: currentDisplayName,
            authorPhoto: currentUserPhoto,
            userTitle: currentUserTitle,
            createdAt: new Date().toISOString()
        };

        const threadRef = doc(db, "threads", currentViewThreadId);
        await updateDoc(threadRef, {
            replies: arrayUnion(newReply)
        });

        showToast("[สำเร็จ] ส่งคำตอบกลับเรียบร้อย");
        
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const userData = userSnap.data();
            await updateDoc(userRef, { points: (userData.points || 0) + 5 });
        }

        document.getElementById('replyContent').value = '';
        document.getElementById('attachRestCheck').checked = false;
        document.getElementById('replyAttachSelect').style.display = 'none';
        document.getElementById('replyAttachSelect').value = '';

        const updatedSnap = await getDoc(threadRef);
        if(updatedSnap.exists()) renderReplies(updatedSnap.data().replies || []);

    } catch (err) {
        showToast("[ผิดพลาด] ไม่สามารถส่งคำตอบได้");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = "ส่งคำตอบ";
    }
});