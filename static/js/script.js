document.addEventListener('DOMContentLoaded', () => {
    function initThemeToggle() {
        const btn = document.getElementById('theme-toggle');
        const icon = document.getElementById('theme-toggle-icon');
        const root = document.documentElement;

        function applyTheme(theme) {
            root.setAttribute('data-theme', theme);
            try {
                localStorage.setItem('studyflow-theme', theme);
            } catch (e) { /* ignore private-mode storage errors */ }
            if (icon) {
                icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
            }
            if (btn) {
                btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
            }
        }

        applyTheme(root.getAttribute('data-theme') || 'light');
        if (btn) {
            btn.addEventListener('click', () => {
                const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
                applyTheme(next);
            });
        }
    }

    function initMobileNav() {
        const toggle = document.getElementById('menu-toggle');
        const sidebar = document.getElementById('app-sidebar');
        const overlay = document.getElementById('sidebar-overlay');

        function closeNav() {
            if (sidebar) sidebar.classList.remove('open');
            if (overlay) overlay.classList.remove('visible');
        }

        if (toggle && sidebar) {
            toggle.addEventListener('click', () => {
                const isOpen = sidebar.classList.toggle('open');
                if (overlay) overlay.classList.toggle('visible', isOpen);
            });
        }
        if (overlay) overlay.addEventListener('click', closeNav);
        document.querySelectorAll('.nav-item').forEach((link) => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 980) closeNav();
            });
        });
    }

    initThemeToggle();
    initMobileNav();

    const params = new URLSearchParams(window.location.search);
    if (params.get('add') === '1') {
        const openTask = document.getElementById('open-task-modal');
        const openNote = document.getElementById('open-note-modal');
        if (openTask) openTask.click();
        if (openNote) openNote.click();
    }

    // Navigation handling for dashboard sections if on dashboard
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.content-section');
    const pageTitle = document.getElementById('page-title');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const targetId = item.getAttribute('data-target');
            if (targetId && document.getElementById(targetId)) {
                e.preventDefault();
                navItems.forEach(nav => nav.classList.remove('active'));
                sections.forEach(sec => sec.classList.remove('active'));

                item.classList.add('active');
                document.getElementById(targetId).classList.add('active');
                if (pageTitle) pageTitle.textContent = item.textContent.trim();
            }
        });
    });

    // Page-specific initializers
    if (document.getElementById('task-table-body')) {
        loadTasksPage();
    }
    if (document.getElementById('planner-daily-tbody')) {
        loadPlannerPage();
    }
    if (document.getElementById('notes-grid-container')) {
        loadNotesPage();
    }
    if (document.getElementById('quiz-select-view')) {
        loadQuizPage();
    }
    if (document.getElementById('progress-completion-rate')) {
        loadProgressTracker();
    }
    if (document.getElementById('dashboard-tasks-preview')) {
        loadDashboardData();
    }

    // Initialize Timer controls if present on page
    if (document.getElementById('timer-display')) {
        initPomodoroTimer();
    }

    // ==========================================
    // PROGRESS TRACKER MODULE
    // ==========================================
    async function loadProgressTracker() {
        const resp = await fetch('/api/progress-stats');
        const stats = await resp.json();

        document.getElementById('progress-completion-rate').textContent = `${stats.completion_rate}%`;
        document.getElementById('progress-total-focus').textContent = `${stats.total_focus_min} min`;
        document.getElementById('progress-total-sessions').textContent = stats.total_study_sessions;
        document.getElementById('progress-overdue-tasks').textContent = stats.overdue_tasks;

        document.getElementById('progress-completed-tasks').textContent = stats.completed_tasks;
        document.getElementById('progress-pending-tasks').textContent = stats.pending_tasks;
        document.getElementById('progress-overdue-count').textContent = stats.overdue_tasks;

        const total = stats.total_tasks || 1;
        document.getElementById('progress-bar-completed').style.width = `${(stats.completed_tasks / total) * 100}%`;
        document.getElementById('progress-bar-pending').style.width = `${(stats.pending_tasks / total) * 100}%`;
        document.getElementById('progress-bar-overdue').style.width = `${(stats.overdue_tasks / total) * 100}%`;

        document.getElementById('progress-avg-quiz-score').textContent = `${stats.avg_quiz_score}%`;
        document.getElementById('progress-total-quizzes').textContent = stats.total_quizzes;
        document.getElementById('progress-best-quiz-category').textContent = stats.best_category;

        // Render Chart.js with instance destruction safety
        if (typeof Chart !== 'undefined') {
            const activityCtx = document.getElementById('activityChart');
            if (activityCtx) {
                if (window.myActivityChart) window.myActivityChart.destroy();
                window.myActivityChart = new Chart(activityCtx, {
                    type: 'bar',
                    data: {
                        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                        datasets: [{
                            label: 'Focus Minutes',
                            data: [stats.total_focus_min > 0 ? Math.round(stats.total_focus_min / 3) : 0, 25, 50, 0, 25, 0, 0],
                            backgroundColor: '#4f46e5',
                            borderRadius: 6
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } }
                    }
                });
            }

            const subjectCtx = document.getElementById('subjectChart');
            if (subjectCtx) {
                if (window.mySubjectChart) window.mySubjectChart.destroy();
                const labels = stats.subject_counts.map(s => s.subject);
                const dataCounts = stats.subject_counts.map(s => s.count);

                window.mySubjectChart = new Chart(subjectCtx, {
                    type: 'doughnut',
                    data: {
                        labels: labels.length > 0 ? labels : ['General'],
                        datasets: [{
                            data: dataCounts.length > 0 ? dataCounts : [1],
                            backgroundColor: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false
                    }
                });
            }
        }
    }

    // ==========================================
    // POMODORO FOCUS TIMER MODULE
    // ==========================================
    function initPomodoroTimer() {
        let timerInterval = null;
        let focusDuration = 25 * 60;
        let breakDuration = 5 * 60;
        let timeLeft = focusDuration;
        let currentMode = 'focus';
        const timerDisplay = document.getElementById('timer-display');
        const startBtn = document.getElementById('timer-start');
        const pauseBtn = document.getElementById('timer-pause');
        const resumeBtn = document.getElementById('timer-resume');
        const resetBtn = document.getElementById('timer-reset');
        const focusModeBtn = document.getElementById('focus-mode-btn');
        const breakModeBtn = document.getElementById('break-mode-btn');
        const subjectInput = document.getElementById('timer-subject-input');
        const historyTbody = document.getElementById('timer-history-tbody');
        const totalFocusEl = document.getElementById('total-focus-minutes-display');

        function currentSubject() {
            return subjectInput && subjectInput.value.trim() ? subjectInput.value.trim() : 'General';
        }

        function setControlVisibility(running) {
            if (startBtn) startBtn.style.display = running ? 'none' : 'inline-flex';
            if (pauseBtn) pauseBtn.style.display = running ? 'inline-flex' : 'none';
            if (resumeBtn) resumeBtn.style.display = 'none';
        }

        function updateTimerDisplay() {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            if (timerDisplay) {
                timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        }

        function startCountdown() {
            if (timerInterval) return;
            timerInterval = setInterval(async () => {
                if (timeLeft > 0) {
                    timeLeft--;
                    updateTimerDisplay();
                    return;
                }

                clearInterval(timerInterval);
                timerInterval = null;
                setControlVisibility(false);

                const durationMin = currentMode === 'break' ? 5 : 25;
                await fetch('/api/focus-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ subject: currentSubject(), duration: durationMin })
                });

                alert(currentMode === 'break' ? 'Break complete!' : `Focus session completed! ${durationMin} minutes logged.`);
                timeLeft = currentMode === 'break' ? breakDuration : focusDuration;
                updateTimerDisplay();
                loadTimerHistory();
            }, 1000);
            setControlVisibility(true);
        }

        if (startBtn) startBtn.addEventListener('click', startCountdown);
        if (resumeBtn) resumeBtn.addEventListener('click', startCountdown);

        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => {
                clearInterval(timerInterval);
                timerInterval = null;
                if (pauseBtn) pauseBtn.style.display = 'none';
                if (resumeBtn) resumeBtn.style.display = 'inline-flex';
                if (startBtn) startBtn.style.display = 'none';
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                clearInterval(timerInterval);
                timerInterval = null;
                timeLeft = currentMode === 'break' ? breakDuration : focusDuration;
                updateTimerDisplay();
                setControlVisibility(false);
            });
        }

        if (focusModeBtn) {
            focusModeBtn.addEventListener('click', () => {
                currentMode = 'focus';
                timeLeft = focusDuration;
                updateTimerDisplay();
                focusModeBtn.className = 'btn btn-sm btn-primary';
                if (breakModeBtn) breakModeBtn.className = 'btn btn-sm btn-outline';
            });
        }

        if (breakModeBtn) {
            breakModeBtn.addEventListener('click', () => {
                currentMode = 'break';
                timeLeft = breakDuration;
                updateTimerDisplay();
                breakModeBtn.className = 'btn btn-sm btn-primary';
                if (focusModeBtn) focusModeBtn.className = 'btn btn-sm btn-outline';
            });
        }

        async function loadTimerHistory() {
            if (!historyTbody && !totalFocusEl) return;
            const resp = await fetch('/api/focus-session');
            const sessions = await resp.json();
            const total = sessions.reduce((sum, item) => sum + (item.duration || 0), 0);
            if (totalFocusEl) totalFocusEl.textContent = total;
            if (!historyTbody) return;
            historyTbody.innerHTML = '';
            if (sessions.length === 0) {
                historyTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No focus sessions yet.</td></tr>`;
                return;
            }
            sessions.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${escapeHtml(item.subject)}</td>
                    <td>${item.duration} min</td>
                    <td>${item.duration <= 5 ? 'Break' : 'Focus'}</td>
                    <td>${escapeHtml(item.completed_at)}</td>
                `;
                historyTbody.appendChild(tr);
            });
        }

        updateTimerDisplay();
        loadTimerHistory();
    }

    // ==========================================
    // PRACTICE QUIZ MODULE
    // ==========================================
    function loadQuizPage() {
        const quizBank = {
            "Mathematics": [
                {
                    question: "What is the derivative of x^2 with respect to x?",
                    options: ["x", "2x", "x^2", "2"],
                    answer: 1,
                    explanation: "Using the power rule d/dx(x^n) = n*x^(n-1), the derivative of x^2 is 2x."
                },
                {
                    question: "What is the solution to the equation 3x - 5 = 10?",
                    options: ["x = 3", "x = 4", "x = 5", "x = 6"],
                    answer: 2,
                    explanation: "Add 5 to both sides: 3x = 15. Divide by 3: x = 5."
                },
                {
                    question: "What is the value of pi rounded to two decimal places?",
                    options: ["3.12", "3.14", "3.16", "3.18"],
                    answer: 1,
                    explanation: "Pi is approximately 3.14159..., which rounds to 3.14."
                }
            ],
            "Science": [
                {
                    question: "What chemical element has the symbol 'O'?",
                    options: ["Gold", "Oxygen", "Osmium", "Hydrogen"],
                    answer: 1,
                    explanation: "Oxygen is represented by the chemical symbol O on the periodic table."
                },
                {
                    question: "Which planet is known as the Red Planet?",
                    options: ["Venus", "Jupiter", "Mars", "Saturn"],
                    answer: 2,
                    explanation: "Mars appears red due to iron oxide (rust) on its surface."
                },
                {
                    question: "What is the primary power source for plant photosynthesis?",
                    options: ["Geothermal Heat", "Sunlight", "Wind", "Soil Minerals"],
                    answer: 1,
                    explanation: "Photosynthesis converts solar light energy into biological chemical energy."
                }
            ],
            "Computer Programming": [
                {
                    question: "Which data structure operates on a First-In, First-Out (FIFO) principle?",
                    options: ["Stack", "Queue", "Tree", "Graph"],
                    answer: 1,
                    explanation: "Queues maintain FIFO ordering, whereas stacks operate on Last-In, First-Out (LIFO)."
                },
                {
                    question: "What keyword is used to define a function in Python?",
                    options: ["func", "function", "def", "lambda"],
                    answer: 2,
                    explanation: "In Python, functions are declared using the 'def' keyword."
                },
                {
                    question: "What does SQL stand for?",
                    options: ["Structured Query Language", "Simple Quality Language", "Sequential Query List", "Server Query Language"],
                    answer: 0,
                    explanation: "SQL stands for Structured Query Language, standard for relational database management."
                }
            ],
            "General Knowledge": [
                {
                    question: "Which ocean is the largest on Earth?",
                    options: ["Atlantic Ocean", "Indian Ocean", "Arctic Ocean", "Pacific Ocean"],
                    answer: 3,
                    explanation: "The Pacific Ocean covers over 60 million square miles, making it the largest ocean."
                },
                {
                    question: "How many continents are there on Earth?",
                    options: ["5", "6", "7", "8"],
                    answer: 2,
                    explanation: "The 7 continents are Asia, Africa, North America, South America, Antarctica, Europe, and Australia."
                }
            ]
        };

        const selectView = document.getElementById('quiz-select-view');
        const activeView = document.getElementById('quiz-active-view');
        const resultsView = document.getElementById('quiz-results-view');

        const categorySelect = document.getElementById('quiz-category-select');
        const startBtn = document.getElementById('start-quiz-btn');

        const catDisplay = document.getElementById('quiz-cat-display');
        const progressDisplay = document.getElementById('quiz-progress-display');
        const questionText = document.getElementById('quiz-question-text');
        const optionsContainer = document.getElementById('quiz-options-container');
        const explanationBox = document.getElementById('quiz-explanation-box');
        const nextBtn = document.getElementById('next-question-btn');

        const finalScoreText = document.getElementById('quiz-final-score');
        const retakeBtn = document.getElementById('retake-quiz-btn');
        const historyTbody = document.getElementById('quiz-history-tbody');

        let currentCategory = '';
        let currentQuestions = [];
        let questionIndex = 0;
        let score = 0;

        if (startBtn) {
            startBtn.addEventListener('click', () => {
                currentCategory = categorySelect.value;
                currentQuestions = quizBank[currentCategory] || [];
                if (currentQuestions.length === 0) return;

                questionIndex = 0;
                score = 0;

                selectView.style.display = 'none';
                resultsView.style.display = 'none';
                activeView.style.display = 'block';

                showQuestion();
            });
        }

        function showQuestion() {
            explanationBox.style.display = 'none';
            nextBtn.style.display = 'none';

            const q = currentQuestions[questionIndex];
            catDisplay.textContent = currentCategory;
            progressDisplay.textContent = `Question ${questionIndex + 1} of ${currentQuestions.length}`;
            questionText.textContent = q.question;

            optionsContainer.innerHTML = '';
            q.options.forEach((opt, idx) => {
                const btn = document.createElement('button');
                btn.className = 'quiz-option-btn';
                btn.textContent = opt;
                btn.addEventListener('click', () => handleAnswer(idx, q.answer, q.explanation));
                optionsContainer.appendChild(btn);
            });
        }

        function handleAnswer(selectedIndex, correctIndex, explanation) {
            const btns = optionsContainer.querySelectorAll('.quiz-option-btn');
            btns.forEach((btn, idx) => {
                btn.disabled = true;
                if (idx === correctIndex) {
                    btn.style.backgroundColor = '#10b981';
                    btn.style.color = '#ffffff';
                } else if (idx === selectedIndex) {
                    btn.style.backgroundColor = '#ef4444';
                    btn.style.color = '#ffffff';
                }
            });

            if (selectedIndex === correctIndex) {
                score++;
            }

            explanationBox.innerHTML = `<strong>Explanation:</strong> ${escapeHtml(explanation)}`;
            explanationBox.style.display = 'block';

            if (questionIndex + 1 < currentQuestions.length) {
                nextBtn.textContent = 'Next Question';
            } else {
                nextBtn.textContent = 'View Results';
            }
            nextBtn.style.display = 'inline-flex';
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', async () => {
                questionIndex++;
                if (questionIndex < currentQuestions.length) {
                    showQuestion();
                } else {
                    activeView.style.display = 'none';
                    resultsView.style.display = 'block';
                    finalScoreText.textContent = `Your Score: ${score} / ${currentQuestions.length}`;

                    await fetch('/api/quiz-history', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            category: currentCategory,
                            score: score,
                            total_questions: currentQuestions.length
                        })
                    });

                    loadQuizHistory();
                }
            });
        }

        if (retakeBtn) {
            retakeBtn.addEventListener('click', () => {
                resultsView.style.display = 'none';
                selectView.style.display = 'block';
            });
        }

        async function loadQuizHistory() {
            if (!historyTbody) return;
            const resp = await fetch('/api/quiz-history');
            const history = await resp.json();

            historyTbody.innerHTML = '';
            if (history.length === 0) {
                historyTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No quiz history yet.</td></tr>`;
                return;
            }

            history.forEach(item => {
                const pct = Math.round((item.score / item.total_questions) * 100);
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${escapeHtml(item.category)}</strong></td>
                    <td>${item.score} / ${item.total_questions}</td>
                    <td><span class="badge ${pct >= 70 ? 'badge-completed' : 'badge-high'}">${pct}%</span></td>
                    <td>${escapeHtml(item.date_taken)}</td>
                `;
                historyTbody.appendChild(tr);
            });
        }

        loadQuizHistory();
    }

    // ==========================================
    // NOTES & REVIEWERS MODULE
    // ==========================================
    function loadNotesPage() {
        const noteModal = document.getElementById('note-modal');
        const openNoteModalBtn = document.getElementById('open-note-modal');
        const closeNoteModalBtn = document.getElementById('close-note-modal');
        const cancelNoteBtn = document.getElementById('cancel-note');
        const noteForm = document.getElementById('note-form');

        const searchInput = document.getElementById('note-search');
        const subjectFilter = document.getElementById('filter-note-subject');
        const grid = document.getElementById('notes-grid-container');

        let notesData = [];

        if (openNoteModalBtn && noteModal) {
            openNoteModalBtn.addEventListener('click', () => {
                document.getElementById('note-modal-title').textContent = 'Create Note';
                document.getElementById('note-id').value = '';
                if (noteForm) noteForm.reset();
                noteModal.classList.add('active');
            });
        }

        if (closeNoteModalBtn && noteModal) closeNoteModalBtn.addEventListener('click', () => noteModal.classList.remove('active'));
        if (cancelNoteBtn && noteModal) cancelNoteBtn.addEventListener('click', () => noteModal.classList.remove('active'));

        if (noteForm) {
            noteForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const id = document.getElementById('note-id').value;
                const title = document.getElementById('note-title-input').value.trim();
                const subject = document.getElementById('note-subject-input').value.trim();
                const content = document.getElementById('note-content-input').value.trim();

                const payload = { title, subject, content };

                if (id) {
                    await fetch(`/api/notes/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                } else {
                    await fetch('/api/notes', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                }

                noteModal.classList.remove('active');
                noteForm.reset();
                fetchAndRenderNotes();
            });
        }

        async function fetchAndRenderNotes() {
            const response = await fetch('/api/notes');
            notesData = await response.json();

            if (subjectFilter) {
                const subjects = [...new Set(notesData.map(n => n.subject || 'General'))];
                const currentSelected = subjectFilter.value;
                subjectFilter.innerHTML = '<option value="all">All Subjects</option>';
                subjects.forEach(sub => {
                    const opt = document.createElement('option');
                    opt.value = sub;
                    opt.textContent = sub;
                    if (sub === currentSelected) opt.selected = true;
                    subjectFilter.appendChild(opt);
                });
            }

            renderNotesGrid();
        }

        function renderNotesGrid() {
            if (!grid) return;
            const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
            const selectedSubject = subjectFilter ? subjectFilter.value : 'all';

            const filtered = notesData.filter(note => {
                const matchesSearch = note.title.toLowerCase().includes(searchTerm) || note.content.toLowerCase().includes(searchTerm);
                const matchesSubject = selectedSubject === 'all' || (note.subject || 'General') === selectedSubject;
                return matchesSearch && matchesSubject;
            });

            grid.innerHTML = '';
            if (filtered.length === 0) {
                grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px 0;">No notes found.</p>`;
                return;
            }

            filtered.forEach(note => {
                const div = document.createElement('div');
                div.className = 'note-card';
                div.innerHTML = `
                    <div>
                        <div class="note-card-header">
                            <h3>${escapeHtml(note.title)}</h3>
                            <span class="badge badge-subject">${escapeHtml(note.subject || 'General')}</span>
                        </div>
                        <p>${escapeHtml(note.content)}</p>
                    </div>
                    <div class="note-card-actions">
                        <button class="btn btn-sm btn-warning edit-note" data-id="${note.id}"><i class="fa-solid fa-pen"></i> Edit</button>
                        <button class="btn btn-sm btn-danger delete-note" data-id="${note.id}"><i class="fa-solid fa-trash"></i> Delete</button>
                    </div>
                `;
                grid.appendChild(div);
            });

            grid.querySelectorAll('.delete-note').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (confirm('Delete this note?')) {
                        await fetch(`/api/notes/${btn.dataset.id}`, { method: 'DELETE' });
                        fetchAndRenderNotes();
                    }
                });
            });

            grid.querySelectorAll('.edit-note').forEach(btn => {
                btn.addEventListener('click', () => {
                    const note = notesData.find(n => n.id == btn.dataset.id);
                    if (note) {
                        document.getElementById('note-modal-title').textContent = 'Edit Note';
                        document.getElementById('note-id').value = note.id;
                        document.getElementById('note-title-input').value = note.title;
                        document.getElementById('note-subject-input').value = note.subject || 'General';
                        document.getElementById('note-content-input').value = note.content;
                        noteModal.classList.add('active');
                    }
                });
            });
        }

        if (searchInput) searchInput.addEventListener('input', renderNotesGrid);
        if (subjectFilter) subjectFilter.addEventListener('change', renderNotesGrid);

        fetchAndRenderNotes();
    }

    // ==========================================
    // STUDY PLANNER MODULE
    // ==========================================
    function loadPlannerPage() {
        const modal = document.getElementById('planner-modal');
        const openBtn = document.getElementById('open-planner-modal');
        const closeBtn = document.getElementById('close-planner-modal');
        const cancelBtn = document.getElementById('cancel-planner');
        const form = document.getElementById('planner-form');
        const errorEl = document.getElementById('planner-form-error');

        const viewDailyBtn = document.getElementById('view-daily-btn');
        const viewWeeklyBtn = document.getElementById('view-weekly-btn');
        const dailyContainer = document.getElementById('daily-view-container');
        const weeklyContainer = document.getElementById('weekly-view-container');
        const dateFilter = document.getElementById('planner-date-filter');

        let currentView = 'daily';
        let scheduleData = [];

        if (openBtn && modal) {
            openBtn.addEventListener('click', () => {
                document.getElementById('planner-modal-title').textContent = 'Add Study Session';
                document.getElementById('planner-id').value = '';
                form.reset();
                if (errorEl) errorEl.style.display = 'none';
                modal.classList.add('active');
            });
        }

        if (closeBtn && modal) closeBtn.addEventListener('click', () => modal.classList.remove('active'));
        if (cancelBtn && modal) cancelBtn.addEventListener('click', () => modal.classList.remove('active'));

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const id = document.getElementById('planner-id').value;
                const subject = document.getElementById('planner-subject-input').value.trim();
                const topic = document.getElementById('planner-topic-input').value.trim();
                const study_date = document.getElementById('planner-date-input').value;
                const start_time = document.getElementById('planner-start-time').value;
                const end_time = document.getElementById('planner-end-time').value;

                if (!subject || !topic || !study_date || !start_time || !end_time) {
                    showPlannerError('Please fill in all required fields.');
                    return;
                }

                if (start_time >= end_time) {
                    showPlannerError('Start time must be strictly earlier than end time.');
                    return;
                }

                if (errorEl) errorEl.style.display = 'none';

                const payload = { subject, topic, study_date, start_time, end_time };
                let response;

                if (id) {
                    response = await fetch(`/api/schedule/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                } else {
                    response = await fetch('/api/schedule', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                }

                if (response.ok) {
                    modal.classList.remove('active');
                    form.reset();
                    fetchAndRenderSchedule();
                } else {
                    const result = await response.json();
                    showPlannerError(result.error || 'Failed to save session.');
                }
            });
        }

        function showPlannerError(msg) {
            if (errorEl) {
                errorEl.textContent = msg;
                errorEl.style.display = 'block';
            }
        }

        if (viewDailyBtn && viewWeeklyBtn) {
            viewDailyBtn.addEventListener('click', () => {
                currentView = 'daily';
                viewDailyBtn.className = 'btn btn-sm btn-primary';
                viewWeeklyBtn.className = 'btn btn-sm btn-outline';
                dailyContainer.style.display = 'block';
                weeklyContainer.style.display = 'none';
                renderSchedule();
            });

            viewWeeklyBtn.addEventListener('click', () => {
                currentView = 'weekly';
                viewWeeklyBtn.className = 'btn btn-sm btn-primary';
                viewDailyBtn.className = 'btn btn-sm btn-outline';
                dailyContainer.style.display = 'none';
                weeklyContainer.style.display = 'grid';
                renderSchedule();
            });
        }

        if (dateFilter) {
            dateFilter.addEventListener('change', () => renderSchedule());
        }

        async function fetchAndRenderSchedule() {
            const response = await fetch('/api/schedule');
            scheduleData = await response.json();
            renderSchedule();
        }

        function renderSchedule() {
            const filterDate = dateFilter ? dateFilter.value : '';

            if (currentView === 'daily') {
                const tbody = document.getElementById('planner-daily-tbody');
                if (!tbody) return;

                const filtered = scheduleData.filter(item => !filterDate || item.study_date === filterDate);
                tbody.innerHTML = '';

                if (filtered.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No study sessions found.</td></tr>`;
                    return;
                }

                filtered.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${escapeHtml(item.study_date)}</td>
                        <td>${escapeHtml(item.start_time)} - ${escapeHtml(item.end_time)}</td>
                        <td><strong>${escapeHtml(item.subject)}</strong></td>
                        <td>${escapeHtml(item.topic)}</td>
                        <td>
                            <button class="btn btn-sm btn-warning edit-planner" data-id="${item.id}"><i class="fa-solid fa-pen"></i></button>
                            <button class="btn btn-sm btn-danger delete-planner" data-id="${item.id}"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });

                tbody.querySelectorAll('.delete-planner').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        if (confirm('Delete this study session?')) {
                            await fetch(`/api/schedule/${btn.dataset.id}`, { method: 'DELETE' });
                            fetchAndRenderSchedule();
                        }
                    });
                });

                tbody.querySelectorAll('.edit-planner').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const item = scheduleData.find(s => s.id == btn.dataset.id);
                        if (item) {
                            document.getElementById('planner-modal-title').textContent = 'Edit Study Session';
                            document.getElementById('planner-id').value = item.id;
                            document.getElementById('planner-subject-input').value = item.subject;
                            document.getElementById('planner-topic-input').value = item.topic;
                            document.getElementById('planner-date-input').value = item.study_date;
                            document.getElementById('planner-start-time').value = item.start_time;
                            document.getElementById('planner-end-time').value = item.end_time;
                            if (errorEl) errorEl.style.display = 'none';
                            modal.classList.add('active');
                        }
                    });
                });
            } else if (currentView === 'weekly') {
                if (!weeklyContainer) return;

                const grouped = {};
                scheduleData.forEach(item => {
                    if (!grouped[item.study_date]) grouped[item.study_date] = [];
                    grouped[item.study_date].push(item);
                });

                weeklyContainer.innerHTML = '';
                const sortedDates = Object.keys(grouped).sort();

                if (sortedDates.length === 0) {
                    weeklyContainer.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">No study sessions available for weekly view.</p>`;
                    return;
                }

                sortedDates.forEach(date => {
                    if (filterDate && date !== filterDate) return;

                    const card = document.createElement('div');
                    card.className = 'weekly-day-card';
                    card.innerHTML = `<h4><i class="fa-solid fa-calendar-day"></i> ${escapeHtml(date)}</h4>`;

                    grouped[date].forEach(item => {
                        const sessDiv = document.createElement('div');
                        sessDiv.className = 'weekly-session-item';
                        sessDiv.innerHTML = `
                            <div class="time"><i class="fa-regular fa-clock"></i> ${escapeHtml(item.start_time)} - ${escapeHtml(item.end_time)}</div>
                            <div class="subject">${escapeHtml(item.subject)}</div>
                            <div class="topic" style="color: var(--text-muted);">${escapeHtml(item.topic)}</div>
                        `;
                        card.appendChild(sessDiv);
                    });

                    weeklyContainer.appendChild(card);
                });
            }
        }

        fetchAndRenderSchedule();
    }

    // ==========================================
    // DASHBOARD INTEGRATION
    // ==========================================
    async function loadDashboardData() {
        const greetingEl = document.getElementById('dashboard-greeting');
        const motivationEl = document.getElementById('dashboard-motivation');
        const dateEl = document.getElementById('dashboard-date');
        const now = new Date();
        const hour = now.getHours();
        const today = now.toISOString().slice(0, 10);

        if (greetingEl) {
            let hello = 'Welcome back';
            if (hour < 12) hello = 'Good morning';
            else if (hour < 17) hello = 'Good afternoon';
            else hello = 'Good evening';
            greetingEl.textContent = hello;
        }

        if (dateEl) {
            dateEl.textContent = now.toLocaleDateString(undefined, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }

        const setText = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };

        try {
            const [taskResp, schedResp, statsResp] = await Promise.all([
                fetch('/api/tasks'),
                fetch('/api/schedule'),
                fetch('/api/progress-stats')
            ]);
            const tasks = await taskResp.json();
            const schedule = await schedResp.json();
            const stats = await statsResp.json();

            setText('stat-total-tasks', stats.total_tasks ?? tasks.length);
            setText('stat-completed-tasks', stats.completed_tasks ?? 0);
            setText('stat-pending-tasks', stats.pending_tasks ?? 0);

            const upcoming = tasks
                .filter((t) => t.status !== 'completed' && t.due_date && t.due_date >= today)
                .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
            setText('stat-upcoming-deadlines', upcoming.length);

            const rate = Number(stats.completion_rate) || 0;
            setText('stat-study-progress', `${rate}%`);
            const fill = document.getElementById('dashboard-progress-fill');
            const label = document.getElementById('progress-label');
            if (fill) fill.style.width = `${Math.max(0, Math.min(100, rate))}%`;
            if (label) label.textContent = `${rate}% complete`;

            if (motivationEl) {
                if (!stats.total_tasks) {
                    motivationEl.textContent = 'Add a task, plan a session, or start the focus timer to begin a gentle study day.';
                } else if (stats.pending_tasks > 0) {
                    motivationEl.textContent = `You have ${stats.pending_tasks} pending task${stats.pending_tasks === 1 ? '' : 's'}. Small, consistent sessions still count.`;
                } else {
                    motivationEl.textContent = 'Everything on your list is complete. Nice work — keep the momentum with a short review.';
                }
            }

            const previewTasks = document.getElementById('dashboard-tasks-preview');
            if (previewTasks) {
                previewTasks.innerHTML = '';
                const upcomingPreview = (upcoming.length ? upcoming : tasks.filter((t) => t.status !== 'completed')).slice(0, 5);
                if (upcomingPreview.length === 0) {
                    previewTasks.innerHTML = '<li class="empty-state"><i class="fa-solid fa-clipboard"></i>No upcoming tasks yet. Add one to get started.</li>';
                } else {
                    upcomingPreview.forEach((task) => {
                        const li = document.createElement('li');
                        const badgeClass = task.status === 'completed' ? 'badge-completed' : 'badge-pending';
                        li.innerHTML = `<span><strong>${escapeHtml(task.title)}</strong><small class="muted">${escapeHtml(task.subject || 'General')}</small></span>
                            <span class="badge ${badgeClass}">${escapeHtml(task.due_date || task.status)}</span>`;
                        previewTasks.appendChild(li);
                    });
                }
            }

            const previewSched = document.getElementById('dashboard-today-schedule');
            if (previewSched) {
                const todays = schedule.filter((item) => item.study_date === today);
                previewSched.innerHTML = '';
                if (todays.length === 0) {
                    previewSched.innerHTML = '<li class="empty-state"><i class="fa-solid fa-calendar"></i>Nothing scheduled for today. Add a session in Schedule.</li>';
                } else {
                    todays.forEach((item) => {
                        const li = document.createElement('li');
                        li.innerHTML = `<span><strong>${escapeHtml(item.subject)}</strong><small class="muted">${escapeHtml(item.topic)}</small></span>
                            <span class="badge badge-pending">${escapeHtml(item.start_time)} – ${escapeHtml(item.end_time)}</span>`;
                        previewSched.appendChild(li);
                    });
                }
            }
        } catch (err) {
            console.error('Failed to load dashboard data', err);
        }
    }

    // ==========================================
    // TASK MANAGER MODULE (PAGE)
    // ==========================================
    async function loadTasksPage() {
        const response = await fetch('/api/tasks');
        const tasks = await response.json();
        
        const tbody = document.getElementById('task-table-body');
        const subjectSelect = document.getElementById('filter-subject');
        const searchInput = document.getElementById('task-search');
        const statusFilter = document.getElementById('filter-status');
        const priorityFilter = document.getElementById('filter-priority');

        if (subjectSelect) {
            const subjects = [...new Set(tasks.map(t => t.subject || 'General'))];
            const currentSelected = subjectSelect.value;
            subjectSelect.innerHTML = '<option value="all">All Subjects</option>';
            subjects.forEach(sub => {
                const opt = document.createElement('option');
                opt.value = sub;
                opt.textContent = sub;
                if (sub === currentSelected) opt.selected = true;
                subjectSelect.appendChild(opt);
            });
        }

        function renderTable() {
            if (!tbody) return;
            const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
            const statusVal = statusFilter ? statusFilter.value : 'all';
            const priorityVal = priorityFilter ? priorityFilter.value : 'all';
            const subjectVal = subjectSelect ? subjectSelect.value : 'all';

            const filtered = tasks.filter(task => {
                const matchesSearch = task.title.toLowerCase().includes(searchTerm) || (task.subject && task.subject.toLowerCase().includes(searchTerm));
                const matchesStatus = statusVal === 'all' || task.status === statusVal;
                const matchesPriority = priorityVal === 'all' || task.priority === priorityVal;
                const matchesSubject = subjectVal === 'all' || (task.subject || 'General') === subjectVal;
                return matchesSearch && matchesStatus && matchesPriority && matchesSubject;
            });

            tbody.innerHTML = '';
            if (filtered.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No tasks found.</td></tr>`;
                return;
            }

            filtered.forEach(task => {
                const tr = document.createElement('tr');
                const statusBadge = task.status === 'completed' 
                    ? `<span class="badge badge-completed">Completed</span>` 
                    : `<span class="badge badge-pending">Pending</span>`;
                
                let priorityClass = 'badge-medium';
                if (task.priority === 'High') priorityClass = 'badge-high';
                if (task.priority === 'Low') priorityClass = 'badge-low';
                const priorityBadge = `<span class="badge ${priorityClass}">${task.priority || 'Medium'}</span>`;

                tr.innerHTML = `
                    <td>${statusBadge}</td>
                    <td><strong>${escapeHtml(task.title)}</strong></td>
                    <td>${escapeHtml(task.subject || 'General')}</td>
                    <td>${priorityBadge}</td>
                    <td>${escapeHtml(task.due_date)}</td>
                    <td>
                        <button class="btn btn-sm btn-success toggle-task" data-id="${task.id}" data-status="${task.status}" title="Toggle Complete">
                            <i class="fa-solid fa-${task.status === 'completed' ? 'rotate-left' : 'check'}"></i>
                        </button>
                        <button class="btn btn-sm btn-warning edit-task" data-id="${task.id}" title="Edit Task">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="btn btn-sm btn-danger delete-task" data-id="${task.id}" title="Delete Task">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            tbody.querySelectorAll('.delete-task').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (confirm('Are you sure you want to delete this task?')) {
                        await fetch(`/api/tasks/${btn.dataset.id}`, { method: 'DELETE' });
                        loadTasksPage();
                    }
                });
            });

            tbody.querySelectorAll('.toggle-task').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const newStatus = btn.dataset.status === 'completed' ? 'pending' : 'completed';
                    const task = tasks.find(t => t.id == btn.dataset.id);
                    await fetch(`/api/tasks/${btn.dataset.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ...task, status: newStatus })
                    });
                    loadTasksPage();
                });
            });

            tbody.querySelectorAll('.edit-task').forEach(btn => {
                btn.addEventListener('click', () => {
                    const task = tasks.find(t => t.id == btn.dataset.id);
                    if (task) {
                        document.getElementById('modal-title').textContent = 'Edit Task';
                        document.getElementById('task-id').value = task.id;
                        document.getElementById('task-title-input').value = task.title;
                        document.getElementById('task-subject-input').value = task.subject || '';
                        document.getElementById('task-priority-input').value = task.priority || 'Medium';
                        document.getElementById('task-due-input').value = task.due_date || '';
                        document.getElementById('task-modal').classList.add('active');
                    }
                });
            });
        }

        renderTable();

        if (searchInput) searchInput.addEventListener('input', renderTable);
        if (statusFilter) statusFilter.addEventListener('change', renderTable);
        if (priorityFilter) priorityFilter.addEventListener('change', renderTable);
        if (subjectSelect) subjectSelect.addEventListener('change', renderTable);
    }

    // Modal logic for Task Manager
    const taskModal = document.getElementById('task-modal');
    const openTaskModalBtn = document.getElementById('open-task-modal');
    const closeTaskModalBtn = document.getElementById('close-task-modal');
    const cancelTaskBtn = document.getElementById('cancel-task');
    const taskForm = document.getElementById('task-form');

    if (openTaskModalBtn && taskModal) {
        openTaskModalBtn.addEventListener('click', () => {
            document.getElementById('modal-title').textContent = 'Add Task';
            document.getElementById('task-id').value = '';
            if (taskForm) taskForm.reset();
            taskModal.classList.add('active');
        });
    }

    if (closeTaskModalBtn && taskModal) closeTaskModalBtn.addEventListener('click', () => taskModal.classList.remove('active'));
    if (cancelTaskBtn && taskModal) cancelTaskBtn.addEventListener('click', () => taskModal.classList.remove('active'));

    if (taskForm) {
        taskForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const taskId = document.getElementById('task-id').value;
            const title = document.getElementById('task-title-input').value;
            const subject = document.getElementById('task-subject-input').value;
            const priority = document.getElementById('task-priority-input').value;
            const due_date = document.getElementById('task-due-input').value;

            const payload = { title, subject, priority, due_date };

            if (taskId) {
                await fetch(`/api/tasks/${taskId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                await fetch('/api/tasks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }

            taskModal.classList.remove('active');
            taskForm.reset();
            loadTasksPage();
        });
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
});