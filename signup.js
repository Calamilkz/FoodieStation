import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 🌟 ใช้ Config ของ Foodie Station
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

const userEmail = sessionStorage.getItem('signupEmail');

if (!userEmail) {
    window.location.href = 'index.html';
}

document.getElementById('displayUserEmail').innerText = userEmail;

const signupPasswordInput = document.getElementById('signupPassword');
const signupSubmitBtn = document.getElementById('signupSubmitBtn');
const messageContainer = document.getElementById('messageContainer');
const messageEl = document.getElementById('message');

const ruleLength = document.getElementById('rule-length');
const ruleChar = document.getElementById('rule-char');
const ruleNum = document.getElementById('rule-num');

function showMessage(text, type) {
    messageEl.innerText = text;
    messageContainer.className = `message-container show ${type}`;
    if (type === 'error') setTimeout(() => { messageContainer.classList.remove('show'); }, 5000);
}

let isPasswordValid = false;
signupPasswordInput.addEventListener('input', (e) => {
    const pwd = e.target.value;
    const isLengthValid = pwd.length >= 8;
    updateRuleUI(ruleLength, isLengthValid, 'ความยาวอย่างน้อย 8 ตัวอักษร');
    const hasCharOrSymbol = /[^\d]/.test(pwd); 
    updateRuleUI(ruleChar, hasCharOrSymbol, 'ตัวอักษร หรือสัญลักษณ์');
    const hasNum = /\d/.test(pwd);
    updateRuleUI(ruleNum, hasNum, 'ตัวเลข');

    if (isLengthValid && hasCharOrSymbol && hasNum) {
        isPasswordValid = true;
        signupSubmitBtn.disabled = false;
    } else {
        isPasswordValid = false;
        signupSubmitBtn.disabled = true;
    }
});

function updateRuleUI(element, isValid, text) {
    if (isValid) {
        element.className = 'valid';
        element.innerText = '✔ ' + text;
    } else {
        element.className = 'invalid';
        element.innerText = '✖ ' + text;
    }
}

signupSubmitBtn.addEventListener('click', () => {
    if (!isPasswordValid) return;

    const password = signupPasswordInput.value;
    signupSubmitBtn.innerText = 'กำลังสร้างบัญชี...';
    signupSubmitBtn.disabled = true;

    createUserWithEmailAndPassword(auth, userEmail, password)
        .then(async (userCredential) => {
            // 🌟 สร้างโปรไฟล์และแจก 100 แต้ม
            const user = userCredential.user;
            await setDoc(doc(db, "users", user.uid), {
                email: userEmail,
                name: "นักชิมหน้าใหม่",
                points: 100
            });

            showMessage('สมัครสมาชิกสำเร็จ! กำลังพาคุณกลับไปหน้าเข้าสู่ระบบ...', 'success');
            sessionStorage.removeItem('signupEmail'); 
            
            setTimeout(() => {
                window.location.href = 'index.html'; 
            }, 2500);
        })
        .catch((error) => {
            signupSubmitBtn.innerText = 'สมัครสมาชิก';
            signupSubmitBtn.disabled = false;
            if (error.code === 'auth/email-already-in-use') {
                showMessage('อีเมลนี้ถูกใช้งานไปแล้ว', 'error');
            } else {
                showMessage('เกิดข้อผิดพลาด: ' + error.message, 'error');
            }
        });
});