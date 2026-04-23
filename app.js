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

    saveTasks() {
        localStorage.setItem('islamic_tasks', JSON.stringify(this.tasks));
    },
    saveLogs() {
        localStorage.setItem('islamic_logs', JSON.stringify(this.logs));
    }
};

// Router & View Management
const mainContent = document.getElementById('main-content');
const navButtons = document.querySelectorAll('.nav-btn');

const Views = {
    daily() {
        return `
            <div class="view-section">
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

                <!-- Backup & Restore -->
                <h3 style="margin-bottom: 10px; margin-top: 0; font-size: 1rem; color: var(--primary);">ڈیٹا بیک اپ اور ریسٹور</h3>
                <div class="glass" style="padding: 15px; margin-bottom: 20px; border-width: 1px;">
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 12px; line-height: 1.6;">تمام قضا ریکارڈ، معمولات اور لاگز کو JSON فائل میں محفوظ کریں۔</p>
                    <div style="display: flex; gap: 10px;">
                        <button class="btn primary-btn" style="flex:1;" onclick="exportData()">💾 ڈاؤنلوڈ (Export)</button>
                        <button class="btn primary-btn" style="flex:1; background: rgba(212,175,55,0.15); color: var(--primary);" onclick="document.getElementById('import-file').click()">📂 لوڈ (Import)</button>
                    </div>
                    <input type="file" id="import-file" accept=".json" style="display:none;" onchange="importData(event)" />
                </div>

                <!-- Prayer Times Settings -->
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
                            <input type="number" id="task-target" value="100" min="1" />
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
                    <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; margin-bottom:15px;">
                        <div>
                            <label style="color:var(--text-main); font-size:0.8rem; display:block; margin-bottom:5px;">سال</label>
                            <input type="number" id="bulk-years" value="0" min="0" style="width:100%; padding:0.5rem; background:rgba(0,0,0,0.5); border:1px solid var(--card-border); border-radius:5px; color:#fff; font-family: inherit; text-align:center;" />
                        </div>
                        <div>
                            <label style="color:var(--text-main); font-size:0.8rem; display:block; margin-bottom:5px;">مہینے</label>
                            <input type="number" id="bulk-months" value="0" min="0" style="width:100%; padding:0.5rem; background:rgba(0,0,0,0.5); border:1px solid var(--card-border); border-radius:5px; color:#fff; font-family: inherit; text-align:center;" />
                        </div>
                        <div>
                            <label style="color:var(--text-main); font-size:0.8rem; display:block; margin-bottom:5px;">ہفتے</label>
                            <input type="number" id="bulk-weeks" value="0" min="0" style="width:100%; padding:0.5rem; background:rgba(0,0,0,0.5); border:1px solid var(--card-border); border-radius:5px; color:#fff; font-family: inherit; text-align:center;" />
                        </div>
                        <div>
                            <label style="color:var(--text-main); font-size:0.8rem; display:block; margin-bottom:5px;">دن</label>
                            <input type="number" id="bulk-days" value="0" min="0" style="width:100%; padding:0.5rem; background:rgba(0,0,0,0.5); border:1px solid var(--card-border); border-radius:5px; color:#fff; font-family: inherit; text-align:center;" />
                        </div>
                    </div>
                    <button class="btn primary-btn" onclick="addBulkQaza()">تمام نمازوں میں شامل کریں</button>
                    <p style="font-size:0.75rem; color:var(--text-muted); margin-top:8px; text-align:center;">یہ آپ کے درج کردہ عرصے کے مطابق پانچوں نمازوں کی قضا شامل کر دے گا۔</p>
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

                <div class="glass" style="padding: 15px;">
                    <h3 style="font-size: 1rem; margin-bottom: 10px; color: var(--text-main);">ہفتہ وار کارکردگی</h3>
                    <canvas id="progressChart" width="400" height="250"></canvas>
                </div>
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
                        <input type="number" id="new-tasbeeh-target" value="${savedTarget}" min="1" style="width:100%; padding:0.6rem; background:rgba(0,0,0,0.4); border:1px solid var(--card-border); border-radius:8px; color:#fff; font-family:inherit; font-size:1rem;"/>
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
    
    // 3. Render Chart for last 7 days
    renderChart();
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

// App Initialization
function initApp() {
    checkMidnightReset();
    initTheme();
    // Initial Route
    navigateTo('daily');
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
    
    if (years === 0 && months === 0 && weeks === 0 && days === 0) {
        alert('براہ کرم دورانیہ (سال، مہینے، ہفتے یا دن) درج کریں۔');
        return;
    }
    
    const totalDays = (years * 365) + (months * 30) + (weeks * 7) + days;
    
    if (confirm(`کیا آپ واقعی ${totalDays} دنوں کی قضا نمازیں (فرائض) میں شامل کرنا چاہتے ہیں؟`)) {
        State.tasks.forEach(task => {
            if (task.category === 'faraidh' && task.isSystem) {
                if (!task.bulkQaza) task.bulkQaza = 0;
                task.bulkQaza += totalDays;
            }
        });
        State.saveTasks();
        
        document.getElementById('bulk-years').value = 0;
        document.getElementById('bulk-months').value = 0;
        document.getElementById('bulk-weeks').value = 0;
        document.getElementById('bulk-days').value = 0;
        
        if (typeof renderQazaTasks === 'function') renderQazaTasks();
        alert(`${totalDays} دنوں کی نمازیں قضا کھاتے میں شامل کر دی گئی ہیں۔`);
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
            if (PrayerTimes.data.hijri) {
                const h = PrayerTimes.data.hijri;
                const monthName = hijriMonths[parseInt(h.month.number) - 1] || h.month.ar;
                hijriStr = `${h.day} ${monthName} ${h.year}ھ`;
            }

            // English Date Construction in Urdu
            const urduMonths = ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'];
            const englishDateUrdu = `${now.getDate()} ${urduMonths[now.getMonth()]} ${now.getFullYear()}ء`;

            content.innerHTML = `
                <!-- Right Side: Hijri & Sunrise -->
                <div style="flex: 1; text-align: center; display: flex; flex-direction: column; justify-content: flex-end;">
                    <div style="color: var(--primary); font-family: 'Noto Nastaliq Urdu', serif; font-size: 0.7rem; margin-bottom: 2px; white-space: nowrap;">${hijriStr}</div>
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
window.exportData = function() {
    const backup = {
        version: 1,
        exportedAt: new Date().toISOString(),
        tasks: State.tasks,
        logs: State.logs,
        city: localStorage.getItem('islamic_city') || ''
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-day-backup-${getTodayString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

window.importData = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            if (!data.tasks || !data.logs) {
                alert('فائل درست نہیں ہے۔ براہ کرم صحیح بیک اپ فائل منتخب کریں۔');
                return;
            }
            
            if (confirm(`کیا آپ واقعی ${data.tasks.length} معمولات اور ${data.logs.length} لاگز کو ریسٹور کرنا چاہتے ہیں؟ موجودہ ڈیٹا حذف ہو جائے گا۔`)) {
                State.tasks = data.tasks;
                State.logs = data.logs;
                State.saveTasks();
                State.saveLogs();
                if (data.city) localStorage.setItem('islamic_city', data.city);
                alert('ڈیٹا کامیابی سے ریسٹور ہو گیا ہے!');
                navigateTo('daily');
            }
        } catch(err) {
            alert('فائل پڑھنے میں خرابی آئی۔ براہ کرم صحیح JSON فائل منتخب کریں۔');
        }
    };
    reader.readAsText(file);
    // reset input so same file can be re-selected if needed
    event.target.value = '';
};

// ─────────────── Tasbeeh Counter ───────────────
let tasbeehCount = 0;

window.incrementTasbeeh = function() {
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

document.addEventListener('DOMContentLoaded', initApp);
