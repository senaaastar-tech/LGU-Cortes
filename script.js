import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, updateDoc, doc, query, where, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// Professional animated alert/toast effect (keeps the existing alert messages and behavior).
window.showAlert = (message, type = "info") => {
    let host = document.getElementById("alertHost");
    if (!host) {
        host = document.createElement("div");
        host.id = "alertHost";
        host.className = "fixed top-5 right-5 z-[9999] w-[min(92vw,380px)] space-y-3 pointer-events-none";
        document.body.appendChild(host);
    }
    const toast = document.createElement("div");
    const tone = type === "error" ? "border-red-200 bg-white" : type === "success" ? "border-emerald-200 bg-white" : "border-blue-200 bg-white";
    const icon = type === "error" ? "!" : type === "success" ? "✓" : "i";
    toast.className = `pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border ${tone} shadow-2xl translate-x-8 opacity-0 transition-all duration-300 ease-out`;
    toast.innerHTML = `<span class="w-8 h-8 shrink-0 rounded-xl grid place-items-center font-black text-white ${type === "error" ? "bg-red-500" : type === "success" ? "bg-emerald-500" : "bg-blue-600"}">${icon}</span><div class="min-w-0"><p class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">${type === "error" ? "Error" : type === "success" ? "Success" : "Notice"}</p><p class="text-sm font-semibold text-slate-700 leading-5 break-words"></p></div><button class="ml-auto text-slate-400 hover:text-slate-700 text-lg leading-none">×</button>`;
    toast.querySelector("p:last-of-type").textContent = String(message);
    const remove = () => {
        toast.classList.add("translate-x-8", "opacity-0");
        setTimeout(() => toast.remove(), 300);
    };
    toast.querySelector("button").onclick = remove;
    host.appendChild(toast);
    requestAnimationFrame(() => toast.classList.remove("translate-x-8", "opacity-0"));
    setTimeout(remove, 4200);
};
window.alert = (message) => window.showAlert(message, /error|denied|failed|incorrect|fill|upload/i.test(String(message)) ? "error" : /success|sent|completed|cancelled|successfully/i.test(String(message)) ? "success" : "info");

(function(){
    emailjs.init("1HAeeqqDwsp3c4l81");
})();

let isSignupMode = false;
let currentDocId = "";
let currentCitizenEmail = "";

const serviceRequirements = {
    "Issuance of Location / Zoning Clearance": "Barangay Clearance, Land Title / Deed of Sale, Tax Declaration, Site Development Plan / Blueprint.",
    "Issuance of Zoning Certification": "Tax Declaration, Transfer Certificate of Title (TCT), Barangay Certification.",
    "Issuance of Business Permit (New and Renewal)": "DTI/SEC Registration, Barangay Business Clearance, Locational Clearance, Fire Safety Inspection Certificate, Sanitary Permit, Financial Statement / Gross Sales Proof.",
    "Issuance of Official Receipts on Business Licenses": "Approved Business Permit Application form, Assessment from BPLO.",
    "Issuance of Community Tax Receipt (CEDULA)": "Valid ID, Proof of Income or previous Cedula.",
    "Issuance of Official Receipts on Real Property Taxes": "Latest Tax Declaration, Previous Official Receipt / Real Property Tax Clearance.",
    "Issuance of Certification as to Tax Payments or Tax Clearance": "Latest Real Property Tax Receipt / Official Receipt.",
    "Issuance of Official Receipt for Water Bill Payment": "Water Billing Statement or Account Number.",
    "Issuance of Mayor's Certification / Clearance": "Barangay Clearance, Valid ID, Cedula.",
    "Issuance of Service Record": "Request Form, Valid ID / Employee clearance.",
    "Issuance of Certificate of Employment": "Request Form, Clearance or ID.",
    "Issuance of Leave Credits": "Leave Application form or tracking record.",
    "Emergency Assistance": "Barangay Certificate of Indigency, Medical Certificate / Abstract (if medical), Valid ID, Police/Fire blotter (if calamity).",
    "Assistance for Elderly Persons": "Senior Citizen ID, Birth Certificate / Valid ID.",
    "Handling and Treatment of Children in Conflict with the Law": "Referral letter, Intake sheet, Social Case Study Report.",
    "Program for Differently Abled Persons / PWD": "PWD ID application form, Medical Certificate indicating disability, Barangay Certificate.",
    "Monitoring of Day Care Center and Programs": "Center profile, accomplishment reports.",
    "Anti-Violence Against Women & Their Children Act": "Barangay Protection Order (BPO) or blotter, Medical Certificate (if injured), Narrative statement.",
    "Certification on Obligation Requests": "Obligation Request and Status (OBR) form, supporting disbursements.",
    "Preliminary Review of Barangay Budgets": "Barangay Appropriation Ordinance, Annual Budget Proposal, Barangay Resolution.",
    "Issuance of Transcriptions / Certifications of Civil Registry Documents": "Valid ID of requester, Proof of relationship to document owner.",
    "Registration of Civil Registry Documents": "Medical Certificate / Hospital record, Affidavit of delayed registration (if applicable).",
    "Registration of an Application for Marriage License": "Certificate of No Marriage (CENOMAR), Birth Certificates, Pre-Marriage Counseling Certificate, Barangay Clearance.",
    "Legitimation and Endorsement to PSA": "Joint Affidavit of Legitimation, Affidavit of Acknowledgement, Parents' Marriage Certificate, Child's Birth Certificate.",
    "Registration of Certificate of Live Birth under RA 9255": "Affidavit of Admission of Paternity, Affidavit to Use the Surname of the Father (AUSF), Live Birth Certificate.",
    "Petitions under RA 9048 / RA 10172": "Petition form, Baptismal certificate, School records, Employment records, Barangay certification.",
    "Livestock and Animal Treatment": "Request letter from livestock owner, Barangay certification of animal ownership.",
    "Registration / Accreditation of PO’s to DOLE": "Constitution and By-Laws, List of Officers and Members, Minutes of meetings.",
    "Processing Fishing Permit": "Barangay Certification, Boat Registration (if applicable), Valid ID.",
    "Releasing / Distribution of Agricultural Farm Interventions": "Farmers Association membership proof, ID, Request letter.",
    "Issuance of Certificate of Incumbency for Local Officials": "Sanggunian Resolution or Oath of Office, Official appointment papers.",
    "Issuance of Certificate for Services Rendered": "Request form, Service records or appointment proof.",
    "On-line Processing of Barangay Official’s Death and Burial Assistance Claim": "Death Certificate, Barangay Certification of active service, Burial contract/receipts."
};

window.displayRequirements = () => {
    const selectedService = document.getElementById('serviceType').value;
    const reqBox = document.getElementById('reqBox');
    const reqText = document.getElementById('reqText');
    const otherPurposeBox = document.getElementById('otherPurposeBox');
    const otherPurpose = document.getElementById('otherPurpose');
    const uploadBox = document.getElementById('uploadRequirementsBox');
    const uploadLabel = document.getElementById('uploadRequirementsLabel');

    if (selectedService === '__OTHER__') {
        uploadBox?.classList.add('hidden');
        if (uploadLabel) uploadLabel.innerText = 'No document upload required for Other / General Appointment';
        otherPurposeBox?.classList.remove('hidden');
        otherPurpose?.setAttribute('required', 'required');
        reqBox?.classList.add('hidden');
        return;
    }

    otherPurposeBox?.classList.add('hidden');
    otherPurpose?.removeAttribute('required');
    uploadBox?.classList.remove('hidden');
    if (uploadLabel) uploadLabel.innerText = 'Upload Requirements (PDF/Image - Can upload multiple files)';

    if (serviceRequirements[selectedService]) {
        reqText.innerText = serviceRequirements[selectedService];
        reqBox.classList.remove('hidden');
    } else {
        reqBox.classList.add('hidden');
    }
};


window.openPortal = () => {
    document.getElementById('landingPage')?.classList.add('hidden');
    document.getElementById('faq')?.classList.add('hidden');
    document.getElementById('landingFooter')?.classList.add('hidden');
    document.getElementById('portalPage')?.classList.remove('hidden');
    window.scrollTo({top:0, behavior:'smooth'});
};

window.closePortal = () => {
    if (auth.currentUser) return;
    document.getElementById('portalPage')?.classList.add('hidden');
    document.getElementById('landingPage')?.classList.remove('hidden');
    document.getElementById('faq')?.classList.remove('hidden');
    document.getElementById('landingFooter')?.classList.remove('hidden');
    window.scrollTo({top:0, behavior:'smooth'});
};

window.toggleChatbot = () => {
    const bot = document.getElementById('chatbot');
    const toggle = document.getElementById('chatToggle');
    if (!bot) return;
    bot.classList.toggle('hidden');
    if (toggle) toggle.classList.toggle('hidden', !bot.classList.contains('hidden'));
    if (!bot.classList.contains('hidden')) setTimeout(() => document.getElementById('chatInput')?.focus(), 100);
};

const botAnswers = [
  {keys:['create','account','register','sign up','signup'], answer:'To create an account, open Citizen Login, click Create Account, enter your email and password, then complete registration.'},
  {keys:['login','log in','sign in','password'], answer:'Use your registered email and password on the Citizen Login screen. If you are new, choose Create Account first.'},
  {keys:['appointment','book','apply','request','submit'], answer:'After logging in, fill in your full name and contact number, choose the required service, upload the needed documents, and click Submit Appointment.'},
  {keys:['requirement','requirements','document','documents','need'], answer:'Select a service in the appointment form to see its required documents. The exact requirements depend on the service you choose.'},
  {keys:['upload','file','pdf','image'], answer:'You can upload PDF files or images, and you can select multiple files for one request.'},
  {keys:['track','status','history','pending','approved','completed'], answer:'Log in and scroll to Request History & Status. Your submitted requests and their current status are shown there.'},
  {keys:['cancel','cancellation'], answer:'A request can be cancelled while its status is Pending. The Cancel Request button appears in your request history when available.'},
  {keys:['service','services','available'], answer:'The portal covers municipal planning, business permits, treasury, mayor’s office, HR, social welfare, budgeting, civil registry, agriculture, and DILG-related services.'},
  {keys:['hello','hi','hey','good morning','good afternoon','good evening'], answer:'Hello! 👋 I’m the Cortes Assistant. Ask me about accounts, appointments, requirements, document uploads, or request status.'}
];

window.getBotAnswer = (question) => {
    const q = question.toLowerCase().trim();
    if (!q) return 'Please type a question and I’ll try to help.';
    const match = botAnswers.find(item => item.keys.some(key => q.includes(key)));
    return match ? match.answer : 'I can help with common questions about creating an account, logging in, booking appointments, service requirements, document uploads, cancellations, and tracking request status. Try asking one of those topics.';
};

window.addBotMessage = (text, user=false) => {
    const box = document.getElementById('chatMessages');
    if (!box) return;
    const row = document.createElement('div');
    row.className = user ? 'flex justify-end' : 'flex gap-2';
    row.innerHTML = user
      ? `<div class="max-w-[85%] bg-blue-700 text-white rounded-2xl rounded-tr-sm p-3 text-xs">${escapeHtml(text)}</div>`
      : `<div class="w-7 h-7 shrink-0 rounded-full bg-blue-100 grid place-items-center text-xs">🤖</div><div class="max-w-[85%] bg-white border border-slate-200 rounded-2xl rounded-tl-sm p-3 text-xs text-slate-700">${escapeHtml(text)}</div>`;
    box.appendChild(row);
    box.scrollTop = box.scrollHeight;
};

window.escapeHtml = (value) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

window.askBot = (question) => {
    addBotMessage(question, true);
    setTimeout(() => addBotMessage(getBotAnswer(question)), 250);
};

window.sendChat = () => {
    const input = document.getElementById('chatInput');
    const question = input?.value.trim();
    if (!question) return;
    input.value = '';
    askBot(question);
};

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
    const landing = document.getElementById('landingPage');
    const portal = document.getElementById('portalPage');
    if(user && authDiv) {
        landing?.classList.add('hidden');
        document.getElementById('faq')?.classList.add('hidden');
        document.getElementById('landingFooter')?.classList.add('hidden');
        portal?.classList.remove('hidden');
        authDiv.classList.add('hidden');
        appDiv?.classList.remove('hidden');
        if(emailDisplay) emailDisplay.innerText = user.email;
        loadUserRequests(user.uid);
    } else if (authDiv) {
        authDiv.classList.remove('hidden');
        appDiv?.classList.add('hidden');
        // Keep the landing page as the default public view.
        landing?.classList.remove('hidden');
        document.getElementById('faq')?.classList.remove('hidden');
        document.getElementById('landingFooter')?.classList.remove('hidden');
        portal?.classList.add('hidden');
    }
});

window.submitRequest = async () => {
    const name = document.getElementById('citizenFullName').value;
    const contact = document.getElementById('citizenContact').value;
    const service = document.getElementById('serviceType').value;
    const otherPurpose = document.getElementById('otherPurpose')?.value.trim() || "";
    const fileInput = document.getElementById('requirementUpload').files;
    const submitBtn = document.getElementById('submitRequestBtn');
    
    if(!name || !contact || !service) return alert("Please fill all citizen details and select a service.");
    if(service === '__OTHER__' && !otherPurpose) return alert("Please specify the purpose of your appointment.");
    if(service !== '__OTHER__' && fileInput.length === 0) return alert("Please upload at least one required document.");

    const selectedOption = document.querySelector(`#serviceType option[value="${CSS.escape(service)}"]`);
    const department = service === '__OTHER__' ? "General / Other Concern" : (selectedOption ? selectedOption.parentElement.label : "General");
    const serviceName = service === '__OTHER__' ? "Others / Other Appointment" : service;

    try {
        submitBtn.disabled = true;

        let uploadedUrls = [];

        if (service !== '__OTHER__') {
            submitBtn.innerText = "UPLOADING DOCUMENTS...";

            for (let i = 0; i < fileInput.length; i++) {
            const formData = new FormData();
            formData.append("file", fileInput[i]);
            formData.append("upload_preset", "lgu_documents");

            const res = await fetch("https://api.cloudinary.com/v1_1/pegozmkv/auto/upload", {
                method: "POST",
                body: formData
            });
            const data = await res.json();
                if (data.secure_url) {
                    uploadedUrls.push(data.secure_url);
                }
            }

            if(uploadedUrls.length === 0) throw new Error("Document upload failed.");
        }

        submitBtn.innerText = "SAVING REQUEST...";

        await addDoc(collection(db, "lgu_requests"), {
            uid: auth.currentUser.uid,
            email: auth.currentUser.email,
            fullName: name,
            contact: contact,
            service: serviceName,
            purpose: service === '__OTHER__' ? otherPurpose : "",
            department: department,
            documentUrls: uploadedUrls,
            status: "Pending",
            timestamp: Date.now()
        });

        alert("Appointment and Documents Submitted Successfully!");
        
        document.getElementById('citizenFullName').value = "";
        document.getElementById('citizenContact').value = "";
        document.getElementById('serviceType').value = "";
        if(document.getElementById('otherPurpose')) document.getElementById('otherPurpose').value = "";
        document.getElementById('otherPurposeBox')?.classList.add('hidden');
        document.getElementById('requirementUpload').value = "";
        document.getElementById('reqBox').classList.add('hidden');
        
    } catch (e) { 
        alert(e.message); 
    } finally {
        submitBtn.innerText = "SUBMIT APPOINTMENT";
        submitBtn.disabled = false;
    }
};

function loadUserRequests(uid) {
    const div = document.getElementById('userStatus');
    if(!div) return;
    const q = query(collection(db, "lgu_requests"), where("uid", "==", uid));
    onSnapshot(q, (snap) => {
        div.innerHTML = "";
        let requests = [];
        snap.forEach(d => {
            requests.push({ id: d.id, ...d.data() });
        });
        requests.sort((a, b) => b.timestamp - a.timestamp);

        if(requests.length === 0) {
            div.innerHTML = `<p class="text-slate-400 text-xs italic text-center py-4">No appointment requests found.</p>`;
            return;
        }

        requests.forEach(data => {
            const color = data.status === 'Approved' ? 'bg-green-100 text-green-700' : (data.status === 'Completed' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700');
            
            let docsHtml = '';
            if (data.documentUrls && Array.isArray(data.documentUrls)) {
                data.documentUrls.forEach((url, index) => {
                    docsHtml += `<a href="${url}" target="_blank" class="text-[10px] text-blue-600 font-bold hover:underline block">📄 View Document ${index + 1}</a>`;
                });
            } else if (data.documentUrl) {
                docsHtml = `<a href="${data.documentUrl}" target="_blank" class="text-[10px] text-blue-600 font-bold hover:underline">View Uploaded Doc</a>`;
            }

            const cancelBtn = data.status === 'Pending' 
                ? `<button onclick="cancelMyRequest('${data.id}')" class="mt-2 text-[9px] bg-red-50 text-red-600 font-black px-3 py-1.5 rounded-lg hover:bg-red-100 transition uppercase">Cancel Request</button>` 
                : '';

            div.innerHTML += `
                <div class="bg-white p-4 border border-slate-100 rounded-xl shadow-sm flex flex-col gap-2">
                    <div class="flex justify-between items-center">
                        <span class="text-xs font-black text-slate-800 uppercase">${data.service}</span>
                        <span class="${color} text-[8px] font-black px-2 py-1 rounded uppercase tracking-tighter">${data.status}</span>
                    </div>
                    <p class="text-[9px] text-slate-500 font-bold uppercase">Office: ${data.department}</p>
                    <div class="space-y-0.5">${docsHtml}</div>
                    ${data.schedule ? `<p class="text-[9px] text-blue-600 font-bold bg-blue-50 p-2 rounded mt-1">SCHEDULE: ${data.schedule}</p>` : ''}
                    ${cancelBtn}
                </div>`;
        });
    });
}

window.cancelMyRequest = async (id) => {
    if(confirm("Do you want to cancel this appointment?")) {
        try {
            await deleteDoc(doc(db, "lgu_requests", id));
            alert("Appointment cancelled successfully");
        } catch (e) {
            alert("Error: " + e.message);
        }
    }
};

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

window.loginOfficer = async () => {
    // The Officer login uses the same visible username/password as the
    // other department logins, while Firebase provides the authenticated
    // session required to read the schedules.
    const officerEmail = "officer@lgu-cortes.local";
    const officerPassword = "officer123";

    try {
        await signInWithEmailAndPassword(auth, officerEmail, officerPassword);
        return true;
    } catch (e) {
        // If the dedicated Firebase account has not been created yet,
        // create it automatically (Email/Password auth must be enabled).
        if (e.code === "auth/user-not-found" || e.code === "auth/invalid-credential") {
            try {
                await createUserWithEmailAndPassword(auth, officerEmail, officerPassword);
                return true;
            } catch (createError) {
                const code = createError.code || "";
                if (code === "auth/email-already-in-use") {
                    await signInWithEmailAndPassword(auth, officerEmail, officerPassword);
                    return true;
                }
                throw createError;
            }
        }
        throw e;
    }
};

window.loadOfficerData = () => {
    const list = document.getElementById('adminList');
    if(!list) return;
    const q = query(collection(db, "lgu_requests"));
    onSnapshot(q, (snap) => {
        list.innerHTML = "";
        let requests = [];
        snap.forEach(d => requests.push({ id: d.id, ...d.data() }));
        requests.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        if(requests.length === 0) {
            list.innerHTML = `<p class="text-slate-500 text-xs italic col-span-3 text-center py-10">No requests or schedules found.</p>`;
            return;
        }
        requests.forEach(data => {
            const statusClass = data.status === 'Approved' ? 'text-green-400' : data.status === 'Completed' ? 'text-blue-400' : 'text-yellow-400';
            const schedule = data.schedule ? `<div class="bg-blue-900/40 p-3 rounded-xl border border-blue-800/50 mt-3"><p class="text-[9px] text-blue-400 font-black uppercase">Schedule</p><p class="text-sm text-white font-bold mt-1">${data.schedule}</p></div>` : `<div class="bg-slate-800 p-3 rounded-xl mt-3"><p class="text-[9px] text-slate-500 font-black uppercase">Schedule</p><p class="text-xs text-slate-400 font-bold mt-1">Not scheduled</p></div>`;
            list.innerHTML += `
                <div class="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
                    <div class="flex justify-between gap-4">
                        <div class="min-w-0">
                            <p class="text-[9px] font-black text-blue-500 uppercase mb-1">${data.department || 'General'}</p>
                            <h4 class="text-lg font-black text-white leading-tight uppercase">${data.fullName || 'Unnamed Citizen'}</h4>
                            <div class="space-y-1 mt-3">
                                <p class="text-[10px] text-slate-400 uppercase font-bold">Service: <span class="text-white">${data.service || '—'}</span></p>
                                ${data.purpose ? `<p class="text-[10px] text-slate-400 uppercase font-bold">Purpose: <span class="text-white">${data.purpose}</span></p>` : ''}
                                <p class="text-[10px] text-slate-400 uppercase font-bold">Username / Email: <span class="text-white">${data.email || '—'}</span></p>
                                <p class="text-[10px] text-slate-400 uppercase font-bold">Status: <span class="${statusClass}">${data.status || 'Pending'}</span></p>
                            </div>
                            ${schedule}
                        </div>
                    </div>
                </div>`;
        });
    });
};

window.loadAdminDataByDept = (deptName) => {
    const list = document.getElementById('adminList');
    if(!list) return;
    
    const q = query(
        collection(db, "lgu_requests"), 
        where("department", "==", deptName)
    );

    onSnapshot(q, (snap) => {
        list.innerHTML = "";
        let requests = [];
        snap.forEach(d => {
            requests.push({ id: d.id, ...d.data() });
        });

        requests.sort((a, b) => b.timestamp - a.timestamp);

        if(requests.length === 0) {
            list.innerHTML = `<p class="text-slate-500 text-xs italic col-span-3 text-center py-10">No requests found for this department.</p>`;
            return;
        }

        requests.forEach(data => {
            const schedInfo = data.schedule 
                ? `<div class="bg-blue-900/40 p-2 rounded-lg border border-blue-800/50 mt-2">
                     <p class="text-[9px] text-blue-400 font-black uppercase">Current Schedule:</p>
                     <p class="text-xs text-white font-bold">${data.schedule}</p>
                   </div>` 
                : '';

            let docsHtml = '';
            if (data.documentUrls && Array.isArray(data.documentUrls)) {
                data.documentUrls.forEach((url, index) => {
                    docsHtml += `<a href="${url}" target="_blank" class="text-[10px] text-blue-400 uppercase font-black hover:underline mt-1 block">📄 VIEW REQUIREMENT ${index + 1}</a>`;
                });
            } else if (data.documentUrl) {
                docsHtml = `<a href="${data.documentUrl}" target="_blank" class="text-[10px] text-blue-400 uppercase font-black hover:underline mt-1 block">📄 VIEW REQUIREMENT</a>`;
            } else {
                docsHtml = `<p class="text-[10px] text-slate-500 uppercase font-bold mt-1">NO DOC ATTACHED</p>`;
            }

            list.innerHTML += `
                <div class="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col gap-4">
                    <div class="flex justify-between items-start">
                        <div class="flex-1">
                            <p class="text-[9px] font-black text-blue-500 uppercase mb-1">CITIZEN: ${data.email}</p>
                            <h4 class="text-lg font-black text-white leading-tight mb-2 uppercase">${data.fullName}</h4>
                            <div class="space-y-1">
                                <p class="text-[10px] text-slate-400 uppercase font-bold">Contact: <span class="text-white">${data.contact}</span></p>
                                <p class="text-[10px] text-slate-400 uppercase font-bold">Service: <span class="text-white">${data.service}</span></p>
                                ${data.purpose ? `<p class="text-[10px] text-slate-400 uppercase font-bold">Purpose: <span class="text-white">${data.purpose}</span></p>` : ''}
                                <p class="text-[10px] text-slate-400 uppercase font-bold">Status: <span class="${data.status === 'Approved' ? 'text-green-400' : 'text-yellow-400'}">${data.status}</span></p>
                                <div class="mt-2">${docsHtml}</div>
                            </div>
                            ${schedInfo}
                        </div>
                        <button onclick="deleteRequest('${data.id}')" class="text-slate-600 hover:text-red-500 transition-colors p-2">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                    <div class="flex flex-col gap-2 pt-4 border-t border-slate-800">
                        <button onclick="openScheduleModal('${data.id}', '${data.email}')" class="w-full bg-blue-600 p-3 rounded-xl font-black text-[9px] uppercase hover:bg-blue-500 transition">SET / UPDATE SCHED</button>
                        <button onclick="updateStatus('${data.id}', 'Completed')" class="w-full bg-green-700 p-3 rounded-xl font-black text-[9px] uppercase hover:bg-green-600 transition">MARK AS DONE</button>
                    </div>
                </div>`;
        });
    });
};
