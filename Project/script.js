import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    getAuth, signInWithEmailAndPassword, sendPasswordResetEmail, 
    GoogleAuthProvider, FacebookAuthProvider, signInWithPopup, signInAnonymously 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ใช้ Config ของ Foodie Station
const firebaseConfig = {
  apiKey: "AIzaSyBnt-QqUiwJOOsVvNaXxlkEBjtTXG3gOhA",
  authDomain: "foodie-station-d63ae.firebaseapp.com",
  projectId: "foodie-station-d63ae",
  storageBucket: "foodie-station-d63ae.firebasestorage.app",
  messagingSenderId: "204905312487",
  appId: "1:204905312487:web:bb60e8fbae5dec0c217242"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const loginSection = document.getElementById('loginSection');
const signupSection = document.getElementById('signupSection');
const resetSection = document.getElementById('resetSection');
const messageContainer = document.getElementById('messageContainer');
const messageEl = document.getElementById('message');

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const signupEmailInput = document.getElementById('signupEmail');
const resetEmailInput = document.getElementById('resetEmail');

const googleLoginBtn = document.getElementById('googleLoginBtn');
const facebookLoginBtn = document.getElementById('facebookLoginBtn');
const guestLoginBtn = document.getElementById('guestLoginBtn'); 

function showMessage(text, type) {
    messageEl.innerText = text;
    messageContainer.className = `message-container show ${type}`;
    if (type === 'error') {
        setTimeout(() => { messageContainer.classList.remove('show'); }, 5000);
    }
}

function switchToSection(targetSection) {
    messageContainer.classList.remove('show');
    [loginSection, signupSection, resetSection].forEach(sec => sec.classList.remove('active'));
    targetSection.classList.add('active');
}

document.getElementById('showSignupLink').addEventListener('click', (e) => { e.preventDefault(); switchToSection(signupSection); });
document.getElementById('backToLoginFromSignup').addEventListener('click', (e) => { e.preventDefault(); switchToSection(loginSection); });
document.getElementById('showResetLink').addEventListener('click', (e) => { e.preventDefault(); switchToSection(resetSection); resetEmailInput.value = emailInput.value; });
document.getElementById('cancelResetBtn').addEventListener('click', (e) => { e.preventDefault(); switchToSection(loginSection); });

document.getElementById('nextToPasswordBtn').addEventListener('click', () => {
    const email = signupEmailInput.value;
    if (!email || !email.includes('@')) { return showMessage('[แจ้งเตือน] กรุณากรอกอีเมลให้ถูกต้อง', 'error'); }
    sessionStorage.setItem('signupEmail', email);
    window.location.href = 'signup.html';
});

async function checkAndCreateUserProfile(user) {
    const userRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(userRef);
    if (!docSnap.exists()) {
        await setDoc(userRef, {
            email: user.email || "",
            name: user.displayName || "นักชิมโซเชียล",
            points: 100 
        });
    }
}

document.getElementById('loginBtn').addEventListener('click', () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    if (!email || !password) return showMessage('[แจ้งเตือน] กรุณากรอกอีเมลและรหัสผ่าน', 'error');
    
    signInWithEmailAndPassword(auth, email, password)
        .then(() => {
            showMessage('[สำเร็จ] เข้าสู่ระบบสำเร็จ! กำลังพาไปหน้าหลัก...', 'success');
            // เด้งไปหน้า home.html (ตอนนี้มันรู้จักกันแล้วเพราะอยู่โฟลเดอร์เดียวกัน)
            setTimeout(() => { window.location.href = 'home.html'; }, 1500); 
        })
        .catch(() => showMessage('[ผิดพลาด] อีเมลหรือรหัสผ่านไม่ถูกต้อง', 'error'));
});

document.getElementById('resetBtn').addEventListener('click', () => {
    const email = resetEmailInput.value;
    if (!email) return showMessage('[แจ้งเตือน] กรุณากรอกอีเมลของคุณ', 'error');
    sendPasswordResetEmail(auth, email)
        .then(() => { showMessage('[สำเร็จ] ส่งลิงก์รีเซ็ตสำเร็จ! เช็กอีเมลของคุณ', 'success'); setTimeout(() => switchToSection(loginSection), 3000); })
        .catch((error) => showMessage('[ผิดพลาด] เกิดข้อผิดพลาด: ' + error.message, 'error'));
});

const googleProvider = new GoogleAuthProvider();
googleLoginBtn.addEventListener('click', () => {
    googleLoginBtn.disabled = true;
    const originalText = googleLoginBtn.innerHTML;
    googleLoginBtn.innerText = 'กำลังเชื่อมต่อ...';
    signInWithPopup(auth, googleProvider)
        .then(async (result) => { 
            await checkAndCreateUserProfile(result.user); 
            showMessage('[สำเร็จ] ยินดีต้อนรับคุณ ' + result.user.displayName, 'success'); 
            setTimeout(() => { window.location.href = 'home.html'; }, 1500); 
        })
        .catch((error) => { googleLoginBtn.disabled = false; googleLoginBtn.innerHTML = originalText; if (error.code !== 'auth/popup-closed-by-user') showMessage('[ผิดพลาด] Error: ' + error.message, 'error'); });
});

const fbProvider = new FacebookAuthProvider();
facebookLoginBtn.addEventListener('click', () => {
    facebookLoginBtn.disabled = true;
    const originalText = facebookLoginBtn.innerHTML;
    facebookLoginBtn.innerText = 'กำลังเชื่อมต่อ...';
    signInWithPopup(auth, fbProvider)
        .then(async (result) => { 
            await checkAndCreateUserProfile(result.user); 
            showMessage('[สำเร็จ] ยินดีต้อนรับคุณ ' + result.user.displayName, 'success'); 
            setTimeout(() => { window.location.href = 'home.html'; }, 1500); 
        })
        .catch((error) => { facebookLoginBtn.disabled = false; facebookLoginBtn.innerHTML = originalText; if (error.code !== 'auth/popup-closed-by-user') showMessage('[ผิดพลาด] Error: ' + error.message, 'error'); });
});

guestLoginBtn.addEventListener('click', () => {
    guestLoginBtn.disabled = true;
    const originalText = guestLoginBtn.innerHTML;
    guestLoginBtn.innerText = 'กำลังดำเนินการ...';

    signInAnonymously(auth)
        .then(() => {
            showMessage('[สำเร็จ] เข้าชมในฐานะบุคคลทั่วไปแล้ว!', 'success');
            setTimeout(() => { window.location.href = 'home.html'; }, 1500); 
        })
        .catch((error) => {
            guestLoginBtn.disabled = false;
            guestLoginBtn.innerHTML = originalText;
            showMessage('[ผิดพลาด] เกิดข้อผิดพลาด: ' + error.message, 'error');
        });
});