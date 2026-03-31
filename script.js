import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, updateDoc, doc, query, orderBy, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAp1YJkWIUYzWdxTV_awoeOIzfghGkGPCU",
  authDomain: "lgu-cortes.firebaseapp.com",
  projectId: "lgu-cortes",
  storageBucket: "lgu-cortes.firebasestorage.app",
  messagingSenderId: "603868399677",
  appId: "1:603868399677:web:bc4a28aebd73cdb6318254",
  measurementId: "G-NXFJQVHV1Y"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let isSignupMode = false;

// AUTH LOGIC
window.toggleAuthMode = () => {
    isSignupMode = !isSignupMode;
    document.getElementById('authTitle').innerText = isSignupMode ? "Create Citizen Account" : "Citizen Login";
    document.getElementById('mainAuthBtn').innerText = isSignupMode ? "SIGN UP" : "LOGIN";
    document.getElementById('toggleText').innerText = isSignupMode ? "Already have an account?" : "Don't have an account?";
    document.getElementById('toggleBtn').innerText = isSignupMode ? "Login" : "Sign Up";
};

window.handleAuth = async () => {
    const email = document.getElementById('authEmail').value;
    const pass = document.getElementById('authPass').value;
    if(!email || !pass) return alert("Fill all fields");

    try {
        if(isSignupMode) {
            await createUserWithEmailAndPassword(auth, email, pass);
            alert("Account Created!");
        } else {
            await signInWithEmailAndPassword(auth, email, pass);
        }
    } catch (e) { alert(e.message); }
};

window.logout = () => signOut(auth);

// MONITOR AUTH STATE
onAuthStateChanged(auth, (user) => {
    const authDiv = document.getElementById('authSection');
    const appDiv = document.getElementById('appSection');
    if(user && authDiv) {
        authDiv.classList.add('hidden');
        appDiv.classList.remove('hidden');
        loadUserRequests(user.uid);
    } else if (authDiv) {
        authDiv.classList.remove('hidden');
        appDiv.classList.add('hidden');
    }
});

// SUBMIT REQUEST
window.submitRequest = async () => {
    const service = document.getElementById('serviceType').value;
    await addDoc(collection(db, "lgu_requests"), {
        uid: auth.currentUser.uid,
        email: auth.currentUser.email,
        service: service,
        status: "Pending",
        timestamp: Date.now()
    });
    alert("Request Sent to LGU Staff!");
};

// LOAD USER DATA (For Citizen)
function loadUserRequests(uid) {
    const q = query(collection(db, "lgu_requests"), where("uid", "==", uid), orderBy("timestamp", "desc"));
    onSnapshot(q, (snap) => {
        const div = document.getElementById('userStatus');
        div.innerHTML = "";
        snap.forEach(d => {
            const data = d.data();
            const color = data.status === 'Ready for Pickup' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700';
            div.innerHTML += `
                <div class="flex justify-between items-center bg-white p-2 border rounded shadow-sm">
                    <span class="text-[10px] font-bold text-gray-700">${data.service}</span>
                    <span class="${color} text-[8px] font-black px-2 py-0.5 rounded uppercase">${data.status}</span>
                </div>`;
        });
    });
}

// ADMIN LOGIC
window.updateStatus = async (id, status) => {
    await updateDoc(doc(db, "lgu_requests", id), { status });
};

window.loadAdminData = () => {
    const q = query(collection(db, "lgu_requests"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snap) => {
        const list = document.getElementById('adminList');
        list.innerHTML = "";
        snap.forEach(d => {
            const data = d.data();
            list.innerHTML += `
                <div class="bg-slate-800 p-5 rounded-xl border border-slate-700 flex justify-between items-center shadow-lg">
                    <div>
                        <p class="font-black text-blue-300 uppercase leading-none mb-1">${data.email}</p>
                        <p class="text-[10px] text-slate-500 font-bold uppercase mb-2">Request: ${data.service}</p>
                        <span class="text-[9px] font-black p-1 bg-slate-900 rounded text-yellow-500 tracking-tighter uppercase">STATUS: ${data.status}</span>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="updateStatus('${d.id}', 'Ready for Pickup')" class="bg-green-600 hover:bg-green-500 px-3 py-2 rounded font-black text-[9px] transition-all">READY</button>
                        <button onclick="updateStatus('${d.id}', 'Declined')" class="bg-red-700 hover:bg-red-600 px-3 py-2 rounded font-black text-[9px] transition-all">DECLINE</button>
                    </div>
                </div>`;
        });
    });
};
