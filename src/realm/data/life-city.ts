/**
 * Life City — Detailed Data
 *
 * Building interiors, NPC dialogue trees, interaction points,
 * decorative elements, and ambiance hints for the main multiplayer hub.
 */

// ═══════════════════════════════════════════════════
// BUILDING INTERIORS
// ═══════════════════════════════════════════════════

export interface BuildingInterior {
  buildingId: string;
  name: string;
  description: string;
  activities: BuildingActivity[];
  shopItems?: ShopItem[];
}

export interface BuildingActivity {
  id: string;
  label: string;
  description: string;
  icon: string;
  /** XP reward for doing this activity */
  xpReward: number;
  /** Whether this activity is multiplayer (visible to others) */
  isSocial?: boolean;
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  cost: number;
  currency: 'coins' | 'gems';
  category: 'cosmetic' | 'boost' | 'companion' | 'furniture';
}

export const LIFE_CITY_BUILDINGS: BuildingInterior[] = [
  {
    buildingId: 'lc_town_hall',
    name: 'Town Hall',
    description: 'The seat of Life City governance. Meet the Mayor, pick up civic quests, and check the quest board.',
    activities: [
      { id: 'visit_mayor', label: 'Meet the Mayor', description: 'Receive daily civic quests and announcements', icon: '🏛️', xpReward: 10, isSocial: true },
      { id: 'check_quest_board', label: 'Quest Board', description: 'Browse available community and solo quests', icon: '📋', xpReward: 5 },
      { id: 'view_announcements', label: 'Announcements', description: 'See the latest city news and events', icon: '📢', xpReward: 0 },
      { id: 'register_guild', label: 'Register a Guild', description: 'Create a new guild or manage your existing ones', icon: '⚔️', xpReward: 25, isSocial: true },
    ],
  },
  {
    buildingId: 'lc_arena',
    name: 'Arena',
    description: 'Prove your discipline in the Arena. Compete in streak battles, habit challenges, and XP races.',
    activities: [
      { id: 'streak_battle', label: 'Streak Battle', description: 'Compare your current streak against another player', icon: '🔥', xpReward: 30, isSocial: true },
      { id: 'xp_race', label: 'XP Race', description: '24-hour XP competition — whoever gains more wins', icon: '⚡', xpReward: 20, isSocial: true },
      { id: 'habit_challenge', label: 'Habit Challenge', description: 'Both players commit to logging all habits today', icon: '✅', xpReward: 15, isSocial: true },
      { id: 'view_leaderboard', label: 'Arena Leaderboard', description: 'See the top competitors this week', icon: '🏆', xpReward: 0 },
    ],
  },
  {
    buildingId: 'lc_tavern',
    name: 'Tavern',
    description: 'The social heart of Life City. Meet fellow adventurers, share stories, and find groups.',
    activities: [
      { id: 'sit_by_fire', label: 'Sit by the Fire', description: 'AFK-friendly rest area. Warm your streak.', icon: '🔥', xpReward: 2 },
      { id: 'party_finder', label: 'Party Finder', description: 'Looking for group? Post your interests here.', icon: '🔍', xpReward: 5, isSocial: true },
      { id: 'share_story', label: 'Share a Story', description: 'Tell the tavern about your latest achievement', icon: '📖', xpReward: 10, isSocial: true },
      { id: 'open_mic', label: 'Open Mic', description: 'Express yourself — emotes, jokes, life updates', icon: '🎤', xpReward: 5, isSocial: true },
    ],
  },
  {
    buildingId: 'lc_market_hall',
    name: 'Market Hall',
    description: 'Trade goods, browse the marketplace, and pick up deals from traveling merchants.',
    activities: [
      { id: 'browse_market', label: 'Browse Market', description: 'Check the rotating daily deals and cosmetic items', icon: '🛍️', xpReward: 0 },
      { id: 'trade_post', label: 'Trade Post', description: 'Exchange items with other players', icon: '🔄', xpReward: 10, isSocial: true },
      { id: 'daily_deal', label: 'Daily Deal', description: 'A special discounted item refreshed each day', icon: '🏷️', xpReward: 0 },
      { id: 'sell_items', label: 'Sell Items', description: 'Convert unused inventory to coins', icon: '💰', xpReward: 0 },
    ],
    shopItems: [
      { id: 'cosmetic_1', name: 'Golden Cape', description: 'A shimmering golden cape for your character', icon: '🧥', cost: 500, currency: 'coins', category: 'cosmetic' },
      { id: 'boost_1', name: 'XP Elixir', description: '2x XP for the next hour', icon: '🧪', cost: 100, currency: 'gems', category: 'boost' },
      { id: 'companion_1', name: 'Phoenix Hatchling', description: 'A tiny fire bird companion', icon: '🐣', cost: 1000, currency: 'gems', category: 'companion' },
      { id: 'furniture_1', name: 'Fountain Chair', description: 'A decorative bench for your house', icon: '🪑', cost: 200, currency: 'coins', category: 'furniture' },
    ],
  },
  {
    buildingId: 'lc_guild_hall',
    name: 'Guild Hall',
    description: 'The war room for guilds. Coordinate objectives, view guild progress, and rally your team.',
    activities: [
      { id: 'guild_dashboard', label: 'Guild Dashboard', description: 'View your guild status, objectives, and leaderboard', icon: '📊', xpReward: 5 },
      { id: 'guild_objectives', label: 'Guild Objectives', description: 'Check and contribute to active guild goals', icon: '🎯', xpReward: 15, isSocial: true },
      { id: 'guild_chat', label: 'Guild Chat', description: 'Talk with guild members in real-time', icon: '💬', xpReward: 0, isSocial: true },
      { id: 'guild_recruit', label: 'Recruitment Board', description: 'Browse guilds looking for new members', icon: '🤝', xpReward: 5, isSocial: true },
    ],
  },
  {
    buildingId: 'lc_workshop',
    name: 'Workshop',
    description: 'Crafting and upgrading hub. Forge equipment, enchant items, and build character upgrades.',
    activities: [
      { id: 'forge_item', label: 'Forge Item', description: 'Combine materials to create equipment', icon: '⚒️', xpReward: 15 },
      { id: 'enchant', label: 'Enchant', description: 'Add magical properties to your gear', icon: '✨', xpReward: 20 },
      { id: 'upgrade_backpack', label: 'Upgrade Backpack', description: 'Increase your inventory capacity', icon: '🎒', xpReward: 10 },
      { id: 'craft_companion', label: 'Craft Companion Gear', description: 'Make accessories for your companion', icon: '🐾', xpReward: 10 },
    ],
  },
  {
    buildingId: 'lc_library',
    name: 'Library',
    description: 'The repository of all knowledge. Study life strategies, browse the wiki, and exchange tips.',
    activities: [
      { id: 'study_guide', label: 'Study a Guide', description: 'Read community-written life strategy guides', icon: '📓', xpReward: 10 },
      { id: 'submit_tip', label: 'Submit a Tip', description: 'Share a productivity or life tip with others', icon: '💡', xpReward: 15, isSocial: true },
      { id: 'knowledge_exchange', label: 'Knowledge Exchange', description: 'Q&A — ask questions, get answers from the community', icon: '❓', xpReward: 10, isSocial: true },
      { id: 'read_lore', label: 'Read Realm Lore', description: 'Discover the history and legends of the Realm', icon: '📜', xpReward: 5 },
    ],
  },
  {
    buildingId: 'lc_observatory',
    name: 'Observatory',
    description: 'Gaze into the future. View forecasts, predictions, and your life trajectory.',
    activities: [
      { id: 'view_forecast', label: 'View Forecast', description: 'See your predicted XP, streak, and level trajectory', icon: '🔮', xpReward: 5 },
      { id: 'constellation_map', label: 'Constellation Map', description: 'Map your life domains as a star chart', icon: '⭐', xpReward: 10 },
      { id: 'time_capsule', label: 'Time Capsule', description: 'Write a message to your future self', icon: '📬', xpReward: 10 },
      { id: 'realm_events_view', label: 'Realm Events', description: 'View upcoming seasonal events and world boss schedules', icon: '🌌', xpReward: 0 },
    ],
  },
];

// ═══════════════════════════════════════════════════
// NPC DIALOGUE TREES
// ═══════════════════════════════════════════════════

export interface DialogueNode {
  id: string;
  text: string;
  /** If set, this is a terminal node (no choices) */
  isTerminal?: boolean;
  /** Choices available at this node */
  choices?: DialogueChoice[];
}

export interface DialogueChoice {
  label: string;
  nextNodeId: string;
  /** Optional action to trigger when this choice is selected */
  action?: string;
}

export interface NPCDialogueTree {
  npcId: string;
  name: string;
  greetingNode: string;
  nodes: Record<string, DialogueNode>;
}

export const LIFE_CITY_NPC_DIALOGUES: NPCDialogueTree[] = [
  // ── Mayor Eleanor ──
  {
    npcId: 'lc_mayor',
    name: 'Mayor Eleanor',
    greetingNode: 'greet',
    nodes: {
      greet: {
        id: 'greet',
        text: 'Welcome to Life City, adventurer! I am Mayor Eleanor. This city thrives when its people thrive. How can I help you today?',
        choices: [
          { label: 'Any quests for me?', nextNodeId: 'quests' },
          { label: 'Tell me about Life City', nextNodeId: 'about_city' },
          { label: 'I want to help the community', nextNodeId: 'community' },
          { label: 'Goodbye', nextNodeId: 'goodbye' },
        ],
      },
      quests: {
        id: 'quests',
        text: 'Of course! We always need brave souls. Today\'s civic quests include: logging 5 healthy habits, completing 3 tasks, and writing a journal reflection. Which one calls to you?',
        choices: [
          { label: 'The habit quest', nextNodeId: 'quest_habit', action: 'accept_quest:habit_5' },
          { label: 'The task quest', nextNodeId: 'quest_task', action: 'accept_quest:task_3' },
          { label: 'The journal quest', nextNodeId: 'quest_journal', action: 'accept_quest:journal_1' },
          { label: 'I\'ll come back later', nextNodeId: 'greet' },
        ],
      },
      quest_habit: {
        id: 'quest_habit',
        text: 'Excellent choice! Log 5 habits today and the city will reward you with 50 XP. Your discipline strengthens us all!',
        isTerminal: true,
      },
      quest_task: {
        id: 'quest_task',
        text: 'A practical soul! Complete 3 tasks and earn 40 XP. Efficiency is the backbone of progress!',
        isTerminal: true,
      },
      quest_journal: {
        id: 'quest_journal',
        text: 'A reflective spirit! Write a journal entry today for 30 XP. Self-knowledge is the greatest treasure!',
        isTerminal: true,
      },
      about_city: {
        id: 'about_city',
        text: 'Life City was built by adventurers like you. Every habit logged adds a brick, every goal reached raises a tower. The Arena tests discipline, the Tavern builds friendships, and the Observatory peers into tomorrow.',
        choices: [
          { label: 'What about events?', nextNodeId: 'events_info' },
          { label: 'Thanks, I\'ll explore!', nextNodeId: 'goodbye' },
        ],
      },
      events_info: {
        id: 'events_info',
        text: 'We hold seasonal festivals — the Spring Festival brings new beginnings, Summer Arena heats up competition, Autumn Harvest celebrates abundance, and Winter Solstice brings reflection. Check the event board near the Town Hall for dates!',
        choices: [
          { label: 'Sounds great!', nextNodeId: 'greet' },
        ],
      },
      community: {
        id: 'community',
        text: 'That\'s the spirit! Community challenges unlock decorations for Life City. Right now we\'re working toward the Golden Fountain — everyone needs to log 1000 habits combined. Every contribution counts!',
        choices: [
          { label: 'I\'ll do my part!', nextNodeId: 'comm_pledge', action: 'pledge_community' },
          { label: 'Tell me more', nextNodeId: 'comm_detail' },
        ],
      },
      comm_pledge: {
        id: 'comm_pledge',
        text: 'Wonderful! Every habit you log gets us closer. The fountain will be spectacular — water that shimmers with every color of achievement!',
        isTerminal: true,
      },
      comm_detail: {
        id: 'comm_detail',
        text: 'Community challenges are cooperative goals. When everyone contributes enough, we unlock permanent decorations in Life City. Past unlocks include the Celestial Clock, the Rose Archway, and the Starlight Bridge.',
        choices: [
          { label: 'Amazing!', nextNodeId: 'greet' },
        ],
      },
      goodbye: {
        id: 'goodbye',
        text: 'May your streak never break, adventurer! The city is watching and cheering for you.',
        isTerminal: true,
      },
    },
  },

  // ── Arena Master Kael ──
  {
    npcId: 'lc_arena_master',
    name: 'Arena Master Kael',
    greetingNode: 'greet',
    nodes: {
      greet: {
        id: 'greet',
        text: 'Hah! Another challenger approaches! I am Kael, master of the Arena. Here we test discipline, not just strength. What brings you?',
        choices: [
          { label: 'I want to compete!', nextNodeId: 'compete' },
          { label: 'What competitions are there?', nextNodeId: 'comp_types' },
          { label: 'Show me the leaderboard', nextNodeId: 'leaderboard', action: 'view_leaderboard' },
          { label: 'Maybe later', nextNodeId: 'goodbye' },
        ],
      },
      compete: {
        id: 'compete',
        text: 'That\'s the fire I like to see! You can challenge someone to a Streak Battle, enter an XP Race, or commit to a Habit Challenge. Which one?',
        choices: [
          { label: 'Streak Battle', nextNodeId: 'streak_battle', action: 'start_competition:streak' },
          { label: 'XP Race', nextNodeId: 'xp_race', action: 'start_competition:xp_race' },
          { label: 'Habit Challenge', nextNodeId: 'habit_challenge', action: 'start_competition:habit' },
        ],
      },
      streak_battle: {
        id: 'streak_battle',
        text: 'Streak Battle! Both competitors keep their habits — whoever has the longer streak at midnight wins 50 bonus XP. Choose your opponent wisely!',
        isTerminal: true,
      },
      xp_race: {
        id: 'xp_race',
        text: 'XP Race! 24 hours. Most XP gained wins. No shortcuts — only genuine life actions count. Good luck!',
        isTerminal: true,
      },
      habit_challenge: {
        id: 'habit_challenge',
        text: 'Habit Challenge! Both players commit to logging ALL their habits today. If both succeed, both earn 30 XP. If one fails, the other takes the bonus!',
        isTerminal: true,
      },
      comp_types: {
        id: 'comp_types',
        text: 'The Arena hosts three types of competition: Streak Battles (compare streaks), XP Races (24-hour XP sprint), and Habit Challenges (mutual accountability). Winners earn bonus XP and Arena reputation!',
        choices: [
          { label: 'Sign me up!', nextNodeId: 'compete' },
          { label: 'I\'ll train first', nextNodeId: 'goodbye' },
        ],
      },
      leaderboard: {
        id: 'leaderboard',
        text: 'The Arena Leaderboard resets every Monday. Top competitors earn exclusive titles and the admiration of the entire city!',
        isTerminal: true,
      },
      goodbye: {
        id: 'goodbye',
        text: 'Train hard, fight clean. I\'ll be here when you\'re ready to prove yourself!',
        isTerminal: true,
      },
    },
  },

  // ── Tavern Keeper Rosa ──
  {
    npcId: 'lc_tavern_keeper',
    name: 'Tavern Keeper Rosa',
    greetingNode: 'greet',
    nodes: {
      greet: {
        id: 'greet',
        text: 'Come in, come in! Warm yourself by the fire. I\'m Rosa — I keep this Tavern running and the stories flowing. What\'s your pleasure?',
        choices: [
          { label: 'Find a group', nextNodeId: 'party_finder', action: 'open_party_finder' },
          { label: 'Tell me a story', nextNodeId: 'story' },
          { label: 'Any social events?', nextNodeId: 'events' },
          { label: 'Just resting', nextNodeId: 'rest' },
        ],
      },
      party_finder: {
        id: 'party_finder',
        text: 'Looking for companions? Smart move! I keep a board of adventurers seeking groups. You can post yourself or browse existing parties. Everything\'s better with friends!',
        isTerminal: true,
      },
      story: {
        id: 'story',
        text: 'Ah, stories! Did you hear about the adventurer who completed a 365-day streak? They say the Procrastination Dragon itself fled the Realm! ...Or maybe that\'s just a legend. *winks*',
        choices: [
          { label: 'Tell me another!', nextNodeId: 'story2' },
          { label: 'I should write my own story', nextNodeId: 'write_story', action: 'share_story' },
        ],
      },
      story2: {
        id: 'story2',
        text: 'There was once a guild that logged 10,000 habits in a single month. The Market Quarter erected a statue in their honor! They say the Golden Fountain first sprang to life that night...',
        choices: [
          { label: 'Incredible!', nextNodeId: 'greet' },
        ],
      },
      write_story: {
        id: 'write_story',
        text: 'That\'s the spirit! Share your latest achievement with the Tavern. The crowd always appreciates a good tale of discipline and growth!',
        isTerminal: true,
      },
      events: {
        id: 'events',
        text: 'This week we have Open Mic Night every evening, and the weekend brings the Social Mixer — a chance to meet new accountability partners. The Campfire Stories event is especially popular!',
        choices: [
          { label: 'Count me in!', nextNodeId: 'join_event', action: 'join_social_event' },
          { label: 'Sounds nice', nextNodeId: 'greet' },
        ],
      },
      join_event: {
        id: 'join_event',
        text: 'Wonderful! I\'ve put your name on the list. The next event starts soon. Don\'t be late — the best seats are by the fire!',
        isTerminal: true,
      },
      rest: {
        id: 'rest',
        text: 'Take your time, friend. The fire\'s warm, the mead\'s cold, and your streak will still be here when you\'re ready. Sometimes rest IS the quest.',
        isTerminal: true,
      },
    },
  },

  // ── Librarian Sage Ashwin ──
  {
    npcId: 'lc_librarian',
    name: 'Librarian Sage Ashwin',
    greetingNode: 'greet',
    nodes: {
      greet: {
        id: 'greet',
        text: 'Shhh... welcome to the Library. I am Ashwin, keeper of knowledge and curator of wisdom. What would you like to learn?',
        choices: [
          { label: 'Browse guides', nextNodeId: 'guides' },
          { label: 'Ask a question', nextNodeId: 'questions', action: 'open_knowledge_exchange' },
          { label: 'Share a tip', nextNodeId: 'share_tip', action: 'submit_tip' },
          { label: 'Read Realm lore', nextNodeId: 'lore' },
        ],
      },
      guides: {
        id: 'guides',
        text: 'We have guides on habit stacking, goal decomposition, the science of streaks, financial budgeting strategies, and many more. Community-written and peer-reviewed. Which topic interests you?',
        choices: [
          { label: 'Habit strategies', nextNodeId: 'guide_habits' },
          { label: 'Goal setting', nextNodeId: 'guide_goals' },
          { label: 'Budget tips', nextNodeId: 'guide_budget' },
          { label: 'Show all', nextNodeId: 'guide_all', action: 'open_guide_list' },
        ],
      },
      guide_habits: {
        id: 'guide_habits',
        text: 'The top-rated habit guide is "Atomic Habits in the Realm" — it teaches how to stack habits for compound growth. Would you like to study it?',
        choices: [
          { label: 'Yes, study it', nextNodeId: 'study', action: 'study_guide:habit' },
          { label: 'Maybe later', nextNodeId: 'greet' },
        ],
      },
      guide_goals: {
        id: 'guide_goals',
        text: 'The most popular goal guide is "From Dream to Done" — breaking big goals into weekly milestones. Highly recommended!',
        choices: [
          { label: 'Study it', nextNodeId: 'study', action: 'study_guide:goals' },
          { label: 'Later', nextNodeId: 'greet' },
        ],
      },
      guide_budget: {
        id: 'guide_budget',
        text: '"Coins & Character" is the budget classic — 50/30/20 rule adapted for the Realm. Simple and effective!',
        choices: [
          { label: 'Study it', nextNodeId: 'study', action: 'study_guide:budget' },
          { label: 'Later', nextNodeId: 'greet' },
        ],
      },
      study: {
        id: 'study',
        text: 'Knowledge is power! Read carefully, take notes, and earn 10 XP for your dedication. The Library rewards the curious!',
        isTerminal: true,
      },
      guide_all: {
        id: 'guide_all',
        text: 'I\'ve opened the full guide catalog for you. There are guides for every aspect of life — take your time browsing!',
        isTerminal: true,
      },
      questions: {
        id: 'questions',
        text: 'The Knowledge Exchange is a place where adventurers ask and answer questions. Browse existing questions or ask your own. The best answers earn XP!',
        isTerminal: true,
      },
      share_tip: {
        id: 'share_tip',
        text: 'Sharing wisdom earns you 15 XP and the gratitude of fellow adventurers. What tip would you like to share with the community?',
        isTerminal: true,
      },
      lore: {
        id: 'lore',
        text: 'The Realm was born from the collective aspirations of its inhabitants. Every goal achieved, every habit maintained, adds to the living history. The Procrastination Dragon was the first enemy, born from uncompleted tasks...',
        choices: [
          { label: 'Tell me more', nextNodeId: 'lore2' },
          { label: 'Fascinating, thanks!', nextNodeId: 'goodbye' },
        ],
      },
      lore2: {
        id: 'lore2',
        text: 'They say the Habit Hydra was so powerful that no single adventurer could defeat it. It took three accountability partners working in concert. That\'s why the Guild Hall stands — because some challenges require a party.',
        choices: [
          { label: 'And the Budget Beast?', nextNodeId: 'lore3' },
          { label: 'I should form a guild!', nextNodeId: 'goodbye' },
        ],
      },
      lore3: {
        id: 'lore3',
        text: 'The Budget Beast feeds on impulsive spending and unchecked subscriptions. It grows with every unnecessary purchase. The only weapon against it? A budget, reviewed weekly.',
        isTerminal: true,
      },
      goodbye: {
        id: 'goodbye',
        text: 'May knowledge light your path, adventurer. Return whenever you seek understanding.',
        isTerminal: true,
      },
    },
  },
];

// ═══════════════════════════════════════════════════
// SPECIAL INTERACTION POINTS
// ═══════════════════════════════════════════════════

export interface InteractionPoint {
  id: string;
  name: string;
  type: 'message_board' | 'quest_board' | 'party_finder' | 'trade_post';
  tileX: number;
  tileY: number;
  description: string;
  icon: string;
}

export const LIFE_CITY_INTERACTION_POINTS: InteractionPoint[] = [
  {
    id: 'lc_message_board',
    name: 'City Message Board',
    type: 'message_board',
    tileX: 24,
    tileY: 18,
    description: 'Post and read public messages from Life City residents',
    icon: '📌',
  },
  {
    id: 'lc_quest_board',
    name: 'Daily Quest Board',
    type: 'quest_board',
    tileX: 26,
    tileY: 10,
    description: 'Browse daily, weekly, and special event quests',
    icon: '📋',
  },
  {
    id: 'lc_party_finder',
    name: 'Party Finder',
    type: 'party_finder',
    tileX: 12,
    tileY: 26,
    description: 'Find groups for collaborative quests and activities',
    icon: '🔍',
  },
  {
    id: 'lc_trade_post',
    name: 'Trade Post',
    type: 'trade_post',
    tileX: 40,
    tileY: 18,
    description: 'Exchange items, cosmetics, and resources with other players',
    icon: '🔄',
  },
];

// ═══════════════════════════════════════════════════
// DECORATIVE ELEMENTS
// ═══════════════════════════════════════════════════

export interface DecorativeElement {
  id: string;
  type: 'fountain' | 'banner' | 'statue' | 'lamp_post' | 'flower_bed' | 'bench' | 'seasonal';
  tileX: number;
  tileY: number;
  name: string;
  /** Optional animation hint */
  animation?: 'shimmer' | 'sway' | 'glow' | 'flicker';
  /** Seasonal variant: if set, this element only appears during that season */
  season?: 'spring' | 'summer' | 'autumn' | 'winter';
}

export const LIFE_CITY_DECORATIONS: DecorativeElement[] = [
  // Central fountain
  { id: 'lc_central_fountain', type: 'fountain', tileX: 25, tileY: 20, name: 'Grand Fountain', animation: 'shimmer' },
  // Banners along main avenue
  { id: 'lc_banner_1', type: 'banner', tileX: 18, tileY: 18, name: 'Guild Banner', animation: 'sway' },
  { id: 'lc_banner_2', type: 'banner', tileX: 32, tileY: 18, name: 'Achievement Banner', animation: 'sway' },
  { id: 'lc_banner_3', type: 'banner', tileX: 18, tileY: 22, name: 'Community Banner', animation: 'sway' },
  { id: 'lc_banner_4', type: 'banner', tileX: 32, tileY: 22, name: 'Progress Banner', animation: 'sway' },
  // Lamp posts along paths
  { id: 'lc_lamp_1', type: 'lamp_post', tileX: 20, tileY: 16, name: 'Avenue Lamp', animation: 'flicker' },
  { id: 'lc_lamp_2', type: 'lamp_post', tileX: 30, tileY: 16, name: 'Avenue Lamp', animation: 'flicker' },
  { id: 'lc_lamp_3', type: 'lamp_post', tileX: 25, tileY: 14, name: 'Plaza Lamp', animation: 'flicker' },
  { id: 'lc_lamp_4', type: 'lamp_post', tileX: 25, tileY: 26, name: 'South Gate Lamp', animation: 'flicker' },
  // Flower beds around plaza
  { id: 'lc_flowers_1', type: 'flower_bed', tileX: 22, tileY: 17, name: 'Plaza Garden East', animation: 'sway' },
  { id: 'lc_flowers_2', type: 'flower_bed', tileX: 28, tileY: 17, name: 'Plaza Garden West', animation: 'sway' },
  // Benches for AFK sitting
  { id: 'lc_bench_1', type: 'bench', tileX: 23, tileY: 21, name: 'Fountain Bench East' },
  { id: 'lc_bench_2', type: 'bench', tileX: 27, tileY: 21, name: 'Fountain Bench West' },
  { id: 'lc_bench_3', type: 'bench', tileX: 14, tileY: 28, name: 'Tavern Porch Bench' },
  { id: 'lc_bench_4', type: 'bench', tileX: 36, tileY: 20, name: 'Library Garden Bench' },
  // Statues
  { id: 'lc_statue_1', type: 'statue', tileX: 25, tileY: 6, name: 'Statue of the First Adventurer' },
  { id: 'lc_statue_2', type: 'statue', tileX: 10, tileY: 20, name: 'Statue of Perseverance' },
  // Seasonal decorations
  { id: 'lc_spring_cherry', type: 'seasonal', tileX: 22, tileY: 16, name: 'Cherry Blossom Tree', animation: 'sway', season: 'spring' },
  { id: 'lc_summer_sun', type: 'seasonal', tileX: 28, tileY: 16, name: 'Sun Ornament', animation: 'glow', season: 'summer' },
  { id: 'lc_autumn_leaves', type: 'seasonal', tileX: 22, tileY: 16, name: 'Autumn Wreath', animation: 'sway', season: 'autumn' },
  { id: 'lc_winter_snow', type: 'seasonal', tileX: 28, tileY: 16, name: 'Snow Globe', animation: 'shimmer', season: 'winter' },
];

// ═══════════════════════════════════════════════════
// DAY/NIGHT LIGHTING CYCLE
// ═══════════════════════════════════════════════════

export interface DayNightPhase {
  name: string;
  /** Hours (0-24) when this phase begins */
  startHour: number;
  /** Sky gradient top/bottom colors */
  skyTop: string;
  skyBottom: string;
  /** Ambient light color overlay */
  ambient: string;
  /** Lamp posts on? */
  lampsOn: boolean;
  /** Particles/overlay effect */
  particleEffect?: 'fireflies' | 'snow' | 'none';
}

export const LIFE_CITY_DAY_NIGHT: DayNightPhase[] = [
  {
    name: 'Dawn',
    startHour: 6,
    skyTop: '#FFB347',
    skyBottom: '#FFCC99',
    ambient: '#FFF3E0',
    lampsOn: false,
  },
  {
    name: 'Day',
    startHour: 8,
    skyTop: '#87CEEB',
    skyBottom: '#E0F0FF',
    ambient: '#FFD700',
    lampsOn: false,
  },
  {
    name: 'Afternoon',
    startHour: 14,
    skyTop: '#87CEEB',
    skyBottom: '#D4E8FF',
    ambient: '#FFA726',
    lampsOn: false,
  },
  {
    name: 'Sunset',
    startHour: 17,
    skyTop: '#FF6B35',
    skyBottom: '#FFC857',
    ambient: '#FF8C00',
    lampsOn: true,
  },
  {
    name: 'Dusk',
    startHour: 19,
    skyTop: '#4A3560',
    skyBottom: '#7B68AE',
    ambient: '#6A5ACD',
    lampsOn: true,
    particleEffect: 'fireflies',
  },
  {
    name: 'Night',
    startHour: 21,
    skyTop: '#1B2838',
    skyBottom: '#2D4A7A',
    ambient: '#4169E1',
    lampsOn: true,
    particleEffect: 'fireflies',
  },
  {
    name: 'Late Night',
    startHour: 0,
    skyTop: '#0F1923',
    skyBottom: '#1A2744',
    ambient: '#2F4F8F',
    lampsOn: true,
    particleEffect: 'fireflies',
  },
];

/** Get the current day/night phase based on hour */
export function getCurrentDayNightPhase(hour?: number): DayNightPhase {
  const h = hour ?? new Date().getHours();
  // Find the latest phase whose startHour <= h
  let phase = LIFE_CITY_DAY_NIGHT[0];
  for (const p of LIFE_CITY_DAY_NIGHT) {
    if (h >= p.startHour) phase = p;
  }
  return phase;
}

// ═══════════════════════════════════════════════════
// CELEBRATION ANIMATIONS
// ═══════════════════════════════════════════════════

export interface CelebrationAnimation {
  id: string;
  trigger: 'streak_milestone' | 'level_up' | 'achievement' | 'community_goal' | 'boss_defeat';
  name: string;
  particleType: 'confetti' | 'fireworks' | 'golden_sparkle' | 'rainbow' | 'star_burst';
  durationSeconds: number;
  /** Zone-wide broadcast message */
  broadcastMessage?: string;
}

export const LIFE_CITY_CELEBRATIONS: CelebrationAnimation[] = [
  {
    id: 'celeb_streak_7',
    trigger: 'streak_milestone',
    name: 'Week Warrior',
    particleType: 'confetti',
    durationSeconds: 5,
    broadcastMessage: ' achieved a 7-day streak! 🎉',
  },
  {
    id: 'celeb_streak_30',
    trigger: 'streak_milestone',
    name: 'Monthly Master',
    particleType: 'fireworks',
    durationSeconds: 8,
    broadcastMessage: ' achieved a 30-day streak! 🔥🔥🔥',
  },
  {
    id: 'celeb_level_up',
    trigger: 'level_up',
    name: 'Level Up!',
    particleType: 'golden_sparkle',
    durationSeconds: 4,
    broadcastMessage: ' leveled up! ⬆️',
  },
  {
    id: 'celeb_achievement',
    trigger: 'achievement',
    name: 'Achievement Unlocked',
    particleType: 'star_burst',
    durationSeconds: 5,
  },
  {
    id: 'celeb_community_goal',
    trigger: 'community_goal',
    name: 'Community Victory',
    particleType: 'rainbow',
    durationSeconds: 10,
    broadcastMessage: 'The community achieved a goal together! 🌈',
  },
  {
    id: 'celeb_boss_defeat',
    trigger: 'boss_defeat',
    name: 'Boss Vanquished!',
    particleType: 'fireworks',
    durationSeconds: 15,
    broadcastMessage: 'A world boss has been defeated! 🏆⚔️',
  },
];

// ═══════════════════════════════════════════════════
// MUSIC / AMBIANCE HINTS
// ═══════════════════════════════════════════════════

export interface ZoneAmbiance {
  zoneId: string;
  /** Background music track hint (for audio engine) */
  musicTrack: string;
  /** Ambient sound effects loop */
  ambientSFX: string[];
  /** Volume (0-1) */
  volume: number;
}

export const LIFE_CITY_AMBIANCE: ZoneAmbiance = {
  zoneId: 'life_city',
  musicTrack: 'life_city_theme',
  ambientSFX: [
    'crowd_murmur',
    'fountain_splash',
    'distant_laughter',
    'footsteps_cobblestone',
    'birds_chirping',
  ],
  volume: 0.6,
};

/** Night-time ambiance override */
export const LIFE_CITY_NIGHT_AMBIANCE: ZoneAmbiance = {
  zoneId: 'life_city',
  musicTrack: 'life_city_night',
  ambientSFX: [
    'crickets',
    'fountain_gentle',
    'wind_soft',
    'lamp_hum',
  ],
  volume: 0.4,
};