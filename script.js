import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, updateDoc, doc, query, orderBy, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// FIREBASE CONFIG
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

// EMAILJS
(function(){
    emailjs.init("dtfCQm0ZvRxH4I6RW");
})();

let isSignupMode = false;

// AUTH FUNCTIONS
window.toggleAuthMode = () => {
    isSignupMode = !isSignupMode;
    const title = document.getElementById('authTitle');
    const btn = document.getElementById('mainAuthBtn');
    const toggleTxt = document.getElementById('toggleText');
    const toggleBtn = document.getElementById('toggleBtn');

    if(title) title.innerText = isSignupMode ? "Create Citizen Account" : "Citizen Login";
    if(btn) btn.innerText = isSignupMode ? "SIGN UP" : "LOGIN";
    if(toggleTxt) toggleTxt.innerText = isSignupMode ? "Already have an account?" : "Don't have an account?";
    if(toggleBtn) toggleBtn.innerText = isSignupMode ? "Login" : "Sign Up";
};

window.handleAuth = async () => {
    const email = document.getElementById('authEmail').value;
    const pass = document.getElementById('authPass').value;
    if(!email || !pass) return alert("Please fill all fields");

    try {
        if(isSignupMode) {
            await createUserWithEmailAndPassword(auth, email, pass);
            alert("Account created successfully!");
        } else {
            await signInWithEmailAndPassword(auth, email, pass);
        }
    } catch (e) {
        alert("Auth Error: " + e.message);
    }
};

window.logout = () => signOut(auth);

// AUTH STATE LISTENER
onAuthStateChanged(auth, (user) => {
    const authDiv = document.getElementById('authSection');
    const appDiv = document.getElementById('appSection');

    if(user) {
        if(authDiv) authDiv.classList.add('hidden');
        if(appDiv) appDiv.classList.remove('hidden');
        loadUserRequests(user.uid);
    } else {
        if(authDiv) authDiv.classList.remove('hidden');
        if(appDiv) appDiv.classList.add('hidden');
    }
});

// REQUEST SUBMISSION
window.submitRequest = async () => {
    const service = document.getElementById('serviceType').value;
    if(!auth.currentUser) return alert("Please login first");

    try {
        await addDoc(collection(db, "lgu_requests"), {
            uid: auth.currentUser.uid,
            email: auth.currentUser.email,
            service: service,
            status: "Pending",
            timestamp: Date.now()
        });
        alert("Request submitted to LGU Cortes!");
    } catch (e) {
        alert("Error: " + e.message);
    }
};

// USER REQUESTS LIST (Para sa index.html)
function loadUserRequests(uid) {
    const statusDiv = document.getElementById('userStatus');
    if(!statusDiv) return;

    const q = query(collection(db, "lgu_requests"), where("uid", "==", uid), orderBy("timestamp", "desc"));
    onSnapshot(q, (snap) => {
        statusDiv.innerHTML = "";
        if(snap.empty) {
            statusDiv.innerHTML = `<p class="text-[10px] text-gray-400 italic">No requests found.</p>`;
            return;
        }
        snap.forEach(d => {
            const data = d.data();
            const color = data.status === 'Approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700';
            statusDiv.innerHTML += `
                <div class="flex flex-col bg-white p-3 border rounded shadow-sm border-l-4 border-blue-500">
                    <div class="flex justify-between items-center">
                        <span class="text-[11px] font-bold text-gray-800">${data.service}</span>
                        <span class="${color} text-[8px] font-black px-2 py-0.5 rounded uppercase">${data.status}</span>
                    </div>
                    ${data.schedule ? `<p class="text-[9px] text-blue-600 font-bold mt-2 uppercase tracking-tighter">Schedule: ${data.schedule}</p>` : ''}
                </div>`;
        });
    });
}
