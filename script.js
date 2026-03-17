// ========== CONFIGURATION ==========
const CONFIG = {
    API_URL: 'https://api.uspeoplesearch.site/tcpa/v1?x=',
    PROXIES: [
        'https://api.codetabs.com/v1/proxy?quest=',
        'https://corsproxy.io/?',
        'https://thingproxy.freeboard.io/fetch/'
    ],
    BATCH_SIZE: 15,  // 15 parallel requests
    TIMEOUT: 5000     // 5 seconds timeout
};

// ========== STATE ==========
let state = {
    dncNumbers: [],
    cleanNumbers: [],
    isChecking: false,
    abortController: null,
    workingProxy: CONFIG.PROXIES[0],
    totalNumbers: 0,
    processedCount: 0,
    startTime: 0
};

// ========== DOM ELEMENTS ==========
const elements = {
    phoneInput: document.getElementById('phoneInput'),
    fileZone: document.getElementById('fileZone'),
    fileInput: document.getElementById('fileInput'),
    fileName: document.getElementById('fileName'),
    checkBtn: document.getElementById('checkBtn'),
    stopBtn: document.getElementById('stopBtn'),
    progressContainer: document.getElementById('progressContainer'),
    progressFill: document.getElementById('progressFill'),
    progressStatus: document.getElementById('progressStatus'),
    progressSpeed: document.getElementById('progressSpeed'),
    statTotal: document.getElementById('statTotal'),
    statDnc: document.getElementById('statDnc'),
    statClean: document.getElementById('statClean'),
    dncList: document.getElementById('dncList'),
    cleanList: document.getElementById('cleanList'),
    resultsGrid: document.getElementById('resultsGrid'),
    downloadAllBtn: document.getElementById('downloadAllBtn'),
    inputCount: document.getElementById('inputCount')
};

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    updateInputCount();
    testProxies();
});

function initializeEventListeners() {
    // File upload events
    elements.fileZone.addEventListener('click', () => elements.fileInput.click());
    
    elements.fileZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.fileZone.style.background = 'rgba(59, 130, 246, 0.15)';
        elements.fileZone.style.borderColor = '#3b82f6';
    });

    elements.fileZone.addEventListener('dragleave', () => {
        elements.fileZone.style.background = 'rgba(0, 0, 0, 0.3)';
        elements.fileZone.style.borderColor = 'rgba(59, 130, 246, 0.5)';
    });

    elements.fileZone.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.fileZone.style.background = 'rgba(0, 0, 0, 0.3)';
        elements.fileZone.style.borderColor = 'rgba(59, 130, 246, 0.5)';
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
    });

    elements.fileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) processFile(e.target.files[0]);
    });

    elements.phoneInput.addEventListener('input', updateInputCount);
}

// ========== FILE HANDLING ==========
function processFile(file) {
    if (!file.name.match(/\.(txt|csv)$/)) {
        alert('Only .txt or .csv files are allowed!');
        return;
    }
    
    elements.fileName.innerHTML = `<i class="fas fa-file"></i> ${file.name}`;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        elements.phoneInput.value = extractNumbers(e.target.result).join('\n');
        updateInputCount();
    };
    reader.readAsText(file);
}

function extractNumbers(text) {
    return text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(num => num.replace(/\D/g, ''))
        .filter(num => num.length >= 10);
}

function updateInputCount() {
    const numbers = extractNumbers(elements.phoneInput.value);
    elements.inputCount.textContent = numbers.length + ' numbers';
    elements.statTotal.textContent = numbers.length;
}

// ========== PROXY TESTING ==========
async function testProxies() {
    const testUrl = CONFIG.API_URL + '3034708896';
    
    for (let i = 0; i < CONFIG.PROXIES.length; i++) {
        try {
            const res = await fetch(CONFIG.PROXIES[i] + encodeURIComponent(testUrl));
            if (res.ok) {
                state.workingProxy = CONFIG.PROXIES[i];
                console.log('✅ Using proxy:', state.workingProxy);
                break;
            }
        } catch (e) {
            console.log('❌ Proxy failed:', i);
        }
    }
}

// ========== MAIN CHECK FUNCTION ==========
window.startCheck = async function() {
    const numbers = extractNumbers(elements.phoneInput.value);
    
    if (numbers.length === 0) {
        alert('Please enter some numbers or upload a file!');
        return;
    }
    
    // Reset state
    state.dncNumbers = [];
    state.cleanNumbers = [];
    state.totalNumbers = numbers.length;
    state.processedCount = 0;
    state.isChecking = true;
    state.abortController = new AbortController();
    state.startTime = Date.now();
    
    // Update UI
    elements.checkBtn.disabled = true;
    elements.stopBtn.style.display = 'flex';
    elements.progressContainer.style.display = 'block';
    elements.resultsGrid.style.display = 'none';
    elements.downloadAllBtn.style.display = 'none';
    
    // Clear previous results
    elements.dncList.innerHTML = '<div class="empty-message">Checking...</div>';
    elements.cleanList.innerHTML = '<div class="empty-message">Checking...</div>';
    
    // Process in parallel batches
    for (let i = 0; i < numbers.length; i += CONFIG.BATCH_SIZE) {
        if (!state.isChecking) break;
        
        const batch = numbers.slice(i, i + CONFIG.BATCH_SIZE);
        const promises = batch.map(number => checkNumber(number));
        
        const results = await Promise.allSettled(promises);
        
        results.forEach(result => {
            if (result.status === 'fulfilled') {
                const { number, isDnc } = result.value;
                
                if (isDnc) {
                    state.dncNumbers.push(number);
                } else {
                    state.cleanNumbers.push(number);
                }
            } else {
                // API fail ho to Clean treat karo
                state.cleanNumbers.push(batch[state.processedCount % batch.length]);
            }
            
            state.processedCount++;
            updateProgress(numbers.length);
        });
    }
    
    finishCheck();
};

async function checkNumber(phone) {
    try {
        const url = state.workingProxy + encodeURIComponent(CONFIG.API_URL + phone);
        const response = await fetch(url, {
            signal: state.abortController.signal,
            timeout: CONFIG.TIMEOUT
        });
        
        if (response.ok) {
            const text = await response.text();
            
            try {
                const data = JSON.parse(text);
                
                // Check if it's DNC
                const isDnc = data.listed === 'Yes' || 
                              data.ndnc === 'Yes' || 
                              data.sdnc === 'Yes';
                
                return { number: phone, isDnc };
            } catch (e) {
                return { number: phone, isDnc: false };
            }
        }
    } catch (e) {
        console.log('⚠️ Error checking', phone);
    }
    
    return { number: phone, isDnc: false };
}

function updateProgress(total) {
    const percent = (state.processedCount / total) * 100;
    elements.progressFill.style.width = percent + '%';
    
    const elapsed = (Date.now() - state.startTime) / 1000;
    const speed = Math.round(state.processedCount / elapsed) || 0;
    
    elements.progressStatus.textContent = `Processing: ${state.processedCount}/${total}`;
    elements.progressSpeed.textContent = `${speed}/sec`;
    
    // Update live stats
    elements.statTotal.textContent = total;
    elements.statDnc.textContent = state.dncNumbers.length;
    elements.statClean.textContent = state.cleanNumbers.length;
}

function finishCheck() {
    state.isChecking = false;
    elements.checkBtn.disabled = false;
    elements.stopBtn.style.display = 'none';
    
    // Display DNC numbers
    if (state.dncNumbers.length > 0) {
        elements.dncList.innerHTML = state.dncNumbers.map(num => 
            `<div class="number-item dnc-item">${num}</div>`
        ).join('');
    } else {
        elements.dncList.innerHTML = '<div class="empty-message">No DNC numbers found</div>';
    }
    
    // Display Clean numbers
    if (state.cleanNumbers.length > 0) {
        elements.cleanList.innerHTML = state.cleanNumbers.map(num => 
            `<div class="number-item clean-item">${num}</div>`
        ).join('');
    } else {
        elements.cleanList.innerHTML = '<div class="empty-message">No clean numbers found</div>';
    }
    
    // Show results
    elements.resultsGrid.style.display = 'grid';
    
    if (state.dncNumbers.length > 0 || state.cleanNumbers.length > 0) {
        elements.downloadAllBtn.style.display = 'flex';
    }
}

// ========== CONTROL FUNCTIONS ==========
window.stopCheck = function() {
    if (state.abortController) {
        state.abortController.abort();
        state.isChecking = false;
        finishCheck();
    }
};

window.resetAll = function() {
    window.stopCheck();
    clearInput();
    state.dncNumbers = [];
    state.cleanNumbers = [];
    elements.statTotal.textContent = '0';
    elements.statDnc.textContent = '0';
    elements.statClean.textContent = '0';
    elements.resultsGrid.style.display = 'none';
    elements.progressContainer.style.display = 'none';
    elements.downloadAllBtn.style.display = 'none';
};

window.clearInput = function() {
    elements.phoneInput.value = '';
    elements.fileName.innerHTML = '<i class="fas fa-file"></i> No file selected';
    updateInputCount();
};

// ========== COPY / DOWNLOAD FUNCTIONS ==========
window.copyResults = async function(type) {
    const numbers = type === 'dnc' ? state.dncNumbers : state.cleanNumbers;
    
    if (numbers.length === 0) {
        alert('No numbers to copy!');
        return;
    }
    
    try {
        await navigator.clipboard.writeText(numbers.join('\n'));
        alert(`${type.toUpperCase()} numbers copied to clipboard!`);
    } catch (e) {
        alert('Failed to copy numbers');
    }
};

window.downloadResults = function(type) {
    const numbers = type === 'dnc' ? state.dncNumbers : state.cleanNumbers;
    
    if (numbers.length === 0) {
        alert('No numbers to download!');
        return;
    }
    
    const content = numbers.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}_numbers.txt`;
    a.click();
    URL.revokeObjectURL(url);
};

window.downloadAll = function() {
    const content = `DNC NUMBERS (${state.dncNumbers.length})\n${state.dncNumbers.join('\n')}\n\nCLEAN NUMBERS (${state.cleanNumbers.length})\n${state.cleanNumbers.join('\n')}`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'all_results.txt';
    a.click();
    URL.revokeObjectURL(url);
};
