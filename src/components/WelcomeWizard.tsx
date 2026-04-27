/**
 * WelcomeWizard — 5-Step Onboarding for LifeOS (thin orchestrator)
 *
 * Delegates all logic to useWelcomeWizard hook
 * and all rendering to WelcomeWizardUI.
 */

import { useWelcomeWizard } from './welcome-wizard/useWelcomeWizard';
import { WelcomeWizardUI } from './welcome-wizard/WelcomeWizardUI';

interface WelcomeWizardProps {
  userId: string;
  onComplete: () => void;
  onSkip?: () => void;
}

export function WelcomeWizard({ userId, onComplete, onSkip }: WelcomeWizardProps) {
  const {
    step,
    transitioning,
    hermeticVisible,
    slideDir,
    submitting,
    error,
    data,
    updateData,
    goToStep,
    handleSkip,
    handleComplete,
    canProceed,
  } = useWelcomeWizard(userId, onComplete, onSkip);

  return (
    <WelcomeWizardUI
      step={step}
      transitioning={transitioning}
      hermeticVisible={hermeticVisible}
      slideDir={slideDir}
      submitting={submitting}
      error={error}
      data={data}
      updateData={updateData}
      canProceed={canProceed}
      goToStep={goToStep}
      handleSkip={handleSkip}
      handleComplete={handleComplete}
    />
  );
}

export default WelcomeWizard;