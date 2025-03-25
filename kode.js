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
        const adminEmails = ['admin@example.com']; // Add your admin emails here

        // Tab functionality
        tabs.forEach(tab => {
            tab.addEventListener("click", () => {
                tabs.forEach(t => t.classList.remove("active"));
                tabContents.forEach(tc => tc.classList.remove("show", "active"));
                
                tab.classList.add("active");
                document.getElementById(tab.dataset.bsTarget.substring(1)).classList.add("show", "active");
            });
        });

        // Auth state - Modified to prevent admins from being added to users collections
        onAuthStateChanged(auth, (user) => {
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
                    .catch(error => showDialog(error.message));
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
            const uid = caseUID.value;
            const name = studentName.value;
            const points = parseInt(casePoints.value);
            let reason = caseReason.value;
            
            if (reason === "Lainnya") {
                reason = otherReason.value;
            }
            
            const details = caseDetails.value;
            const newPoints = parseInt(finalPoints.value);
            const timestamp = Date.now();
            const caseDate = new Date().toISOString().split('T')[0];

            if (uid && points && reason) {
                // Cari child key berdasarkan uid
                get(ref(db, "users")).then(snapshot => {
                    let childKey = null;
                    let userData = null;
                    
                    snapshot.forEach(childSnapshot => {
                        const data = childSnapshot.val();
                        if ((data.uid && data.uid === uid) || childSnapshot.key === uid) {
                            childKey = childSnapshot.key;
                            userData = data;
                        }
                    });
                    
                    if (!childKey) {
                        childKey = uid;
                    }
                    
                    // Create new case in cases collection
                    const newCaseRef = push(ref(db, "cases"));
                    set(newCaseRef, {
                        uid: uid,
                        name: name,
                        caseType: reason,
                        details: details,
                        pointsDeducted: points,
                        initialPoints: parseInt(initialPoints.value) || 0,
                        finalPoints: newPoints,
                        timestamp: timestamp,
                        date: caseDate
                    });
                    
                    // Update user data with new points and pointsDeducted
                    const updatedData = {
                        name: name,
                        points: newPoints,
                        uid: uid,
                        lastCaseDate: caseDate,
                        lastCaseType: reason,
                        pointsDeducted: points
                    };

                    // Update both locations
                    update(ref(db, `users/${childKey}`), updatedData);
                    
                    // Also update user_logins if exists
                    get(ref(db, "user_logins/" + childKey)).then(snapshot => {
                        if (snapshot.exists()) {
                            update(ref(db, "user_logins/" + childKey), { 
                                points: newPoints,
                                lastCaseDate: caseDate,
                                pointsDeducted: points
                            });
                        }
                    });
                    showDialog("Kasus berhasil ditambahkan!");
                    
                    // Refresh data
                    loadUsers();
                    loadCases();
                    
                    // Clear form
                    caseUID.value = "";
                    studentName.value = "";
                    initialPoints.value = "";
                    caseReason.value = "";
                    otherReason.value = "";
                    caseDetails.value = "";
                    casePoints.value = "";
                    finalPoints.value = "";
                });
            } else {
                showDialog("Harap isi semua data dengan benar!");
            }
        });

        caseSearchInput.addEventListener("input", filterCases);
        caseFilterType.addEventListener("change", filterCases);
        studentSearchInput.addEventListener("input", filterStudents);

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

        function loadUsers() {
            onValue(ref(db, "users"), snapshot => {
                usersTableBody.innerHTML = ""; 
                snapshot.forEach(childSnapshot => {
                    let userData = childSnapshot.val();
                    let childKey = childSnapshot.key;
                    
                    // Skip admin users that might have been added to the users table
                    if (userData.email && adminEmails.includes(userData.email)) {
                        return;
                    }
                    
                    // Skip entries that don't look like student data
                    if (!userData.name && !userData.uid) {
                        return;
                    }
                    
                    let actualUid = userData.uid || childKey;
                    
                    let row = document.createElement("tr");
                    
                    let tdUid = document.createElement("td");
                    tdUid.textContent = actualUid;
                    
                    let tdName = document.createElement("td");
                    tdName.textContent = userData.name || "Tidak tersedia";
                    
                    let tdPoints = document.createElement("td");
                    tdPoints.textContent = userData.points || 0;
                    
                    let tdAction = document.createElement("td");
                    let actionBtn = document.createElement("button");
                    actionBtn.className = "btn btn-primary";
                    actionBtn.innerHTML = '<span class="material-icons">check_circle</span> Pilih';
                    actionBtn.addEventListener("click", () => {
                        caseUID.value = actualUid;
                        studentName.value = userData.name || "";
                        initialPoints.value = userData.points || 0;
                        
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
            });
        }

        function loadCases() {
            onValue(ref(db, "cases"), snapshot => {
                // Store all cases for filtering
                const allCases = [];
                
                snapshot.forEach(childSnapshot => {
                    const caseData = childSnapshot.val();
                    allCases.push({
                        id: childSnapshot.key,
                        ...caseData
                    });
                });
                
                // Sort by timestamp (newest first)
                allCases.sort((a, b) => b.timestamp - a.timestamp);
                
                // Initial display
                displayCases(allCases);
            });
        }

        function displayCases(casesArray) {
            caseList.innerHTML = "";
            
            if (casesArray.length === 0) {
                const emptyMessage = document.createElement("div");
                emptyMessage.textContent = "Belum ada kasus yang tercatat.";
                emptyMessage.className = "list-group-item";
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
                caseInfo.textContent = `UID: ${caseData.uid} | Pengurangan: ${caseData.pointsDeducted} poin | Poin awal: ${caseData.initialPoints} | Poin akhir: ${caseData.finalPoints}`;
                
                const caseReason = document.createElement("p");
                caseReason.className = "mb-0";
                caseReason.textContent = caseData.details || "Tidak ada detail tambahan";
                
                listItem.appendChild(caseHeader);
                listItem.appendChild(caseInfo);
                listItem.appendChild(caseReason);
                
                caseList.appendChild(listItem);
            });
        }

        function filterCases() {
            const searchText = caseSearchInput.value.toLowerCase();
            const filterType = caseFilterType.value;
            
            get(ref(db, "cases")).then(snapshot => {
                const filteredCases = [];
                
                snapshot.forEach(childSnapshot => {
                    const caseData = childSnapshot.val();
                    const matchesSearch = searchText === "" || 
                                         (caseData.name && caseData.name.toLowerCase().includes(searchText)) || 
                                         (caseData.uid && caseData.uid.toLowerCase().includes(searchText));
                    
                    const matchesType = filterType === "" || caseData.caseType === filterType;
                    
                    if (matchesSearch && matchesType) {
                        filteredCases.push({
                            id: childSnapshot.key,
                            ...caseData
                        });
                    }
                });
                
                // Sort by timestamp (newest first)
                filteredCases.sort((a, b) => b.timestamp - a.timestamp);
                
                displayCases(filteredCases);
            });
        }

        function filterStudents() {
            const searchText = studentSearchInput.value.toLowerCase();
            const rows = usersTableBody.getElementsByTagName("tr");

            for (let i = 0; i < rows.length; i++) {
                const nameCell = rows[i].getElementsByTagName("td")[1];
                if (nameCell) {
                    const name = nameCell.textContent || nameCell.innerText;
                    rows[i].style.display = name.toLowerCase().indexOf(searchText) > -1 ? "" : "none";
                }
            }
}
