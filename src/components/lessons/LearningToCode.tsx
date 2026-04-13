/**
 * LearningToCode — Interactive coding lessons with live preview
 *
 * Teaches HTML, CSS, and JavaScript through a split-pane editor
 * with real-time iframe preview using srcDoc.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Code, Play, CheckCircle2, ChevronLeft, ChevronRight, FileCode, Paintbrush, Zap, RotateCcw, LayoutGrid, FunctionSquare, Atom } from 'lucide-react';
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

  const handleCodeChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCode(e.target.value);
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