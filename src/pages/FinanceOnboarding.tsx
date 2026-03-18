/**
 * Finance Onboarding — Phase 3 (Immersive Dialogue with The Merchant)
 *
 * Full-page RPG-styled conversation that gathers financial profile data.
 * On finalize: creates recurring transactions, budget goals, financial habits.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../stores/useUserStore';
import { PHASES } from '../lib/onboarding-phases';
import { SetupDialogue } from '../components/setup/SetupDialogue';
import { materializeFinance } from '../lib/materialize';
import { populateFinancialTables } from '../lib/financial-engine';
import { logger } from '../utils/logger';

const phase = PHASES.finance;

export function FinanceOnboarding() {
  const user = useUserStore(s => s.user);
  const navigate = useNavigate();
  const [savedData, setSavedData] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase.from('user_profiles').select('preferences').eq('user_id', user.id).single()
      .then(({ data: profile }) => {
        const prefs = profile?.preferences as any;
        if (prefs?.finance_onboarding_data) {
          setSavedData(prefs.finance_onboarding_data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user]);

  const handleComplete = async (data: Record<string, any>) => {
    if (!user) return;
    try {
      // Deterministic materialisation — goals, tasks, habits, recurring transactions
      logger.log('[FinanceOnboarding] Materialising finance data...');
      const result = await materializeFinance(user.id, data, { cleanFirst: true });
      logger.log('[FinanceOnboarding] Result:', result);

      // Populate financial tables — bills, recurring transactions, businesses
      logger.log('[FinanceOnboarding] Populating financial tables...');
      const finResult = await populateFinancialTables(user.id, data);
      logger.log('[FinanceOnboarding] Financial tables:', finResult);

      // Save completion
      const { data: currentProfile } = await supabase
        .from('user_profiles').select('preferences').eq('user_id', user.id).single();
      const prefs = (currentProfile?.preferences || {}) as Record<string, any>;

      await supabase.from('user_profiles').upsert({
        user_id: user.id,
        preferences: {
          ...prefs,
          finance_onboarding_data: data,
          finance_onboarding_percent: 100,
          finance_profile: {
            employment_type: data.employmentType,
            income_sources: data.incomeSources,
            income_range: data.incomeRange,
            business_name: data.businessName,
            business_type: data.businessType,
            budgeting_method: data.budgetingMethod,
            savings_rate: data.savingsRate,
            investment_experience: data.investmentExperience,
            tax_situation: data.taxSituation,
            financial_stress: data.financialStress,
            emergency_fund: data.emergencyFund,
          },
        },
      }, { onConflict: 'user_id' });

      navigate('/');
    } catch (err) {
      logger.error('Finance onboarding error:', err);
      navigate('/');
    }
  };

  if (loading) {
    return (
      <div style={{
        height: '100dvh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#050E1A',
      }}>
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  return (
    <SetupDialogue
      phase={phase}
      onComplete={handleComplete}
      initialData={savedData || undefined}
    />
  );
}
