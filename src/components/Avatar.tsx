import { Image } from "expo-image";
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
  photoUrl,
}: {
  name: string;
  positions: Positions;
  size?: number;
  badge?: boolean;
  locked?: boolean;
  /** A real uploaded photo, when they have one — takes over from the monogram. */
  photoUrl?: string;
}) {
  const ring = nearestPoint("mind", positions.mind).hex!;
  // No name yet (data still loading, or a placeholder slot) — a plain ringed
  // circle with nothing inside, rather than empty/garbled initials.
  const empty = name.trim().length === 0;
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.face,
          empty && styles.faceEmpty,
          { width: size, height: size, borderRadius: size / 2, borderColor: empty ? c.line : ring },
        ]}
      >
        {photoUrl ? (
          <Image
            source={{ uri: photoUrl }}
            style={{ width: size, height: size, borderRadius: size / 2 }}
            contentFit="cover"
            transition={120}
          />
        ) : (
          !empty && (
            <Text style={[styles.initials, { fontSize: Math.round(size * 0.34) }]}>{initials(name)}</Text>
          )
        )}
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
  faceEmpty: { backgroundColor: c.surface3 },
  initials: { color: c.textDim, fontWeight: "600" },
  badge: { position: "absolute", right: -3, bottom: -3 },
});
