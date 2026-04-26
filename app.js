const defaultTasks = [
    { id: '1', name: 'فجر', category: 'faraidh', type: 'checkbox', target: null, createdAt: new Date().toISOString(), isSystem: true },
    { id: '2', name: 'ظہر', category: 'faraidh', type: 'checkbox', target: null, createdAt: new Date().toISOString(), isSystem: true },
    { id: '3', name: 'عصر', category: 'faraidh', type: 'checkbox', target: null, createdAt: new Date().toISOString(), isSystem: true },
    { id: '4', name: 'مغرب', category: 'faraidh', type: 'checkbox', target: null, createdAt: new Date().toISOString(), isSystem: true },
    { id: '5', name: 'عشاء', category: 'faraidh', type: 'checkbox', target: null, createdAt: new Date().toISOString(), isSystem: true },
    { id: '6', name: 'تہجد', category: 'nawafil', type: 'checkbox', target: null, createdAt: new Date().toISOString() },
    { id: '7', name: 'تلاوتِ قرآن (صفحات)', category: 'tilawat', type: 'counter', target: 5, createdAt: new Date().toISOString() },
    { id: '8', name: 'صبح و شام کے اذکار', category: 'adhkar', type: 'checkbox', target: null, createdAt: new Date().toISOString() }
];

const storedTasks = JSON.parse(localStorage.getItem('islamic_tasks'));
let finalTasks = (!storedTasks || storedTasks.length === 0) ? [...defaultTasks] : storedTasks;
// Ensure the 5 system Faraidh tasks are ALWAYS there
defaultTasks.filter(dt => dt.isSystem).forEach(dt => {
    if (!finalTasks.find(t => t.id === dt.id)) {
        finalTasks.push(dt);
    }
});
finalTasks.sort((a,b) => parseInt(a.id) - parseInt(b.id));

const State = {
    tasks: finalTasks,
    logs: JSON.parse(localStorage.getItem('islamic_logs')) || [],
    quran: JSON.parse(localStorage.getItem('islamic_quran')) || { surahs: [], paras: [], lastPage: 2 },
    audioContext: null,
    clickOscillator: null,

    initAudio() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    },

    playClick() {
        if (localStorage.getItem('tasbeeh_audio') !== 'true') return;
        this.initAudio();
        
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, this.audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.1);
        
        gain.gain.setValueAtTime(0.1, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
        
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        
        osc.start();
        osc.stop(this.audioContext.currentTime + 0.1);
    },

    saveTasks() {
        localStorage.setItem('islamic_tasks', JSON.stringify(this.tasks));
        this.triggerSync();
    },
    saveLogs() {
        localStorage.setItem('islamic_logs', JSON.stringify(this.logs));
        this.autoBackup();
        this.triggerSync();
    },
    saveQuran() {
        localStorage.setItem('islamic_quran', JSON.stringify(this.quran));
        this.triggerSync();
    },

    autoBackup() {
        const lastBackup = localStorage.getItem('last_auto_backup');
        const now = Date.now();
        // 24 hours backup
        if (!lastBackup || now - parseInt(lastBackup) > 24 * 60 * 60 * 1000) {
            const data = {
                tasks: this.tasks,
                logs: this.logs,
                quran: this.quran,
                settings: {
                    method: localStorage.getItem('islamic_method'),
                    school: localStorage.getItem('islamic_school'),
                    theme: document.body.classList.contains('light-theme') ? 'light' : 'dark',
                    tasbeeh_audio: localStorage.getItem('tasbeeh_audio')
                },
                backupDate: new Date().toISOString()
            };
            localStorage.setItem('auto_backup_data', JSON.stringify(data));
            localStorage.setItem('last_auto_backup', now.toString());
            console.log('Auto-backup created locally');
        }
    },

    async triggerSync() {
        if (typeof GoogleDriveSync !== 'undefined') {
            await GoogleDriveSync.sync();
        }
    }
};

// ─────────────── Google Drive Sync Module ───────────────
const GoogleDriveSync = {
    CLIENT_ID: '', // User needs to provide this
    API_KEY: '',    // User needs to provide this
    DISCOVERY_DOC: 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
    SCOPES: 'https://www.googleapis.com/auth/drive.file',
    
    tokenClient: null,
    gapiInited: false,
    gisInited: false,
    accessToken: localStorage.getItem('gdrive_token') || null,
    fileId: localStorage.getItem('gdrive_file_id') || null,

    init() {
        if (typeof gapi === 'undefined') return;
        gapi.load('client', async () => {
            await gapi.client.init({
                apiKey: this.API_KEY,
                discoveryDocs: [this.DISCOVERY_DOC],
            });
            this.gapiInited = true;
            this.updateUI();
        });

        if (typeof google === 'undefined') return;
        this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: this.CLIENT_ID,
            scope: this.SCOPES,
            callback: (resp) => {
                if (resp.error) return;
                this.accessToken = resp.access_token;
                localStorage.setItem('gdrive_token', this.accessToken);
                this.updateUI();
                this.sync();
            },
        });
        this.gisInited = true;
    },

    async authenticate() {
        if (!this.tokenClient) return;
        // Request token
        this.tokenClient.requestAccessToken({ prompt: 'consent' });
    },

    async sync() {
        if (!this.accessToken || !navigator.onLine) return;
        
        try {
            const data = {
                tasks: State.tasks,
                logs: State.logs,
                quran: State.quran,
                settings: {
                    method: localStorage.getItem('islamic_method'),
                    school: localStorage.getItem('islamic_school'),
                    tasbeeh_audio: localStorage.getItem('tasbeeh_audio')
                },
                lastSync: new Date().toISOString()
            };

            const fileName = 'my_day_routine_backup.json';
            
            // If we don't have fileId, search for it
            if (!this.fileId) {
                const response = await gapi.client.drive.files.list({
                    q: `name = '${fileName}' and trashed = false`,
                    fields: 'files(id, name)',
                });
                const files = response.result.files;
                if (files && files.length > 0) {
                    this.fileId = files[0].id;
                    localStorage.setItem('gdrive_file_id', this.fileId);
                }
            }

            const boundary = '-------314159265358979323846';
            const delimiter = "\r\n--" + boundary + "\r\n";
            const close_delim = "\r\n--" + boundary + "--";

            const metadata = {
                'name': fileName,
                'mimeType': 'application/json'
            };

            const password = localStorage.getItem('backup_password');
            const jsonStr = JSON.stringify(data);
            const finalData = password ? { encrypted: true, content: xorEncrypt(jsonStr, password) } : data;

            const multipartRequestBody =
                delimiter +
                'Content-Type: application/json\r\n\r\n' +
                JSON.stringify(metadata) +
                delimiter +
                'Content-Type: application/json\r\n\r\n' +
                JSON.stringify(finalData) +
                close_delim;

            if (this.fileId) {
                // Update existing file
                await fetch(`https://www.googleapis.com/upload/drive/v3/files/${this.fileId}?uploadType=multipart`, {
                    method: 'PATCH',
                    headers: new Headers({
                        'Authorization': 'Bearer ' + this.accessToken,
                        'Content-Type': 'multipart/related; boundary=' + boundary
                    }),
                    body: multipartRequestBody
                });
            } else {
                // Create new file
                const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                    method: 'POST',
                    headers: new Headers({
                        'Authorization': 'Bearer ' + this.accessToken,
                        'Content-Type': 'multipart/related; boundary=' + boundary
                    }),
                    body: multipartRequestBody
                });
                const file = await res.json();
                this.fileId = file.id;
                localStorage.setItem('gdrive_file_id', this.fileId);
            }
            
            console.log('Synced to Google Drive successfully');
            this.updateUI('synced');
        } catch (err) {
            console.error('Sync failed', err);
            if (err.status === 401) {
                // Token expired
                this.accessToken = null;
                this.updateUI();
            }
        }
    },

    async download() {
        if (!this.accessToken || !navigator.onLine) {
            alert('انٹرنیٹ کنکشن یا گوگل ڈرائیو سے منسلک ہونا ضروری ہے۔');
            return;
        }

        try {
            const fileName = 'my_day_routine_backup.json';
            
            // 1. Find the file
            const response = await gapi.client.drive.files.list({
                q: `name = '${fileName}' and trashed = false`,
                fields: 'files(id, name)',
            });
            
            const files = response.result.files;
            if (!files || files.length === 0) {
                alert('گوگل ڈرائیو پر کوئی بیک اپ فائل نہیں ملی۔');
                return;
            }

            const fileId = files[0].id;
            
            // 2. Download the content
            const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                headers: new Headers({
                    'Authorization': 'Bearer ' + this.accessToken
                })
            });
            
            let data = await res.json();
            
            // 3. Handle Decryption
            if (data.encrypted) {
                const password = localStorage.getItem('backup_password');
                if (!password) {
                    const inputPwd = prompt('یہ بیک اپ انکرپٹڈ ہے۔ براہ کرم ڈکرپشن پاس ورڈ درج کریں:');
                    if (!inputPwd) return;
                    const decryptedStr = xorDecrypt(data.content, inputPwd);
                    try {
                        data = JSON.parse(decryptedStr);
                        // Save password for future use if successful
                        localStorage.setItem('backup_password', inputPwd);
                    } catch (e) {
                        alert('غلط پاس ورڈ یا ڈیٹا خراب ہو چکا ہے۔');
                        return;
                    }
                } else {
                    const decryptedStr = xorDecrypt(data.content, password);
                    try {
                        data = JSON.parse(decryptedStr);
                    } catch (e) {
                        alert('پاس ورڈ درست نہیں ہے یا ڈیٹا خراب ہو چکا ہے۔');
                        return;
                    }
                }
            }

            // 4. Restore data
            if (confirm('بیک اپ مل گیا ہے۔ کیا آپ اسے بحال کرنا چاہتے ہیں؟ موجودہ ڈیٹا تبدیل ہو جائے گا۔')) {
                if (data.tasks) localStorage.setItem('islamic_tasks', JSON.stringify(data.tasks));
                if (data.logs) localStorage.setItem('islamic_logs', JSON.stringify(data.logs));
                if (data.quran) localStorage.setItem('islamic_quran', JSON.stringify(data.quran));
                if (data.settings) {
                    if (data.settings.method) localStorage.setItem('islamic_method', data.settings.method);
                    if (data.settings.school) localStorage.setItem('islamic_school', data.settings.school);
                    if (data.settings.tasbeeh_audio) localStorage.setItem('tasbeeh_audio', data.settings.tasbeeh_audio);
                }
                alert('ڈیٹا کامیابی سے بحال کر دیا گیا ہے۔');
                window.location.reload();
            }

        } catch (err) {
            console.error('Download failed', err);
            alert('بیک اپ لوڈ کرنے میں ناکامی ہوئی۔');
        }
    },

    updateUI(status = '') {
        const syncText = document.getElementById('sync-text');
        const authBtn = document.getElementById('gdrive-auth-btn');
        if (!syncText || !authBtn) return;

        if (this.accessToken) {
            syncText.innerHTML = status === 'synced' 
                ? 'گوگل ڈرائیو: سنک ہو گیا ✓' 
                : 'گوگل ڈرائیو: منسلک ہے (سنک ہو رہا ہے...)';
            authBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> <span>دوبارہ سنک کریں</span>';
            authBtn.style.background = '#34a853';
        } else {
            syncText.textContent = 'گوگل ڈرائیو سے منسلک نہیں ہے';
            authBtn.innerHTML = '<i class="fa-brands fa-google"></i> <span>گوگل ڈرائیو سے منسلک کریں (Connect)</span>';
            authBtn.style.background = '#4285F4';
        }
    }
};

window.handleGDriveAuth = function() {
    if (!GoogleDriveSync.accessToken) {
        GoogleDriveSync.authenticate();
    } else {
        GoogleDriveSync.sync();
    }
};

// Initialize GDrive on load
window.addEventListener('load', () => {
    setTimeout(() => GoogleDriveSync.init(), 2000);
});

// Router & View Management
const mainContent = document.getElementById('main-content');
const navButtons = document.querySelectorAll('.nav-btn');

// Offline/Online Status Management
function updateOnlineStatus() {
    const strip = document.querySelector('.top-strip');
    if (!strip) return;
    
    if (navigator.onLine) {
        strip.innerHTML = '';
        strip.style.background = 'var(--primary)';
    } else {
        strip.innerHTML = '<div style="text-align:center; font-size:0.7rem; color:#fff; padding:2px; font-family:\'Noto Nastaliq Urdu\', serif;">آف لائن موڈ (ڈیٹا محفوظ ہے)</div>';
        strip.style.background = '#ff6b6b';
    }
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

window.saveBackupPassword = function() {
    const pwd = document.getElementById('backup-password').value;
    localStorage.setItem('backup_password', pwd);
    alert('پاس ورڈ محفوظ کر لیا گیا ہے۔ اب آپ کا بیک اپ انکرپٹڈ ہوگا۔');
};

function xorEncrypt(text, key) {
    if (!key) return text;
    let result = '';
    for (let i = 0; i < text.length; i++) {
        result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return btoa(unescape(encodeURIComponent(result)));
}

function xorDecrypt(encoded, key) {
    if (!key) return encoded;
    try {
        let text = decodeURIComponent(escape(atob(encoded)));
        let result = '';
        for (let i = 0; i < text.length; i++) {
            result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        return result;
    } catch (e) {
        console.error("Decryption failed", e);
        return encoded;
    }
}

const Views = {
    daily() {
        return `
            <div class="view-section">
                <!-- PWA Install Banner (Hidden by default) -->
                <div id="install-banner" class="glass" style="display: none; padding: 15px; margin-bottom: 20px; border: 1px solid var(--primary); background: rgba(253, 191, 36, 0.1); align-items: center; justify-content: space-between; gap: 10px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <i class="fa-solid fa-mobile-screen-button" style="font-size: 1.5rem; color: var(--primary);"></i>
                        <div>
                            <strong style="display: block; font-size: 0.9rem;">ایپ انسٹال کریں</strong>
                            <span style="font-size: 0.75rem; color: var(--text-muted);">بہتر تجربے اور فوری رسائی کے لیے</span>
                        </div>
                    </div>
                    <button class="btn primary-btn" style="width: auto; padding: 8px 15px; font-size: 0.85rem;" onclick="handleInstallClick()">انسٹال</button>
                </div>

                <!-- Prayer Times Header Widget -->
                <div id="prayer-times-widget" class="glass" style="padding: 15px; margin-bottom: 20px; border-width: 1px; cursor:pointer;" onclick="openPrayerModal()">
                    <div id="prayer-times-content" style="display: flex; flex-direction: column; align-items: center; gap: 15px; font-family: 'Inter', sans-serif;">
                        <span style="color: var(--text-muted); font-size: 0.8rem;">اوقات معلوم کیے جا رہے ہیں...</span>
                    </div>
                </div>

                <h2 style="font-size: 1.2rem; margin-top: 10px; font-family: 'Noto Nastaliq Urdu', serif;">آج کا چیک لسٹ</h2>
                <div id="daily-list">
                    <!-- Daily tasks will render here -->
                </div>
            </div>
        `;
    },
    setup() {
        const isLight = document.body.classList.contains('light-theme');
        return `
             <div class="view-section">
                <h2>معمولات کی ترتیب</h2>

                <!-- Theme Toggle -->
                <div class="glass" style="padding: 15px; margin-bottom: 20px; border-width: 1px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 0.9rem; color: var(--text-main);">ایپ کا تھیم (Light/Dark)</span>
                    <button id="theme-toggle" class="btn" style="width: auto; padding: 5px 15px; background: rgba(251, 191, 36, 0.1); border: 1px solid var(--primary); color: var(--primary); border-radius: 20px; font-size: 0.8rem; display: flex; align-items: center; gap: 8px;" onclick="toggleTheme()">
                        <i class="fa-solid ${isLight ? 'fa-sun' : 'fa-moon'}"></i>
                        <span>${isLight ? 'لائٹ موڈ' : 'ڈارک موڈ'}</span>
                    </button>
                </div>

                <!-- Backup Encryption -->
                <h3 style="margin-bottom: 10px; margin-top: 0; font-size: 1rem; color: var(--primary);">بیک اپ انکرپشن</h3>
                <div class="glass" style="padding: 15px; margin-bottom: 20px; border-width: 1px;">
                    <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 10px;">گوگل ڈرائیو بیک اپ کو محفوظ بنانے کے لیے ایک خفیہ پاس ورڈ سیٹ کریں۔ (اختیاری)</p>
                    <div style="display: flex; gap: 5px;">
                        <input type="password" id="backup-password" value="${localStorage.getItem('backup_password') || ''}" placeholder="خفیہ پاس ورڈ" style="flex:1; padding:0.5rem; background:rgba(0,0,0,0.5); border:1px solid var(--card-border); border-radius:5px; color:#fff;" />
                        <button class="btn primary-btn" style="width:auto; padding: 0.5rem 1rem;" onclick="saveBackupPassword()">محفوظ</button>
                    </div>
                </div>

        <!-- Backup & Restore -->
        <h3 style="margin-bottom: 10px; margin-top: 0; font-size: 1rem; color: var(--primary);">ڈیٹا بیک اپ اور سنک (Google Drive)</h3>
        <div class="glass" style="padding: 15px; margin-bottom: 20px; border-width: 1px;">
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 12px; line-height: 1.6;">اپنے ڈیٹا کو گوگل ڈرائیو کے ساتھ سنک کریں تاکہ یہ خود بخود محفوظ ہوتا رہے۔</p>
            
            <div id="gdrive-sync-status" style="margin-bottom: 12px; padding: 10px; border-radius: 8px; background: rgba(0,0,0,0.2); font-size: 0.85rem; display: flex; align-items: center; gap: 10px;">
                <i class="fa-brands fa-google-drive" style="color: #34a853; font-size: 1.2rem;"></i>
                <span id="sync-text" style="color: var(--text-main);">گوگل ڈرائیو سے منسلک نہیں ہے</span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 10px;">
                <button id="gdrive-auth-btn" class="btn" style="width: 100%; background: #4285F4; color: white; border: none; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; gap: 8px;" onclick="handleGDriveAuth()">
                    <i class="fa-brands fa-google"></i>
                    <span>گوگل ڈرائیو سے منسلک کریں (Connect)</span>
                </button>
                
                <button class="btn" style="width: 100%; background: rgba(66, 133, 244, 0.1); border: 1px solid #4285F4; color: #4285F4; font-size: 0.85rem;" onclick="GoogleDriveSync.download()">📥 گوگل ڈرائیو سے ڈیٹا لوڈ کریں (Restore)</button>
                
                <button class="btn" style="width: 100%; background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; color: #10b981; font-size: 0.85rem;" onclick="restoreFromAutoBackup()">🔄 آٹو بیک اپ سے بحال کریں (Restore Auto)</button>
            </div>
        </div>

                <!-- Prayer Times Settings -->
                <h3 style="margin-bottom: 10px; margin-top: 20px; font-size: 1rem; color: var(--primary);">آڈیو سیٹنگز</h3>
                <div class="glass" style="padding: 15px; margin-bottom: 20px; border-width: 1px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 0.9rem; color: var(--text-main);">تسبیح پر آواز (Click Sound)</span>
                    <div class="toggle-switch">
                        <input type="checkbox" id="audio-toggle" ${localStorage.getItem('tasbeeh_audio') === 'true' ? 'checked' : ''} onchange="localStorage.setItem('tasbeeh_audio', this.checked)">
                    </div>
                </div>

                <h3 style="margin-bottom: 10px; margin-top: 20px; font-size: 1rem; color: var(--primary);">اوقاتِ نماز کی سیٹنگز</h3>
                <div class="glass" style="padding: 15px; margin-bottom: 20px; border-width: 1px;">
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-size: 0.85rem;">حساب کتاب کا طریقہ (Method)</label>
                        <select id="prayer-method" style="width: 100%; padding: 8px; background: rgba(0,0,0,0.3); border: 1px solid var(--card-border); border-radius: 5px; color: #fff; font-family: inherit;">
                            <option value="1">University of Islamic Sciences, Karachi</option>
                            <option value="2">Islamic Society of North America (ISNA)</option>
                            <option value="3">Muslim World League (MWL)</option>
                            <option value="4">Umm al-Qura University, Makkah</option>
                            <option value="5">Egyptian General Authority of Survey</option>
                            <option value="8">Gulf Region</option>
                            <option value="9">Kuwait</option>
                            <option value="10">Qatar</option>
                            <option value="11">Majlis Ugama Islam Singapura, Singapore</option>
                            <option value="12">Union Organization Islamique de France</option>
                            <option value="13">Diyanet İşleri Başkanlığı, Turkey</option>
                            <option value="14">Spiritual Administration of Muslims of Russia</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label style="display: block; margin-bottom: 5px; font-size: 0.85rem;">فقہ (عصر کے لیے)</label>
                        <select id="prayer-school" style="width: 100%; padding: 8px; background: rgba(0,0,0,0.3); border: 1px solid var(--card-border); border-radius: 5px; color: #fff; font-family: inherit;">
                            <option value="1">حنفی (Hanafi)</option>
                            <option value="0">شافعی، مالکی، حنبلی (Standard)</option>
                        </select>
                    </div>
                </div>

                <div class="glass form-container" style="border-width: 1px;">
                    <form id="setup-form">
                        <div class="form-group">
                            <label>نام (مثلاً فجر، استغفار)</label>
                            <input type="text" id="task-name" required />
                        </div>
                        <div class="form-group">
                            <label>کیٹیگری</label>
                            <select id="task-category">
                                <option value="nawafil">نوافل</option>
                                <option value="tilawat">تلاوت</option>
                                <option value="adhkar">اذکار</option>
                                <option value="other">دیگر</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>قسم</label>
                            <select id="task-type">
                                <option value="checkbox">صرف ٹک کریں</option>
                                <option value="counter">تعداد (گِن کر)</option>
                                <option value="hybrid">گننا اور ٹک کرنا دونوں</option>
                            </select>
                        </div>
                        <div class="form-group" id="target-count-group" style="display: none;">
                            <label>تعداد (Target)</label>
                            <input type="number" id="task-target" placeholder="100" min="1" />
                        </div>
                        <button type="submit" class="btn primary-btn">شامل کریں</button>
                    </form>
                </div>
                
                <h3 class="section-title" style="margin-top: 1.5rem; margin-bottom: 0.8rem;">موجودہ معمولات</h3>
                
                <!-- Search Bar -->
                <div class="glass" style="margin-bottom: 15px; padding: 5px 15px; display: flex; align-items: center; border-width: 1px;">
                    <i class="fa-solid fa-magnifying-glass" style="color: var(--text-muted); margin-left: 10px;"></i>
                    <input type="text" id="task-search" placeholder="تلاش کریں..." style="background: none; border: none; padding: 8px; color: var(--text-main); font-family: inherit; width: 100%; outline: none;" oninput="renderSetupTasks()" />
                </div>

                <div id="setup-tasks-list">
                    <!-- Configured tasks rendered here -->
                </div>
            </div>
        `;
    },
    qaza() {
         return `
             <div class="view-section">
                <!-- Heading removed since pie chart has it -->
                <div id="qaza-list">
                </div>
                
                <h3 style="margin-top:30px; font-size: 1.1rem; color: var(--primary); text-align: center;">سابقہ قضا شامل کریں (بلک)</h3>
                <div class="glass form-container" style="margin-top:10px; border-width: 1px;">
                    <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:10px; margin-bottom:15px; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px;">
                        <div style="display:flex; flex-direction:column; align-items:center; gap:5px;">
                            <label style="font-size:0.75rem;">فجر</label>
                            <input type="checkbox" id="bulk-prayer-1" checked style="width:18px; height:18px; cursor:pointer;" />
                        </div>
                        <div style="display:flex; flex-direction:column; align-items:center; gap:5px;">
                            <label style="font-size:0.75rem;">ظہر</label>
                            <input type="checkbox" id="bulk-prayer-2" checked style="width:18px; height:18px; cursor:pointer;" />
                        </div>
                        <div style="display:flex; flex-direction:column; align-items:center; gap:5px;">
                            <label style="font-size:0.75rem;">عصر</label>
                            <input type="checkbox" id="bulk-prayer-3" checked style="width:18px; height:18px; cursor:pointer;" />
                        </div>
                        <div style="display:flex; flex-direction:column; align-items:center; gap:5px;">
                            <label style="font-size:0.75rem;">مغرب</label>
                            <input type="checkbox" id="bulk-prayer-4" checked style="width:18px; height:18px; cursor:pointer;" />
                        </div>
                        <div style="display:flex; flex-direction:column; align-items:center; gap:5px;">
                            <label style="font-size:0.75rem;">عشاء</label>
                            <input type="checkbox" id="bulk-prayer-5" checked style="width:18px; height:18px; cursor:pointer;" />
                        </div>
                    </div>
                    <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; margin-bottom:15px;">
                        <div>
                            <label style="color:var(--text-main); font-size:0.8rem; display:block; margin-bottom:5px;">سال</label>
                            <input type="number" id="bulk-years" placeholder="0" min="0" style="width:100%; padding:0.5rem; background:rgba(0,0,0,0.5); border:1px solid var(--card-border); border-radius:5px; color:#fff; font-family: inherit; text-align:center;" />
                        </div>
                        <div>
                            <label style="color:var(--text-main); font-size:0.8rem; display:block; margin-bottom:5px;">مہینے</label>
                            <input type="number" id="bulk-months" placeholder="0" min="0" style="width:100%; padding:0.5rem; background:rgba(0,0,0,0.5); border:1px solid var(--card-border); border-radius:5px; color:#fff; font-family: inherit; text-align:center;" />
                        </div>
                        <div>
                            <label style="color:var(--text-main); font-size:0.8rem; display:block; margin-bottom:5px;">ہفتے</label>
                            <input type="number" id="bulk-weeks" placeholder="0" min="0" style="width:100%; padding:0.5rem; background:rgba(0,0,0,0.5); border:1px solid var(--card-border); border-radius:5px; color:#fff; font-family: inherit; text-align:center;" />
                        </div>
                        <div>
                            <label style="color:var(--text-main); font-size:0.8rem; display:block; margin-bottom:5px;">دن</label>
                            <input type="number" id="bulk-days" placeholder="0" min="0" style="width:100%; padding:0.5rem; background:rgba(0,0,0,0.5); border:1px solid var(--card-border); border-radius:5px; color:#fff; font-family: inherit; text-align:center;" />
                        </div>
                    </div>
                    <button class="btn primary-btn" onclick="addBulkQaza()">منتخب نمازوں میں شامل کریں</button>
                    <p style="font-size:0.75rem; color:var(--text-muted); margin-top:8px; text-align:center;">یہ آپ کے درج کردہ عرصے کے مطابق منتخب نمازوں کی قضا شامل کر دے گا۔</p>
                </div>
            </div>
        `;
    },
    analytics() {
        return `
             <div class="view-section">
                <h2>محاسبہ ڈیش بورڈ</h2>
                
                <div class="glass" style="padding: 15px; margin-bottom: 20px; text-align: center;">
                    <h3 style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 5px;">موجودہ تسلسل (Current Streak)</h3>
                    <div id="streak-counter" style="font-size: 2.5rem; font-weight: bold; color: var(--primary);">0</div>
                    <span style="font-size: 0.8rem;">دن</span>
                </div>

                <div class="glass" style="padding: 15px; margin-bottom: 20px;">
                    <h3 style="font-size: 1rem; margin-bottom: 15px; color: var(--text-main);">ماہانہ کیلنڈر</h3>
                    <div id="monthly-calendar" style="direction: rtl;"></div>
                    <div style="display:flex; gap:15px; margin-top:10px; font-size:0.75rem; justify-content:center;">
                        <span><span style="display:inline-block; width:12px; height:12px; background:var(--primary); border-radius:3px; margin-left:5px;"></span>مکمل</span>
                        <span><span style="display:inline-block; width:12px; height:12px; background:#ff6b6b44; border-radius:3px; margin-left:5px;"></span>ادھورا</span>
                        <span><span style="display:inline-block; width:12px; height:12px; background:rgba(160,174,192,0.15); border-radius:3px; margin-left:5px;"></span>کوئی ریکارڈ نہیں</span>
                    </div>
                </div>

                <div class="glass" style="padding: 15px; margin-bottom: 20px;">
                    <h3 style="font-size: 1rem; margin-bottom: 15px; color: var(--text-main);">کیٹیگری کے لحاظ سے کارکردگی (آج)</h3>
                    <div id="category-analytics"></div>
                </div>

                <div class="glass" style="padding: 15px;">
                    <h3 style="font-size: 1rem; margin-bottom: 10px; color: var(--text-main);">ہفتہ وار کارکردگی</h3>
                    <canvas id="progressChart" width="400" height="250"></canvas>
                </div>
            </div>
        `;
    },
    quran() {
        return `
            <div class="view-section">
                <h2>قرآن ٹریکر</h2>
                
                <div class="glass" style="padding: 10px; margin-bottom: 20px; display: flex; gap: 5px; flex-wrap: wrap;">
                    <button class="btn quran-tab-btn primary-btn" style="flex:1; min-width: 80px; padding: 8px 5px; font-size: 0.85rem;" data-tab="paras" onclick="renderQuranTabs('paras')">پارے</button>
                    <button class="btn quran-tab-btn" style="flex:1; min-width: 80px; padding: 8px 5px; font-size: 0.85rem; background: rgba(251, 191, 36, 0.1); border: 1px solid var(--primary); color: var(--primary);" data-tab="surahs" onclick="renderQuranTabs('surahs')">سورتیں</button>
                    <button class="btn quran-tab-btn" style="flex:1; min-width: 80px; padding: 8px 5px; font-size: 0.85rem; background: rgba(251, 191, 36, 0.1); border: 1px solid var(--primary); color: var(--primary);" data-tab="pdf" onclick="renderQuranTabs('pdf')">تلاوت (PDF)</button>
                </div>

                <div id="quran-content"></div>
            </div>
        `;
    },
    tasbeeh() {
        const tasbeehTargets = [33, 33, 34, 100, 99, 1000];
        const savedTarget = parseInt(localStorage.getItem('tasbeeh_target')) || 33;
        const savedLabel = localStorage.getItem('tasbeeh_label') || 'سبحان اللہ';
        return `
            <div class="view-section">
                <h2>تسبیح کاؤنٹر</h2>
                <div class="glass" style="padding: 20px; text-align: center; margin-bottom: 20px;">
                    <div id="tasbeeh-label" style="font-size: 1.5rem; color: var(--primary); margin-bottom: 10px; font-family:'Noto Nastaliq Urdu',serif;">${savedLabel}</div>
                    <div id="tasbeeh-count" style="font-size: 5rem; font-weight: bold; color: var(--text-main); font-family:'Inter',sans-serif; line-height:1.1;">0</div>
                    <div id="tasbeeh-target-display" style="font-size: 0.9rem; color: var(--text-muted);">ہدف: <span id="tasbeeh-target-val">${savedTarget}</span></div>
                    <div id="tasbeeh-progress-bar" style="height:6px; background: rgba(212,175,55,0.15); border-radius: 10px; margin: 15px 0;"><div id="tasbeeh-bar-fill" style="height:100%; width:0%; background: var(--primary); border-radius: 10px; transition: width 0.2s;"></div></div>
                    <button id="tasbeeh-btn" class="btn primary-btn" style="font-size: 2rem; padding: 20px; border-radius: 50%; width: 100px; height: 100px; margin: 10px auto; display:block;" onclick="incrementTasbeeh()">📿</button>
                    <div style="display: flex; gap: 10px; margin-top: 15px;">
                        <button class="btn" style="flex:1; background: rgba(255,107,107,0.15); border: 1px solid #ff6b6b; color: #ff6b6b;" onclick="resetTasbeeh()">ری سیٹ</button>
                    </div>
                </div>
                <div class="glass" style="padding: 15px; border-width: 1px;">
                    <h3 style="color: var(--primary); font-size: 1rem; margin-bottom: 12px;">ذکر تبدیل کریں</h3>
                    <div class="form-group">
                        <label>ذکر (عبارت)</label>
                        <input type="text" id="new-tasbeeh-label" placeholder="سبحان اللہ" style="width:100%; padding:0.6rem; background:rgba(0,0,0,0.4); border:1px solid var(--card-border); border-radius:8px; color:#fff; font-family:inherit; font-size:1rem;"/>
                    </div>
                    <div class="form-group">
                        <label>ہدف (تعداد)</label>
                        <input type="number" id="new-tasbeeh-target" placeholder="${savedTarget}" min="1" style="width:100%; padding:0.6rem; background:rgba(0,0,0,0.4); border:1px solid var(--card-border); border-radius:8px; color:#fff; font-family:inherit; font-size:1rem;"/>
                    </div>
                    <button class="btn primary-btn" onclick="saveTasbeehSettings()">محفوظ کریں</button>
                </div>
            </div>
        `;
    }
};

function navigateTo(viewName) {
    // Update active nav button
    navButtons.forEach(btn => {
        if(btn.dataset.view === viewName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Render content
    if(Views[viewName]) {
        mainContent.innerHTML = Views[viewName]();
        // trigger re-binds if necessary based on viewName
        bindEvents(viewName);
    }
}

function bindEvents(viewName) {
    if (viewName === 'daily') {
        renderDailyTasks();
        renderHijriDate();
        if (typeof renderPrayerTimesWidget === 'function') {
            renderPrayerTimesWidget();
        }
    }
    
    if (viewName === 'qaza') {
        renderQazaTasks();
    }

    if (viewName === 'analytics') {
        renderAnalytics();
        renderCategoryAnalytics();
    }
    
    if (viewName === 'quran') {
        renderQuranTabs('paras');
    }
    
    if (viewName === 'tasbeeh') {
        // state already embedded in the HTML template, just bind
    }
    
    if (viewName === 'setup') {
        const prayerMethod = document.getElementById('prayer-method');
        const prayerSchool = document.getElementById('prayer-school');
        
        if (prayerMethod) {
            prayerMethod.value = localStorage.getItem('islamic_method') || '1';
            prayerMethod.addEventListener('change', async (e) => {
                localStorage.setItem('islamic_method', e.target.value);
                await PrayerTimes.fetchLocationAndTimes();
            });
        }
        
        if (prayerSchool) {
            prayerSchool.value = localStorage.getItem('islamic_school') || '1';
            prayerSchool.addEventListener('change', async (e) => {
                localStorage.setItem('islamic_school', e.target.value);
                await PrayerTimes.fetchLocationAndTimes();
            });
        }

        const form = document.getElementById('setup-form');
        const typeSelect = document.getElementById('task-type');
        const targetGroup = document.getElementById('target-count-group');
        
        if (typeSelect) {
            typeSelect.addEventListener('change', (e) => {
                if (e.target.value === 'counter' || e.target.value === 'hybrid') {
                    targetGroup.style.display = 'block';
                    document.getElementById('task-target').setAttribute('required', 'true');
                } else {
                    targetGroup.style.display = 'none';
                    document.getElementById('task-target').removeAttribute('required');
                }
            });
        }

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const name = document.getElementById('task-name').value;
                const category = document.getElementById('task-category').value;
                const type = document.getElementById('task-type').value;
                const target = (type === 'counter' || type === 'hybrid') ? parseInt(document.getElementById('task-target').value) : null;
                
                State.tasks.push({
                    id: Date.now().toString(),
                    name,
                    category,
                    type,
                    target,
                    createdAt: new Date().toISOString()
                });
                State.saveTasks();
                form.reset();
                targetGroup.style.display = 'none';
                renderSetupTasks();
            });
        }
        
        renderSetupTasks();
    }
}

function renderSetupTasks() {
    const list = document.getElementById('setup-tasks-list');
    if (!list) return;
    
    const searchInput = document.getElementById('task-search');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    
    let displayTasks = State.tasks.filter(t => !(t.category === 'faraidh' && t.isSystem));
    
    if (searchTerm) {
        displayTasks = displayTasks.filter(t => t.name.toLowerCase().includes(searchTerm));
    }
    
    if (displayTasks.length === 0) {
        list.innerHTML = `<p style="text-align:center; color: var(--text-muted); font-size: 0.9rem;">${searchTerm ? 'کوئی نتیجہ نہیں ملا۔' : 'کوئی کسٹم معمول سیٹ نہیں کیا گیا۔'}</p>`;
        return;
    }
    
    list.innerHTML = displayTasks.map(t => `
        <div class="glass task-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; margin-bottom: 10px;">
            <div class="task-info">
                <strong>${t.name}</strong>
                <span style="display: block; font-size: 0.75rem; color: var(--text-muted);">
                    ${getCategoryName(t.category)} | ${t.type === 'counter' ? `تعداد: ${t.target}` : (t.type === 'hybrid' ? `تعداد یا چیک لسٹ: ${t.target}` : 'چیک لسٹ')}
                </span>
            </div>
            ${t.isSystem ? '<span style="color:var(--text-muted); font-size: 0.8rem;">(لازمی)</span>' : `<button class="delete-btn" onclick="deleteTask('${t.id}')" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #ff6b6b;">🗑️</button>`}
        </div>
    `).join('');
}

window.deleteTask = function(id) {
    const task = State.tasks.find(t => t.id === id);
    if(task && task.isSystem) {
        alert('اس لازمی معمول کو حذف نہیں کیا جا سکتا۔');
        return;
    }
    if(confirm('کیا آپ واقعی اسے حذف کرنا چاہتے ہیں؟')) {
        State.tasks = State.tasks.filter(t => t.id !== id);
        State.saveTasks();
        // Clean up logs for deleted task
        State.logs = State.logs.filter(l => l.taskId !== id);
        State.saveLogs();
        renderSetupTasks();
    }
}

// Category Helper
const categoryMap = {
    'faraidh': 'فرائض',
    'nawafil': 'نوافل',
    'tilawat': 'تلاوت',
    'adhkar': 'اذکار',
    'other': 'دیگر'
};
function getCategoryName(key) {
    return categoryMap[key] || 'دیگر';
}

// Utility: Get current Date String (YYYY-MM-DD)
function getTodayString() {
    const today = new Date();
    return today.toISOString().split('T')[0];
}

// Check Midnight Reset & Missing Logs
function checkMidnightReset() {
    const todayStr = getTodayString();
    let hasChanges = false;
    
    // Convert previous pending logs to qaza (Only for Faraidh)
    State.logs.forEach(log => {
        if(log.status === 'pending' && log.date !== todayStr) {
            const task = State.tasks.find(t => t.id === log.taskId);
            if (task && task.category === 'faraidh') {
                log.status = 'qaza';
            } else {
                log.status = 'missed'; // Other tasks are just missed, not qaza
            }
            hasChanges = true;
        }
    });

    // Create logs for today if they don't exist
    State.tasks.forEach(task => {
        const hasLogToday = State.logs.find(l => l.taskId === task.id && l.date === todayStr);
        if(!hasLogToday) {
            State.logs.push({
                id: Date.now() + Math.random().toString(),
                taskId: task.id,
                date: todayStr,
                status: 'pending',
                completedCount: 0
            });
            hasChanges = true;
        }
    });

    if(hasChanges) {
        State.saveLogs();
    }
}

window.renderLog = function(log, isDone) {
    const task = State.tasks.find(t => t.id === log.taskId);
    if(!task) return '';
    
    let actionHTML = '';
    if (isDone) {
        actionHTML = `<span style="color: var(--primary); font-weight: bold;">✔ مکمل</span>`;
    } else if (task.category === 'adhkar' && (task.type === 'counter' || task.type === 'hybrid')) {
        actionHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 0.8rem; color: var(--text-muted);">${log.completedCount} / ${task.target}</span>
                <button class="btn primary-btn" style="padding: 4px 12px; width: auto; font-size: 0.85rem;" onclick="openTasbeehModal('${log.id}')">تسبیح</button>
            </div>
        `;
    } else if (task.type === 'counter') {
        actionHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 0.8rem;">${log.completedCount} / ${task.target}</span>
                <button class="btn primary-btn" style="padding: 4px 12px; width: auto; font-size: 0.85rem;" onclick="incrementTask('${log.id}')">+</button>
            </div>
        `;
    } else if (task.type === 'hybrid') {
        actionHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 5px; border-left: 1px solid rgba(255,255,255,0.1); padding-left: 10px; margin-left: 5px;">
                    <span style="font-size: 0.8rem;">${log.completedCount} / ${task.target}</span>
                    <button class="btn primary-btn" style="padding: 4px 10px; width: auto; font-size: 0.8rem;" onclick="incrementTask('${log.id}')">+</button>
                </div>
                <button class="btn primary-btn" style="padding: 4px 12px; width: auto; font-size: 0.8rem; background: rgba(251, 191, 36, 0.1); border: 1px solid var(--primary); color: var(--primary);" onclick="completeTask('${log.id}', this)">مکمل</button>
            </div>
        `;
    } else {
        actionHTML = `<button class="btn primary-btn" style="padding: 6px 16px; width: auto;" onclick="completeTask('${log.id}', this)">مکمل</button>`;
    }
    
    return `
        <div id="log-item-${log.id}" class="glass task-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; margin-bottom: 10px; ${isDone ? 'opacity: 0.6;' : ''}">
            <div>
                <strong>${task.name}</strong>
            </div>
            <div>${actionHTML}</div>
        </div>
    `;
};

function renderDailyTasks() {
    const list = document.getElementById('daily-list');
    if (!list) return;

    if (State.tasks.length === 0) {
        list.innerHTML = `<p style="text-align:center; color: var(--text-muted); font-size: 0.9rem;">کوئی معمول سیٹ نہیں کیا گیا۔</p>`;
        return;
    }

    const todayStr = getTodayString();
    
    const todayLogs = State.logs.filter(l => l.date === todayStr);
    const pendingLogs = todayLogs.filter(l => l.status === 'pending');
    const doneLogs = todayLogs.filter(l => l.status === 'done');
    
    let html = '';
    
    if(pendingLogs.length > 0) {
        let gridHtml = '<div class="category-grid">';
        let hasActiveCategories = false;
        
        const catOrder = ['faraidh', 'nawafil', 'tilawat', 'adhkar', 'other'];
        
        catOrder.forEach(cat => {
            const catPending = pendingLogs.filter(l => {
                const tk = State.tasks.find(t => t.id === l.taskId);
                return tk && ((tk.category === cat) || (!tk.category && cat === 'other'));
            });
            
            if(catPending.length > 0) {
                hasActiveCategories = true;
                const catTasks = State.tasks.filter(t => (t.category === cat) || (!t.category && cat === 'other'));
                const doneCatLogs = doneLogs.filter(l => {
                   const t = State.tasks.find(tk => tk.id === l.taskId);
                   return t && ((t.category === cat) || (!t.category && cat === 'other'));
                });
                const totalCatCount = catTasks.length;
                const doneCatCount = doneCatLogs.length;

                gridHtml += `
                    <div class="category-card" onclick="openCategoryModal('${cat}')">
                        <h3>${getCategoryName(cat)}</h3>
                        <p>${totalCatCount} میں سے ${doneCatCount} مکمل</p>
                    </div>
                `;
            }
        });
        gridHtml += '</div>';
        
        if (hasActiveCategories) {
            html += gridHtml;
        }
    } else {
         html += `<p style="text-align:center; color: var(--primary); font-weight:bold; margin-bottom: 20px;">ماشاءاللہ! آج کے تمام معمولات مکمل ہو گئے۔</p>`;
    }
    
    if(doneLogs.length > 0) {
        html += `<h4 style="margin-top:20px; margin-bottom:10px; font-size: 1rem; color: var(--text-main); background: rgba(0,0,0,0.4); padding: 5px 10px; border-radius: 5px; text-align: center;">مکمل شدہ مقاصد</h4>`;
        html += doneLogs.map(l => window.renderLog(l, true)).join('');
    }
    
    list.innerHTML = html;
}

window.openCategoryModal = function(cat) {
    const modal = document.getElementById('category-modal');
    const title = document.getElementById('modal-title');
    const taskList = document.getElementById('modal-task-list');
    
    title.innerText = getCategoryName(cat);
    
    const todayStr = getTodayString();
    
    const pendingCatLogs = State.logs.filter(l => {
        if(l.date !== todayStr || l.status === 'done') return false;
        const tk = State.tasks.find(t => t.id === l.taskId);
        return tk && ((tk.category === cat) || (!tk.category && cat === 'other'));
    });
    
    let html = '';
    if (pendingCatLogs.length > 0) {
        html += pendingCatLogs.map(l => window.renderLog(l, false)).join('');
    } else {
        html = '<p style="text-align:center; color: var(--text-muted); margin-top:20px;">اس کیٹیگری کے تمام معمولات مکمل ہو چکے ہیں!</p>';
        setTimeout(closeCategoryModal, 1500);
    }
    
    taskList.innerHTML = html;
    modal.classList.add('active');
}

window.closeCategoryModal = function() {
    const modal = document.getElementById('category-modal');
    if(modal) {
        modal.classList.remove('active');
    }
    renderDailyTasks();
}

function refreshViewAfterTaskChange(taskId) {
    renderDailyTasks();
    const modal = document.getElementById('category-modal');
    if(modal && modal.classList.contains('active')) {
        const task = State.tasks.find(t => t.id === taskId);
        if(task) {
            window.openCategoryModal(task.category || 'other');
        }
    }
}

window.openTasbeehModal = function(logId) {
    const log = State.logs.find(l => l.id === logId);
    if(!log) return;
    const task = State.tasks.find(t => t.id === log.taskId);
    if(!task) return;

    // Save context for modal
    window.currentTasbeehLogId = logId;
    
    // Check if modal exists, if not create it
    let modal = document.getElementById('tasbeeh-modal');
    if(!modal) {
        modal = document.createElement('div');
        modal.id = 'tasbeeh-modal';
        modal.className = 'modal';
        modal.style.display = 'none'; // Hidden by default
        modal.innerHTML = `
            <div class="modal-content glass" style="width: 100vw; height: 100vh; max-width: none; border-radius: 0; border: none; display: flex; flex-direction: column; padding: 0; pointer-events: auto;">
                <div style="padding: 20px; text-align: center; background: rgba(251, 191, 36, 0.1); border-bottom: 1px solid var(--card-border); position: relative; pointer-events: auto;">
                    <button id="tasbeeh-close-btn" style="position: absolute; right: 20px; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.1); border: none; color: var(--text-main); font-size: 1.8rem; cursor: pointer; padding: 15px; z-index: 10001; border-radius: 50%; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center;" onclick="event.stopPropagation(); window.closeTasbeehModal()">✕</button>
                    <h2 id="tasbeeh-name" style="margin: 0; font-size: 1.5rem; color: var(--primary);">ذکر</h2>
                </div>
                <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 30px; padding: 20px;">
                    <div id="tasbeeh-counter-display" style="font-size: 8rem; font-weight: bold; font-family: 'Inter', sans-serif; color: var(--text-main); text-shadow: 0 0 30px rgba(251, 191, 36, 0.4);">0</div>
                    <div id="tasbeeh-target-display" style="font-size: 1.5rem; color: var(--text-muted);">ہدف: 100</div>
                    
                    <button id="tasbeeh-main-btn" style="width: 280px; height: 280px; border-radius: 50%; border: 12px solid var(--primary); background: rgba(251, 191, 36, 0.05); color: var(--primary); font-size: 4rem; cursor: pointer; transition: all 0.1s ease; outline: none; -webkit-tap-highlight-color: transparent; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 40px rgba(0,0,0,0.3);" onclick="handleTasbeehClick()">
                        <i class="fa-solid fa-fingerprint"></i>
                    </button>
                    
                    <div style="display: flex; gap: 20px; width: 100%; max-width: 400px; margin-top: 20px;">
                        <button class="btn primary-btn" style="flex: 1; font-size: 1.1rem; padding: 15px;" onclick="resetTasbeehCounter()">دوبارہ شروع</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Add CSS for modal if not present
        if(!document.getElementById('tasbeeh-modal-styles')) {
            const style = document.createElement('style');
            style.id = 'tasbeeh-modal-styles';
            style.innerHTML = `
                #tasbeeh-main-btn:active {
                    transform: scale(0.92);
                    background: rgba(251, 191, 36, 0.2);
                    box-shadow: 0 0 30px rgba(251, 191, 36, 0.4);
                }
            `;
            document.head.appendChild(style);
        }
    }

    // Update modal content
    document.getElementById('tasbeeh-name').innerText = task.name;
    document.getElementById('tasbeeh-counter-display').innerText = log.completedCount;
    document.getElementById('tasbeeh-target-display').innerText = `ہدف: ${task.target}`;
    
    // Show modal
    modal.style.display = 'flex';
    modal.style.zIndex = '9999';
    modal.classList.add('active');
};

window.handleTasbeehClick = function() {
    const logId = window.currentTasbeehLogId;
    const log = State.logs.find(l => l.id === logId);
    if(!log) return;
    const task = State.tasks.find(t => t.id === log.taskId);
    if(!task) return;

    log.completedCount += 1;
    document.getElementById('tasbeeh-counter-display').innerText = log.completedCount;

    // Haptic feedback if available
    if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50);
    }

    if(log.completedCount >= task.target) {
        log.status = 'done';
        State.saveLogs();
        
        // Celebration effect could go here
        setTimeout(() => {
            closeTasbeehModal();
            refreshViewAfterTaskChange(log.taskId);
            
            // Success alert (optional)
            // alert(`ماشاءاللہ! آپ نے ${task.name} مکمل کر لیا۔`);
        }, 300);
    } else {
        State.saveLogs();
    }
};

window.resetTasbeehCounter = function() {
    if(confirm('کیا آپ گنتی دوبارہ صفر سے شروع کرنا چاہتے ہیں؟')) {
        const logId = window.currentTasbeehLogId;
        const log = State.logs.find(l => l.id === logId);
        if(log) {
            log.completedCount = 0;
            document.getElementById('tasbeeh-counter-display').innerText = '0';
            State.saveLogs();
        }
    }
};

window.closeTasbeehModal = function() {
    const modal = document.getElementById('tasbeeh-modal');
    if(modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
    // Refresh the home page to show updated count on the card
    renderDailyTasks();
    
    // If the category modal is open, refresh it too
    const categoryModal = document.getElementById('category-modal');
    if(categoryModal && categoryModal.classList.contains('active')) {
        const logId = window.currentTasbeehLogId;
        const log = State.logs.find(l => l.id === logId);
        if(log) {
            const task = State.tasks.find(t => t.id === log.taskId);
            if(task) window.openCategoryModal(task.category || 'other');
        }
    }
};

window.completeTask = function(logId, btnElement) {
    const log = State.logs.find(l => l.id === logId);
    if(log) {
        log.status = 'done';
        State.saveLogs();
        
        const item = document.getElementById(`log-item-${logId}`);
        if(item) {
            item.classList.add('anim-completed');
            setTimeout(() => {
                refreshViewAfterTaskChange(log.taskId);
            }, 500); // match timeout with animation duration
        } else {
            refreshViewAfterTaskChange(log.taskId);
        }
    }
}

window.incrementTask = function(logId) {
    const log = State.logs.find(l => l.id === logId);
    if(log) {
        const task = State.tasks.find(t => t.id === log.taskId);
        if(task) {
            log.completedCount += 1;
            if(log.completedCount >= task.target) {
                log.status = 'done';
                // Find element for animation
                const item = document.getElementById(`log-item-${logId}`);
                if(item) {
                    item.classList.add('anim-completed');
                    State.saveLogs();
                    setTimeout(() => {
                        refreshViewAfterTaskChange(log.taskId);
                    }, 500);
                    return;
                }
            }
            State.saveLogs();
            refreshViewAfterTaskChange(log.taskId);
        }
    }
}

// Global Event Listeners
navButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        // Find closest button in case icon is clicked
        const targetBtn = e.target.closest('.nav-btn');
        if(targetBtn) {
            navigateTo(targetBtn.dataset.view);
        }
    });
});

function renderQazaTasks() {
    const list = document.getElementById('qaza-list');
    if (!list) return;

    const qazaLogs = State.logs.filter(l => {
        if (l.status !== 'qaza') return false;
        const task = State.tasks.find(t => t.id === l.taskId);
        return task && task.category === 'faraidh';
    });
    const faraidhTasks = State.tasks.filter(t => t.category === 'faraidh' && t.isSystem);
    
    // Path definitions for 5 pie wedges forming a complete circle of radius 150px
    const piePaths = [
        "M 150 150 L 61.83 28.65 A 150 150 0 0 1 238.17 28.65 Z", // Top (-90 deg offset) -> Fajar
        "M 150 150 L 238.17 28.65 A 150 150 0 0 1 292.66 196.35 Z", // Right-Top -> Zuhr
        "M 150 150 L 292.66 196.35 A 150 150 0 0 1 150 300 Z",     // Right-Bottom -> Asr
        "M 150 150 L 150 300 A 150 150 0 0 1 7.34 196.35 Z",      // Left-Bottom -> Maghrib
        "M 150 150 L 7.34 196.35 A 150 150 0 0 1 61.83 28.65 Z"   // Left-Top -> Isha
    ];
    
    const textPositions = [
        {x: 150, y: 40, cy: 60},
        {x: 240, y: 110, cy: 130},
        {x: 215, y: 235, cy: 255},
        {x: 85, y: 235, cy: 255},
        {x: 60, y: 110, cy: 130}
    ];
    
    let html = `
        <div class="qaza-pie-container">
            <svg class="qaza-pie-svg" viewBox="0 0 300 300">
    `;
    
    let totalFaraidhMissed = 0;
    
    faraidhTasks.sort((a,b) => parseInt(a.id) - parseInt(b.id)).forEach((task, index) => {
        const missedCount = qazaLogs.filter(l => l.taskId === task.id).length + (task.bulkQaza || 0);
        totalFaraidhMissed += missedCount;
        const color = missedCount > 0 ? '#ff6b6b' : '#a0aec0'; // var(--text-muted) static HEX for SVG
        const pos = textPositions[index % 5];
        
        html += `
            <g onclick="openQazaModal('${task.id}')" style="cursor: pointer;">
                <path class="qaza-pie-slice" d="${piePaths[index % 5]}"></path>
                <text class="qaza-pie-text" x="${pos.x}" y="${pos.y}">${task.name}</text>
                <text class="qaza-pie-count" x="${pos.x}" y="${pos.cy}" style="fill: ${color}">${missedCount}</text>
            </g>
        `;
    });
    
    html += `
            </svg>
            <div class="qaza-center-circle">
                <span>قضا<br>نمازیں</span>
            </div>
        </div>
    `;

    if (totalFaraidhMissed === 0) {
        html += `<p style="text-align:center; color: var(--primary); font-size: 0.95rem; margin-top: 1rem;">کوئی قضا آپ کے ذمے باقی نہیں ہے۔ ماشاءاللہ!</p>`;
    }
    
    list.innerHTML = html;
}

window.openQazaModal = function(taskId) {
    const task = State.tasks.find(t => t.id === taskId);
    if (!task) return;

    const modal = document.getElementById('category-modal');
    const title = document.getElementById('modal-title');
    const taskList = document.getElementById('modal-task-list');
    
    title.innerText = 'قضا: ' + task.name;
    
    const missedLogs = State.logs.filter(l => l.taskId === taskId && l.status === 'qaza');
    const totalMissed = missedLogs.length + (task.bulkQaza || 0);
    
    let html = `
        <div style="text-align: center; padding: 15px 0;">
            <div style="font-size: 4rem; color: ${totalMissed > 0 ? '#ff6b6b' : 'var(--primary)'}; font-weight: bold; margin-bottom: 5px; text-shadow: 0 4px 10px rgba(0,0,0,0.5); font-family: 'Inter', sans-serif;">
                ${totalMissed}
            </div>
            <p style="color: var(--text-main); font-size: 1rem; margin-bottom: 25px;">باقی رہتیں قضا</p>
    `;
    
    if (totalMissed > 0) {
        html += `
            <button class="btn primary-btn" style="padding: 12px 24px; font-size: 1.1rem; border-radius: 12px; font-family: 'Noto Nastaliq Urdu', serif;" onclick="reduceQaza('${taskId}')">
                ایک قضا ادا کر لی ✔
            </button>
        `;
    } else {
        html += `<p style="color: var(--primary); font-weight: bold;">ماشاءاللہ! کوئی قضا باقی نہیں۔</p>`;
    }
    html += `</div>`;
    
    taskList.innerHTML = html;
    modal.classList.add('active');
}

window.reduceQaza = function(taskId) {
    const task = State.tasks.find(t => t.id === taskId);
    if (!task) return;

    if (task.bulkQaza && task.bulkQaza > 0) {
        task.bulkQaza -= 1;
        State.saveTasks();
        window.openQazaModal(taskId);
        if (typeof renderQazaTasks === 'function') {
            renderQazaTasks();
        }
        return;
    }

    const qazaLogs = State.logs.filter(l => l.taskId === taskId && l.status === 'qaza');
    if (qazaLogs.length > 0) {
        const oldestLog = qazaLogs.sort((a, b) => new Date(a.date) - new Date(b.date))[0];
        oldestLog.status = 'done';
        State.saveLogs();
        
        window.openQazaModal(taskId);
        if (typeof renderQazaTasks === 'function') {
            renderQazaTasks();
        }
    }
}

function renderAnalytics() {
    const todayStr = getTodayString();
    
    // 1. Calculate Streak (Days where ALL tasks were 'done')
    let currentStreak = 0;
    
    // Get unique sorted dates from logs
    const uniqueDates = [...new Set(State.logs.map(l => l.date))].sort((a,b) => new Date(b) - new Date(a));
    // Remove today from calculation if it's not fully done yet but don't break streak
    let streakDates = uniqueDates;
    
    let isTodayDone = false;
    const todayLogs = State.logs.filter(l => l.date === todayStr);
    if (todayLogs.length > 0 && todayLogs.every(l => l.status === 'done')) {
        isTodayDone = true;
    }
    
    if (streakDates.length > 0) {
        let checkIndex = 0;
        if (streakDates[0] === todayStr && !isTodayDone) {
            // Ignore today in streak calculation if it's still being worked on
            checkIndex = 1; 
        }
        
        let expectedDate = new Date(streakDates[checkIndex]);
        
        for (let i = checkIndex; i < streakDates.length; i++) {
            const d = streakDates[i];
            const logsForDay = State.logs.filter(l => l.date === d);
            const allDone = logsForDay.every(l => l.status === 'done');
            
            if (expectedDate.toISOString().split('T')[0] === d && allDone) {
                currentStreak++;
                expectedDate.setDate(expectedDate.getDate() - 1); // move back one day
            } else {
                break;
            }
        }
    }
    
    // add today if complete
    if(isTodayDone && streakDates[0] === todayStr) {
        currentStreak++;
    }

    const streakEl = document.getElementById('streak-counter');
    if(streakEl) streakEl.innerText = currentStreak;

    // 2. Render monthly calendar
    renderMonthlyCalendar();
    
    // 2.5 Render Category Analytics
    renderCategoryAnalytics();
    
    // 3. Render Chart for last 7 days
    renderChart();
}

function renderCategoryAnalytics() {
    const container = document.getElementById('category-analytics');
    if (!container) return;

    const todayStr = getTodayString();
    const todayLogs = State.logs.filter(l => l.date === todayStr);
    
    const categories = ['faraidh', 'nawafil', 'tilawat', 'adhkar', 'other'];
    let html = '<div style="display: flex; flex-direction: column; gap: 12px;">';

    categories.forEach(cat => {
        const catTasks = State.tasks.filter(t => (t.category === cat) || (!t.category && cat === 'other'));
        if (catTasks.length === 0) return;

        const catLogs = todayLogs.filter(l => {
            const t = State.tasks.find(tk => tk.id === l.taskId);
            return t && ((t.category === cat) || (!t.category && cat === 'other'));
        });

        const total = catTasks.length;
        const done = catLogs.filter(l => l.status === 'done').length;
        const percentage = total > 0 ? Math.round((done / total) * 100) : 0;

        html += `
            <div style="width: 100%;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 0.85rem;">
                    <span>${getCategoryName(cat)}</span>
                    <span>${done}/${total} (${percentage}%)</span>
                </div>
                <div style="height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden;">
                    <div style="height: 100%; width: ${percentage}%; background: var(--primary); border-radius: 4px; transition: width 0.5s;"></div>
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

function renderMonthlyCalendar() {
    const cal = document.getElementById('monthly-calendar');
    if (!cal) return;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const monthNames = ['جنوری','فروری','مارچ','اپریل','مئی','جون','جولائی','اگست','ستمبر','اکتوبر','نومبر','دسمبر'];
    
    let html = `<div style="text-align:center; font-size:0.9rem; color:var(--primary); margin-bottom:10px;">${monthNames[month]} ${year}</div>`;
    html += `<div style="display:grid; grid-template-columns: repeat(7, 1fr); gap:4px;">`;
    
    // Day headers: ہ ا پ م ب ج ج (Sat to Fri)
    const dayNames = ['ہ','ا','پ','م','ب','ج','ج'];
    dayNames.forEach(d => {
        html += `<div style="text-align:center; font-size:0.7rem; color:var(--text-muted); padding:2px;">${d}</div>`;
    });
    
    // First day of month and its weekday (0=Sun..6=Sat)
    const firstDay = new Date(year, month, 1).getDay();
    // Offset: Sat=0, Sun=1, Mon=2, Tue=3, Wed=4, Thu=5, Fri=6
    const offset = (firstDay + 1) % 7;
    
    for (let i = 0; i < offset; i++) {
        html += `<div></div>`;
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const dayLogs = State.logs.filter(l => l.date === dateStr);
        const total = dayLogs.length;
        const done = dayLogs.filter(l => l.status === 'done').length;
        const isToday = dateStr === getTodayString();
        
        let bg = 'rgba(160,174,192,0.1)';
        if (total > 0) {
            if (done === total) bg = 'var(--primary)';
            else bg = 'rgba(255,107,107,0.3)';
        }
        
        const border = isToday ? 'border: 2px solid var(--primary);' : '';
        const color = total > 0 && done === total ? '#111' : 'var(--text-main)';
        
        html += `<div style="text-align:center; background:${bg}; border-radius:5px; padding:4px 2px; font-family:'Inter',sans-serif; font-size:0.75rem; ${border} color:${color};">${day}</div>`;
    }
    
    html += `</div>`;
    cal.innerHTML = html;
}

let progressChartInstance = null;

function renderChart() {
    const canvas = document.getElementById('progressChart');
    if(!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Generate last 7 days labels
    const labels = ['ہفتہ', 'اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ'];
    const doneData = [];
    const qazaData = [];
    
    const today = new Date();
    const currentDay = today.getDay(); // 0(Sun) to 6(Sat)
    const diffToSat = (currentDay === 6) ? 0 : currentDay + 1;
    
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - diffToSat);
    
    for(let i=0; i<7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(d.getDate() + i);
        const dStr = d.toISOString().split('T')[0];
        
        const logsOfDay = State.logs.filter(l => l.date === dStr);
        const done = logsOfDay.filter(l => l.status === 'done').length;
        const qaza = logsOfDay.filter(l => l.status === 'qaza').length;
        
        doneData.push(done);
        qazaData.push(qaza);
    }
    
    if (progressChartInstance) {
        progressChartInstance.destroy();
    }
    
    progressChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'مکمل',
                    data: doneData,
                    backgroundColor: '#fbbf24', // Amber Gold
                    borderRadius: 4
                },
                {
                    label: 'قضا',
                    data: qazaData,
                    backgroundColor: '#059669', // Emerald Green
                    borderRadius: 4
                }
            ]
        },
        options: {
            scales: {
                x: {
                    reverse: true // RTL order
                },
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                }
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { font: { family: 'Noto Nastaliq Urdu' } }
                }
            }
        }
    });
}

// PWA Install Logic
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    // Show the install banner
    const banner = document.getElementById('install-banner');
    if (banner) banner.style.display = 'flex';
});

window.handleInstallClick = async () => {
    if (!deferredPrompt) return;
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    // We've used the prompt, and can't use it again, throw it away
    deferredPrompt = null;
    // Hide the install banner
    const banner = document.getElementById('install-banner');
    if (banner) banner.style.display = 'none';
};

window.addEventListener('appinstalled', (event) => {
    console.log('App was installed.');
    const banner = document.getElementById('install-banner');
    if (banner) banner.style.display = 'none';
});

// App Initialization
function initApp() {
    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker Registered'))
            .catch(err => console.log('Service Worker Failed', err));
    }

    checkMidnightReset();
    initTheme();
    
    // Handle URL Actions (Shortcuts)
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    const id = urlParams.get('id');
    
    if (action === 'mark' && id) {
        handleQuickMark(id);
    }

    // Initial Route
    navigateTo('daily');
}

function handleQuickMark(taskId) {
    const today = new Date().toISOString().split('T')[0];
    const task = State.tasks.find(t => t.id === taskId);
    
    if (task) {
        const existingLog = State.logs.find(l => l.taskId === taskId && l.date === today);
        if (!existingLog) {
            State.logs.push({
                taskId: taskId,
                date: today,
                completed: true,
                count: task.target || 0,
                timestamp: new Date().toISOString()
            });
            State.saveLogs();
            alert(`${task.name} کو ادا شدہ نشان زد کر دیا گیا ہے۔`);
        }
    }
    // Clean URL
    window.history.replaceState({}, document.title, window.location.pathname);
}

// ─────────────── Theme Management ───────────────
window.toggleTheme = function() {
    const isLight = document.body.classList.toggle('light-theme');
    localStorage.setItem('islamic_theme', isLight ? 'light' : 'dark');
    updateThemeIcon();
};

function initTheme() {
    const savedTheme = localStorage.getItem('islamic_theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
    }
    updateThemeIcon();
}

function updateThemeIcon() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const icon = btn.querySelector('i');
    const text = btn.querySelector('span');
    
    if (document.body.classList.contains('light-theme')) {
        if(icon) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        }
        if(text) text.textContent = 'لائٹ موڈ';
    } else {
        if(icon) {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
        if(text) text.textContent = 'ڈارک موڈ';
    }
}

window.addBulkQaza = function() {
    const years = parseInt(document.getElementById('bulk-years').value) || 0;
    const months = parseInt(document.getElementById('bulk-months').value) || 0;
    const weeks = parseInt(document.getElementById('bulk-weeks').value) || 0;
    const days = parseInt(document.getElementById('bulk-days').value) || 0;
    
    // Get selected prayers
    const selectedPrayers = [];
    if (document.getElementById('bulk-prayer-1').checked) selectedPrayers.push('1');
    if (document.getElementById('bulk-prayer-2').checked) selectedPrayers.push('2');
    if (document.getElementById('bulk-prayer-3').checked) selectedPrayers.push('3');
    if (document.getElementById('bulk-prayer-4').checked) selectedPrayers.push('4');
    if (document.getElementById('bulk-prayer-5').checked) selectedPrayers.push('5');

    if (selectedPrayers.length === 0) {
        alert('براہ کرم کم از کم ایک نماز منتخب کریں۔');
        return;
    }
    
    if (years === 0 && months === 0 && weeks === 0 && days === 0) {
        alert('براہ کرم دورانیہ (سال، مہینے، ہفتے یا دن) درج کریں۔');
        return;
    }
    
    const totalDays = (years * 365) + (months * 30) + (weeks * 7) + days;
    
    if (confirm(`کیا آپ واقعی منتخب نمازوں میں ${totalDays} دنوں کی قضا شامل کرنا چاہتے ہیں؟`)) {
        State.tasks.forEach(task => {
            if (task.category === 'faraidh' && task.isSystem && selectedPrayers.includes(task.id)) {
                if (!task.bulkQaza) task.bulkQaza = 0;
                task.bulkQaza += totalDays;
            }
        });
        State.saveTasks();
        
        document.getElementById('bulk-years').value = "";
        document.getElementById('bulk-months').value = "";
        document.getElementById('bulk-weeks').value = "";
        document.getElementById('bulk-days').value = "";
        
        if (typeof renderQazaTasks === 'function') renderQazaTasks();
        alert(`${totalDays} دنوں کی منتخب نمازیں قضا کھاتے میں شامل کر دی گئی ہیں۔`);
    }
}

const PrayerTimes = {
    data: JSON.parse(localStorage.getItem('islamic_prayertimes')) || null,
    
    save(data) {
        this.data = data;
        localStorage.setItem('islamic_prayertimes', JSON.stringify(data));
    },
    
    async fetchLocationAndTimes() {
        try {
            const lat = localStorage.getItem('islamic_lat');
            const lng = localStorage.getItem('islamic_lng');
            const city = localStorage.getItem('islamic_city') || 'Islamabad';
            const country = 'Pakistan';
            const method = localStorage.getItem('islamic_method') || '1';
            const school = localStorage.getItem('islamic_school') || '1';
            
            let url;
            if (lat && lng) {
                // Fetch by coordinates
                url = `https://api.aladhan.com/v1/timings/${Math.floor(Date.now() / 1000)}?latitude=${lat}&longitude=${lng}&method=${method}&school=${school}`;
            } else {
                // Fetch by city
                url = `https://api.aladhan.com/v1/timingsByCity/${Math.floor(Date.now() / 1000)}?city=${city}&country=${country}&method=${method}&school=${school}`;
            }

            const res = await fetch(url);
            const json = await res.json();

            if (json && json.data && json.data.timings) {
                this.save({
                    date: getTodayString(),
                    timings: json.data.timings,
                    meta: json.data.meta,
                    hijri: json.data.date ? json.data.date.hijri : null,
                    city: lat && lng ? 'موجودہ لوکیشن' : city
                });
                return true;
            } else {
                throw new Error("Invalid Adhan API response");
            }
        } catch (error) {
            console.error("Error fetching prayer times:", error);
            throw error;
        }
    },

    async init() {
        const todayStr = getTodayString();
        if (this.data && this.data.date === todayStr) {
            return;
        }
        await this.fetchLocationAndTimes();
    }
};

window.getIslamicEvent = function(day, month) {
    const events = {
        '1-1': 'اسلامی نیا سال',
        '10-1': 'یومِ عاشورہ',
        '12-3': 'عید میلاد النبیﷺ',
        '27-7': 'واقعہ معراج',
        '15-8': 'شبِ برات',
        '1-9': 'رمضان المبارک کا آغاز',
        '27-9': 'لیلۃ القدر (متوقع)',
        '1-10': 'عید الفطر',
        '10-12': 'عید الاضحیٰ'
    };
    return events[`${day}-${month}`] || null;
};

window.renderHijriDate = function() {
    const banner = document.getElementById('hijri-date-banner');
    if (!banner) return;
    
    const hijriMonths = [
        'محرم','صفر','ربیع الاول','ربیع الثانی',
        'جمادی الاول','جمادی الثانی','رجب','شعبان',
        'رمضان','شوال','ذو القعدہ','ذو الحجہ'
    ];
    
    if (PrayerTimes.data && PrayerTimes.data.hijri) {
        const h = PrayerTimes.data.hijri;
        const monthIndex = parseInt(h.month.number) - 1;
        const monthName = hijriMonths[monthIndex] || h.month.ar;
        // Use Urdu month name
        banner.textContent = `${h.day} ${monthName} ${h.year} ھ`;
    } else if (PrayerTimes.data) {
        // Already loaded but no hijri yet — skip
        banner.textContent = '';
    } else {
        // Will be populated after prayer times load
        banner.textContent = '';
    }
};

window.renderPrayerTimesWidget = async function() {
    const content = document.getElementById('prayer-times-content');
    if (!content) return;
    
    try {
        await PrayerTimes.init();
        if (PrayerTimes.data && PrayerTimes.data.timings) {
            const t = PrayerTimes.data.timings;
            const fmt = (timeStr) => {
                let [h, m] = timeStr.split(':');
                h = parseInt(h);
                const ampm = h >= 12 ? 'PM' : 'AM';
                h = h % 12 || 12;
                return `${h}:${m} ${ampm}`;
            };
            const timeToMins = (timeStr) => {
                const [h, m] = timeStr.split(':');
                return parseInt(h) * 60 + parseInt(m);
            };

            const now = new Date();
            const currentMins = now.getHours() * 60 + now.getMinutes();

            const prayers = [
                { name: 'فجر', time: t.Fajr },
                { name: 'ظہر', time: t.Dhuhr },
                { name: 'عصر', time: t.Asr },
                { name: 'مغرب', time: t.Maghrib },
                { name: 'عشاء', time: t.Isha }
            ];
            
            let nextP = prayers[0];
            for (let p of prayers) {
                if (timeToMins(p.time) > currentMins) {
                    nextP = p;
                    break;
                }
            }

            // Hijri Date Construction
            const hijriMonths = ['محرم','صفر','ربیع الاول','ربیع الثانی','جمادی الاول','جمادی الثانی','رجب','شعبان','رمضان','شوال','ذو القعدہ','ذو الحجہ'];
            let hijriStr = '';
            let eventStr = '';
            if (PrayerTimes.data.hijri) {
                const h = PrayerTimes.data.hijri;
                const monthName = hijriMonths[parseInt(h.month.number) - 1] || h.month.ar;
                hijriStr = `${h.day} ${monthName} ${h.year}ھ`;
                
                const event = getIslamicEvent(parseInt(h.day), parseInt(h.month.number));
                if (event) {
                    eventStr = `<div style="color: #fdbf24; font-size: 0.65rem; margin-top: 2px; font-weight: bold;">${event}</div>`;
                }
            }

            // English Date Construction in Urdu
            const urduMonths = ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'];
            const englishDateUrdu = `${now.getDate()} ${urduMonths[now.getMonth()]} ${now.getFullYear()}ء`;

            content.innerHTML = `
                <!-- Right Side: Hijri & Sunrise -->
                <div style="flex: 1; text-align: center; display: flex; flex-direction: column; justify-content: flex-end;">
                    <div style="color: var(--primary); font-family: 'Noto Nastaliq Urdu', serif; font-size: 0.7rem; margin-bottom: 2px; white-space: nowrap;">${hijriStr}</div>
                    ${eventStr}
                    <div style="height: 1px; background: linear-gradient(90deg, transparent, var(--card-border), transparent); margin-bottom: 5px;"></div>
                    <span style="color: var(--text-muted); font-size: 0.7rem; font-family: 'Noto Nastaliq Urdu', serif; display: block;">طلوعِ آفتاب</span>
                    <span style="font-size: 0.85rem; font-weight: 600;">${fmt(t.Sunrise)}</span>
                </div>

                <!-- Center: Next Prayer -->
                <div style="flex: 1.2; text-align: center; border-left: 1px solid rgba(251, 191, 36, 0.2); border-right: 1px solid rgba(251, 191, 36, 0.2); padding: 0 5px; display: flex; flex-direction: column; justify-content: center;">
                    <strong style="display:block; color:var(--primary); font-size:0.9rem; font-family:'Noto Nastaliq Urdu', serif; margin-bottom: 2px;">${nextP.name}</strong>
                    <span style="font-size: 1.1rem; font-weight: bold; font-family: 'Inter', sans-serif;">${fmt(nextP.time)}</span>
                </div>

                <!-- Left Side: English Date & Sunset -->
                <div style="flex: 1; text-align: center; display: flex; flex-direction: column; justify-content: flex-end;">
                    <div style="color: var(--primary); font-family: 'Noto Nastaliq Urdu', serif; font-size: 0.7rem; margin-bottom: 2px; white-space: nowrap;">${englishDateUrdu}</div>
                    <div style="height: 1px; background: linear-gradient(90deg, transparent, var(--card-border), transparent); margin-bottom: 5px;"></div>
                    <span style="color: var(--text-muted); font-size: 0.7rem; font-family: 'Noto Nastaliq Urdu', serif; display: block;">غروبِ آفتاب</span>
                    <span style="font-size: 0.85rem; font-weight: 600;">${fmt(t.Sunset)}</span>
                </div>
            `;
            // Add custom style to the container for horizontal layout
            content.style.flexDirection = 'row';
            content.style.justifyContent = 'space-between';
            content.style.alignItems = 'stretch';
            content.style.gap = '5px';
        } else {
            content.innerHTML = `
                <div style="width:100%; text-align:center;">
                    <span style="font-size:0.8rem; display:block; margin-bottom:5px;">انٹرنیٹ کنکشن میں خرابی ہے۔</span>
                    <button class="btn primary-btn" style="padding: 4px 10px; font-size: 0.7rem; width: auto;" onclick="renderPrayerTimesWidget()">دوبارہ کوشش کریں</button>
                </div>
            `;
        }
    } catch(err) {
        let msg = "براہ کرم پیج ریفریش کریں یا لوکیشن سیٹ کریں۔";
        content.innerHTML = `
            <div style="width:100%; text-align:center;">
                <span style="font-size:0.85rem; color:#ff6b6b; display:block; margin-bottom:5px; font-family:'Noto Nastaliq Urdu', serif;">${msg}</span>
                <button class="btn primary-btn" style="padding: 4px 10px; font-size: 0.7rem; width: auto;" onclick="renderPrayerTimesWidget()">دوبارہ کوشش کریں</button>
            </div>
        `;
    }
};

window.openPrayerModal = function() {
    const modal = document.getElementById('prayer-modal');
    const list = document.getElementById('full-prayer-times-list');
    
    const lat = localStorage.getItem('islamic_lat');
    const lng = localStorage.getItem('islamic_lng');
    const cityInput = document.getElementById('modal-prayer-city');
    
    if (lat && lng) {
        cityInput.value = '';
        cityInput.placeholder = 'موجودہ لوکیشن استعمال ہو رہی ہے';
    } else {
        cityInput.value = localStorage.getItem('islamic_city') || 'Islamabad';
        cityInput.placeholder = 'شہر کا نام (مثلاً Islamabad)';
    }
    
    if (PrayerTimes.data && PrayerTimes.data.timings) {
        const t = PrayerTimes.data.timings;
        const fmt = (timeStr) => {
            let [h, m] = timeStr.split(':');
            h = parseInt(h);
            const ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12 || 12;
            return `${h}:${m} ${ampm}`;
        };
        const timeToMins = (timeStr) => {
            const [h, m] = timeStr.split(':');
            return parseInt(h) * 60 + parseInt(m);
        };
        const minsToFmt = (mins) => {
            const h = Math.floor(mins/60);
            const m = mins%60;
            return fmt(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
        };

        const sunriseMins = timeToMins(t.Sunrise);
        const ishraqMins = sunriseMins + 15;
        const dhuhrMins = timeToMins(t.Dhuhr);
        const chashtMins = sunriseMins + Math.floor((dhuhrMins - sunriseMins) / 2);

        list.innerHTML = `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top:20px;">
                <div class="glass" style="padding:10px; text-align:center;"><span style="color:var(--text-muted); font-size:0.8rem; display:block; font-family:'Noto Nastaliq Urdu',serif;">ختم سحر</span><strong style="color:var(--primary); font-size:1.1rem;">${fmt(t.Imsak)}</strong></div>
                <div class="glass" style="padding:10px; text-align:center;"><span style="color:var(--text-muted); font-size:0.8rem; display:block; font-family:'Noto Nastaliq Urdu',serif;">فجر</span><strong style="color:var(--primary); font-size:1.1rem;">${fmt(t.Fajr)}</strong></div>
                
                <div class="glass" style="padding:10px; text-align:center;"><span style="color:var(--text-muted); font-size:0.8rem; display:block; font-family:'Noto Nastaliq Urdu',serif;">طلوعِ آفتاب</span><strong style="color:var(--primary); font-size:1.1rem;">${fmt(t.Sunrise)}</strong></div>
                <div class="glass" style="padding:10px; text-align:center;"><span style="color:var(--text-muted); font-size:0.8rem; display:block; font-family:'Noto Nastaliq Urdu',serif;">اشراق</span><strong style="color:var(--primary); font-size:1.1rem;">${minsToFmt(ishraqMins)}</strong></div>
                
                <div class="glass" style="padding:10px; text-align:center; grid-column: span 2;"><span style="color:var(--text-muted); font-size:0.8rem; display:block; font-family:'Noto Nastaliq Urdu',serif;">چاشت (مستحب)</span><strong style="color:var(--primary); font-size:1.1rem;">${minsToFmt(chashtMins)}</strong></div>
                
                <div class="glass" style="padding:10px; text-align:center;"><span style="color:var(--text-muted); font-size:0.8rem; display:block; font-family:'Noto Nastaliq Urdu',serif;">ظہر</span><strong style="color:var(--primary); font-size:1.1rem;">${fmt(t.Dhuhr)}</strong></div>
                <div class="glass" style="padding:10px; text-align:center;"><span style="color:var(--text-muted); font-size:0.8rem; display:block; font-family:'Noto Nastaliq Urdu',serif;">عصر</span><strong style="color:var(--primary); font-size:1.1rem;">${fmt(t.Asr)}</strong></div>
                
                <div class="glass" style="padding:10px; text-align:center;"><span style="color:var(--text-muted); font-size:0.8rem; display:block; font-family:'Noto Nastaliq Urdu',serif;">مغرب / افطار</span><strong style="color:var(--primary); font-size:1.1rem;">${fmt(t.Maghrib)}</strong></div>
                <div class="glass" style="padding:10px; text-align:center;"><span style="color:var(--text-muted); font-size:0.8rem; display:block; font-family:'Noto Nastaliq Urdu',serif;">عشاء</span><strong style="color:var(--primary); font-size:1.1rem;">${fmt(t.Isha)}</strong></div>
            </div>
        `;
    } else {
        list.innerHTML = `<p style="text-align:center; margin-top:20px; color:var(--text-muted);">اوقات دستیاب نہیں ہیں، براہ کرم لوکیشن سیٹ کریں۔</p>`;
    }
    
    modal.classList.add('active');
}

window.closePrayerModal = function() {
    const modal = document.getElementById('prayer-modal');
    modal.classList.remove('active');
}

window.saveModalCitySettings = async function() {
    const city = document.getElementById('modal-prayer-city').value;
    if(city) {
        localStorage.setItem('islamic_city', city);
        localStorage.removeItem('islamic_lat');
        localStorage.removeItem('islamic_lng');
        localStorage.removeItem('islamic_prayertimes');
        PrayerTimes.data = null;
        alert('شہر محفوظ ہو گیا۔ اوقات اپڈیٹ ہو رہے ہیں...');
        closePrayerModal();
        if (document.getElementById('prayer-times-content')) {
            document.getElementById('prayer-times-content').innerHTML = `<span style="width: 100%; text-align: center; color: var(--text-muted); font-size: 0.8rem;">اوقات معلوم کیے جا رہے ہیں...</span>`;
        }
        await PrayerTimes.init();
        if(typeof renderPrayerTimesWidget === 'function') {
            renderPrayerTimesWidget();
        }
    }
}

window.useMyLocation = function() {
    if (!navigator.geolocation) {
        alert('آپ کا براؤزر لوکیشن کی سہولت فراہم نہیں کرتا۔');
        return;
    }

    const btn = event.currentTarget;
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>لوکیشن معلوم کی جا رہی ہے...</span>';
    btn.disabled = true;

    navigator.geolocation.getCurrentPosition(async (position) => {
        localStorage.setItem('islamic_lat', position.coords.latitude);
        localStorage.setItem('islamic_lng', position.coords.longitude);
        localStorage.removeItem('islamic_city');
        localStorage.removeItem('islamic_prayertimes');
        PrayerTimes.data = null;
        
        alert('لوکیشن محفوظ ہو گئی۔ اوقات اپڈیٹ ہو رہے ہیں...');
        btn.innerHTML = originalContent;
        btn.disabled = false;
        closePrayerModal();
        
        if (document.getElementById('prayer-times-content')) {
            document.getElementById('prayer-times-content').innerHTML = `<span style="width: 100%; text-align: center; color: var(--text-muted); font-size: 0.8rem;">اوقات معلوم کیے جا رہے ہیں...</span>`;
        }
        await PrayerTimes.init();
        if(typeof renderPrayerTimesWidget === 'function') {
            renderPrayerTimesWidget();
        }
    }, (error) => {
        btn.innerHTML = originalContent;
        btn.disabled = false;
        let msg = 'لوکیشن حاصل کرنے میں ناکامی ہوئی۔';
        if (error.code === 1) msg = 'براہ کرم لوکیشن کی اجازت دیں۔';
        alert(msg);
    });
}
// ─────────────── Backup & Restore ───────────────
window.restoreFromAutoBackup = function() {
    const autoData = localStorage.getItem('auto_backup_data');
    if (!autoData) {
        alert('کوئی آٹو بیک اپ نہیں ملا۔');
        return;
    }
    
    if (confirm('کیا آپ واقعی آٹو بیک اپ سے ڈیٹا بحال کرنا چاہتے ہیں؟ موجودہ ڈیٹا تبدیل ہو جائے گا۔')) {
        const data = JSON.parse(autoData);
        if (data.tasks) localStorage.setItem('islamic_tasks', JSON.stringify(data.tasks));
        if (data.logs) localStorage.setItem('islamic_logs', JSON.stringify(data.logs));
        if (data.quran) localStorage.setItem('islamic_quran', JSON.stringify(data.quran));
        if (data.settings) {
            if (data.settings.method) localStorage.setItem('islamic_method', data.settings.method);
            if (data.settings.school) localStorage.setItem('islamic_school', data.settings.school);
            if (data.settings.tasbeeh_audio) localStorage.setItem('tasbeeh_audio', data.settings.tasbeeh_audio);
        }
        alert('ڈیٹا کامیابی سے بحال کر دیا گیا ہے۔ ایپ ری لوڈ ہو رہی ہے...');
        window.location.reload();
    }
};

// ─────────────── Tasbeeh Counter ───────────────
let tasbeehCount = 0;

window.incrementTasbeeh = function() {
    State.playClick();
    tasbeehCount++;
    const target = parseInt(localStorage.getItem('tasbeeh_target')) || 33;
    
    const countEl = document.getElementById('tasbeeh-count');
    const fillEl = document.getElementById('tasbeeh-bar-fill');
    const btn = document.getElementById('tasbeeh-btn');
    
    if (countEl) countEl.textContent = tasbeehCount;
    if (fillEl) {
        const pct = Math.min((tasbeehCount / target) * 100, 100);
        fillEl.style.width = pct + '%';
    }
    
    // Pulse animation on button
    if (btn) {
        btn.style.transform = 'scale(0.9)';
        setTimeout(() => btn.style.transform = 'scale(1)', 150);
    }
    
    // Vibrate on mobile if supported
    if (navigator.vibrate) navigator.vibrate(30);
    
    if (tasbeehCount === target) {
        setTimeout(() => {
            alert(`ماشاءاللہ! ${target} مرتبہ مکمل ہو گیا۔ کیا دوبارہ شروع کریں؟`);
            tasbeehCount = 0;
            if (countEl) countEl.textContent = 0;
            if (fillEl) fillEl.style.width = '0%';
        }, 200);
    }
};

window.resetTasbeeh = function() {
    if (tasbeehCount === 0 || confirm('کیا آپ واقعی ری سیٹ کرنا چاہتے ہیں؟')) {
        tasbeehCount = 0;
        const countEl = document.getElementById('tasbeeh-count');
        const fillEl = document.getElementById('tasbeeh-bar-fill');
        if (countEl) countEl.textContent = 0;
        if (fillEl) fillEl.style.width = '0%';
    }
};

window.saveTasbeehSettings = function() {
    const label = document.getElementById('new-tasbeeh-label').value.trim();
    const target = parseInt(document.getElementById('new-tasbeeh-target').value);
    
    if (label) localStorage.setItem('tasbeeh_label', label);
    if (target && target > 0) localStorage.setItem('tasbeeh_target', target);
    
    tasbeehCount = 0;
    navigateTo('tasbeeh');
};

// --- Quran Tracker Logic ---

window.renderQuranTabs = function(tab) {
    const content = document.getElementById('quran-content');
    if (!content) return;

    // Update tab styles
    document.querySelectorAll('.quran-tab-btn').forEach(btn => {
        if (btn.dataset.tab === tab) {
            btn.classList.add('primary-btn');
            btn.style.background = 'var(--primary)';
            btn.style.color = '#fff';
        } else {
            btn.classList.remove('primary-btn');
            btn.style.background = 'rgba(251, 191, 36, 0.1)';
            btn.style.color = 'var(--primary)';
        }
    });

    let html = '';
    if (tab === 'paras') {
        html = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px;">';
        for (let i = 1; i <= 30; i++) {
            const isDone = State.quran.paras.includes(i);
            const page = PARA_PAGES[i] || 2;
            html += `
                <div class="glass quran-item ${isDone ? 'done' : ''}" 
                     style="padding: 15px; text-align: center; cursor: pointer; border: 1px solid ${isDone ? 'var(--primary)' : 'var(--card-border)'}; background: ${isDone ? 'rgba(212,175,55,0.1)' : 'rgba(255,255,255,0.05)'}; position: relative;">
                    <div onclick="toggleQuranItem('para', ${i})" style="margin-bottom: 8px;">
                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 5px;">پارہ</div>
                        <div style="font-size: 1.2rem; font-weight: bold; color: ${isDone ? 'var(--primary)' : 'var(--text-main)'};">${i}</div>
                        ${isDone ? '<i class="fa-solid fa-circle-check" style="position: absolute; top: 5px; right: 5px; font-size: 0.8rem; color: var(--primary);"></i>' : ''}
                    </div>
                    <button class="btn" style="padding: 4px; font-size: 0.7rem; background: rgba(255,255,255,0.1); width: 100%;" onclick="openPdfAtPage(${page})">
                        <i class="fa-solid fa-book-open"></i> کھولیں
                    </button>
                </div>
            `;
        }
        html += '</div>';
    } else if (tab === 'surahs') {
        const surahs = [
            "الفاتحة", "البقرة", "آل عمران", "النساء", "المائدة", "الأنعام", "الأعراف", "الأنفال", "التوبة", "يونس",
            "هود", "يوسف", "الرعد", "إبراهيم", "الحجر", "النحل", "الإسراء", "الكهف", "مريم", "طه",
            "الأنبياء", "الحج", "المؤمنون", "النور", "الفرقان", "الشعراء", "النمل", "القصص", "العنكبوت", "الروم",
            "لقمان", "السجدة", "الأحزاب", "سبأ", "فاطر", "يس", "الصافات", "ص", "الزمر", "غافر",
            "فصلت", "الشورى", "الزخرف", "الدخان", "الجاثية", "الأحقاف", "محمد", "الفتح", "الحجرات", "ق",
            "الذاريات", "الطور", "النجم", "القمر", "الرحمن", "الواقعة", "الحديد", "المجادلة", "الحشر", "الممتحنة",
            "الصف", "الجمعة", "المنافقون", "التغابن", "الطلاق", "التحریم", "الملک", "القلم", "الحاقة", "المعارج",
            "نوح", "الجن", "المزمل", "المدثر", "القيامة", "الإنسان", "المرسلات", "النبأ", "النازعات", "عبس",
            "التكوير", "الانفطار", "المطففين", "الانشقاق", "البروج", "الطارق", "الأعلى", "الغاشية", "الفجر", "البلد",
            "الشمس", "الليل", "الضحى", "الشرح", "التین", "العلق", "القدر", "البينة", "الزلزلة", "العاديات",
            "القارعة", "التکاثر", "العصر", "الهمزة", "الفيل", "قريش", "الماعون", "الکوثر", "الكافرون", "النصر",
            "المسد", "الإخلاص", "الفلق", "الناس"
        ];
        html = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px;">';
        surahs.forEach((name, index) => {
            const id = index + 1;
            const isDone = State.quran.surahs.includes(id);
            const page = SURAH_PAGES[id] || 2;
            html += `
                <div class="glass quran-item ${isDone ? 'done' : ''}" 
                     style="padding: 15px; text-align: center; border: 1px solid ${isDone ? 'var(--primary)' : 'var(--card-border)'}; background: ${isDone ? 'rgba(212,175,55,0.1)' : 'rgba(255,255,255,0.05)'}; position: relative;">
                    <div onclick="toggleQuranItem('surah', ${id})" style="cursor: pointer; margin-bottom: 10px;">
                        <div style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 5px;">سورة رقم ${id}</div>
                        <div style="font-size: 1.1rem; font-weight: bold; color: ${isDone ? 'var(--primary)' : 'var(--text-main)'}; font-family: 'Amiri', serif;">${name}</div>
                        ${isDone ? '<i class="fa-solid fa-circle-check" style="position: absolute; top: 5px; right: 5px; font-size: 0.8rem; color: var(--primary);"></i>' : ''}
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 5px;">
                        <button class="btn" style="padding: 4px; font-size: 0.7rem; background: rgba(255,255,255,0.1); width: 100%; color: #fff;" onclick="readSurah(${id}, '${name}')">
                            <i class="fa-solid fa-language"></i> ترجمہ
                        </button>
                        <button class="btn" style="padding: 4px; font-size: 0.7rem; background: rgba(212,175,55,0.1); width: 100%; color: var(--primary); border: 1px solid var(--primary);" onclick="openPdfAtPage(${page})">
                            <i class="fa-solid fa-book-open"></i> تلاوت
                        </button>
                    </div>
                </div>
            `;
        });
        html += '</div>';
    } else if (tab === 'pdf') {
        const lastPage = State.quran.lastPage || 2;
        const isUploaded = localStorage.getItem('quran_pdf_uploaded');
        
        html = `
            <div class="glass" style="padding: 20px; text-align: center; margin-bottom: 20px;">
                <i class="fa-solid fa-book-quran" style="font-size: 3rem; color: var(--primary); margin-bottom: 15px;"></i>
                <h3 style="margin-bottom: 10px; color: var(--text-main);">تلاوتِ قرآن کریم (PDF)</h3>
                
                <div id="pdf-status-container">
                    ${isUploaded ? `
                        <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 20px;">
                            قرآن پاک کی فائل تیار ہے۔ آپ وہیں سے شروع کر سکتے ہیں جہاں چھوڑا تھا۔
                        </p>
                        <div style="display: flex; gap: 10px;">
                            <button class="btn primary-btn" style="flex:2;" onclick="openPdfAtPage(${lastPage})">
                                <i class="fa-solid fa-play"></i> تلاوت شروع کریں (صفحہ ${lastPage})
                            </button>
                            <button class="btn" style="flex:1; background: rgba(255,107,107,0.1); color: #ff6b6b; border: 1px solid #ff6b6b;" onclick="removePdf()">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    ` : `
                        <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 20px;">
                            قرآن پاک کی فائل لوڈ کرنے کے لیے نیچے بٹن پر کلک کریں۔
                        </p>
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            <button class="btn primary-btn" onclick="document.getElementById('quran-pdf-input').click()">
                                <i class="fa-solid fa-file-import"></i> فائل منتخب کریں (Select File)
                            </button>
                            <input type="file" id="quran-pdf-input" accept="application/pdf" style="display: none;" onchange="handlePdfUpload(event)">
                            
                            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.05);">
                                <button class="btn" style="font-size: 0.8rem; background: rgba(255,255,255,0.05); width: 100%;" onclick="autoLoadPdf()">
                                    یا خودکار لوڈ کرنے کی کوشش کریں
                                </button>
                            </div>
                        </div>
                    `}
                </div>
            </div>
        `;
    }
    content.innerHTML = html;
};

window.toggleQuranItem = function(type, id) {
    const list = type === 'para' ? State.quran.paras : State.quran.surahs;
    const index = list.indexOf(id);
    
    if (index === -1) {
        list.push(id);
    } else {
        list.splice(index, 1);
    }
    
    State.saveQuran();
    renderQuranTabs(type === 'para' ? 'paras' : 'surahs');
};

window.readSurah = async function(id, name) {
    const content = document.getElementById('quran-content');
    if (!content) return;

    // Show loading
    content.innerHTML = `
        <div style="text-align:center; padding: 40px;">
            <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary); margin-bottom: 10px;"></i>
            <div style="color: var(--text-muted);">لوڈ ہو رہا ہے...</div>
        </div>
    `;

    try {
        // Check cache first
        const cacheKey = `quran_surah_${id}`;
        let surahData = JSON.parse(localStorage.getItem(cacheKey));

        if (!surahData) {
            if (!navigator.onLine) {
                throw new Error('آف لائن: یہ سورہ پہلے سے لوڈ نہیں ہے۔ براہ کرم انٹرنیٹ آن کریں۔');
            }

            // Fetch Arabic and Urdu in parallel
            const [arRes, urRes] = await Promise.all([
                fetch(`https://api.alquran.cloud/v1/surah/${id}/quran-uthmani`),
                fetch(`https://api.alquran.cloud/v1/surah/${id}/ur.jundagar`)
            ]);

            const arJson = await arRes.json();
            const urJson = await urRes.json();

            if (arJson.code === 200 && urJson.code === 200) {
                surahData = {
                    name: arJson.data.name,
                    englishName: arJson.data.englishName,
                    verses: arJson.data.ayahs.map((ayah, i) => ({
                        number: ayah.numberInSurah,
                        arabic: ayah.text,
                        urdu: urJson.data.ayahs[i].text
                    }))
                };
                // Save to cache
                localStorage.setItem(cacheKey, JSON.stringify(surahData));
            } else {
                throw new Error('ڈیٹا لوڈ کرنے میں دشواری پیش آئی۔');
            }
        }

        renderSurahContent(surahData, id);
    } catch (err) {
        content.innerHTML = `
            <div class="glass" style="padding: 20px; text-align: center; color: #ff6b6b; border: 1px solid #ff6b6b44;">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; margin-bottom: 10px;"></i>
                <p>${err.message}</p>
                <button class="btn" style="margin-top: 15px; background: rgba(255,255,255,0.1);" onclick="renderQuranTabs('surahs')">واپس جائیں</button>
            </div>
        `;
    }
};

// --- Constants for Quran PDF (16-line Tajwid Version) ---
const DEFAULT_PDF_URL = '16-line-quran-tajwid-colored.pdf'; 
const SAUDI_PRINT_URL = 'https://archive.org/download/Quran-15-Lines-Saudi-Print/Quran-15-Lines-Saudi-Print.pdf';

// Standard 16-line Taj Company mapping (No extra offset)
const PARA_PAGES = {
    1: 1, 2: 21, 3: 41, 4: 61, 5: 81, 6: 101, 7: 121, 8: 141, 9: 161, 10: 181,
    11: 201, 12: 221, 13: 241, 14: 261, 15: 281, 16: 301, 17: 321, 18: 341, 19: 361, 20: 381,
    21: 401, 22: 421, 23: 441, 24: 461, 25: 481, 26: 501, 27: 521, 28: 541, 29: 561, 30: 581
};

const SURAH_PAGES = {
    1: 1, 2: 2, 3: 50, 4: 76, 5: 106, 6: 128, 7: 151, 8: 177, 9: 187, 10: 208,
    11: 221, 12: 235, 13: 249, 14: 255, 15: 261, 16: 267, 17: 282, 18: 293, 19: 305, 20: 312,
    21: 322, 22: 332, 23: 342, 24: 350, 25: 359, 26: 367, 27: 377, 28: 385, 29: 396, 30: 404,
    31: 411, 32: 415, 33: 418, 34: 428, 35: 434, 36: 440, 37: 446, 38: 453, 39: 458, 40: 467,
    41: 477, 42: 483, 43: 489, 44: 496, 45: 499, 46: 503, 47: 507, 48: 511, 49: 515, 50: 518,
    51: 521, 52: 523, 53: 526, 54: 529, 55: 532, 56: 535, 57: 538, 58: 542, 59: 545, 60: 549,
    61: 551, 62: 553, 63: 555, 64: 557, 65: 559, 66: 561, 67: 563, 68: 565, 69: 568, 70: 570,
    71: 572, 72: 574, 73: 576, 74: 578, 75: 580, 76: 582, 77: 584, 78: 586, 79: 588, 80: 590,
    81: 591, 82: 592, 83: 593, 84: 594, 85: 596, 86: 597, 87: 597, 88: 598, 89: 599, 90: 600,
    91: 601, 92: 601, 93: 602, 94: 602, 95: 603, 96: 603, 97: 604, 98: 604, 99: 605, 100: 605,
    101: 606, 102: 606, 103: 606, 104: 607, 105: 607, 106: 607, 107: 608, 108: 608, 109: 608, 110: 609,
    111: 609, 112: 609, 113: 610, 114: 610
};

// --- PDF Management Logic ---
let pdfDoc = null;
let currentPdfPage = 1;
let pdfScale = 1.0; // Default scale for auto-fit

window.autoLoadPdf = async function() {
    showToast('قرآن پاک کی فائل لوڈ کی جا رہی ہے، براہِ کرم انتظار کریں...', 'info');
    
    // اگر فائل سسٹم سے کھولی گئی ہے تو fetch کام نہیں کرے گا
    if (window.location.protocol === 'file:') {
        showToast('براہِ کرم "فائل منتخب کریں" والا بٹن استعمال کریں کیونکہ آپ ایپ کو براہِ راست فائل سے چلا رہے ہیں۔', 'warning');
        return;
    }

    try {
        let response;
        try {
            response = await fetch(DEFAULT_PDF_URL);
            if (!response.ok) throw new Error('Local file not found');
        } catch (e) {
            response = await fetch(SAUDI_PRINT_URL);
        }

        if (!response.ok) throw new Error('Failed to fetch PDF');

        const arrayBuffer = await response.arrayBuffer();
        await saveToIndexedDB('quran_pdf', arrayBuffer);
        localStorage.setItem('quran_pdf_uploaded', 'true');
        renderQuranTabs('pdf');
        showToast('قرآن پاک کامیابی سے لوڈ ہو گیا!', 'success');
    } catch (e) {
        console.error(e);
        showToast('فائل لوڈ کرنے میں خرابی آئی۔ "فائل منتخب کریں" والا بٹن آزمائیں۔', 'error');
    }
};

window.handlePdfUpload = async function(event) {
    const file = event.target.files[0];
    if (!file || file.type !== 'application/pdf') return;

    const statusContainer = document.getElementById('pdf-status-container');
    const originalHtml = statusContainer.innerHTML;
    
    // Show loading state immediately
    statusContainer.innerHTML = `
        <div style="padding: 20px; text-align: center;">
            <i class="fa-solid fa-spinner fa-spin fa-3x" style="color: var(--primary); margin-bottom: 15px;"></i>
            <p style="color: var(--text-main); font-weight: bold;">فائل محفوظ کی جا رہی ہے...</p>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 5px;">براہِ کرم انتظار کریں، اس میں چند سیکنڈ لگ سکتے ہیں۔</p>
        </div>
    `;
    
    const reader = new FileReader();
    reader.onload = async function() {
        try {
            const arrayBuffer = this.result;
            await saveToIndexedDB('quran_pdf', arrayBuffer);
            localStorage.setItem('quran_pdf_uploaded', 'true');
            
            // Success feedback
            statusContainer.innerHTML = `
                <div style="padding: 20px; text-align: center;">
                    <i class="fa-solid fa-circle-check fa-3x" style="color: #4caf50; margin-bottom: 15px;"></i>
                    <p style="color: var(--text-main); font-weight: bold;">کامیابی!</p>
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 5px;">قرآن پاک کی فائل محفوظ ہو گئی ہے۔</p>
                </div>
            `;
            
            setTimeout(() => renderQuranTabs('pdf'), 1500);
        } catch (e) {
            console.error(e);
            statusContainer.innerHTML = originalHtml;
            showToast('فائل محفوظ کرنے میں خرابی آئی۔', 'error');
        }
    };
    reader.onerror = function() {
        statusContainer.innerHTML = originalHtml;
        showToast('فائل پڑھنے میں خرابی آئی۔', 'error');
    };
    reader.readAsArrayBuffer(file);
};

window.removePdf = function() {
    if (confirm('کیا آپ واقعی اس فائل کو ختم کرنا چاہتے ہیں؟')) {
        deleteFromIndexedDB('quran_pdf');
        localStorage.removeItem('quran_pdf_uploaded');
        renderQuranTabs('pdf');
        showToast('فائل ختم کر دی گئی۔', 'info');
    }
};

window.openPdfAtPage = async function(page) {
    // Apply calibration offset
    const offset = parseInt(localStorage.getItem('quran_pdf_offset') || '0');
    const actualPage = page + offset;

    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <div id="pdf-viewer-overlay" style="position:fixed; top:0; left:0; width:100%; height:100%; background:#111; z-index:2000; display:flex; flex-direction:column;">
            <div class="top-strip" style="position:relative; border-bottom:1px solid rgba(255,255,255,0.1); padding:10px 15px; display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.8);">
                <button class="btn" onclick="closePdfViewer()" style="background:rgba(255,255,255,0.1); border-radius:50%; width:35px; height:35px; display:flex; align-items:center; justify-content:center; color:#fff;">
                    <i class="fa-solid fa-xmark"></i>
                </button>
                <div style="text-align:center;">
                    <div id="pdf-page-info" style="font-weight:bold; color:var(--primary);">صفحہ ${actualPage}</div>
                    <div style="font-size:0.6rem; color:rgba(255,255,255,0.4); cursor:pointer;" onclick="calibratePdf()">صفحہ درست کریں (Calibrate)</div>
                </div>
                <div style="display:flex; gap:5px;">
                    <button class="btn" onclick="goToSpecificPage()" style="background:rgba(255,255,255,0.1); width:35px; height:35px; padding:0; color:#fff;"><i class="fa-solid fa-arrow-right-to-bracket"></i></button>
                    <button class="btn" onclick="changePdfZoom(-0.2)" style="background:rgba(255,255,255,0.1); width:35px; height:35px; padding:0; color:#fff;"><i class="fa-solid fa-minus"></i></button>
                    <button class="btn" onclick="changePdfZoom(0.2)" style="background:rgba(255,255,255,0.1); width:35px; height:35px; padding:0; color:#fff;"><i class="fa-solid fa-plus"></i></button>
                </div>
            </div>
            <div id="pdf-canvas-container" style="flex:1; overflow:auto; display:flex; justify-content:center; align-items:flex-start; background:#1a1a1a; position:relative; -webkit-overflow-scrolling: touch;">
                <canvas id="pdf-render-canvas" style="box-shadow: 0 0 30px rgba(0,0,0,0.8); max-width: 100%;"></canvas>
                <div id="pdf-loader" style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); color:var(--primary);">
                    <i class="fa-solid fa-spinner fa-spin fa-3x"></i>
                </div>
            </div>
            <div style="padding:15px; background:rgba(0,0,0,0.9); border-top:1px solid rgba(255,255,255,0.1); display:flex; justify-content:space-between; align-items:center;">
                <button class="btn primary-btn" onclick="pdfPrevPage()" style="flex:1; margin-left:10px; padding: 12px; font-size: 1rem;">
                    <i class="fa-solid fa-chevron-right"></i> پچھلا
                </button>
                <button class="btn primary-btn" onclick="pdfNextPage()" style="flex:1; padding: 12px; font-size: 1rem;">
                    اگلا <i class="fa-solid fa-chevron-left"></i>
                </button>
            </div>
        </div>
    `;

    try {
        const pdfData = await getFromIndexedDB('quran_pdf');
        if (!pdfData) {
            showToast('پی ڈی ایف فائل نہیں ملی۔', 'error');
            closePdfViewer();
            return;
        }

        const loadingTask = pdfjsLib.getDocument({ data: pdfData });
        pdfDoc = await loadingTask.promise;
        currentPdfPage = actualPage;
        
        await calculateAutoFitScale();
        renderPdfPage(currentPdfPage);
        setupPdfGestures();
    } catch (e) {
        console.error(e);
        showToast('پی ڈی ایف لوڈ کرنے میں خرابی آئی۔', 'error');
        closePdfViewer();
    }
};

window.calibratePdf = function() {
    const currentPage = currentPdfPage;
    const correctPage = prompt(`یہ پی ڈی ایف کا صفحہ نمبر ${currentPage} ہے۔\nآپ کے مطابق یہ اصل میں کون سا صفحہ ہونا چاہیے؟`, currentPage);
    
    if (correctPage !== null && !isNaN(correctPage)) {
        const diff = parseInt(correctPage) - currentPage;
        const currentOffset = parseInt(localStorage.getItem('quran_pdf_offset') || '0');
        const newOffset = currentOffset + diff;
        
        localStorage.setItem('quran_pdf_offset', newOffset);
        showToast(`سیٹنگ محفوظ ہو گئی۔ اب میپنگ درست ہو جائے گی!`, 'success');
        
        // Re-open current view to apply changes
        const basePage = currentPdfPage - newOffset;
        openPdfAtPage(basePage);
    }
};

window.goToSpecificPage = function() {
    const targetPage = prompt('کس صفحہ نمبر پر جانا چاہتے ہیں؟');
    if (targetPage !== null && !isNaN(targetPage)) {
        const offset = parseInt(localStorage.getItem('quran_pdf_offset') || '0');
        const basePage = parseInt(targetPage) - offset;
        openPdfAtPage(basePage);
    }
};

async function calculateAutoFitScale() {
    if (!pdfDoc) return;
    const page = await pdfDoc.getPage(currentPdfPage);
    const container = document.getElementById('pdf-canvas-container');
    const viewport = page.getViewport({ scale: 1.0 });
    
    // Calculate scale to fit width of container (with a small margin)
    const availableWidth = container.clientWidth - 20;
    pdfScale = availableWidth / viewport.width;
    
    // Cap minimum and maximum auto-scale
    pdfScale = Math.min(Math.max(pdfScale, 0.8), 2.5);
}

async function renderPdfPage(num) {
    if (!pdfDoc) return;
    const canvas = document.getElementById('pdf-render-canvas');
    const loader = document.getElementById('pdf-loader');
    const ctx = canvas.getContext('2d');
    
    if (loader) loader.style.display = 'block';

    const page = await pdfDoc.getPage(num);
    const viewport = page.getViewport({ scale: pdfScale });
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
        canvasContext: ctx,
        viewport: viewport
    };
    
    await page.render(renderContext).promise;
    if (loader) loader.style.display = 'none';
    
    document.getElementById('pdf-page-info').textContent = `صفحہ ${num}`;
    
    // Save last read page
    State.quran.lastPage = num;
    localStorage.setItem('islamic_quran', JSON.stringify(State.quran));
    
    // Scroll to top of canvas
    document.getElementById('pdf-canvas-container').scrollTop = 0;
}

window.pdfNextPage = function() {
    if (!pdfDoc || currentPdfPage >= pdfDoc.numPages) return;
    currentPdfPage++;
    renderPdfPage(currentPdfPage);
};

window.pdfPrevPage = function() {
    if (!pdfDoc || currentPdfPage <= 1) return;
    currentPdfPage--;
    renderPdfPage(currentPdfPage);
};

window.changePdfZoom = function(delta) {
    pdfScale = Math.min(Math.max(0.5, pdfScale + delta), 4);
    renderPdfPage(currentPdfPage);
};

window.closePdfViewer = function() {
    renderView('quran');
    setTimeout(() => renderQuranTabs('pdf'), 50);
};

function setupPdfGestures() {
    const container = document.getElementById('pdf-canvas-container');
    let touchStartX = 0;
    let touchStartY = 0;
    
    container.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    container.addEventListener('touchend', e => {
        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;
        const diffX = touchEndX - touchStartX;
        const diffY = touchEndY - touchStartY;
        
        // Swipe sensitivity (only if horizontal movement is greater than vertical)
        if (Math.abs(diffX) > 60 && Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX > 0) {
                pdfPrevPage();
            } else {
                pdfNextPage();
            }
        }
    }, { passive: true });
}

// --- IndexedDB Helpers ---
function saveToIndexedDB(key, data) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('QuranAppDB', 1);
        request.onupgradeneeded = e => e.target.result.createObjectStore('files');
        request.onsuccess = e => {
            const db = e.target.result;
            const tx = db.transaction('files', 'readwrite');
            tx.objectStore('files').put(data, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject();
        };
    });
}

function getFromIndexedDB(key) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('QuranAppDB', 1);
        request.onupgradeneeded = e => e.target.result.createObjectStore('files');
        request.onsuccess = e => {
            const db = e.target.result;
            const tx = db.transaction('files', 'readonly');
            const getReq = tx.objectStore('files').get(key);
            getReq.onsuccess = () => resolve(getReq.result);
            getReq.onerror = () => reject();
        };
    });
}

function deleteFromIndexedDB(key) {
    const request = indexedDB.open('QuranAppDB', 1);
    request.onsuccess = e => {
        const db = e.target.result;
        db.transaction('files', 'readwrite').objectStore('files').delete(key);
    };
}

function renderSurahContent(data, id) {
    const content = document.getElementById('quran-content');
    if (!content) return;

    let html = `
        <div style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <button class="btn" style="width: auto; padding: 5px 15px; background: rgba(255,255,255,0.1);" onclick="renderQuranTabs('surahs')">
                    <i class="fa-solid fa-arrow-right"></i> واپس
                </button>
                <div style="text-align: right;">
                    <h3 style="color: var(--primary); font-family: 'Amiri', serif; font-size: 1.5rem; margin: 0;">${data.name}</h3>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">${data.englishName}</div>
                </div>
            </div>

            ${id !== 1 && id !== 9 ? `
                <div style="text-align: center; padding: 20px; font-family: 'Amiri', serif; font-size: 1.8rem; color: var(--text-main); margin-bottom: 20px;">
                    بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                </div>
            ` : ''}

            <div style="display: flex; flex-direction: column; gap: 20px;">
    `;

    data.verses.forEach(verse => {
        // Remove Bismillah from first verse if it's not Surah Fatiha and it exists in text
        let arabicText = verse.arabic;
        if (id !== 1 && verse.number === 1 && arabicText.includes('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ')) {
            arabicText = arabicText.replace('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ', '').trim();
        }

        html += `
            <div class="glass" style="padding: 20px; border-width: 1px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                    <span style="background: var(--primary); color: #000; width: 25px; height: 25px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: bold; flex-shrink: 0;">${verse.number}</span>
                    <div style="text-align: right; font-family: 'Amiri', serif; font-size: 1.8rem; line-height: 2.5; color: var(--text-main); word-break: break-word; direction: rtl;">
                        ${arabicText}
                    </div>
                </div>
                <div style="text-align: right; font-size: 1rem; line-height: 1.8; color: var(--text-muted); font-family: 'Noto Nastaliq Urdu', serif; direction: rtl;">
                    ${verse.urdu}
                </div>
            </div>
        `;
    });

    html += `
            </div>
            <button class="btn primary-btn" style="margin-top: 20px; width: 100%;" onclick="renderQuranTabs('surahs')">مکمل پڑھ لیا</button>
        </div>
    `;

    content.innerHTML = html;
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.addEventListener('DOMContentLoaded', initApp);
