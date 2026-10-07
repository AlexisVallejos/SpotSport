# Implementation and verification

## Skills
- Scroll Craft: https://github.com/nateherkai/scroll-craft (installed in ~/.codex/skills/scroll-craft).
- Scroll Motion: https://github.com/paldom/landing-page-builder-skills/tree/main/skills/scroll-motion (installed in ~/.codex/skills/scroll-motion).
- Available for automatic selection on the next turn; both were read and applied directly during this implementation.

The authored brief, motion score and comparison are in BRIEF.md. Existing palette, logos, fonts, product photographs and section order are preserved. Native CSS is the selected scroll runtime. No GSAP, Lenis or competing animation loops. The unmodified Scroll Craft engine is archived alongside this brief, not shipped in the runtime.

## New behavior
- Hero layers and running photograph respond to native scroll timelines where supported.
- Catalog cards have taller framing, short entry motion and independently loaded 3D viewers.
- All eight products have procedural conceptual 3D representations. They are explicitly approximate, not scans of the photographed products.
- Final shoe supports pointer and keyboard rotation, zoom, reset, selectable colors and separated sole.
- Three.js is imported only when a viewer is activated. Rendering occurs on interaction, resize or re-entry, not a permanent animation loop. Pixel ratio is capped. Geometry, materials, WebGL renderer and observers are disposed on unmount.
- Original product photographs remain available. WebGL failure displays a clear fallback status and photograph.
- Catalog/navigation CTAs now target existing sections.

## Reproduce
1. `npm run build`
2. `npm run preview -- --host 127.0.0.1 --port 4173`
3. `SPOT_VERIFY_URL=http://127.0.0.1:4173 SPOT_VERIFY_OUT=scrollcraft/builds/spot/verification-final npm run verify:design`

The script uses headless Chromium, disables native pointer capture/lock in each relevant automated context, captures desktop/mobile/compact/reduced-motion states, checks overflow and images, rotates each concept, compares pixels after keyboard and pointer input, checks exploded state/color selection, and exercises no-WebGL fallback. Screenshots are for visual review, not a claim of device certification.

## Review history
The first browser pass succeeded at 1440×1000, 390×844, 360×640 and reduced motion, with no JS errors, broken images or horizontal overflow. Visual review found overlapping card labels, an over-cropped athlete on mobile and incorrectly wound/sparsely sampled shoe geometry. These were fixed. Apparel geometry was refined with a draped surface and smoothed normals. A subsequent development-server run was interrupted by Vite reload during ongoing edits; that incomplete run is superseded by the production-package run in verification-final.

Intended feeling curve: recognition → curiosity → confidence → momentum → discovery → focus → agency → belonging. Visual review confirmed the photographic opening and full closing identity; the studio interaction is the main change of pace. Mobile crop was the material mismatch and was corrected. No extra blank scrolling or artificial pin spans were introduced.

## Limits
No real iPhone/Android device test, commerce backend, authentic CAD/GLB scans or photoreal 360° capture. The existing account, bag and search backend are outside this task. The Scroll Craft preflight flagged missing system ffmpeg; no video encoding or image generation was used, so that optional pipeline was not needed. Chromium and Playwright were installed for browser verification. No public deployment was requested or made.

## Final production result
PASS: production build and browser suite at http://127.0.0.1:4173. All four viewport/motion configurations reported zero JavaScript errors, zero broken images and no horizontal overflow. All eight procedural models were opened; keyboard rotation changed rendered pixels. Pointer rotation changed the featured shoe pixels. Exploded state and selected color controls passed assertions. The WebGL-disabled context retained the photograph and reported fallback correctly. Final desktop apparel, compact catalog and exploded-shoe screenshots were visually inspected after the run. See verification-final/results.json and its accompanying PNG files.
