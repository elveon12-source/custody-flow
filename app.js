import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getDatabase, ref, onValue, set, push, get } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDS3RpNrY5VgKD2T-2gGS6td9w_KRGJ-cs",
  authDomain: "custody-flow.firebaseapp.com",
  projectId: "custody-flow",
  storageBucket: "custody-flow.firebasestorage.app",
  messagingSenderId: "852899219082",
  appId: "1:852899219082:web:ad920dbb329294ba21cf73",
  databaseURL: "https://custody-flow-default-rtdb.europe-west1.firebasedatabase.app"
};

// Initialize Firebase
let db = null;
const app = initializeApp(firebaseConfig);
db = getDatabase(app);


document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide icons
    lucide.createIcons();

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

    // --- Firebase Listeners ---
    if(db) {
        const inventoryRef = ref(db, 'inventory');
        onValue(inventoryRef, (snapshot) => {
            inventory = snapshot.val() || {};
            renderInventory();
            updateStats();
        });

        const scansRef = ref(db, 'scans');
        onValue(scansRef, (snapshot) => {
            const data = snapshot.val();
            // Convert object to array and sort by latest
            scans = data ? Object.values(data).sort((a,b) => b.timestamp - a.timestamp) : [];
            renderRecentScans();
            renderScans();
            updateStats();
        });
    } else {
        alert("Configurarea Firebase lipsește! Aplicația va afișa un stoc gol până când adăugăm cheile bazei de date.");
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
        document.getElementById('total-scans').textContent = scans.length;
        document.getElementById('total-products').textContent = Object.keys(inventory).length;
        document.getElementById('last-scan-date').textContent = scans.length > 0 ? scans[0].date : '-';
    }

    // --- File Handling & "OCR" Mock ---
    function setupDropZone(zone, input, actionType) {
        if (!zone) return; 
        
        zone.addEventListener('click', () => input.click());
        
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
            if(!db) {
                alert("Baza de date Firebase nu este conectată! Verifică configurarea.");
                return;
            }
            if(!file) {
                alert("Nu a fost detectat niciun fișier.");
                return;
            }
            alert("Fișier detectat: " + file.name + " (" + file.size + " bytes). Se procesează...");
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
            alert("Eroare la procesarea fișierului: " + err.message);
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
        if(!currentExtraction || !db) return;

        // Push to history in DB
        const scansRef = ref(db, 'scans');
        push(scansRef, currentExtraction);

        // Update Inventory in DB
        const isAdd = currentExtraction.action === 'add';
        
        // We calculate locally and then push the whole state, 
        // In a complex app we would use Firebase Transactions to avoid race conditions.
        let updatedInventory = { ...inventory };

        currentExtraction.items.forEach(item => {
            if(updatedInventory[item.name]) {
                updatedInventory[item.name].qty += isAdd ? item.qty : -item.qty;
            } else if (isAdd) {
                updatedInventory[item.name] = { unit: item.unit, qty: item.qty };
            }
            
            // Remove if 0 or negative
            if(updatedInventory[item.name] && updatedInventory[item.name].qty <= 0) {
                delete updatedInventory[item.name];
            }
        });

        // Save back to DB
        set(ref(db, 'inventory'), updatedInventory);

        closeModal();
        alert(isAdd ? "Datele au fost adăugate cu succes în Cloud!" : "Produsele au fost scăzute din stocul Cloud!");
    };

    // --- Rendering ---
    function renderRecentScans() {
        const tbody = document.querySelector('#recent-scans-table tbody');
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
        const items = Object.entries(inventory);
        
        if(items.length === 0) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="4">Nu există produse în stoc</td></tr>';
            return;
        }

        tbody.innerHTML = items.map(([name, data]) => `
            <tr>
                <td><strong>${name}</strong></td>
                <td>${data.unit}</td>
                <td>${data.qty}</td>
                <td>
                    <button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.7rem;" onclick="removeStock('${name}')">Scade</button>
                </td>
            </tr>
        `).join('');
    }

    window.removeStock = (name) => {
        if(!db) return;
        const amount = prompt(`Cât dorești să scazi din stocul pentru "${name}"?`);
        if(amount && !isNaN(amount)) {
            let updatedInventory = { ...inventory };
            updatedInventory[name].qty -= parseFloat(amount);
            if(updatedInventory[name].qty <= 0) delete updatedInventory[name];
            
            set(ref(db, 'inventory'), updatedInventory);
        }
    };

    function renderScans() {
        const list = document.getElementById('scans-list');
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
        Object.entries(inventory).forEach(([name, data]) => {
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

    // Initial render call (will be overwritten by Firebase when data loads)
    renderRecentScans();
    updateStats();
});
