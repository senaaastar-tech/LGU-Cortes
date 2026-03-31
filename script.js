import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, updateDoc, doc, query, orderBy, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// CONFIG (Palitan ito!)
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

// EMAILJS (Palitan ito!)
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

// --- USER TRACKER ---
function loadUserRequests(uid) {
    const div = document.getElementById('userStatus');
    if(!div) return;
    // Note: If this fails, check browser console for the Index link
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

// SEND EMAIL & APPROVE
const sendBtn = document.getElementById('sendEmailBtn');
if(sendBtn) {
    sendBtn.onclick = async () => {
        const date = document.getElementById('schedDate').value;
        const time = document.getElementById('schedTime').value;
        if(!date || !time) return alert("Set schedule first!");

        try {
            // EmailJS
            await emailjs.send('YOUR_SERVICE_ID', 'YOUR_TEMPLATE_ID', {
                to_email: currentCitizenEmail,
                appointment_date: date,
                appointment_time: time,
                message: "Please visit LGU Cortes on your scheduled date."
            });

            // Firestore Update
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
            list.innerHTML += `
                <div class="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col gap-4">
                    <div>
                        <p class="text-[9px] font-black text-blue-500 uppercase mb-1">CITIZEN EMAIL: ${data.email}</p>
                        <h4 class="text-lg font-black text-white leading-tight mb-2 uppercase">${data.fullName}</h4>
                        <div class="space-y-1">
                            <p class="text-[10px] text-slate-400 uppercase font-bold">Contact: <span class="text-white">${data.contact}</span></p>
                            <p class="text-[10px] text-slate-400 uppercase font-bold">Service: <span class="text-white">${data.service}</span></p>
                        </div>
                    </div>
                    <div class="flex flex-col gap-2 pt-4 border-t border-slate-800">
                        <button onclick="openScheduleModal('${d.id}', '${data.email}')" class="w-full bg-blue-600 p-3 rounded-xl font-black text-[9px] uppercase hover:bg-blue-500 transition">APPROVE & SCHED</button>
                        <button onclick="updateStatus('${d.id}', 'Completed')" class="w-full bg-green-700 p-3 rounded-xl font-black text-[9px] uppercase hover:bg-green-600 transition">MARK AS DONE</button>
                    </div>
                </div>`;
        });
    });
};
