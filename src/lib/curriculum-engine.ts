/**
 * curriculum-engine.ts — Generates personalised learning curricula via LLM
 * Falls back to template curriculum if LLM unavailable/times out.
 */

import { callLLMJson } from './llm-proxy';
import { logger } from '../utils/logger';
import { genId } from '../utils/date';
import type {
  WizardInput,
  GeneratedCurriculum,
  CurriculumPhase,
  CurriculumTopic,
  CurriculumLesson,
  GoalDomain,
} from '../types/academy';

// ── Main Export ──

export async function generateCurriculum(input: WizardInput): Promise<GeneratedCurriculum> {
  try {
    const prompt = `You are an expert curriculum designer. Create a personalised learning curriculum for a student.

Student profile:
- Topic: "${input.topic}"
- Domain: ${input.domain}
- Current level: ${input.currentLevel.replace(/_/g, ' ')}
- Goal: "${input.targetDescription}"
- Available time: ${input.minutesPerDay} minutes per day
- Learning style: ${input.learningStyle.replace(/_/g, ' ')}
${input.targetDate ? `- Target date: ${input.targetDate}` : '- No fixed deadline'}

Generate a JSON curriculum with this exact structure:
{
  "phases": [
    {
      "title": "Phase title",
      "description": "Phase description",
      "estimatedWeeks": 3,
      "milestoneDescription": "What the student will achieve by end of this phase",
      "topics": [
        {
          "title": "Topic title",
          "lessons": [
            {
              "title": "Lesson title",
              "description": "Brief lesson description",
              "estimatedMinutes": 30,
              "content": "Full lesson content in markdown (400-600 words). Include explanations, examples, and practical exercises.",
              "keyPoints": ["Key point 1", "Key point 2", "Key point 3"]
            }
          ]
        }
      ]
    }
  ]
}

Rules:
- 2-4 phases, progressing from foundational to advanced
- 1-3 topics per phase
- 3-6 lessons per topic
- Each lesson content should be 400-600 words of rich markdown with headers, lists, examples
- keyPoints: 3-5 strings per lesson
- estimatedMinutes: 15-60 per lesson based on complexity
- Tailor content to the student's current level and learning style
- Return ONLY the JSON object, no explanation.`;

    const raw = await callLLMJson<Record<string, unknown>>(prompt, { timeoutMs: 30000 });
    const validated = validateCurriculumResponse(raw, input);
    return validated;
  } catch (err) {
    logger.warn('[curriculum-engine] LLM failed, using fallback template:', err);
    return buildTemplateCurriculum(input);
  }
}

// ── Validation ──

function validateCurriculumResponse(raw: unknown, input: WizardInput): GeneratedCurriculum {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid curriculum response: not an object');
  }

  const obj = raw as Record<string, unknown>;
  const rawPhases = Array.isArray(obj.phases) ? obj.phases : [];

  if (rawPhases.length === 0) {
    throw new Error('No phases in curriculum response');
  }

  const phases: CurriculumPhase[] = [];
  let totalLessons = 0;
  let totalMinutes = 0;

  for (let pi = 0; pi < Math.min(rawPhases.length, 4); pi++) {
    const rp = rawPhases[pi];
    if (!rp || !rp.title) continue;

    const topics: CurriculumTopic[] = [];
    const rawTopics = Array.isArray(rp.topics) ? rp.topics : [];

    for (let ti = 0; ti < rawTopics.length; ti++) {
      const rt = rawTopics[ti];
      if (!rt || !rt.title) continue;

      const lessons: CurriculumLesson[] = [];
      const rawLessons = Array.isArray(rt.lessons) ? rt.lessons.slice(0, 6) : [];

      for (let li = 0; li < rawLessons.length; li++) {
        const rl = rawLessons[li];
        if (!rl || !rl.title) continue;

        const mins = Math.max(15, Math.min(60, parseInt(rl.estimatedMinutes) || 30));
        totalMinutes += mins;
        totalLessons++;

        lessons.push({
          id: genId(),
          title: String(rl.title).trim().slice(0, 200),
          description: String(rl.description || '').trim().slice(0, 500),
          estimatedMinutes: mins,
          content: String(rl.content || `# ${rl.title}\n\nContent for this lesson will be available soon.`),
          keyPoints: Array.isArray(rl.keyPoints)
            ? rl.keyPoints.map((kp: unknown) => String(kp).slice(0, 200)).slice(0, 5)
            : ['Review this lesson content carefully'],
          phaseIndex: pi,
          topicIndex: ti,
          lessonIndex: li,
          scheduledDate: null,
          completedAt: null,
          xpReward: 50,
        });
      }

      if (lessons.length > 0) {
        topics.push({
          id: genId(),
          title: String(rt.title).trim().slice(0, 200),
          lessons,
        });
      }
    }

    if (topics.length > 0) {
      phases.push({
        id: genId(),
        title: String(rp.title).trim().slice(0, 200),
        description: String(rp.description || '').trim().slice(0, 500),
        lessonCount: topics.reduce((sum, t) => sum + t.lessons.length, 0),
        estimatedWeeks: Math.max(1, Math.min(12, parseInt(rp.estimatedWeeks) || 3)),
        milestoneDescription: String(rp.milestoneDescription || `Complete ${rp.title}`).slice(0, 300),
        topics,
        assessmentStatus: 'locked',
        assessmentId: null,
        completedAt: null,
        goalId: null,
      });
    }
  }

  if (phases.length === 0) {
    throw new Error('No valid phases after validation');
  }

  return {
    id: genId(),
    topic: input.topic,
    phases,
    totalLessons,
    totalEstimatedHours: Math.round((totalMinutes / 60) * 10) / 10,
    generatedAt: new Date().toISOString(),
    generatedBy: 'ai',
  };
}

// ── Fallback Template Curricula ──

function buildTemplateCurriculum(input: WizardInput): GeneratedCurriculum {
  const templates = getTemplateForDomain(input.domain, input.topic);
  const phases: CurriculumPhase[] = [];
  let totalLessons = 0;
  let totalMinutes = 0;

  for (let pi = 0; pi < templates.length; pi++) {
    const tmpl = templates[pi];
    const topics: CurriculumTopic[] = [];
    const lessons: CurriculumLesson[] = [];

    for (let li = 0; li < tmpl.lessons.length; li++) {
      const lesson = tmpl.lessons[li];
      totalLessons++;
      totalMinutes += lesson.estimatedMinutes;

      lessons.push({
        id: genId(),
        title: lesson.title,
        description: lesson.description,
        estimatedMinutes: lesson.estimatedMinutes,
        content: lesson.content,
        keyPoints: lesson.keyPoints,
        phaseIndex: pi,
        topicIndex: 0,
        lessonIndex: li,
        scheduledDate: null,
        completedAt: null,
        xpReward: 50,
      });
    }

    topics.push({
      id: genId(),
      title: tmpl.title,
      lessons,
    });

    phases.push({
      id: genId(),
      title: tmpl.title,
      description: tmpl.description,
      lessonCount: lessons.length,
      estimatedWeeks: tmpl.estimatedWeeks,
      milestoneDescription: tmpl.milestone,
      topics,
      assessmentStatus: 'locked',
      assessmentId: null,
      completedAt: null,
      goalId: null,
    });
  }

  return {
    id: genId(),
    topic: input.topic,
    phases,
    totalLessons,
    totalEstimatedHours: Math.round((totalMinutes / 60) * 10) / 10,
    generatedAt: new Date().toISOString(),
    generatedBy: 'fallback',
  };
}

interface TemplatePhase {
  title: string;
  description: string;
  estimatedWeeks: number;
  milestone: string;
  lessons: {
    title: string;
    description: string;
    estimatedMinutes: number;
    content: string;
    keyPoints: string[];
  }[];
}

function getTemplateForDomain(domain: GoalDomain, topic: string): TemplatePhase[] {
  switch (domain) {
    case 'fitness':
      return [
        {
          title: 'Foundations',
          description: 'Build a solid base with fundamental movement patterns and nutrition basics.',
          estimatedWeeks: 3,
          milestone: 'Understand proper form for key exercises and have a nutrition plan',
          lessons: [
            {
              title: 'Basics of Movement',
              description: 'Learn fundamental movement patterns that form the basis of all exercise.',
              estimatedMinutes: 30,
              content: `# Basics of Movement\n\nEvery fitness journey begins with understanding how your body moves. Before lifting heavy weights or running marathons, you need to master the fundamental movement patterns.\n\n## The Five Foundational Movements\n\n1. **Push** — Moving weight away from your body (push-ups, overhead press)\n2. **Pull** — Drawing weight toward you (rows, pull-ups)\n3. **Squat** — Bending at the hips and knees (bodyweight squats, goblet squats)\n4. **Hinge** — Bending at the hips while keeping legs mostly straight (deadlifts, good mornings)\n5. **Carry** — Holding weight while moving (farmer walks, suitcase carries)\n\n## Why Form Matters\n\nProper form does three things:\n- **Prevents injury** by distributing load across the right muscles and joints\n- **Maximises results** by targeting the intended muscles effectively\n- **Builds confidence** so you can progress safely\n\n## Your First Practice Session\n\nTry each movement for 10 repetitions with no weight:\n- 10 push-ups (knees down if needed)\n- 10 bodyweight squats\n- 10 hip hinges (hands on thighs, push hips back)\n- Hold a plank for 20 seconds\n\n> Start where you are, not where you think you should be. Consistency beats intensity every time.\n\n## Key Takeaway\n\nMaster these five patterns and you have the vocabulary to build any workout program. Every exercise is a variation of one of these movements.`,
              keyPoints: ['Five foundational movement patterns', 'Form prevents injury and maximises results', 'Start with bodyweight before adding load', 'Consistency beats intensity'],
            },
            {
              title: 'Nutrition 101',
              description: 'Understand macronutrients, calories, and how to fuel your body for performance.',
              estimatedMinutes: 30,
              content: `# Nutrition 101\n\nYour body is a machine, and food is the fuel. Understanding the basics of nutrition will accelerate your fitness results more than any supplement ever could.\n\n## The Three Macronutrients\n\n### Protein\nBuilds and repairs muscle tissue. Aim for 1.6-2.2g per kg of body weight daily.\n- Sources: chicken, fish, eggs, legumes, tofu, Greek yogurt\n\n### Carbohydrates\nYour body's preferred energy source, especially for high-intensity exercise.\n- Sources: rice, oats, sweet potato, fruits, whole grains\n\n### Fats\nEssential for hormones, brain function, and absorbing vitamins.\n- Sources: olive oil, avocado, nuts, fatty fish\n\n## Calories: The Energy Equation\n\n- **Maintenance**: calories in = calories out (weight stays the same)\n- **Surplus**: eat more than you burn (gain weight/muscle)\n- **Deficit**: eat less than you burn (lose fat)\n\nA good starting point: multiply your body weight in kg by 30 for approximate maintenance calories.\n\n## Practical Tips\n\n1. **Eat protein at every meal** — it keeps you full and supports muscle\n2. **Drink water** — aim for 2-3 litres daily\n3. **Don't eliminate food groups** — balance is sustainable\n4. **Prep meals in advance** — reduces decision fatigue\n\n## Timing Matters (A Little)\n\nEat a meal with protein and carbs 1-2 hours before training, and another within 2 hours after. Beyond that, total daily intake matters far more than timing.`,
              keyPoints: ['Three macronutrients: protein, carbs, fats', 'Calories determine weight change', 'Protein supports muscle building and recovery', 'Consistency in nutrition trumps perfection'],
            },
            {
              title: 'Building Consistency',
              description: 'Create sustainable habits that keep you training long-term.',
              estimatedMinutes: 25,
              content: `# Building Consistency\n\nThe best training programme in the world is useless if you do not follow it. Consistency is the single most important factor in fitness success.\n\n## The Habit Loop\n\nEvery habit has three parts:\n1. **Cue** — the trigger (alarm goes off, gym bag by the door)\n2. **Routine** — the behaviour (go to the gym, do the workout)\n3. **Reward** — the payoff (endorphins, checking off a habit, a good meal)\n\n## Start Absurdly Small\n\nDo not aim for 90-minute sessions five days a week. Start with:\n- **Week 1-2**: 15 minutes, 3 times per week\n- **Week 3-4**: 25 minutes, 3 times per week\n- **Month 2**: 30-40 minutes, 3-4 times per week\n\nThe goal is to make showing up automatic before worrying about intensity.\n\n## Remove Friction\n\n- Lay out gym clothes the night before\n- Choose a gym close to your route (home or work)\n- Have a fallback plan: if you cannot get to the gym, do a 10-minute bodyweight circuit at home\n\n## Track Your Progress\n\nUse LifeOS to:\n- Log workouts as habits\n- Track streaks for motivation\n- Review weekly in your journal\n\n## When You Miss a Day\n\nOne missed session does not ruin anything. The rule is simple: **never miss twice in a row**. Get back on track the very next day, even if it is just a 10-minute walk.\n\n> You do not rise to the level of your goals. You fall to the level of your systems. — James Clear`,
              keyPoints: ['Start with small, achievable sessions', 'Use the habit loop: cue, routine, reward', 'Remove friction from your routine', 'Never miss twice in a row'],
            },
          ],
        },
        {
          title: 'Building Strength',
          description: 'Progress from bodyweight basics to structured strength training.',
          estimatedWeeks: 4,
          milestone: 'Complete a full week of structured strength training with proper form',
          lessons: [
            {
              title: 'Progressive Overload',
              description: 'The core principle behind getting stronger — gradually increasing demands.',
              estimatedMinutes: 30,
              content: `# Progressive Overload\n\nProgressive overload is the fundamental principle of strength training. To get stronger, you must gradually increase the demands on your body over time.\n\n## How to Apply Progressive Overload\n\nThere are several ways to increase difficulty:\n\n1. **Add weight** — The most obvious method. Add 1-2.5kg to the bar each session or week.\n2. **Add reps** — If you did 3 sets of 8, aim for 3 sets of 10 next time.\n3. **Add sets** — Go from 2 sets to 3, then 4.\n4. **Slow the tempo** — Take 3 seconds to lower the weight instead of 1.\n5. **Reduce rest** — Cut rest periods from 120s to 90s.\n\n## A Practical Example\n\n**Week 1**: Squat 20kg x 8 reps x 3 sets\n**Week 2**: Squat 20kg x 10 reps x 3 sets\n**Week 3**: Squat 22.5kg x 8 reps x 3 sets\n**Week 4**: Squat 22.5kg x 10 reps x 3 sets\n\n## When to Deload\n\nEvery 4-6 weeks, take a lighter week (deload). Reduce weight by 40% and focus on form. This allows your body to fully recover and come back stronger.\n\n## Common Mistakes\n\n- Adding too much weight too fast (ego lifting)\n- Sacrificing form for more reps\n- Not tracking workouts (you cannot progress what you do not measure)\n\n## Key Rule\n\nIf you can complete all prescribed sets and reps with good form, increase the difficulty next session. If you cannot, repeat the same load until you can.`,
              keyPoints: ['Gradually increase demands over time', 'Multiple methods: weight, reps, sets, tempo', 'Deload every 4-6 weeks', 'Track every workout to measure progress'],
            },
            {
              title: 'Your First Programme',
              description: 'A simple, effective 3-day full-body programme for beginners.',
              estimatedMinutes: 35,
              content: `# Your First Programme\n\nA well-structured programme removes guesswork. Here is a simple 3-day full-body routine designed for beginners.\n\n## The Programme (3 Days Per Week)\n\n### Day A\n| Exercise | Sets x Reps |\n|----------|------------|\n| Squat | 3 x 8 |\n| Bench Press | 3 x 8 |\n| Barbell Row | 3 x 8 |\n| Plank | 3 x 30s |\n\n### Day B\n| Exercise | Sets x Reps |\n|----------|------------|\n| Deadlift | 3 x 5 |\n| Overhead Press | 3 x 8 |\n| Lat Pulldown | 3 x 10 |\n| Farmers Walk | 3 x 30m |\n\nAlternate Day A and Day B: Mon (A), Wed (B), Fri (A), Mon (B), etc.\n\n## Warm-Up (5 Minutes)\n\n1. 2 minutes light cardio (rowing, walking)\n2. 10 arm circles each direction\n3. 10 bodyweight squats\n4. 10 hip hinges\n5. 1 set of each exercise with an empty bar\n\n## Rest Between Sets\n\n- Compound exercises (squat, deadlift, bench): 2-3 minutes\n- Isolation exercises: 60-90 seconds\n\n## How Long Will This Take?\n\nIncluding warm-up, about 45-50 minutes per session.\n\n## When to Change Programmes\n\nStick with this for at least 8-12 weeks. If you are still making progress (adding weight or reps), there is no reason to change. Programme-hopping is the enemy of progress.`,
              keyPoints: ['3-day full-body split is ideal for beginners', 'Alternate between Day A and Day B', 'Always warm up before lifting', 'Stick with a programme for at least 8-12 weeks'],
            },
            {
              title: 'Recovery and Sleep',
              description: 'Understand why recovery is when you actually get stronger.',
              estimatedMinutes: 25,
              content: `# Recovery and Sleep\n\nYou do not get stronger during your workout. You get stronger during recovery. Training creates the stimulus; rest is when adaptation happens.\n\n## The Recovery Triangle\n\n### 1. Sleep (The Most Important)\n- Aim for 7-9 hours per night\n- Growth hormone peaks during deep sleep\n- Poor sleep = poor recovery = poor performance\n- Tips: consistent bedtime, dark room, no screens 30 min before bed\n\n### 2. Nutrition\n- Post-workout protein within 2 hours\n- Adequate total daily calories\n- Micronutrients from fruits and vegetables\n- Stay hydrated (dehydration impairs recovery by up to 20%)\n\n### 3. Stress Management\n- Chronic stress elevates cortisol, which blocks muscle recovery\n- Use LifeOS journal for reflection\n- 10 minutes of meditation or deep breathing\n- Active rest: walking, light stretching, yoga\n\n## Active Recovery Days\n\nOn non-training days, do not just sit on the couch:\n- 20-30 minute walk\n- Light stretching or yoga\n- Foam rolling tight muscles\n\n## Signs of Overtraining\n\n- Persistent fatigue that rest does not fix\n- Strength going backwards\n- Poor sleep despite being tired\n- Getting sick frequently\n- Loss of motivation\n\nIf you notice these signs, take an extra rest day or a full deload week. More is not always better.`,
              keyPoints: ['Recovery is when strength gains occur', 'Sleep 7-9 hours for optimal recovery', 'Manage stress to support adaptation', 'Watch for overtraining signs'],
            },
          ],
        },
        {
          title: 'Advanced Training',
          description: 'Intermediate techniques to break plateaus and specialise.',
          estimatedWeeks: 4,
          milestone: 'Successfully implement periodisation and break through a plateau',
          lessons: [
            {
              title: 'Periodisation Basics',
              description: 'Organise your training into phases for long-term progress.',
              estimatedMinutes: 30,
              content: `# Periodisation Basics\n\nPeriodisation is the systematic planning of training into phases. It prevents plateaus, reduces injury risk, and ensures long-term progress.\n\n## Types of Periodisation\n\n### Linear Periodisation\nProgressively increase intensity while decreasing volume:\n- **Phase 1 (4 weeks)**: High volume, moderate weight (4x12 at 60%)\n- **Phase 2 (4 weeks)**: Medium volume, heavier weight (4x8 at 70%)\n- **Phase 3 (4 weeks)**: Low volume, heavy weight (5x3 at 85%)\n- **Deload (1 week)**: Light recovery\n\n### Undulating Periodisation\nVary intensity within each week:\n- **Monday**: Heavy (5x3)\n- **Wednesday**: Moderate (3x8)\n- **Friday**: Light/volume (3x12)\n\n## Which Should You Choose?\n\nFor most intermediate lifters, undulating periodisation works well because:\n- More variety keeps training interesting\n- You practise different rep ranges regularly\n- Recovery is built into the week structure\n\n## Tracking Your Periodisation\n\nUse a simple spreadsheet or LifeOS notes:\n- Record planned vs actual sets, reps, weight\n- Note how each session felt (RPE 1-10)\n- Review every 4 weeks and adjust\n\n## The 10% Rule\n\nNever increase total weekly volume (sets x reps x weight) by more than 10% from one week to the next. Gradual increases are sustainable; jumps cause injuries.`,
              keyPoints: ['Periodisation prevents plateaus', 'Linear and undulating are common methods', 'Track planned vs actual performance', 'Never increase weekly volume by more than 10%'],
            },
            {
              title: 'Breaking Plateaus',
              description: 'Strategies for when progress stalls.',
              estimatedMinutes: 30,
              content: `# Breaking Plateaus\n\nEvery lifter hits a wall eventually. When your numbers stop going up despite consistent effort, it is time to employ specific strategies.\n\n## Diagnose the Problem First\n\nBefore changing your programme, check these basics:\n1. **Sleep**: Are you getting 7+ hours consistently?\n2. **Nutrition**: Are you eating enough protein and total calories?\n3. **Stress**: Has life stress increased recently?\n4. **Recovery**: Are you training too frequently?\n\nOften, a plateau is a recovery problem, not a programming problem.\n\n## Strategy 1: Change the Stimulus\n\nYour body adapts to repeated stimuli. Swap exercises:\n- Barbell bench press stalled? Try dumbbell bench or incline press\n- Squat stuck? Try pause squats or front squats\n- Same movement pattern, different variation\n\n## Strategy 2: Manipulate Volume\n\nIf you have been doing 3x8, try:\n- **More sets, fewer reps**: 5x5 with heavier weight\n- **Fewer sets, more reps**: 2x15 with lighter weight\n- **Drop sets**: Do your working weight, then immediately reduce by 20% and do more reps\n\n## Strategy 3: Strategic Deload\n\nTake a full week at 50% of your normal weight. Sometimes your body just needs a complete reset.\n\n## Strategy 4: Improve Weak Points\n\nIdentify what is limiting your lift:\n- Squat failing at the bottom? Add pause squats and leg press\n- Bench press stalling at lockout? Add tricep work\n- Deadlift weak off the floor? Add deficit deadlifts`,
              keyPoints: ['Check basics (sleep, nutrition, stress) first', 'Change exercise variations to provide new stimulus', 'Manipulate volume and intensity', 'Target specific weak points'],
            },
            {
              title: 'Training for Life',
              description: 'Build a sustainable long-term fitness practice.',
              estimatedMinutes: 25,
              content: `# Training for Life\n\nThe ultimate goal is not a number on the bar. It is building a practice you can sustain for decades, one that keeps you healthy, strong, and energised.\n\n## The Longevity Mindset\n\nShift from "how much can I lift?" to "how well can I move?"\n- Prioritise joint health and mobility alongside strength\n- Include at least one flexibility session per week\n- Listen to your body — train hard when you feel good, pull back when you do not\n\n## The Minimum Effective Dose\n\nResearch shows you can maintain most fitness gains with surprisingly little:\n- **2 sessions per week** maintains strength for most people\n- **3 sessions** is optimal for continued progress\n- **4+ sessions** is for those with specific performance goals\n\n## Building Your Own Programme\n\nNow that you understand the fundamentals, you can design your own training:\n1. Choose a split (full body, upper/lower, push/pull/legs)\n2. Select 4-6 exercises per session covering all movement patterns\n3. Apply progressive overload\n4. Include periodisation (vary intensity each week or each block)\n5. Schedule deloads every 4-6 weeks\n\n## Beyond the Gym\n\nTrue fitness extends beyond structured training:\n- Walk 8,000-10,000 steps daily\n- Take the stairs\n- Play sports or do recreational activities\n- Stretch while watching television\n\n## Your Fitness Journey\n\nYou now have the knowledge to train effectively for life. The path is not always linear — there will be setbacks, injuries, and busy periods. What matters is that you always come back. Fitness is not a destination; it is a practice.`,
              keyPoints: ['Longevity mindset over short-term numbers', '2-3 sessions per week maintains most gains', 'Design your own programme using fundamentals', 'Fitness is a lifelong practice, not a destination'],
            },
          ],
        },
      ];

    case 'music':
      return [
        {
          title: 'Fundamentals',
          description: 'Learn to read music, understand rhythm, and build basic technique.',
          estimatedWeeks: 4,
          milestone: 'Read simple sheet music and play basic melodies',
          lessons: [
            {
              title: 'Reading Music',
              description: 'Understanding the staff, clefs, notes, and time signatures.',
              estimatedMinutes: 30,
              content: `# Reading Music\n\nMusic notation is a language. Once you can read it, you can play any piece of written music on any instrument.\n\n## The Staff\n\nThe **staff** consists of 5 horizontal lines. Notes are placed on or between these lines. Each position represents a different pitch.\n\n## Clefs\n\n- **Treble Clef** (G clef): Used for higher-pitched instruments and the right hand on piano. Notes on lines: E, G, B, D, F ("Every Good Boy Does Fine")\n- **Bass Clef** (F clef): Used for lower-pitched instruments and the left hand on piano. Notes on lines: G, B, D, F, A ("Good Boys Do Fine Always")\n\n## Note Values\n\n| Note | Beats (in 4/4 time) |\n|------|---------------------|\n| Whole note | 4 beats |\n| Half note | 2 beats |\n| Quarter note | 1 beat |\n| Eighth note | 1/2 beat |\n| Sixteenth note | 1/4 beat |\n\n## Time Signatures\n\nThe two numbers at the start of a piece:\n- **Top number**: How many beats per measure\n- **Bottom number**: Which note value gets one beat\n\nCommon time signatures: 4/4, 3/4 (waltz), 6/8\n\n## Practice\n\nStart by identifying notes on the treble clef staff. Write out the letter names below each note. Speed will come with repetition.`,
              keyPoints: ['The staff has 5 lines for placing notes', 'Treble clef for high notes, bass clef for low', 'Note values determine how long to hold each note', 'Time signatures define the rhythm structure'],
            },
            {
              title: 'Basic Technique',
              description: 'Proper posture, hand position, and fundamental playing technique.',
              estimatedMinutes: 35,
              content: `# Basic Technique\n\nGood technique is the foundation of musical expression. Poor habits formed early become very difficult to fix later.\n\n## Posture\n\nWhether sitting or standing:\n- Keep your back straight but relaxed\n- Shoulders down and back, not hunched\n- Arms relaxed at your sides\n- Breathe naturally — tension is the enemy of good technique\n\n## Hand Position (Keyboard/Piano)\n\n- Curve your fingers as if holding a small ball\n- Fingertips should strike the keys, not the pads\n- Thumbs rest on the side, slightly angled\n- Wrists level with the keyboard — not drooping or raised\n\n## Hand Position (Guitar/String)\n\n- Left hand: thumb behind the neck, fingers curved over the fretboard\n- Right hand: relaxed wrist, consistent picking angle\n- Keep unused fingers close to the strings, ready to play\n\n## The Metronome Is Your Best Friend\n\nAlways practise with a metronome:\n- Start slow (60-80 BPM)\n- Only speed up when you can play perfectly at the current tempo\n- If you make mistakes at a tempo, slow back down by 10 BPM\n\n## Practice Structure\n\nA good 30-minute practice session:\n1. **Warm-up** (5 min): scales or simple exercises\n2. **Technique** (10 min): focused exercises on specific skills\n3. **Repertoire** (10 min): working on pieces\n4. **Fun** (5 min): play whatever you enjoy\n\nQuality beats quantity. Thirty focused minutes beat two unfocused hours.`,
              keyPoints: ['Good posture prevents injury and improves sound', 'Curved fingers for keyboard, relaxed hands for all instruments', 'Always practise with a metronome', 'Structure practice: warm-up, technique, repertoire, fun'],
            },
            {
              title: 'Your First Songs',
              description: 'Learn to play simple, recognisable melodies.',
              estimatedMinutes: 30,
              content: `# Your First Songs\n\nThe best way to stay motivated is to play real music as soon as possible. Here are strategies for learning your first songs.\n\n## Choosing Your First Piece\n\nLook for songs with:\n- Simple rhythm (mostly quarter and half notes)\n- Small note range (stay within 5-6 notes)\n- Slow tempo\n- A melody you already know (this helps with timing)\n\n## Learning Process\n\n### Step 1: Listen First\nListen to the song several times. Sing or hum the melody. Know how it should sound before you try to play it.\n\n### Step 2: Hands Separately\nIf using keyboard, learn the right hand (melody) first, then the left hand (accompaniment). Do not try both together until each hand is comfortable.\n\n### Step 3: Break It Into Sections\nDo not try to learn the whole song at once:\n- Learn bars 1-4 until comfortable\n- Learn bars 5-8\n- Connect sections 1-4 and 5-8\n- Continue building\n\n### Step 4: Slow Practice\nPlay at half speed (or slower). Use a metronome. Speed is the last thing you add.\n\n## Suggested First Songs\n\n- "Mary Had a Little Lamb" — 3 notes, simple rhythm\n- "Ode to Joy" (Beethoven) — stepwise motion, recognisable\n- "Twinkle Twinkle Little Star" — simple melody, teaches finger jumps\n- "Amazing Grace" — beautiful, slow, and lyrical\n\n## Celebrate Small Wins\n\nPlaying your first recognisable melody is a genuine achievement. Record yourself and compare to a month later — the progress will be remarkable.`,
              keyPoints: ['Choose songs with simple rhythm and small note range', 'Listen before playing — know how it should sound', 'Break songs into small sections', 'Play slowly with a metronome before speeding up'],
            },
          ],
        },
        {
          title: 'Developing Skills',
          description: 'Expand your repertoire with chords, scales, and more complex pieces.',
          estimatedWeeks: 4,
          milestone: 'Play songs with chords and understand basic music theory',
          lessons: [
            {
              title: 'Chords and Harmony',
              description: 'Understanding how chords are built and used.',
              estimatedMinutes: 35,
              content: `# Chords and Harmony\n\nChords are the building blocks of harmony. Understanding them opens the door to playing accompaniments, songwriting, and improvisation.\n\n## What Is a Chord?\n\nA chord is three or more notes played simultaneously. The most basic chords are **triads**, built by stacking thirds.\n\n## Major and Minor Triads\n\n- **Major triad**: root + major third + perfect fifth (sounds bright, happy)\n  - C major: C - E - G\n- **Minor triad**: root + minor third + perfect fifth (sounds dark, sad)\n  - C minor: C - Eb - G\n\n## The Most Important Chords\n\nIn any key, these three chords cover most popular music:\n- **I** (tonic): Home base\n- **IV** (subdominant): Creates movement\n- **V** (dominant): Creates tension, wants to resolve to I\n\nIn C major: C (I), F (IV), G (V)\n\n## Common Chord Progressions\n\n| Progression | Example in C | Used In |\n|------------|-------------|--------|\n| I - IV - V | C - F - G | Rock, country |\n| I - V - vi - IV | C - G - Am - F | Pop (most common!) |\n| I - vi - IV - V | C - Am - F - G | 50s/60s pop |\n| ii - V - I | Dm - G - C | Jazz |\n\n## Practice\n\n1. Learn C, F, G, and Am chords on your instrument\n2. Practice switching between them slowly\n3. Play the I - V - vi - IV progression with a steady rhythm\n4. Try singing a melody over the chords`,
              keyPoints: ['Chords are three or more notes played together', 'Major sounds bright, minor sounds dark', 'I-IV-V covers most popular music', 'I-V-vi-IV is the most common pop progression'],
            },
            {
              title: 'Scales and Keys',
              description: 'The system behind all Western music.',
              estimatedMinutes: 30,
              content: `# Scales and Keys\n\nScales are the DNA of music. Every melody and chord comes from a scale. Understanding scales gives you the map to navigate any piece of music.\n\n## The Major Scale\n\nThe major scale follows this pattern of whole steps (W) and half steps (H):\n**W - W - H - W - W - W - H**\n\nC major: C D E F G A B C (all white keys on piano)\n\n## The Minor Scale (Natural)\n\nThe natural minor scale pattern:\n**W - H - W - W - H - W - W**\n\nA minor: A B C D E F G A (also all white keys, starting from A)\n\n## What Is a Key?\n\nA key tells you which notes and chords belong together:\n- **Key of C major**: no sharps or flats\n- **Key of G major**: one sharp (F#)\n- **Key of F major**: one flat (Bb)\n\n## The Circle of Fifths\n\nA visual tool showing how keys relate to each other. Moving clockwise adds one sharp; counter-clockwise adds one flat.\n\n## Why Scales Matter for Practice\n\nPractising scales:\n1. Builds finger dexterity and speed\n2. Teaches your ear to recognise intervals\n3. Prepares you for sight-reading (you know what notes to expect)\n4. Forms the basis of improvisation\n\n## Daily Scale Practice\n\n- Play each scale ascending and descending, 2 octaves\n- Start at 60 BPM, increase by 5 BPM when comfortable\n- Practice in all 12 keys (work through the circle of fifths)\n- Vary the rhythm: straight eighths, triplets, swing`,
              keyPoints: ['Major scale: W-W-H-W-W-W-H pattern', 'Keys group notes and chords that sound good together', 'Circle of fifths shows key relationships', 'Daily scale practice builds technique and ear training'],
            },
            {
              title: 'Rhythm and Groove',
              description: 'Developing a strong sense of time and rhythmic feel.',
              estimatedMinutes: 25,
              content: `# Rhythm and Groove\n\nYou can play all the right notes, but if your timing is off, it will not sound like music. Rhythm is arguably more important than pitch.\n\n## Subdivisions\n\nFeel the beat in smaller units:\n- **Quarter notes**: 1, 2, 3, 4\n- **Eighth notes**: 1-and, 2-and, 3-and, 4-and\n- **Sixteenth notes**: 1-e-and-a, 2-e-and-a, 3-e-and-a, 4-e-and-a\n- **Triplets**: 1-trip-let, 2-trip-let, 3-trip-let, 4-trip-let\n\n## Developing Internal Pulse\n\nExercises to internalise rhythm:\n1. **Metronome on 2 and 4**: Set metronome to click on beats 2 and 4 only. You provide 1 and 3. This develops a strong backbeat feel.\n2. **Silent beats**: Set metronome, clap on beat 1 only. Feel the other beats without hearing them.\n3. **Walking practice**: Walk in time to music, matching your steps to the beat.\n\n## Syncopation\n\nPlaying on the off-beats (the "ands") creates energy and forward motion. Much of pop, funk, and jazz relies on syncopation.\n\nPractice: clap on the "ands" while tapping your foot on the beats.\n\n## Groove vs. Precision\n\nA perfectly metronomic performance can sound lifeless. Real groove has tiny human imperfections — notes slightly ahead or behind the beat. This is called **feel**. It cannot be taught directly, but it develops naturally through playing with recordings and other musicians.\n\n## Practice Tip\n\nPlay along with recordings. This trains your ear and timing simultaneously. Start with simple songs and work up to more complex rhythms.`,
              keyPoints: ['Subdivisions: quarter, eighth, sixteenth, triplets', 'Internalise pulse by practising with limited metronome clicks', 'Syncopation creates energy and forward motion', 'Play along with recordings to develop groove'],
            },
          ],
        },
        {
          title: 'Performance',
          description: 'Prepare for performing, build stage confidence, and express yourself.',
          estimatedWeeks: 4,
          milestone: 'Perform a complete piece confidently for an audience',
          lessons: [
            {
              title: 'Preparing a Performance Piece',
              description: 'How to polish a song from rough to performance-ready.',
              estimatedMinutes: 30,
              content: `# Preparing a Performance Piece\n\nPerforming a piece well requires more than just knowing the notes. It takes deliberate preparation to make a piece performance-ready.\n\n## The Preparation Timeline\n\n### Weeks 1-2: Learning Phase\n- Learn the notes and rhythms section by section\n- Play slowly with a metronome\n- Identify difficult passages and isolate them\n\n### Weeks 3-4: Polishing Phase\n- Bring up to performance tempo gradually\n- Work on dynamics (loud, soft, crescendo, diminuendo)\n- Focus on musical expression and phrasing\n\n### Week 5: Performance Phase\n- Run the complete piece without stopping (even if mistakes happen)\n- Record yourself and listen back critically\n- Practice performing for friends or family\n\n## Dealing with Difficult Passages\n\n1. **Isolate**: Extract the difficult bars\n2. **Slow down**: Play at 50% tempo until perfect\n3. **Loop**: Repeat 10 times correctly in a row\n4. **Context**: Play the bars before and after the difficult section\n5. **Integrate**: Put it back into the full piece\n\n## Musical Expression\n\nOnce notes are secure, add musicality:\n- **Dynamics**: Vary volume to create shape\n- **Phrasing**: Group notes into musical sentences\n- **Tone**: Adjust touch/breath/bow pressure for different colours\n- **Rubato**: Slight tempo flexibility for emotional expression\n\n## Recording Yourself\n\nRecord every run-through. You will hear things you miss while playing. Compare recordings week to week to track improvement.`,
              keyPoints: ['Allow 4-5 weeks to prepare a performance piece', 'Isolate, slow down, loop, and reintegrate difficult passages', 'Add dynamics and expression after notes are secure', 'Record yourself regularly to track progress'],
            },
            {
              title: 'Stage Confidence',
              description: 'Managing performance anxiety and building stage presence.',
              estimatedMinutes: 25,
              content: `# Stage Confidence\n\nPerformance anxiety is completely normal. Even professional musicians experience it. The key is not eliminating nervousness but channelling it into energy.\n\n## Understanding Performance Anxiety\n\nAdrenaline causes:\n- Increased heart rate\n- Sweaty palms\n- Dry mouth\n- Racing thoughts\n- Shaky hands\n\nThese are the same sensations you feel when excited. Reframe: "I am not nervous, I am excited."\n\n## Preparation Reduces Anxiety\n\nThe number one cure for stage fright is being well-prepared:\n- Know your piece so well you could play it while having a conversation\n- Practice performing, not just practising — run the piece from start to finish without stopping\n- Simulate performance conditions: dress up, set up an audience (even stuffed animals count)\n\n## On the Day\n\n### Before\n- Warm up your body: stretch, walk around\n- Warm up your instrument: play scales and familiar passages\n- Breathe deeply: 4 counts in, 4 counts hold, 4 counts out\n\n### During\n- Focus on the music, not the audience\n- If you make a mistake, keep going — the audience likely did not notice\n- Project confidence through posture\n- Enjoy the moment — you have prepared for this\n\n### After\n- Reflect on what went well (not just what went wrong)\n- Note one thing to improve for next time\n- Celebrate the achievement of performing\n\n## The Exposure Effect\n\nThe more you perform, the less scary it becomes. Seek small opportunities: open mic nights, playing for friends, recording videos for social media.`,
              keyPoints: ['Reframe nervousness as excitement', 'Over-prepare to reduce anxiety', 'If you make a mistake during performance, keep going', 'Seek frequent small performance opportunities'],
            },
            {
              title: 'Musical Expression',
              description: 'Moving beyond notes to create emotional, compelling performances.',
              estimatedMinutes: 30,
              content: `# Musical Expression\n\nPlaying the right notes is the beginning. Musical expression is what turns a recitation into art, and a player into a musician.\n\n## Dynamics\n\nDynamics are the volume changes that give music shape:\n- **pp** (pianissimo): very soft\n- **p** (piano): soft\n- **mp** (mezzo piano): moderately soft\n- **mf** (mezzo forte): moderately loud\n- **f** (forte): loud\n- **ff** (fortissimo): very loud\n- **crescendo**: gradually getting louder\n- **diminuendo**: gradually getting softer\n\n## Phrasing\n\nMusic is like speech — it has sentences, commas, and full stops:\n- Identify the musical phrases (usually 4 or 8 bars)\n- Shape each phrase: slight crescendo toward the peak, diminuendo at the end\n- Breathe between phrases (even if you are not a wind player — lift slightly)\n\n## Articulation\n\n- **Legato**: smooth and connected\n- **Staccato**: short and detached\n- **Accent**: emphasised note\n- **Tenuto**: held for full value\n\nVariety in articulation adds texture and interest.\n\n## Interpretation\n\nTwo musicians can play the same notes and sound completely different. Your interpretation is shaped by:\n- Listening to multiple recordings of the same piece\n- Understanding the composer's era and intentions\n- Bringing your own emotional experience to the music\n- Experimenting with different approaches\n\n## The Ultimate Goal\n\nWhen you stop thinking about notes and technique, and start thinking about the story you are telling — that is when you become a musician. Technical skill is the vehicle; expression is the journey.`,
              keyPoints: ['Dynamics give music shape and emotion', 'Phrasing groups notes into musical sentences', 'Articulation adds texture and variety', 'Expression transforms a player into a musician'],
            },
          ],
        },
      ];

    case 'language':
      return [
        {
          title: 'Survival Basics',
          description: 'Essential phrases, greetings, numbers, and survival vocabulary.',
          estimatedWeeks: 3,
          milestone: 'Handle basic greetings, introductions, and everyday situations',
          lessons: [
            {
              title: 'Greetings and Introductions',
              description: 'Learn to say hello, introduce yourself, and ask basic questions.',
              estimatedMinutes: 25,
              content: `# Greetings and Introductions\n\nThe very first thing you need in any language is the ability to greet people and introduce yourself. These phrases will be your most-used vocabulary.\n\n## Essential Greetings\n\nLearn the equivalents of:\n- Hello / Hi\n- Good morning / Good afternoon / Good evening\n- How are you?\n- I am fine, thank you\n- Goodbye / See you later\n\n## Introducing Yourself\n\nKey phrases to master:\n- My name is...\n- I am from...\n- Nice to meet you\n- I am learning [language]\n- I speak a little [language]\n\n## Asking Basic Questions\n\n- What is your name?\n- Where are you from?\n- Do you speak English?\n- Can you help me?\n- Where is...?\n\n## Pronunciation Tips\n\n1. **Listen first**: Before trying to speak, listen to native speakers say each phrase 10 times\n2. **Record yourself**: Compare your pronunciation to native speakers\n3. **Slow down**: Speed will come naturally — accuracy first\n4. **Mouth shape**: Watch videos of native speakers and copy their mouth movements\n\n## Practice Method: Shadowing\n\nPlay audio of a native speaker and repeat immediately after them, trying to match their:\n- Pronunciation\n- Rhythm\n- Intonation (the melody of speech)\n\nDo this for 10 minutes daily with greetings and introductions.\n\n## Cultural Note\n\nGreetings vary enormously across cultures. Some use formal/informal distinctions (like French tu/vous). Research the customs of the culture whose language you are learning.`,
              keyPoints: ['Master hello, goodbye, and introduction phrases first', 'Shadowing native speakers improves pronunciation', 'Listen before speaking — accuracy before speed', 'Understand cultural greeting customs'],
            },
            {
              title: 'Numbers and Time',
              description: 'Count, tell time, and discuss dates and quantities.',
              estimatedMinutes: 25,
              content: `# Numbers and Time\n\nNumbers are used constantly: prices, addresses, phone numbers, time, dates. Master them early and everything else becomes easier.\n\n## Numbers 1-100\n\nLearn in stages:\n- **1-10**: Foundation — memorise these perfectly\n- **11-20**: Often irregular in many languages\n- **21-100**: Once you know the tens (20, 30, 40...) and 1-9, you can combine them\n\n## Telling Time\n\nKey phrases:\n- What time is it?\n- It is [number] o'clock\n- Half past / Quarter past / Quarter to\n- In the morning / In the afternoon / In the evening\n\n## Days and Months\n\n- Monday through Sunday\n- January through December\n- Today, yesterday, tomorrow\n- This week, next week, last week\n\n## Practical Numbers\n\nPractice these real-world scenarios:\n- **Shopping**: How much does this cost? It costs...\n- **Restaurant**: Table for [number], the bill please\n- **Transport**: Platform/Gate number...\n- **Phone**: My number is...\n\n## Memory Technique: Number Chunking\n\nDo not try to memorise 1-100 in one sitting:\n- Day 1: 1-10\n- Day 2: Review 1-10, learn 11-20\n- Day 3: Review 1-20, learn 21-30\n- Continue until 100\n\nUse flashcards (physical or digital) and test yourself randomly, not in order.`,
              keyPoints: ['Learn numbers in stages: 1-10, 11-20, then tens', 'Practice numbers in real contexts: prices, time, dates', 'Chunk learning over multiple days', 'Test yourself randomly, not in sequence'],
            },
            {
              title: 'Essential Phrases',
              description: 'Survival phrases for travel, restaurants, and getting help.',
              estimatedMinutes: 30,
              content: `# Essential Phrases\n\nThese phrases will get you through most everyday situations in a foreign country. Memorise them thoroughly — they are your survival toolkit.\n\n## Getting Help\n\n- I do not understand\n- Can you repeat that?\n- Can you speak more slowly?\n- How do you say [X] in [language]?\n- I need help\n\n## Directions\n\n- Where is the bathroom?\n- Where is the train station / bus stop / airport?\n- Turn left / Turn right / Go straight\n- How far is it?\n- Can you show me on the map?\n\n## Eating Out\n\n- A table for [number] please\n- The menu please\n- I would like...\n- The bill please\n- Is this vegetarian / Does this contain [allergen]?\n\n## Shopping\n\n- How much does this cost?\n- That is too expensive\n- Do you have a smaller/larger size?\n- I will take this\n- Can I pay by card?\n\n## Emergencies\n\n- Help!\n- Call an ambulance / the police\n- I am lost\n- I need a doctor\n- It is an emergency\n\n## Practice Strategy\n\nCreate scenarios in your head and rehearse the dialogue:\n1. Picture yourself in a restaurant\n2. Imagine the conversation from greeting to paying\n3. Say every phrase out loud\n4. Repeat daily until it feels natural\n\nRole-playing with a language partner (or even with yourself in a mirror) is the fastest way to make these phrases automatic.`,
              keyPoints: ['Memorise help, direction, food, and shopping phrases', 'Practice by imagining real scenarios', 'Role-play conversations out loud', 'Emergency phrases could be critical — learn them'],
            },
          ],
        },
        {
          title: 'Conversation',
          description: 'Build real conversational ability with grammar and vocabulary.',
          estimatedWeeks: 4,
          milestone: 'Hold a 5-minute conversation on everyday topics',
          lessons: [
            {
              title: 'Core Grammar Patterns',
              description: 'Essential grammar structures that cover 80% of daily speech.',
              estimatedMinutes: 35,
              content: `# Core Grammar Patterns\n\nYou do not need perfect grammar to communicate. Focus on the structures that appear most frequently in everyday speech.\n\n## The 80/20 Rule of Grammar\n\nThese patterns cover roughly 80% of spoken language:\n1. **Subject + Verb + Object**: I eat food, She reads books\n2. **Questions**: Do you...? Where is...? What time...?\n3. **Negation**: I do not..., It is not...\n4. **Past tense basics**: I went, I ate, I saw\n5. **Future intentions**: I will..., I am going to...\n6. **Want/Need/Can**: I want..., I need..., I can...\n\n## Present Tense\n\nMaster the present tense first. In most languages, present tense handles:\n- What you are doing now\n- Habits and routines\n- General truths\n- Near future (in casual speech)\n\n## Conjugation Strategy\n\nDo not memorise conjugation tables in isolation:\n1. Learn the pattern for "I" and "you" forms first (most useful in conversation)\n2. Then add "he/she" and "they"\n3. Practice in sentences, not as isolated forms\n\n## Connectors\n\nSimple words that make your speech flow:\n- And, but, because, so, then, also, or, when, if\n\nEven with limited vocabulary, connectors let you build complex ideas:\n"I want to go **but** it is raining **so** I will stay home **and** read."\n\n## Practice: Sentence Building\n\nTake 5 verbs you know and create 3 sentences with each:\n- Present tense statement\n- Question form\n- Negative form\n\nThis gives you 15 sentences and drills the core patterns.`,
              keyPoints: ['Six grammar patterns cover 80% of speech', 'Master present tense before other tenses', 'Learn I/you conjugation forms first', 'Connectors (and, but, because) let you build complex ideas'],
            },
            {
              title: 'Vocabulary Building',
              description: 'Efficient strategies for rapidly expanding your word bank.',
              estimatedMinutes: 30,
              content: `# Vocabulary Building\n\nVocabulary is the fuel of language learning. The more words you know, the more you can understand and express.\n\n## The Frequency Approach\n\nNot all words are equally important:\n- The **100 most common words** account for ~50% of spoken language\n- The **1000 most common words** cover ~85% of everyday speech\n- The **3000 most common words** cover ~95%\n\nFocus on high-frequency words first.\n\n## Spaced Repetition\n\nThe most scientifically-proven method for memorisation:\n- Review new words after 1 day, 3 days, 7 days, 14 days, 30 days\n- Use apps like Anki or LifeOS flashcards\n- If you remember easily, increase the interval\n- If you forget, reset to shorter intervals\n\n## Learn Words in Context\n\nDo not learn isolated words. Learn phrases:\n- Instead of "dog" → learn "I have a dog"\n- Instead of "beautiful" → learn "The city is beautiful"\n- Instead of "buy" → learn "I want to buy this"\n\n## Word Families\n\nLearn related words together:\n- work, worker, workplace, working\n- happy, happiness, unhappy, happily\n\n## Daily Routine\n\n1. Learn 5-10 new words each morning\n2. Use them in 3 sentences each\n3. Review yesterday's words\n4. Review last week's words\n5. Use new words in conversation that day\n\n## The Goldlist Method\n\nWrite 20 new words in a notebook. After 2 weeks, without reviewing, write the ones you remember. The ones you forgot naturally — review them. Repeat. Your brain will naturally retain the most meaningful words.`,
              keyPoints: ['1000 most common words cover 85% of speech', 'Use spaced repetition for efficient memorisation', 'Learn words in phrases, not isolation', 'Learn 5-10 new words daily and review regularly'],
            },
            {
              title: 'Conversation Practice',
              description: 'Techniques for practising real conversation, even without a partner.',
              estimatedMinutes: 25,
              content: `# Conversation Practice\n\nReading and listening build passive knowledge. Speaking builds active fluency. You need to practice conversation regularly.\n\n## Finding Conversation Partners\n\n- **Language exchange apps**: HelloTalk, Tandem, iTalki\n- **Local meetups**: Search for language exchange events in your city\n- **Online tutors**: Affordable sessions on iTalki or Preply\n- **AI conversation**: Practice with AI chat tools for low-pressure practice\n\n## Solo Practice Techniques\n\n### Self-Talk\nNarrate your daily activities in your target language:\n- "I am making breakfast. I am putting bread in the toaster."\n- "I am walking to the station. The weather is nice today."\n\n### Monologue Practice\nSet a timer for 2 minutes and talk about:\n- What you did today\n- Your hobbies\n- Your family\n- Your plans for the weekend\n\nRecord yourself. Listen back. Note mistakes and new words you needed.\n\n### Imaginary Conversations\nRehearse common scenarios:\n- Ordering at a cafe\n- Asking for directions\n- Making small talk at a party\n- Calling to make an appointment\n\n## Overcoming Fear of Speaking\n\n1. Accept that you will make mistakes — native speakers appreciate the effort\n2. Start with low-stakes environments (online, with a tutor)\n3. Celebrate communication, not perfection\n4. Remember: a 5-year-old is fluent with limited vocabulary — you can communicate too\n\n## The 15-Minute Daily Rule\n\nSpend 15 minutes each day speaking out loud in your target language. Even talking to yourself counts. Consistency is everything.`,
              keyPoints: ['Use language exchange apps for free practice', 'Narrate daily activities in the target language', 'Record yourself to identify areas for improvement', 'Speak for at least 15 minutes daily, even to yourself'],
            },
          ],
        },
        {
          title: 'Fluency',
          description: 'Advanced comprehension, cultural fluency, and natural expression.',
          estimatedWeeks: 6,
          milestone: 'Understand native-speed media and hold extended conversations',
          lessons: [
            {
              title: 'Immersion Techniques',
              description: 'Surround yourself with the language for accelerated learning.',
              estimatedMinutes: 30,
              content: `# Immersion Techniques\n\nImmersion is the fastest path to fluency. You do not need to move to another country — you can create immersion at home.\n\n## Digital Immersion\n\n### Change Your Devices\n- Set your phone language to your target language\n- Change browser, social media, and app languages\n- This forces daily micro-exposure\n\n### Media Consumption\n- **Netflix/YouTube**: Watch shows in the target language with target-language subtitles (not English)\n- **Podcasts**: Start with learner podcasts, progress to native content\n- **Music**: Look up lyrics, sing along\n- **News**: Read a short article daily in your target language\n\n## Active Immersion vs. Passive Immersion\n\n**Active** (focused attention):\n- Studying with a textbook\n- Watching a show and pausing to look up words\n- Conversation practice\n- Writing in your journal in the target language\n\n**Passive** (background exposure):\n- Playing music in the target language\n- Having a podcast on while cooking\n- Leaving the TV on a foreign channel\n\nBoth are valuable. Aim for 30+ minutes of active and as much passive as possible.\n\n## The Comprehensible Input Theory\n\nThe linguist Stephen Krashen showed that language is acquired through **comprehensible input** — content that is just slightly above your current level. If you understand 80-90% of what you hear/read, the remaining 10-20% will be acquired naturally through context.\n\n## Daily Immersion Schedule\n\n- Morning: 10 min podcast in target language\n- Commute: Music with lyrics\n- Lunch: Read one short article\n- Evening: 30 min TV show with target-language subtitles\n- Before bed: 5 min journal entry in target language`,
              keyPoints: ['Change device languages for constant micro-exposure', 'Watch shows with target-language subtitles, not English', 'Active immersion for learning, passive immersion for reinforcement', 'Aim for comprehensible input: 80-90% understanding'],
            },
            {
              title: 'Thinking in the Language',
              description: 'Stop translating in your head and start thinking directly.',
              estimatedMinutes: 25,
              content: `# Thinking in the Language\n\nThe hallmark of fluency is when you stop translating from your native language and start thinking directly in the target language.\n\n## The Translation Trap\n\nBeginners process language like this:\n1. Hear foreign words\n2. Translate to English in your head\n3. Formulate response in English\n4. Translate response to foreign language\n5. Speak\n\nThis five-step process is slow and exhausting. Fluent speakers skip steps 2-4.\n\n## How to Break the Translation Habit\n\n### Associate Words with Images, Not Translations\n- When you learn "casa" (Spanish for house), picture a house — do not picture the English word "house"\n- Use picture dictionaries and flashcards with images instead of translations\n\n### Internal Monologue Practice\n- Throughout the day, think simple thoughts in the target language\n- Start with observations: "The sky is blue. I am hungry. This coffee is good."\n- Gradually add complexity: "I wonder if it will rain. I should call my friend."\n\n### Dream Journaling\n- Before sleep, review your day in the target language\n- Some learners report dreaming in their target language after this practice\n\n### Counting and Math\n- Do mental arithmetic in the target language\n- Count steps, count objects, calculate tips\n\n## The Tipping Point\n\nMost learners report a sudden shift around the 6-12 month mark where the language "clicks" and they catch themselves thinking in it without trying. This is the reward for consistent practice.\n\n## Be Patient\n\nThis process cannot be rushed. It requires volume — thousands of hours of exposure. But every minute of practice brings you closer to that tipping point.`,
              keyPoints: ['Fluency means thinking directly without translating', 'Associate words with images, not English equivalents', 'Practice internal monologue in the target language', 'The tipping point comes around 6-12 months of consistent practice'],
            },
            {
              title: 'Cultural Fluency',
              description: 'Understanding culture, idioms, humour, and social norms.',
              estimatedMinutes: 25,
              content: `# Cultural Fluency\n\nLanguage and culture are inseparable. True fluency means understanding not just what words mean, but what they imply in cultural context.\n\n## Idioms and Expressions\n\nEvery language has phrases that make no literal sense:\n- English: "It is raining cats and dogs"\n- Spanish: "Estar en las nubes" (to be in the clouds — daydreaming)\n- French: "Avoir le cafard" (to have the cockroach — to feel down)\n\nLearn 2-3 new idioms per week. Using them will impress native speakers.\n\n## Register: Formal vs. Informal\n\nMany languages have formal and informal registers:\n- **When to be formal**: first meetings, business, older people, authorities\n- **When to be informal**: friends, peers, casual settings\n- Getting this wrong is a bigger social error than grammar mistakes\n\n## Humour\n\nUnderstanding humour in another language is one of the highest levels of fluency:\n- Watch comedy shows in the target language\n- Ask native speakers to explain jokes you do not understand\n- Puns and wordplay reveal deep language knowledge\n\n## Non-Verbal Communication\n\nCultures differ in:\n- Personal space (closer in Mediterranean cultures, more distance in Nordic)\n- Eye contact (expected in Western cultures, can be rude in some Asian cultures)\n- Gestures (thumbs up is positive in most places, offensive in some)\n- Volume (louder in some cultures, softer in others)\n\n## Food and Social Customs\n\n- Dining etiquette varies enormously\n- Tipping customs differ by country\n- Gift-giving has cultural rules\n- Punctuality expectations vary\n\nResearch these for your target culture — they matter more than perfect grammar.\n\n## The Goal\n\nCultural fluency means you can navigate social situations appropriately, understand subtext, and connect with people on a deeper level than just exchanging information.`,
              keyPoints: ['Learn 2-3 idioms per week for natural speech', 'Formal vs informal register matters more than grammar', 'Non-verbal communication varies across cultures', 'Cultural fluency enables deeper human connection'],
            },
          ],
        },
      ];

    case 'business':
      return [
        {
          title: 'Foundations',
          description: 'Understand your market, define your value proposition, and identify customers.',
          estimatedWeeks: 3,
          milestone: 'Have a clear value proposition and identified target market',
          lessons: [
            {
              title: 'Market Research',
              description: 'How to understand your market, competition, and opportunities.',
              estimatedMinutes: 30,
              content: `# Market Research\n\nBefore building anything, you need to understand the landscape. Market research reduces risk and reveals opportunities others miss.\n\n## Why Research First?\n\nMost businesses fail not because the product is bad, but because:\n- There is no real demand\n- The market is too small\n- Competition is too entrenched\n- Timing is wrong\n\nResearch answers these questions before you invest time and money.\n\n## Types of Research\n\n### Primary Research (Direct)\n- **Surveys**: Ask potential customers about their problems and needs\n- **Interviews**: Deep conversations with 10-20 target customers\n- **Observation**: Watch how people currently solve the problem\n- **MVP testing**: Build a minimal version and measure interest\n\n### Secondary Research (Existing Data)\n- Industry reports and market sizing\n- Competitor websites, reviews, and social media\n- Google Trends for demand patterns\n- Government statistics and census data\n\n## Competitive Analysis\n\nFor each competitor, document:\n1. What they offer\n2. Their pricing\n3. Their strengths and weaknesses\n4. Their customer reviews (especially negative ones — these reveal unmet needs)\n5. What makes your approach different\n\n## Identifying Gaps\n\nLook for:\n- Underserved customer segments\n- Common complaints about existing solutions\n- Emerging trends competitors have not adopted\n- Price gaps (too expensive or no premium option)\n\n## Action Steps\n\n1. Interview 5 potential customers this week\n2. Analyse 3 competitors in detail\n3. Write a one-page market summary\n4. Identify your top 3 opportunities`,
              keyPoints: ['Research reduces risk before investing time and money', 'Use both primary (surveys, interviews) and secondary research', 'Competitor weaknesses reveal your opportunities', 'Interview real potential customers before building'],
            },
            {
              title: 'Value Proposition',
              description: 'Define exactly what makes your business valuable to customers.',
              estimatedMinutes: 30,
              content: `# Value Proposition\n\nYour value proposition is the core reason customers choose you over alternatives. It answers: "Why should I buy from you?"\n\n## The Value Proposition Canvas\n\n### Customer Side\n- **Jobs**: What are customers trying to accomplish?\n- **Pains**: What frustrates them about current solutions?\n- **Gains**: What would delight them beyond expectations?\n\n### Your Side\n- **Products/Services**: What do you offer?\n- **Pain Relievers**: How do you address their frustrations?\n- **Gain Creators**: How do you deliver unexpected value?\n\n## Writing Your Value Proposition\n\nUse this formula:\n\n"We help [target customer] who [situation/need] by providing [solution] that [key benefit], unlike [alternative] which [limitation]."\n\nExample: "We help busy parents who struggle to cook healthy meals by providing pre-prepped ingredient boxes that take 15 minutes to prepare, unlike meal delivery services which are expensive and lack variety."\n\n## Testing Your Value Proposition\n\n1. Can you explain it in one sentence?\n2. Does a stranger understand it immediately?\n3. Does it clearly differ from competitors?\n4. Is the benefit specific and measurable?\n\nIf any answer is no, refine it.\n\n## Common Mistakes\n\n- Too vague: "We provide great service" (everyone says this)\n- Too complex: If it takes 5 minutes to explain, it is too complex\n- Feature-focused: Customers care about benefits, not features\n- Not differentiated: If a competitor could say the same thing, it is not a value proposition`,
              keyPoints: ['Value proposition answers "Why should I buy from you?"', 'Map customer jobs, pains, and gains', 'Use the formula: We help [who] by [what] unlike [competitor]', 'Test it: Can a stranger understand it in one sentence?'],
            },
            {
              title: 'Customer Discovery',
              description: 'Find and validate your ideal customer before building.',
              estimatedMinutes: 30,
              content: `# Customer Discovery\n\nThe most expensive mistake in business is building something nobody wants. Customer discovery prevents this by validating demand before building.\n\n## Who Is Your Customer?\n\nCreate a detailed customer profile:\n- **Demographics**: Age, location, income, occupation\n- **Psychographics**: Values, interests, lifestyle\n- **Behavior**: Where they shop, what media they consume, how they make decisions\n- **Problem**: What specific pain are they experiencing?\n\n## The Mom Test\n\nFrom the book by Rob Fitzpatrick — rules for customer conversations:\n\n1. **Talk about their life, not your idea**: "Tell me about the last time you tried to..." instead of "Would you use a product that...?"\n2. **Ask about specifics, not hypotheticals**: "What did you do?" instead of "What would you do?"\n3. **Talk less, listen more**: Your job is to learn, not to pitch\n4. **Ask for commitment**: "Would you pay $X for this?" or "Can I follow up next week?"\n\n## Validation Signals\n\n**Strong signals** (customer really has this problem):\n- They are currently paying to solve it\n- They have tried multiple solutions\n- They are willing to pay you in advance\n- They introduce you to others with the same problem\n\n**Weak signals** (polite interest, not real demand):\n- "That sounds interesting"\n- "I might use that"\n- "Send me more information"\n\n## Minimum Viable Audience\n\nYou do not need millions of customers. Start with:\n- 10 passionate early adopters\n- Who will pay before the product is perfect\n- And will give you honest feedback\n- And will refer others\n\nThese 10 people are more valuable than 10,000 lukewarm leads.`,
              keyPoints: ['Build a detailed customer profile before building products', 'Use the Mom Test: talk about their life, not your idea', 'Look for strong signals: willingness to pay, not just interest', 'Start with 10 passionate early adopters'],
            },
          ],
        },
        {
          title: 'Building',
          description: 'Launch your product or service with minimal resources.',
          estimatedWeeks: 4,
          milestone: 'Launch an MVP and acquire your first paying customer',
          lessons: [
            { title: 'The MVP Approach', description: 'Build the minimum viable product to test your hypothesis.', estimatedMinutes: 30, content: `# The MVP Approach\n\nA Minimum Viable Product (MVP) is the smallest version of your product that lets you start learning from real customers.\n\n## What an MVP Is (and Is Not)\n\n**An MVP is:**\n- The core feature that solves the main problem\n- Good enough to charge money for\n- A learning tool, not a finished product\n\n**An MVP is NOT:**\n- A half-baked, broken product\n- A prototype with no real functionality\n- A finished product with one feature\n\n## Types of MVPs\n\n### Concierge MVP\nManually deliver the service yourself before automating:\n- Food delivery: You personally deliver meals before building an app\n- Consulting: Do the work manually before building software\n\n### Landing Page MVP\nCreate a page describing your product with a sign-up button:\n- If people sign up, there is demand\n- No product needs to exist yet\n\n### Wizard of Oz MVP\nThe product looks automated but is actually manual behind the scenes:\n- Chatbots where a human responds\n- "AI recommendations" that are hand-curated\n\n## Building Your MVP\n\n1. List all features you want\n2. Cross out everything except the one core feature\n3. Build that one feature to a usable standard\n4. Launch to 10-20 people\n5. Collect feedback and iterate\n\n## Timeline\n\nYour MVP should take 2-4 weeks to build, not months. If it is taking longer, you are building too much.\n\n## The Key Question\n\nAfter launch, ask: "Would you be disappointed if this product disappeared?" If yes, you have product-market fit. If no, iterate or pivot.`, keyPoints: ['MVP is the smallest product that lets you learn from customers', 'Concierge MVP: deliver manually before automating', 'Build in 2-4 weeks, not months', 'Test: Would customers be disappointed if it disappeared?'] },
            { title: 'Pricing Strategy', description: 'How to price your product or service for sustainability.', estimatedMinutes: 25, content: `# Pricing Strategy\n\nPricing is one of the most important and most underestimated decisions in business. Get it right and everything else becomes easier.\n\n## The Three Pricing Methods\n\n### Cost-Plus Pricing\nCost of goods + desired margin = price\n- Simple but ignores market perception\n- Works for commodities, not for differentiated products\n\n### Competitor-Based Pricing\nMatch or undercut competitors:\n- Easy to implement\n- Dangerous — leads to race to the bottom\n- Only works if you have lower costs\n\n### Value-Based Pricing\nPrice based on the value you deliver to the customer:\n- If you save them $10,000/year, charging $2,000 is a bargain\n- Requires understanding customer outcomes\n- Most profitable approach\n\n## Pricing Psychology\n\n1. **Anchoring**: Show the premium option first — it makes mid-tier look reasonable\n2. **Charm pricing**: $9.99 feels much cheaper than $10.00\n3. **Decoy pricing**: Add a third option to make the target option look best\n4. **Free trial**: Reduces risk for the customer (but set a clear end date)\n\n## Common Pricing Mistakes\n\n- **Pricing too low**: Signals low quality, attracts price-sensitive customers\n- **Not testing**: Your first price is a guess — test higher and lower\n- **One-size-fits-all**: Offer tiers to capture different segments\n\n## Your Pricing Exercise\n\n1. Calculate your costs\n2. Research competitor pricing\n3. Estimate the value you deliver\n4. Set your price between cost and value, closer to value\n5. Test with real customers and adjust`, keyPoints: ['Value-based pricing is the most profitable approach', 'Pricing too low signals low quality', 'Use anchoring: show premium first to make mid-tier attractive', 'Test your pricing with real customers'] },
            { title: 'First Sales', description: 'Acquire your first paying customers.', estimatedMinutes: 30, content: `# First Sales\n\nGetting your first paying customer is the most important milestone in any business. It validates everything: your idea, your product, and your ability to sell.\n\n## Where to Find First Customers\n\n### Your Network\n- Friends, family, former colleagues\n- Not as charity — only if they genuinely need your product\n- Ask for introductions to people who might benefit\n\n### Online Communities\n- Reddit, Facebook Groups, LinkedIn Groups\n- Provide value first (answer questions, share insights)\n- Then mention your product when relevant\n\n### Direct Outreach\n- Identify 50 potential customers\n- Send personalised messages (not spam templates)\n- Focus on their problem, not your product\n\n## The Sales Conversation\n\n1. **Ask about their problem**: "What is your biggest challenge with X?"\n2. **Listen actively**: Take notes, ask follow-up questions\n3. **Present your solution**: Only after understanding their situation\n4. **Handle objections**: Address concerns honestly\n5. **Ask for the sale**: "Would you like to get started?"\n\n## Overcoming Sales Anxiety\n\n- You are not bothering people — you are solving their problem\n- Rejection is data, not failure\n- Each "no" gets you closer to understanding what works\n- Start with friendly audiences and work up to cold outreach\n\n## After the First Sale\n\n- Deliver exceptional service (over-deliver on your promise)\n- Ask for detailed feedback\n- Ask for a testimonial\n- Ask for referrals\n\nYour first 10 customers are your most valuable asset. Treat them like gold.`, keyPoints: ['Start with your network for first customers', 'Focus sales conversations on their problem, not your product', 'Rejection is data, not failure', 'Over-deliver for first customers and ask for referrals'] },
          ],
        },
        {
          title: 'Scale',
          description: 'Grow from first customers to a sustainable, scalable business.',
          estimatedWeeks: 4,
          milestone: 'Have repeatable sales and marketing processes in place',
          lessons: [
            { title: 'Marketing Channels', description: 'Find and leverage the right marketing channels.', estimatedMinutes: 30, content: `# Marketing Channels\n\nMarketing is how customers discover you. The right channel can make a business; the wrong one can bankrupt it.\n\n## Channel Categories\n\n### Organic (Free but Slow)\n- **SEO**: Optimise for search engines. Long-term, compounding returns.\n- **Content marketing**: Blog posts, videos, podcasts that attract your audience.\n- **Social media**: Build a following with valuable content.\n- **Word of mouth**: The best marketing — requires great product + asking for referrals.\n\n### Paid (Fast but Expensive)\n- **Google Ads**: Capture people actively searching for your solution.\n- **Facebook/Instagram Ads**: Target specific demographics and interests.\n- **LinkedIn Ads**: Best for B2B, expensive per click.\n- **Influencer partnerships**: Pay people with your target audience to promote you.\n\n### Direct (High Effort, High Conversion)\n- **Email marketing**: Build a list, nurture with value, convert with offers.\n- **Cold outreach**: Personalised emails/calls to potential customers.\n- **Partnerships**: Collaborate with complementary businesses.\n- **Events**: Conferences, meetups, webinars.\n\n## The Bullseye Framework\n\n1. **Brainstorm**: List all possible channels\n2. **Rank**: Which 3 are most promising for your specific business?\n3. **Test**: Run small experiments on each (2 weeks, small budget)\n4. **Focus**: Double down on the winner\n\n## Channel-Market Fit\n\nMatch your channel to your customer:\n- Teens: TikTok, Instagram\n- Professionals: LinkedIn, Email\n- Local businesses: Google Maps, local SEO\n- Developers: Twitter, GitHub, Dev.to\n\n## The One-Channel Rule\n\nMaster one channel before adding another. Spreading yourself across 5 channels means doing none of them well.`, keyPoints: ['Match marketing channel to where your customers are', 'Use the Bullseye Framework: brainstorm, rank, test, focus', 'Master one channel before adding another', 'Organic is free but slow; paid is fast but expensive'] },
            { title: 'Systems and Automation', description: 'Build systems so the business runs without you.', estimatedMinutes: 25, content: `# Systems and Automation\n\nA business that depends entirely on you is not a business — it is a job. Systems and automation create scalability.\n\n## Document Everything\n\nStart with Standard Operating Procedures (SOPs):\n- Write step-by-step instructions for every recurring task\n- Include screenshots and examples\n- Any new person should be able to follow them\n\n## The Automation Priority Matrix\n\n| Task Type | Action |\n|-----------|--------|\n| Repetitive + simple | Automate immediately |\n| Repetitive + complex | Document, then train someone |\n| One-time + simple | Just do it |\n| One-time + complex | Document for future reference |\n\n## Tools for Automation\n\n- **Email**: Automated sequences (Mailchimp, ConvertKit)\n- **Social media**: Scheduling tools (Buffer, Later)\n- **Sales**: CRM with automated follow-ups (HubSpot)\n- **Operations**: Zapier connects apps together\n- **Finance**: Automated invoicing and bookkeeping (Xero, QuickBooks)\n\n## The 4-Hour Workweek Approach\n\n1. **Eliminate**: Stop doing tasks that do not produce results\n2. **Automate**: Use software for repetitive tasks\n3. **Delegate**: Hire freelancers for tasks that need a human but not you\n4. **Focus**: Spend your time on high-impact activities only you can do\n\n## When to Hire\n\nHire when:\n- A task is taking 10+ hours per week and is not your core strength\n- Revenue consistently exceeds what you need to pay someone\n- You have documented SOPs for the role\n- The hire will free you to generate more revenue`, keyPoints: ['Document every recurring task as an SOP', 'Automate repetitive simple tasks first', 'Eliminate, automate, delegate, then focus', 'Hire when a task takes 10+ hours weekly and you have SOPs'] },
            { title: 'Financial Management', description: 'Keep your business financially healthy and growing.', estimatedMinutes: 30, content: `# Financial Management\n\nProfit is not optional — it is the oxygen of your business. Understanding your numbers is essential for survival and growth.\n\n## The Numbers That Matter\n\n### Revenue\nTotal money coming in. Important but misleading alone — revenue without profit is just exercise.\n\n### Profit Margin\n(Revenue - Costs) / Revenue. Aim for:\n- Service businesses: 20-40%\n- Product businesses: 30-50%\n- SaaS: 60-80%\n\n### Cash Flow\nThe timing of money in vs money out. You can be profitable and still run out of cash if customers pay slowly.\n\n### Customer Acquisition Cost (CAC)\nHow much you spend to get one customer. Track by channel.\n\n### Customer Lifetime Value (LTV)\nHow much a customer spends over their entire relationship with you. LTV should be at least 3x CAC.\n\n## Monthly Financial Review\n\nEvery month, review:\n1. Revenue vs last month and same month last year\n2. Top expenses — anything unexpected?\n3. Profit margin trend — is it improving?\n4. Cash position — how many months of expenses can you cover?\n5. Outstanding invoices — who owes you money?\n\n## The Profit First Method\n\nFrom the book by Mike Michalowicz:\n1. Revenue comes in\n2. Immediately allocate: 5-15% to profit, 50% to owner pay, 15% to tax, remainder to operations\n3. Spend only what is in the operations account\n4. Profit is taken first, not last\n\n## Emergency Fund\n\nMaintain 3-6 months of operating expenses in reserve. Businesses that survive downturns are the ones with cash reserves.\n\n## Tax Planning\n\nSet aside 25-30% of profit for taxes from day one. Do not spend tax money — treat it as untouchable.`, keyPoints: ['Track revenue, profit margin, cash flow, CAC, and LTV', 'LTV should be at least 3x customer acquisition cost', 'Use Profit First: allocate profit before expenses', 'Maintain 3-6 months operating expenses as reserve'] },
          ],
        },
      ];

    case 'tech':
      return buildGenericTemplate('Core Concepts', 'Practical Skills', 'Advanced', topic);

    case 'creative':
      return buildGenericTemplate('Creative Foundations', 'Developing Your Craft', 'Mastery & Expression', topic);

    case 'academic':
      return buildGenericTemplate('Fundamental Theory', 'Applied Knowledge', 'Advanced Research', topic);

    default:
      return buildGenericTemplate('Foundations', 'Development', 'Mastery', topic);
  }
}

function buildGenericTemplate(phase1: string, phase2: string, phase3: string, topic: string): TemplatePhase[] {
  return [
    {
      title: phase1,
      description: `Build a solid understanding of the core principles of ${topic}.`,
      estimatedWeeks: 3,
      milestone: `Understand the fundamental concepts and terminology of ${topic}`,
      lessons: [
        {
          title: `Introduction to ${topic}`,
          description: `Overview of ${topic}, its history, key concepts, and why it matters.`,
          estimatedMinutes: 30,
          content: `# Introduction to ${topic}\n\nWelcome to your journey into ${topic}. This lesson provides the foundation you need to understand the field and chart your learning path.\n\n## What Is ${topic}?\n\n${topic} is a field that combines theory with practical application. Understanding the basics will give you the vocabulary and mental models needed for everything that follows.\n\n## Why Learn ${topic}?\n\nThere are many compelling reasons:\n- **Career growth**: Skills in ${topic} are increasingly in demand\n- **Problem-solving**: Learning ${topic} develops your analytical thinking\n- **Personal satisfaction**: Mastering a new skill builds confidence and opens doors\n- **Creativity**: ${topic} provides new tools for creative expression\n\n## The Learning Path Ahead\n\nYour curriculum is structured in three phases:\n1. **${phase1}**: Core concepts, terminology, and basic skills\n2. **${phase2}**: Hands-on practice and real-world applications\n3. **${phase3}**: Advanced techniques and independent projects\n\n## How to Get the Most from This Course\n\n- **Practice daily**: Even 15 minutes of focused practice beats hours of passive reading\n- **Take notes**: Write summaries in your own words after each lesson\n- **Build projects**: Apply what you learn to real problems as soon as possible\n- **Ask questions**: Use the AI tutor to explore topics that interest you\n\n## Key Terminology\n\nEvery field has its own language. As you progress, you will naturally absorb the terminology. Do not try to memorise everything at once — focus on understanding concepts, and the words will follow.\n\n## Your First Exercise\n\nWrite a paragraph about why you want to learn ${topic}. What do you hope to achieve in 3 months? This will be your north star when motivation dips.`,
          keyPoints: [`${topic} combines theory with practical application`, 'Daily practice beats passive reading', 'The curriculum moves from foundations to mastery', 'Write down your motivation as a reference point'],
        },
        {
          title: 'Core Principles',
          description: `The fundamental principles that underpin all of ${topic}.`,
          estimatedMinutes: 30,
          content: `# Core Principles\n\nEvery discipline has fundamental principles that everything else builds on. Master these and the advanced material becomes much easier to understand.\n\n## Principle 1: Start with Why\n\nBefore diving into how something works, understand why it exists. Every tool, technique, and concept in ${topic} was created to solve a specific problem. Understanding the problem makes the solution intuitive.\n\n## Principle 2: Learn by Doing\n\nReading about ${topic} is not the same as doing ${topic}. Active practice creates neural pathways that passive consumption does not.\n\n### The 70-20-10 Rule\n- **70%** of learning comes from hands-on experience\n- **20%** comes from learning from others (mentors, peers)\n- **10%** comes from formal instruction (courses, books)\n\n## Principle 3: Iteration Over Perfection\n\nYour first attempt at anything will not be good. That is expected. The key is to:\n1. Create a first version (no matter how rough)\n2. Evaluate what works and what does not\n3. Improve based on feedback\n4. Repeat\n\nEach iteration gets better. Professionals are not people who get it right the first time — they are people who iterate faster.\n\n## Principle 4: Build Mental Models\n\nA mental model is a simplified representation of how something works. Good mental models let you:\n- Predict outcomes before trying\n- Debug problems systematically\n- Transfer knowledge to new situations\n\n## Principle 5: Connect with Others\n\nLearning in isolation is slower. Find communities, study groups, or mentors who share your interest. Teaching others is also one of the most effective ways to deepen your own understanding.\n\n## Applying These Principles\n\nAs you work through the remaining lessons, consciously apply these principles. Ask yourself: Why does this exist? Am I practising or just reading? How can I iterate? What is my mental model?`,
          keyPoints: ['Understand why before how', '70% of learning is hands-on practice', 'Iterate: your first attempt will not be your best', 'Build mental models to predict and debug'],
        },
        {
          title: 'Tools and Environment Setup',
          description: 'Set up your workspace and tools for effective learning.',
          estimatedMinutes: 25,
          content: `# Tools and Environment Setup\n\nHaving the right tools and environment removes friction from practice. This lesson helps you set up everything you need.\n\n## Your Physical Environment\n\n- **Dedicated space**: If possible, have a specific area for studying ${topic}\n- **Minimal distractions**: Phone on silent, notifications off\n- **Good lighting**: Reduces eye strain and improves focus\n- **Comfortable seating**: You will be here for a while\n\n## Your Digital Environment\n\nDepending on your specific area within ${topic}, you may need:\n- A computer with modern browser\n- Specific software or applications\n- Note-taking tools (LifeOS, Obsidian, or pen and paper)\n- Reference materials bookmarked and organised\n\n## Time Management\n\n### The Pomodoro Technique\n- 25 minutes focused work\n- 5 minute break\n- After 4 pomodoros, take a 15-30 minute break\n\nThis works well for learning because it:\n- Creates urgency (25 minutes is finite)\n- Prevents burnout (regular breaks)\n- Makes progress visible (count completed pomodoros)\n\n## Tracking Progress\n\nUse LifeOS to:\n- Create a daily habit for studying ${topic}\n- Log study sessions and what you covered\n- Set weekly goals for lessons completed\n- Review progress in your weekend reflection\n\n## The Minimum Viable Setup\n\nDo not spend days perfecting your setup. You need:\n1. A quiet place to work\n2. Your learning materials\n3. Something to take notes with\n4. A timer\n\nThat is it. Start learning and add tools as you discover specific needs.\n\n## Community Resources\n\n- Find online communities related to ${topic}\n- Follow experts on social media\n- Subscribe to one newsletter or podcast\n- Bookmark 2-3 reference sites`,
          keyPoints: ['Dedicated space with minimal distractions', 'Pomodoro technique: 25 min focus + 5 min break', 'Track progress with daily habits in LifeOS', 'Start with minimal setup and add tools as needed'],
        },
      ],
    },
    {
      title: phase2,
      description: `Apply your knowledge through hands-on practice and real-world projects.`,
      estimatedWeeks: 4,
      milestone: `Complete a real project applying ${topic} skills`,
      lessons: [
        {
          title: 'Guided Practice',
          description: 'Work through structured exercises to build practical skills.',
          estimatedMinutes: 35,
          content: `# Guided Practice\n\nYou have learned the theory. Now it is time to apply it. This lesson provides structured exercises to build practical competence.\n\n## The Practice Framework\n\n### Deliberate Practice\nNot all practice is equal. Deliberate practice:\n- Targets specific skills at the edge of your ability\n- Includes immediate feedback\n- Requires full concentration\n- Is often uncomfortable (that means you are growing)\n\n### Exercise Structure\nEach practice session should follow this pattern:\n1. **Warm-up** (5 min): Review what you know\n2. **New skill** (15 min): Work on something challenging\n3. **Integration** (10 min): Combine new skill with previous knowledge\n4. **Reflection** (5 min): What did you learn? What was hard?\n\n## Building Blocks Approach\n\nComplex skills are made of simpler sub-skills:\n1. Identify the sub-skills\n2. Practice each one in isolation\n3. Combine two sub-skills\n4. Add more until you can perform the full skill\n\n## Common Mistakes in Practice\n\n- **Repeating what you already know**: This feels good but does not improve you\n- **Skipping fundamentals**: Advanced techniques built on shaky foundations will crumble\n- **Not tracking**: If you do not measure, you cannot improve\n- **Comparing to others**: Compare to your past self, not to experts\n\n## Your Practice Log\n\nAfter each session, record:\n- Date and duration\n- What you practised\n- What went well\n- What was difficult\n- One thing to focus on next time\n\nThis log becomes incredibly valuable over weeks and months — it reveals patterns in your learning.`,
          keyPoints: ['Deliberate practice targets skills at your edge', 'Follow the warm-up, new skill, integration, reflection pattern', 'Break complex skills into sub-skills and combine', 'Keep a practice log to track improvement patterns'],
        },
        {
          title: 'Your First Project',
          description: 'Apply your skills to a real project from start to finish.',
          estimatedMinutes: 35,
          content: `# Your First Project\n\nProjects transform knowledge into skill. By completing a real project, you will discover what you truly understand and what needs more work.\n\n## Choosing a Project\n\nYour first project should be:\n- **Achievable**: Completable in 1-2 weeks\n- **Interesting**: Something you actually care about\n- **Challenging**: Pushes slightly beyond your current ability\n- **Shareable**: Something you can show to others\n\n## Project Planning\n\n1. **Define the outcome**: What does "done" look like?\n2. **Break it down**: List every step needed\n3. **Estimate time**: How long will each step take?\n4. **Set milestones**: What should be done by mid-project?\n5. **Identify risks**: What might go wrong? What do you not know how to do yet?\n\n## The Build Process\n\n### Phase 1: Foundation (Days 1-3)\n- Set up your project structure\n- Complete the core framework\n- Do not worry about polish — get the structure right\n\n### Phase 2: Features (Days 4-7)\n- Build out the main functionality\n- Test as you go\n- Refer to lessons when stuck\n\n### Phase 3: Polish (Days 8-10)\n- Fix issues and rough edges\n- Add finishing touches\n- Document what you built and how\n\n## When You Get Stuck\n\n1. Re-read relevant lessons\n2. Search for specific answers online\n3. Ask the AI tutor\n4. Take a break and come back fresh\n5. Simplify — reduce scope rather than abandoning\n\n## Sharing Your Work\n\nWhen done, share your project:\n- Write a brief description of what you built\n- Note what you learned\n- Ask for feedback\n- Celebrate the achievement`,
          keyPoints: ['Choose a project that is achievable in 1-2 weeks', 'Break the project into phases: foundation, features, polish', 'When stuck, simplify scope rather than abandoning', 'Share your work and ask for feedback'],
        },
        {
          title: 'Learning from Feedback',
          description: 'Use feedback to accelerate your improvement.',
          estimatedMinutes: 25,
          content: `# Learning from Feedback\n\nFeedback is the fastest way to improve. Without it, you might practice the wrong things for months without realising.\n\n## Types of Feedback\n\n### Self-Assessment\n- Compare your work to examples from experts\n- Record yourself and review critically\n- Use rubrics or checklists to evaluate systematically\n\n### Peer Feedback\n- Share work with others at a similar level\n- Ask specific questions: "How is my X?" not just "What do you think?"\n- Offer feedback to others — teaching improves your own understanding\n\n### Expert Feedback\n- Find a mentor, tutor, or experienced practitioner\n- Use the AI tutor for immediate, specific feedback\n- Attend workshops or masterclasses\n\n## How to Receive Feedback\n\n1. **Do not defend**: Listen first, process later\n2. **Ask for specifics**: "Can you give an example?"\n3. **Look for patterns**: One person's opinion is anecdote; recurring feedback is data\n4. **Prioritise**: You cannot fix everything at once — pick the most impactful item\n5. **Act on it**: Feedback without action is wasted\n\n## How to Give Feedback\n\n- Be specific (not "this is bad" but "the pacing in section 2 could be tighter")\n- Balance positive and constructive (what works AND what could improve)\n- Focus on the work, not the person\n- Offer suggestions, not just criticism\n\n## The Feedback Loop\n\nCreate a continuous cycle:\n1. Practice → 2. Get feedback → 3. Identify one improvement → 4. Practice that specific thing → 5. Get feedback again\n\nEach loop takes you to a higher level. The speed of this loop determines the speed of your improvement.`,
          keyPoints: ['Self-assessment, peer feedback, and expert feedback all matter', 'Ask for specific feedback, not general opinions', 'Look for patterns in feedback — recurring themes are priorities', 'Create fast feedback loops: practice, feedback, improve, repeat'],
        },
      ],
    },
    {
      title: phase3,
      description: `Push your skills to an advanced level and develop your unique approach.`,
      estimatedWeeks: 4,
      milestone: `Complete an advanced project and develop a personal style in ${topic}`,
      lessons: [
        {
          title: 'Advanced Techniques',
          description: 'Push beyond fundamentals into advanced territory.',
          estimatedMinutes: 35,
          content: `# Advanced Techniques\n\nYou have built a solid foundation. Now it is time to push into advanced territory where real differentiation happens.\n\n## The Intermediate Plateau\n\nMany learners hit a plateau after the basics. Progress slows because:\n- Easy gains have been captured\n- Improvements require more effort for smaller returns\n- Motivation can wane when progress is less visible\n\n## Breaking Through\n\n### Study the Masters\n- Analyse work from the best practitioners in ${topic}\n- What makes their work exceptional?\n- Try to reverse-engineer their techniques\n- Do not copy — understand the principles and apply them your way\n\n### Cross-Pollinate\n- Borrow techniques from adjacent fields\n- Innovation often comes from combining ideas from different domains\n- Read broadly, not just in your speciality\n\n### Teach Others\n- Explaining concepts reveals gaps in your understanding\n- Teaching forces you to organise knowledge systematically\n- Students ask questions you have never considered\n\n## Depth vs. Breadth\n\nAt the advanced stage, choose:\n- **Specialist**: Go deep in one area, become the expert\n- **Generalist**: Know many areas well, excel at connecting them\n- **T-shaped**: Deep in one area + broad knowledge across many\n\nThe T-shaped approach is often most valuable — deep expertise plus broad context.\n\n## Advanced Practice Principles\n\n1. **Vary conditions**: Practice in different contexts, not just comfortable ones\n2. **Increase difficulty gradually**: Always work at the edge of your ability\n3. **Interleave skills**: Mix different skills in one session instead of drilling one\n4. **Teach and explain**: Solidify understanding by articulating it\n\n## Measuring Advanced Progress\n\nAt this level, progress is measured differently:\n- Quality and nuance, not just completion\n- Efficiency (doing the same thing with less effort)\n- Consistency (performing well reliably, not just occasionally)\n- Creativity (developing original approaches)`,
          keyPoints: ['The intermediate plateau is normal — push through it', 'Study masters, cross-pollinate, and teach others', 'T-shaped learning: deep in one area, broad across many', 'Measure quality, efficiency, consistency, and creativity'],
        },
        {
          title: 'Building Your Portfolio',
          description: 'Create a body of work that demonstrates your skills.',
          estimatedMinutes: 30,
          content: `# Building Your Portfolio\n\nA portfolio is proof of your abilities. Whether for career, freelancing, or personal satisfaction, a body of work is your most powerful asset.\n\n## What Makes a Good Portfolio?\n\n### Quality Over Quantity\n- 3-5 excellent pieces beat 20 mediocre ones\n- Each piece should demonstrate different skills\n- Include your best work, not all your work\n\n### Show Process, Not Just Results\n- Before/after comparisons\n- Challenges you overcame\n- Decisions you made and why\n- What you would do differently\n\n## Portfolio Pieces to Include\n\n1. **Capstone project**: Your most impressive, comprehensive work\n2. **Technical showcase**: Something that demonstrates deep skill\n3. **Creative piece**: Something that shows originality and personality\n4. **Collaboration**: Something you built with others\n5. **Quick win**: Something impressive that you completed rapidly\n\n## Presenting Your Work\n\nFor each piece, write:\n- **Title**: Clear, descriptive\n- **Overview**: What it is (1-2 sentences)\n- **Challenge**: What problem were you solving?\n- **Approach**: How did you tackle it?\n- **Outcome**: What was the result?\n- **Learnings**: What did you learn?\n\n## Where to Host Your Portfolio\n\n- Personal website (most professional)\n- GitHub (for technical work)\n- Social media (for creative work)\n- LifeOS journal (for personal tracking)\n\n## Continuous Updates\n\nYour portfolio is never finished. Update it:\n- Remove older, weaker pieces as you create better ones\n- Add new work quarterly\n- Refresh descriptions and context\n- Keep it aligned with your current goals`,
          keyPoints: ['Quality over quantity: 3-5 excellent pieces', 'Show process and decisions, not just final results', 'Include variety: capstone, technical, creative, collaborative', 'Update your portfolio quarterly with your best new work'],
        },
        {
          title: 'Lifelong Learning',
          description: 'Build habits for continuous growth beyond this curriculum.',
          estimatedMinutes: 25,
          content: `# Lifelong Learning\n\nCompleting this curriculum is a milestone, not a finish line. The most successful practitioners in any field are those who never stop learning.\n\n## The Growth Mindset\n\nCarol Dweck's research shows two mindsets:\n- **Fixed mindset**: "I am either good at this or I am not"\n- **Growth mindset**: "I can improve through effort and practice"\n\nThe growth mindset is essential for lifelong learning. Every challenge is an opportunity to improve.\n\n## Building a Learning System\n\n### Daily (15-30 min)\n- Read one article or watch one tutorial in your field\n- Practice a specific skill for 15 minutes\n- Review notes from previous learning\n\n### Weekly (1-2 hours)\n- Deep-dive into one topic\n- Work on a personal project\n- Engage with a community (forum, meetup, social media)\n\n### Monthly\n- Reflect on what you have learned\n- Identify gaps and create a learning plan\n- Update your portfolio\n- Set learning goals for the next month\n\n### Quarterly\n- Take a course or workshop\n- Read a book in your field\n- Attend a conference or meetup\n- Re-evaluate your learning direction\n\n## Staying Current\n\n- Subscribe to key newsletters and blogs\n- Follow leaders on social media\n- Join professional communities\n- Set up Google Alerts for topics you care about\n\n## The Compounding Effect\n\n15 minutes per day = 91 hours per year. Over 5 years, that is 455 hours of focused learning. This is enough to become genuinely skilled in almost any field.\n\n## Your Next Steps\n\n1. Choose one area within ${topic} to deepen\n2. Set a 90-day learning goal\n3. Create a daily study habit in LifeOS\n4. Find one community to join\n5. Start your next project\n\nThe journey continues. You now have the tools, the knowledge, and the momentum. Keep going.`,
          keyPoints: ['Growth mindset: ability improves through effort', 'Daily practice compounds: 15 min/day = 91 hours/year', 'Build a learning system: daily, weekly, monthly, quarterly', 'Set a 90-day goal and create a daily study habit'],
        },
      ],
    },
  ];
}
