import { useRouter } from 'expo-router';
import { GoalForm } from '@/components/goal-form';

// Lives outside the (onboarding) group on purpose: the root redirect gate sends onboarded users out of
// that group, so editing from there would bounce straight back to the tabs.
export default function EditGoal() {
  const router = useRouter();
  return <GoalForm mode="edit" onDone={() => router.back()} />;
}
