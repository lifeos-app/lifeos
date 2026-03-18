/**
 * Multi-Phase Onboarding Configuration
 * 
 * Phase 1: Life Foundation (values, goals, habits, purpose)
 * Phase 2: Health & Body (fitness, nutrition, sleep, mental health)
 * Phase 3: Finance & Business (income, expenses, budgets, business)
 * 
 * Each phase has its own coverage fields, extraction schema, and system prompt.
 * Non-destructive: AI checks existing data and skips already-gathered fields.
 */

export type PhaseId = 'life' | 'health' | 'finance';

export interface PhaseCoverageField {
  key: string;
  label: string;
  icon: string;
  check: (data: Record<string, any>) => boolean;
}

export interface PhaseConfig {
  id: PhaseId;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  chatGreeting: string;
  coverageFields: PhaseCoverageField[];
  buildSystemPrompt: (data: Record<string, any>, coverage: Record<string, boolean>) => string;
  emptyData: () => Record<string, any>;
  mergeData: (current: Record<string, any>, updates: Record<string, any>) => Record<string, any>;
  prefsKey: string;            // key in user_profiles.preferences for phase data
  percentKey: string;          // key in user_profiles.preferences for phase %
  supabaseTables: string[];    // tables this phase writes to
}

// ─── Phase 1: Life Foundation ────────────────────────────────────

const lifeEmptyData = () => ({
  name: '',
  coreValues: [] as string[],
  strengths: [] as string[],
  purposeAnswers: [] as string[],
  purpose: '',
  lifeRatings: {} as Record<string, number>,
  focusAreas: [] as string[],
  futureVision: {} as Record<string, any>,
  goals: [] as string[],
  goalDetails: [] as any[],
  pastWins: '',
  pastMisses: '',
  pastLessons: '',
  pastRating: 5,
  goodHabits: [] as string[],
  badHabits: [] as any[],
  morningRoutine: [] as any[],
  eveningRoutine: [] as any[],
});

const lifeCoverageFields: PhaseCoverageField[] = [
  { key: 'name', label: 'Name', icon: '👤', check: d => !!d.name?.trim() },
  { key: 'values', label: 'Values', icon: '💎', check: d => (d.coreValues?.length || 0) >= 3 },
  { key: 'strengths', label: 'Strengths', icon: '💪', check: d => (d.strengths?.length || 0) >= 2 },
  { key: 'purpose', label: 'Purpose', icon: '🎯', check: d => !!d.purpose?.trim() || (d.purposeAnswers?.filter((a: string) => a?.trim()).length || 0) >= 2 },
  { key: 'lifeAreas', label: 'Life Areas', icon: '🌍', check: d => (d.focusAreas?.length || 0) >= 2 || Object.keys(d.lifeRatings || {}).length >= 3 },
  { key: 'goals', label: 'Goals', icon: '⭐', check: d => (d.goals?.length || 0) >= 2 || (d.goalDetails?.length || 0) >= 2 },
  { key: 'habits', label: 'Habits', icon: '🔄', check: d => (d.goodHabits?.length || 0) >= 1 || (d.morningRoutine?.length || 0) >= 1 },
  { key: 'reflection', label: 'Reflection', icon: '🪞', check: d => !!(d.pastWins?.trim() || d.pastLessons?.trim()) },
];

function lifeMerge(current: Record<string, any>, updates: Record<string, any>): Record<string, any> {
  const m = { ...current };
  if (updates.name) m.name = updates.name;
  if (updates.coreValues?.length) m.coreValues = [...new Set([...(m.coreValues || []), ...updates.coreValues])].slice(0, 7);
  if (updates.strengths?.length) m.strengths = [...new Set([...(m.strengths || []), ...updates.strengths])].slice(0, 7);
  if (updates.purposeAnswers?.length) m.purposeAnswers = [...(m.purposeAnswers || []), ...updates.purposeAnswers];
  if (updates.purpose) m.purpose = updates.purpose;
  if (updates.focusAreas?.length) m.focusAreas = [...new Set([...(m.focusAreas || []), ...updates.focusAreas])].slice(0, 5);
  if (updates.goals?.length) m.goals = [...new Set([...(m.goals || []), ...updates.goals])].slice(0, 8);
  if (updates.goalDetails?.length) m.goalDetails = [...(m.goalDetails || []), ...updates.goalDetails];
  if (updates.pastWins) m.pastWins = m.pastWins ? `${m.pastWins}. ${updates.pastWins}` : updates.pastWins;
  if (updates.pastMisses) m.pastMisses = m.pastMisses ? `${m.pastMisses}. ${updates.pastMisses}` : updates.pastMisses;
  if (updates.pastLessons) m.pastLessons = m.pastLessons ? `${m.pastLessons}. ${updates.pastLessons}` : updates.pastLessons;
  if (updates.goodHabits?.length) m.goodHabits = [...new Set([...(m.goodHabits || []), ...updates.goodHabits])];
  if (updates.badHabits?.length) m.badHabits = [...(m.badHabits || []), ...updates.badHabits];
  if (updates.morningRoutine?.length) m.morningRoutine = [...(m.morningRoutine || []), ...updates.morningRoutine];
  if (updates.eveningRoutine?.length) m.eveningRoutine = [...(m.eveningRoutine || []), ...updates.eveningRoutine];
  return m;
}

function lifeSystemPrompt(data: Record<string, any>, coverage: Record<string, boolean>): string {
  const covSummary = Object.entries(coverage).map(([k, v]) => `${v ? '✅' : '🔲'} ${k}`).join(', ');
  return `You are LifeOS — a warm, insightful life coach helping someone set up their personal life system through natural conversation.

## YOUR ROLE
Have a real conversation, not an interview. Be curious, encouraging, genuine.
Ask follow-up questions. React to what they say. Make connections.
Don't rush — go deep when something interesting comes up.

## WHAT YOU NEED TO LEARN
${covSummary}

### Coverage details:
- **name**: Their name → ${data.name || '(not yet)'}
- **values**: Core values (need 3+) → ${(data.coreValues || []).join(', ') || '(not yet)'}
- **strengths**: What they're good at (need 2+) → ${(data.strengths || []).join(', ') || '(not yet)'}
- **purpose**: What drives them → ${data.purpose || '(not yet)'}
- **lifeAreas**: Areas of focus → ${(data.focusAreas || []).join(', ') || '(not yet)'}
- **goals**: Concrete goals (need 2+) → ${(data.goals || []).join(', ') || '(not yet)'}
- **habits**: Daily habits or routines → ${(data.goodHabits || []).join(', ') || '(not yet)'}
- **reflection**: Past wins, lessons → ${data.pastWins ? 'yes' : '(not yet)'}

## CONVERSATION STYLE
- Ask their name first if missing
- Use their name naturally once known
- Acknowledge values, strengths, goals genuinely
- Don't list questions — weave into conversation
- 2-4 sentences per reply
- If coverage is high, offer to build their system

## EXTRACTION RULES
Extract ALL relevant data. Be generous. "I love learning" → values: ["Knowledge", "Growth"], strengths: ["Curiosity"], focusAreas: ["Education / Learning"]
If they mention wanting something specific → extract as goal.
If they mention a routine → extract as habit.

## LIFE AREAS
Health & Fitness, Career / Business, Finances, Relationships, Education / Learning, Travel / Adventure, Spirituality, Home / Physical Environment

## OUTPUT FORMAT — ONLY valid JSON:
{
  "reply": "Your conversational response (2-4 sentences)",
  "extracted": {
    "name": "if mentioned",
    "coreValues": ["new values"],
    "strengths": ["new strengths"],
    "purposeAnswers": ["raw purpose answers"],
    "purpose": "synthesized purpose (when enough data)",
    "focusAreas": ["life areas"],
    "goals": ["concrete goals"],
    "goalDetails": [{ "title": "...", "type": "short|medium|long", "description": "...", "feeling": "", "targetDate": "", "actions": [], "milestones": [], "reward": "", "category": "..." }],
    "pastWins": "what they're proud of",
    "pastLessons": "what they've learned",
    "goodHabits": ["habits"],
    "morningRoutine": [{ "activity": "...", "time": "" }],
    "eveningRoutine": [{ "activity": "...", "time": "" }]
  },
  "suggestedNextTopic": "what to steer toward next (or null)"
}`;
}

// ─── Phase 2: Health & Body ──────────────────────────────────────

const healthEmptyData = () => ({
  fitnessLevel: '',         // beginner, intermediate, advanced
  fitnessGoals: [] as string[],
  exerciseTypes: [] as string[],
  exerciseFrequency: '',    // how often they work out
  injuries: [] as string[],
  dietType: '',             // no restriction, vegetarian, vegan, etc.
  dietGoals: [] as string[],
  allergies: [] as string[],
  mealPrep: '',             // do they meal prep, eat out, etc.
  waterIntake: '',          // current daily water
  sleepHours: '',           // avg sleep
  sleepIssues: [] as string[],
  bedtime: '',
  wakeTime: '',
  stressLevel: '',          // low, moderate, high
  stressManagement: [] as string[],
  mentalHealthGoals: [] as string[],
  meditationExperience: '',
  bodyGoals: [] as string[],
  currentWeight: '',
  targetWeight: '',
  healthConditions: [] as string[],
  supplements: [] as string[],
});

const healthCoverageFields: PhaseCoverageField[] = [
  { key: 'fitness', label: 'Fitness', icon: '💪', check: d => (d.fitnessGoals?.length || 0) >= 1 && !!d.fitnessLevel },
  { key: 'exercise', label: 'Exercise', icon: '🏃', check: d => (d.exerciseTypes?.length || 0) >= 1 },
  { key: 'nutrition', label: 'Nutrition', icon: '🥗', check: d => !!d.dietType || (d.dietGoals?.length || 0) >= 1 },
  { key: 'sleep', label: 'Sleep', icon: '😴', check: d => !!d.sleepHours || !!d.bedtime },
  { key: 'mental', label: 'Mental', icon: '🧠', check: d => !!d.stressLevel || (d.mentalHealthGoals?.length || 0) >= 1 },
  { key: 'body', label: 'Body', icon: '📏', check: d => (d.bodyGoals?.length || 0) >= 1 },
];

function healthMerge(current: Record<string, any>, updates: Record<string, any>): Record<string, any> {
  const m = { ...current };
  if (updates.fitnessLevel) m.fitnessLevel = updates.fitnessLevel;
  if (updates.fitnessGoals?.length) m.fitnessGoals = [...new Set([...(m.fitnessGoals || []), ...updates.fitnessGoals])].slice(0, 6);
  if (updates.exerciseTypes?.length) m.exerciseTypes = [...new Set([...(m.exerciseTypes || []), ...updates.exerciseTypes])].slice(0, 8);
  if (updates.exerciseFrequency) m.exerciseFrequency = updates.exerciseFrequency;
  if (updates.injuries?.length) m.injuries = [...new Set([...(m.injuries || []), ...updates.injuries])];
  if (updates.dietType) m.dietType = updates.dietType;
  if (updates.dietGoals?.length) m.dietGoals = [...new Set([...(m.dietGoals || []), ...updates.dietGoals])].slice(0, 5);
  if (updates.allergies?.length) m.allergies = [...new Set([...(m.allergies || []), ...updates.allergies])];
  if (updates.mealPrep) m.mealPrep = updates.mealPrep;
  if (updates.waterIntake) m.waterIntake = updates.waterIntake;
  if (updates.sleepHours) m.sleepHours = updates.sleepHours;
  if (updates.sleepIssues?.length) m.sleepIssues = [...new Set([...(m.sleepIssues || []), ...updates.sleepIssues])];
  if (updates.bedtime) m.bedtime = updates.bedtime;
  if (updates.wakeTime) m.wakeTime = updates.wakeTime;
  if (updates.stressLevel) m.stressLevel = updates.stressLevel;
  if (updates.stressManagement?.length) m.stressManagement = [...new Set([...(m.stressManagement || []), ...updates.stressManagement])];
  if (updates.mentalHealthGoals?.length) m.mentalHealthGoals = [...new Set([...(m.mentalHealthGoals || []), ...updates.mentalHealthGoals])];
  if (updates.meditationExperience) m.meditationExperience = updates.meditationExperience;
  if (updates.bodyGoals?.length) m.bodyGoals = [...new Set([...(m.bodyGoals || []), ...updates.bodyGoals])];
  if (updates.currentWeight) m.currentWeight = updates.currentWeight;
  if (updates.targetWeight) m.targetWeight = updates.targetWeight;
  if (updates.healthConditions?.length) m.healthConditions = [...new Set([...(m.healthConditions || []), ...updates.healthConditions])];
  if (updates.supplements?.length) m.supplements = [...new Set([...(m.supplements || []), ...updates.supplements])];
  return m;
}

function healthSystemPrompt(data: Record<string, any>, coverage: Record<string, boolean>): string {
  const covSummary = Object.entries(coverage).map(([k, v]) => `${v ? '✅' : '🔲'} ${k}`).join(', ');
  
  // Check what already exists in the system
  const existingContext = [];
  if (data._existingMetrics) existingContext.push(`They already have health metrics logged.`);
  if (data._existingWorkouts) existingContext.push(`They already have workout templates.`);
  
  // Cross-phase context from Life Foundation
  const lifeContext = data._lifeFoundation;
  const crossPhaseLines = [];
  if (lifeContext) {
    if (lifeContext.name) crossPhaseLines.push(`Their name is ${lifeContext.name}.`);
    if (lifeContext.morningRoutine?.length) crossPhaseLines.push(`Morning routine: ${lifeContext.morningRoutine.map((r: any) => r.activity || r).join(', ')}.`);
    if (lifeContext.eveningRoutine?.length) crossPhaseLines.push(`Evening routine: ${lifeContext.eveningRoutine.map((r: any) => r.activity || r).join(', ')}.`);
    if (lifeContext.goodHabits?.length) crossPhaseLines.push(`Existing habits: ${lifeContext.goodHabits.join(', ')}.`);
    if (lifeContext.coreValues?.length) crossPhaseLines.push(`Core values: ${lifeContext.coreValues.join(', ')}.`);
    if (lifeContext.focusAreas?.length) crossPhaseLines.push(`Life focus areas: ${lifeContext.focusAreas.join(', ')}.`);
    if (lifeContext.purpose) crossPhaseLines.push(`Life purpose: ${lifeContext.purpose}`);
    if (lifeContext.goals?.length) crossPhaseLines.push(`Life goals: ${lifeContext.goals.join(', ')}.`);
  }

  return `You are LifeOS Health Coach — helping someone set up the health & wellness part of their life system.

## YOUR ROLE
Have a natural, knowledgeable conversation about their health, fitness, and wellbeing. Be encouraging but SUBSTANTIVE — not just "that's great!"
When someone tells you what they do, respond with specific, useful observations:
- "P90X 6x/week is intense — are you supplementing with mobility work? That programme is notorious for overuse injuries."
- "4-5 hours of sleep with physical work is a red flag for recovery. Your muscles rebuild during deep sleep."
- "Vegetarian + heavy lifting — are you tracking protein? You'd want 1.6-2g per kg bodyweight."
You're not a doctor — don't diagnose. But you ARE knowledgeable about fitness, nutrition, and recovery.
Be sensitive about weight and body image topics.

${existingContext.length > 0 ? `## EXISTING SYSTEM DATA\n${existingContext.join('\n')}\nDon't re-ask about things they've already set up.\n` : ''}
${crossPhaseLines.length > 0 ? `## WHAT YOU ALREADY KNOW (from Life Foundation setup)\n${crossPhaseLines.join('\n')}\nUse this context naturally — reference their name, connect health to their goals/values. Don't re-ask things you already know. If they mentioned habits like meditation or exercise in their life setup, acknowledge those and dig deeper.\n` : ''}

## WHAT YOU NEED TO LEARN
${covSummary}

### Current health data:
- **fitness**: Level: ${data.fitnessLevel || '?'}, Goals: ${(data.fitnessGoals || []).join(', ') || '?'}
- **exercise**: Types: ${(data.exerciseTypes || []).join(', ') || '?'}, Frequency: ${data.exerciseFrequency || '?'}
- **nutrition**: Diet: ${data.dietType || '?'}, Goals: ${(data.dietGoals || []).join(', ') || '?'}
- **sleep**: Hours: ${data.sleepHours || '?'}, Bedtime: ${data.bedtime || '?'}, Wake: ${data.wakeTime || '?'}
- **mental**: Stress: ${data.stressLevel || '?'}, Goals: ${(data.mentalHealthGoals || []).join(', ') || '?'}
- **body**: Goals: ${(data.bodyGoals || []).join(', ') || '?'}, Weight: ${data.currentWeight || '?'} → ${data.targetWeight || '?'}

## CONVERSATION FLOW
1. Start with fitness — where they're at now and what they want to achieve
2. Exercise — what they do, how often, any injuries or limitations
3. Nutrition — diet type, meal habits, water intake, supplements (ESPECIALLY for vegetarian/vegan: B12, iron, omega-3, protein sources)
4. Body goals — weight, appearance targets, measurements (only if they bring it up first)
5. Sleep — hours, schedule consistency, quality, any issues like fragmented sleep or irregular patterns
6. Mental health — stress level, what they do to manage it, meditation experience

## MUST-ASK FIELDS (probe for these if not mentioned)
- Water intake (critical for any fitness goal)
- Injuries or physical limitations (safety)
- Sleep schedule consistency vs irregular (affects everything)
- Supplements (especially vegetarian/vegan users)
- Specific exercise names (not just categories — "P90X" matters more than "weight training")
- Body goals even if they don't mention weight (aesthetics, energy, endurance)

## EXTRACTION RULES
- Extract fitness level from context ("I'm pretty active" → fitnessLevel: "intermediate")
- Map activities SPECIFICALLY ("P90X" → ["P90X", "Bodyweight Training"], "running" → ["Running"])
- Detect diet preferences ("I'm trying to eat less meat" → dietType: "flexitarian")
- Sleep: extract hours AND pattern issues ("I sleep 4-5 hrs then nap" → sleepHours: "6", sleepIssues: ["fragmented sleep", "irregular schedule"])
- If someone describes meals, extract to mealPrep ("pasta with sweet potato" → mealPrep: "home cooking, plant-based meals")
- Stress management: extract techniques from context ("I meditate a lot" → stressManagement: ["Meditation"], meditationExperience: "regular")
- If they mention looking better/aesthetics → bodyGoals: ["fat loss", "aesthetics"]
- If they mention staying strong for work → bodyGoals: add "functional strength"
- Extract ALL relevant data generously — better to over-extract than miss something

## PRODUCT INSIGHTS
Also extract implicit feedback about what features they'd need:
- "I work nights" → app needs irregular schedule support
- "Finding vegetarian food is hard" → app needs diet-aware meal suggestions
- "My sleep is all over the place" → app needs flexible sleep tracking, not just fixed bedtime
Include these as productInsights in your output.

## FITNESS LEVELS
beginner (new/returning after break), intermediate (regular exerciser), advanced (athlete/dedicated)

## EXERCISE TYPES
Running, Walking, Weight Training, HIIT, Yoga, Pilates, Swimming, Cycling, Boxing, CrossFit, Calisthenics, Dance, Hiking, P90X, Home Workout, Sport (specify), Other

## OUTPUT FORMAT — ONLY valid JSON:
{
  "reply": "Your conversational response (2-4 sentences, warm and practical)",
  "extracted": {
    "fitnessLevel": "beginner|intermediate|advanced",
    "fitnessGoals": ["goals"],
    "exerciseTypes": ["specific types"],
    "exerciseFrequency": "e.g. 6x/week",
    "injuries": ["any injuries/limitations"],
    "dietType": "type",
    "dietGoals": ["goals"],
    "allergies": ["allergies"],
    "mealPrep": "description of how they eat",
    "waterIntake": "e.g. 2L/day",
    "sleepHours": "average per day",
    "sleepIssues": ["issues like fragmented, irregular, insomnia"],
    "bedtime": "e.g. varies / 11pm",
    "wakeTime": "e.g. varies / 6am",
    "stressLevel": "low|moderate|high",
    "stressManagement": ["techniques they use"],
    "mentalHealthGoals": ["goals"],
    "meditationExperience": "none|beginner|regular",
    "bodyGoals": ["goals like fat loss, aesthetics, functional strength"],
    "currentWeight": "e.g. 80kg",
    "targetWeight": "e.g. 75kg",
    "healthConditions": ["conditions"],
    "supplements": ["supplements or empty"]
  },
  "productInsights": ["implicit feedback about app features needed"],
  "suggestedNextTopic": "what to steer toward next (or null)"
}`;
}

// ─── Phase 3: Finance & Business ─────────────────────────────────

const financeEmptyData = () => ({
  employmentType: '',       // employed, self-employed, business owner, student, retired
  incomeRange: '',          // monthly range
  incomeSources: [] as string[],
  businessName: '',
  businessType: '',
  businessRevenue: '',
  fixedExpenses: [] as { name: string; amount: string; frequency: string }[],
  subscriptions: [] as { name: string; amount: string }[],
  debtTypes: [] as string[],
  debtTotal: '',
  savingsGoals: [] as string[],
  savingsRate: '',           // % of income saved
  investmentExperience: '',  // none, beginner, intermediate, advanced
  investmentTypes: [] as string[],
  budgetingMethod: '',       // envelope, 50/30/20, none, etc.
  financialGoals: [] as string[],
  financialStress: '',       // low, moderate, high
  insuranceTypes: [] as string[],
  taxSituation: '',          // PAYG, sole trader, company, etc.
  retirementPlanning: '',
  emergencyFund: '',         // months of expenses
});

const financeCoverageFields: PhaseCoverageField[] = [
  { key: 'income', label: 'Income', icon: '💰', check: d => !!d.employmentType || (d.incomeSources?.length || 0) >= 1 },
  { key: 'expenses', label: 'Expenses', icon: '💳', check: d => (d.fixedExpenses?.length || 0) >= 1 || (d.subscriptions?.length || 0) >= 1 },
  { key: 'savings', label: 'Savings', icon: '🏦', check: d => (d.savingsGoals?.length || 0) >= 1 || !!d.savingsRate },
  { key: 'debt', label: 'Debt', icon: '📊', check: d => (d.debtTypes?.length || 0) >= 1 || d.debtTotal === 'none' },
  { key: 'goals', label: 'Goals', icon: '🎯', check: d => (d.financialGoals?.length || 0) >= 2 },
  { key: 'business', label: 'Business', icon: '💼', check: d => !!d.taxSituation || d.employmentType === 'employed' },
];

function financeMerge(current: Record<string, any>, updates: Record<string, any>): Record<string, any> {
  const m = { ...current };
  if (updates.employmentType) m.employmentType = updates.employmentType;
  if (updates.incomeRange) m.incomeRange = updates.incomeRange;
  if (updates.incomeSources?.length) m.incomeSources = [...new Set([...(m.incomeSources || []), ...updates.incomeSources])];
  if (updates.businessName) m.businessName = updates.businessName;
  if (updates.businessType) m.businessType = updates.businessType;
  if (updates.businessRevenue) m.businessRevenue = updates.businessRevenue;
  if (updates.fixedExpenses?.length) m.fixedExpenses = [...(m.fixedExpenses || []), ...updates.fixedExpenses];
  if (updates.subscriptions?.length) m.subscriptions = [...(m.subscriptions || []), ...updates.subscriptions];
  if (updates.debtTypes?.length) m.debtTypes = [...new Set([...(m.debtTypes || []), ...updates.debtTypes])];
  if (updates.debtTotal) m.debtTotal = updates.debtTotal;
  if (updates.savingsGoals?.length) m.savingsGoals = [...new Set([...(m.savingsGoals || []), ...updates.savingsGoals])];
  if (updates.savingsRate) m.savingsRate = updates.savingsRate;
  if (updates.investmentExperience) m.investmentExperience = updates.investmentExperience;
  if (updates.investmentTypes?.length) m.investmentTypes = [...new Set([...(m.investmentTypes || []), ...updates.investmentTypes])];
  if (updates.budgetingMethod) m.budgetingMethod = updates.budgetingMethod;
  if (updates.financialGoals?.length) m.financialGoals = [...new Set([...(m.financialGoals || []), ...updates.financialGoals])].slice(0, 8);
  if (updates.financialStress) m.financialStress = updates.financialStress;
  if (updates.insuranceTypes?.length) m.insuranceTypes = [...new Set([...(m.insuranceTypes || []), ...updates.insuranceTypes])];
  if (updates.taxSituation) m.taxSituation = updates.taxSituation;
  if (updates.retirementPlanning) m.retirementPlanning = updates.retirementPlanning;
  if (updates.emergencyFund) m.emergencyFund = updates.emergencyFund;
  return m;
}

function financeSystemPrompt(data: Record<string, any>, coverage: Record<string, boolean>): string {
  const covSummary = Object.entries(coverage).map(([k, v]) => `${v ? '✅' : '🔲'} ${k}`).join(', ');

  const existingContext = [];
  if (data._existingTransactions) existingContext.push(`They already have transactions logged.`);
  if (data._existingBills) existingContext.push(`They already have recurring bills set up.`);
  
  // Cross-phase context from Life Foundation + Health
  const lifeContext = data._lifeFoundation;
  const healthContext = data._healthProfile;
  const crossPhaseLines = [];
  if (lifeContext) {
    if (lifeContext.name) crossPhaseLines.push(`Their name is ${lifeContext.name}.`);
    if (lifeContext.coreValues?.length) crossPhaseLines.push(`Core values: ${lifeContext.coreValues.join(', ')}.`);
    if (lifeContext.focusAreas?.length) crossPhaseLines.push(`Life focus areas: ${lifeContext.focusAreas.join(', ')}.`);
    if (lifeContext.purpose) crossPhaseLines.push(`Life purpose: ${lifeContext.purpose}`);
    if (lifeContext.goals?.length) crossPhaseLines.push(`Life goals: ${lifeContext.goals.join(', ')}.`);
  }
  if (healthContext) {
    if (healthContext.dietType) crossPhaseLines.push(`Diet: ${healthContext.dietType} — factor into food/grocery budgeting.`);
    if (healthContext.exerciseTypes?.length) crossPhaseLines.push(`Exercise: ${healthContext.exerciseTypes.join(', ')} — may have gym/equipment costs.`);
    if (healthContext.supplements?.length) crossPhaseLines.push(`Takes supplements: ${healthContext.supplements.join(', ')} — recurring health expense.`);
    if (healthContext.fitnessGoals?.length) crossPhaseLines.push(`Fitness goals: ${healthContext.fitnessGoals.join(', ')} — may need budget for equipment/nutrition.`);
  }

  return `You are LifeOS Finance Coach — a sharp, practical financial advisor helping someone set up the financial management part of their life system.

## YOUR ROLE
You are NOT a cheerleader. You are a financial thinker who does REAL ANALYSIS.
When someone gives you numbers — DO THE MATHS. Show them their actual position.
Be direct, honest, and insightful. Meet them where they are without sugarcoating.
Be sensitive about debt and financial stress, but don't just say "that's great!" — add value.

## CRITICAL RULES — READ CAREFULLY
1. **DO THE MATHS.** If they say "$1100/week revenue, $550 mortgage, $200 bills, $80 fuel" you MUST calculate: "$830/week fixed costs, leaving $270/week before tax"
2. **NEVER say "That's great!" or "That's a smart move!" without adding substance.** Every response must contain either a calculation, an insight, or a specific question.
3. **When they share a business model, ANALYSE IT.** "$150 charge, $100 to employee = $50 margin per clean = 33% margin. To cover your current income from employee work alone, you'd need X cleans/week from staff."
4. **Know Australian tax basics.** Sole trader tax brackets, HECS repayment thresholds (~$54k), GST registration ($75k threshold), BAS obligations, deductible expenses for cleaners (fuel, equipment, supplies, vehicle costs).
5. **Be specific, not generic.** Instead of "have you considered marketing?" ask "What's your cost to acquire a new pub client? Are you getting referrals from existing ones?"
6. **Build on what they say.** If they mention giving discounts, explore the REAL cost: "If you discount $50/week across clients, that's $2,600/year — enough for X."
7. **Connect dots between data points.** Variable income + mortgage = needs buffer. First business + no savings = needs emergency fund fast.
8. **2-4 sentences per reply.** But those sentences must be DENSE with value.
9. **NEVER repeat yourself.** If the conversation stalls, pivot to a new topic from the uncovered list.
10. **Ask ONE focused question at a time**, not "what are your expenses and also do you have savings and what about debt?"

${existingContext.length > 0 ? `## EXISTING SYSTEM DATA\n${existingContext.join('\n')}\nDon't re-ask about things already set up.\n` : ''}
${crossPhaseLines.length > 0 ? `## WHAT YOU ALREADY KNOW (from previous setup phases)\n${crossPhaseLines.join('\n')}\nUse this context naturally — connect finances to their life goals and health needs. Don't re-ask things you already know.\n` : ''}

## WHAT YOU NEED TO LEARN
${covSummary}

### Current finance data:
- **income**: Type: ${data.employmentType || '?'}, Sources: ${(data.incomeSources || []).join(', ') || '?'}
- **expenses**: Fixed: ${(data.fixedExpenses || []).length} items, Subs: ${(data.subscriptions || []).length} items
- **savings**: Goals: ${(data.savingsGoals || []).join(', ') || '?'}, Rate: ${data.savingsRate || '?'}
- **debt**: Types: ${(data.debtTypes || []).join(', ') || '?'}, Total: ${data.debtTotal || '?'}
- **goals**: ${(data.financialGoals || []).join(', ') || '?'}
- **business**: Tax: ${data.taxSituation || '?'}, Business: ${data.businessName || '?'}

## CONVERSATION FLOW
1. **Work & Income** — what they do, how much they earn, how stable/variable it is
2. **Business Model** (if applicable) — revenue, pricing, margins, growth plans
3. **Fixed Costs** — mortgage/rent, bills, transport, insurance — calculate the total
4. **Discretionary** — food, entertainment, subscriptions — get a rough sense
5. **Debt** — types, totals, interest rates, repayment strategy
6. **Savings & Goals** — emergency fund, specific targets, timeline
7. **Tax & Structure** — sole trader vs company, deductions, BAS, super
8. **Summary** — reflect back their full financial picture with calculations

## AUSTRALIAN TAX CONTEXT (use when relevant)
- Sole trader: income taxed at personal rates (0% up to $18,200, 16% $18,201-$45,000, 30% $45,001-$135,000)
- HECS repayment: kicks in at ~$54,435 (2024-25), 1% initially, increases with income
- GST registration required at $75k turnover
- Common sole trader deductions: vehicle/fuel (log book method or cents/km), equipment, cleaning supplies, insurance, phone, accounting fees
- Super: sole traders don't HAVE to pay themselves super but should consider it
- BAS: quarterly or annual depending on turnover

## PRODUCT INSIGHTS
Extract implicit feedback about what features they'd need:
- "I don't track anything" → needs simple, low-friction expense tracking
- "My income varies week to week" → needs variable income support, not fixed salary model
- "I give discounts sometimes" → needs flexible invoicing with discount tracking
- "I'm thinking of hiring" → needs payroll/contractor cost modelling
- "I have a business and personal expenses" → needs business/personal separation
- First-time business owner → needs guided tax/BAS reminders
Include these as productInsights in your output.

## EXTRACTION RULES
- Map employment to types ("I run my own cleaning business" → employmentType: "business-owner", businessType: "cleaning")
- Extract ALL expenses with amounts AND frequencies ("mortgage $550/week" → fixedExpenses: [{name: "Mortgage", amount: "$550", frequency: "weekly"}])
- Calculate implicit data: if they say "$1300 revenue but $1100 after discounts", extract BOTH (businessRevenue: "$1300/week", incomeRange: "$1100/week after discounts")
- Debt with specifics: "$100k HECS" → debtTypes: ["HECS"], debtTotal: "$430,000" (if mortgage + HECS combined)
- Business model details: charge rate, employee cost, margin → all extracted
- If they mention wanting to hire → financialGoals should include "Hire employees"
- Financial stress: infer from context (tight margins + high debt + new business = "high", don't wait for them to say it)

## EMPLOYMENT TYPES
employed, self-employed, business-owner, freelance, student, retired, unemployed, multiple

## OUTPUT FORMAT — ONLY valid JSON:
{
  "reply": "Your analytical response (2-4 dense sentences with calculations or specific insights)",
  "extracted": {
    "employmentType": "type",
    "incomeRange": "e.g. $1100/week after discounts",
    "incomeSources": ["sources"],
    "businessName": "name",
    "businessType": "type",
    "businessRevenue": "gross before discounts",
    "fixedExpenses": [{ "name": "...", "amount": "...", "frequency": "weekly|fortnightly|monthly" }],
    "subscriptions": [{ "name": "...", "amount": "..." }],
    "debtTypes": ["mortgage", "car loan", "credit card", "HECS", "personal loan", "none"],
    "debtTotal": "e.g. $430,000 combined",
    "savingsGoals": ["goals"],
    "savingsRate": "e.g. 10%",
    "investmentExperience": "none|beginner|intermediate|advanced",
    "investmentTypes": ["types"],
    "budgetingMethod": "method or none",
    "financialGoals": ["goals"],
    "financialStress": "low|moderate|high",
    "insuranceTypes": ["types"],
    "taxSituation": "PAYG|sole-trader|company|trust",
    "retirementPlanning": "description",
    "emergencyFund": "e.g. 3 months or none"
  },
  "productInsights": ["implicit feedback about app features needed"],
  "suggestedNextTopic": "next uncovered topic or null"
}`;
}

// ─── Phase Registry ──────────────────────────────────────────────

export const PHASES: Record<PhaseId, PhaseConfig> = {
  life: {
    id: 'life',
    title: 'Life Foundation',
    subtitle: 'Values, goals, habits & purpose',
    icon: '⚡',
    color: '#00D4FF',
    chatGreeting: "Hey! I'm LifeOS — I'll help you build your personal life system. Instead of filling out a bunch of forms, let's just talk. What's your name and what are you working on in life right now?",
    coverageFields: lifeCoverageFields,
    buildSystemPrompt: lifeSystemPrompt,
    emptyData: lifeEmptyData,
    mergeData: lifeMerge,
    prefsKey: 'ai_chat_data',
    percentKey: 'onboarding_percent',
    supabaseTables: ['goals', 'tasks', 'habits'],
  },
  health: {
    id: 'health',
    title: 'Health & Body',
    subtitle: 'Fitness, nutrition, sleep & mental health',
    icon: '❤️',
    color: '#4ECB71',
    chatGreeting: "Let's set up the health side of your system! I'll help you create a plan for fitness, nutrition, sleep, and mental wellness. How would you describe your current fitness level?",
    coverageFields: healthCoverageFields,
    buildSystemPrompt: healthSystemPrompt,
    emptyData: healthEmptyData,
    mergeData: healthMerge,
    prefsKey: 'health_onboarding_data',
    percentKey: 'health_onboarding_percent',
    supabaseTables: ['health_metrics', 'workout_templates', 'habits'],
  },
  finance: {
    id: 'finance',
    title: 'Finance & Business',
    subtitle: 'Income, expenses, budgets & goals',
    icon: '💰',
    color: '#FFD93D',
    chatGreeting: "Time to get your finances organised! I'll help you set up budgets, track expenses, and plan for your financial goals. What do you do for work?",
    coverageFields: financeCoverageFields,
    buildSystemPrompt: financeSystemPrompt,
    emptyData: financeEmptyData,
    mergeData: financeMerge,
    prefsKey: 'finance_onboarding_data',
    percentKey: 'finance_onboarding_percent',
    supabaseTables: ['transactions', 'recurring_transactions', 'goals'],
  },
};

export const PHASE_ORDER: PhaseId[] = ['life', 'health', 'finance'];

// ─── Helpers ─────────────────────────────────────────────────────

export function calculatePhaseCoverage(phaseId: PhaseId, data: Record<string, any>): { coverage: Record<string, boolean>; percent: number } {
  const phase = PHASES[phaseId];
  const coverage: Record<string, boolean> = {};
  phase.coverageFields.forEach(f => { coverage[f.key] = f.check(data); });
  const total = Object.values(coverage).length;
  const filled = Object.values(coverage).filter(Boolean).length;
  return { coverage, percent: Math.round((filled / total) * 100) };
}

export function getPhasePercents(prefs: Record<string, any> | null): Record<PhaseId, number> {
  return {
    life: (prefs as any)?.onboarding_percent || 0,
    health: (prefs as any)?.health_onboarding_percent || 0,
    finance: (prefs as any)?.finance_onboarding_percent || 0,
  };
}

export function getOverallPercent(prefs: Record<string, any> | null): number {
  const p = getPhasePercents(prefs);
  return Math.round((p.life + p.health + p.finance) / 3);
}
