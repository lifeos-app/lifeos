/**
 * assessment-engine.ts — Assessment Engine for Academy 2.0
 *
 * Generates assessment questions via LLM and grades responses.
 * Phase gate: 80% to pass.
 */

import { callLLMJson } from './llm-proxy';

// ── Types ──

export interface AssessmentQuestion {
  id: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer';
  question: string;
  options: string[] | null;
  correctAnswer: string;
  explanation: string;
}

export interface AssessmentResult {
  score: number;
  passed: boolean;
  feedback: Record<string, { correct: boolean; explanation: string }>;
}

// ── Fallback Questions ──

function buildFallbackQuestions(topic: string): AssessmentQuestion[] {
  return [
    {
      id: 'fb_1',
      type: 'multiple_choice',
      question: `Which of the following best describes a core concept in ${topic}?`,
      options: ['Fundamental principle', 'Unrelated tangent', 'Common misconception', 'None of the above'],
      correctAnswer: 'Fundamental principle',
      explanation: `Understanding the fundamental principles of ${topic} is essential for mastery.`,
    },
    {
      id: 'fb_2',
      type: 'multiple_choice',
      question: `What is an important practice when studying ${topic}?`,
      options: ['Consistent review', 'Ignoring details', 'Skipping exercises', 'Memorising without understanding'],
      correctAnswer: 'Consistent review',
      explanation: 'Consistent review reinforces learning and improves retention.',
    },
    {
      id: 'fb_3',
      type: 'multiple_choice',
      question: `Why is practical application important in ${topic}?`,
      options: ['It builds muscle memory', 'It is not important', 'It wastes time', 'It only helps beginners'],
      correctAnswer: 'It builds muscle memory',
      explanation: 'Practical application reinforces theoretical knowledge through hands-on experience.',
    },
    {
      id: 'fb_4',
      type: 'true_false',
      question: `Active recall is more effective than passive re-reading when learning ${topic}.`,
      options: ['True', 'False'],
      correctAnswer: 'True',
      explanation: 'Active recall forces your brain to retrieve information, strengthening neural pathways.',
    },
    {
      id: 'fb_5',
      type: 'short_answer',
      question: `In your own words, describe one key takeaway from studying ${topic}.`,
      options: null,
      correctAnswer: topic.toLowerCase(),
      explanation: `Any meaningful reflection on ${topic} demonstrates engagement with the material.`,
    },
  ];
}

// ── Question Generation ──

export async function generateAssessmentQuestions(
  phaseTitle: string,
  milestoneDescription: string,
  lessonKeyPoints: string[],
  topic: string,
): Promise<AssessmentQuestion[]> {
  const keyPointsText = lessonKeyPoints.join('\n- ');

  const prompt = `You are a quiz generator for a learning platform. Generate exactly 5 assessment questions for the following:

Topic: ${topic}
Phase: ${phaseTitle}
Milestone: ${milestoneDescription}
Key Points:
- ${keyPointsText}

Return a JSON array of 5 questions:
- Questions 1-3: multiple_choice (4 options each)
- Question 4: true_false (options: ["True", "False"])
- Question 5: short_answer (options: null)

Each question object must have:
{ "id": "q_1", "type": "multiple_choice"|"true_false"|"short_answer", "question": "...", "options": ["A","B","C","D"] or ["True","False"] or null, "correctAnswer": "exact match from options or keywords for short_answer", "explanation": "why this is correct" }

Return ONLY the JSON array, no extra text.`;

  try {
    const result = await callLLMJson<AssessmentQuestion[]>(prompt);

    // Validate structure
    if (!Array.isArray(result) || result.length < 5) {
      return buildFallbackQuestions(topic);
    }

    for (const q of result) {
      if (!q.id || !q.type || !q.question || !q.correctAnswer || !q.explanation) {
        return buildFallbackQuestions(topic);
      }
    }

    return result.slice(0, 5);
  } catch {
    return buildFallbackQuestions(topic);
  }
}

// ── Grading ──

export function gradeAssessment(
  questions: AssessmentQuestion[],
  answers: Record<string, string>,
): AssessmentResult {
  const feedback: Record<string, { correct: boolean; explanation: string }> = {};
  let correctCount = 0;

  for (const q of questions) {
    const userAnswer = answers[q.id] ?? '';
    let isCorrect = false;

    if (q.type === 'multiple_choice' || q.type === 'true_false') {
      isCorrect = userAnswer.trim() === q.correctAnswer.trim();
    } else if (q.type === 'short_answer') {
      // Keyword check: split correctAnswer into words and check presence
      const keywords = q.correctAnswer
        .toLowerCase()
        .split(/[\s,;]+/)
        .filter(w => w.length > 2);
      const lowerAnswer = userAnswer.toLowerCase();
      // Pass if at least one keyword appears
      isCorrect = keywords.length === 0 || keywords.some(kw => lowerAnswer.includes(kw));
    }

    if (isCorrect) correctCount++;
    feedback[q.id] = { correct: isCorrect, explanation: q.explanation };
  }

  const total = questions.length || 1;
  const score = Math.round((correctCount / total) * 100);

  return {
    score,
    passed: score >= 80,
    feedback,
  };
}
