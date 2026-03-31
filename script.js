import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, updateDoc, doc, query, orderBy, where, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

(function(){
    emailjs.init("1HAeeqqDwsp3c4l81");
})();

let isSignupMode = false;
let currentDocId = "";
let currentCitizenEmail = "";

// --- AUTH LOGIC ---
window.toggleAuthMode = () => {
    isSignupMode = !isSignupMode;
    document.getElementById('authTitle').innerText = isSignupMode ? "Create Citizen Account" : "Citizen Login";
    document.getElementById('mainAuthBtn').innerText = isSignupMode ? "SIGN UP" : "LOGIN";
    document.getElementById('toggleText').innerText = isSignupMode ? "Already have an account?" : "New to the portal?";
    document.getElementById('toggleBtn').innerText = isSignupMode ? "Login" : "Create Account";
};

// SHOW PASSWORD LOGIC
window.togglePasswordVisibility = () => {
    const passInput = document.getElementById('authPass');
    const toggle = document.getElementById('showPassToggle');
    passInput.type = toggle.checked ? "text" : "password";
};

window.handleAuth = async () => {
    const email = document.getElementById('authEmail').value;
    const pass = document.getElementById('authPass').value;
    if(!email || !pass) return alert("Fill all fields");
    try {
        if(isSignupMode) await createUserWithEmailAndPassword(auth, email, pass);
        else await signInWithEmailAndPassword(auth, email, pass);
    } catch (e) { alert(e.message); }
};

window.logout = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
    const authDiv = document.getElementById('authSection');
    const appDiv = document.getElementById('appSection');
    const emailDisplay = document.getElementById('userDisplayEmail');
    if(user && authDiv) {
        authDiv.classList.add('hidden');
        appDiv.classList.remove('hidden');
        if(emailDisplay) emailDisplay.innerText = user.email;
        loadUserRequests(user.uid);
    } else if (authDiv) {
        authDiv.classList.remove('hidden');
        appDiv.classList.add('hidden');
    }
});

// --- CITIZEN SUBMIT ---
window.submitRequest = async () => {
    const name = document.getElementById('citizenFullName').value;
    const contact = document.getElementById('citizenContact').value;
    const service = document.getElementById('serviceType').value;
    if(!name || !contact) return alert("Please fill all citizen details");
    try {
        await addDoc(collection(db, "lgu_requests"), {
            uid: auth.currentUser.uid,
            email: auth.currentUser.email,
            fullName: name,
            contact: contact,
            service: service,
            status: "Pending",
            timestamp: Date.now()
        });
        alert("Appointment Submitted Successfully!");
        document.getElementById('citizenFullName').value = "";
        document.getElementById('citizenContact').value = "";
    } catch (e) { alert(e.message); }
};

function loadUserRequests(uid) {
    const div = document.getElementById('userStatus');
    if(!div) return;
    const q = query(collection(db, "lgu_requests"), where("uid", "==", uid), orderBy("timestamp", "desc"));
    onSnapshot(q, (snap) => {
        div.innerHTML = "";
        snap.forEach(d => {
            const data = d.data();
            const color = data.status === 'Approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700';
            div.innerHTML += `
                <div class="bg-white p-4 border border-slate-100 rounded-xl shadow-sm flex flex-col gap-2">
                    <div class="flex justify-between items-center">
                        <span class="text-xs font-black text-slate-800 uppercase">${data.service}</span>
                        <span class="${color} text-[8px] font-black px-2 py-1 rounded uppercase tracking-tighter">${data.status}</span>
                    </div>
                    ${data.schedule ? `<p class="text-[9px] text-blue-600 font-bold bg-blue-50 p-2 rounded">SCHEDULE: ${data.schedule}</p>` : ''}
                </div>`;
        });
    });
}

// --- ADMIN CONTROL ---
window.openScheduleModal = (id, email) => {
    currentDocId = id;
    currentCitizenEmail = email;
    document.getElementById('targetEmail').innerText = `EMAIL TO: ${email}`;
    document.getElementById('emailModal').classList.remove('hidden');
};

window.closeModal = () => document.getElementById('emailModal').classList.add('hidden');

window.updateStatus = async (id, status) => {
    await updateDoc(doc(db, "lgu_requests", id), { status });
};

window.deleteRequest = async (id) => {
    if(confirm("Are you sure you want to delete this record?")) {
        try {
            await deleteDoc(doc(db, "lgu_requests", id));
            alert("Record deleted.");
        } catch (e) { alert("Error deleting: " + e.message); }
    }
};

const sendBtn = document.getElementById('sendEmailBtn');
if(sendBtn) {
    sendBtn.onclick = async () => {
        const date = document.getElementById('schedDate').value;
        const time = document.getElementById('schedTime').value;
        if(!date || !time) return alert("Set schedule first!");

        try {
            await emailjs.send('service_yk1dfxf', 'template_agmhyzw', {
                to_email: currentCitizenEmail,
                appointment_date: date,
                appointment_time: time,
                message: "Please visit LGU Cortes on your scheduled date."
            });

            await updateDoc(doc(db, "lgu_requests", currentDocId), { 
                status: "Approved",
                schedule: `${date} @ ${time}`
            });

            alert("Notification Sent!");
            closeModal();
        } catch (e) { alert("Error: " + JSON.stringify(e)); }
    };
}

window.loadAdminData = () => {
    const list = document.getElementById('adminList');
    if(!list) return;
    const q = query(collection(db, "lgu_requests"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snap) => {
        list.innerHTML = "";
        snap.forEach(d => {
            const data = d.data();
            const schedInfo = data.schedule 
                ? `<div class="bg-blue-900/40 p-2 rounded-lg border border-blue-800/50 mt-2">
                     <p class="text-[9px] text-blue-400 font-black uppercase">Current Schedule:</p>
                     <p class="text-xs text-white font-bold">${data.schedule}</p>
                   </div>` 
                : '';

            list.innerHTML += `
                <div class="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col gap-4">
                    <div class="flex justify-between items-start">
                        <div class="flex-1">
                            <p class="text-[9px] font-black text-blue-500 uppercase mb-1">CITIZEN: ${data.email}</p>
                            <h4 class="text-lg font-black text-white leading-tight mb-2 uppercase">${data.fullName}</h4>
                            <div class="space-y-1">
                                <p class="text-[10px] text-slate-400 uppercase font-bold">Contact: <span class="text-white">${data.contact}</span></p>
                                <p class="text-[10px] text-slate-400 uppercase font-bold">Service: <span class="text-white">${data.service}</span></p>
                                <p class="text-[10px] text-slate-400 uppercase font-bold">Status: <span class="${data.status === 'Approved' ? 'text-green-400' : 'text-yellow-400'}">${data.status}</span></p>
                            </div>
                            ${schedInfo}
                        </div>
                        <button onclick="deleteRequest('${d.id}')" class="text-slate-600 hover:text-red-500 transition-colors p-2">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                    <div class="flex flex-col gap-2 pt-4 border-t border-slate-800">
                        <button onclick="openScheduleModal('${d.id}', '${data.email}')" class="w-full bg-blue-600 p-3 rounded-xl font-black text-[9px] uppercase hover:bg-blue-500 transition">SET / UPDATE SCHED</button>
                        <button onclick="updateStatus('${d.id}', 'Completed')" class="w-full bg-green-700 p-3 rounded-xl font-black text-[9px] uppercase hover:bg-green-600 transition">MARK AS DONE</button>
                    </div>
                </div>`;
        });
    });
};
