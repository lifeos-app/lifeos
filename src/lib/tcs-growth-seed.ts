/**
 * TCS Growth Plan Seeder
 *
 * Seeds the 12-month Eddie/Maid2Clean expansion plan as Goals + Tasks into LifeOS.
 * Creates a parent goal with 12 sub-goals (months) and 50+ tasks under each.
 * Idempotent — checks if the plan already exists before seeding.
 *
 * Strategy based on Reddit's Eddie (Melbourne cleaner who scaled solo → $50k/mo)
 * and Maid2Clean franchise playbook. Phases:
 *   Phase 0 (Month 1):    Foundation — $0 investment
 *   Phase 1 (Month 2-3):  First Hire
 *   Phase 2 (Month 4-6):  Scale to 3-4 Cleaners + Remove Yourself
 *   Phase 3 (Month 7-9):  Systems & SEO
 *   Phase 4 (Month 10-12): Scale to 10 Cleaners
 */

import { supabase } from './data-access';
import { genId } from '../utils/date';

// ─── Plan Data ──────────────────────────────────────────────────

interface MilestoneTask {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

interface MonthMilestone {
  title: string;
  subtitle: string;
  tasks: MilestoneTask[];
}

const GROWTH_PLAN: MonthMilestone[] = [
  // ── PHASE 0: Foundation ($0 Investment) ────────────────────────
  {
    title: 'Month 1 — Foundation ($0 Investment)',
    subtitle: 'Phase 0: Build the operational foundation before hiring. Every system you set up now pays compound returns later. Eddie rule: never hire until systems exist.',
    tasks: [
      {
        title: 'Create "Join Our Team" page on teddyscleaning.com.au',
        description: 'Build a dedicated careers/recruiting page on the website. Include: why work with TCS, pay rates ($25/hr contractor), flexible hours, ABN requirement, and a simple application form (name, phone, suburb, experience, availability). Eddie used this as his #1 low-cost recruiting channel.',
        priority: 'urgent',
      },
      {
        title: 'Set up automated recruiting funnel (Telegram bot)',
        description: 'Create a Telegram bot that pings you instantly when someone applies via the website or Gumtree. Speed-to-contact wins hires — Eddie responded within 15 minutes. Connect form submissions → Supabase → Telegram notification with applicant details.',
        priority: 'urgent',
      },
      {
        title: 'Post cleaner jobs on Gumtree, Facebook Jobs, Seek',
        description: 'Post "Casual Cleaner Wanted — Western Suburbs — $25/hr + flexible hours" on Gumtree (free), Facebook Jobs (free), and Seek ($$$ only if budget allows). Refresh Gumtree weekly. Eddie got 5-10 applications/week from free posts alone.',
        priority: 'urgent',
      },
      {
        title: 'Optimize Google Business Profile (50+ photos, weekly posts, review responses)',
        description: 'Upload 50+ action photos of you cleaning (before/after shots, product photos, team photos). Enable messaging. Set up weekly Google Posts about services. Respond to every review within 24hrs. This is your #1 free marketing channel — Eddie credits GBP for 40% of his leads.',
        priority: 'urgent',
      },
      {
        title: 'Upsell existing sites: pitch quarterly deep clean ($250 vs $150)',
        description: 'Approach every current client with a deep clean upsell: "We notice your [floors/kitchen/bathrooms] could use a deep clean — we offer a quarterly deep clean service for $250 that restores everything to like-new." Target: 2 clients convert = +$500 revenue this month. Deep clean takes 3-4hrs vs 2hrs regular = better hourly rate.',
        priority: 'high',
      },
      {
        title: 'Add 1-2 small commercial clients (western suburbs offices)',
        description: 'Target small offices in Melton/Caroline Springs/Deer Park: $80-100/clean, 1x/week. Door-knock office buildings, ask the receptionist who handles cleaning. Commercial clients = predictable weekly revenue that funds your first hire. Aim for $200/week in new commercial contracts.',
        priority: 'high',
      },
      {
        title: 'Enable online booking on website (Supabase + Stripe)',
        description: 'Add a booking form to teddyscleaning.com.au that lets clients book and pay online. Use Supabase for booking data and Stripe for payments. Include: service type, preferred date/time, address, notes. Auto-send confirmation email. Eddie got 30% of bookings online once enabled.',
        priority: 'high',
      },
      {
        title: 'Calculate "First Hire" number ($2k+/week revenue needed)',
        description: 'Run the numbers: to afford a contractor at $25/hr working 20hrs/week, you need $500/week just for wages. Add supplies, insurance, admin overhead. Minimum viable revenue to justify first hire: $2,000/week across all clients. Track this number weekly — when you hit it, hire immediately.',
        priority: 'urgent',
      },
      {
        title: 'Start vehicle logbook (ATO compliance, $0.85/km deduction)',
        description: 'Begin a compliant vehicle logbook from day 1. Record every business trip: date, start/end odometer, purpose, km. ATO allows $0.85/km (2024) deduction. At 200km/week business travel = $170/week in deductions = ~$4,400/year tax savings. Use the ATO app or a simple spreadsheet.',
        priority: 'high',
      },
      {
        title: 'Verify public liability insurance coverage',
        description: 'Confirm your public liability insurance covers: (a) all current venues, (b) contractors working under your brand, (c) minimum $10M coverage for commercial work. Eddie used Covertech — cheap broker. If you add cleaners later, you MUST ensure they are covered or have their own. Update policy before hiring.',
        priority: 'urgent',
      },
      {
        title: 'Document SOPs per venue',
        description: 'Create Standard Operating Procedures for every venue/client. Each SOP must include: access instructions, alarm codes, cleaning checklist (room by room), products to use, special requirements, estimated time, quality checkpoints. This IS your training manual — without it, you cannot delegate. Eddie says: "If it is not documented, it does not exist."',
        priority: 'high',
      },
      {
        title: 'Set health boundary: minimum 6 hours sleep',
        description: 'Eddie nearly burned out working security + cleaning. Set a HARD rule: minimum 6 hours sleep per night. No exceptions. Track your sleep in LifeOS. If you cannot maintain this, something else has to go — not sleep. Sustainable growth requires sustainable health.',
        priority: 'high',
      },
    ],
  },

  // ── PHASE 1: First Hire ─────────────────────────────────────────
  {
    title: 'Month 2 — First Hire (Shadow & Train)',
    subtitle: 'Phase 1: Get Cleaner #1 onboard with shadow training. The 50/50 revenue split model means you earn the same per job while building capacity. Eddie insight: your first hire doubles your capacity without halving your income.',
    tasks: [
      {
        title: 'Hire Cleaner #1 (contractor, $25/hr, ABN required)',
        description: 'From your recruiting funnel, select the best applicant. Must have: ABN, reliable transport, work rights, references. Pay as contractor ($25/hr) to reduce admin burden. Eddie used contractors exclusively until $20k/month revenue — then switched to PT employees. Sign a contractor agreement outlining expectations, quality standards, and termination terms.',
        priority: 'urgent',
      },
      {
        title: 'Shadow training: 2 cleans unpaid / $20hr with Cleaner #1',
        description: 'Have Cleaner #1 shadow you on 2 real jobs. First clean: they watch, assist, learn your SOPs. Second clean: they lead, you supervise and correct. Pay $20/hr for shadow cleans (below contract rate — this is training, not production). After 2 successful shadows, they solo. Eddie invested 8-10hrs training per cleaner and it paid for itself within 2 weeks.',
        priority: 'urgent',
      },
      {
        title: 'Implement Quality System: QR code sign-in + photo upload + client auto-email',
        description: 'After every clean, Cleaner #1 must: (1) scan a QR code at the site to log arrival/departure time, (2) take before/after photos of key areas, (3) system auto-emails client with "Clean complete — [photos attached] — rate your clean". This is your quality control and client trust builder. Use Supabase to store photos and trigger emails via Resend.',
        priority: 'high',
      },
      {
        title: 'Set up Revenue Split Model: 50/50 ($50 cleaner / $50 TCS per $100 job)',
        description: 'Eddie model: for every $100 job, the cleaner gets $50 (as contractor), TCS keeps $50. This means: (a) you earn the SAME per job as when you were solo, (b) you are freed up to sell more jobs, (c) the cleaner earns well and stays. Calculate split for each service tier (regular clean $150, deep clean $250, commercial $100). Document the split table.',
        priority: 'urgent',
      },
      {
        title: 'Collect 5-10 cleaner applications per week via funnel',
        description: 'Keep your recruiting pipeline FULL even after hiring #1. Post weekly on Gumtree/Facebook Jobs. Aim for 5-10 applications per week. Why? (a) Cleaner #1 might not work out, (b) you are hiring #2 next month, (c) a deep talent pool lets you be picky. Review applications within 15 minutes of receipt (Telegram bot alert).',
        priority: 'high',
      },
      {
        title: 'Post jobs weekly on Gumtree/Facebook ($0 budget)',
        description: 'Refresh your Gumtree listing every Sunday (free listings expire). Post in local Facebook community groups on Mondays. Zero budget, maximum reach. Eddie got 70% of applicants from Gumtree alone. Write the ad once, reuse weekly. Key message: "Flexible hours, $25/hr, western suburbs, ABN required."',
        priority: 'medium',
      },
    ],
  },
  {
    title: 'Month 3 — First Hire (Independent Operations)',
    subtitle: 'Phase 1 continued: Cleaner #1 goes solo. You shift from cleaning to managing. Refine systems based on real data. Validate the 50/50 model with actual numbers.',
    tasks: [
      {
        title: 'Cleaner #1 runs independent cleans — you manage, not clean',
        description: 'This is the pivotal transition. Cleaner #1 handles their scheduled jobs solo. You check in via the quality system (photos, QR logins) but do NOT physically attend unless there is a problem. Your time is now worth more managing (sales, recruiting, systems) than cleaning. Eddie: "The day I stopped cleaning was the day my business became real."',
        priority: 'urgent',
      },
      {
        title: 'Refine onboarding process from Cleaner #1 experience',
        description: 'Document what worked and what did not with Cleaner #1 onboarding. Update: training checklist, shadow schedule, SOP clarity, quality system instructions. Each successive hire should be faster to onboard. Target: reduce training time from 2 cleans to 1 clean by Month 6.',
        priority: 'high',
      },
      {
        title: 'Validate 50/50 revenue split with actual P&L numbers',
        description: 'After 4 weeks of Cleaner #1 operating, run the actual numbers: total revenue from their jobs, their share, TCS share, supplies cost, insurance cost, your time managing. Is the 50/50 split sustainable? Adjust if needed (some Eddie-style operators move to 60/40 once cleaners are trained). Document the real margin.',
        priority: 'high',
      },
      {
        title: 'Hire Cleaner #2 (start 2-week shadow period)',
        description: 'From your pipeline of 5-10 weekly applications, select Cleaner #2. Begin shadow training on your remaining personal cleans. By end of Month 3, Cleaner #2 should be ready for solo work. Eddie hired his second cleaner within 6 weeks of the first — the demand was already there, he just needed capacity.',
        priority: 'high',
      },
      {
        title: 'Collect 5 Google reviews this month',
        description: 'After every clean, the auto-email asks for a rating. Follow up personally with happy clients: "Would you mind leaving us a Google review? It helps our small business so much." Target: 5 new reviews this month. Google reviews = trust = more clients. Eddie hit 15 reviews in his first 3 months and it transformed his lead flow.',
        priority: 'medium',
      },
    ],
  },

  // ── PHASE 2: Scale to 3 Cleaners + Remove Yourself ─────────────
  {
    title: 'Month 4 — Scale to 3 Cleaners + Dual Teams',
    subtitle: 'Phase 2: Hire Cleaner #3, run 2 teams simultaneously. Revenue target: $4,000/week. This is where TCS stops being "you" and starts being a business.',
    tasks: [
      {
        title: 'Hire Cleaner #3',
        description: 'Third cleaner from your pipeline. Same process: ABN, contractor agreement, 2-cleans shadow training, quality system onboarding. By now your SOPs and training should be streamlined. Pair Cleaner #1 and #3 as "Team A" for larger commercial jobs; Cleaner #2 solo for residential.',
        priority: 'urgent',
      },
      {
        title: 'Run 2 teams simultaneously (daily scheduling)',
        description: 'You now have enough capacity to run 2 teams per day. Team A handles morning commercial, Team B handles afternoon residential. Build a simple scheduling system (even a shared Google Calendar works). Assign jobs by: (a) proximity, (b) team skills, (c) client preference. Eddie used a WhatsApp group for daily assignments.',
        priority: 'urgent',
      },
      {
        title: 'Hit 15-20 jobs/week total',
        description: 'With 3 cleaners + yourself, target 15-20 jobs per week. Break down: 5-7 jobs/week per cleaner on a 20hr schedule. Track jobs per cleaner, revenue per cleaner, and utilization rate (hours billed / hours available). If utilization drops below 75%, you have too many cleaners or not enough jobs.',
        priority: 'high',
      },
      {
        title: 'Revenue target: $4,000/week ($16,000/month)',
        description: 'At 15-20 jobs/week with average $200-270/job, you should be hitting $4,000/week revenue. After 50/50 splits, TCS retains ~$2,000/week gross. Minus supplies (~$200/week) and insurance (~$100/week) = ~$1,700/week net. Track weekly revenue in a dashboard. If you miss this target, the bottleneck is sales — not capacity.',
        priority: 'urgent',
      },
      {
        title: 'Build WhatsApp/Telegram group for team communication',
        description: 'Create a team chat (WhatsApp or Telegram) with all cleaners. Post nightly: next day schedule, any special instructions, client notes. Cleaners post: arrival confirmations, issues, supply needs. This replaces phone calls and keeps everything in writing. Eddie used WhatsApp and it was his operational backbone.',
        priority: 'medium',
      },
    ],
  },
  {
    title: 'Month 5 — Transition: Manage 20hrs + Clean 20hrs',
    subtitle: 'Phase 2: Begin the deliberate transition away from cleaning. Split your week 50/50 between management and cleaning. This is uncomfortable — fight the urge to "just do it yourself."',
    tasks: [
      {
        title: 'Transition: You manage 20hrs/week, clean 20hrs/week',
        description: 'Deliberate time split: Mon-Wed = management (recruiting, sales, scheduling, quality review). Thu-Fri = cleaning (only jobs no one else can do or emergency fills). Track your hours. If you are still cleaning 30+ hours, you have not delegated enough. Eddie: "The hardest part of scaling is letting go of the mop."',
        priority: 'urgent',
      },
      {
        title: 'Refine scheduling between 3 cleaners',
        description: 'Optimize the weekly schedule to minimize travel time between jobs. Group jobs by suburb. Assign the closest cleaner. Aim for <30min total travel per shift. Use a simple map or Google Maps route planner. Each minute saved in travel = a minute available for cleaning = revenue.',
        priority: 'high',
      },
      {
        title: 'Sell 5 new contracts this month',
        description: 'With 20hrs/week freed for management, spend 5 of those hours on sales. Door-knock offices, follow up on website leads, ask existing clients for referrals. Target: 5 new recurring contracts this month. Each contract at $100-150/week adds $400-600/month. Five contracts = $2,000-3,000/month new revenue.',
        priority: 'high',
      },
      {
        title: 'Review Cleaner #1 performance and give feedback',
        description: 'After 3 months, conduct a formal review with Cleaner #1. Cover: quality scores (from client feedback), reliability, time adherence, client comments. Celebrate wins. Address gaps. Offer a small rate increase ($1-2/hr) if performance is excellent — retention of good cleaners is critical. Eddie lost a great cleaner by not recognizing them early enough.',
        priority: 'medium',
      },
    ],
  },
  {
    title: 'Month 6 — Remove Yourself from Cleaning',
    subtitle: 'Phase 2 peak: Stop cleaning. Hire Cleaner #4. Your 20hrs/week is now 100% management. This is the "quit the day job" inflection point if the numbers work.',
    tasks: [
      {
        title: 'Stop cleaning yourself (emergencies only)',
        description: 'This is THE milestone. You no longer clean. All jobs are handled by your team. You only fill in for sick leave or emergencies. Eddie stopped cleaning at month 5 and his revenue doubled in the next 6 months because all his time went to growth. Trust the system you built.',
        priority: 'urgent',
      },
      {
        title: 'Hire Cleaner #4',
        description: 'Fourth cleaner to absorb your former cleaning load and support growing demand. By now, your onboarding should be efficient: 1 shadow clean, quality system login, SOP handover. Target: fully operational within 1 week.',
        priority: 'urgent',
      },
      {
        title: 'Management time allocation: 5hrs recruiting + 5hrs sales + 5hrs scheduling + 5hrs quality',
        description: 'With 20hrs/week pure management, allocate: Monday (recruiting + pipeline), Tuesday (sales + client calls), Wednesday (scheduling + ops), Thursday (quality review + issue resolution), Friday (financials + strategy). Track your time in each bucket. If any bucket gets neglected, that is where problems will emerge.',
        priority: 'high',
      },
      {
        title: 'Calculate "Quit Security Job" number: $10k/month profit',
        description: 'Run the full P&L: Revenue - Cleaner splits - Supplies - Insurance - Vehicle - Software - Tax. If net profit exceeds $10,000/month consistently for 2 months, you have the option to quit the security job. Eddie quit his day job at $12k/month profit. Do NOT quit earlier — the security income is your safety net.',
        priority: 'urgent',
      },
      {
        title: 'Target: reach 25-30 Google reviews',
        description: 'You should have ~15 reviews from months 1-5. Push hard this month: every happy client gets a personal follow-up asking for a review. Include a direct link to your Google review page in the post-clean auto-email. At 25+ reviews, you start appearing in the top 3 map results for "cleaning [suburb]". Eddie says reviews were his best SEO investment.',
        priority: 'high',
      },
      {
        title: 'Create cleaner performance dashboard',
        description: 'Build a simple tracker: jobs completed, quality score (from client ratings), on-time rate, client complaints, re-clean requests. Share monthly summaries with each cleaner. Top performers get priority scheduling (more hours = more money). Low performers get a warning, then replacement. Eddie fired his first cleaner at month 6 — it was hard but necessary.',
        priority: 'medium',
      },
    ],
  },

  // ── PHASE 3: Systems & SEO ──────────────────────────────────────
  {
    title: 'Month 7 — Systems & SEO (Foundation)',
    subtitle: 'Phase 3: Build the SEO machine that generates leads on autopilot. Google Business Profile becomes a system, not a chore. Start suburb-specific landing pages.',
    tasks: [
      {
        title: 'Google Business Profile: commit to weekly posts + review response within 24hrs',
        description: 'Systematize GBP: every Monday, post a before/after photo, a tip, or a service highlight. Every review gets a response within 24hrs — positive reviews get thanks, negative reviews get a professional resolution offer. Set a calendar reminder. This is non-negotiable. Eddie ranked #1 in his suburb within 6 months of consistent GBP posting.',
        priority: 'urgent',
      },
      {
        title: 'SEO strategy: plan 20 suburb-specific landing pages',
        description: 'Map out 20 suburb landing pages for western Melbourne. For each suburb, note: (a) target keyword ("cleaning Rockbank", "cleaners Melton"), (b) competitor ranking, (c) population/demand signal. Create a content brief for each page: 800-1000 words, suburb-specific intro, services offered, testimonials from that area (if available), CTA to book online.',
        priority: 'high',
      },
      {
        title: 'Build landing page template (AI-generated content)',
        description: 'Create a reusable Next.js page template for suburb pages at teddyscleaning.com.au/cleaning-[suburb]. Each page has: H1 with suburb name, local intro, services, pricing, reviews, FAQ, CTA button. Use AI (GPT/Claude) to generate suburb-specific content — then manually review for accuracy and local references.',
        priority: 'high',
      },
      {
        title: 'Review acquisition system: auto-email after every clean',
        description: 'Enhance the post-clean auto-email with a review funnel. Email #1 (after clean): "Rate your experience 1-5 stars." If 4-5 stars: Email #2 → "Glad you loved it! Leave a Google review? [Direct link]." If 1-3 stars: Email #2 → "Sorry to hear that. Here is $50 off your next clean — tell us what went wrong." This converts happy clients to promoters and catches problems before they become bad reviews.',
        priority: 'urgent',
      },
      {
        title: 'Hire Cleaner #5 (maintain hiring cadence)',
        description: 'Begin the "+2 cleaners every 2 months" cadence. Hire #5 this month. You should now have enough recurring revenue to support 5 cleaners. Focus on hiring for reliability over experience — Eddie found that reliable inexperienced cleaners outperformed flaky experienced ones within a month.',
        priority: 'high',
      },
    ],
  },
  {
    title: 'Month 8 — Systems & SEO (Suburb Pages Batch 1)',
    subtitle: 'Phase 3: Publish the first batch of suburb landing pages. These are your organic lead generators — each page is a fishing line in a new pond.',
    tasks: [
      {
        title: 'Publish suburb pages: Rockbank, Melton, Caroline Springs',
        description: 'Go live with teddyscleaning.com.au/cleaning-rockbank, /cleaning-melton, /cleaning-caroline-springs. Each page must have unique content referencing local landmarks, typical property types, and common cleaning needs in that suburb. Submit to Google Search Console for indexing.',
        priority: 'high',
      },
      {
        title: 'Publish suburb pages: Tarneit, Werribee, Hoppers Crossing',
        description: 'Go live with /cleaning-tarneit, /cleaning-werribee, /cleaning-hoppers-crossing. These are high-growth suburbs with lots of new builds — perfect for end-of-lease and regular cleaning. Mention new development areas and body corporate opportunities.',
        priority: 'high',
      },
      {
        title: 'Set up Google Search Console + submit sitemap',
        description: 'Register teddyscleaning.com.au in Google Search Console. Submit your sitemap including all suburb pages. Monitor indexing status weekly. Target: all 6 new pages indexed within 2 weeks. Set up alerts for crawl errors.',
        priority: 'medium',
      },
      {
        title: 'A/B test review email subject lines',
        description: 'Test different subject lines for the post-clean review email: (A) "How was your clean?" vs (B) "Your clean is done — quick question?" vs (C) "[Client name], we need 30 seconds of your time." Track open rates and review conversion rates. The winner becomes your permanent template.',
        priority: 'medium',
      },
      {
        title: 'Hire Cleaner #6',
        description: 'Sixth cleaner continues the cadence. You should now have 6 cleaners handling 25-30 jobs/week. Revenue target: $5,000-6,000/week ($20-24k/month). Each new cleaner should reach positive ROI (revenue > cost) within 2 weeks of starting.',
        priority: 'high',
      },
    ],
  },
  {
    title: 'Month 9 — Systems & SEO (Suburb Pages Batch 2 + Hiring)',
    subtitle: 'Phase 3 close: Complete the suburb page network, refine the review funnel, and push hiring to 6-8 cleaners total.',
    tasks: [
      {
        title: 'Publish suburb pages: Deer Park, Sunshine, Footscray',
        description: 'Go live with /cleaning-deer-park, /cleaning-sunshine, /cleaning-footscray. Sunshine and Footscray have strong commercial/industrial zones — tailor content for office and warehouse cleaning. Deer Park has growing residential — target regular home cleaning and end-of-lease.',
        priority: 'high',
      },
      {
        title: 'Publish suburb pages: Altona, Point Cook',
        description: 'Go live with /cleaning-altona, /cleaning-point-cook. Point Cook is one of Melbourne fastest-growing suburbs — high demand for both residential and commercial cleaning. Altona has a mix of industrial and coastal residential. Total suburb pages: 11 live.',
        priority: 'high',
      },
      {
        title: 'Review funnel: 5-star → Google review link, <5-star → $50 off offer',
        description: 'Refine the automated email sequence based on Month 7-8 data. The branching logic should be: positive rating → instant Google review link with pre-filled 5 stars. Negative rating → immediate $50 off voucher code + feedback form. Eddie converted 15% of happy clients to reviewers with this system vs 3% with a generic ask.',
        priority: 'urgent',
      },
      {
        title: 'Hiring cadence: +2 cleaners (total: 7-8)',
        description: 'Hire cleaners #7 and #8. You are now running a real operation. Each cleaner needs: contractor agreement, SOP access, quality system login, team chat membership, 1 shadow clean. Onboarding should take <3 days. If you cannot onboard a new cleaner in 3 days, your systems need fixing.',
        priority: 'high',
      },
      {
        title: 'Track SEO results: which suburb pages are ranking?',
        description: 'After 1-2 months, check Google Search Console for suburb page impressions and clicks. Which suburbs are generating organic traffic? Double down on those with more content, backlinks, or Google Ads. Which are dead? Investigate — maybe the competition is too strong, or the content needs refreshing.',
        priority: 'medium',
      },
      {
        title: 'Build end-of-lease cleaning package ($350-450)',
        description: 'High-margin, one-off service. Package: full bond-back guarantee clean, 4-6 hours, 2 cleaners. Market on suburb pages: "Bond-back cleaning in [suburb] — 100% guarantee." End-of-lease cleans are THE highest-margin service in residential cleaning. Eddie made 40% of revenue from bond cleans despite them being 15% of jobs.',
        priority: 'high',
      },
    ],
  },

  // ── PHASE 4: Scale to 10 Cleaners ───────────────────────────────
  {
    title: 'Month 10 — Scale to 10 Cleaners (Systems Build)',
    subtitle: 'Phase 4: Build the operational systems that make 10-cleaner management possible. Without TribeWizard CRM and Telegram AI, you will be drowning in admin at this scale.',
    tasks: [
      {
        title: 'Build scheduling system (TribeWizard CRM auto-assign)',
        description: 'Implement or integrate a CRM/scheduling tool that auto-assigns jobs based on: (a) cleaner availability, (b) suburb proximity, (c) client preference for specific cleaner, (d) workload balance. At 10 cleaners and 40+ jobs/week, manual scheduling is a 15hr/week task. TribeWizard or Jobber can cut this to 3hr/week. Eddie: "Automate scheduling or die."',
        priority: 'urgent',
      },
      {
        title: 'Communication hub: all customer messages → Telegram → AI handles 80%',
        description: 'Set up a unified communication pipeline: website chat, SMS, email, WhatsApp → all forward to a Telegram channel. An AI agent (GPT-based) fields 80% of queries: quotes, availability, rescheduling, "what time is my clean?". Flag complex issues (complaints, new contracts) for your attention. This scales your customer service without hiring an admin.',
        priority: 'urgent',
      },
      {
        title: 'Hire Cleaner #9',
        description: 'Ninth cleaner. By now you should have a pool of pre-vetted applicants ready to go. Target: onboard in 2 days, first solo clean by day 3. At this scale, each new cleaner adds ~$1,000-1,500/week in revenue capacity.',
        priority: 'high',
      },
      {
        title: 'Document the full operations manual (Eddie playbook v1)',
        description: 'Compile all SOPs, training checklists, quality procedures, scheduling rules, revenue splits, and client protocols into a single Operations Manual. This is the playbook that lets anyone run TCS if you are sick. Eddie: "A business that depends on you for every decision is a job, not a business."',
        priority: 'high',
      },
      {
        title: 'Target: 35 Google reviews',
        description: 'With the review funnel running for 3 months and 7-9 cleaners generating post-clean emails, you should be getting 3-5 reviews/week. Target: hit 35 total reviews this month. At 35 reviews, you dominate the local pack for multiple suburbs.',
        priority: 'medium',
      },
    ],
  },
  {
    title: 'Month 11 — Scale to 10 Cleaners (Financial Control)',
    subtitle: 'Phase 4: Lock down financial tracking and push to 10 cleaners. Revenue target: $40k/month. This is where TCS becomes a serious business.',
    tasks: [
      {
        title: 'Hire Cleaner #10 — milestone reached',
        description: 'You have 10 cleaners. This is a major milestone. From Eddie solo to 10-person operation in 11 months. Celebrate it. Now the challenge shifts from "can we get enough jobs" to "can we manage this operation profitably?" Each cleaner should be generating $800-1,000/week in revenue (5+ jobs).',
        priority: 'urgent',
      },
      {
        title: 'Financial tracking: auto-calculate weekly payouts and monthly P&L',
        description: 'Build or integrate a financial dashboard: (a) weekly payout calculator per cleaner (jobs done × split rate), (b) monthly P&L (revenue - cleaner costs - supplies - insurance - software - vehicle - tax), (c) profit margin tracker. Automate this — at 10 cleaners, manual bookkeeping is a 10hr/week job. Use Supabase + scheduled functions or connect to Xero.',
        priority: 'urgent',
      },
      {
        title: 'Revenue target: $40,000/month',
        description: 'With 10 cleaners at 20hrs/week each, running 50+ jobs/week at average $200/job, target revenue is $40,000/month. This is achievable if utilization stays above 75%. Track weekly: if revenue drops below $8,000/week, diagnose immediately — it is almost always a sales or scheduling problem, not a cleaner problem.',
        priority: 'urgent',
      },
      {
        title: 'Profit target: $20,000/month (50% margin)',
        description: 'At $40k revenue, target 50% net margin = $20k/month profit. Breakdown: $20k cleaner payouts, $3k supplies, $500 insurance, $500 software, $1k vehicle, $1k misc = $26k costs. $40k - $26k = $14k baseline. To hit $20k, optimize: (a) negotiate supply discounts, (b) increase average job value (upsell deep cleans), (c) reduce travel waste.',
        priority: 'high',
      },
      {
        title: 'Set up BAS/quarterly tax reporting system',
        description: 'At $40k/month revenue ($480k/year projected), ATO compliance is critical. Set up: (a) quarterly BAS lodgment, (b) GST tracking on all income and expenses, (c) contractor payment summaries, (d) superannuation if any employees. Engage an accountant if you have not already. Eddie: "The ATO is the one client you never want to disappoint."',
        priority: 'high',
      },
      {
        title: 'Build cleaner retention program',
        description: 'At 10 cleaners, turnover is your biggest risk. Implement: (a) performance bonuses ($50/week for zero complaints), (b) birthday/holiday acknowledgement, (c) preferred schedule for top performers, (d) rate progression ($25→$27→$30/hr over 12 months based on quality). Cost of replacing a cleaner: ~$500 in lost revenue + training time. Retention is cheaper than recruitment.',
        priority: 'medium',
      },
    ],
  },
  {
    title: 'Month 12 — Full Scale (Systematize & Plan Next Year)',
    subtitle: 'Phase 4 close: TCS is now a 10-cleaner, $40k/month operation. Systematize everything, review the year, and plan the next phase: 20 cleaners, $80k/month, or franchise model.',
    tasks: [
      {
        title: 'Target achieved: 40+ Google reviews',
        description: 'With 10 cleaners and a mature review funnel, you should be hitting 40+ Google reviews this month. At this level, TCS dominates the local search pack across all target western Melbourne suburbs. Reviews compound: more reviews → more trust → more bookings → more reviews. This is your moat.',
        priority: 'high',
      },
      {
        title: 'Full system audit: identify bottlenecks and breakdowns',
        description: 'After 12 months, audit every system: (a) Scheduling — any jobs falling through cracks? (b) Quality — any repeat complaints? (c) Recruiting — is the pipeline healthy? (d) Financial — is P&L accurate and timely? (e) Client retention — what is the churn rate? Document every issue with a fix and deadline.',
        priority: 'urgent',
      },
      {
        title: 'Evaluate communication hub AI: what % of queries handled automatically?',
        description: 'Review the Telegram AI agent performance. Target: 80%+ of customer queries resolved without human intervention. Track: total queries, AI-resolved, escalated to you, satisfaction rating. If AI resolves <70%, the training data or workflow needs improving. Eddie aimed for 85% automation and hit it with 3 months of prompt tuning.',
        priority: 'high',
      },
      {
        title: 'Financial review: actual vs targets for the year',
        description: 'Pull the full 12-month P&L. Compare actual revenue vs target for each month. Where did you exceed? Where did you fall short? What was the actual profit margin? What was customer acquisition cost? Lifetime value? Eddie tracked every dollar and could tell you his margin per suburb, per service type, per cleaner. Build this visibility now.',
        priority: 'urgent',
      },
      {
        title: 'Decision point: quit the day job? Evaluate safety',
        description: 'If TCS net profit has been >$10k/month for 3 consecutive months, and you have 3 months of operating expenses in savings, it is safe to quit the security job. If not: is the gap closable in 3 more months? Eddie quit when TCS profit was 2x his day job income. Build your own safety criterion and stick to it.',
        priority: 'urgent',
      },
      {
        title: 'Plan Year 2: 20 cleaners or franchise model?',
        description: 'Two paths: (a) Scale to 20 cleaners ($80k/month revenue, $40k/month profit) — requires a dedicated office manager and more systems. (b) Franchise model — sell your SOPs, brand, and systems to other cleaners in other suburbs/cities. Eddie chose (a) but considered (b). Write a 1-page decision memo comparing both options with revenue, risk, and effort projections.',
        priority: 'high',
      },
      {
        title: 'Build the remaining 9 suburb pages (complete the 20-page target)',
        description: 'You have 11 suburb pages live. Create the remaining 9 to complete the 20-page SEO network. Target remaining suburbs based on demand data from your existing clients. Each page = an organic lead source that compounds over time. Full 20-page network = estimated 50-100 organic leads/month within 6 months.',
        priority: 'medium',
      },
      {
        title: 'Celebrate: from solo to 10 cleaners in 12 months',
        description: 'You did it. One year ago you were cleaning alone. Now you manage a team of 10, generate $40k/month revenue, and have systems that run without you. Take a day off. Seriously. Eddie: "The best thing I did was celebrate the milestones. Otherwise the grind feels endless." Reflect, rest, then come back hungry for Year 2.',
        priority: 'medium',
      },
    ],
  },
];

// ─── Seeder ─────────────────────────────────────────────────────

/**
 * Seeds the TCS 90-Day Growth Plan as goals + tasks.
 * Idempotent — if the parent goal already exists, does nothing.
 *
 * Plan now covers 12 months (expanded Eddie/Maid2Clean playbook).
 * Title remains "TCS 90-Day Growth Plan" for idempotency.
 */
export async function seedTCSGrowthPlan(userId: string): Promise<void> {
  // Check if plan already exists
  const { data: existing } = await supabase
    .from('goals')
    .select('id')
    .eq('user_id', userId)
    .eq('title', 'TCS 90-Day Growth Plan')
    .eq('is_deleted', false)
    .limit(1);

  if (existing && existing.length > 0) {
    // Plan already seeded — don't duplicate
    return;
  }

  const now = new Date();
  const targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() + 365); // 12-month plan
  const targetDateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD

  // Create parent goal
  const parentId = genId();
  const { error: parentError } = await supabase.from('goals').insert({
    id: parentId,
    user_id: userId,
    title: 'TCS 90-Day Growth Plan',
    description:
      'Eddie/Maid2Clean 12-month expansion plan: Foundation (M1) → First Hire (M2-3) → Scale to 4 Cleaners (M4-6) → Systems & SEO (M7-9) → Scale to 10 Cleaners (M10-12). Target: $40k/mo revenue, $20k/mo profit, 40+ Google reviews.',
    status: 'active',
    domain: 'financial',
    category: 'growth-plan',
    parent_goal_id: null,
    target_date: targetDateStr,
    is_deleted: false,
    created_at: now.toISOString(),
  });

  if (parentError) {
    console.error('[tcs-growth-seed] Failed to create parent goal:', parentError);
    return;
  }

  // Create sub-goals and tasks for each month
  for (let mi = 0; mi < GROWTH_PLAN.length; mi++) {
    const month = GROWTH_PLAN[mi];
    const monthNumber = mi + 1;

    // Sub-goal target date: monthNumber * 30 days from now
    const monthTargetDate = new Date(now);
    monthTargetDate.setDate(monthTargetDate.getDate() + monthNumber * 30);
    const monthTargetStr = monthTargetDate.toISOString().split('T')[0];

    const subGoalId = genId();
    const { error: subError } = await supabase.from('goals').insert({
      id: subGoalId,
      user_id: userId,
      title: month.title,
      description: month.subtitle,
      status: 'active',
      domain: 'financial',
      category: 'growth-milestone',
      parent_goal_id: parentId,
      target_date: monthTargetStr,
      is_deleted: false,
      created_at: now.toISOString(),
    });

    if (subError) {
      console.error(`[tcs-growth-seed] Failed to create Month ${monthNumber} sub-goal:`, subError);
      continue;
    }

    // Create tasks under this sub-goal
    const tasks = month.tasks.map((task, ti) => ({
      id: genId(),
      user_id: userId,
      goal_id: subGoalId,
      title: task.title,
      description: task.description,
      status: 'pending' as const,
      priority: task.priority,
      board_status: 'todo',
      domain: 'financial',
      due_date: monthTargetStr,
      board_position: ti,
      is_deleted: false,
      created_at: now.toISOString(),
    }));

    const { error: tasksError } = await supabase.from('tasks').insert(tasks);

    if (tasksError) {
      console.error(`[tcs-growth-seed] Failed to insert tasks for Month ${monthNumber}:`, tasksError);
    }
  }
}