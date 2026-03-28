import { Canvas, useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import type { MutableRefObject } from "react";
import { useMemo, useRef } from "react";
import {
  AdditiveBlending,
  Color,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial
} from "three";

/* ─── Palette ─── */
const accentA = new Color("#6C3AED");
const accentB = new Color("#EC4899");

/* ─── Helpers ─── */
function smoothstep(t: number) {
  const s = MathUtils.clamp(t, 0, 1);
  return s * s * (3 - 2 * s);
}
function stageT(p: number, start: number, end: number) {
  return MathUtils.clamp((p - start) / (end - start), 0, 1);
}
function fadeBand(p: number, inS: number, inE: number, outS: number, outE: number) {
  return smoothstep(stageT(p, inS, inE)) * (1 - smoothstep(stageT(p, outS, outE)));
}

type ProgressProps = { progressRef: MutableRefObject<number> };

const QUESTION = "How did our sales pipeline change this quarter?";

/* ════════════════════════════════════════════════════════════
   Low-poly character — pink head + purple body + arms
   Stage 4: dollar-sign eyes, returns to center
   ════════════════════════════════════════════════════════════ */

function Character({ progressRef }: ProgressProps) {
  const groupRef = useRef<Group>(null);
  const headMatRef = useRef<MeshStandardMaterial>(null);
  const bodyMatRef = useRef<MeshStandardMaterial>(null);
  const armLRef = useRef<MeshStandardMaterial>(null);
  const armRRef = useRef<MeshStandardMaterial>(null);
  const eyeLRef = useRef<{ fillOpacity: number } | null>(null);
  const eyeRRef = useRef<{ fillOpacity: number } | null>(null);

  useFrame(({ clock }) => {
    const p = progressRef.current;
    const t = clock.elapsedTime;

    /* always visible */
    const opacity = 1;
    if (headMatRef.current) headMatRef.current.opacity = opacity;
    if (bodyMatRef.current) bodyMatRef.current.opacity = opacity;
    if (armLRef.current) armLRef.current.opacity = opacity * 0.9;
    if (armRRef.current) armRRef.current.opacity = opacity * 0.9;

    if (groupRef.current) {
      /* stages 1: center, 2-3: left, 4: back to center */
      const toLeft = smoothstep(stageT(p, 0.18, 0.32));
      const toCenter = smoothstep(stageT(p, 0.74, 0.86));
      const tx = MathUtils.lerp(0, -1.4, toLeft) + MathUtils.lerp(0, 1.4, toCenter);
      groupRef.current.position.x += (tx - groupRef.current.position.x) * 0.07;
      groupRef.current.position.y = Math.sin(t * 1.1) * 0.035;

      /* turn toward monitor in stages 2-3, face camera in 4 */
      const ry = MathUtils.lerp(0, 0.35, toLeft) - MathUtils.lerp(0, 0.35, toCenter);
      groupRef.current.rotation.y += (ry - groupRef.current.rotation.y) * 0.06;
    }

    /* dollar-sign eyes in stage 4 */
    const dollarEyes = smoothstep(stageT(p, 0.78, 0.88));
    if (eyeLRef.current) eyeLRef.current.fillOpacity = dollarEyes;
    if (eyeRRef.current) eyeRRef.current.fillOpacity = dollarEyes;
  });

  return (
    <group ref={groupRef}>
      {/* Head — pink icosahedron */}
      <mesh position={[0, 0.72, 0]}>
        <icosahedronGeometry args={[0.3, 1]} />
        <meshStandardMaterial
          ref={headMatRef}
          color="#ec4899"
          flatShading
          transparent
          emissive="#ec4899"
          emissiveIntensity={0.12}
        />
      </mesh>
      {/* Body — purple cone (6 sides = low-poly) */}
      <mesh position={[0, 0.12, 0]}>
        <coneGeometry args={[0.3, 0.75, 6]} />
        <meshStandardMaterial
          ref={bodyMatRef}
          color="#6c3aed"
          flatShading
          transparent
          emissive="#6c3aed"
          emissiveIntensity={0.08}
        />
      </mesh>
      {/* Left arm */}
      <mesh position={[-0.32, 0.28, 0]} rotation={[0, 0, 0.5]}>
        <boxGeometry args={[0.08, 0.35, 0.08]} />
        <meshStandardMaterial ref={armLRef} color="#7c3aed" flatShading transparent />
      </mesh>
      {/* Right arm */}
      <mesh position={[0.32, 0.28, 0]} rotation={[0, 0, -0.5]}>
        <boxGeometry args={[0.08, 0.35, 0.08]} />
        <meshStandardMaterial ref={armRRef} color="#7c3aed" flatShading transparent />
      </mesh>
      {/* Dollar eyes (stage 4 only) */}
      <Text
        ref={eyeLRef as never}
        position={[-0.1, 0.78, 0.27]}
        fontSize={0.13}
        color="#4ade80"
        anchorX="center"
        anchorY="middle"
        fillOpacity={0}
      >
        $
      </Text>
      <Text
        ref={eyeRRef as never}
        position={[0.1, 0.78, 0.27]}
        fontSize={0.13}
        color="#4ade80"
        anchorX="center"
        anchorY="middle"
        fillOpacity={0}
      >
        $
      </Text>
    </group>
  );
}

/* ════════════════════════════════════════════════════════════
   Speech bubble — real sales question (stage 1)
   ════════════════════════════════════════════════════════════ */

function SpeechBubble({ progressRef }: ProgressProps) {
  const groupRef = useRef<Group>(null);
  const bubbleRef = useRef<MeshStandardMaterial>(null);
  const ptrRef = useRef<MeshStandardMaterial>(null);
  const txtRef = useRef<{ fillOpacity: number } | null>(null);

  useFrame(() => {
    const p = progressRef.current;
    const opacity = fadeBand(p, 0.0, 0.06, 0.18, 0.28);
    if (bubbleRef.current) bubbleRef.current.opacity = opacity * 0.93;
    if (ptrRef.current) ptrRef.current.opacity = opacity * 0.93;
    if (txtRef.current) txtRef.current.fillOpacity = opacity;

    if (groupRef.current) {
      const tx = p < 0.18 ? 0 : MathUtils.lerp(0, -1.4, smoothstep(stageT(p, 0.18, 0.32)));
      groupRef.current.position.x = 0.7 + tx;
    }
  });

  return (
    <group ref={groupRef} position={[0.7, 1.35, 0.1]}>
      <mesh>
        <planeGeometry args={[2.8, 0.55]} />
        <meshStandardMaterial ref={bubbleRef} color="#f5f3ff" transparent side={2} />
      </mesh>
      <mesh position={[-0.6, -0.38, 0]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.12, 0.22, 3]} />
        <meshStandardMaterial ref={ptrRef} color="#f5f3ff" transparent flatShading />
      </mesh>
      <Text
        ref={txtRef as never}
        position={[0, 0, 0.01]}
        fontSize={0.12}
        color="#1a1025"
        anchorX="center"
        anchorY="middle"
        maxWidth={2.6}
        fillOpacity={0}
      >
        {QUESTION}
      </Text>
    </group>
  );
}

/* ════════════════════════════════════════════════════════════
   Monitor — typing → loading → report with graphs & actions
   ════════════════════════════════════════════════════════════ */

function Monitor({ progressRef }: ProgressProps) {
  const groupRef = useRef<Group>(null);
  const frameRef = useRef<MeshStandardMaterial>(null);
  const screenRef = useRef<MeshStandardMaterial>(null);
  const standRef = useRef<MeshStandardMaterial>(null);
  const baseRef = useRef<MeshStandardMaterial>(null);

  /* logo */
  const logoRef = useRef<{ fillOpacity: number } | null>(null);

  /* typing phase */
  const typingRef = useRef<{ fillOpacity: number; text: string } | null>(null);
  const cursorRef = useRef<Mesh>(null);
  const lastCharsRef = useRef(0);

  /* loading dots */
  const dotRefs = useRef<(Mesh | null)[]>([]);

  /* report content */
  const reportHeaderRef = useRef<MeshStandardMaterial>(null);
  const barRefs = useRef<(MeshStandardMaterial | null)[]>([]);
  const lineRefs = useRef<(MeshStandardMaterial | null)[]>([]);
  const actionRefs = useRef<(MeshStandardMaterial | null)[]>([]);
  const actionLabelRefs = useRef<({ fillOpacity: number } | null)[]>([]);
  const barMeshRefs = useRef<(Mesh | null)[]>([]);

  const barLayout = useMemo(
    () => [
      { x: -0.42, h: 0.18, c: "#6c3aed" },
      { x: -0.22, h: 0.32, c: "#ec4899" },
      { x: -0.02, h: 0.22, c: "#6c3aed" },
      { x: 0.18, h: 0.4, c: "#ec4899" },
      { x: 0.38, h: 0.28, c: "#6c3aed" }
    ],
    []
  );

  useFrame(({ clock }) => {
    const p = progressRef.current;
    const t = clock.elapsedTime;

    /* overall monitor visibility (stages 2-3, fades in 4) */
    const fadeIn = smoothstep(stageT(p, 0.2, 0.34));
    const fadeOut = smoothstep(stageT(p, 0.74, 0.86));
    const vis = fadeIn * (1 - fadeOut);

    if (frameRef.current) frameRef.current.opacity = vis;
    if (screenRef.current) {
      screenRef.current.opacity = vis * 0.95;
      /* glow brighter while "thinking" */
      const thinking = p > 0.44 && p < 0.56;
      const glow = thinking
        ? MathUtils.lerp(0.12, 0.5, 0.5 + Math.sin(t * 3) * 0.5)
        : p > 0.56 ? 0.25 : 0.12;
      screenRef.current.emissiveIntensity = glow;
    }
    if (standRef.current) standRef.current.opacity = vis;
    if (baseRef.current) baseRef.current.opacity = vis;

    /* slide in from right */
    if (groupRef.current) {
      const tx = MathUtils.lerp(2.8, 0.7, smoothstep(fadeIn));
      groupRef.current.position.x += (tx - groupRef.current.position.x) * 0.08;
    }

    /* ── LOGO: visible until typing starts ── */
    const logoFade = 1 - smoothstep(stageT(p, 0.22, 0.28));
    if (logoRef.current) logoRef.current.fillOpacity = logoFade * vis * 0.9;

    /* ── TYPING: scroll-driven character reveal ── */
    const typingT = smoothstep(stageT(p, 0.24, 0.44));
    const typingVis = fadeBand(p, 0.22, 0.26, 0.44, 0.5);
    const chars = Math.floor(typingT * QUESTION.length);
    if (typingRef.current) {
      if (chars !== lastCharsRef.current) {
        lastCharsRef.current = chars;
        typingRef.current.text = chars > 0 ? QUESTION.substring(0, chars) : "";
      }
      typingRef.current.fillOpacity = typingVis * vis;
    }

    /* blinking cursor during typing */
    if (cursorRef.current) {
      const blink = Math.sin(t * 5) > 0 ? 0.9 : 0;
      const mat = cursorRef.current.material;
      if ("opacity" in mat && typeof mat.opacity === "number") {
        mat.opacity = typingVis * vis * blink;
      }
    }

    /* ── LOADING DOTS: pulse after typing, before report ── */
    const loadingVis = fadeBand(p, 0.44, 0.47, 0.54, 0.57);
    dotRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const pulse = Math.sin(t * 5 + i * 1.5) * 0.5 + 0.5;
      const s = loadingVis * vis > 0.05 ? 0.035 + pulse * 0.025 : 0;
      mesh.scale.setScalar(s);
    });

    /* ── REPORT CONTENT: bars + lines + actions ── */
    const reportIn = smoothstep(stageT(p, 0.55, 0.66));
    const reportOpacity = reportIn * vis;

    if (reportHeaderRef.current) reportHeaderRef.current.opacity = reportOpacity;

    /* bars grow upward */
    barMeshRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const stagger = smoothstep(stageT(p, 0.56 + i * 0.015, 0.64 + i * 0.015));
      mesh.scale.y = stagger;
      mesh.position.y = -0.25 + (barLayout[i].h * stagger) / 2;
    });
    barRefs.current.forEach((m) => { if (m) m.opacity = reportOpacity; });
    lineRefs.current.forEach((m, i) => {
      if (m) {
        const stagger = smoothstep(stageT(p, 0.58 + i * 0.02, 0.66 + i * 0.02));
        m.opacity = reportOpacity * 0.45 * stagger;
      }
    });
    actionRefs.current.forEach((m, i) => {
      if (m) {
        const stagger = smoothstep(stageT(p, 0.62 + i * 0.02, 0.7 + i * 0.02));
        m.opacity = reportOpacity * stagger;
      }
    });
    actionLabelRefs.current.forEach((r, i) => {
      if (r) {
        const stagger = smoothstep(stageT(p, 0.62 + i * 0.02, 0.7 + i * 0.02));
        r.fillOpacity = reportOpacity * stagger;
      }
    });
  });

  return (
    <group ref={groupRef} position={[2.8, 0.35, 0]}>
      {/* Frame */}
      <mesh>
        <boxGeometry args={[1.8, 1.3, 0.08]} />
        <meshStandardMaterial ref={frameRef} color="#1a1025" transparent />
      </mesh>
      {/* Screen */}
      <mesh position={[0, 0, 0.045]}>
        <planeGeometry args={[1.6, 1.1]} />
        <meshStandardMaterial
          ref={screenRef}
          color="#0f0b1a"
          emissive="#6c3aed"
          emissiveIntensity={0.12}
          transparent
        />
      </mesh>
      {/* Stand */}
      <mesh position={[0, -0.82, 0]}>
        <boxGeometry args={[0.1, 0.3, 0.06]} />
        <meshStandardMaterial ref={standRef} color="#2d1f4e" transparent />
      </mesh>
      {/* Base */}
      <mesh position={[0, -0.99, 0]}>
        <boxGeometry args={[0.55, 0.05, 0.25]} />
        <meshStandardMaterial ref={baseRef} color="#2d1f4e" transparent />
      </mesh>

      {/* ── Logo (fades when typing starts) ── */}
      <Text
        ref={logoRef as never}
        position={[0, 0.12, 0.06]}
        fontSize={0.2}
        color="#f5f3ff"
        anchorX="center"
        anchorY="middle"
        fillOpacity={0}
      >
        Claritect
      </Text>

      {/* ── Typing text ── */}
      <Text
        ref={typingRef as never}
        position={[-0.65, 0.05, 0.06]}
        fontSize={0.085}
        color="#d9d0ec"
        anchorX="left"
        anchorY="top"
        maxWidth={1.3}
        fillOpacity={0}
      >
        {""}
      </Text>
      {/* Blinking cursor */}
      <mesh ref={cursorRef} position={[0.55, 0, 0.06]}>
        <planeGeometry args={[0.02, 0.1]} />
        <meshBasicMaterial color="#f5f3ff" transparent opacity={0} />
      </mesh>

      {/* ── Loading dots ── */}
      {[0, 1, 2].map((i) => (
        <mesh
          key={`dot-${i}`}
          ref={(el) => { dotRefs.current[i] = el; }}
          position={[-0.12 + i * 0.12, 0, 0.06]}
        >
          <sphereGeometry args={[1, 12, 12]} />
          <meshStandardMaterial
            color="#ec4899"
            emissive="#ec4899"
            emissiveIntensity={0.4}
          />
        </mesh>
      ))}

      {/* ── Report: header ── */}
      <mesh position={[0, 0.38, 0.055]}>
        <planeGeometry args={[1.4, 0.08]} />
        <meshStandardMaterial ref={reportHeaderRef} color="#6c3aed" transparent opacity={0} />
      </mesh>

      {/* ── Report: text lines ── */}
      {[
        { y: 0.28, w: 1.0 },
        { y: 0.21, w: 0.7 },
        { y: 0.14, w: 0.85 }
      ].map((line, i) => (
        <mesh key={`line-${i}`} position={[-0.2 + line.w / 2 - 0.5, line.y, 0.055]}>
          <planeGeometry args={[line.w, 0.03]} />
          <meshStandardMaterial
            ref={(el) => { lineRefs.current[i] = el; }}
            color="#9d90bc"
            transparent
            opacity={0}
          />
        </mesh>
      ))}

      {/* ── Report: bar chart ── */}
      {barLayout.map((bar, i) => (
        <mesh
          key={`bar-${i}`}
          ref={(el) => { barMeshRefs.current[i] = el; }}
          position={[bar.x, -0.25, 0.055]}
        >
          <planeGeometry args={[0.14, bar.h]} />
          <meshStandardMaterial
            ref={(el) => { barRefs.current[i] = el; }}
            color={bar.c}
            transparent
            opacity={0}
          />
        </mesh>
      ))}

      {/* ── Report: action items ── */}
      {[
        { y: 0.05, w: 0.42, label: "Action: Review pipeline" },
        { y: -0.04, w: 0.36, label: "Action: Flag top deals" }
      ].map((action, i) => (
        <group key={`action-${i}`} position={[0.32, action.y, 0.055]}>
          <mesh>
            <planeGeometry args={[action.w, 0.055]} />
            <meshStandardMaterial
              ref={(el) => { actionRefs.current[i] = el; }}
              color="#4ade80"
              transparent
              opacity={0}
            />
          </mesh>
          <Text
            ref={(el) => { actionLabelRefs.current[i] = el as never; }}
            position={[0, 0, 0.002]}
            fontSize={0.032}
            color="#0f2918"
            anchorX="center"
            anchorY="middle"
            fillOpacity={0}
          >
            {action.label}
          </Text>
        </group>
      ))}
    </group>
  );
}

/* ════════════════════════════════════════════════════════════
   Scene composition
   ════════════════════════════════════════════════════════════ */

function NarrativeCluster({
  progressRef
}: {
  progressRef: MutableRefObject<number>;
  reducedMotion?: boolean;
}) {
  return (
    <group position={[0, -0.18, 0]}>
      <Character progressRef={progressRef} />
      <SpeechBubble progressRef={progressRef} />
      <Monitor progressRef={progressRef} />

      <ambientLight intensity={0.6} color="#F5F3FF" />
      <pointLight position={[2, 2.5, 3]} intensity={0.7} color="#ec4899" />
      <pointLight position={[-2, 1.5, 2]} intensity={0.45} color="#6c3aed" />
    </group>
  );
}

export function NarrativeScene(props: {
  progressRef: MutableRefObject<number>;
  reducedMotion?: boolean;
}) {
  return (
    <Canvas
      camera={{ position: [0, 0.4, 4.8], fov: 42 }}
      dpr={[1, 1.8]}
      gl={{ antialias: true, alpha: true }}
    >
      <color attach="background" args={["#0F0B1A"]} />
      <directionalLight position={[3, 5, 4]} intensity={0.7} color="#F5F3FF" />
      <NarrativeCluster progressRef={props.progressRef} reducedMotion={props.reducedMotion} />
    </Canvas>
  );
}

/* ─── Pricing hero ─── */

function PricingOrb() {
  const orbRef = useRef<Mesh>(null);
  const auraRef = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (orbRef.current) {
      orbRef.current.position.y = Math.sin(t * 0.3) * 0.04;
      orbRef.current.rotation.y += 0.002;
    }
    if (auraRef.current && orbRef.current) {
      auraRef.current.position.copy(orbRef.current.position);
      const mat = auraRef.current.material;
      if ("opacity" in mat && typeof mat.opacity === "number") {
        mat.opacity = 0.06 + Math.sin(t * 0.5) * 0.015;
      }
    }
  });

  return (
    <group>
      <mesh ref={auraRef}>
        <sphereGeometry args={[1.4, 32, 32]} />
        <meshBasicMaterial color={accentA} transparent opacity={0.06} blending={AdditiveBlending} />
      </mesh>
      <mesh ref={orbRef}>
        <sphereGeometry args={[0.5, 48, 48]} />
        <meshStandardMaterial color={accentA} emissive={accentB} emissiveIntensity={0.25} roughness={0.35} metalness={0.08} />
      </mesh>
      <pointLight position={[0, 0.1, 1]} color={accentB} intensity={1.5} distance={6} />
    </group>
  );
}

export function PricingHeroScene() {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 34 }} dpr={[1, 1.6]} gl={{ antialias: true, alpha: true }}>
      <color attach="background" args={["#0F0B1A"]} />
      <ambientLight intensity={0.5} color="#F5F3FF" />
      <directionalLight position={[3, 5, 4]} intensity={0.6} color="#F5F3FF" />
      <PricingOrb />
    </Canvas>
  );
}

export function isWebGlSupported(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
  } catch { return false; }
}
