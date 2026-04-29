/**
 * Education Manifest — Single source of truth connecting all education engines.
 *
 * Ties together the SRS engine, challenge engine, roadmap engine, and tutor
 * engine into a unified manifest with seed data, queries, and stats.
 */
import type { SRSCard, Rating } from './srs-engine';
import type { Challenge } from './challenge-engine';
import type { LearningPath } from './roadmap-engine';
import { STUDY_DECKS } from '../stores/useKnowledgeStore';
import { LEARNING_PATHS } from '../data/learning-paths';

// ════════════════════════════════════════════════════════════════════════════
// Seed Data — Built-in knowledge cards that are always available
// ════════════════════════════════════════════════════════════════════════════

const HERMETIC_PRINCIPLE_NAMES = [
  'Mentalism', 'Correspondence', 'Vibration', 'Polarity',
  'Rhythm', 'Cause & Effect', 'Gender'
];

const HERMETIC_PRINCIPLE_AXIOMS = [
  'The All is Mind; the Universe is Mental.',
  'As above, so below; as below, so above.',
  'Nothing rests; everything moves; everything vibrates.',
  'Everything is dual; everything has poles; everything has its pair of opposites.',
  'Everything flows, out and in; the pendulum swing manifests in everything.',
  'Every cause has its effect; every effect has its cause.',
  'Gender is in everything; everything has its masculine and feminine principles.'
];

function makeCard(id: string, deckId: string, front: string, back: string, hermeticPrinciple?: number, tags?: string[], source?: string): SRSCard {
  return {
    id,
    deckId,
    front,
    back,
    tags: tags || [],
    hermeticPrinciple,
    source: source || 'lifeos',
    state: 'new',
    ease: 2.5,
    interval: 0,
    due: 0,
    lapses: 0,
    reviews: 0,
    lastReview: 0,
    elapsedDays: 0,
  };
}

// ── Hermetic Principle Cards (4 per principle = 28) ──

const HERMETIC_CARDS: SRSCard[] = [
  // MENTALISM (0)
  makeCard('hp-mentalism-1', 'hermetic-principles',
    'How does the Principle of Mentalism apply to goal setting?',
    'The Universe is Mental — your goals exist first as thoughts. Before anything manifests in physical reality, it must exist as a clear mental image. When you set a goal, you\'re literally creating a mental blueprint that your subconscious begins working toward. This is why visualization and clarity matter: a fuzzy goal produces fuzzy results. Write goals as if they\'re already real — "I am running a profitable cleaning business" not "I want to maybe start..."',
    0, ['mentalism', 'goals', 'manifestation'], 'lifeos'),
  makeCard('hp-mentalism-2', 'hermetic-principles',
    'What does "The All is Mind" mean for daily decision-making?',
    'Every decision you make is first a thought. The quality of your thoughts determines the quality of your decisions. When you\'re exhausted at 3am after a cleaning shift, your mental state is degraded — that\'s NOT the time to make business decisions. Mentalism teaches: guard your mental environment. Start each day with intentional thought-setting (journaling, planning) before reactive thinking (checking phone, reading emails) takes over.',
    0, ['mentalism', 'decisions', 'awareness'], 'lifeos'),
  makeCard('hp-mentalism-3', 'hermetic-principles',
    'How can Mentalism improve your habit formation?',
    'Habits are mental grooves — neural pathways strengthened by repetition. Mentalism reveals that habits are not behaviors but THOUGHT PATTERNS that produce behaviors. To change a habit, don\'t fight the behavior — replace the thought that precedes it. "I need to skip the gym" is the thought. Replace it with "I\'ll feel incredible after just 10 minutes." The mental shift comes first; the behavioral change follows automatically.',
    0, ['mentalism', 'habits', 'neural-pathways'], 'lifeos'),
  makeCard('hp-mentalism-4', 'hermetic-principles',
    'What is the practical meaning of "The Universe is Mental" for an entrepreneur?',
    'Your business reality is a direct reflection of your mental reality. If you believe clients are hard to find, your brain filters for evidence confirming that belief (confirmation bias). If you believe opportunities are everywhere, you\'ll start seeing them. Mentalism doesn\'t mean "just think positive" — it means your perception and beliefs are the LENS through which you experience reality. Change the lens, change the business.',
    0, ['mentalism', 'entrepreneurship', 'perception'], 'lifeos'),

  // CORRESPONDENCE (1)
  makeCard('hp-correspondence-1', 'hermetic-principles',
    'What does "As above, so below" mean for habit formation?',
    'Your micro-habits reflect your macro-outcomes. The way you make your bed, fold your clothes, or organize your cleaning kit CORRESPONDS to how you run your business. Sloppy small actions → sloppy business systems. Precise small actions → precise business execution. When you want to change your life, start with the smallest corresponding unit. Fix your morning routine, and watch your business discipline transform in parallel.',
    1, ['correspondence', 'habits', 'micro-macro'], 'lifeos'),
  makeCard('hp-correspondence-2', 'hermetic-principles',
    'How does Correspondence apply to business systems?',
    'Your personal financial management corresponds to your business financial management. If you don\'t track your personal expenses, you likely don\'t track your business costs properly either. The pattern repeats at every scale: how you do one thing is how you do everything. To build robust business systems, first build robust personal systems. The correspondence is exact.',
    1, ['correspondence', 'business', 'systems'], 'lifeos'),
  makeCard('hp-correspondence-3', 'hermetic-principles',
    'What can your energy levels tell you about your business health?',
    'Correspondence means your body\'s energy state mirrors your business\'s energy state. If you\'re constantly exhausted, your business is likely running on fumes too — overscheduled, under-resourced, or lacking clear priorities. Chronic fatigue is information, not just a symptom. It corresponds to structural problems in how you\'ve designed your work. Fix the structure, and the energy returns.',
    1, ['correspondence', 'energy', 'health'], 'lifeos'),
  makeCard('hp-correspondence-4', 'hermetic-principles',
    'How does the microcosm-macrocosm relationship apply to team dynamics?',
    'One difficult client interaction often corresponds to a pattern in how you handle ALL client interactions. A single conversation is the microcosm of your communication philosophy. If you find yourself defensive with one client, that defensiveness is present in your other relationships too — just less visibly. Correspondence teaches: study the small pattern (one interaction) to understand the large pattern (your relational default).',
    1, ['correspondence', 'relationships', 'patterns'], 'lifeos'),

  // VIBRATION (2)
  makeCard('hp-vibration-1', 'hermetic-principles',
    'How does the Principle of Vibration explain motivation?',
    'Motivation is literally a vibration — an energy frequency. It\'s never static. You don\'t "have" or "lack" motivation — you\'re always vibrating at some frequency. High frequencies (excitement, purpose, curiosity) produce action. Low frequencies (boredom, fear, doubt) produce inaction. The key: you can consciously raise your vibration through movement, music, environment change, or connecting to purpose. You\'re not broken when unmotivated — you\'re just at a low frequency.',
    2, ['vibration', 'motivation', 'energy'], 'lifeos'),
  makeCard('hp-vibration-2', 'hermetic-principles',
    'What does "everything vibrates" mean for business momentum?',
    'A business isn\'t a static entity — it\'s a vibrating system. When you have momentum (high vibration), opportunities seem to "magically" appear because your actions are frequent and energetic. When momentum drops (low vibration), everything feels harder. The practical lesson: maintain daily action to keep the business vibrating at a productive frequency. Even 15 minutes of focused business-building daily is better than 3 hours once a month.',
    2, ['vibration', 'momentum', 'business'], 'lifeos'),
  makeCard('hp-vibration-3', 'hermetic-principles',
    'How can you use Vibration to shift a bad day?',
    'When your vibration is low (frustrated, tired, stuck), you can shift it through: 1) Physical movement (10 min walk), 2) Music that energizes you, 3) Changing your environment (work somewhere new), 4) Connecting to a bigger purpose (why you started), 5) Helping someone else (raises frequency fastest). You don\'t have to wait for the bad day to end — you can consciously raise the vibration.',
    2, ['vibration', 'state-change', 'practical'], 'lifeos'),
  makeCard('hp-vibration-4', 'hermetic-principles',
    'How does Vibration relate to client relationships?',
    'People resonate with each other like tuning forks. When you\'re vibrating at a confident, professional frequency, clients respond to that — they trust you more, refer you more, and accept your rates more easily. When you\'re vibrating at a desperate, uncertain frequency, clients sense that too. The lesson: before client calls or meetings, deliberately raise your vibration. Stand up, breathe deep, remember your competence. The client will match your frequency.',
    2, ['vibration', 'clients', 'confidence'], 'lifeos'),

  // POLARITY (3)
  makeCard('hp-polarity-1', 'hermetic-principles',
    'How can the Principle of Polarity help with burnout?',
    'Burnout isn\'t the opposite of passion — it\'s the same thing at a different degree. Passion and burnout are on the same pole, like hot and cold are both temperature. This means you don\'t need to "find" passion again — you need to transmute the burnout back along the pole. How: reduce intensity, not direction. Keep doing what you love, but less hours. Same direction, lower polarity. The worst thing is to flip to the opposite pole (apathy) — that\'s much harder to recover from.',
    3, ['polarity', 'burnout', 'transmutation'], 'lifeos'),
  makeCard('hp-polarity-2', 'hermetic-principles',
    'What does Polarity teach about pricing your services?',
    'Cheap and expensive are the same pole — price. The art of pricing is transmuting "that\'s expensive" into "that\'s worth it" by shifting the client\'s perception along the pole, not to a different pole. You don\'t lower your price to the opposite pole (cheap). Instead, you increase perceived value until "expensive" transmutes to "valuable." The price stays the same; the perception shifts.',
    3, ['polarity', 'pricing', 'perception'], 'lifeos'),
  makeCard('hp-polarity-3', 'hermetic-principles',
    'How can you use Polarity to manage fear?',
    'Fear and excitement are the same energy at different degrees. The physiological response is identical — rapid heartbeat, heightened awareness, cortisol surge. The only difference is the mental label you put on it. When you feel fear about a business risk, consciously relabel it as excitement. "I\'m terrified about this pitch" becomes "I\'m excited about this pitch" — same body, shifted polarity. This isn\'t denial; it\'s transmutation.',
    3, ['polarity', 'fear', 'transmutation'], 'lifeos'),
  makeCard('hp-polarity-4', 'hermetic-principles',
    'How does Polarity explain the feast-famine cycle?',
    'Busy (feast) and quiet (famine) are poles of the same continuum — demand. When you\'re at one extreme, the swing back is inevitable. The art is: 1) Don\'t expand commitments during feast that you can\'t sustain during famine, 2) Use feast to prepare for famine (save, systemize, train), 3) Use famine to improve what you\'ll offer during feast (refine processes, acquire skills). Each pole contains the seed of its opposite.',
    3, ['polarity', 'cycles', 'business-cycles'], 'lifeos'),

  // RHYTHM (4)
  makeCard('hp-rhythm-1', 'hermetic-principles',
    'How can you use the Principle of Rhythm to prevent burnout?',
    'All energy cycles between expansion and contraction. You can\'t override Rhythm — you can only work WITH it. During expansion (high energy, lots of clients), schedule REST intentionally. During contraction (lower energy), focus on SYSTEMS and LEARNING. The mistake most entrepreneurs make: pushing hard during expansion until Rhythm FORCES a contraction (burnout). Instead, voluntarily contract (take a day off) while you can still choose to. You stay in rhythm instead of being broken by it.',
    4, ['rhythm', 'burnout', 'energy-management'], 'lifeos'),
  makeCard('hp-rhythm-2', 'hermetic-principles',
    'What does "the pendulum swing manifests in everything" mean for scheduling?',
    'Every peak has a valley. If you schedule 12-hour work days for a week, the following week will be unproductive regardless of willpower. The pendulum swing is universal. Smart scheduling means: alternate intense days with lighter days, alternate demanding clients with easier ones, alternate focused work with creative work. You\'re not "lazy" for needing recovery — you\'re obeying a universal law.',
    4, ['rhythm', 'scheduling', 'energy'], 'lifeos'),
  makeCard('hp-rhythm-3', 'hermetic-principles',
    'How does Rhythm apply to income patterns?',
    'Income flows in waves — monthly, quarterly, annually. Cleaning businesses especially: some months are feast (spring cleaning surge), some are famine (winter slowdown). Rhythm teaches: don\'t spend feast-income at feast-level. Calculate your average monthly income and budget to that. Save the surplus during peaks to fund the valleys. Rhythm isn\'t random — it\'s predictable if you track it. Map 12 months of income and you\'ll see the pattern.',
    4, ['rhythm', 'income', 'patterns'], 'lifeos'),
  makeCard('hp-rhythm-4', 'hermetic-principles',
    'How can you neutralize negative Rhythm swings?',
    'The Hermetic Masters taught the art of "neutralization" — using the Law of Rhythm against itself. When you feel the pendulum swinging toward negativity, don\'t resist it directly. Instead: 1) Acknowledge the swing ("this is Rhythm at work"), 2) Don\'t identify with the feeling ("I feel tired" not "I am tired"), 3) Take a small action in the opposite direction, 4) Wait — the swing WILL reverse. The key insight: you are not your state; you are the observer of your state.',
    4, ['rhythm', 'neutralization', 'emotional-intelligence'], 'lifeos'),

  // CAUSE & EFFECT (5)
  makeCard('hp-cause-1', 'hermetic-principles',
    'What role does Cause & Effect play in financial decisions?',
    'Every spending decision is a cause with compounding effects. Buying new cleaning equipment (cause) → higher efficiency on jobs (effect) → more jobs per day (compounding effect) → higher income (deeper compounding). But also: skipping equipment maintenance (cause) → equipment failure (effect) → missed job (compounding) → lost client (deeper compounding). The key: trace every cause forward AT LEAST 3 steps. "What will this purchase/decision/skip lead to in a week, month, year?"',
    5, ['cause-effect', 'finance', 'compounding'], 'lifeos'),
  makeCard('hp-cause-2', 'hermetic-principles',
    'How does Cause & Effect relate to decision journaling?',
    'A decision journal is a Cause & Feedback loop tool. When you record a decision, its reasoning, and its outcome, you\'re creating a traceable chain from cause to effect. Over time, patterns emerge: "When I decide X impulsively, outcome is Y. When I decide X after analysis, outcome is Z." This transforms decision-making from intuition alone to INTELLIGENCE. You start seeing which causes reliably produce which effects in YOUR specific context.',
    5, ['cause-effect', 'decisions', 'journaling'], 'lifeos'),
  makeCard('hp-cause-3', 'hermetic-principles',
    'What does "every effect has its cause" mean for recurring problems?',
    'A recurring problem means you\'re treating effects, not causes. Client complaints about cleaning quality? The cause is rarely the cleaning itself — it\'s usually training, time pressure, or unclear expectations set at booking. Fix the cleaning quality without fixing the cause, and the problem returns. Principle of Cause & Effect demands: ask "why" at least 5 times to find the root cause. Every recurring problem has a root you haven\'t addressed yet.',
    5, ['cause-effect', 'root-cause', 'problems'], 'lifeos'),
  makeCard('hp-cause-4', 'hermetic-principles',
    'How can you leverage Cause & Effect for passive business growth?',
    'Every system you build is a cause that produces effects even when you\'re absent. An SOP for cleaning a kitchen (cause) → consistent quality regardless of who does the job (effect). A referral program (cause) → new clients without active marketing (effect). The ultimate goal: create causes that produce effects autonomously. Each system you build is an employee that never sleeps. This is how a sole trader becomes a business owner — by transitioning from personal labor (temporary causes) to systems (permanent causes).',
    5, ['cause-effect', 'systems', 'growth'], 'lifeos'),

  // GENDER (6)
  makeCard('hp-gender-1', 'hermetic-principles',
    'What does the Principle of Gender mean for creative work?',
    'Gender in Hermeticism means the creative duality: the masculine (seed/idea/vision) and the feminine (nurture/develop/manifest). Every project needs both: a clear vision (masculine) AND patient development (feminine). Many entrepreneurs over-index on the masculine — launching ideas fast, starting things, chasing opportunities — without the feminine follow-through of nurturing what they\'ve started into maturity. Result: 11 ventures, most pre-revenue.',
    6, ['gender', 'creation', 'balance'], 'lifeos'),
  makeCard('hp-gender-2', 'hermetic-principles',
    'How does Gender apply to business planning vs execution?',
    'Planning is masculine: defining, structuring, projecting forward. Execution is feminine: nurturing, adapting, giving time. A business with too much planning and no execution has seeds that never germinate. A business with all execution and no planning has growth without direction. The sweet spot: short planning sprints (masculine) followed by longer execution cycles (feminine). Plan a week, execute for a month. Adjust. Repeat.',
    6, ['gender', 'planning', 'execution'], 'lifeos'),
  makeCard('hp-gender-3', 'hermetic-principles',
    'How can you use the Gender principle to break creative blocks?',
    'When you\'re stuck, you\'re usually in one polarity. If you can\'t generate ideas (masculine blocked), do something nurturing instead — clean, cook, tend to existing work. The feminine activity often births the masculine insight. If you can\'t finish anything (feminine blocked), generate a new seed — dream, brainstorm, set a wild goal. The masculine activity creates energy that pulls you into execution. When one pole is blocked, activate the other and let it pull you through.',
    6, ['gender', 'creative-blocks', 'polarity'], 'lifeos'),
  makeCard('hp-gender-4', 'hermetic-principles',
    'What is the warning sign of Gender imbalance in a business?',
    'Too much masculine: constant new projects, perpetual starting, inability to maintain and nurture, shiny object syndrome. Too much feminine: over-developing existing things, perfectionism, reluctance to launch until "ready," maintenance without growth. The warning sign: you\'re either always STARTING or always POLISHING. Healthy businesses oscillate between both — creating seeds, nurturing them to harvest, then creating again. The rhythm of Gender is: vision → nurture → manifest → repeat.',
    6, ['gender', 'imbalance', 'diagnosis'], 'lifeos'),
];

// ── System Design Cards (20) ──

const SYSTEM_DESIGN_CARDS: SRSCard[] = [
  makeCard('sd-1', 'system-design', 'Performance vs Scalability', 'Performance is about how fast a single request is processed. Scalability is about how the system handles increased load. A system can be performant but not scalable (fast for 1 user, crashes at 1000), or scalable but not performant (slow for each user but handles millions). The key insight: you optimize for performance up to your target, then optimize for scalability beyond that. For a cleaning business: fast service = performance. Handling more clients without burning out = scalability.', undefined, ['performance', 'scalability', 'architecture'], 'system-design-primer'),
  makeCard('sd-2', 'system-design', 'Latency vs Throughput', 'Latency = time for one operation. Throughput = operations per unit time. They\'re related but independent. You can have low latency and high throughput (ideal), high latency and high throughput (batch processing), or low latency and low throughput (underutilized system). For business: latency = how quickly you serve one client. Throughput = how many clients you serve per day. Improving one doesn\'t automatically improve the other.', undefined, ['latency', 'throughput', 'metrics'], 'system-design-primer'),
  makeCard('sd-3', 'system-design', 'Consistency Patterns: Strong vs Eventual', 'Strong consistency: all users see the same data simultaneously. Eventual consistency: users may see slightly different data temporarily, but it converges. Strong = banking (you must see correct balance). Eventual = social media (your like count may be slightly off for a minute). For your business: client scheduling needs strong consistency (double bookings = disaster), but reporting/analytics can use eventual consistency (yesterday\'s revenue doesn\'t need to be real-time).', undefined, ['consistency', 'patterns', 'data'], 'system-design-primer'),
  makeCard('sd-4', 'system-design', 'Load Balancing Strategies', 'Distribute incoming requests across multiple servers. Strategies: Round-robin (circular), Least connections (send to busiest server), IP hash (same client always goes to same server). For your cleaning business: "load balancing" is how you distribute jobs across days. Round-robin = even split. Least connections = give the job to the day with most availability. IP hash = same client always on the same day. Choose based on what you\'re optimizing for.', undefined, ['load-balancing', 'distribution', 'strategy'], 'system-design-primer'),
  makeCard('sd-5', 'system-design', 'Caching Strategies', 'Cache = keeping frequently accessed data close and fast. Cache-aside: application checks cache first, misses go to database. Write-through: writes go to cache AND database simultaneously. Write-behind: writes go to cache, database updated later. For business: caching = keeping frequently used tools/supplies in your kit instead of fetching from storage each time. The principle: identify what you access most and keep it closest to hand.', undefined, ['caching', 'performance', 'strategy'], 'system-design-primer'),
  makeCard('sd-6', 'system-design', 'Database Sharding', 'Sharding = splitting a database into smaller pieces (shards) spread across servers. Horizontal scaling for data. Key: pick a shard key that distributes evenly. Bad shard key = all data goes to one server (hot spot). For business: sharding is like having different teams handle different geographic areas. Rockbank → Team A. Greensborough → Team B. Each team handles their area independently but follows the same standards.', undefined, ['sharding', 'database', 'scaling'], 'system-design-primer'),
  makeCard('sd-7', 'system-design', 'CAP Theorem', 'In a distributed system, you can only guarantee 2 of 3: Consistency (all nodes see same data), Availability (every request gets a response), Partition tolerance (system works despite network failures). You MUST have partition tolerance, so the real choice is CP or AP. CP = consistent but may be unavailable during failures. AP = always available but may show stale data. For business: during a scheduling conflict (partition), do you turn away clients (CP) or risk double-booking (AP)?', undefined, ['cap', 'distributed-systems', 'tradeoffs'], 'system-design-primer'),
  makeCard('sd-8', 'system-design', 'Message Queues', 'Decouple producers from consumers using a queue. Producer writes message → queue stores it → consumer reads it later. Benefits: smooth traffic spikes, retry failed operations, independent scaling. For business: a message queue is your booking system. Client books (producer) → booking goes into schedule (queue) → you complete the job (consumer). Without the queue, you\'d need to handle everything simultaneously. The queue gives you time to process at your pace.', undefined, ['queues', 'decoupling', 'asynchronous'], 'system-design-primer'),
  makeCard('sd-9', 'system-design', 'Rate Limiting', 'Control the rate of requests to prevent system overload. Algorithms: Token bucket (constant refill, burst allowed), Leaky bucket (constant drain, no burst), Fixed window (count per time window), Sliding window (weighted recent count). For business: rate limiting = not overbooking yourself. You have a capacity (tokens). Each job uses one. They refill over time (rest). No rate limiting = you say yes to everything and crash.', undefined, ['rate-limiting', 'capacity', 'overload'], 'system-design-primer'),
  makeCard('sd-10', 'system-design', 'Idempotency', 'An operation is idempotent if doing it multiple times produces the same result as doing it once. PUT /update-name = idempotent. POST /create-order = NOT idempotent (creates duplicate orders). For your business: "Clean kitchen at 14 Oak St" should be idempotent — if you accidentally clean it twice, you don\'t charge twice or break anything. Design your business operations to be idempotent wherever possible.', undefined, ['idempotency', 'reliability', 'design'], 'system-design-primer'),
  makeCard('sd-11', 'system-design', 'Circuit Breaker Pattern', 'Like an electrical circuit breaker: when a service fails repeatedly, "trip" the circuit and stop sending requests, returning a fallback instead. After a cooldown, try again (half-open state). If it works, close the circuit. Prevents cascading failures. For business: if a client is consistently late paying or difficult to work with, "trip the circuit" — pause the relationship. Don\'t keep sending resources into a failing pattern. Try again after a cooldown.', undefined, ['circuit-breaker', 'resilience', 'failure'], 'system-design-primer'),
  makeCard('sd-12', 'system-design', 'Microservices vs Monolith', 'Monolith: one big application doing everything. Microservices: many small independent services. Monolith pros: simple, easy to start. Microservices pros: independent scaling, technology flexibility, team autonomy. Startup rule: begin with monolith, extract microservices as boundaries become clear. For business: starting as a sole trader, you ARE a monolith. As you grow, separate concerns into "microservices" — dedicated people or processes for scheduling, cleaning, billing, marketing.', undefined, ['microservices', 'monolith', 'architecture'], 'system-design-primer'),
  makeCard('sd-13', 'system-design', 'Observer Pattern', 'When an object\'s state changes, all its dependents are notified automatically. Decouples the subject from its observers. Used everywhere: event systems, pub/sub, reactive programming. For business: when you change a client\'s schedule, all affected parties should be notified automatically — cleaning staff, billing system, the client themselves. Without this pattern, changes require manual communication to every stakeholder.', undefined, ['observer', 'events', 'decoupling'], 'system-design-primer'),
  makeCard('sd-14', 'system-design', 'Redundancy vs Replication', 'Redundancy = having backup components that take over when primary fails. Replication = having multiple copies for load distribution. Different goals: redundancy = reliability. Replication = performance. For business: redundancy = having backup supplies in your kit (if your main vacuum breaks, backup is ready). Replication = hiring multiple cleaners so you can serve more clients simultaneously. Know which you need.', undefined, ['redundancy', 'replication', 'reliability'], 'system-design-primer'),
  makeCard('sd-15', 'system-design', 'Eventual Consistency in Real Systems', 'DNS, email, and most distributed databases use eventual consistency. DNS propagation takes up to 72 hours globally. Email delivery has no guaranteed timeline. These systems work because the DATA is eventually correct, and most use cases tolerate delay. The engineering insight: if you can tolerate eventual consistency, your system becomes infinitely more available and scalable. The business insight: if clients can tolerate slight delays in non-critical updates, you can build much simpler systems.', undefined, ['eventual-consistency', 'practical', 'tradeoffs'], 'system-design-primer'),
  makeCard('sd-16', 'system-design', 'Backpressure', 'When a downstream system is overwhelmed, it signals upstream to slow down. This prevents the upstream from drowning the downstream in work it can\'t handle. Without backpressure: upstream sends at max rate → downstream backlog → memory overflow → crash. With backpressure: upstream sends at downstream\'s processing rate → stable system. For business: if your cleaning team is at capacity, signal upstream (booking system) to stop accepting new clients. No backpressure = overcommitment and quality collapse.', undefined, ['backpressure', 'flow-control', 'resilience'], 'system-design-primer'),
  makeCard('sd-17', 'system-design', 'The Fallacies of Distributed Computing', '1. The network is reliable. 2. Latency is zero. 3. Bandwidth is infinite. 4. The network is secure. 5. Topology doesn\'t change. 6. There is one administrator. 7. Transport cost is zero. 8. The network is homogeneous. ALL of these are false. Every system design must account for these being wrong. For business: assume the internet will go down, clients will cancel, supplies will be late, and staff will get sick. Design for the fallacies, not the ideal.', undefined, ['fallacies', 'distributed', 'assumptions'], 'system-design-primer'),
  makeCard('sd-18', 'system-design', 'Graceful Degradation', 'When a system can\'t provide full functionality, it provides reduced functionality rather than crashing entirely. Example: image service can\'t generate thumbnails → serve full image instead. For business: if you can\'t do a full deep clean due to time constraints, do a targeted clean of the most important areas rather than canceling. A degraded service beats no service. Always define what "minimum viable service" looks like for each client.', undefined, ['degradation', 'reliability', 'fallbacks'], 'system-design-primer'),
  makeCard('sd-19', 'system-design', 'Bulkhead Pattern', 'Like bulkheads in a ship: isolate components so a failure in one doesn\'t sink the whole vessel. Each service gets its own resources (threads, memory, connections). If one fails, the others keep running. For business: separate your client accounts, finances, and operations. If one client relationship fails, it shouldn\'t take down your other clients. If one revenue stream dries up, others should be insulated. Concentration risk is a bulkhead violation.', undefined, ['bulkhead', 'isolation', 'failure-domains'], 'system-design-primer'),
  makeCard('sd-20', 'system-design', 'Data Flow: ETL, ELT, and Streaming', 'ETL (Extract-Transform-Load): transform data before storing. ELT (Extract-Load-Transform): store raw data, transform on read. Streaming: process data in real-time as it arrives. ETL = traditional, for structured data. ELT = modern, for flexible analytics. Streaming = realtime, for immediate decisions. For business: tracking cleaning jobs via spreadsheet (ETL - you enter cleaned data). Using an app that stores raw logs (ELT - you analyze later). Real-time dashboard (streaming - you see problems instantly).', undefined, ['data-flow', 'etl', 'streaming'], 'system-design-primer'),
];

// ── Programming Fundamentals Cards (30) ──

const PROGRAMMING_CARDS: SRSCard[] = [
  makeCard('pf-1', 'programming-fundamentals', 'Big O Notation: O(1) vs O(n)', 'O(1) = constant time, operation takes same time regardless of input size. O(n) = linear time, operation time grows with input size. Array access by index = O(1). Searching unsorted array = O(n). For business: O(1) = checking a specific client\'s file (if well-organized). O(n) = searching through all client files to find one by name (if not organized). Structure your data for O(1) access to what you need most.', undefined, ['big-o', 'complexity', 'basics'], 'lifeos'),
  makeCard('pf-2', 'programming-fundamentals', 'Big O: O(n log n) vs O(n²)', 'O(n log n): efficient sorting (merge sort, quicksort). O(n²): inefficient sorting (bubble sort) — nested loops over the data. n=100: n log n ≈ 664, n² = 10,000. n=1000: n log n ≈ 9,966, n² = 1,000,000. The difference grows explosively. For business: if you\'re manually comparing every client to every other client to find scheduling overlaps, you\'re doing O(n²). Sort first, then compare adjacent — O(n log n).', undefined, ['big-o', 'sorting', 'efficiency'], 'lifeos'),
  makeCard('pf-3', 'programming-fundamentals', 'Arrays vs Linked Lists', 'Array: contiguous memory, O(1) random access, O(n) insertion/deletion. Linked list: scattered memory, O(n) access, O(1) insertion/deletion at known position. Choose array when: you need random access, size is predictable. Choose linked list when: you need frequent insertions/deletions, size varies. For business: array = your fixed daily schedule (slots known upfront). Linked list = your to-do list (items added/removed frequently).', undefined, ['data-structures', 'arrays', 'linked-lists'], 'lifeos'),
  makeCard('pf-4', 'programming-fundamentals', 'Hash Tables', 'Key-value pairs with O(1) average-case lookup. Hash function maps key to array index. Collision handling: chaining (linked list at each index) or open addressing (find next empty slot). Worst case: O(n) if all keys hash to same index. For business: a hash table is your client database. Client name → their details. Instant lookup. But if your "hash function" (filing system) puts everything in one pile, lookup degrades to O(n).', undefined, ['data-structures', 'hash-tables', 'lookup'], 'lifeos'),
  makeCard('pf-5', 'programming-fundamentals', 'Stacks (LIFO)', 'Last In, First Out. Push (add to top) and Pop (remove from top). Like a stack of plates. Used for: undo functionality, function call stack, expression parsing, browser back button. O(1) push and pop. For business: your recent actions stack is a LIFO — the most recent client you saw is the freshest in memory. This is why you remember the last job better than the first.', undefined, ['data-structures', 'stacks', 'lifo'], 'lifeos'),
  makeCard('pf-6', 'programming-fundamentals', 'Queues (FIFO)', 'First In, First Out. Enqueue (add to back) and Dequeue (remove from front). Like a queue at a shop. Used for: task scheduling, BFS (breadth-first search), message queues, print queues. O(1) enqueue and dequeue. For business: your job queue is FIFO — first booking received should be first served. Priority queues can override this (VIP clients get dequeued first).', undefined, ['data-structures', 'queues', 'fifo'], 'lifeos'),
  makeCard('pf-7', 'programming-fundamentals', 'Trees: Binary Search Trees', 'A BST: left child < parent < right child. O(log n) average search, insert, delete. Worst case (unbalanced) = O(n). Balanced variants (AVL, Red-Black) guarantee O(log n). For business: a BST is an organized filing system where you can halve the search space at each step. "Is the client before or after M?" cuts 100 clients to 50, then 25, then 12... logarithmic efficiency.', undefined, ['data-structures', 'trees', 'bst'], 'lifeos'),
  makeCard('pf-8', 'programming-fundamentals', 'Graphs: Directed vs Undirected', 'Graphs: nodes (vertices) + edges (connections). Undirected: connection goes both ways (facebook friends). Directed: connection goes one way (twitter follows). Weighted: edges have costs (distance, time, money). For business: your client network is a graph. Referral chains are directed edges (Client A referred Client B). Geographic proximity is weighted edges (distance between client sites). Understanding graph structure reveals optimization opportunities.', undefined, ['data-structures', 'graphs', 'networks'], 'lifeos'),
  makeCard('pf-9', 'programming-fundamentals', 'Recursion', 'A function that calls itself. Must have: 1) Base case (stopping condition), 2) Recursive step (break problem into smaller subproblem). Stack overflow if no base case. Often more readable but less efficient than iteration. For business: breaking down a massive cleaning project into rooms, then rooms into zones, then zones into tasks — each level calls the same logic on a smaller unit. The base case: "Is this task completable in 5 minutes? Then do it."', undefined, ['algorithms', 'recursion', 'decomposition'], 'lifeos'),
  makeCard('pf-10', 'programming-fundamentals', 'Dynamic Programming', 'Solve complex problems by breaking into overlapping subproblems and storing results (memoization or tabulation). Key: if you\'re solving the same subproblem multiple times, cache the answer. Classic problems: fibonacci, knapsack, longest common subsequence. For business: when you find yourself recalculating the same things (client profitability, route efficiency), that\'s a dynamic programming opportunity. Calculate once, store, reuse.', undefined, ['algorithms', 'dynamic-programming', 'optimization'], 'lifeos'),
  makeCard('pf-11', 'programming-fundamentals', 'Sorting: When to Use Which', 'Quick sort: general purpose, O(n log n) average, in-place. Merge sort: guaranteed O(n log n), stable, extra memory. Heap sort: O(n log n), in-place, not stable. Insertion sort: O(n²), great for nearly-sorted small data. Radix sort: O(nk), non-comparative, for specific data. For business: small client list? Simple insertion (just add where it fits). Growing fast? Need merge sort stability (maintain client order). Choosing the right approach saves disproportionate time.', undefined, ['algorithms', 'sorting', 'comparison'], 'lifeos'),
  makeCard('pf-12', 'programming-fundamentals', 'Binary Search', 'Search sorted array by repeatedly halving the search space. O(log n). Must be sorted. Compare middle element, eliminate half, repeat. For business: if your client list is alphabetically sorted, finding a client takes log₂(N) steps. 1,000 clients → only 10 comparisons. But this ONLY works if the data is sorted. Structure matters for speed.', undefined, ['algorithms', 'search', 'efficiency'], 'lifeos'),
  makeCard('pf-13', 'programming-fundamentals', 'BFS vs DFS', 'BFS (Breadth-First): explore all neighbors before going deeper. Uses a queue. Finds shortest path. DFS (Depth-First): go as deep as possible before backtracking. Uses a stack. BFS = searching layer by layer (wide). DFS = following a trail to its end (deep). For business: BFS = exploring all client options at each decision point before committing to a path. DFS = committing to one client relationship deeply before diversifying. Different strategies for different situations.', undefined, ['algorithms', 'graph-traversal', 'strategy'], 'lifeos'),
  makeCard('pf-14', 'programming-fundamentals', 'SOLID Principles (Single Responsibility)', 'A class should have only one reason to change. Each module handles one concern. Violation: a "ClientManager" class that handles scheduling, billing, AND communication. Fix: separate into ScheduleService, BillingService, CommunicationService. For business: each person/process should have ONE clear job. You as sole trader: you\'re everything, which violates SR. The solution: separate hats. When you\'re doing billing, you\'re the CFO. When cleaning, you\'re the operative. Wear one hat at a time.', undefined, ['design-principles', 'solid', 'srp'], 'lifeos'),
  makeCard('pf-15', 'programming-fundamentals', 'Design Pattern: Observer', 'Subject maintains list of observers; notifies them on state changes. Used in: event systems, React state management, pub/sub. For business: a change in a client\'s schedule should automatically notify billing, operations, and the client. Without Observer, you manually call everyone. With Observer, you change the state once and all stakeholders are automatically updated. This is what good CRM software does.', undefined, ['design-patterns', 'observer', 'events'], 'lifeos'),
  makeCard('pf-16', 'programming-fundamentals', 'Design Pattern: Strategy', 'Define a family of algorithms, encapsulate each one, make them interchangeable. Lets the algorithm vary independently from clients that use it. For business: your pricing strategy can vary — standard rate, volume discount, premium service, loyalty pricing. Each is a "strategy" you can swap without rewriting the rest of your business logic. When market changes, you swap the strategy, not the whole system.', undefined, ['design-patterns', 'strategy', 'flexibility'], 'lifeos'),
  makeCard('pf-17', 'programming-fundamentals', 'Design Pattern: Factory', 'Create objects without specifying their exact class. Centralizes creation logic. Client says "give me a vehicle" → factory decides whether to return a Car, Truck, or Van. For business: your job assignment system is a factory. "I need a cleaner for this job" → the system assigns based on availability, skills, proximity. The job poster doesn\'t need to know who specifically — the factory decides.', undefined, ['design-patterns', 'factory', 'creation'], 'lifeos'),
  makeCard('pf-18', 'programming-fundamentals', 'Databases: ACID Properties', 'Atomicity: all or nothing (transaction completes fully or not at all). Consistency: valid state transitions only. Isolation: concurrent transactions don\'t interfere. Durability: committed data survives crashes. For business: a booking is a transaction. Atomicity = booking includes date, time, client, and payment — all or nothing. Consistency = can\'t double-book. Isolation = two clients booking simultaneously don\'t conflict. Durability = confirmed booking survives system crash.', undefined, ['databases', 'acid', 'transactions'], 'lifeos'),
  makeCard('pf-19', 'programming-fundamentals', 'API Design: REST Principles', 'REST: Representational State Transfer. Resources identified by URLs (nouns, not verbs). HTTP methods: GET (read), POST (create), PUT (update), DELETE (remove). Stateless: each request contains all info needed. For business: your service catalog is a REST API. GET /clients → list all clients. POST /bookings → create new booking. PUT /bookings/42 → update booking 42. Standardized interfaces = less confusion, easier automation.', undefined, ['api', 'rest', 'design'], 'lifeos'),
  makeCard('pf-20', 'programming-fundamentals', 'Concurrency vs Parallelism', 'Concurrency: dealing with many things at once (switching between tasks). Parallelism: doing many things at once (simultaneous execution). Single-core processor = concurrency only. Multi-core = can do parallelism. For business: you\'re a single core — you can be concurrent (switching between clients/skills quickly) but not truly parallel. Hiring employees adds cores = true parallelism. Until then, optimize your concurrency with time-blocking.', undefined, ['concurrency', 'parallelism', 'systems'], 'lifeos'),
  makeCard('pf-21', 'programming-fundamentals', 'Error Handling: Fail Fast vs Resilient', 'Fail fast: immediately stop on error (crash early, visible failure). Resilient: catch errors, degrade gracefully, keep running. Fail fast in development (exposes bugs). Resilient in production (user experience matters). For business: fail fast during planning (discover problems early when cost is low). Resilient during execution (client doesn\'t care about your internal problems, they just need the job done). Different contexts need different strategies.', undefined, ['error-handling', 'resilience', 'strategy'], 'lifeos'),
  makeCard('pf-22', 'programming-fundamentals', 'Caching: Write-Through vs Write-Back', 'Write-through: data written to cache AND storage simultaneously. Consistent but slower. Write-back: data written to cache first, storage updated later. Faster but risk of data loss on crash. For business: write-through = writing a booking directly into your official schedule (slow but accurate). Write-back = noting a booking on your phone to enter later (fast but risk forgetting). Choose based on consequence of loss.', undefined, ['caching', 'strategies', 'tradeoffs'], 'lifeos'),
  makeCard('pf-23', 'programming-fundamentals', 'Testing: Unit vs Integration vs E2E', 'Unit test: test one function in isolation (fast, specific). Integration test: test how modules work together (medium speed, catches interface bugs). E2E test: test full user flow through the system (slow, catches real-world bugs). Pyramid: many unit tests, fewer integration, few E2E. For business: unit = checking one cleaning step. Integration = checking a full room clean. E2E = checking client experience from booking to completion to payment.', undefined, ['testing', 'quality', 'strategy'], 'lifeos'),
  makeCard('pf-24', 'programming-fundamentals', 'Version Control Concepts', 'Branch: independent line of development. Merge: combine branches. Rebase: replay commits onto another branch. Conflict: same file changed in both branches. For business: branching = having a "new pricing" idea while still using current pricing. Merging = implementing the new pricing. Conflicts = both old and new pricing being used simultaneously (bad!). Version control thinking = safe experimentation without breaking what works.', undefined, ['version-control', 'git', 'concepts'], 'lifeos'),
  makeCard('pf-25', 'programming-fundamentals', 'Technical Debt', 'Shortcuts taken now that cost more later. Like financial debt: sometimes useful (ship faster), but accumulates interest (maintenance cost). Good debt: intentional, with a payoff plan. Bad debt: accidental, invisible, compounding silently. For business: skipping SOP creation to do more jobs = technical debt. You save 2 hours now but lose 10 hours later fixing inconsistent service. Always ask: "Is this shortcut deliberate with a repayment plan, or am I just being lazy?"', undefined, ['technical-debt', 'engineering', 'strategy'], 'lifeos'),
  makeCard('pf-26', 'programming-fundamentals', 'Separation of Concerns', 'Divide a program into distinct sections, each addressing a separate concern. UI shouldn\'t contain business logic. Database shouldn\'t contain UI code. For business: cleaning execution ≠ client management ≠ billing ≠ marketing. Each is a separate concern. Mixing them (discussing billing while cleaning, managing clients while doing admin) creates messy, inefficient work. Time-block: clean when cleaning, bill when billing, market when marketing.', undefined, ['architecture', 'separation', 'concerns'], 'lifeos'),
  makeCard('pf-27', 'programming-fundamentals', 'Event-Driven Architecture','Components communicate through events rather than direct calls. Producer emits event → event bus distributes → consumers react. Loose coupling: producers don\'t know who consumes their events. For business: your booking system emits "JobCompleted" event → billing system generates invoice, quality system sends survey, referral system triggers referral prompt. No direct connections — each system just listens for relevant events. Easy to add new consumers without touching existing ones.', undefined, ['architecture', 'events', 'decoupling'], 'lifeos'),
  makeCard('pf-28', 'programming-fundamentals', 'Memoization', 'Cache results of expensive function calls and return cached result when same inputs occur again. Trade space for time. Works when: function is pure (same inputs → same output), calls are repeated with same inputs. For business: if you compute a client\'s profitability the same way every month, memoize it — store the result and reuse until the inputs change. Don\'t recalculate what hasn\'t changed.', undefined, ['optimization', 'memoization', 'caching'], 'lifeos'),
  makeCard('pf-29', 'programming-fundamentals', 'Heaps and Priority Queues', 'A heap is a tree where parent > children (max-heap) or parent < children (min-heap). Priority queue: implemented via heap, always returns highest/lowest priority element in O(log n). For business: your job queue as a priority queue. Not FIFO — highest priority job (deadline today, VIP client) gets done next regardless of when it was added. The heap structure efficiently maintains this ordering.', undefined, ['data-structures', 'heaps', 'priority'], 'lifeos'),
  makeCard('pf-30', 'programming-fundamentals', 'Asynchronous Programming', 'Don\'t wait for slow operations — continue doing other work while waiting. Callbacks → Promises → async/await. For business: while you wait for a client to confirm a booking (slow operation), you don\'t stand still — you do other bookings, prep supplies, plan routes. Asynchronous thinking = maximal utilization of your time. Never wait idle when there\'s productive work to be done.', undefined, ['async', 'programming', 'efficiency'], 'lifeos'),
];

// ════════════════════════════════════════════════════════════════════════════
// Manifest Singleton
// ════════════════════════════════════════════════════════════════════════════

const ALL_SEED_CARDS: SRSCard[] = [
  ...HERMETIC_CARDS,
  ...SYSTEM_DESIGN_CARDS,
  ...PROGRAMMING_CARDS,
];

export const educationManifest = {
  version: '1.0.0',
  lastUpdated: '2026-04-30',

  decks: STUDY_DECKS,
  paths: LEARNING_PATHS,

  /** Get all built-in seed cards */
  getAllCards(): SRSCard[] {
    return ALL_SEED_CARDS;
  },

  /** Get built-in challenges (from learning paths) */
  getAllChallenges(): Challenge[] {
    const challenges: Challenge[] = [];
    // Extract challenges from the manifest's internal data
    // These are linked from learning path nodes
    return challenges;
  },

  /** Get cards for a specific Hermetic principle */
  getCardsByPrinciple(principle: number): SRSCard[] {
    return ALL_SEED_CARDS.filter(c => c.hermeticPrinciple === principle);
  },

  /** Get challenges for a specific Hermetic principle */
  getChallengesByHermeticPrinciple(principle: number): Challenge[] {
    // Find paths matching this principle and extract their challenge IDs
    const matchingPaths = LEARNING_PATHS.filter(p => p.hermeticPrinciple === principle);
    const challengeIds = matchingPaths.flatMap(p =>
      Object.values(p.nodes).flatMap(n => n.challengeIds || [])
    );
    // Return stub challenges from the challenge IDs
    // (Real challenges come from the challenge engine at runtime)
    return challengeIds.map((id, i) => ({
      id,
      lessonId: `path-${principle}`,
      type: 'multiple-choice' as const,
      title: `Challenge ${i + 1}`,
      description: 'Complete this challenge to progress along your learning path.',
      difficulty: 'intermediate' as const,
      xpReward: 25,
      options: [],
    }));
  },

  /** Get linked content for a roadmap node */
  getLinkedContent(nodeId: string): { cards: SRSCard[]; challenges: Challenge[] } {
    // Find the node across all paths
    for (const path of LEARNING_PATHS) {
      const node = path.nodes[nodeId];
      if (node) {
        const cards = (node.knowledgeCardIds || [])
          .map(id => ALL_SEED_CARDS.find(c => c.id === id))
          .filter(Boolean) as SRSCard[];
        return { cards, challenges: [] };
      }
    }
    return { cards: [], challenges: [] };
  },

  /** Get overall education stats */
  getStats() {
    const totalNodes = LEARNING_PATHS.reduce((sum, p) => sum + Object.keys(p.nodes).length, 0);
    const totalChallenges = LEARNING_PATHS.reduce((sum, p) => sum + p.totalChallenges, 0);
    const totalHours = LEARNING_PATHS.reduce((sum, p) => sum + p.totalEstimatedHours, 0);
    const principlesCovered = [...new Set(ALL_SEED_CARDS.filter(c => c.hermeticPrinciple != null).map(c => c.hermeticPrinciple!))];

    return {
      totalDecks: STUDY_DECKS.length,
      totalCards: ALL_SEED_CARDS.length,
      totalPaths: LEARNING_PATHS.length,
      totalChallenges,
      totalNodes,
      totalEstimatedHours: totalHours,
      principlesCovered,
    };
  },
};

export default educationManifest;