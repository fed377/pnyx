import { Tabs } from "expo-router";
import { Icon } from "@/components/Icon";
import type { IconName } from "@/components/Icon";
import { useStore } from "@/state/store";
import { c, NAV_H } from "@/theme/tokens";

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: "index", title: "Home", icon: "home" },
  { name: "feed", title: "Feed", icon: "feed" },
  { name: "people", title: "People", icon: "people" },
  { name: "profile", title: "Profile", icon: "profile" },
];

export default function TabsLayout() {
  const { accent } = useStore();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: c.app },
        tabBarActiveTintColor: accent,
        tabBarInactiveTintColor: c.textFaint,
        tabBarStyle: {
          backgroundColor: c.app,
          borderTopColor: c.line,
          borderTopWidth: 1,
          height: NAV_H,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, letterSpacing: 0.2 },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color, focused }) => (
              <Icon name={t.icon} size={23} color={color} filled={focused} strokeWidth={focused ? 1.2 : 1.6} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
