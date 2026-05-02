import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getDatabase, ref, onValue, set, push } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDS3RpNrY5VgKD2T-2gGS6td9w_KRGJ-cs",
  authDomain: "custody-flow.firebaseapp.com",
  projectId: "custody-flow",
  storageBucket: "custody-flow.firebasestorage.app",
  messagingSenderId: "852899219082",
  appId: "1:852899219082:web:ad920dbb329294ba21cf73",
  databaseURL: "https://custody-flow-default-rtdb.europe-west1.firebasedatabase.app"
};

// Also try the other common default in case the first one fails
const alternativeDatabaseURL = "https://custody-flow-default-rtdb.firebaseio.com";

let db = null;
try {
    const app = initializeApp(firebaseConfig);
    db = getDatabase(app);
} catch (err) {
    console.error("Primary Firebase initialization failed, trying alternative URL:", err);
    try {
        const appAlt = initializeApp({ ...firebaseConfig, databaseURL: alternativeDatabaseURL });
        db = getDatabase(appAlt);
    } catch (e) {
        console.error("All Firebase attempts failed, operating in offline/fallback mode.");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide icons
    if (window.lucide) lucide.createIcons();

    // State
    let scans = [];
    let inventory = {};

    // Elements
    const views = document.querySelectorAll('.view');
    const navItems = document.querySelectorAll('.nav-item');
    const dropZoneIn = document.getElementById('drop-zone-in');
    const dropZoneOut = document.getElementById('drop-zone-out');
    const fileInputIn = document.getElementById('file-input-in');
    const fileInputOut = document.getElementById('file-input-out');
    const modal = document.getElementById('extraction-modal');
    const previewContainer = document.getElementById('extracted-items-preview');

    let currentExtraction = null;

    // --- Firebase Listeners & Fallback ---
    if(db) {
        try {
            const inventoryRef = ref(db, 'inventory');
            onValue(inventoryRef, (snapshot) => {
                inventory = snapshot.val() || {};
                renderInventory();
                updateStats();
            });

            const scansRef = ref(db, 'scans');
            onValue(scansRef, (snapshot) => {
                const data = snapshot.val();
                scans = data ? Object.values(data).sort((a,b) => b.timestamp - a.timestamp) : [];
                renderRecentScans();
                renderScans();
                updateStats();
            });
        } catch (err) {
            console.error("Firebase runtime error, loading local fallback:", err);
            loadLocalStorage();
        }
    } else {
        loadLocalStorage();
    }

    function loadLocalStorage() {
        try {
            inventory = JSON.parse(localStorage.getItem('custody_inventory')) || {};
            scans = JSON.parse(localStorage.getItem('custody_scans')) || [];
            renderInventory();
            renderRecentScans();
            renderScans();
            updateStats();
        } catch (e) {
            console.error(e);
        }
    }

    function saveLocally(extraction) {
        scans.unshift(extraction);
        localStorage.setItem('custody_scans', JSON.stringify(scans));

        const isAdd = extraction.action === 'add';
        extraction.items.forEach(item => {
            const key = item.name.replace(/[\.#\$\/\[\]]/g, '_');
            if(inventory[key]) {
                inventory[key].qty += isAdd ? item.qty : -item.qty;
            } else if (isAdd) {
                inventory[key] = { name: item.name, unit: item.unit, qty: item.qty };
            }
            if(inventory[key] && inventory[key].qty <= 0) {
                delete inventory[key];
            }
        });
        localStorage.setItem('custody_inventory', JSON.stringify(inventory));
        renderInventory();
        renderRecentScans();
        renderScans();
        updateStats();
    }

    // --- Navigation ---
    function switchView(viewId) {
        views.forEach(v => v.style.display = 'none');
        document.getElementById(viewId).style.display = 'block';
        
        navItems.forEach(item => {
            item.classList.toggle('active', item.dataset.view === viewId);
        });
        
        if(viewId === 'inventory') renderInventory();
        if(viewId === 'scans') renderScans();
        updateStats();
    }

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            switchView(item.dataset.view);
        });
    });

    // --- Stats ---
    function updateStats() {
        if(document.getElementById('total-scans')) document.getElementById('total-scans').textContent = scans.length;
        if(document.getElementById('total-products')) document.getElementById('total-products').textContent = Object.keys(inventory).length;
        if(document.getElementById('last-scan-date')) document.getElementById('last-scan-date').textContent = scans.length > 0 ? scans[0].date : '-';
    }

    // --- File Handling & "OCR" Mock ---
    function setupDropZone(zone, input, actionType) {
        if (!zone) return; 
        
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.style.borderColor = actionType === 'add' ? 'var(--primary)' : '#ef4444';
        });

        zone.addEventListener('dragleave', () => {
            zone.style.borderColor = 'var(--border-glass)';
        });

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.style.borderColor = 'var(--border-glass)';
            const files = e.dataTransfer.files;
            if(files.length > 0) handleFile(files[0], actionType);
        });

        input.addEventListener('change', (e) => {
            if(e.target.files.length > 0) handleFile(e.target.files[0], actionType);
        });
    }

    setupDropZone(dropZoneIn, fileInputIn, 'add');
    setupDropZone(dropZoneOut, fileInputOut, 'remove');

    function handleFile(file, actionType) {
        try {
            if(!file) return;
            console.log("Processing file:", file.name);
            
            const realDataResults = [
                { id: 1, name: "BCA PERFORMO 20X25X65", unit: "PAL", qty: 1.000 },
                { id: 2, name: "OȚEL BETON FASONAT FI8", unit: "KG", qty: 327.210 },
                { id: 3, name: "SÂRMĂ BOBINE", unit: "BUC", qty: 100.000 },
                { id: 4, name: "ANCORĂ CHIMICĂ FĂRĂ STREN 300ML", unit: "BUC", qty: 4.000 },
                { id: 5, name: "BST 500 FI 12 L 12ML", unit: "KG", qty: 550.000 },
                { id: 6, name: "BST 500 FI 14 L 12ML", unit: "KG", qty: 304.000 },
                { id: 8, name: "CUIE BETON 6", unit: "BUC", qty: 475.000 },
                { id: 9, name: "ȘURUB GIPS CT 4.2*70", unit: "BUC", qty: 1000.000 },
                { id: 10, name: "ȘURUB GIPS CT 3.5*55", unit: "BUC", qty: 500.000 },
                { id: 11, name: "SÂRMĂ NEAGRĂ D=2.5MM", unit: "KG", qty: 21.450 },
                { id: 12, name: "BCA PERFORMO 15X25X65", unit: "PAL", qty: 0.114 },
                { id: 14, name: "XPS S 50MM MOVALIU", unit: "BAX", qty: 1.000 },
                { id: 15, name: "BST 500 FI 12 L 12ML", unit: "KG", qty: 152.000 }
            ];

            showExtraction(realDataResults, file.name, actionType);
        } catch (err) {
            console.error(err);
        }
    }

    function showExtraction(items, fileName, actionType) {
        currentExtraction = {
            id: 'AVIZ-' + Math.floor(Math.random() * 10000),
            date: new Date().toLocaleDateString('ro-RO'),
            timestamp: Date.now(),
            file: fileName,
            items: items,
            action: actionType
        };

        const isAdd = actionType === 'add';
        document.querySelector('.modal-content h2').textContent = isAdd ? 'Date Extrase (Intrare)' : 'Date Extrase (Ieșire)';
        
        const btnConfirm = document.querySelector('.modal-footer button:last-child');
        btnConfirm.textContent = isAdd ? 'Confirmă și Adaugă' : 'Confirmă și Scade';
        btnConfirm.className = isAdd ? 'btn btn-primary' : 'btn btn-outline-danger';
        
        previewContainer.innerHTML = items.map(item => `
            <div class="extract-row">
                <span><strong>${item.name}</strong></span>
                <span>${item.qty} ${item.unit}</span>
            </div>
        `).join('');

        modal.style.display = 'flex';
    }

    window.closeModal = () => {
        modal.style.display = 'none';
        currentExtraction = null;
    };

    window.confirmExtraction = async () => {
        if(!currentExtraction) return;

        const isAdd = currentExtraction.action === 'add';

        if(db) {
            try {
                // Push to history in DB
                const scansRef = ref(db, 'scans');
                push(scansRef, currentExtraction);

                // Update Inventory in DB
                let updatedInventory = { ...inventory };

                currentExtraction.items.forEach(item => {
                    const key = item.name.replace(/[\.#\$\/\[\]]/g, '_');
                    if(updatedInventory[key]) {
                        updatedInventory[key].qty += isAdd ? item.qty : -item.qty;
                    } else if (isAdd) {
                        updatedInventory[key] = { name: item.name, unit: item.unit, qty: item.qty };
                    }
                    if(updatedInventory[key] && updatedInventory[key].qty <= 0) {
                        delete updatedInventory[key];
                    }
                });

                // Save back to DB
                set(ref(db, 'inventory'), updatedInventory);
                closeModal();
                alert(isAdd ? "Datele au fost adăugate cu succes în Cloud!" : "Produsele au fost scăzute din stocul Cloud!");
            } catch (err) {
                console.error("Firebase write failed, using local storage fallback", err);
                saveLocally(currentExtraction);
                closeModal();
                alert(isAdd ? "Salvat local (Eroare Firebase)" : "Scăzut local (Eroare Firebase)");
            }
        } else {
            saveLocally(currentExtraction);
            closeModal();
            alert(isAdd ? "Datele au fost adăugate cu succes local!" : "Produsele au fost scăzute din stocul local!");
        }
    };

    // --- Rendering ---
    function renderRecentScans() {
        const tbody = document.querySelector('#recent-scans-table tbody');
        if(!tbody) return;
        if(!scans || scans.length === 0) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="4">Nicio scanare recentă</td></tr>';
            return;
        }

        tbody.innerHTML = scans.slice(0, 5).map(scan => `
            <tr>
                <td>${scan.date}</td>
                <td>${scan.id}</td>
                <td>${scan.items.length} produse</td>
                <td><span style="color: ${scan.action === 'add' ? '#4ade80' : '#ef4444'};">${scan.action === 'add' ? 'Intrare' : 'Ieșire'}</span></td>
            </tr>
        `).join('');
    }

    function renderInventory() {
        const tbody = document.getElementById('inventory-body');
        if(!tbody) return;
        const items = Object.entries(inventory);
        
        if(items.length === 0) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="4">Nu există produse în stoc</td></tr>';
            return;
        }

        tbody.innerHTML = items.map(([key, data]) => {
            const displayName = data.name || key;
            return `
                <tr>
                    <td><strong>${displayName}</strong></td>
                    <td>${data.unit}</td>
                    <td>${data.qty}</td>
                    <td>
                        <button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.7rem;" onclick="removeStock('${key}')">Scade</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    window.removeStock = (key) => {
        const displayName = inventory[key] ? (inventory[key].name || key) : key;
        const amount = prompt(`Cât dorești să scazi din stocul pentru "${displayName}"?`);
        if(amount && !isNaN(amount)) {
            let updatedInventory = { ...inventory };
            updatedInventory[key].qty -= parseFloat(amount);
            if(updatedInventory[key].qty <= 0) delete updatedInventory[key];
            
            if (db) {
                set(ref(db, 'inventory'), updatedInventory);
            } else {
                inventory = updatedInventory;
                localStorage.setItem('custody_inventory', JSON.stringify(inventory));
                renderInventory();
                updateStats();
            }
        }
    };

    function renderScans() {
        const list = document.getElementById('scans-list');
        if(!list) return;
        list.innerHTML = scans.map(scan => `
            <div class="stat-card" style="margin-bottom: 1rem; justify-content: space-between;">
                <div>
                    <h4>${scan.id}</h4>
                    <p style="font-size: 0.8rem; color: var(--text-muted);">${scan.date} - ${scan.file}</p>
                </div>
                <div style="text-align: right;">
                    <p>${scan.items.length} produse</p>
                </div>
            </div>
        `).join('');
    }

    window.exportToCSV = () => {
        let csv = "Produs,UM,Cantitate\n";
        Object.entries(inventory).forEach(([key, data]) => {
            const name = data.name || key;
            csv += `${name},${data.unit},${data.qty}\n`;
        });
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', 'stoc_custodie_cloud.csv');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    renderRecentScans();
    updateStats();
});
