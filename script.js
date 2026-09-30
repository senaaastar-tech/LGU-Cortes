
function formatTime12Hour(time) {
  if (!time) return "";
  const m = String(time).match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return String(time);
  let hour = Number(m[1]);
  const minute = m[2];
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minute} ${suffix}`;
}

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, updateDoc, doc, query, where, deleteDoc, getDoc, getDocs, setDoc, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// Keep Firebase sessions on this browser so refreshing the page does not log users out.
setPersistence(auth, browserLocalPersistence).catch(() => {});

const MAX_APPOINTMENTS_PER_TIME = 5;
const MAX_APPOINTMENTS_PER_PERIOD = MAX_APPOINTMENTS_PER_TIME;
const OFFICE_TIME_SLOTS = [
    { value: '08:00', label: '8:00 AM', period: 'AM' },
    { value: '09:00', label: '9:00 AM', period: 'AM' },
    { value: '10:00', label: '10:00 AM', period: 'AM' },
    { value: '11:00', label: '11:00 AM', period: 'AM' },
    { value: '13:00', label: '1:00 PM', period: 'PM' },
    { value: '14:00', label: '2:00 PM', period: 'PM' },
    { value: '15:00', label: '3:00 PM', period: 'PM' },
    { value: '16:00', label: '4:00 PM', period: 'PM' },
    { value: '17:00', label: '5:00 PM', period: 'PM' }
];
function dateOnlyToIso(year, monthIndex, day) {
    return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function localTodayIso() {
    const d = new Date();
    return dateOnlyToIso(d.getFullYear(), d.getMonth(), d.getDate());
}
function isMunicipalWorkingDay(isoDate) {
    // Appointment dates are date-only values. Never parse them through local/UTC
    // midnight because that can move a Friday into Saturday in some environments.
    const m = String(isoDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return false;
    const day = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
    return day >= 1 && day <= 5;
}
function getTimeSlotByValue(value) {
    return OFFICE_TIME_SLOTS.find(x => x.value === value) || null;
}
function timeField(value) {
    return `booked_${String(value).replace(':','')}`;
}
function timeEnabledField(value) {
    return `enabled_${String(value).replace(':','')}`;
}
function getEnabledTimes(item) {
    if (!item) return [];
    // New format: individual enabled_<HHMM> booleans.
    const hasNewFields = OFFICE_TIME_SLOTS.some(slot => Object.prototype.hasOwnProperty.call(item, timeEnabledField(slot.value)));
    if (hasNewFields) return OFFICE_TIME_SLOTS.filter(slot => item[timeEnabledField(slot.value)] === true).map(slot => slot.value);
    // Backward compatibility for existing schedule documents.
    return OFFICE_TIME_SLOTS.filter(slot => slot.period === 'AM' ? item.amAvailable === true : item.pmAvailable === true).map(slot => slot.value);
}
function isTimeOpen(item, time) {
    const slot = getTimeSlotByValue(time);
    if (!item || !slot) return false;
    const hasNewFields = Object.prototype.hasOwnProperty.call(item, timeEnabledField(time));
    const enabled = hasNewFields ? item[timeEnabledField(time)] === true : (slot.period === 'AM' ? item.amAvailable === true : item.pmAvailable === true);
    const booked = Number(item[timeField(time)] || 0);
    return item.available === true && enabled && booked < MAX_APPOINTMENTS_PER_TIME;
}
function getTimeBooked(item, time) { return Number(item?.[timeField(time)] || 0); }
function allTimeFields() { return OFFICE_TIME_SLOTS.flatMap(slot => [timeEnabledField(slot.value), timeField(slot.value)]); }
let availabilityUnsubscribe = null;
let userRequestsUnsubscribe = null;
let adminAvailabilityUnsubscribe = null;
let adminRequestsUnsubscribe = null;
let adminCalendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let adminBookingCounts = {};
let adminCalendarRequests = [];
let userCalendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let userAvailability = {};


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

function isOtherService(service) {
    return typeof service === 'string' && service.startsWith('__OTHER__::');
}

function getServiceDepartment(service) {
    const selectedOption = document.querySelector(`#serviceType option[value=\"${CSS.escape(service || '')}\"]`);
    if (selectedOption?.parentElement?.label) return selectedOption.parentElement.label;
    if (isOtherService(service)) return service.substring('__OTHER__::'.length) || 'General';
    return 'General';
}

window.displayRequirements = () => {
    renderUserScheduleCalendar();
    const selectedService = document.getElementById('serviceType').value;
    const reqBox = document.getElementById('reqBox');
    const reqText = document.getElementById('reqText');
    const otherPurposeBox = document.getElementById('otherPurposeBox');
    const otherPurpose = document.getElementById('otherPurpose');
    const uploadBox = document.getElementById('uploadRequirementsBox');
    const uploadLabel = document.getElementById('uploadRequirementsLabel');

    if (isOtherService(selectedService)) {
        uploadBox?.classList.add('hidden');
        if (uploadLabel) uploadLabel.innerText = 'No document upload required for Other / Other Purpose';
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


function renderCitizenView(view, pushHistory = false) {
    const landing = document.getElementById('landingPage');
    const faq = document.getElementById('faq');
    const footer = document.getElementById('landingFooter');
    const portal = document.getElementById('portalPage');
    const authDiv = document.getElementById('authSection');
    const appDiv = document.getElementById('appSection');
    const user = auth.currentUser;

    // Authenticated users must never be sent back to the login/landing screen
    // by browser history. Their session is the source of truth.
    if (user) view = 'portal';

    if (view === 'portal') {
        landing?.classList.add('hidden');
        faq?.classList.add('hidden');
        footer?.classList.add('hidden');
        portal?.classList.remove('hidden');
        if (user) {
            authDiv?.classList.add('hidden');
            appDiv?.classList.remove('hidden');
        }
    } else {
        // Public landing view is only available while logged out.
        if (!user) {
            portal?.classList.add('hidden');
            landing?.classList.remove('hidden');
            faq?.classList.remove('hidden');
            footer?.classList.remove('hidden');
        } else {
            portal?.classList.remove('hidden');
            authDiv?.classList.add('hidden');
            appDiv?.classList.remove('hidden');
        }
    }

    if (pushHistory) {
        const nextState = { ...(history.state || {}), lguView: view };
        history.pushState(nextState, '', view === 'portal' ? '#portal' : '#home');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.openPortal = () => renderCitizenView('portal', true);

window.closePortal = () => {
    // While logged in, HOME/back must never navigate to the login dashboard.
    if (auth.currentUser) {
        renderCitizenView('portal', false);
        return;
    }
    renderCitizenView('home', true);
};

// Keep browser Back/Forward inside the citizen portal instead of reloading
// the page or exposing the login screen after authentication.
window.addEventListener('popstate', () => {
    const requested = history.state?.lguView || (location.hash === '#portal' ? 'portal' : 'home');
    renderCitizenView(requested, false);
});

// Seed one stable history entry. This prevents the first Back press after
// entering the portal from jumping directly to an old login-page state.
if (!history.state?.lguView) {
    history.replaceState({ ...(history.state || {}), lguView: 'home' }, '', location.pathname + location.search + '#home');
}

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

window.forgotPassword = async () => {
    const emailInput = document.getElementById("authEmail");
    const enteredEmail = (emailInput?.value || "").trim();
    const email = enteredEmail || window.prompt("Enter your registered email address:");
    if (!email) return;
    if (!/^\S+@\S+\.\S+$/.test(email)) return alert("Please enter a valid email address.");
    try {
        await sendPasswordResetEmail(auth, email);
        alert("Password reset email sent. Please check your email and follow the instructions to create a new password.");
    } catch (e) {
        const code = e?.code || "";
        if (code === "auth/invalid-email") return alert("Please enter a valid email address.");
        if (code === "auth/too-many-requests") return alert("Too many reset attempts. Please try again later.");
        // Keep the message generic so the login screen does not reveal whether an account exists.
        alert("If an account is registered with that email, a password reset message has been sent. Please check your inbox and spam folder.");
    }
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
        startAvailabilityListener();
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

// Allow users to remove individual files they selected by mistake before submitting.
function renderSelectedFiles() {
    const input = document.getElementById('requirementUpload');
    const list = document.getElementById('selectedFilesList');
    if (!input || !list) return;

    const files = Array.from(input.files || []);
    list.innerHTML = '';

    if (!files.length) return;

    files.forEach((file, index) => {
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200';

        const info = document.createElement('div');
        info.className = 'min-w-0 flex-1';
        const name = document.createElement('div');
        name.className = 'text-xs font-bold text-slate-700 truncate';
        name.textContent = file.name;
        const size = document.createElement('div');
        size.className = 'text-[10px] text-slate-400 mt-0.5';
        size.textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
        info.append(name, size);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'shrink-0 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-100 text-[10px] font-black hover:bg-red-100 transition';
        removeBtn.textContent = 'REMOVE';
        removeBtn.onclick = () => {
            const dt = new DataTransfer();
            files.forEach((f, i) => {
                if (i !== index) dt.items.add(f);
            });
            input.files = dt.files;
            renderSelectedFiles();
        };

        row.append(info, removeBtn);
        list.appendChild(row);
    });
}

function clearSelectedFiles() {
    const input = document.getElementById('requirementUpload');
    if (input) input.value = '';
    renderSelectedFiles();
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('requirementUpload')?.addEventListener('change', renderSelectedFiles);
});

const citizenTimeSelect = document.getElementById('citizenScheduleTime');
if (citizenTimeSelect) {
    citizenTimeSelect.addEventListener('change', () => {
        const slot = getTimeSlotByValue(citizenTimeSelect.value);
        const periodInput = document.getElementById('citizenSchedulePeriod');
        if (periodInput) periodInput.value = slot?.period || '';
    });
}

window.submitRequest = async () => {
    const name = document.getElementById('citizenFullName').value;
    const scheduleDate = document.getElementById('citizenScheduleDate')?.value || "";
    const schedulePeriod = document.getElementById('citizenSchedulePeriod')?.value || "";
    const scheduleTime = document.getElementById('citizenScheduleTime')?.value || "";
    const contact = document.getElementById('citizenContact').value;
    const service = document.getElementById('serviceType').value;
    const otherPurpose = document.getElementById('otherPurpose')?.value.trim() || "";
    const fileInput = document.getElementById('requirementUpload').files;
    const submitBtn = document.getElementById('submitRequestBtn');
    const selectedTimeSlot = getTimeSlotByValue(scheduleTime);

    if(!name || !contact || !service || !scheduleDate || !scheduleTime || !schedulePeriod) return alert("Please fill all citizen details and select an available date and time.");
    if(isOtherService(service) && !otherPurpose) return alert("Please specify the purpose of your appointment.");
    if(!isOtherService(service) && fileInput.length === 0) return alert("Please upload at least one required document.");

    const selectedOption = document.querySelector(`#serviceType option[value="${CSS.escape(service)}"]`);
    const department = getServiceDepartment(service);
    const serviceName = isOtherService(service) ? "Other / Other Purpose" : service;
    const availabilityId = makeAvailabilityId(scheduleDate, department);
    if (!isMunicipalWorkingDay(scheduleDate)) return alert("Appointments are available Monday to Friday only.");
    if (!selectedTimeSlot) return alert("Please choose a valid municipal hall appointment time.");
    if (selectedTimeSlot.period !== schedulePeriod) return alert("Please choose a valid appointment time.");

    try {
        submitBtn.disabled = true;
        const availabilitySnap = await getDoc(doc(db, 'schedule_availability', availabilityId));
        if (!availabilitySnap.exists()) throw new Error("That office has no schedule available on the selected date.");
        const availability = availabilitySnap.data();
        if (availability.available !== true || availability.department !== department || availability.date !== scheduleDate) {
            throw new Error("That date is not available for the selected office.");
        }
        if (!isTimeOpen(availability, scheduleTime)) throw new Error("That appointment time is no longer available. Please choose another available time.");

        let uploadedUrls = [];
        if (!isOtherService(service)) {
            submitBtn.innerText = "UPLOADING DOCUMENTS...";
            for (let i = 0; i < fileInput.length; i++) {
                const formData = new FormData();
                formData.append("file", fileInput[i]);
                formData.append("upload_preset", "lgu_documents");
                const res = await fetch("https://api.cloudinary.com/v1_1/pegozmkv/auto/upload", { method: "POST", body: formData });
                const data = await res.json();
                if (data.secure_url) uploadedUrls.push(data.secure_url);
            }
            if(uploadedUrls.length === 0) throw new Error("Document upload failed.");
        }

        submitBtn.innerText = "SAVING REQUEST...";
        await runTransaction(db, async (transaction) => {
            const ref = doc(db, 'schedule_availability', availabilityId);
            const fresh = await transaction.get(ref);
            if (!fresh.exists()) throw new Error("This schedule is no longer available. Please refresh and choose another slot.");
            const a = fresh.data();
            if (a.available !== true || !isTimeOpen(a, scheduleTime)) {
                throw new Error("That appointment time just became unavailable. Please choose another slot.");
            }
            const field = timeField(scheduleTime);
            const freshBooked = Number(a[field] || 0);
            transaction.update(ref, { [field]: freshBooked + 1, updatedAt: Date.now() });
            const requestRef = doc(collection(db, 'lgu_requests'));
            transaction.set(requestRef, {
                uid: auth.currentUser.uid,
                email: auth.currentUser.email,
                fullName: name,
                contact: contact,
                service: serviceName,
                purpose: isOtherService(service) ? otherPurpose : "",
                department,
                scheduleDate,
                schedulePeriod,
                scheduleTime,
                schedule: `${scheduleDate} · ${selectedTimeSlot.label}`,
                scheduleStatus: "Requested",
                documentUrls: uploadedUrls,
                status: "Pending",
                timestamp: Date.now()
            });
        });

        alert(isOtherService(service) ? "Appointment Submitted Successfully!" : "Appointment and Documents Submitted Successfully!");
        document.getElementById('citizenFullName').value = "";
        document.getElementById('citizenScheduleDate').value = "";
        document.getElementById('citizenSchedulePeriod').value = "";
        document.getElementById('citizenScheduleTime').value = "";
        document.getElementById('citizenContact').value = "";
        document.getElementById('serviceType').value = "";
        if(document.getElementById('otherPurpose')) document.getElementById('otherPurpose').value = "";
        document.getElementById('otherPurposeBox')?.classList.add('hidden');
        document.getElementById('uploadRequirementsBox')?.classList.remove('hidden');
        document.getElementById('uploadRequirementsLabel')?.replaceChildren(document.createTextNode('Upload Requirements (PDF/Image - Can upload multiple files)'));
        clearSelectedFiles();
        document.getElementById('reqBox')?.classList.add('hidden');
        renderUserScheduleCalendar();
    } catch (e) {
        alert(e.message);
    } finally {
        submitBtn.innerText = "SUBMIT APPOINTMENT";
        submitBtn.disabled = false;
    }
};

function makeAvailabilityId(date, department) {
    return `${date}__${encodeURIComponent(department)}`;
}

function getSelectedDepartment() {
    const service = document.getElementById('serviceType')?.value || '';
    if (!service) return '';
    const selectedOption = document.querySelector(`#serviceType option[value="${CSS.escape(service)}"]`);
    return getServiceDepartment(service);
}

function startAvailabilityListener() {
    const dateInput = document.getElementById('citizenScheduleDate');
    if (!dateInput) return;
    if (availabilityUnsubscribe) availabilityUnsubscribe();
    if (userRequestsUnsubscribe) userRequestsUnsubscribe();

    const today = new Date();
    const isoToday = dateOnlyToIso(today.getFullYear(), today.getMonth(), today.getDate());
    dateInput.min = isoToday;

    availabilityUnsubscribe = onSnapshot(collection(db, 'schedule_availability'), (snap) => {
        userAvailability = {};
        snap.forEach(d => { userAvailability[d.id] = d.data(); });
        renderUserScheduleCalendar();
    });
    renderUserScheduleCalendar();
}

function renderUserScheduleCalendar() {
    const host = document.getElementById('citizenScheduleCalendar');
    const note = document.getElementById('scheduleAvailabilityNote');
    const dateInput = document.getElementById('citizenScheduleDate');
    const periodInput = document.getElementById('citizenSchedulePeriod');
    const timeInput = document.getElementById('citizenScheduleTime');
    if (!host || !dateInput || !periodInput) return;

    const department = getSelectedDepartment();
    const year = userCalendarMonth.getFullYear(), month = userCalendarMonth.getMonth();
    const today = new Date();
    const todayIso = dateOnlyToIso(today.getFullYear(), today.getMonth(), today.getDate());
    const selectedDate = dateInput.value;
    const selectedTime = timeInput?.value || '';
    const first = new Date(year, month, 1), last = new Date(year, month + 1, 0);
    const startDay = first.getDay(), total = last.getDate();

    if (!department) {
        host.innerHTML = '<div class="p-5 text-center text-xs font-bold text-slate-400">Select a service first to view this office’s available dates.</div>';
        if(note) note.textContent = 'Municipal Hall: Monday–Friday, 8:00 AM–5:00 PM. Noon break: 12:00 PM–1:00 PM.';
        if(timeInput) { timeInput.innerHTML = '<option value="">Select a date first...</option>'; timeInput.disabled = true; }
        return;
    }

    let html = `<div class="flex items-center justify-between mb-3"><button type="button" onclick="changeUserCalendarMonth(-1)" class="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 font-black">‹</button><div class="text-xs font-black text-slate-700 uppercase">${userCalendarMonth.toLocaleString('en-US',{month:'long',year:'numeric'})}</div><button type="button" onclick="changeUserCalendarMonth(1)" class="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 font-black">›</button></div>`;
    html += '<p class="text-[9px] text-slate-500 font-bold mb-3">Select a date first. Only times made available by the office are selectable.</p>';
    html += '<div class="grid grid-cols-7 gap-1 text-[8px] font-black text-slate-400 uppercase mb-1">' + ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(x=>`<div class="text-center">${x}</div>`).join('') + '</div><div class="grid grid-cols-7 gap-1">';
    for(let i=0;i<startDay;i++) html += '<div></div>';
    for(let day=1; day<=total; day++) {
        const iso = dateOnlyToIso(year, month, day);
        const item = userAvailability[makeAvailabilityId(iso, department)] || {};
        const openTimes = OFFICE_TIME_SLOTS.filter(slot => isTimeOpen(item, slot.value));
        const isPast = iso < todayIso, isWeekday = isMunicipalWorkingDay(iso);
        const canPick = !isPast && isWeekday && openTimes.length > 0;
        const selected = selectedDate === iso;
        html += `<button type="button" ${canPick?'':'disabled'} onclick="selectScheduleDate('${iso}')" class="min-h-[68px] p-1.5 rounded-xl border text-left transition ${selected?'bg-blue-600 border-blue-600 text-white':canPick?'bg-white border-slate-200 hover:border-blue-400':'bg-slate-100 border-slate-200 opacity-45 cursor-not-allowed'}"><span class="text-xs font-black">${day}</span><span class="block text-[7px] mt-1 font-black">${isWeekday?(canPick?`${openTimes.length} TIME${openTimes.length===1?'':'S'} AVAILABLE`:'NO TIMES AVAILABLE'):'WEEKEND'}</span></button>`;
    }
    html += '</div>';
    host.innerHTML = html;

    if (timeInput) {
        const item = selectedDate ? (userAvailability[makeAvailabilityId(selectedDate, department)] || {}) : {};
        const options = OFFICE_TIME_SLOTS.filter(slot => isTimeOpen(item, slot.value));
        timeInput.disabled = !selectedDate || options.length === 0;
        timeInput.innerHTML = `<option value="">${selectedDate ? (options.length ? 'Select appointment time...' : 'No time available for this date') : 'Select a date first...'}</option>` + options.map(x=>`<option value="${x.value}" ${selectedTime===x.value?'selected':''}>${x.label}</option>`).join('');
        if (selectedTime && !options.some(x=>x.value===selectedTime)) timeInput.value = '';
        if (timeInput.value) periodInput.value = getTimeSlotByValue(timeInput.value)?.period || '';
    }
    if(note) note.textContent = selectedDate ? 'Choose one of the available appointment times for this date.' : 'Select an available weekday, then choose an appointment time.';
}
window.changeUserCalendarMonth = (delta) => { userCalendarMonth = new Date(userCalendarMonth.getFullYear(), userCalendarMonth.getMonth() + delta, 1); renderUserScheduleCalendar(); };
window.selectScheduleDate = (date) => {
    const department = getSelectedDepartment();
    const item = userAvailability[makeAvailabilityId(date, department)];
    if (!item || !isMunicipalWorkingDay(date)) return;
    const openTimes = OFFICE_TIME_SLOTS.filter(slot => isTimeOpen(item, slot.value));
    if (!openTimes.length) return;
    document.getElementById('citizenScheduleDate').value = date;
    document.getElementById('citizenSchedulePeriod').value = '';
    if (document.getElementById('citizenScheduleTime')) document.getElementById('citizenScheduleTime').value = '';
    renderUserScheduleCalendar();
};
window.validateScheduleDate = () => renderUserScheduleCalendar();

function format24HourTime(time) {
    if (!time) return 'TIME TBA';
    const parts = String(time).split(':');
    const h = Number(parts[0]);
    const m = parts[1] || '00';
    if (!Number.isFinite(h)) return String(time);
    return `${String(h).padStart(2,'0')}:${m}`;
}
function formatCalendarTime(time) {
    if (!time) return 'TIME TBA';
    const parts = String(time).split(':'); let h = Number(parts[0]); const m = parts[1] || '00';
    if (!Number.isFinite(h)) return String(time); const suffix = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
    return `${h}:${m} ${suffix}`;
}
function escapeCalendarText(value) {
    return String(value ?? '').replace(/[&<>\'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}
function normalizeCalendarDate(value) {
    const s = String(value ?? "").trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? s : s;
}
function normalizeCalendarDepartment(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}
function getAdminCalendarRequestsForDate(date, department) {
    const target = normalizeCalendarDepartment(department);
    return (window._adminCalendarRequests || []).filter(x => {
        if (normalizeCalendarDate(x.scheduleDate) !== normalizeCalendarDate(date) || (x.status || 'Pending') === 'Cancelled') return false;
        const stored = normalizeCalendarDepartment(x.department);
        // Match the office robustly even when capitalization/extra spaces differ.
        return stored === target;
    }).sort((a,b) => String(a.scheduleTime||'').localeCompare(String(b.scheduleTime||'')));
}
window.openCalendarAppointment = (id) => {
    const item = (window._adminCalendarRequests || []).find(x => x.id === id); if (!item) return;
    if ((item.status || 'Pending') === 'Pending') return window.openApprovalModal(item.id, item.email || '');
    if (typeof window.openRescheduleModal === 'function') return window.openRescheduleModal(item.id, item.email || '');
    alert(`Name: ${item.fullName || 'Citizen'}\nTime: ${formatCalendarTime(item.scheduleTime)}\nOffice: ${item.department || '—'}\nStatus: ${item.status || 'Pending'}`);
};

function renderAdminCalendar() {
    const host = document.getElementById('adminCalendar');
    const label = document.getElementById('adminCalendarMonth');
    if (!host) return;
    const department = document.getElementById('adminScheduleDept')?.value || '';
    const year = adminCalendarMonth.getFullYear(), month = adminCalendarMonth.getMonth();
    if (label) label.textContent = adminCalendarMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    if (!department) { host.innerHTML = '<div class="p-6 text-center text-xs font-bold text-slate-500">Select an office to manage its schedule.</div>'; renderAdminTimeEditor(); return; }
    const first = new Date(year, month, 1), last = new Date(year, month + 1, 0), start = first.getDay(), total = last.getDate();
    const today = new Date(), todayIso = dateOnlyToIso(today.getFullYear(), today.getMonth(), today.getDate());
    const availability = window._adminAvailability || {};
    let html = '<div class="grid grid-cols-7 gap-2 text-[9px] font-black text-slate-500 uppercase mb-2">' + ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(x=>`<div class="text-center">${x}</div>`).join('') + '</div><div class="grid grid-cols-7 gap-2">';
    for(let i=0;i<start;i++) html += '<div></div>';
    for(let day=1; day<=total; day++) {
        const iso = dateOnlyToIso(year, month, day);
        const item = availability[makeAvailabilityId(iso, department)] || {};
        const openTimes = OFFICE_TIME_SLOTS.filter(slot => isTimeOpen(item, slot.value));
        const dayAppointments = getAdminCalendarRequestsForDate(iso, department);
        const isPast = iso < todayIso, disabled = isPast || !isMunicipalWorkingDay(iso);
        const selected = window._adminSelectedDate === iso;
        const appointmentHtml = dayAppointments.slice(0, 4).map(appt => {
            const name = escapeCalendarText(appt.fullName || appt.name || 'Citizen');
            const time = escapeCalendarText(formatCalendarTime(appt.scheduleTime));
            const status = appt.status || 'Pending';
            const statusClass = status === 'Approved' ? 'text-emerald-300' : status === 'Rejected' ? 'text-red-300' : 'text-amber-300';
            return `<button type="button" onclick="event.stopPropagation();openCalendarAppointment('${appt.id}')" class="w-full text-left mt-1 px-1.5 py-1.5 rounded-lg bg-blue-950/80 hover:bg-slate-700 border border-blue-700/70 transition"><span class="block text-[8px] font-black text-blue-300 truncate">${time}</span><span class="block text-[9px] font-black text-white leading-tight">${name}</span><span class="block text-[7px] font-black uppercase ${statusClass}">${escapeCalendarText(status)}</span></button>`;
        }).join('');
        const moreHtml = dayAppointments.length > 4 ? `<span class="block text-[7px] mt-1 text-slate-400 font-black">+${dayAppointments.length - 4} MORE APPOINTMENT${dayAppointments.length - 4 === 1 ? '' : 'S'}</span>` : '';
        html += `<div class="min-h-[128px] p-2 rounded-xl border text-left transition ${selected?'bg-blue-600/20 border-blue-500':'bg-slate-800 border-slate-700'} ${disabled?'opacity-35':'hover:border-blue-500'}"><button type="button" ${disabled?'disabled':''} onclick="editScheduleDate('${iso}')" class="w-full text-left"><span class="text-sm font-black ${selected?'text-blue-300':'text-white'}">${day}</span><span class="block text-[8px] mt-1 font-black uppercase ${openTimes.length?'text-emerald-300':'text-slate-500'}">${openTimes.length ? `${openTimes.length} TIME${openTimes.length===1?'':'S'} OPEN` : 'CLOSED'}</span><span class="block text-[7px] mt-1 text-slate-500">${openTimes.map(x=>x.label.replace(':00','')).join(' · ') || 'Click to configure'}</span></button>${appointmentHtml}${moreHtml}</div>`;
    }
    html += '</div>';
    host.innerHTML = html;
    renderAdminTimeEditor();
}

function renderAdminTimeEditor() {
    const host = document.getElementById('adminTimeEditor');
    if (!host) return;
    const department = document.getElementById('adminScheduleDept')?.value || '';
    const date = window._adminSelectedDate || '';
    const item = department && date ? ((window._adminAvailability || {})[makeAvailabilityId(date, department)] || {}) : {};
    if (!department || !date) {
        host.innerHTML = '<div class="p-4 rounded-2xl bg-slate-800/60 border border-slate-700 text-[10px] font-bold text-slate-500">Select a weekday on the calendar to choose its individual appointment times.</div>';
        return;
    }
    const makeGroup = (period, title) => OFFICE_TIME_SLOTS.filter(x=>x.period===period).map(slot => {
        const enabled = isTimeOpenForAdmin(item, slot.value);
        const booked = getTimeBooked(item, slot.value);
        return `<label class="flex items-center justify-between gap-3 p-3 rounded-xl border ${enabled?'border-blue-500/50 bg-blue-500/10':'border-slate-700 bg-slate-800'} cursor-pointer"><span><span class="block text-xs font-black text-white">${slot.label}</span><span class="block text-[9px] text-slate-500 mt-0.5">${booked} booked</span></span><input type="checkbox" data-admin-time="${slot.value}" ${enabled?'checked':''} class="w-5 h-5 accent-blue-600"></label>`;
    }).join('');
    host.innerHTML = `<div class="mt-4 p-4 rounded-2xl bg-slate-900 border border-slate-700"><div class="flex items-center justify-between gap-3 mb-4"><div><p class="text-[9px] font-black uppercase text-blue-400">Individual Time Availability</p><p class="text-xs font-black text-white mt-1">${date}</p></div><button type="button" onclick="saveAdminTimeSlots()" class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black">SAVE TIMES</button></div><div class="grid md:grid-cols-2 gap-4"><div><p class="text-[9px] font-black text-slate-500 uppercase mb-2">AM · 8:00–11:00</p><div class="grid gap-2">${makeGroup('AM','AM')}</div></div><div><p class="text-[9px] font-black text-slate-500 uppercase mb-2">PM · 1:00–5:00</p><div class="grid gap-2">${makeGroup('PM','PM')}</div></div></div><p class="text-[9px] text-slate-500 font-bold mt-4">Each enabled time can accept up to 5 appointments. 12:00 PM is excluded for the noon break.</p></div>`;
}
function isTimeOpenForAdmin(item, time) {
    const field = timeEnabledField(time);
    if (Object.prototype.hasOwnProperty.call(item, field)) return item[field] === true;
    const slot = getTimeSlotByValue(time);
    return slot?.period === 'AM' ? item.amAvailable === true : item.pmAvailable === true;
}
window.editScheduleDate = (date) => {
    if (!isMunicipalWorkingDay(date)) return;
    window._adminSelectedDate = date;
    renderAdminCalendar();
};
window.saveAdminTimeSlots = async () => {
    const date = window._adminSelectedDate;
    const department = document.getElementById('adminScheduleDept')?.value || '';
    if (!date || !department) return alert('Select an office and weekday first.');
    const checked = Array.from(document.querySelectorAll('#adminTimeEditor input[data-admin-time]:checked')).map(x=>x.dataset.adminTime);
    const existing = (window._adminAvailability || {})[makeAvailabilityId(date, department)] || {};
    const data = { date, department, available: checked.length > 0, updatedAt: Date.now() };
    OFFICE_TIME_SLOTS.forEach(slot => {
        data[timeEnabledField(slot.value)] = checked.includes(slot.value);
        data[timeField(slot.value)] = Number(existing[timeField(slot.value)] || 0);
    });
    // Keep legacy AM/PM fields synchronized for older records/logic.
    data.amAvailable = checked.some(t => getTimeSlotByValue(t)?.period === 'AM');
    data.pmAvailable = checked.some(t => getTimeSlotByValue(t)?.period === 'PM');
    data.amBookedCount = OFFICE_TIME_SLOTS.filter(x=>x.period==='AM').reduce((n,x)=>n+Number(existing[timeField(x.value)]||0),0);
    data.pmBookedCount = OFFICE_TIME_SLOTS.filter(x=>x.period==='PM').reduce((n,x)=>n+Number(existing[timeField(x.value)]||0),0);
    try {
        await setDoc(doc(db, 'schedule_availability', makeAvailabilityId(date, department)), data, { merge: true });
        alert('Individual appointment times saved.');
        renderAdminCalendar();
    } catch(e) { alert('Unable to save time availability: ' + (e?.message || e)); }
};
window.changeAdminCalendarMonth = (delta) => { adminCalendarMonth = new Date(adminCalendarMonth.getFullYear(), adminCalendarMonth.getMonth() + delta, 1); window._adminSelectedDate = ''; renderAdminCalendar(); };
window.toggleScheduleDate = window.editScheduleDate;
window.startAdminCalendar = () => {
    const host = document.getElementById('adminCalendar');
    if (!host) return;
    adminAvailabilityUnsubscribe?.(); adminRequestsUnsubscribe?.();
    adminAvailabilityUnsubscribe = onSnapshot(collection(db, 'schedule_availability'), (snap) => {
        const data = {}; snap.forEach(d => data[d.id] = d.data()); window._adminAvailability = data; renderAdminCalendar();
    });
    adminRequestsUnsubscribe = onSnapshot(collection(db, 'lgu_requests'), (snap) => {
        const counts = {}, requests = [];
        snap.forEach(d => {
            const x = {id:d.id, ...d.data()};
            if (x.scheduleDate && x.department && x.scheduleTime && (x.status || 'Pending') !== 'Cancelled') {
                const k = `${x.scheduleDate}__${normalizeCalendarDepartment(x.department)}__${x.scheduleTime}`;
                counts[k] = (counts[k] || 0) + 1;
                requests.push(x);
            }
        });
        adminBookingCounts = counts;
        window._adminCalendarRequests = requests;
        renderAdminCalendar();
    }, (error) => {
        console.error('Admin calendar appointment listener:', error);
        window._adminCalendarRequests = [];
        renderAdminCalendar();
    });
    renderAdminCalendar();
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
                    ${data.schedule ? `<p class="text-[9px] text-blue-600 font-bold bg-blue-50 p-2 rounded mt-1">SCHEDULE: ${data.schedule}</p>` : `<p class="text-[9px] text-slate-500 font-bold bg-slate-50 p-2 rounded mt-1">REQUESTED DATE: ${data.scheduleDate || '—'}</p>`}
                    ${cancelBtn}
                </div>`;
        });
    });
}

window.cancelMyRequest = async (id) => {
    if (!confirm("Do you want to cancel this appointment? The reserved slot will be released.")) return;
    try {
        const requestRef = doc(db, "lgu_requests", id);
        await runTransaction(db, async (transaction) => {
            const snap = await transaction.get(requestRef);
            if (!snap.exists()) throw new Error("Appointment no longer exists.");
            const data = snap.data();
            if ((data.status || 'Pending') === 'Cancelled') return;
            if (data.scheduleDate && data.schedulePeriod && data.department) {
                const slotRef = doc(db, 'schedule_availability', makeAvailabilityId(data.scheduleDate, data.department));
                const slotSnap = await transaction.get(slotRef);
                if (slotSnap.exists()) {
                    const field = timeField(data.scheduleTime);
                    if (field && slotSnap.exists()) transaction.update(slotRef, { [field]: Math.max(0, Number(slotSnap.data()[field] || 0) - 1), updatedAt: Date.now() });
                }
            }
            transaction.update(requestRef, { status: "Cancelled", scheduleStatus: "Cancelled", updatedAt: Date.now() });
        });
        alert("Appointment cancelled and the slot was released.");
    } catch (e) {
        alert("Error: " + e.message);
    }
};


window.openApprovalModal = async (id, email) => {
    currentDocId = id;
    currentCitizenEmail = email || '';
    const snap = await getDoc(doc(db, 'lgu_requests', id));
    if (!snap.exists()) return alert('Appointment no longer exists.');
    const data = snap.data();
    const date = data.scheduleDate || '—';
    const period = data.schedulePeriod === 'PM' ? 'Afternoon (PM)' : data.schedulePeriod === 'AM' ? 'Morning (AM)' : '—';
    document.getElementById('scheduleModalTitle').innerText = 'Approve Appointment';
    document.getElementById('targetEmail').innerText = `CONFIRMATION EMAIL: ${email || 'NO EMAIL'}`;
    document.getElementById('approvalSummary').innerHTML =
        `<div class="text-slate-900">${data.fullName || 'Citizen'}</div>
         <div>OFFICE: <span class="text-slate-900">${data.department || '—'}</span></div>
         <div>SERVICE: <span class="text-slate-900">${data.service || '—'}</span></div>
         <div>DATE: <span class="text-slate-900">${date}</span></div>
         <div>TIME: <span class="text-slate-900">${formatCalendarTime(data.scheduleTime)}</span></div>`;
    document.getElementById('rescheduleFields').classList.add('hidden');
    const btn = document.getElementById('sendEmailBtn');
    btn.innerText = 'APPROVE & EMAIL';
    btn.dataset.mode = 'approve';
    document.getElementById('emailModal').classList.remove('hidden');
};

function refreshRescheduleTimeOptions() {
    const date = document.getElementById('schedDate')?.value || '';
    const period = document.getElementById('schedPeriod')?.value || 'AM';
    const select = document.getElementById('schedTime');
    const department = window._rescheduleDepartment || '';
    if (!select) return;
    const item = date && department ? ((window._adminAvailability || {})[makeAvailabilityId(date, department)] || {}) : {};
    const current = select.value;
    const options = OFFICE_TIME_SLOTS.filter(slot => slot.period === period && (isTimeOpen(item, slot.value) || slot.value === current));
    select.innerHTML = '<option value="">Select available time...</option>' + options.map(slot=>`<option value="${slot.value}">${slot.label}</option>`).join('');
    if (options.some(x=>x.value===current)) select.value=current;
}
window.refreshRescheduleTimeOptions = refreshRescheduleTimeOptions;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('schedDate')?.addEventListener('change', refreshRescheduleTimeOptions);
    document.getElementById('schedPeriod')?.addEventListener('change', () => { const s=document.getElementById('schedTime'); if(s) s.value=''; refreshRescheduleTimeOptions(); });
});

window.openRescheduleModal = async (id, email) => {
    currentDocId = id;
    currentCitizenEmail = email || '';
    const snap = await getDoc(doc(db, 'lgu_requests', id));
    if (!snap.exists()) return alert('Appointment no longer exists.');
    const data = snap.data();
    document.getElementById('scheduleModalTitle').innerText = 'Reschedule Appointment';
    document.getElementById('targetEmail').innerText = `UPDATED SCHEDULE EMAIL: ${email || 'NO EMAIL'}`;
    document.getElementById('approvalSummary').innerHTML =
        `<div class="text-slate-900">${data.fullName || 'Citizen'}</div>
         <div>OFFICE: <span class="text-slate-900">${data.department || '—'}</span></div>
         <div>SERVICE: <span class="text-slate-900">${data.service || '—'}</span></div>
         <div>CURRENT: <span class="text-slate-900">${data.scheduleDate || '—'} · ${formatCalendarTime(data.scheduleTime)}</span></div>`;
    window._rescheduleDepartment = data.department || '';
    document.getElementById('rescheduleFields').classList.remove('hidden');
    document.getElementById('schedDate').value = data.scheduleDate || '';
    document.getElementById('schedPeriod').value = data.schedulePeriod || 'AM';
    if (document.getElementById('schedTime')) document.getElementById('schedTime').value = data.scheduleTime || '';
    refreshRescheduleTimeOptions();
    const btn = document.getElementById('sendEmailBtn');
    btn.innerText = 'RESCHEDULE & EMAIL';
    btn.dataset.mode = 'reschedule';
    document.getElementById('emailModal').classList.remove('hidden');
};

window.closeModal = () => document.getElementById('emailModal').classList.add('hidden');

async function releaseReservedSlot(transaction, requestData) {
    if (!requestData?.scheduleDate || !requestData?.schedulePeriod || !requestData?.department) return;
    const ref = doc(db, 'schedule_availability', makeAvailabilityId(requestData.scheduleDate, requestData.department));
    const snap = await transaction.get(ref);
    if (!snap.exists()) return;
    const field = requestData.scheduleTime ? timeField(requestData.scheduleTime) : (requestData.schedulePeriod === 'PM' ? 'pmBookedCount' : 'amBookedCount');
    const current = Number(snap.data()[field] || 0);
    transaction.update(ref, { [field]: Math.max(0, current - 1), updatedAt: Date.now() });
}

window.approveAppointment = async (id) => {
    try {
        const requestRef = doc(db, 'lgu_requests', id);
        const snap = await getDoc(requestRef);
        if (!snap.exists()) throw new Error('Appointment no longer exists.');
        const data = snap.data();
        if ((data.status || 'Pending') !== 'Pending') return alert('Only pending appointments can be approved.');
        if (!data.scheduleDate || !data.schedulePeriod) throw new Error('The citizen has not selected a valid date and AM/PM period.');

        const availabilityRef = doc(db, 'schedule_availability', makeAvailabilityId(data.scheduleDate, data.department));
        await runTransaction(db, async (transaction) => {
            const aSnap = await transaction.get(availabilityRef);
            if (!aSnap.exists()) throw new Error('The selected availability is no longer available.');
            const a = aSnap.data();
            const booked = Number(a[timeField(data.scheduleTime)] || 0);
            const enabled = isTimeOpenForAdmin(a, data.scheduleTime);
            if (!data.scheduleTime || booked > MAX_APPOINTMENTS_PER_TIME || (!enabled && booked <= 0)) {
                throw new Error('The selected appointment time is currently unavailable.');
            }
            transaction.update(requestRef, {
                status: 'Approved',
                scheduleStatus: 'Approved',
                schedule: `${data.scheduleDate} · ${data.scheduleTime || (data.schedulePeriod === 'AM' ? 'Morning (AM)' : 'Afternoon (PM)')}`,
                updatedAt: Date.now()
            });
        });

        await emailjs.send('service_yk1dfxf', 'template_agmhyzw', {
            to_email: data.email || currentCitizenEmail,
            appointment_date: data.scheduleDate,
            appointment_time: data.scheduleTime || (data.schedulePeriod === 'AM' ? 'Morning (AM)' : 'Afternoon (PM)'),
            message: `Your appointment with ${data.department || 'LGU Cortes'} has been approved.`
        });
        alert('Appointment approved and confirmation email sent.');
        closeModal();
    } catch (e) {
        alert('Approval failed: ' + (e?.message || e));
    }
};

window.rejectAppointment = async (id) => {
    if (!confirm('Reject this appointment request? The reserved slot will be released.')) return;
    try {
        const requestRef = doc(db, 'lgu_requests', id);
        await runTransaction(db, async (transaction) => {
            const snap = await transaction.get(requestRef);
            if (!snap.exists()) throw new Error('Appointment no longer exists.');
            const data = snap.data();
            if ((data.status || 'Pending') !== 'Pending') throw new Error('Only pending appointments can be rejected.');
            await releaseReservedSlot(transaction, data);
            transaction.update(requestRef, { status: 'Rejected', scheduleStatus: 'Rejected', updatedAt: Date.now() });
        });
        alert('Appointment rejected and the slot was released.');
    } catch (e) {
        alert('Rejection failed: ' + (e?.message || e));
    }
};

window.updateStatus = async (id, status) => {
    if (status === 'Completed') {
        await updateDoc(doc(db, "lgu_requests", id), { status, scheduleStatus: 'Completed', updatedAt: Date.now() });
        return;
    }
    await updateDoc(doc(db, "lgu_requests", id), { status, updatedAt: Date.now() });
};

window.deleteRequest = async (id) => {
    if (!confirm("Are you sure you want to delete this record? If it has a reserved slot, that slot will be released.")) return;
    try {
        const requestRef = doc(db, "lgu_requests", id);
        await runTransaction(db, async (transaction) => {
            const snap = await transaction.get(requestRef);
            if (!snap.exists()) return;
            const data = snap.data();
            if (data.scheduleDate && data.schedulePeriod && data.department && (data.status || 'Pending') !== 'Cancelled') {
                const slotRef = doc(db, 'schedule_availability', makeAvailabilityId(data.scheduleDate, data.department));
                const slotSnap = await transaction.get(slotRef);
                if (slotSnap.exists()) {
                    const field = timeField(data.scheduleTime);
                    if (slotSnap.exists() && field) transaction.update(slotRef, { [field]: Math.max(0, Number(slotSnap.data()[field] || 0) - 1), updatedAt: Date.now() });
                }
            }
            transaction.delete(requestRef);
        });
        alert("Record deleted and any reserved slot was released.");
    } catch (e) { alert("Error deleting: " + e.message); }
};

const sendBtn = document.getElementById('sendEmailBtn');
if(sendBtn) {
    sendBtn.onclick = async () => {
        const mode = sendBtn.dataset.mode || 'approve';
        if (mode === 'reschedule') {
            const date = document.getElementById('schedDate').value;
            const period = document.getElementById('schedPeriod').value;
            const time = document.getElementById('schedTime')?.value || '';
            const timeSlot = getTimeSlotByValue(time);
            if (!date || !period || !timeSlot || timeSlot.period !== period) return alert('Choose a valid weekday and municipal hall time.');
            if (!isMunicipalWorkingDay(date)) return alert('Municipal Hall appointments are available Monday to Friday only.');
            try {
                const requestRef = doc(db, 'lgu_requests', currentDocId);
                const requestSnap = await getDoc(requestRef);
                if (!requestSnap.exists()) throw new Error('Appointment no longer exists.');
                const requestData = requestSnap.data();
                const department = requestData.department || 'General / Other Concern';
                const oldDate = requestData.scheduleDate;
                const oldPeriod = requestData.schedulePeriod;
                const oldTime = requestData.scheduleTime || '';
                const sameSlot = oldDate === date && oldPeriod === period && oldTime === time;
                const newRef = doc(db, 'schedule_availability', makeAvailabilityId(date, department));

                await runTransaction(db, async (transaction) => {
                    const newSnap = await transaction.get(newRef);
                    if (!newSnap.exists()) throw new Error('The selected date is not available for this office.');
                    const a = newSnap.data();
                    const open = isTimeOpen(a, time);
                    const newField = timeField(time);
                    const newCount = Number(a[newField] || 0);

                    let oldSnap = null;
                    let oldRef = null;
                    let oldField = null;
                    if (!sameSlot && oldDate && oldPeriod) {
                        oldRef = doc(db, 'schedule_availability', makeAvailabilityId(oldDate, department));
                        oldSnap = await transaction.get(oldRef);
                        oldField = oldTime ? timeField(oldTime) : (oldPeriod === 'PM' ? 'pmBookedCount' : 'amBookedCount');
                    }

                    if (!open && !sameSlot) throw new Error(`The selected appointment time is unavailable for this office.`);
                    if (!sameSlot && newCount >= MAX_APPOINTMENTS_PER_TIME) throw new Error(`The selected appointment time is full. Please choose another available schedule.`);

                    if (!sameSlot) {
                        transaction.update(newRef, { [newField]: newCount + 1, updatedAt: Date.now() });
                        if (oldSnap?.exists()) {
                            transaction.update(oldRef, { [oldField]: Math.max(0, Number(oldSnap.data()[oldField] || 0) - 1), updatedAt: Date.now() });
                        }
                    }
                    transaction.update(requestRef, {
                        status: requestData.status || 'Approved',
                        scheduleStatus: 'Approved',
                        scheduleDate: date,
                        schedulePeriod: period,
                        scheduleTime: time,
                        schedule: `${date} · ${timeSlot.label}`, 
                        updatedAt: Date.now()
                    });
                });

                await emailjs.send('service_yk1dfxf', 'template_agmhyzw', {
                    to_email: requestData.email || currentCitizenEmail,
                    appointment_date: date,
                    appointment_time: timeSlot.label,
                    message: `Your appointment schedule with ${department} has been updated.`
                });
                alert('Appointment rescheduled and updated confirmation email sent.');
                closeModal();
            } catch (e) {
                alert('Reschedule failed: ' + (e?.message || e));
            }
            return;
        }

        await approveAppointment(currentDocId);
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
                                <p class="text-[10px] text-slate-400 uppercase font-bold">Service: <span class="text-slate-900">${data.service || '—'}</span></p>
                                ${data.purpose ? `<p class="text-[10px] text-slate-400 uppercase font-bold">Purpose: <span class="text-white">${data.purpose}</span></p>` : ''}
                                <p class="text-[10px] text-slate-400 uppercase font-bold">Username / Email: <span class="text-white">${data.email || '—'}</span></p>
                                <p class="text-[10px] text-slate-400 uppercase font-bold">Status: <span class="${statusClass}">${data.status || 'Pending'}</span></p>
                            </div>
                            ${schedule}
                        </div>
                    </div>
                    <div class="flex flex-col gap-2 pt-4 mt-4 border-t border-slate-800">
                        ${data.status === 'Pending' ? `<div class="flex gap-2"><button onclick="openApprovalModal('${data.id}', '${data.email || ''}')" class="flex-1 bg-blue-600 p-3 rounded-xl font-black text-[9px] uppercase hover:bg-blue-500 transition">APPROVE & EMAIL</button><button onclick="rejectAppointment('${data.id}')" class="flex-1 bg-red-700 p-3 rounded-xl font-black text-[9px] uppercase hover:bg-red-600 transition">REJECT</button></div>` : data.status === 'Approved' ? `<div class="flex gap-2"><button onclick="openRescheduleModal('${data.id}', '${data.email || ''}')" class="flex-1 bg-indigo-600 p-3 rounded-xl font-black text-[9px] uppercase hover:bg-indigo-500 transition">RESCHEDULE</button><button onclick="updateStatus('${data.id}', 'Completed')" class="flex-1 bg-green-700 p-3 rounded-xl font-black text-[9px] uppercase hover:bg-green-600 transition">MARK AS DONE</button></div>` : `<button onclick="deleteRequest('${data.id}')" class="w-full bg-red-700 p-3 rounded-xl font-black text-[9px] uppercase hover:bg-red-600 transition">DELETE</button>`}
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
                        ${data.status === 'Pending' ? `<div class="flex gap-2"><button onclick="openApprovalModal('${data.id}', '${data.email || ''}')" class="flex-1 bg-blue-600 p-3 rounded-xl font-black text-[9px] uppercase hover:bg-blue-500 transition">APPROVE & EMAIL</button><button onclick="rejectAppointment('${data.id}')" class="flex-1 bg-red-700 p-3 rounded-xl font-black text-[9px] uppercase hover:bg-red-600 transition">REJECT</button></div>` : data.status === 'Approved' ? `<div class="flex gap-2"><button onclick="openRescheduleModal('${data.id}', '${data.email || ''}')" class="flex-1 bg-indigo-600 p-3 rounded-xl font-black text-[9px] uppercase hover:bg-indigo-500 transition">RESCHEDULE</button><button onclick="updateStatus('${data.id}', 'Completed')" class="flex-1 bg-green-700 p-3 rounded-xl font-black text-[9px] uppercase hover:bg-green-600 transition">MARK AS DONE</button></div>` : `<button onclick="deleteRequest('${data.id}')" class="w-full bg-red-700 p-3 rounded-xl font-black text-[9px] uppercase hover:bg-red-600 transition">DELETE</button>`}
                    </div>
                </div>`;
        });
    });
};
