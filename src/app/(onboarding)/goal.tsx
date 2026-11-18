import { GoalForm } from '@/components/goal-form';

// First-time setup. After saving, the root redirect gate sends the user on to the tabs.
export default function Onboarding() {
  return <GoalForm mode="onboarding" />;
}
