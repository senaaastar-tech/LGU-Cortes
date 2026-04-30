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

// REQUIREMENTS DATABASE
const serviceDatabase = {
    "birth_cert": {
        office: "Local Civil Registrar Office (LCRO)",
        reqs: ["Photocopy of Civil Registry Document", "Original Valid ID of Owner", "SPA if representative"]
    },
    "marriage_license": {
        office: "Local Civil Registrar Office (LCRO)",
        reqs: ["CENOMAR-PSA", "Birth Certificate (PSA Copy)", "Pre-Marriage Counseling Cert"]
    },
    "correction_error": {
        office: "Local Civil Registrar Office (LCRO)",
        reqs: ["PSA & LCRO Birth Certificate", "Baptismal Certificate", "School Record", "2 Valid IDs"]
    },
    "change_name": {
        office: "Local Civil Registrar Office (LCRO)",
        reqs: ["PSA Birth Certificate", "NBI, Police & Barangay Clearance", "Newspaper Publication", "Filing Fee: P3,000"]
    },
    "business_counseling": {
        office: "DTI / Negosyo Center",
        reqs: ["Filled-up Business Counseling Form", "Owner's Valid ID"]
    }
};

// --- AUTH LOGIC ---
window.toggleAuthMode = () => {
    isSignupMode = !isSignupMode;
    document.getElementById('authTitle').innerText = isSignupMode ? "Create Citizen Account" : "Citizen Login";
    document.getElementById('mainAuthBtn').innerText = isSignupMode ? "SIGN UP" : "LOGIN";
    document.getElementById('toggleText').innerText = isSignupMode ? "Already have an account?" : "New to the portal?";
    document.getElementById('toggleBtn').innerText = isSignupMode ? "Login" : "Create Account";
};

window.togglePasswordVisibility = () => {
    const passInput = document.getElementById('authPass');
    const toggle = document.getElementById('showPassToggle');
    if (passInput) passInput.type = toggle.checked ? "text" : "password";
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

// --- CITIZEN PORTAL ---
window.updateRequirements = () => {
    const select = document.getElementById('serviceType');
    const box = document.getElementById('requirementBox');
    const officeLabel = document.getElementById('targetOffice');
    const list = document.getElementById('reqList');
    const selectedValue = select.value;

    if (serviceDatabase[selectedValue]) {
        box.classList.remove('hidden');
        officeLabel.innerText = serviceDatabase[selectedValue].office;
        list.innerHTML = "";
        serviceDatabase[selectedValue].reqs.forEach(req => {
            const li = document.createElement('li');
            li.innerText = req;
            list.appendChild(li);
        });
    } else { box.classList.add('hidden'); }
};

window.submitRequest = async () => {
    const name = document.getElementById('citizenFullName').value;
    const contact = document.getElementById('citizenContact').value;
    const service = document.getElementById('serviceType').value;
    if(!name || !contact || !service) return alert("Fill all details");
    
    const targetOffice = serviceDatabase[service] ? serviceDatabase[service].office : "LCRO";

    try {
        await addDoc(collection(db, "lgu_requests"), {
            uid: auth.currentUser.uid,
            email: auth.currentUser.email,
            fullName: name,
            contact: contact,
            service: service,
            targetOffice: targetOffice,
            status: "Pending",
            timestamp: Date.now()
        });
        alert("Appointment Submitted!");
        document.getElementById('citizenFullName').value = "";
        document.getElementById('citizenContact').value = "";
        document.getElementById('requirementBox').classList.add('hidden');
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
                <div class="bg-white p-4 border border-slate-100 rounded-xl shadow-sm flex flex-col gap-1">
                    <div class="flex justify-between items-center">
                        <span class="text-xs font-black text-slate-800 uppercase">${data.service.replace('_',' ')}</span>
                        <span class="${color} text-[8px] font-black px-2 py-1 rounded uppercase">${data.status}</span>
                    </div>
                    <p class="text-[9px] text-slate-400 italic">${data.targetOffice}</p>
                    ${data.schedule ? `<p class="text-[9px] text-blue-600 font-bold bg-blue-50 p-2 mt-1 rounded">SCHEDULE: ${data.schedule}</p>` : ''}
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
    if(confirm("Delete record?")) await deleteDoc(doc(db, "lgu_requests", id));
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
                message: "Please visit LGU Cortes on your scheduled time."
            });
            await updateDoc(doc(db, "lgu_requests", currentDocId), { 
                status: "Approved", 
                schedule: `${date} @ ${time}` 
            });
            alert("Sent!");
            closeModal();
        } catch (e) { alert("Error: " + e); }
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
                <div class="bg-slate-900 p-6 rounded-3xl border border-slate-800 flex flex-col gap-4">
                    <div>
                        <span class="text-[8px] font-black px-2 py-1 bg-blue-500/20 text-blue-400 rounded uppercase">${data.targetOffice}</span>
                        <h4 class="text-lg font-black text-white mt-2 uppercase">${data.fullName}</h4>
                        <p class="text-[10px] text-slate-400">${data.email}</p>
                        <p class="text-[10px] text-slate-400 mt-2 font-bold uppercase">Service: <span class="text-white">${data.service.replace('_',' ')}</span></p>
                    </div>
                    <div class="flex flex-col gap-2 pt-4 border-t border-slate-800">
                        <button onclick="openScheduleModal('${d.id}', '${data.email}')" class="w-full bg-blue-600 p-3 rounded-xl font-black text-[9px] uppercase">SET SCHED</button>
                        <button onclick="updateStatus('${d.id}', 'Completed')" class="w-full bg-green-700 p-3 rounded-xl font-black text-[9px] uppercase">DONE</button>
                        <button onclick="deleteRequest('${d.id}')" class="text-red-500 text-[9px] font-black uppercase mt-2">Delete Record</button>
                    </div>
                </div>`;
        });
    });
};
