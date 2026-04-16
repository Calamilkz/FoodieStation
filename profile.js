import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc, arrayUnion, arrayRemove, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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
let currentDisplayName = "นักชิม";
let targetUserUid = null; 
let amIFollowing = false;
let myBookmarkedPlaces = []; 

const rarityWeight = {
    'title-special': 7,
    'title-sec': 6, 'title-ur': 5, 'title-sr': 4,
    'title-rare': 3, 'title-uncommon': 2, 'title-common': 1
};

function showToast(message) {
    const toast = document.getElementById("toastNotification");
    if (!toast) return;
    toast.innerText = message;
    toast.classList.add("show");
    setTimeout(() => { toast.classList.remove("show"); }, 3500); 
}

// 🌟 ฟังก์ชันป้องกันการแฮ็ก XSS (Sanitize HTML)
function escapeHTML(str) {
    if (!str) return "";
    return String(str).replace(/[&<>'"]/g, tag => ({
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

function renderEquippedTitle(titleObj) {
    const badgeContainer = document.getElementById('profileTitleBadge');
    if (titleObj) {
        badgeContainer.innerHTML = `<span class="title-tag ${titleObj.class}" style="font-size: 1.1rem; padding: 6px 20px; box-shadow: 0 4px 10px rgba(0,0,0,0.15); margin: 0;">${escapeHTML(titleObj.name)}</span>`;
    } else {
        badgeContainer.innerHTML = '';
    }
}

function renderCollectedTitles(titlesArray) {
    const container = document.getElementById('profileTitlesContainer');
    if (!container) return;
    if (!titlesArray || titlesArray.length === 0) {
        container.innerHTML = '<p style="font-size: 0.85rem; color: #aaa; text-align: center; width: 100%;">ยังไม่มีฉายาในคลัง</p>';
        return;
    }
    titlesArray.sort((a, b) => (rarityWeight[b.class] || 0) - (rarityWeight[a.class] || 0));
    container.innerHTML = '';
    titlesArray.forEach(t => {
        const span = document.createElement('span');
        span.className = `title-tag ${t.class}`;
        span.innerText = t.name; // innerText ปลอดภัยจาก XSS อยู่แล้ว
        span.style.margin = '0'; 
        container.appendChild(span);
    });
}

function renderUidBadge(uid) {
    const nameEl = document.getElementById('mainProfileName');
    nameEl.style.wordBreak = "break-word";
    nameEl.style.overflowWrap = "anywhere";
    nameEl.style.lineHeight = "1.3";
    nameEl.style.maxWidth = "100%";

    let uidContainer = document.getElementById('profileUidContainer');
    if (!uidContainer) {
        uidContainer = document.createElement('div');
        uidContainer.id = 'profileUidContainer';
        uidContainer.style.cssText = "display: flex; align-items: center; justify-content: center; margin-top: 8px; margin-bottom: 10px;";
        nameEl.parentNode.insertBefore(uidContainer, nameEl.nextSibling);
    }
    
    uidContainer.innerHTML = `<span id="clickableUid" style="font-size: 0.8rem; color: #8c8c8c; background: #fffaf5; padding: 6px 15px; border-radius: 20px; font-family: monospace; border: 1px dashed #d2a679; cursor: pointer; transition: 0.3s;" title="คลิกเพื่อคัดลอก">UID: ${uid}</span>`;

    const clickableUid = document.getElementById('clickableUid');
    clickableUid.onmouseover = () => { clickableUid.style.background = "#f1e6d9"; };
    clickableUid.onmouseout = () => { clickableUid.style.background = "#fffaf5"; };
    clickableUid.onclick = () => {
        navigator.clipboard.writeText(uid).then(() => {
            showToast("[สำเร็จ] คัดลอก UID เรียบร้อยแล้ว!");
            const originalText = clickableUid.innerText;
            clickableUid.innerText = "คัดลอกแล้ว ✔️";
            clickableUid.style.background = "#e6f4ea";
            clickableUid.style.borderColor = "#2e7d32";
            clickableUid.style.color = "#2e7d32";
            setTimeout(() => {
                clickableUid.innerText = originalText;
                clickableUid.style.background = "#fffaf5";
                clickableUid.style.borderColor = "#d2a679";
                clickableUid.style.color = "#8c8c8c";
            }, 1500);
        });
    };
}

const urlParams = new URLSearchParams(window.location.search);
let viewUser = urlParams.get('user'); 
let viewUid = urlParams.get('uid');   

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "index.html"; return; }
    if (user.isAnonymous && !viewUser && !viewUid) { window.location.href = "index.html"; return; } 

    currentUser = user;
    let isOwnProfile = false;
    
    if (!user.isAnonymous) {
        const myRef = doc(db, "users", user.uid);
        const mySnap = await getDoc(myRef);
        if (mySnap.exists()) {
            const myData = mySnap.data();

            if (myData.banStatus && myData.banStatus.isBanned) {
                const nowTime = Date.now();
                if (!myData.banStatus.expiry || nowTime < myData.banStatus.expiry) {
                    const timeLeft = myData.banStatus.expiry ? `เหลือเวลาอีก ${Math.ceil((myData.banStatus.expiry - nowTime) / 60000)} นาที` : "เป็นการแบนถาวร";
                    showToast(`[แจ้งเตือน] บัญชีของคุณถูกระงับการใช้งาน: ${timeLeft}`);
                    setTimeout(() => { signOut(auth).then(() => window.location.href = "index.html"); }, 3000);
                    return; 
                } else {
                    await updateDoc(myRef, { banStatus: { isBanned: false, expiry: null } });
                }
            }

            currentDisplayName = myData.name || user.displayName || "นักชิม";
            const topNameEl = document.getElementById('userNameDisplay');
            topNameEl.innerText = currentDisplayName;
            topNameEl.style.whiteSpace = "nowrap";
            topNameEl.style.overflow = "hidden";
            topNameEl.style.textOverflow = "ellipsis";
            topNameEl.style.maxWidth = "100px";
            topNameEl.style.display = "inline-block";
            topNameEl.style.verticalAlign = "middle";

            document.getElementById('userPointsDisplay').innerText = `${myData.points || 0} แต้ม`;
            document.getElementById('userAvatar').src = myData.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentDisplayName)}&background=d2a679&color=fff`;
            myBookmarkedPlaces = myData.bookmarks || []; 
        }
    } else {
        document.getElementById('userNameDisplay').innerText = "บุคคลทั่วไป";
        document.getElementById('userPointsDisplay').innerText = ``;
        document.getElementById('userAvatar').src = `https://ui-avatars.com/api/?name=Guest&background=ccc&color=fff`;
    }

    if (!viewUid && !viewUser) { isOwnProfile = true; } 
    else if (viewUid && user && viewUid === user.uid) { isOwnProfile = true; } 
    else if (viewUser && user && viewUser === currentDisplayName && !viewUid) { isOwnProfile = true; }

    if (isOwnProfile && !user.isAnonymous) {
        document.getElementById('editProfileBtn').style.display = 'block';
        document.getElementById('tabBookmarkBtn').style.display = 'block';
        document.getElementById('createCollectionBtn').style.display = 'block'; 
        
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const data = userSnap.data();
            targetUserUid = user.uid; 
            document.getElementById('mainProfileName').innerText = data.name || "นักชิม";
            renderUidBadge(targetUserUid);
            document.getElementById('mainProfileImg').src = data.photoUrl || document.getElementById('userAvatar').src;
            document.getElementById('statPoints').innerText = (data.points || 0).toLocaleString();
            document.getElementById('statFollowers').innerText = data.followers ? data.followers.length.toLocaleString() : "0";
            document.getElementById('statFollowing').innerText = data.following ? data.following.length.toLocaleString() : "0";
            
            renderEquippedTitle(data.equippedTitle || null);
            renderCollectedTitles(data.titles || []);
            loadUserReviews(user.uid, data.name); 
            loadBookmarks(data.bookmarks || []);
            loadCollections(user.uid); 
            loadCommunityActivity(user.uid);
        }
    } else {
        document.getElementById('editProfileBtn').style.display = 'none'; 
        document.getElementById('tabBookmarkBtn').style.display = 'none'; 
        document.getElementById('createCollectionBtn').style.display = 'none'; 

        if (viewUid) {
            const targetRef = doc(db, "users", viewUid);
            const targetSnap = await getDoc(targetRef);
            if (targetSnap.exists()) {
                const targetData = targetSnap.data();
                targetUserUid = viewUid; 
                document.getElementById('mainProfileName').innerText = targetData.name || "นักชิม";
                renderUidBadge(targetUserUid);
                document.getElementById('mainProfileImg').src = targetData.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(targetData.name || "User")}&background=d2a679&color=fff`;
                document.getElementById('statPoints').innerText = (targetData.points || 0).toLocaleString();
                document.getElementById('statFollowers').innerText = targetData.followers ? targetData.followers.length.toLocaleString() : "0";
                document.getElementById('statFollowing').innerText = targetData.following ? targetData.following.length.toLocaleString() : "0";
                
                if (!user.isAnonymous && targetData.followers && targetData.followers.includes(user.uid)) { amIFollowing = true; }
                updateFollowBtnUI();
                
                document.getElementById('followBtn').style.display = 'block';
                document.getElementById('messageBtn').style.display = 'flex';
                document.getElementById('moreBtn').style.display = 'flex';
                
                renderEquippedTitle(targetData.equippedTitle || null);
                renderCollectedTitles(targetData.titles || []); 
                loadUserReviews(viewUid, targetData.name); 
                loadCollections(targetUserUid); 
                loadCommunityActivity(targetUserUid);
            }
        } else if (viewUser) {
            const q = query(collection(db, "users"), where("name", "==", viewUser));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const targetDoc = querySnapshot.docs[0];
                const targetData = targetDoc.data();
                targetUserUid = targetDoc.id; 
                document.getElementById('mainProfileName').innerText = viewUser;
                renderUidBadge(targetUserUid);
                document.getElementById('mainProfileImg').src = targetData.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(viewUser)}&background=d2a679&color=fff`;
                document.getElementById('statPoints').innerText = (targetData.points || 0).toLocaleString();
                document.getElementById('statFollowers').innerText = targetData.followers ? targetData.followers.length.toLocaleString() : "0";
                document.getElementById('statFollowing').innerText = targetData.following ? targetData.following.length.toLocaleString() : "0";
                if (!user.isAnonymous && targetData.followers && targetData.followers.includes(user.uid)) { amIFollowing = true; }
                updateFollowBtnUI();
                document.getElementById('followBtn').style.display = 'block';
                document.getElementById('messageBtn').style.display = 'flex';
                document.getElementById('moreBtn').style.display = 'flex';
                renderEquippedTitle(targetData.equippedTitle || null);
                renderCollectedTitles(targetData.titles || []); 
                loadUserReviews(null, viewUser); 
                loadCollections(targetUserUid); 
                loadCommunityActivity(targetUserUid);
            }
        }
    }
});

const tabReviewBtn = document.getElementById('tabReviewBtn');
const tabBookmarkBtn = document.getElementById('tabBookmarkBtn');
const tabCollectionBtn = document.getElementById('tabCollectionBtn');
const tabMyThreadsBtn = document.getElementById('tabMyThreadsBtn');
const tabMyRepliesBtn = document.getElementById('tabMyRepliesBtn');
const tabReview = document.getElementById('tabReview');
const tabBookmark = document.getElementById('tabBookmark');
const tabCollection = document.getElementById('tabCollection');
const tabMyThreads = document.getElementById('myThreadsContent');
const tabMyReplies = document.getElementById('myRepliesContent');

function hideAllTabs() {
    [tabReviewBtn, tabBookmarkBtn, tabCollectionBtn, tabMyThreadsBtn, tabMyRepliesBtn].forEach(btn => btn?.classList.remove('active'));
    [tabReview, tabBookmark, tabCollection, tabMyThreads, tabMyReplies].forEach(content => content?.classList.remove('active'));
}

tabReviewBtn.onclick = () => { hideAllTabs(); tabReviewBtn.classList.add('active'); tabReview.classList.add('active'); };
tabBookmarkBtn.onclick = () => { hideAllTabs(); tabBookmarkBtn.classList.add('active'); tabBookmark.classList.add('active'); };
tabCollectionBtn.onclick = () => { hideAllTabs(); tabCollectionBtn.classList.add('active'); tabCollection.classList.add('active'); };
if(tabMyThreadsBtn) tabMyThreadsBtn.onclick = () => { hideAllTabs(); tabMyThreadsBtn.classList.add('active'); tabMyThreads.classList.add('active'); };
if(tabMyRepliesBtn) tabMyRepliesBtn.onclick = () => { hideAllTabs(); tabMyRepliesBtn.classList.add('active'); tabMyReplies.classList.add('active'); };

function updateFollowBtnUI() {
    const btn = document.getElementById('followBtn');
    if (amIFollowing) { btn.innerText = "กำลังติดตาม"; btn.className = "btn-unfollow"; } 
    else { btn.innerText = "ติดตาม"; btn.className = "btn-follow"; }
}

document.getElementById('followBtn').addEventListener('click', async () => {
    if (!currentUser || currentUser.isAnonymous) return showToast("[แจ้งเตือน] กรุณาเข้าสู่ระบบเพื่อติดตาม");
    if (!targetUserUid) return;
    amIFollowing = !amIFollowing;
    updateFollowBtnUI();
    const myRef = doc(db, "users", currentUser.uid);
    const targetRef = doc(db, "users", targetUserUid);
    try {
        if (amIFollowing) {
            await updateDoc(targetRef, { followers: arrayUnion(currentUser.uid) });
            await updateDoc(myRef, { following: arrayUnion(targetUserUid) });
        } else {
            await updateDoc(targetRef, { followers: arrayRemove(currentUser.uid) });
            await updateDoc(myRef, { following: arrayRemove(targetUserUid) });
        }
    } catch (e) { showToast("[ผิดพลาด] ไม่สามารถดำเนินการได้"); }
});

const editProfileModal = document.getElementById('editProfileModal');
const closeEditModal = document.getElementById('closeEditModal');
const editProfileForm = document.getElementById('editProfileForm');
const editPhotoFile = document.getElementById('editPhotoFile');
const editPhotoUrl = document.getElementById('editPhotoUrl');
const editPreviewContainer = document.getElementById('editPreviewContainer');
const editPreviewImg = document.getElementById('editPreviewImg');

document.getElementById('editProfileBtn').onclick = () => {
    document.getElementById('editName').value = currentDisplayName;
    editPhotoUrl.value = "";
    editPhotoFile.value = "";
    editPreviewContainer.style.display = 'none';
    editProfileModal.style.display = "block";
};

closeEditModal.onclick = () => { editProfileModal.style.display = "none"; };

editPhotoFile.onchange = function() {
    const file = this.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => { editPreviewImg.src = e.target.result; editPreviewContainer.style.display = 'block'; };
        reader.readAsDataURL(file);
        editPhotoUrl.value = ""; 
    }
};

editPhotoUrl.oninput = function() {
    const url = this.value.trim();
    if (url && url.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
        editPreviewImg.src = url;
        editPreviewContainer.style.display = 'block';
        editPhotoFile.value = ""; 
    } else {
        editPreviewContainer.style.display = 'none';
    }
};

editProfileForm.onsubmit = async (e) => {
    e.preventDefault();
    const newName = document.getElementById('editName').value.trim();
    const saveBtn = document.getElementById('saveProfileBtn');
    
    if (!newName) return showToast("[แจ้งเตือน] กรุณากรอกชื่อ");
    if (newName.length > 30) return showToast("[แจ้งเตือน] ชื่อของคุณยาวเกินไป (สูงสุด 30 ตัวอักษร)");
    
    saveBtn.innerText = "กำลังบันทึก..."; saveBtn.disabled = true;

    try {
        let finalPhotoUrl = "";
        if (editPhotoFile.files[0]) {
            saveBtn.innerText = "กำลังอัปโหลดรูป...";
            finalPhotoUrl = await uploadToImgBB(editPhotoFile.files[0]);
        } else if (editPhotoUrl.value.trim()) {
            finalPhotoUrl = editPhotoUrl.value.trim();
        }

        const userRef = doc(db, "users", currentUser.uid);
        let updateData = { name: newName };
        if (finalPhotoUrl) updateData.photoUrl = finalPhotoUrl;

        await updateDoc(userRef, updateData);
        await updateProfile(currentUser, { displayName: newName, photoURL: finalPhotoUrl || currentUser.photoURL });

        showToast("[สำเร็จ] บันทึกข้อมูลสำเร็จ!");
        setTimeout(() => { window.location.reload(); }, 1500);
    } catch (error) {
        showToast("[ผิดพลาด] ไม่สามารถบันทึกได้");
        saveBtn.innerText = "บันทึกการเปลี่ยนแปลง"; saveBtn.disabled = false;
    }
};

const createCollectionModal = document.getElementById('createCollectionModal');
const closeCreateCollectionModal = document.getElementById('closeCreateCollectionModal');
const createCollectionForm = document.getElementById('createCollectionForm');

document.getElementById('createCollectionBtn').onclick = async () => {
    if (myBookmarkedPlaces.length === 0) return showToast("[แจ้งเตือน] กรุณา Bookmark ร้านอาหารก่อนสร้างคอลเล็กชัน");
    const listContainer = document.getElementById('colPlacesList');
    listContainer.innerHTML = '<p style="text-align:center;">กำลังดึงข้อมูลร้านโปรด...</p>';
    createCollectionModal.style.display = "block";
    
    let htmlContent = '';
    for (const restId of myBookmarkedPlaces) {
        try {
            const restSnap = await getDoc(doc(db, "restaurants", restId));
            if (restSnap.exists()) {
                const place = restSnap.data();
                const safePlaceName = escapeHTML(place.name);
                const safeProv = escapeHTML(place.province);
                htmlContent += `
                    <label class="place-select-item">
                        <input type="checkbox" name="colPlaceCheck" value="${restId}">
                        <img src="${place.img}" class="place-select-img">
                        <div class="place-select-info">
                            <span class="place-select-name">${safePlaceName}</span>
                            <span class="place-select-prov">${safeProv}</span>
                        </div>
                    </label>`;
            }
        } catch(e) {}
    }
    listContainer.innerHTML = htmlContent;
};

closeCreateCollectionModal.onclick = () => { createCollectionModal.style.display = "none"; };

createCollectionForm.onsubmit = async (e) => {
    e.preventDefault();
    const title = document.getElementById('colTitle').value.trim();
    const desc = document.getElementById('colDesc').value.trim();
    const selectedPlaces = Array.from(document.querySelectorAll('input[name="colPlaceCheck"]:checked')).map(cb => cb.value);

    if (selectedPlaces.length === 0) return showToast("[แจ้งเตือน] กรุณาเลือกร้านอย่างน้อย 1 ร้าน");
    const saveBtn = document.getElementById('saveCollectionBtn');
    saveBtn.innerText = "กำลังสร้าง..."; saveBtn.disabled = true;

    try {
        await addDoc(collection(db, "collections"), {
            ownerUid: currentUser.uid,
            ownerName: currentDisplayName,
            title: title,
            description: desc,
            places: selectedPlaces,
            createdAt: new Date().toISOString()
        });
        showToast("[สำเร็จ] สร้างคอลเล็กชันแล้ว!");
        createCollectionModal.style.display = "none";
        loadCollections(currentUser.uid);
    } catch (e) { showToast("[ผิดพลาด] ไม่สามารถสร้างได้"); }
    finally { saveBtn.innerText = "สร้างลายแทงนี้เลย!"; saveBtn.disabled = false; }
};

const viewCollectionModal = document.getElementById('viewCollectionModal');
const closeViewCollectionModal = document.getElementById('closeViewCollectionModal');
closeViewCollectionModal.onclick = () => { viewCollectionModal.style.display = "none"; };

async function openViewCollectionModal(colData) {
    document.getElementById('viewColTitle').innerText = colData.title; // innerText ปลอดภัยจาก XSS
    document.getElementById('viewColDesc').innerText = colData.description;
    const container = document.getElementById('viewColPlacesContainer');
    container.innerHTML = '<p style="text-align:center;">กำลังโหลดข้อมูลร้าน...</p>';
    viewCollectionModal.style.display = "block";
    
    if(!colData.places || colData.places.length === 0) return container.innerHTML = '<p>ไม่มีร้านในคอลเล็กชันนี้</p>';

    container.innerHTML = '';
    for (const restId of colData.places) {
        try {
            const restSnap = await getDoc(doc(db, "restaurants", restId));
            if (restSnap.exists()) {
                const place = restSnap.data();
                const safeName = escapeHTML(place.name);
                const safeProv = escapeHTML(place.province);
                const card = document.createElement('div');
                card.className = 'restaurant-card'; card.style.display = "flex"; card.style.gap = "15px"; card.style.padding = "10px";
                card.onclick = () => { window.location.href = `detail.html?id=${restId}`; };
                card.innerHTML = `
                    <img src="${place.img}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px;">
                    <div><h4 style="color:#6f4e37;">${safeName}</h4><p style="font-size:0.85rem; color:#8c8c8c;">${safeProv}</p></div>`;
                container.appendChild(card);
            }
        } catch(e) {}
    }
}

window.onclick = (e) => { 
    if (e.target == editProfileModal) editProfileModal.style.display = "none"; 
    if (e.target == createCollectionModal) createCollectionModal.style.display = "none";
    if (e.target == viewCollectionModal) viewCollectionModal.style.display = "none";
};

// 🌟 ป้องกัน XSS ในประวัติการรีวิว
async function loadUserReviews(targetUid, targetName) {
    const container = document.getElementById('userReviewsContainer');
    try {
        const qName = query(collection(db, "reviews"), where("name", "==", targetName));
        const snapName = await getDocs(qName);
        
        let allDocsMap = new Map();
        snapName.forEach(doc => allDocsMap.set(doc.id, doc));

        if (targetUid) {
            const qUid = query(collection(db, "reviews"), where("authorUid", "==", targetUid));
            const snapUid = await getDocs(qUid);
            snapUid.forEach(doc => allDocsMap.set(doc.id, doc));
        }

        const allDocs = Array.from(allDocsMap.values());
        
        document.getElementById('statReviews').innerText = allDocs.length.toLocaleString();
        const sideStatRev = document.getElementById('sideStatReviews');
        if (sideStatRev) sideStatRev.innerText = allDocs.length.toLocaleString(); 
        
        let totalLikes = 0;

        if (allDocs.length === 0) { 
            container.innerHTML = '<p style="text-align:center; padding:20px;">ยังไม่มีประวัติการรีวิว</p>'; 
            const sideStatLike = document.getElementById('sideStatLikes');
            if (sideStatLike) sideStatLike.innerText = "0";
            return; 
        }
        
        container.innerHTML = '';
        for (const reviewDoc of allDocs) {
            const rev = reviewDoc.data();
            let starsHtml = '★'.repeat(rev.rating) + '☆'.repeat(5 - rev.rating);
            
            if (rev.likes && Array.isArray(rev.likes)) { totalLikes += rev.likes.length; } 
            else if (rev.likeCount) { totalLikes += rev.likeCount; }

            let restName = "ร้านอาหารไม่ระบุ"; let restImg = "https://via.placeholder.com/150";
            if (rev.restId) {
                const restSnap = await getDoc(doc(db, "restaurants", rev.restId));
                if (restSnap.exists()) { restName = restSnap.data().name; restImg = restSnap.data().img; }
            }
            
            // ใช้ฟังก์ชัน escapeHTML ป้องกันสคริปต์แฮ็ก
            const safeRestName = escapeHTML(restName);
            const safeRevText = escapeHTML(rev.text);

            const card = document.createElement('div'); card.className = 'review-history-card';
            card.innerHTML = `
                <img src="${restImg}" class="history-rest-img">
                <div class="history-details">
                    <a href="detail.html?id=${rev.restId}" class="history-rest-name">${safeRestName}</a>
                    <div style="margin-top: 5px;">
                        <span class="history-rating">${starsHtml}</span>
                        <span style="font-size: 0.9rem; color: #8c8c8c; margin-left: 10px;">เมื่อ ${new Date(rev.date).toLocaleDateString('th-TH')}</span>
                    </div>
                    <p class="history-text">"${safeRevText}"</p>
                </div>`;
            container.appendChild(card);
        }

        const sideStatLike = document.getElementById('sideStatLikes');
        if (sideStatLike) sideStatLike.innerText = totalLikes.toLocaleString();

    } catch (e) { container.innerHTML = '<p>ไม่สามารถโหลดข้อมูลได้</p>'; }
}

async function loadBookmarks(bookmarkIds) {
    const container = document.getElementById('userBookmarksContainer');
    if (!bookmarkIds || bookmarkIds.length === 0) { container.innerHTML = '<p style="text-align:center; padding:20px;">ยังไม่มีร้านโปรด</p>'; return; }
    container.innerHTML = '';
    for (const restId of bookmarkIds) {
        try {
            const restSnap = await getDoc(doc(db, "restaurants", restId));
            if (restSnap.exists()) {
                const place = restSnap.data();
                let cleanRating = (place.rating || "★ 5.0").replace('⭐', '★');
                const safeName = escapeHTML(place.name);
                const safeLocation = escapeHTML(place.location);

                const card = document.createElement('div'); 
                card.className = 'restaurant-card'; 
                card.style.marginBottom = "15px";
                card.onclick = () => { window.location.href = `detail.html?id=${restId}`; };
                
                card.innerHTML = `
                    <div class="card-images" style="height: 150px; overflow: hidden; border-radius: 12px 12px 0 0;">
                        <img src="${place.img}" class="main-img" alt="${safeName}" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                    <div class="card-details" style="padding: 15px;">
                        <h2 class="rest-name" style="font-size: 1.2rem; margin-bottom: 5px;">${safeName}</h2>
                        <div class="rest-meta" style="margin-bottom: 8px;"><span class="rating">${cleanRating}</span></div>
                        <p class="rest-desc" style="display: flex; align-items: flex-start; gap: 6px; font-size: 0.85rem; margin-bottom: 0;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8c8c8c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-top: 3px; flex-shrink: 0;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg> 
                            ${safeLocation}
                        </p>
                    </div>`;
                container.appendChild(card);
            }
        } catch(e) {}
    }
}

// 🌟 ป้องกัน XSS ในหน้าคอลเล็กชัน
async function loadCollections(ownerUid) {
    const container = document.getElementById('userCollectionsContainer');
    try {
        const q = query(collection(db, "collections"), where("ownerUid", "==", ownerUid));
        const querySnapshot = await getDocs(q);
        const sideStatCol = document.getElementById('sideStatCollections');
        if (sideStatCol) sideStatCol.innerText = querySnapshot.docs.length.toLocaleString(); 
        
        if (querySnapshot.empty) { container.innerHTML = '<p style="text-align:center; width:100%; padding:20px;">ยังไม่มีคอลเล็กชัน</p>'; return; }
        container.innerHTML = '';
        querySnapshot.forEach((doc) => {
            const colData = doc.data();
            const safeTitle = escapeHTML(colData.title);
            const safeDesc = escapeHTML(colData.description);
            const card = document.createElement('div'); card.className = 'collection-card'; card.onclick = () => openViewCollectionModal(colData); 
            card.innerHTML = `<div class="collection-title">${safeTitle}</div><div class="collection-desc">${safeDesc}</div><div class="collection-meta">รวม ${colData.places.length} ร้าน</div>`;
            container.appendChild(card);
        });
    } catch(e) { container.innerHTML = '<p>เกิดข้อผิดพลาด</p>'; }
}

// 🌟 ป้องกัน XSS ในประวัติการตั้งกระทู้และตอบกลับ
async function loadCommunityActivity(uidToLoad) {
    const threadsContainer = document.getElementById('myThreadsList');
    const repliesContainer = document.getElementById('myRepliesList');
    if (!threadsContainer || !repliesContainer) return;
    try {
        const snap = await getDocs(query(collection(db, "threads"), orderBy("createdAt", "desc")));
        let myThreadsHtml = ''; let myRepliesHtml = '';
        snap.forEach(doc => {
            const data = doc.data();
            const safeTag = escapeHTML(data.tag);
            const safeTitle = escapeHTML(data.title);

            if (data.authorUid === uidToLoad) {
                myThreadsHtml += `<div class="review-history-card" style="margin-bottom:10px;"><h4 style="color:#6f4e37;">#${safeTag} ${safeTitle}</h4></div>`;
            }
            if (data.replies) {
                data.replies.filter(r => r.authorUid === uidToLoad).forEach(reply => {
                    const safeReplyContent = escapeHTML(reply.content);
                    myRepliesHtml += `<div class="review-history-card" style="margin-bottom:10px;"><p>"${safeReplyContent}" ในหัวข้อ: ${safeTitle}</p></div>`;
                });
            }
        });
        threadsContainer.innerHTML = myThreadsHtml || '<p>ยังไม่มีกระทู้</p>';
        repliesContainer.innerHTML = myRepliesHtml || '<p>ยังไม่มีการตอบกลับ</p>';
    } catch (e) { }
}

document.getElementById('logoutBtn').addEventListener('click', () => { signOut(auth).then(() => { window.location.href = "index.html"; }); });
// ==========================================
// 🌟 แจ้งเตือนข้อความ & ระบบแชร์โปรไฟล์
// ==========================================

// 1. ปุ่มซองจดหมาย (ใช้ ID: messageBtn ตามใน HTML)
const messageBtn = document.getElementById('messageBtn');
if (messageBtn) {
    messageBtn.addEventListener('click', () => {
        showToast("🛠️ ระบบแชทส่วนตัวกำลังอยู่ในระหว่างการพัฒนาครับ");
    });
}

// 2. ปุ่มแชร์โปรไฟล์ (ใช้ ID: moreBtn ตามใน HTML)
const moreBtn = document.getElementById('moreBtn');
if (moreBtn) {
    moreBtn.addEventListener('click', async () => {
        // ดึงชื่อโปรไฟล์จาก id mainProfileName
        const profileName = document.getElementById('mainProfileName').innerText;
        
        const shareData = {
            title: `โปรไฟล์นักชิมของ ${profileName} - Foodie Station`,
            text: `แวะมาดูลายแทงร้านเด็ดและฉายาสุดเท่ของ ${profileName} ได้ที่ Foodie Station นะ!`,
            url: window.location.href // ลิงก์หน้าโปรไฟล์ปัจจุบัน
        };

        try {
            // เช็คว่ามือถือหรือเบราว์เซอร์รองรับการแชร์ไหม
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                // ถ้าใช้บนคอมพิวเตอร์ ให้คัดลอกลิงก์แทน
                await navigator.clipboard.writeText(window.location.href);
                showToast("📋 คัดลอกลิงก์โปรไฟล์เรียบร้อย! นำไปส่งให้เพื่อนได้เลย");
            }
        } catch (err) {
            console.log("ยกเลิกการแชร์", err);
        }
    });
}