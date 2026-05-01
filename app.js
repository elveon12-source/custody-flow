document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide icons
    lucide.createIcons();

    // State
    let scans = JSON.parse(localStorage.getItem('custody_scans')) || [];
    let inventory = JSON.parse(localStorage.getItem('custody_inventory')) || {};

    // Elements
    const views = document.querySelectorAll('.view');
    const navItems = document.querySelectorAll('.nav-item');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const modal = document.getElementById('extraction-modal');
    const previewContainer = document.getElementById('extracted-items-preview');

    let currentExtraction = null;

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
    dropZone.addEventListener('click', () => fileInput.click());
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--primary)';
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = 'var(--border-glass)';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        if(files.length > 0) handleFile(files[0]);
    });

    fileInput.addEventListener('change', (e) => {
        if(e.target.files.length > 0) handleFile(e.target.files[0]);
    });

    function handleFile(file) {
        console.log("Processing file:", file.name);
        
        // Simulating smart extraction based on the provided sample document
        // In a real scenario, this would be the output of an OCR/Vision API
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

        showExtraction(realDataResults, file.name);
    }

    function showExtraction(items, fileName) {
        currentExtraction = {
            id: 'AVIZ-' + Math.floor(Math.random() * 10000),
            date: new Date().toLocaleDateString('ro-RO'),
            file: fileName,
            items: items
        };

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

    window.confirmExtraction = () => {
        if(!currentExtraction) return;

        // Add to history
        scans.unshift(currentExtraction);
        localStorage.setItem('custody_scans', JSON.stringify(scans));

        // Update Inventory
        currentExtraction.items.forEach(item => {
            if(inventory[item.name]) {
                inventory[item.name].qty += item.qty;
            } else {
                inventory[item.name] = { unit: item.unit, qty: item.qty };
            }
        });
        localStorage.setItem('custody_inventory', JSON.stringify(inventory));

        closeModal();
        renderRecentScans();
        updateStats();
        alert("Datele au fost adăugate cu succes!");
    };

    // --- Rendering ---
    function renderRecentScans() {
        const tbody = document.querySelector('#recent-scans-table tbody');
        if(scans.length === 0) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="4">Nicio scanare recentă</td></tr>';
            return;
        }

        tbody.innerHTML = scans.slice(0, 5).map(scan => `
            <tr>
                <td>${scan.date}</td>
                <td>${scan.id}</td>
                <td>${scan.items.length} produse</td>
                <td><span style="color: #4ade80;">Procesat</span></td>
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
        const amount = prompt(`Cât dorești să scazi din stocul pentru "${name}"?`);
        if(amount && !isNaN(amount)) {
            inventory[name].qty -= parseFloat(amount);
            if(inventory[name].qty <= 0) delete inventory[name];
            localStorage.setItem('custody_inventory', JSON.stringify(inventory));
            renderInventory();
            updateStats();
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
        a.setAttribute('download', 'stoc_custodie.csv');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    // Initial render
    renderRecentScans();
    updateStats();
});
