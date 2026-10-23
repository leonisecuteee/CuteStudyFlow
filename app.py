from flask import Flask, render_template, request, jsonify
import sqlite3
import datetime
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(
    __name__,
    static_folder=os.path.join(BASE_DIR, 'static'),
    template_folder=os.path.join(BASE_DIR, 'templates'),
    static_url_path='/static'
)
DB_NAME = os.path.join(BASE_DIR, 'studyflow.db')

def init_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    # 1. Tasks Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            subject TEXT,
            priority TEXT DEFAULT 'Medium',
            due_date TEXT,
            status TEXT DEFAULT 'pending'
        )
    ''')

    # 2. Notes Table & Schema Migration
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            subject TEXT DEFAULT 'General',
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute("PRAGMA table_info(notes)")
    notes_columns = [col[1] for col in cursor.fetchall()]
    if 'subject' not in notes_columns:
        cursor.execute("ALTER TABLE notes ADD COLUMN subject TEXT DEFAULT 'General'")

    # 3. Schedule Table & Schema Migration
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS schedule (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subject TEXT NOT NULL,
            topic TEXT NOT NULL,
            study_date TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL
        )
    ''')
    cursor.execute("PRAGMA table_info(schedule)")
    sched_columns = [col[1] for col in cursor.fetchall()]
    if 'study_date' not in sched_columns:
        cursor.execute("ALTER TABLE schedule ADD COLUMN study_date TEXT DEFAULT ''")
    if 'start_time' not in sched_columns:
        cursor.execute("ALTER TABLE schedule ADD COLUMN start_time TEXT DEFAULT ''")
    if 'end_time' not in sched_columns:
        cursor.execute("ALTER TABLE schedule ADD COLUMN end_time TEXT DEFAULT ''")
    if 'topic' not in sched_columns:
        cursor.execute("ALTER TABLE schedule ADD COLUMN topic TEXT DEFAULT ''")

    # 4. Quiz History Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS quiz_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL,
            score INTEGER NOT NULL,
            total_questions INTEGER NOT NULL,
            date_taken TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # 5. Focus Sessions Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS focus_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subject TEXT NOT NULL,
            duration INTEGER NOT NULL,
            completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    conn.commit()
    conn.close()

# Routes
@app.route('/')
def dashboard():
    return render_template('dashboard.html')

@app.route('/tasks')
def tasks_page():
    return render_template('tasks.html')

@app.route('/planner')
def planner_page():
    return render_template('planner.html')

@app.route('/notes')
def notes_page():
    return render_template('notes.html')

@app.route('/quiz')
def quiz_page():
    return render_template('quiz.html')

@app.route('/timer')
def timer_page():
    return render_template('timer.html')

@app.route('/progress')
def progress_page():
    return render_template('progress.html')

@app.route('/about')
def about_page():
    return render_template('about.html')

@app.route('/privacy')
def privacy_page():
    return render_template('privacy.html')

# Task API
@app.route('/api/tasks', methods=['GET', 'POST'])
def manage_tasks():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    if request.method == 'POST':
        data = request.get_json() or {}
        cursor.execute('INSERT INTO tasks (title, subject, priority, due_date, status) VALUES (?, ?, ?, ?, ?)',
                       (data.get('title'), data.get('subject', 'General'), data.get('priority', 'Medium'), data.get('due_date', ''), 'pending'))
        conn.commit()
        task_id = cursor.lastrowid
        conn.close()
        return jsonify({'id': task_id, 'status': 'success'}), 201
    
    cursor.execute('SELECT * FROM tasks ORDER BY due_date ASC')
    tasks = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(tasks)

@app.route('/api/tasks/<int:task_id>', methods=['PUT', 'DELETE'])
def modify_task(task_id):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    if request.method == 'DELETE':
        cursor.execute('DELETE FROM tasks WHERE id = ?', (task_id,))
        conn.commit()
        conn.close()
        return jsonify({'status': 'deleted'})
    elif request.method == 'PUT':
        data = request.get_json() or {}
        cursor.execute('''
            UPDATE tasks 
            SET title = ?, subject = ?, priority = ?, due_date = ?, status = ? 
            WHERE id = ?
        ''', (
            data.get('title'),
            data.get('subject'),
            data.get('priority'),
            data.get('due_date'),
            data.get('status', 'pending'),
            task_id
        ))
        conn.commit()
        conn.close()
        return jsonify({'status': 'updated'})

# Notes API
@app.route('/api/notes', methods=['GET', 'POST'])
def manage_notes():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    if request.method == 'POST':
        data = request.get_json() or {}
        title = data.get('title')
        subject = data.get('subject', 'General')
        content = data.get('content')
        
        if not title or not content:
            return jsonify({'error': 'Title and content are required.'}), 400

        cursor.execute('INSERT INTO notes (title, subject, content) VALUES (?, ?, ?)',
                       (title, subject, content))
        conn.commit()
        note_id = cursor.lastrowid
        conn.close()
        return jsonify({'id': note_id, 'status': 'success'}), 201
    
    cursor.execute('SELECT * FROM notes ORDER BY created_at DESC')
    notes = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(notes)

@app.route('/api/notes/<int:note_id>', methods=['PUT', 'DELETE'])
def modify_note(note_id):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    if request.method == 'DELETE':
        cursor.execute('DELETE FROM notes WHERE id = ?', (note_id,))
        conn.commit()
        conn.close()
        return jsonify({'status': 'deleted'})
    elif request.method == 'PUT':
        data = request.get_json() or {}
        title = data.get('title')
        subject = data.get('subject', 'General')
        content = data.get('content')

        if not title or not content:
            return jsonify({'error': 'Title and content are required.'}), 400

        cursor.execute('''
            UPDATE notes 
            SET title = ?, subject = ?, content = ? 
            WHERE id = ?
        ''', (title, subject, content, note_id))
        conn.commit()
        conn.close()
        return jsonify({'status': 'updated'})

# Study Schedule / Planner API
@app.route('/api/schedule', methods=['GET', 'POST'])
def manage_schedule():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    if request.method == 'POST':
        data = request.get_json() or {}
        subject = data.get('subject')
        topic = data.get('topic')
        study_date = data.get('study_date')
        start_time = data.get('start_time')
        end_time = data.get('end_time')

        if not subject or not topic or not study_date or not start_time or not end_time:
            return jsonify({'error': 'All fields are required.'}), 400

        if start_time >= end_time:
            return jsonify({'error': 'Start time must be before end time.'}), 400

        cursor.execute('''
            INSERT INTO schedule (subject, topic, study_date, start_time, end_time) 
            VALUES (?, ?, ?, ?, ?)
        ''', (subject, topic, study_date, start_time, end_time))
        conn.commit()
        sched_id = cursor.lastrowid
        conn.close()
        return jsonify({'id': sched_id, 'status': 'success'}), 201
    
    cursor.execute('SELECT * FROM schedule ORDER BY study_date ASC, start_time ASC')
    schedule = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(schedule)

@app.route('/api/schedule/<int:sched_id>', methods=['PUT', 'DELETE'])
def modify_schedule(sched_id):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    if request.method == 'DELETE':
        cursor.execute('DELETE FROM schedule WHERE id = ?', (sched_id,))
        conn.commit()
        conn.close()
        return jsonify({'status': 'deleted'})
    elif request.method == 'PUT':
        data = request.get_json() or {}
        subject = data.get('subject')
        topic = data.get('topic')
        study_date = data.get('study_date')
        start_time = data.get('start_time')
        end_time = data.get('end_time')

        if not subject or not topic or not study_date or not start_time or not end_time:
            return jsonify({'error': 'All fields are required.'}), 400

        if start_time >= end_time:
            return jsonify({'error': 'Start time must be before end time.'}), 400

        cursor.execute('''
            UPDATE schedule 
            SET subject = ?, topic = ?, study_date = ?, start_time = ?, end_time = ? 
            WHERE id = ?
        ''', (subject, topic, study_date, start_time, end_time, sched_id))
        conn.commit()
        conn.close()
        return jsonify({'status': 'updated'})

# Focus Sessions API
@app.route('/api/focus-session', methods=['GET', 'POST'])
def save_focus_session():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    if request.method == 'GET':
        cursor.execute('SELECT * FROM focus_sessions ORDER BY completed_at DESC')
        sessions = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return jsonify(sessions)

    data = request.get_json() or {}
    subject = data.get('subject', 'General')
    duration = data.get('duration', 25)
    cursor.execute('INSERT INTO focus_sessions (subject, duration) VALUES (?, ?)', (subject, duration))
    conn.commit()
    session_id = cursor.lastrowid
    conn.close()
    return jsonify({'id': session_id, 'status': 'success'}), 201

# Quiz History API
@app.route('/api/quiz-history', methods=['GET', 'POST'])
def quiz_history():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    if request.method == 'POST':
        data = request.get_json() or {}
        category = data.get('category')
        score = data.get('score')
        total_questions = data.get('total_questions')

        if not category or score is None or not total_questions:
            return jsonify({'error': 'Invalid data provided.'}), 400

        cursor.execute('''
            INSERT INTO quiz_history (category, score, total_questions) 
            VALUES (?, ?, ?)
        ''', (category, score, total_questions))
        conn.commit()
        history_id = cursor.lastrowid
        conn.close()
        return jsonify({'id': history_id, 'status': 'success'}), 201

    cursor.execute('SELECT * FROM quiz_history ORDER BY date_taken DESC')
    history = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(history)

# Progress Tracking API
@app.route('/api/progress-stats', methods=['GET'])
def progress_stats():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Tasks calculation
    cursor.execute('SELECT status, due_date FROM tasks')
    all_tasks = [dict(row) for row in cursor.fetchall()]
    today_str = datetime.date.today().isoformat()

    total_tasks = len(all_tasks)
    completed_tasks = sum(1 for t in all_tasks if t['status'] == 'completed')
    pending_tasks = sum(1 for t in all_tasks if t['status'] == 'pending')
    overdue_tasks = sum(1 for t in all_tasks if t['status'] == 'pending' and t.get('due_date') and t['due_date'] < today_str)

    completion_rate = round((completed_tasks / total_tasks * 100), 1) if total_tasks > 0 else 0

    # Focus sessions calculation
    cursor.execute('SELECT SUM(duration) as total_min FROM focus_sessions')
    focus_row = cursor.fetchone()
    total_focus_min = focus_row['total_min'] if focus_row and focus_row['total_min'] else 0

    cursor.execute('SELECT COUNT(*) as sched_count FROM schedule')
    sched_row = cursor.fetchone()
    total_study_sessions = sched_row['sched_count'] if sched_row and sched_row['sched_count'] else 0

    # Quiz statistics
    cursor.execute('SELECT category, score, total_questions FROM quiz_history')
    quizzes = [dict(row) for row in cursor.fetchall()]
    total_quizzes = len(quizzes)
    
    avg_quiz_score = 0
    best_category = "N/A"
    if total_quizzes > 0:
        total_percentages = [(q['score'] / q['total_questions']) * 100 for q in quizzes]
        avg_quiz_score = round(sum(total_percentages) / total_quizzes, 1)

        cat_scores = {}
        for q in quizzes:
            cat = q['category']
            pct = (q['score'] / q['total_questions']) * 100
            if cat not in cat_scores:
                cat_scores[cat] = []
            cat_scores[cat].append(pct)
        
        best_category = max(cat_scores, key=lambda c: sum(cat_scores[c]) / len(cat_scores[c]))

    # Subject distribution
    cursor.execute('SELECT subject, COUNT(*) as count FROM tasks WHERE subject IS NOT NULL AND subject != "" GROUP BY subject')
    subject_counts = [dict(row) for row in cursor.fetchall()]

    conn.close()

    return jsonify({
        'total_tasks': total_tasks,
        'completed_tasks': completed_tasks,
        'pending_tasks': pending_tasks,
        'overdue_tasks': overdue_tasks,
        'completion_rate': completion_rate,
        'total_focus_min': total_focus_min,
        'total_study_sessions': total_study_sessions,
        'total_quizzes': total_quizzes,
        'avg_quiz_score': avg_quiz_score,
        'best_category': best_category,
        'subject_counts': subject_counts
    })

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)