/**
 * LearningToCode — Interactive coding lessons with live preview
 *
 * Teaches HTML, CSS, and JavaScript through a split-pane editor
 * with real-time iframe preview using srcDoc.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Code, Play, CheckCircle2, ChevronLeft, ChevronRight, FileCode, Paintbrush, Zap, RotateCcw, LayoutGrid, FunctionSquare, Atom, Box, Server, Component } from 'lucide-react';
import './LearningToCode.css';

export interface LearningToCodeProps {
  onStepComplete?: (stepId: string) => void;
  completedSteps?: string[];
}

// ── Lesson Steps ──

interface CodeStep {
  id: string;
  title: string;
  icon: React.ReactNode;
  description: string;
  starterCode: string;
  hint: string;
}

const STEPS: CodeStep[] = [
  {
    id: 'html-basics',
    title: 'Hello World',
    icon: <FileCode size={18} />,
    description: 'Every webpage starts with HTML. HTML tells the browser what content to show — headings, paragraphs, images, and links. Write your first HTML page!',
    hint: 'Try changing the text inside the <h1> and <p> tags. Add another <p> tag below!',
    starterCode: `<!DOCTYPE html>
<html>
<head>
  <title>My First Page</title>
</head>
<body>
  <h1>Hello, World!</h1>
  <p>This is my first webpage.</p>
  <p>LifeOS Academy is teaching me to code!</p>
</body>
</html>`,
  },
  {
    id: 'css-styling',
    title: 'Make It Beautiful',
    icon: <Paintbrush size={18} />,
    description: 'CSS (Cascading Style Sheets) controls how HTML looks — colors, fonts, spacing, layouts. Add a <style> block to transform your plain HTML into something beautiful.',
    hint: 'Try changing the background color, font sizes, or adding a border to the container!',
    starterCode: `<!DOCTYPE html>
<html>
<head>
  <title>Styled Page</title>
  <style>
    body {
      font-family: 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #0a1628, #1a2d4a);
      color: #e0e0e0;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
    }
    .card {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(0, 212, 255, 0.2);
      border-radius: 16px;
      padding: 32px;
      max-width: 400px;
      text-align: center;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }
    h1 {
      color: #00D4FF;
      margin-bottom: 12px;
    }
    p {
      color: #8BA4BE;
      line-height: 1.6;
    }
    .badge {
      display: inline-block;
      background: linear-gradient(135deg, #00D4FF, #39FF14);
      color: #0a1628;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Styled!</h1>
    <p>CSS transforms plain HTML into beautiful interfaces. This card uses gradients, glass morphism, and shadows.</p>
    <div class="badge">LifeOS Academy</div>
  </div>
</body>
</html>`,
  },
  {
    id: 'js-interactivity',
    title: 'Make It Alive',
    icon: <Zap size={18} />,
    description: 'JavaScript makes webpages interactive — responding to clicks, updating content, creating animations. Add a <script> tag to make your page respond to user actions.',
    hint: 'Try changing the button text or adding more emoji options!',
    starterCode: `<!DOCTYPE html>
<html>
<head>
  <title>Interactive Page</title>
  <style>
    body {
      font-family: 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #0a1628, #1a2d4a);
      color: #e0e0e0;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
    }
    .container {
      text-align: center;
    }
    h1 { color: #00D4FF; margin-bottom: 8px; }
    p { color: #8BA4BE; margin-bottom: 24px; }
    #output {
      font-size: 48px;
      margin: 20px 0;
      transition: transform 0.2s;
    }
    button {
      background: linear-gradient(135deg, #00D4FF, #0098B8);
      border: none;
      color: #0a1628;
      padding: 12px 28px;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      margin: 4px;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(0, 212, 255, 0.4);
    }
    #counter {
      color: #39FF14;
      font-size: 14px;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Interactive!</h1>
    <p>Click the button to generate a random emoji</p>
    <div id="output">🎯</div>
    <button onclick="randomize()">Randomize</button>
    <button onclick="reset()">Reset</button>
    <div id="counter">Clicks: 0</div>
  </div>
  <script>
    let count = 0;
    const emojis = ['🎯','🎨','💡','🔥','⚡','🎮','🌟','💎','🚀','🎵','🧠','🌈'];

    function randomize() {
      count++;
      const emoji = emojis[Math.floor(Math.random() * emojis.length)];
      document.getElementById('output').textContent = emoji;
      document.getElementById('counter').textContent = 'Clicks: ' + count;
      document.getElementById('output').style.transform = 'scale(1.3)';
      setTimeout(() => {
        document.getElementById('output').style.transform = 'scale(1)';
      }, 200);
    }

    function reset() {
      count = 0;
      document.getElementById('output').textContent = '🎯';
      document.getElementById('counter').textContent = 'Clicks: 0';
    }
  </script>
</body>
</html>`,
  },
  {
    id: 'css-layouts',
    title: 'Layouts with Flexbox & Grid',
    icon: <LayoutGrid size={18} />,
    description: 'Modern web pages use Flexbox and CSS Grid to create responsive layouts. Flexbox arranges items in a row or column. Grid creates two-dimensional layouts. Master these and you can build any layout you see on the web.',
    hint: 'Try adding more cards to the grid, or change the grid to 4 columns. Change justify-content on the flex row to see different alignment options!',
    starterCode: `<!DOCTYPE html>
<html>
<head>
  <title>Layouts</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #0a1628, #1a2d4a);
      color: #e0e0e0;
      min-height: 100vh;
      padding: 32px;
    }
    h1 {
      color: #00D4FF;
      margin-bottom: 8px;
      font-size: 24px;
    }
    .subtitle {
      color: #8BA4BE;
      margin-bottom: 32px;
      font-size: 14px;
    }

    /* === FLEXBOX SECTION === */
    .flex-section {
      margin-bottom: 40px;
    }
    .section-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #A855F7;
      margin-bottom: 12px;
      font-weight: 700;
    }
    .flex-row {
      display: flex;
      gap: 12px;
      justify-content: center;
      align-items: stretch;
      flex-wrap: wrap;
    }
    .flex-item {
      background: rgba(168, 85, 247, 0.1);
      border: 1px solid rgba(168, 85, 247, 0.25);
      border-radius: 10px;
      padding: 20px;
      flex: 1 1 150px;
      max-width: 220px;
      text-align: center;
    }
    .flex-item h3 {
      color: #C084FC;
      font-size: 15px;
      margin-bottom: 6px;
    }
    .flex-item p {
      color: #8BA4BE;
      font-size: 12px;
      line-height: 1.5;
    }

    /* === CSS GRID SECTION === */
    .grid-section {
      margin-bottom: 40px;
    }
    .grid-container {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    .grid-card {
      background: rgba(0, 212, 255, 0.06);
      border: 1px solid rgba(0, 212, 255, 0.15);
      border-radius: 12px;
      padding: 20px;
    }
    .grid-card.wide {
      grid-column: span 2;
    }
    .grid-card.tall {
      grid-row: span 2;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .grid-card h3 {
      color: #00D4FF;
      font-size: 15px;
      margin-bottom: 8px;
    }
    .grid-card p {
      color: #8BA4BE;
      font-size: 12px;
      line-height: 1.5;
    }
    .stat-number {
      font-size: 32px;
      font-weight: 700;
      color: #39FF14;
      margin-bottom: 4px;
    }
    .stat-label {
      font-size: 11px;
      text-transform: uppercase;
      color: #5A7A9A;
      letter-spacing: 0.05em;
    }
  </style>
</head>
<body>
  <h1>Layouts</h1>
  <p class="subtitle">Flexbox and Grid — the building blocks of every modern interface</p>

  <!-- Flexbox -->
  <div class="flex-section">
    <div class="section-label">Flexbox — Row Layout</div>
    <div class="flex-row">
      <div class="flex-item">
        <h3>Flexible</h3>
        <p>Items grow and shrink to fill available space</p>
      </div>
      <div class="flex-item">
        <h3>Aligned</h3>
        <p>Control vertical and horizontal alignment</p>
      </div>
      <div class="flex-item">
        <h3>Responsive</h3>
        <p>Wrap items automatically on smaller screens</p>
      </div>
    </div>
  </div>

  <!-- CSS Grid -->
  <div class="grid-section">
    <div class="section-label">CSS Grid — 2D Layout</div>
    <div class="grid-container">
      <div class="grid-card tall">
        <div class="stat-number">42</div>
        <div class="stat-label">Tasks Done</div>
        <p style="margin-top:12px">Grid lets you span items across rows and columns for dashboard-style layouts.</p>
      </div>
      <div class="grid-card">
        <h3>Column 1</h3>
        <p>Each cell in the grid is independent</p>
      </div>
      <div class="grid-card">
        <h3>Column 2</h3>
        <p>Items can span multiple columns</p>
      </div>
      <div class="grid-card wide">
        <h3>Wide Card</h3>
        <p>This card spans 2 columns using grid-column: span 2. Great for feature sections and charts.</p>
      </div>
    </div>
  </div>
</body>
</html>`,
  },
  {
    id: 'js-functions',
    title: 'JavaScript Functions & DOM',
    icon: <FunctionSquare size={18} />,
    description: 'Functions are reusable blocks of code that perform a task. Combined with the DOM (Document Object Model), they let you read and change any element on the page dynamically. This step builds a working task list.',
    hint: 'Try adding a "clear all" button, or making tasks editable when you double-click them!',
    starterCode: `<!DOCTYPE html>
<html>
<head>
  <title>Task List</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #0a1628, #1a2d4a);
      color: #e0e0e0;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      padding: 40px 20px;
      margin: 0;
    }
    .app {
      width: 100%;
      max-width: 480px;
    }
    h1 {
      color: #00D4FF;
      font-size: 22px;
      margin-bottom: 4px;
    }
    .subtitle {
      color: #5A7A9A;
      font-size: 13px;
      margin-bottom: 20px;
    }
    .input-row {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
    }
    input[type="text"] {
      flex: 1;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 10px 14px;
      color: #E0E0E0;
      font-size: 14px;
      outline: none;
      font-family: inherit;
    }
    input[type="text"]:focus {
      border-color: rgba(0, 212, 255, 0.5);
    }
    .add-btn {
      background: #00D4FF;
      color: #0a1628;
      border: none;
      border-radius: 8px;
      padding: 10px 20px;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      font-family: inherit;
    }
    .add-btn:hover { opacity: 0.9; }
    .task-list { list-style: none; padding: 0; }
    .task-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 14px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 8px;
      margin-bottom: 6px;
      transition: all 0.15s;
    }
    .task-item.done {
      opacity: 0.5;
    }
    .task-item.done .task-text {
      text-decoration: line-through;
      color: #5A7A9A;
    }
    .task-check {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.2);
      background: transparent;
      cursor: pointer;
      padding: 0;
      flex-shrink: 0;
      transition: all 0.15s;
    }
    .task-check.checked {
      background: #39FF14;
      border-color: #39FF14;
    }
    .task-text {
      flex: 1;
      font-size: 14px;
    }
    .task-delete {
      background: none;
      border: none;
      color: #5A7A9A;
      cursor: pointer;
      font-size: 16px;
      padding: 4px;
      border-radius: 4px;
    }
    .task-delete:hover { color: #EF4444; background: rgba(239,68,68,0.1); }
    .stats {
      margin-top: 16px;
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: #5A7A9A;
    }
    .stats span { color: #E0E0E0; font-weight: 600; }
  </style>
</head>
<body>
  <div class="app">
    <h1>Task List</h1>
    <p class="subtitle">Built with functions and DOM manipulation</p>

    <div class="input-row">
      <input type="text" id="taskInput" placeholder="Add a new task..." />
      <button class="add-btn" onclick="addTask()">Add</button>
    </div>

    <ul class="task-list" id="taskList"></ul>

    <div class="stats" id="stats"></div>
  </div>

  <script>
    // === DATA ===
    let tasks = [
      { id: 1, text: 'Learn HTML basics', done: true },
      { id: 2, text: 'Style with CSS', done: true },
      { id: 3, text: 'Add JavaScript', done: false },
      { id: 4, text: 'Build a project', done: false },
    ];
    let nextId = 5;

    // === RENDER FUNCTION ===
    function render() {
      const list = document.getElementById('taskList');
      list.innerHTML = '';

      tasks.forEach(function(task) {
        const li = document.createElement('li');
        li.className = 'task-item' + (task.done ? ' done' : '');

        const check = document.createElement('button');
        check.className = 'task-check' + (task.done ? ' checked' : '');
        check.onclick = function() { toggleTask(task.id); };

        const text = document.createElement('span');
        text.className = 'task-text';
        text.textContent = task.text;

        const del = document.createElement('button');
        del.className = 'task-delete';
        del.textContent = 'x';
        del.onclick = function() { deleteTask(task.id); };

        li.appendChild(check);
        li.appendChild(text);
        li.appendChild(del);
        list.appendChild(li);
      });

      updateStats();
    }

    // === ACTION FUNCTIONS ===
    function addTask() {
      const input = document.getElementById('taskInput');
      const text = input.value.trim();
      if (!text) return;

      tasks.push({ id: nextId++, text: text, done: false });
      input.value = '';
      render();
    }

    function toggleTask(id) {
      const task = tasks.find(function(t) { return t.id === id; });
      if (task) task.done = !task.done;
      render();
    }

    function deleteTask(id) {
      tasks = tasks.filter(function(t) { return t.id !== id; });
      render();
    }

    // === STATS FUNCTION ===
    function updateStats() {
      const done = tasks.filter(function(t) { return t.done; }).length;
      const statsEl = document.getElementById('stats');
      statsEl.innerHTML =
        '<span>' + done + '</span> of <span>' + tasks.length + '</span> done' +
        ' | <span>' + (tasks.length - done) + '</span> remaining';
    }

    // Allow pressing Enter to add a task
    document.getElementById('taskInput').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') addTask();
    });

    // === INITIAL RENDER ===
    render();
  </script>
</body>
</html>`,
  },
  {
    id: 'react-basics',
    title: 'React Basics',
    icon: <Component size={18} />,
    description: 'React is a library for building user interfaces with reusable components. Instead of manually updating the DOM, you declare what the UI should look like for any given state, and React handles the rest. This step uses React via CDN with Babel for JSX.',
    hint: 'Try adding a new component, or changing the initial state values. Add a "priority" field to each task!',
    starterCode: `<!DOCTYPE html>
<html>
<head>
  <title>React Basics</title>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #0a1628, #1a2d4a);
      color: #e0e0e0;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      padding: 40px 20px;
      margin: 0;
    }
    .app {
      width: 100%;
      max-width: 520px;
    }
    h1 { color: #00D4FF; font-size: 22px; margin: 0 0 4px; }
    .subtitle { color: #5A7A9A; font-size: 13px; margin-bottom: 20px; }
    .react-badge {
      display: inline-block;
      background: rgba(0, 212, 255, 0.1);
      border: 1px solid rgba(0, 212, 255, 0.25);
      color: #00D4FF;
      font-size: 11px;
      padding: 3px 10px;
      border-radius: 12px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    .input-row {
      display: flex; gap: 8px; margin-bottom: 20px;
    }
    input[type="text"] {
      flex: 1;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 10px 14px;
      color: #E0E0E0;
      font-size: 14px;
      outline: none;
      font-family: inherit;
    }
    input[type="text"]:focus { border-color: rgba(0, 212, 255, 0.5); }
    .add-btn {
      background: #00D4FF; color: #0a1628; border: none;
      border-radius: 8px; padding: 10px 20px;
      font-weight: 700; font-size: 14px; cursor: pointer;
      font-family: inherit;
    }
    .task-list { list-style: none; padding: 0; }
    .task-item {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 14px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 8px; margin-bottom: 6px;
      transition: all 0.15s;
    }
    .task-item.done { opacity: 0.5; }
    .task-item.done .task-text { text-decoration: line-through; color: #5A7A9A; }
    .task-check {
      width: 20px; height: 20px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.2);
      background: transparent; cursor: pointer;
      padding: 0; flex-shrink: 0; transition: all 0.15s;
    }
    .task-check.checked { background: #39FF14; border-color: #39FF14; }
    .task-text { flex: 1; font-size: 14px; }
    .task-delete {
      background: none; border: none; color: #5A7A9A;
      cursor: pointer; font-size: 16px; padding: 4px; border-radius: 4px;
    }
    .task-delete:hover { color: #EF4444; background: rgba(239,68,68,0.1); }
    .stats {
      margin-top: 16px; display: flex; gap: 16px;
      font-size: 12px; color: #5A7A9A;
    }
    .stats span { color: #E0E0E0; font-weight: 600; }
    .section-label {
      font-size: 11px; text-transform: uppercase;
      letter-spacing: 0.08em; color: #39FF14;
      font-weight: 700; margin-top: 24px; margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <div id="root"></div>

  <script type="text/babel">
    // === REACT COMPONENTS ===

    // A single task item — reusable component
    function TaskItem({ task, onToggle, onDelete }) {
      return (
        <li className={'task-item' + (task.done ? ' done' : '')}>
          <button
            className={'task-check' + (task.done ? ' checked' : '')}
            onClick={() => onToggle(task.id)}
          />
          <span className="task-text">{task.text}</span>
          <button className="task-delete" onClick={() => onDelete(task.id)}>x</button>
        </li>
      );
    }

    // Stats display component
    function TaskStats({ tasks }) {
      const done = tasks.filter(t => t.done).length;
      return (
        <div className="stats">
          <span>{done}</span> of <span>{tasks.length}</span> done |
          <span>{tasks.length - done}</span> remaining
        </div>
      );
    }

    // Main App component — owns the state
    function App() {
      const [tasks, setTasks] = React.useState([
        { id: 1, text: 'Learn React components', done: true },
        { id: 2, text: 'Understand useState', done: true },
        { id: 3, text: 'Build with JSX', done: false },
        { id: 4, text: 'Create a real project', done: false },
      ]);
      const [input, setInput] = React.useState('');
      const [nextId, setNextId] = React.useState(5);

      function addTask() {
        if (!input.trim()) return;
        setTasks([...tasks, { id: nextId, text: input.trim(), done: false }]);
        setNextId(nextId + 1);
        setInput('');
      }

      function toggleTask(id) {
        setTasks(tasks.map(t =>
          t.id === id ? { ...t, done: !t.done } : t
        ));
      }

      function deleteTask(id) {
        setTasks(tasks.filter(t => t.id !== id));
      }

      function handleKeyDown(e) {
        if (e.key === 'Enter') addTask();
      }

      return (
        <div className="app">
          <div className="react-badge">React 18</div>
          <h1>React Task List</h1>
          <p className="subtitle">
            Same app as Step 5 — but built with React components and state
          </p>

          <div className="input-row">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a new task..."
            />
            <button className="add-btn" onClick={addTask}>Add</button>
          </div>

          <div className="section-label">Components</div>
          <ul className="task-list">
            {tasks.map(task => (
              <TaskItem
                key={task.id}
                task={task}
                onToggle={toggleTask}
                onDelete={deleteTask}
              />
            ))}
          </ul>

          <TaskStats tasks={tasks} />
        </div>
      );
    }

    // Mount the app
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<App />);
  </script>
</body>
</html>`,
  },
];

export default function LearningToCode({ onStepComplete, completedSteps = [] }: LearningToCodeProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [code, setCode] = useState(STEPS[0].starterCode);
  const [previewKey, setPreviewKey] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const step = STEPS[currentStep];
  const isComplete = completedSteps.includes(step.id);

  // Load starter code when switching steps
  useEffect(() => {
    setCode(STEPS[currentStep].starterCode);
    setPreviewKey(k => k + 1);
  }, [currentStep]);

  // Debounced preview update — iframe re-renders 300ms after typing stops
  const previewTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleCodeChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCode(e.target.value);
    // Auto-update preview after debounce
    clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      setPreviewKey(k => k + 1);
    }, 300);
  }, []);

  // Cleanup debounce timer
  useEffect(() => {
    return () => clearTimeout(previewTimerRef.current);
  }, []);

  const handleRefresh = useCallback(() => {
    setPreviewKey(k => k + 1);
  }, []);

  const handleReset = useCallback(() => {
    setCode(STEPS[currentStep].starterCode);
    setPreviewKey(k => k + 1);
  }, [currentStep]);

  const handleMarkComplete = useCallback(() => {
    if (onStepComplete && !isComplete) {
      onStepComplete(step.id);
    }
  }, [onStepComplete, isComplete, step.id]);

  const goNext = () => {
    if (currentStep < STEPS.length - 1) setCurrentStep(currentStep + 1);
  };
  const goPrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  return (
    <div className="ltc-container">
      {/* Step Progress */}
      <div className="ltc-progress-bar">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setCurrentStep(i)}
            className={`ltc-progress-dot ${
              i === currentStep ? 'current' : completedSteps.includes(s.id) ? 'done' : ''
            }`}
            title={s.title}
          />
        ))}
      </div>

      {/* Step Header */}
      <div className="ltc-step-header">
        <div className="ltc-step-icon">{step.icon}</div>
        <div className="ltc-step-info">
          <div className="ltc-step-number">Step {currentStep + 1} of {STEPS.length}</div>
          <h2 className="ltc-step-title">{step.title}</h2>
        </div>
        {!isComplete ? (
          <button className="ltc-complete-btn" onClick={handleMarkComplete}>
            <CheckCircle2 size={16} /> Mark Complete
          </button>
        ) : (
          <div className="ltc-completed-badge">
            <CheckCircle2 size={16} /> Completed
          </div>
        )}
      </div>

      {/* Description */}
      <div className="ltc-description">
        <p>{step.description}</p>
      </div>

      {/* Split Pane Editor */}
      <div className="ltc-editor-container">
        {/* Code Editor */}
        <div className="ltc-editor-pane">
          <div className="ltc-pane-header">
            <Code size={14} />
            <span>Code Editor</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button className="ltc-icon-btn" onClick={handleReset} title="Reset to starter code">
                <RotateCcw size={14} />
              </button>
            </div>
          </div>
          <textarea
            ref={textareaRef}
            className="ltc-code-area"
            value={code}
            onChange={handleCodeChange}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
          />
        </div>

        {/* Live Preview */}
        <div className="ltc-preview-pane">
          <div className="ltc-pane-header">
            <Play size={14} />
            <span>Live Preview</span>
            <div style={{ marginLeft: 'auto' }}>
              <button className="ltc-icon-btn" onClick={handleRefresh} title="Refresh preview">
                <RotateCcw size={14} />
              </button>
            </div>
          </div>
          <iframe
            key={previewKey}
            className="ltc-preview-frame"
            srcDoc={code}
            sandbox="allow-scripts allow-modals"
            title="Code Preview"
          />
        </div>
      </div>

      {/* Hint */}
      <div className="ltc-hint">
        <strong>Hint:</strong> {step.hint}
      </div>

      {/* Step Navigation */}
      <div className="ltc-nav">
        <button
          className="ltc-nav-btn"
          onClick={goPrev}
          disabled={currentStep === 0}
        >
          <ChevronLeft size={16} /> {currentStep > 0 ? STEPS[currentStep - 1].title : 'Previous'}
        </button>
        <button
          className="ltc-nav-btn ltc-nav-next"
          onClick={goNext}
          disabled={currentStep === STEPS.length - 1}
        >
          {currentStep < STEPS.length - 1 ? STEPS[currentStep + 1].title : 'Done!'} <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}