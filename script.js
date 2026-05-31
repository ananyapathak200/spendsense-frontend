
/* ========================================================
   CONFIG & STATE
======================================================== */
const API_BASE = 'https://spendsense-backend-6.onrender.com';
let USE_LOCAL = false;
let expenses  = [];
let budget    = 0;
let currentUser = null;      // stores { id, name, email }
let authToken   = null;      // stores JWT token from backend
let dateFilter    = 'today';
let expDateFilter = 'all';
 
const CATEGORIES = {Food:'🍔',Travel:'✈️',Shopping:'🛍️',Health:'💊',Bills:'📱',Entertainment:'🎬',Education:'📚',Other:'📦'};
const CAT_COLORS  = {Food:'#fb923c',Travel:'#3b82f6',Shopping:'#a855f7',Health:'#ef4444',Bills:'#f59e0b',Entertainment:'#ec4899',Education:'#10b981',Other:'#64748b'};
let barChart,pieChart,barCompareChart,lineChart;
 
/* ========================================================
   PAGE MANAGEMENT  (auth pages vs app)
======================================================== */
function showPage(page) {
  document.getElementById('page-login').style.display    = 'none';
  document.getElementById('page-register').style.display = 'none';
  document.getElementById('page-app').style.display      = 'none';
  if (page === 'login')    document.getElementById('page-login').style.display    = 'flex';
  if (page === 'register') document.getElementById('page-register').style.display = 'flex';
  if (page === 'app')      document.getElementById('page-app').style.display      = 'grid';
}
 
/* ========================================================
   ON PAGE LOAD — check if already logged in
======================================================== */
document.addEventListener('DOMContentLoaded', () => {
  // Check if token exists in localStorage (user logged in before)
  const savedToken = localStorage.getItem('authToken');
  const savedUser  = localStorage.getItem('currentUser');
 
  if (savedToken && savedUser) {
    // User was logged in before — restore session
    authToken   = savedToken;
    currentUser = JSON.parse(savedUser);
    enterApp();
  } else {
    // No session — show login
    showPage('login');
  }
 
  // Load saved API url
  document.getElementById('api-url').value = API_BASE;
});
 
/* ========================================================
   AUTH — REGISTER
======================================================== */
async function handleRegister() {
  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const errEl    = document.getElementById('register-error');
  const sucEl    = document.getElementById('register-success');
  const btn      = document.getElementById('register-btn');
 
  // Hide previous messages
  errEl.classList.remove('show');
  sucEl.classList.remove('show');
 
  // Basic validation
  if (!name)            { showAuthError(errEl, 'Please enter your full name'); return; }
  if (!email)           { showAuthError(errEl, 'Please enter your email'); return; }
  if (!isValidEmail(email)) { showAuthError(errEl, 'Please enter a valid email'); return; }
  if (password.length < 6)  { showAuthError(errEl, 'Password must be at least 6 characters'); return; }
 
  // Show loading
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Creating account...';
 
  try {
    if (!USE_LOCAL) {
      // ── REAL BACKEND CALL ──
      // POST /auth/register  →  { name, email, password }
      const res = await fetch(API_BASE + '/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Registration failed');
      sucEl.textContent = '✓ Account created! Please login.';
      sucEl.classList.add('show');
      setTimeout(() => showPage('login'), 1500);
    } else {
      // ── LOCAL MODE (no backend) ──
      // Store users in localStorage for demo
      const users = JSON.parse(localStorage.getItem('ss_users') || '[]');
      if (users.find(u => u.email === email)) {
        throw new Error('Email already registered');
      }
      const newUser = { id: Date.now(), name, email, password };
      users.push(newUser);
      localStorage.setItem('ss_users', JSON.stringify(users));
      sucEl.textContent = '✓ Account created! Please login.';
      sucEl.classList.add('show');
      setTimeout(() => showPage('login'), 1500);
    }
  } catch(e) {
    showAuthError(errEl, e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Create My Account';
  }
}
 
/* ========================================================
   AUTH — LOGIN
======================================================== */
async function handleLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  const btn      = document.getElementById('login-btn');
 
  errEl.classList.remove('show');
  if (!email)    { showAuthError(errEl, 'Please enter your email'); return; }
  if (!password) { showAuthError(errEl, 'Please enter your password'); return; }
 
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Logging in...';
 
  try {
    if (!USE_LOCAL) {
      // ── REAL BACKEND CALL ──
      // POST /auth/login  →  { email, password }
      // Backend returns: { token, user: { id, name, email } }
      const res = await fetch(API_BASE + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Invalid email or password');
 
      authToken   = data.token;
      currentUser = data.user;
    } else {
      // ── LOCAL MODE ──
      const users = JSON.parse(localStorage.getItem('ss_users') || '[]');
      const user  = users.find(u => u.email === email && u.password === password);
      if (!user) throw new Error('Invalid email or password');
      authToken   = 'local-token-' + user.id;
      currentUser = { id: user.id, name: user.name, email: user.email };
    }
 
    // Save session so user stays logged in after refresh
    localStorage.setItem('authToken', authToken);
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
 
    // Load this user's expenses
    loadUserExpenses();
    enterApp();
 
  } catch(e) {
    showAuthError(errEl, e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Login to SpendSense';
  }
}
 
/* ========================================================
   ENTER APP — set up dashboard after login
======================================================== */
function enterApp() {
  showPage('app');
 
  // Show user info in sidebar
  document.getElementById('user-name-display').textContent  = currentUser.name;
  document.getElementById('user-email-display').textContent = currentUser.email;
  document.getElementById('user-avatar').textContent = currentUser.name.charAt(0).toUpperCase();
 
  // Personalized greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('dashboard-greeting').textContent = greeting + ', ' + currentUser.name.split(' ')[0] + '! 👋';
 
  // Set today's date in add form
  document.getElementById('inp-date').valueAsDate = new Date();
 
  // Load budget for this user
  const savedBudget = localStorage.getItem('budget_' + currentUser.id);
  if (savedBudget) {
    budget = parseFloat(savedBudget);
    document.getElementById('budget-input').value = budget;
    document.getElementById('current-budget-display').textContent = '₹' + fmt(budget);
  }
 
  refreshAll();
  updateNavCount();
  function enterApp() {
    showPage('app');

    // ... existing code ...

    // Yeh line add karo — login ke baad
    // automatically backend se data load ho
    if (!USE_LOCAL) {
        fetchExpenses();
    }

    refreshAll();
    updateNavCount();
}
function enterApp() {
    showPage('app');

    document.getElementById('user-name-display').textContent  = currentUser.name;
    document.getElementById('user-email-display').textContent = currentUser.email;
    document.getElementById('user-avatar').textContent = 
        currentUser.name.charAt(0).toUpperCase();

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : 
                     hour < 17 ? 'Good afternoon' : 'Good evening';
    document.getElementById('dashboard-greeting').textContent = 
        greeting + ', ' + currentUser.name.split(' ')[0] + '! 👋';

    document.getElementById('inp-date').valueAsDate = new Date();

    const savedBudget = localStorage.getItem('budget_' + currentUser.id);
    if (savedBudget) {
        budget = parseFloat(savedBudget);
        document.getElementById('budget-input').value = budget;
        document.getElementById('current-budget-display').textContent = 
            '₹' + fmt(budget);
    }

    // ✅ Yeh add karo — login hote hi backend se expenses load ho
    fetchExpenses();

    updateNavCount();
}
}
 
/* ========================================================
   LOGOUT
======================================================== */
function handleLogout() {
  if (!confirm('Logout from SpendSense?')) return;
 
  // Clear session data
  authToken   = null;
  currentUser = null;
  expenses    = [];
  budget      = 0;
  localStorage.removeItem('authToken');
  localStorage.removeItem('currentUser');
 
  // Destroy charts
  [barChart, pieChart, barCompareChart, lineChart].forEach(c => { if(c) c.destroy(); });
  barChart = pieChart = barCompareChart = lineChart = null;
 
  showPage('login');
  showToast('👋 Logged out successfully');
}
 
/* ========================================================
   LOAD USER EXPENSES  (per-user from localStorage)
======================================================== */
function loadUserExpenses() {
  if (!currentUser) return;
  // Key includes user ID so each user has their own data
  const key = 'expenses_' + currentUser.id;
  expenses = JSON.parse(localStorage.getItem(key) || '[]');
}
 
function saveLocal() {
  if (!currentUser) return;
  const key = 'expenses_' + currentUser.id;
  localStorage.setItem(key, JSON.stringify(expenses));
}
 
/* ========================================================
   API HELPERS  (with JWT token in header)
======================================================== */
function getHeaders() {
  return {
    'Content-Type': 'application/json',
    // JWT token sent in every request so backend knows who is calling
    'Authorization': 'Bearer ' + authToken
  };
}
 
async function apiGet(path) {
  const res = await fetch(API_BASE + path, { headers: getHeaders() });
  if (res.status === 401) { handleLogout(); throw new Error('Session expired'); }
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}
 
async function apiPost(path, body) {
  const res = await fetch(API_BASE + path, {
    method: 'POST', headers: getHeaders(), body: JSON.stringify(body)
  });
  if (res.status === 401) { handleLogout(); throw new Error('Session expired'); }
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}
 
async function apiDelete(path) {
  const res = await fetch(API_BASE + path, { method: 'DELETE', headers: getHeaders() });
  if (res.status === 401) { handleLogout(); throw new Error('Session expired'); }
  if (!res.ok) throw new Error(res.statusText);
}
 
async function fetchExpenses() {
    try {
        expenses = await apiGet('/expenses?userId=' + currentUser.id);
        saveLocal();
        refreshAll();
    } catch(e) {
        console.warn('Backend error, using local data', e);
        // Backend nahi mila to localStorage se lo
        loadUserExpenses();
        refreshAll();
    }
}
 
/* ========================================================
   FORMATTING HELPERS
======================================================== */
function fmt(n) { return new Intl.NumberFormat('en-IN').format(Math.round(n)); }
function fmtDate(d) { return new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); }
function todayStr()   { return new Date().toISOString().slice(0,10); }
function weekStart()  { const d=new Date(); d.setDate(d.getDate()-d.getDay()); return d.toISOString().slice(0,10); }
function monthStart() { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; }
function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
 
/* ========================================================
   AUTH HELPERS
======================================================== */
function showAuthError(el, msg) { el.textContent = '⚠ ' + msg; el.classList.add('show'); }
function togglePass(id, btn) {
  const inp = document.getElementById(id);
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.textContent = inp.type === 'password' ? '👁️' : '🙈';
}
function checkStrength(val) {
  const fill = document.getElementById('strength-fill');
  const text = document.getElementById('strength-text');
  let score = 0;
  if (val.length >= 6)  score++;
  if (val.length >= 10) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;
  const levels = [
    {w:'0%',   c:'transparent', t:''},
    {w:'25%',  c:'#ef4444',     t:'Weak'},
    {w:'50%',  c:'#f59e0b',     t:'Fair'},
    {w:'75%',  c:'#3b82f6',     t:'Good'},
    {w:'100%', c:'#00d4aa',     t:'Strong'},
  ];
  const l = levels[Math.min(score, 4)];
  fill.style.width = l.w; fill.style.background = l.c;
  text.textContent = l.t; text.style.color = l.c;
}
 
/* ========================================================
   FILTER HELPERS
======================================================== */
function filterByDate(list, filter) {
  const today = todayStr(), ws = weekStart(), ms = monthStart();
  return list.filter(e => {
    if (filter === 'today') return e.date === today;
    if (filter === 'week')  return e.date >= ws;
    if (filter === 'month') return e.date >= ms;
    return true;
  });
}
 
/* ========================================================
   ADD EXPENSE
======================================================== */
let selectedCat = 'Food';
function selectCat(el) {
  document.querySelectorAll('.cat-item').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedCat = el.dataset.cat;
}
 
async function addExpense() {
  const amount = parseFloat(document.getElementById('inp-amount').value);
  const date   = document.getElementById('inp-date').value;
  const desc   = document.getElementById('inp-desc').value.trim();
  if (!amount || amount <= 0) { alert('Please enter a valid amount'); return; }
  if (!date)   { alert('Please select a date'); return; }
 
  const expense = { id: Date.now(), amount, category: selectedCat, date, description: desc || selectedCat };
 
  if (!USE_LOCAL) {
    try {
      const saved = await apiPost('/expenses?userId=' + currentUser.id, expense);
      expense.id = saved.id;
    } catch(e) { USE_LOCAL = true; }
  }
 
  expenses.unshift(expense);
  saveLocal();
  showToast('✓ ₹' + fmt(amount) + ' added!');
  clearForm();
  refreshAll();
}
 
function clearForm() {
  document.getElementById('inp-amount').value = '';
  document.getElementById('inp-desc').value   = '';
  document.getElementById('inp-date').valueAsDate = new Date();
  document.querySelectorAll('.cat-item').forEach(c => c.classList.remove('selected'));
  document.querySelector('.cat-item[data-cat="Food"]').classList.add('selected');
  selectedCat = 'Food';
}
 
/* ========================================================
   DELETE EXPENSE
======================================================== */
async function deleteExpense(id) {
    if (!confirm('Delete this expense?')) return;
    try {
        await apiDelete('/expenses/' + id + '?userId=' + currentUser.id);
    } catch(e) {
        console.warn('Delete backend error', e);
    }
    expenses = expenses.filter(e => e.id !== id);
    saveLocal();
    refreshAll();
    showToast('🗑️ Expense deleted');
}
 
/* ========================================================
   REFRESH ALL VIEWS
======================================================== */
function refreshAll() {
  updateStats(); renderRecentExpenses(); renderExpenses();
  renderCharts(); renderInsights(); renderMonthlyReport(); updateBudgetWidget(); updateNavCount();
}
 
/* ========================================================
   STATS
======================================================== */
function updateStats() {
  const sum = arr => arr.reduce((s,e) => s+e.amount, 0);
  document.getElementById('stat-total').textContent = '₹' + fmt(sum(expenses));
  document.getElementById('stat-month').textContent = '₹' + fmt(sum(filterByDate(expenses,'month')));
  document.getElementById('stat-week').textContent  = '₹' + fmt(sum(filterByDate(expenses,'week')));
  const today = filterByDate(expenses,'today');
  document.getElementById('stat-today').textContent = '₹' + fmt(sum(today));
  document.getElementById('stat-today-change').textContent = today.length + ' transaction' + (today.length!==1?'s':'');
}
 
/* ========================================================
   RECENT EXPENSES TABLE
======================================================== */
function renderRecentExpenses() {
  const tbody = document.getElementById('recent-tbody');
  const list  = expenses.slice(0,5);
  if (!list.length) { tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><div class="es-icon">🧾</div><p>No expenses yet. Add your first!</p></div></td></tr>`; return; }
  tbody.innerHTML = list.map(e => `<tr><td>${e.description}</td><td><span class="category-pill cat-${e.category.toLowerCase()}">${CATEGORIES[e.category]||'📦'} ${e.category}</span></td><td style="color:var(--muted);font-size:13px">${fmtDate(e.date)}</td><td class="amount-cell" style="color:var(--accent)">₹${fmt(e.amount)}</td></tr>`).join('');
}
 
/* ========================================================
   ALL EXPENSES TABLE
======================================================== */
function setExpFilter(f,el) {
  expDateFilter = f;
  document.querySelectorAll('#view-expenses .filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderExpenses();
}
 
function renderExpenses() {
  let list = filterByDate(expenses, expDateFilter);
  const catF = document.getElementById('cat-filter').value;
  if (catF) list = list.filter(e => e.category === catF);
  const q = document.getElementById('search-input').value.toLowerCase();
  if (q) list = list.filter(e => e.description.toLowerCase().includes(q) || e.category.toLowerCase().includes(q) || String(e.amount).includes(q));
  document.getElementById('expenses-count-label').textContent = `${list.length} transaction${list.length!==1?'s':''} found`;
  const tbody = document.getElementById('all-tbody');
  if (!list.length) { tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="es-icon">🔍</div><p>No expenses found.</p></div></td></tr>`; return; }
  tbody.innerHTML = list.map((e,i) => `<tr><td style="color:var(--muted);font-size:12px;font-family:'JetBrains Mono',monospace">#${i+1}</td><td><strong>${e.description}</strong></td><td><span class="category-pill cat-${e.category.toLowerCase()}">${CATEGORIES[e.category]||'📦'} ${e.category}</span></td><td style="color:var(--muted);font-size:13px">${fmtDate(e.date)}</td><td class="amount-cell" style="color:var(--accent)">₹${fmt(e.amount)}</td><td><button class="delete-btn" onclick="deleteExpense(${e.id})">🗑️</button></td></tr>`).join('');
}
 
/* ========================================================
   CHARTS
======================================================== */
const CHART_DEFAULTS = { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ labels:{ color:'#94a3b8', font:{ family:'DM Sans',size:12 }, boxWidth:12 } } } };
 
function renderCharts() { renderBarChart(); renderPieChart(); renderCompareChart(); renderLineChart(); }
 
function renderBarChart() {
  const ctx = document.getElementById('barChart').getContext('2d');
  if (barChart) barChart.destroy();
  const months = [];
  for (let i=5;i>=0;i--) { const d=new Date(); d.setMonth(d.getMonth()-i); months.push({label:d.toLocaleString('en-IN',{month:'short'}),key:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}); }
  barChart = new Chart(ctx,{type:'bar',data:{labels:months.map(m=>m.label),datasets:[{label:'Spending (₹)',data:months.map(m=>expenses.filter(e=>e.date.startsWith(m.key)).reduce((s,e)=>s+e.amount,0)),backgroundColor:'rgba(0,212,170,0.25)',borderColor:'#00d4aa',borderWidth:2,borderRadius:8,hoverBackgroundColor:'rgba(0,212,170,0.45)'}]},options:{...CHART_DEFAULTS,scales:{y:{ticks:{color:'#64748b',callback:v=>'₹'+fmt(v)},grid:{color:'rgba(255,255,255,0.05)'}},x:{ticks:{color:'#64748b'},grid:{color:'transparent'}}}}});
}
 
function renderPieChart() {
  const ctx = document.getElementById('pieChart').getContext('2d');
  if (pieChart) pieChart.destroy();
  const filtered = filterByDate(expenses, dateFilter);
  const catTotals = {};
  filtered.forEach(e => catTotals[e.category]=(catTotals[e.category]||0)+e.amount);
  const cats = Object.keys(catTotals);
  if (!cats.length) { pieChart=null; return; }
  pieChart = new Chart(ctx,{type:'doughnut',data:{labels:cats.map(c=>`${CATEGORIES[c]||'📦'} ${c}`),datasets:[{data:cats.map(c=>catTotals[c]),backgroundColor:cats.map(c=>CAT_COLORS[c]||'#64748b'),borderColor:'var(--card)',borderWidth:3,hoverOffset:8}]},options:{...CHART_DEFAULTS,cutout:'65%',plugins:{...CHART_DEFAULTS.plugins,tooltip:{callbacks:{label:ctx=>` ₹${fmt(ctx.raw)} (${((ctx.raw/cats.map(c=>catTotals[c]).reduce((a,b)=>a+b,0))*100).toFixed(1)}%)`}}}}});
}
 
function renderCompareChart() {
  const ctx = document.getElementById('barCompareChart').getContext('2d');
  if (barCompareChart) barCompareChart.destroy();
  const cats=Object.keys(CATEGORIES), wkE=filterByDate(expenses,'week'), mnE=filterByDate(expenses,'month');
  barCompareChart = new Chart(ctx,{type:'bar',data:{labels:cats.map(c=>`${CATEGORIES[c]} ${c}`),datasets:[{label:'This Week',data:cats.map(c=>wkE.filter(e=>e.category===c).reduce((s,e)=>s+e.amount,0)),backgroundColor:'rgba(0,212,170,0.6)',borderRadius:6},{label:'This Month',data:cats.map(c=>mnE.filter(e=>e.category===c).reduce((s,e)=>s+e.amount,0)),backgroundColor:'rgba(59,130,246,0.6)',borderRadius:6}]},options:{...CHART_DEFAULTS,scales:{y:{ticks:{color:'#64748b',callback:v=>'₹'+fmt(v)},grid:{color:'rgba(255,255,255,0.05)'}},x:{ticks:{color:'#64748b',font:{size:11}},grid:{color:'transparent'}}}}});
}
 
function renderLineChart() {
  const ctx = document.getElementById('lineChart').getContext('2d');
  if (lineChart) lineChart.destroy();
  const days=[];
  for(let i=13;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);days.push(d.toISOString().slice(0,10));}
  lineChart = new Chart(ctx,{type:'line',data:{labels:days.map(d=>new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})),datasets:[{label:'Daily Spending (₹)',data:days.map(day=>expenses.filter(e=>e.date===day).reduce((s,e)=>s+e.amount,0)),borderColor:'#00d4aa',backgroundColor:'rgba(0,212,170,0.08)',pointBackgroundColor:'#00d4aa',pointRadius:4,fill:true,tension:0.4}]},options:{...CHART_DEFAULTS,scales:{y:{ticks:{color:'#64748b',callback:v=>'₹'+fmt(v)},grid:{color:'rgba(255,255,255,0.05)'}},x:{ticks:{color:'#64748b',font:{size:11}},grid:{color:'transparent'}}}}});
}
 
/* ========================================================
   INSIGHTS
======================================================== */
function generateInsights() {
  const container = document.getElementById('insight-cards');
  const insights  = [];
  const sumOf = arr => arr.reduce((s,e)=>s+e.amount,0);
  if (!expenses.length) { container.innerHTML=`<div class="insight-item"><div class="insight-emoji">💡</div><div class="insight-text"><strong>No data yet</strong>Add some expenses to get personalized insights!</div></div>`; return; }
  const monthExp=filterByDate(expenses,'month'), weekExp=filterByDate(expenses,'week');
  const monthTotal=sumOf(monthExp);
  const catMonthTotals={};
  monthExp.forEach(e=>catMonthTotals[e.category]=(catMonthTotals[e.category]||0)+e.amount);
  const topCat=Object.entries(catMonthTotals).sort((a,b)=>b[1]-a[1])[0];
  if(topCat){const pct=Math.round((topCat[1]/monthTotal)*100);insights.push({emoji:'🏆',title:`Biggest: ${CATEGORIES[topCat[0]]} ${topCat[0]}`,text:`${topCat[0]} is ${pct}% of monthly spending (₹${fmt(topCat[1])}).`});}
  const days=[...new Set(monthExp.map(e=>e.date))].length||1;
  insights.push({emoji:'📊',title:'Daily average',text:`You spend ₹${fmt(monthTotal/days)} per day this month across ${monthExp.length} transactions.`});
  if(expenses.length){const maxE=expenses.reduce((m,e)=>e.amount>m.amount?e:m);insights.push({emoji:'💰',title:'Largest expense',text:`"${maxE.description}" (${maxE.category}) — ₹${fmt(maxE.amount)} on ${fmtDate(maxE.date)}.`});}
  if(budget>0){const rem=budget-monthTotal;insights.push(rem>0?{emoji:'✅',title:`${Math.round((monthTotal/budget)*100)}% of budget used`,text:`₹${fmt(rem)} remaining in your ₹${fmt(budget)} budget.`}:{emoji:'🚨',title:`Over budget by ₹${fmt(Math.abs(rem))}!`,text:`Spent ₹${fmt(monthTotal)} against ₹${fmt(budget)} budget.`});}
  container.innerHTML = insights.map((ins,i)=>`<div class="insight-item" style="animation-delay:${i*.08}s"><div class="insight-emoji">${ins.emoji}</div><div class="insight-text"><strong>${ins.title}</strong>${ins.text}</div></div>`).join('');
}
function renderInsights(){ generateInsights(); }
 
/* ========================================================
   MONTHLY REPORT
======================================================== */
function renderMonthlyReport() {
  const months={};
  expenses.forEach(e=>{const k=e.date.slice(0,7);if(!months[k])months[k]=[];months[k].push(e);});
  const sorted=Object.entries(months).sort((a,b)=>b[0].localeCompare(a[0]));
  const tbody=document.getElementById('monthly-tbody');
  if(!sorted.length){tbody.innerHTML=`<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--muted)">No data yet</td></tr>`;return;}
  tbody.innerHTML=sorted.map(([key,list])=>{
    const total=list.reduce((s,e)=>s+e.amount,0);
    const catMap={};list.forEach(e=>catMap[e.category]=(catMap[e.category]||0)+e.amount);
    const topCat=Object.entries(catMap).sort((a,b)=>b[1]-a[1])[0];
    const [yr,mo]=key.split('-');
    return `<tr><td>${new Date(yr,mo-1).toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</td><td style="color:var(--muted)">${list.length}</td><td><span class="category-pill cat-${topCat[0].toLowerCase()}">${CATEGORIES[topCat[0]]||'📦'} ${topCat[0]}</span></td><td class="amount-cell" style="color:var(--accent)">₹${fmt(total)}</td></tr>`;
  }).join('');
}
 
/* ========================================================
   BUDGET
======================================================== */
function updateBudgetWidget() {
  const monthTotal=filterByDate(expenses,'month').reduce((s,e)=>s+e.amount,0);
  const pct=budget>0?Math.min(Math.round((monthTotal/budget)*100),100):0;
  document.getElementById('sb-amount').textContent=`₹${fmt(monthTotal)} / ₹${fmt(budget||0)}`;
  document.getElementById('sb-fill').style.width=pct+'%';
  document.getElementById('sb-pct').textContent=budget>0?`${pct}% used`:'Budget not set';
  document.getElementById('sb-fill').classList.toggle('danger',pct>=100);
  document.getElementById('budget-banner').classList.toggle('show',budget>0&&monthTotal>budget);
}
 
async function saveBudget() {
  budget = parseFloat(document.getElementById('budget-input').value)||0;
  // Save per user so different users have different budgets
  localStorage.setItem('budget_' + currentUser.id, budget);
  document.getElementById('current-budget-display').textContent = '₹' + fmt(budget);
  updateBudgetWidget();
  showToast('💰 Budget saved: ₹' + fmt(budget));
}
 
/* ========================================================
   SETTINGS
======================================================== */
function saveApiConfig() {
  API_BASE = document.getElementById('api-url').value.trim().replace(/\/$/,'');
  localStorage.setItem('api_base', API_BASE);
  showToast('🔗 API URL saved!');
}
 
async function testApi() {
    const status = document.getElementById('api-status');
    status.textContent = '⏳ Testing connection…';
    try {
        const res = await fetch(API_BASE + '/auth/health', {
            signal: AbortSignal.timeout(3000)
        });
        const data = await res.json();

        if (data.status === 'ok') {
            status.textContent = '✅ Connected to backend successfully!';
            status.style.color = 'var(--accent)';
            USE_LOCAL = false;
            // Ab backend se expenses fetch karo
            await fetchExpenses();
        }
    } catch(e) {
        status.textContent = '❌ Could not connect. Using local storage.';
        status.style.color = 'var(--danger)';
        USE_LOCAL = true;
    }
}
 
function clearAllData() {
  if(!confirm('Delete ALL your expenses? This cannot be undone.')) return;
  expenses=[];
  saveLocal();
  refreshAll();
  showToast('🗑️ All data cleared');
}
 
function loadDemoData() {
  const demoData=[], cats=Object.keys(CATEGORIES);
  const desc={Food:['Zomato','McDonald\'s','Chai & Samosa','Grocery'],Travel:['Uber','Metro','Auto'],Shopping:['Amazon','Myntra','Books'],Health:['Gym','Medicine','Doctor'],Bills:['Electricity','Internet','Phone'],Entertainment:['Netflix','Movie','Spotify'],Education:['Udemy','Books','Course'],Other:['Miscellaneous','Gift','Repair']};
  for(let i=0;i<30;i++){const d=new Date();d.setDate(d.getDate()-Math.floor(Math.random()*90));const cat=cats[Math.floor(Math.random()*cats.length)];demoData.push({id:Date.now()+i,amount:Math.round(Math.random()*2000+50),category:cat,date:d.toISOString().slice(0,10),description:desc[cat][Math.floor(Math.random()*desc[cat].length)]});}
  expenses=demoData; saveLocal(); refreshAll();
  showToast('🎭 Demo data loaded!');
}
 
/* ========================================================
   EXPORT
======================================================== */
function exportCSV() {
  const rows=expenses.map(e=>[e.id,e.amount,e.category,e.date,`"${e.description}"`]);
  const csv=[['ID','Amount','Category','Date','Description'],...rows].map(r=>r.join(',')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='expenses.csv';a.click();
  showToast('📊 CSV exported!');
}
 
function exportPDF() {
  const {jsPDF}=window.jspdf; const doc=new jsPDF();
  doc.setFillColor(0,30,60); doc.rect(0,0,210,40,'F');
  doc.setTextColor(0,212,170); doc.setFontSize(22); doc.setFont('helvetica','bold');
  doc.text('SpendSense – Expense Report',14,18);
  doc.setFontSize(10); doc.setTextColor(180,210,220);
  doc.text(`User: ${currentUser.name} | Generated: ${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})}`,14,30);
  doc.setTextColor(30,40,60); doc.setFontSize(10); doc.setFont('helvetica','normal');
  doc.text(`Total: Rs. ${fmt(expenses.reduce((s,e)=>s+e.amount,0))}`,14,52);
  doc.text(`This Month: Rs. ${fmt(filterByDate(expenses,'month').reduce((s,e)=>s+e.amount,0))}`,14,60);
  doc.autoTable({startY:70,head:[['Description','Category','Date','Amount']],body:expenses.slice(0,50).map(e=>[e.description,e.category,fmtDate(e.date),'Rs.'+fmt(e.amount)]),headStyles:{fillColor:[0,30,60],textColor:[0,212,170]},styles:{fontSize:9,cellPadding:4},columnStyles:{3:{halign:'right',fontStyle:'bold'}}});
  doc.save(`SpendSense_${currentUser.name.replace(' ','_')}_Report.pdf`);
  showToast('📥 PDF exported!');
}
 
/* ========================================================
   UI HELPERS
======================================================== */
function showView(name,btn) {
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-'+name).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  if(btn) btn.classList.add('active');
  if(window.innerWidth<=768) document.getElementById('sidebar').classList.remove('open');
  if(name==='insights') setTimeout(renderCharts,100);
}
 
function setDateFilter(f,el) {
  dateFilter=f;
  document.querySelectorAll('#view-dashboard .filter-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  renderPieChart(); updateStats();
}
 
function toggleTheme() {
  const html=document.documentElement, isDark=html.getAttribute('data-theme')==='dark';
  html.setAttribute('data-theme',isDark?'light':'dark');
  document.getElementById('theme-icon').textContent  = isDark?'🌙':'☀️';
  document.getElementById('theme-label').textContent = isDark?'Dark Mode':'Light Mode';
  setTimeout(renderCharts,200);
}
 
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }
function updateNavCount() { document.getElementById('nav-count').textContent=expenses.length; }
 
let toastTimer;
function showToast(msg) {
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove('show'),3000);
}
 
// Allow Enter key on login/register forms
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (document.getElementById('page-login').style.display !== 'none') handleLogin();
  else if (document.getElementById('page-register').style.display !== 'none') handleRegister();
});

