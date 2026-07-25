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

    if (serviceRequirements[selectedService]) {
        reqText.innerText = serviceRequirements[selectedService];
        reqBox.classList.remove('hidden');
    } else {
        reqBox.classList.add('hidden');
    }
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

// --- CITIZEN SUBMIT (MULTIPLE FILES HANDLER) ---
window.submitRequest = async () => {
    const name = document.getElementById('citizenFullName').value;
    const contact = document.getElementById('citizenContact').value;
    const service = document.getElementById('serviceType').value;
    const fileInput = document.getElementById('requirementUpload').files;
    const submitBtn = document.getElementById('submitRequestBtn');
    
    if(!name || !contact || !service) return alert("Please fill all citizen details and select a service.");
    if(fileInput.length === 0) return alert("Please upload at least one required document.");

    const selectedOption = document.querySelector(`#serviceType option[value="${CSS.escape(service)}"]`);
    const department = selectedOption ? selectedOption.parentElement.label : "General";

    try {
        submitBtn.innerText = "UPLOADING DOCUMENTS...";
        submitBtn.disabled = true;

        let uploadedUrls = [];

        // Loop para mai-upload isa-isa ang mga napiling files sa Cloudinary
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

        submitBtn.innerText = "SAVING REQUEST...";

        await addDoc(collection(db, "lgu_requests"), {
            uid: auth.currentUser.uid,
            email: auth.currentUser.email,
            fullName: name,
            contact: contact,
            service: service,
            department: department,
            documentUrls: uploadedUrls, // Sinave bilang array para sa multiple files
            status: "Pending",
            timestamp: Date.now()
        });

        alert("Appointment and Documents Submitted Successfully!");
        
        document.getElementById('citizenFullName').value = "";
        document.getElementById('citizenContact').value = "";
        document.getElementById('serviceType').value = "";
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
            div.innerHTML = `<p class="text-slate-400 text-xs italic text-center py-4">Wala pang nakikitang appointment request.</p>`;
            return;
        }

        requests.forEach(data => {
            const color = data.status === 'Approved' ? 'bg-green-100 text-green-700' : (data.status === 'Completed' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700');
            
            // Render multiple links kung marami ang na-upload
            let docsHtml = '';
            if (data.documentUrls && Array.isArray(data.documentUrls)) {
                data.documentUrls.forEach((url, index) => {
                    docsHtml += `<a href="${url}" target="_blank" class="text-[10px] text-blue-600 font-bold hover:underline block">📄 View Document ${index + 1}</a>`;
                });
            } else if (data.documentUrl) {
                docsHtml = `<a href="${data.documentUrl}" target="_blank" class="text-[10px] text-blue-600 font-bold hover:underline">View Uploaded Doc</a>`;
            }

            // Pwede lang i-cancel kapag Pending pa ang status
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

// Function para ma-cancel/delete ng user ang request nila
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
            list.innerHTML = `<p class="text-slate-500 text-xs italic col-span-3 text-center py-10">Wala pang nakikitang request para sa departamentong ito.</p>`;
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
