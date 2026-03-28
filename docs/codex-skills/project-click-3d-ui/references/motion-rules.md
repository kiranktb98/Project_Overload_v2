# Motion Rules

## Motion Intensity

- Default to bold motion, but keep it elegant.
- Use decisive scene transitions and depth shifts.
- Avoid jittery micro-animations or constant idle movement everywhere.

## Scroll Choreography

- Tie each major beat to scroll progress with GSAP `ScrollTrigger`.
- Use pinning for hero moments and stage transitions.
- Move objects in z-space, scale, rotate slightly, and crossfade supporting text.
- Reveal one story beat at a time.

## 3D Composition

- Use `Canvas` scenes for floating image planes, camera drifts, particles, and atmospheric light.
- Favor shallow camera rotations and controlled parallax over extreme spins.
- Use `Float` or custom frame loops for subtle idle motion between scroll beats.
- Let depth clarify narrative importance: hero image forward, rejected frames farther back.

## Mobile Compression

- Keep the same section order and story.
- Reduce camera travel and parallax range.
- Collapse multi-object scenes into fewer larger elements.
- Preserve one strong focal object per screen.

## Performance

- Prefer optimized image textures and simple materials.
- Reuse a small number of geometries and textures.
- Avoid overly dense particles.
- Make the page still readable and valuable if WebGL struggles.
