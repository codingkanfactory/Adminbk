import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, set, get, push, child, update, onValue } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = { 
    apiKey: "AIzaSyDX882cvhwQgfhbsLFn69Q2l-TUQUR5IBk",
    authDomain: "codingkan-factory-apps.firebaseapp.com",
    databaseURL: "https://codingkan-factory-apps-default-rtdb.firebaseio.com",
    projectId: "codingkan-factory-apps",
    storageBucket: "codingkan-factory-apps.firebasestorage.app",
    messagingSenderId: "188856222342",
    appId: "1:188856222342:android:ae0e1873684da414cec707"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// DOM Elements
const loginSection = document.getElementById("loginSection");
const adminSection = document.getElementById("adminSection");
const usersTableBody = document.getElementById("usersTableBody");
const caseUID = document.getElementById("caseUID");
const studentName = document.getElementById("studentName");
const initialPoints = document.getElementById("initialPoints");
const caseReason = document.getElementById("caseReason");
const otherReasonContainer = document.getElementById("otherReasonContainer");
const otherReason = document.getElementById("otherReason");
const caseDetails = document.getElementById("caseDetails");
const casePoints = document.getElementById("casePoints");
const finalPoints = document.getElementById("finalPoints");
const caseList = document.getElementById("caseList");
const caseSearchInput = document.getElementById("caseSearchInput");
const caseFilterType = document.getElementById("caseFilterType");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const addCaseBtn = document.getElementById("addCaseBtn");
const dialogOverlay = document.getElementById("dialogOverlay");
const dialogMessage = document.getElementById("dialogMessage");
const tabs = document.querySelectorAll(".nav-link");
const tabContents = document.querySelectorAll(".tab-pane");
const studentSearchInput = document.getElementById("studentSearchInput");

// Store admin user IDs to prevent them from being added to student tables
const adminEmails = ['admin@example.com']; // Pastikan ini sesuai dengan rules Firebase

// Global variable to store current user
let currentUser = null;

// Tab functionality
tabs.forEach(tab => {
    tab.addEventListener("click", () => {
        tabs.forEach(t => t.classList.remove("active"));
        tabContents.forEach(tc => tc.classList.remove("show", "active"));
        
        tab.classList.add("active");
        document.getElementById(tab.dataset.bsTarget.substring(1)).classList.add("show", "active");
    });
});

// Auth state - Modified untuk kompatibilitas dengan rules
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        // Check if user is an admin
        const userEmail = user.email;
        if (adminEmails.includes(userEmail)) {
            // This is an admin user, show admin panel
            showAdminPanel();
        } else {
            // This is a regular user that shouldn't have access to admin panel
            showDialog("Akses tidak diizinkan. Anda bukan admin.");
            signOut(auth);
        }
    } else {
        currentUser = null;
        showLoginPanel();
    }
});

// Event listeners
loginBtn.addEventListener("click", () => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    
    // First check if the email is in the adminEmails list
    if (adminEmails.includes(email)) {
        signInWithEmailAndPassword(auth, email, password)
            .then(() => {
                // Admin successfully logged in
                showAdminPanel();
            })
            .catch(error => showDialog("Login gagal: " + error.message));
    } else {
        showDialog("Email ini tidak terdaftar sebagai admin!");
    }
});

logoutBtn.addEventListener("click", () => {
    signOut(auth).then(() => showLoginPanel());
});

caseReason.addEventListener("change", () => {
    if (caseReason.value === "Lainnya") {
        otherReasonContainer.style.display = "block";
    } else {
        otherReasonContainer.style.display = "none";
    }
});

casePoints.addEventListener("input", () => {
    let initial = parseInt(initialPoints.value) || 0;
    let deduction = parseInt(casePoints.value) || 0;
    finalPoints.value = initial - deduction < 0 ? 0 : initial - deduction;
});

addCaseBtn.addEventListener("click", () => {
    if (!currentUser || !adminEmails.includes(currentUser.email)) {
        showDialog("Hanya admin yang bisa menambahkan kasus!");
        return;
    }

    const uid = caseUID.value.trim();
    const name = studentName.value.trim();
    const points = parseInt(casePoints.value);
    let reason = caseReason.value;
    
    if (reason === "Lainnya") {
        reason = otherReason.value.trim();
    }
    
    const details = caseDetails.value.trim();
    const newPoints = parseInt(finalPoints.value);
    const timestamp = Date.now();
    const caseDate = new Date().toISOString().split('T')[0];

    if (!uid || !points || !reason || !name) {
        showDialog("Harap isi semua data dengan benar!");
        return;
    }

    // Cari student berdasarkan uid
    get(ref(db, "users")).then(snapshot => {
        let childKey = null;
        let userData = null;
        
        snapshot.forEach(childSnapshot => {
            const data = childSnapshot.val();
            // PERBAIKAN: Cari berdasarkan UID yang sudah diperbaiki
            const displayUID = getProperUID(data, childSnapshot.key);
            if (displayUID === uid) {
                childKey = childSnapshot.key;
                userData = data;
            }
        });
        
        if (!childKey) {
            childKey = uid;
        }
        
        // Create new case in cases collection
        const newCaseRef = push(ref(db, "cases"));
        const caseData = {
            uid: uid,
            name: name,
            caseType: reason,
            details: details,
            pointsDeducted: points,
            initialPoints: parseInt(initialPoints.value) || 0,
            finalPoints: newPoints,
            timestamp: timestamp,
            date: caseDate,
            createdBy: currentUser.email,
            createdByUid: currentUser.uid
        };

        set(newCaseRef, caseData).then(() => {
            // Update user data with new points
            const updatedUserData = {
                name: name,
                points: newPoints,
                uid: uid,
                lastCaseDate: caseDate,
                lastCaseType: reason,
                pointsDeducted: points,
                lastUpdated: timestamp,
                updatedBy: currentUser.email
            };

            // Update users node
            update(ref(db, `users/${childKey}`), updatedUserData).then(() => {
                // Update user_logins if exists
                get(ref(db, "user_logins/" + childKey)).then(loginSnapshot => {
                    if (loginSnapshot.exists()) {
                        const loginUpdateData = { 
                            points: newPoints,
                            lastCaseDate: caseDate,
                            pointsDeducted: points,
                            lastUpdated: timestamp
                        };
                        update(ref(db, "user_logins/" + childKey), loginUpdateData);
                    }
                });

                showDialog("Kasus berhasil ditambahkan!");
                
                // Refresh data
                loadUsers();
                loadCases();
                
                // Clear form
                clearCaseForm();
                
            }).catch(error => {
                console.error("Error updating user:", error);
                showDialog("Gagal mengupdate data user: " + error.message);
            });
            
        }).catch(error => {
            console.error("Error adding case:", error);
            showDialog("Gagal menambahkan kasus: " + error.message);
        });
        
    }).catch(error => {
        console.error("Error fetching users:", error);
        showDialog("Gagal mengambil data user: " + error.message);
    });
});

caseSearchInput.addEventListener("input", filterCases);
caseFilterType.addEventListener("change", filterCases);
studentSearchInput.addEventListener("input", filterStudents);

// Helper function untuk mendapatkan UID yang benar
function getProperUID(userData, childKey) {
    if (userData.uid && !userData.uid.includes("@")) {
        return userData.uid;
    } else if (userData.id && !userData.id.includes("@")) {
        return userData.id;
    } else if (!childKey.includes("@")) {
        return childKey;
    } else {
        // Jika semua berupa email, buat UID dari nama atau gunakan timestamp
        return userData.name && !userData.name.includes("@") ? 
            userData.name.replace(/\s+/g, '').toLowerCase() + Date.now().toString().slice(-4) : 
            "USER" + Date.now().toString().slice(-6);
    }
}

// Helper function untuk mendapatkan nama yang benar
function getProperName(userData) {
    if (userData.name && !userData.name.includes("@")) {
        return userData.name;
    } else if (userData.fullName && !userData.fullName.includes("@")) {
        return userData.fullName;
    } else if (userData.studentName && !userData.studentName.includes("@")) {
        return userData.studentName;
    } else {
        return "Nama Tidak Tersedia";
    }
}

// Functions
function showAdminPanel() {
    loginSection.style.display = "none";
    adminSection.style.display = "block";
    loadUsers();
    loadCases();
}

function showLoginPanel() {
    loginSection.style.display = "block";
    adminSection.style.display = "none";
}

function showDialog(message) {
    dialogMessage.textContent = message;
    new bootstrap.Modal(dialogOverlay).show();
}

function clearCaseForm() {
    caseUID.value = "";
    studentName.value = "";
    initialPoints.value = "";
    caseReason.value = "";
    otherReason.value = "";
    caseDetails.value = "";
    casePoints.value = "";
    finalPoints.value = "";
    otherReasonContainer.style.display = "none";
}

function loadUsers() {
    if (!currentUser) return;
    
    onValue(ref(db, "users"), snapshot => {
        usersTableBody.innerHTML = ""; 
        
        if (!snapshot.exists()) {
            const emptyRow = document.createElement("tr");
            emptyRow.innerHTML = '<td colspan="4" class="text-center">Belum ada data siswa</td>';
            usersTableBody.appendChild(emptyRow);
            return;
        }
        
        snapshot.forEach(childSnapshot => {
            let userData = childSnapshot.val();
            let childKey = childSnapshot.key;
            
            // Skip admin users that might have been added to the users table
            if (userData.email && adminEmails.includes(userData.email)) {
                return;
            }
            
            // Skip entries that don't look like student data
            if (!userData.name && !userData.uid && !userData.id) {
                return;
            }
            
            // PERBAIKAN: Logika untuk menentukan UID dan Nama yang benar
            const displayUID = getProperUID(userData, childKey);
            const displayName = getProperName(userData);
            
            let row = document.createElement("tr");
            
            let tdUid = document.createElement("td");
            tdUid.textContent = displayUID;
            
            let tdName = document.createElement("td");
            tdName.textContent = displayName;
            
            let tdPoints = document.createElement("td");
            tdPoints.textContent = userData.points || userData.poin || 0;
            
            let tdAction = document.createElement("td");
            let actionBtn = document.createElement("button");
            actionBtn.className = "btn btn-primary btn-sm";
            actionBtn.innerHTML = '<span class="material-icons">check_circle</span> Pilih';
            actionBtn.addEventListener("click", () => {
                caseUID.value = displayUID;
                studentName.value = displayName;
                initialPoints.value = userData.points || userData.poin || 0;
                
                // Switch to add case tab
                tabs.forEach(t => t.classList.remove("active"));
                tabContents.forEach(tc => tc.classList.remove("show", "active"));
                document.querySelector('[data-bs-target="#tab-add-case"]').classList.add("active");
                document.getElementById("tab-add-case").classList.add("show", "active");
            });
            tdAction.appendChild(actionBtn);
            
            row.appendChild(tdUid);
            row.appendChild(tdName);
            row.appendChild(tdPoints);
            row.appendChild(tdAction);
            
            usersTableBody.appendChild(row);
        });
    }, error => {
        console.error("Error loading users:", error);
        showDialog("Gagal memuat data siswa: " + error.message);
    });
}

function loadCases() {
    if (!currentUser) return;
    
    onValue(ref(db, "cases"), snapshot => {
        // Store all cases for filtering
        const allCases = [];
        
        if (snapshot.exists()) {
            snapshot.forEach(childSnapshot => {
                const caseData = childSnapshot.val();
                allCases.push({
                    id: childSnapshot.key,
                    ...caseData
                });
            });
        }
        
        // Sort by timestamp (newest first)
        allCases.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        
        // Initial display
        displayCases(allCases);
    }, error => {
        console.error("Error loading cases:", error);
        showDialog("Gagal memuat data kasus: " + error.message);
    });
}

function displayCases(casesArray) {
    caseList.innerHTML = "";
    
    if (casesArray.length === 0) {
        const emptyMessage = document.createElement("div");
        emptyMessage.textContent = "Belum ada kasus yang tercatat.";
        emptyMessage.className = "list-group-item text-center";
        caseList.appendChild(emptyMessage);
        return;
    }
    
    casesArray.forEach(caseData => {
        const listItem = document.createElement("div");
        listItem.className = "list-group-item rounded mb-3";
        
        const caseHeader = document.createElement("div");
        caseHeader.className = "d-flex justify-content-between align-items-center mb-2";
        
        const caseUser = document.createElement("h5");
        caseUser.className = "mb-0";
        caseUser.textContent = caseData.name || "Siswa";
        
        const caseDate = document.createElement("small");
        caseDate.className = "text-muted";
        caseDate.textContent = caseData.date || "Tanggal tidak tersedia";
        
        caseHeader.appendChild(caseUser);
        caseHeader.appendChild(caseDate);
        
        const caseInfo = document.createElement("p");
        caseInfo.className = "mb-1";
        caseInfo.innerHTML = `
            <strong>UID:</strong> ${caseData.uid || 'N/A'} | 
            <strong>Tipe:</strong> ${caseData.caseType || 'N/A'} | 
            <strong>Pengurangan:</strong> ${caseData.pointsDeducted || 0} poin | 
            <strong>Poin awal:</strong> ${caseData.initialPoints || 0} | 
            <strong>Poin akhir:</strong> ${caseData.finalPoints || 0}
        `;
        
        const caseReason = document.createElement("p");
        caseReason.className = "mb-1";
        caseReason.innerHTML = `<strong>Detail:</strong> ${caseData.details || "Tidak ada detail tambahan"}`;
        
        // Tambah info pembuat case jika ada
        if (caseData.createdBy) {
            const createdByInfo = document.createElement("small");
            createdByInfo.className = "text-muted d-block";
            createdByInfo.textContent = `Dibuat oleh: ${caseData.createdBy}`;
            listItem.appendChild(createdByInfo);
        }
        
        listItem.appendChild(caseHeader);
        listItem.appendChild(caseInfo);
        listItem.appendChild(caseReason);
        
        caseList.appendChild(listItem);
    });
}

function filterCases() {
    if (!currentUser) return;
    
    const searchText = caseSearchInput.value.toLowerCase().trim();
    const filterType = caseFilterType.value;
    
    get(ref(db, "cases")).then(snapshot => {
        const filteredCases = [];
        
        if (snapshot.exists()) {
            snapshot.forEach(childSnapshot => {
                const caseData = childSnapshot.val();
                const matchesSearch = searchText === "" || 
                                     (caseData.name && caseData.name.toLowerCase().includes(searchText) && !caseData.name.includes("@")) || 
                                     (caseData.uid && caseData.uid.toLowerCase().includes(searchText) && !caseData.uid.includes("@"));
                
                const matchesType = filterType === "" || caseData.caseType === filterType;
                
                if (matchesSearch && matchesType) {
                    filteredCases.push({
                        id: childSnapshot.key,
                        ...caseData
                    });
                }
            });
        }
        
        // Sort by timestamp (newest first)
        filteredCases.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        
        displayCases(filteredCases);
    }).catch(error => {
        console.error("Error filtering cases:", error);
        showDialog("Gagal memfilter kasus: " + error.message);
    });
}

function filterStudents() {
    const searchText = studentSearchInput.value.toLowerCase().trim();
    const rows = usersTableBody.getElementsByTagName("tr");

    for (let i = 0; i < rows.length; i++) {
        const nameCell = rows[i].getElementsByTagName("td")[1];
        const uidCell = rows[i].getElementsByTagName("td")[0];
        
        if (nameCell && uidCell) {
            const name = (nameCell.textContent || nameCell.innerText || "").toLowerCase();
            const uid = (uidCell.textContent || uidCell.innerText || "").toLowerCase();
            
            // PERBAIKAN: Pastikan pencarian tidak menggunakan email sebagai kriteria
            const matchesSearch = searchText === "" || 
                                 (name.includes(searchText) && !name.includes("@")) || 
                                 (uid.includes(searchText) && !uid.includes("@"));
            
            rows[i].style.display = matchesSearch ? "" : "none";
        }
    }
            }
