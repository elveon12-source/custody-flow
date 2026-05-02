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

    // --- Mode Management ---
    const storageModeSelect = document.getElementById('storage-mode');
    const currentMode = localStorage.getItem('custody_storage_mode') || 'local';
    
    if(storageModeSelect) {
        storageModeSelect.value = currentMode;
        storageModeSelect.addEventListener('change', (e) => {
            localStorage.setItem('custody_storage_mode', e.target.value);
            alert("Modul de stocare s-a schimbat. Se reîncarcă aplicația...");
            window.location.reload();
        });
    }

    // --- Firebase Listeners & Fallback ---
    if(currentMode === 'cloud' && db) {
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

    async function handleFile(file, actionType) {
        try {
            if(!file) return;
            console.log("Processing file:", file.name);

            // Show scanning status in modal
            modal.style.display = 'flex';
            document.querySelector('.modal-content h2').textContent = "Se scanează poza...";
            previewContainer.innerHTML = `
                <div style="text-align: center; padding: 20px 0; color: var(--text-muted);">
                    <div style="font-size: 1rem; margin-bottom: 10px; color: var(--primary);">Se citește textul din poză prin OCR...</div>
                    <div style="font-size: 0.8rem;">Te rugăm să aștepți câteva secunde.</div>
                </div>
            `;

            // Read the image using Tesseract.js
            if (window.Tesseract) {
                const result = await Tesseract.recognize(file, 'ron', {
                    logger: m => console.log(m)
                });
                
                const text = result.data.text;
                console.log("Extracted text:", text);

                const realDataResults = parseOCRText(text);
                showExtraction(realDataResults, file.name, actionType);
            } else {
                console.error("Tesseract library not loaded.");
                const fallbackItems = [{ id: 1, name: "PRODUS DIN POZĂ", unit: "BUC", qty: 1.000 }];
                showExtraction(fallbackItems, file.name, actionType);
            }
        } catch (err) {
            console.error(err);
            alert("Eroare la scanare: " + err.message);
            const fallbackItems = [{ id: 1, name: "PRODUS DIN POZĂ", unit: "BUC", qty: 1.000 }];
            showExtraction(fallbackItems, file.name, actionType);
        }
    }

    function parseOCRText(text) {
        if (!text) return [];
        const lines = text.split('\n');
        const items = [];

        lines.forEach(line => {
            line = line.trim();
            if (line.length < 3) return; // Skip very short lines

            // More lenient pattern matching: [name] [UM (optional)] [qty]
            const match = line.match(/^(.+?)\s*(KG|BUC|PAL|BAX|M|MP|ML|TON)?\s*(\d+[\.,]?\d*)$/i);
            if (match) {
                const name = match[1].trim();
                const unit = match[2] ? match[2].toUpperCase() : "BUC";
                const qty = parseFloat(match[3].replace(',', '.')) || 1;
                
                if (name && !isNaN(qty)) {
                    items.push({ name, unit, qty });
                }
            } else {
                // Last word/number matching fallback
                const fallbackMatch = line.match(/^(.+?)\s+(\d+[\.,]?\d*)\s*$/);
                if (fallbackMatch) {
                    const name = fallbackMatch[1].trim();
                    const qty = parseFloat(fallbackMatch[2].replace(',', '.')) || 1;
                    if (name) {
                        items.push({ name, unit: "BUC", qty });
                    }
                } else if (line.length > 5) {
                    // Extract full line if nothing else matched
                    items.push({ name: line, unit: "BUC", qty: 1 });
                }
            }
        });

        // Ensure we always have at least one editable row for fallback
        if (items.length === 0) {
            items.push({ name: "PRODUS DIN POZĂ", unit: "BUC", qty: 1.000 });
        }
        return items;
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
        document.querySelector('.modal-content h2').textContent = isAdd ? 'Verifică Date (Intrare)' : 'Verifică Date (Ieșire)';
        
        const btnConfirm = document.querySelector('.modal-footer button:last-child');
        btnConfirm.textContent = isAdd ? 'Confirmă și Adaugă' : 'Confirmă și Scade';
        btnConfirm.className = isAdd ? 'btn btn-primary' : 'btn btn-outline-danger';
        
        renderExtractedItems(items);
        modal.style.display = 'flex';
    }

    function renderExtractedItems(items) {
        previewContainer.innerHTML = `
            <div style="margin-bottom: 10px; font-size: 0.8rem; color: var(--text-muted); display: flex; gap: 10px;">
                <span style="flex: 2;">Denumire Produs</span>
                <span style="flex: 1;">UM</span>
                <span style="flex: 1;">Cantitate</span>
                <span style="width: 30px;"></span>
            </div>
            <div id="items-rows-container">
                ${items.map((item, index) => `
                    <div class="extract-row" style="display: flex; gap: 10px; margin-bottom: 8px;" data-index="${index}">
                        <input type="text" class="item-name" value="${item.name}" style="flex: 2; padding: 6px; font-size: 0.8rem; border-radius: 6px; border: 1px solid var(--border-glass); background: rgba(0,0,0,0.3); color: white;" placeholder="Nume produs">
                        <input type="text" class="item-unit" value="${item.unit}" style="flex: 1; padding: 6px; font-size: 0.8rem; border-radius: 6px; border: 1px solid var(--border-glass); background: rgba(0,0,0,0.3); color: white;" placeholder="UM">
                        <input type="number" class="item-qty" value="${item.qty}" style="flex: 1; padding: 6px; font-size: 0.8rem; border-radius: 6px; border: 1px solid var(--border-glass); background: rgba(0,0,0,0.3); color: white;" placeholder="Cantitate" step="0.001">
                        <button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.7rem; border-color: #ef4444; color: #ef4444;" onclick="removeExtractedItem(${index})">X</button>
                    </div>
                `).join('')}
            </div>
            <button class="btn btn-outline" style="width: 100%; margin-top: 10px; font-size: 0.8rem; border-color: var(--primary); color: var(--primary);" onclick="addExtractedRow()">+ Adaugă Produs Nou</button>
        `;
    }

    window.removeExtractedItem = (index) => {
        if(!currentExtraction) return;
        currentExtraction.items.splice(index, 1);
        renderExtractedItems(currentExtraction.items);
    };

    window.addExtractedRow = () => {
        if(!currentExtraction) return;
        currentExtraction.items.push({ name: "", unit: "BUC", qty: 1 });
        renderExtractedItems(currentExtraction.items);
    };

    window.closeModal = () => {
        modal.style.display = 'none';
        currentExtraction = null;
    };

    window.confirmExtraction = async () => {
        if(!currentExtraction) return;

        // Read updated values from DOM inputs
        const rows = document.querySelectorAll('#items-rows-container .extract-row');
        currentExtraction.items = [];
        
        rows.forEach(row => {
            const name = row.querySelector('.item-name').value.trim();
            const unit = row.querySelector('.item-unit').value.trim();
            const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
            
            if(name && qty > 0) {
                currentExtraction.items.push({ name, unit, qty });
            }
        });
        
        if (currentExtraction.items.length === 0) {
            alert("Te rugăm să adaugi cel puțin un produs valid.");
            return;
        }

        const isAdd = currentExtraction.action === 'add';

        if(db) {
            try {
                const scansRef = ref(db, 'scans');
                push(scansRef, currentExtraction);

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

                set(ref(db, 'inventory'), updatedInventory);
                closeModal();
                alert(isAdd ? "Datele au fost adăugate cu succes în Cloud!" : "Produsele au fost scăzute din stocul Cloud!");
            } catch (err) {
                console.error("Firebase write failed", err);
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
