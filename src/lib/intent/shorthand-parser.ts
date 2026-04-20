/**
 * LifeOS Intent Engine — Shorthand Parser
 *
 * Catches common patterns (e.g. "fuel 89", "groceries $38")
 * before hitting the LLM, saving tokens and latency.
 */

import type { IntentResult, IntentContext } from './types';

// ═══ SHORTHAND PARSER ═══

export function parseShorthand(msg: string, ctx: IntentContext): IntentResult | null {
  const trimmed = msg.trim();
  const today = ctx.today || new Date().toISOString().slice(0, 10);

  // ── Expense patterns ──
  // "fuel 89", "groceries $38", "petrol $120.50", "lunch 15", "coffee $5.50"
  const expensePatterns = [
    // "fuel 89" or "fuel $89" or "fuel $89.50"
    /^(fuel|petrol|gas|diesel|groceries|grocery|food|lunch|dinner|breakfast|coffee|uber|parking|toll|tolls|rent|electricity|water|internet|phone|insurance|cleaning supplies|supplies|equipment|tools|uniform|clothing|medical|pharmacy|vet|haircut|barber|gym|subscription|netflix|spotify)\s+\$?(\d+(?:\.\d{1,2})?)\s*$/i,
    // "$89 fuel" or "$89.50 on fuel"
    /^\$?(\d+(?:\.\d{1,2})?)\s+(?:on\s+|for\s+)?(fuel|petrol|gas|diesel|groceries|grocery|food|lunch|dinner|breakfast|coffee|uber|parking|toll|tolls|rent|electricity|water|internet|phone|insurance|cleaning supplies|supplies|equipment|tools|uniform|clothing|medical|pharmacy|vet|haircut|barber|gym|subscription)\s*$/i,
    // "spent 89 on fuel" or "paid $89 for groceries"
    /^(?:spent|paid|cost)\s+\$?(\d+(?:\.\d{1,2})?)\s+(?:on|for)\s+(.+)$/i,
  ];

  // Work-related expense keywords → auto-deductible
  const deductibleKeywords = /fuel|petrol|gas|diesel|cleaning supplies|supplies|equipment|tools|uniform|clothing|work|business/i;

  for (const pattern of expensePatterns) {
    const match = trimmed.match(pattern);
    if (match) {
      let description: string;
      let amount: number;

      if (pattern === expensePatterns[0]) {
        description = match[1];
        amount = parseFloat(match[2]);
      } else if (pattern === expensePatterns[1]) {
        amount = parseFloat(match[1]);
        description = match[2];
      } else {
        amount = parseFloat(match[1]);
        description = match[2];
      }

      // Capitalize first letter
      description = description.charAt(0).toUpperCase() + description.slice(1).toLowerCase();
      const isDeductible = deductibleKeywords.test(description);

      return {
        actions: [{
          type: 'expense',
          data: {
            amount,
            description,
            date: today,
            is_recurring: false,
            is_deductible: isDeductible,
          },
          summary: `Log $${amount.toFixed(2)} expense for ${description.toLowerCase()}`,
          confidence: 0.95,
        }],
        reply: `✅ Logged $${amount.toFixed(2)} expense for ${description.toLowerCase()}${isDeductible ? ' (tax deductible)' : ''}`,
        needs_confirmation: false,
      };
    }
  }

  // ── Income patterns ──
  // "earned 500", "got paid 1200", "cleaning 150", "income 500"
  const incomePatterns = [
    /^(?:earned|got paid|received|income|pay|payment)\s+\$?(\d+(?:\.\d{1,2})?)\s*(?:from\s+(.+))?$/i,
    /^(?:cleaning|security|work)\s+\$?(\d+(?:\.\d{1,2})?)$/i,
  ];

  for (const pattern of incomePatterns) {
    const match = trimmed.match(pattern);
    if (match) {
      const amount = parseFloat(match[1]);
      const source = match[2] || (pattern === incomePatterns[1] ? match[0].split(/\s/)[0] : 'Work');

      return {
        actions: [{
          type: 'income',
          data: {
            amount,
            source: source.charAt(0).toUpperCase() + source.slice(1),
            date: today,
            is_recurring: false,
          },
          summary: `Log $${amount.toFixed(2)} income from ${source}`,
          confidence: 0.95,
        }],
        reply: `✅ Logged $${amount.toFixed(2)} income from ${source}`,
        needs_confirmation: false,
      };
    }
  }

  return null; // No shorthand match — fall through to LLM
}

// ═══ TIME PARSER ═══

export function parseTimeToToday(timeStr: string): Date {
  const now = new Date();
  let hours = 0, minutes = 0;

  // Try "HH:MM" or "H:MM" with optional am/pm
  const colonMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (colonMatch) {
    hours = parseInt(colonMatch[1]);
    minutes = parseInt(colonMatch[2]);
    if (colonMatch[3]) {
      if (colonMatch[3].toLowerCase() === 'pm' && hours < 12) hours += 12;
      if (colonMatch[3].toLowerCase() === 'am' && hours === 12) hours = 0;
    }
  } else {
    // Try "530am" or "6am" style
    const compactMatch = timeStr.match(/(\d{1,4})\s*(am|pm)/i);
    if (compactMatch) {
      const num = compactMatch[1];
      if (num.length <= 2) {
        hours = parseInt(num);
      } else {
        hours = parseInt(num.slice(0, -2));
        minutes = parseInt(num.slice(-2));
      }
      if (compactMatch[2].toLowerCase() === 'pm' && hours < 12) hours += 12;
      if (compactMatch[2].toLowerCase() === 'am' && hours === 12) hours = 0;
    }
  }

  const result = new Date(now);
  result.setHours(hours, minutes, 0, 0);
  return result;
}