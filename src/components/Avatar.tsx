import { StyleSheet, Text, View } from "react-native";
import { nearestPoint } from "@/lib/grids";
import type { Positions } from "@/lib/types";
import { c } from "@/theme/tokens";
import { Crest } from "./Crest";

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Profile picture with the personality icon overlaid (spec §6.2).
 * No photo uploads in this prototype, so the picture is a monogram ringed in
 * the person's Mind colour.
 */
export function Avatar({
  name,
  positions,
  size = 44,
  badge = true,
  locked = false,
}: {
  name: string;
  positions: Positions;
  size?: number;
  badge?: boolean;
  locked?: boolean;
}) {
  const ring = nearestPoint("mind", positions.mind).hex!;
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.face,
          { width: size, height: size, borderRadius: size / 2, borderColor: ring },
        ]}
      >
        <Text style={[styles.initials, { fontSize: Math.round(size * 0.34) }]}>{initials(name)}</Text>
      </View>
      {badge && (
        <View style={styles.badge}>
          <Crest positions={positions} size={Math.round(size * 0.46)} dot={false} locked={locked} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  face: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surface2,
    borderWidth: 1.5,
  },
  initials: { color: c.textDim, fontWeight: "600" },
  badge: { position: "absolute", right: -3, bottom: -3 },
});
