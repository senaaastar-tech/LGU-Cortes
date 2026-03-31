import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, updateDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
const db = getFirestore(app);

// CITIZEN: Submit
window.submitRequest = async () => {
    const name = document.getElementById('userName').value;
    const service = document.getElementById('serviceType').value;
    if(!name) return alert("Enter your name first!");

    await addDoc(collection(db, "lgu_requests"), {
        name: name,
        service: service,
        status: "Pending",
        timestamp: Date.now()
    });
    document.getElementById('userName').value = "";
    alert("Request Submitted Successfully!");
};

// ADMIN: Update Status
window.updateStatus = async (id, newStatus) => {
    await updateDoc(doc(db, "lgu_requests", id), { status: newStatus });
};

// ADMIN: Live Data Load
window.loadAdminData = () => {
    const q = query(collection(db, "lgu_requests"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snapshot) => {
        const list = document.getElementById('adminList');
        list.innerHTML = "";
        snapshot.forEach((docSnap) => {
            const d = docSnap.data();
            const statusColor = d.status === 'Ready for Pickup' ? 'text-green-400' : 'text-yellow-400';
            list.innerHTML += `
                <div class="bg-slate-900 p-5 rounded-xl border border-slate-800 flex justify-between items-center shadow-md">
                    <div>
                        <p class="font-black text-blue-300 text-lg uppercase leading-none mb-1">${d.name}</p>
                        <p class="text-xs text-slate-500 font-bold uppercase mb-2">${d.service}</p>
                        <span class="text-[10px] font-black p-1 bg-slate-800 rounded ${statusColor}">STATUS: ${d.status}</span>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="updateStatus('${docSnap.id}', 'Ready for Pickup')" class="bg-green-600 hover:bg-green-500 px-3 py-2 rounded font-bold text-[10px] transition-all">SET READY</button>
                        <button onclick="updateStatus('${docSnap.id}', 'Declined')" class="bg-red-700 hover:bg-red-600 px-3 py-2 rounded font-bold text-[10px] transition-all">DECLINE</button>
                    </div>
                </div>`;
        });
    });
};

// USER: Tracker for index.html
if(document.getElementById('userStatus')) {
    const q = query(collection(db, "lgu_requests"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snapshot) => {
        const div = document.getElementById('userStatus');
        div.innerHTML = "";
        snapshot.forEach(doc => {
            const d = doc.data();
            const badge = d.status === 'Ready for Pickup' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700';
            div.innerHTML += `
                <div class="flex justify-between items-center border-b border-gray-100 pb-1">
                    <span class="font-bold">${d.name}</span>
                    <span class="${badge} px-2 py-0.5 rounded text-[10px] font-black uppercase">${d.status}</span>
                </div>`;
        });
    });
}
