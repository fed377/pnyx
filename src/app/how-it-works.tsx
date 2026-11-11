import { useRouter } from "expo-router";
import { Onboarding } from "@/components/Onboarding";

/** The welcome tour again, opened from Settings. */
export default function HowItWorksScreen() {
  const router = useRouter();
  return <Onboarding mode="replay" onClose={() => router.back()} />;
}
