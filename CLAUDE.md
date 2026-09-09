# PNYX — native app

Expo SDK 57 + expo-router. **Expo has changed**: read the exact versioned docs at
https://docs.expo.dev/versions/v57.0.0/ before writing code against any SDK API.
In SDK 56+ you may not import from `@react-navigation/*` in application code — use
what `expo-router` re-exports.

`src/lib/` is the platform-free core (grid tables, movement equation, decay, alignment,
recommendation ranking). Keep it free of `react-native`, `expo-*` and component imports so it
stays liftable into a server or another client.
