# SPOT · Objetos en movimiento
Self-authored implementation decisions under the user's requested redesign; no interview quotations invented.

## Evidence and decisions
1. Vibe: professional sports editorial, precise, tactile. User requests professional designer quality.
2. Journey: preserve existing sports → footwear → running → apparel → training → curated kit → brand close.
3. Energy: strong photographic opening, calm catalog, immersive product encounter near the end.
4. Feeling curve: recognition (athlete and identity), curiosity (sport choices), confidence (clear catalog), momentum (running photograph), discovery (apparel), focus (training), agency (rotatable shoe), belonging (brand closing).
5. Peak/signature: “It's the site where I can take the final shoe into my hands and inspect its construction.” Rotate and explode the sole of the conceptual shoe.
6. Direction: editorial sports, preserve orange #ff7900, near-black #080808, off-white #f4f4f2, Inter and Barlow Condensed.
7. Distinct scenes in natural document flow; no mandatory pinning or scroll tunnel.
8. Existing local photography, logos and PNG products. No actual CAD/GLB models available. Procedural 3D concepts must be labeled approximations; photography remains the default catalog view.

## Grammar and motion score
Gallery/editorial hybrid for an existing product collection. Filmic one-shot and continuous world obscure browsing; chapter pinning adds friction; typographic poster loses product detail; pure split-stage, live-surface and rhythmic cutlist do not fit the existing full collection structure.

| Beat | Device | Purpose |
|---|---|---|
| Opening | independently moving photo, orbital line and identity | Depth without moving the CTA |
| Sports | static photographic choices | Immediate navigation |
| Footwear | short CSS view reveal and on-demand 3D | Inspect products |
| Running | restrained image parallax | Momentum |
| Apparel | product interaction | Compare silhouettes |
| Training | static editorial pause | Quiet before peak |
| Kit | interactive 3D rotation and exploded sole | User agency; visual peak |
| Close | oversized stable identity | Resolve |

Hero layer contract: background athlete photograph moves slightly; orbit rotates independently; foreground identity recedes on exit; semantic headline and CTA remain stable. No extracted athlete so no duplicated subject. Mobile reduces movement and uses existing portrait crop.

## Comparison
Scroll Craft (nateherkai/scroll-craft) supplies art direction, depth, narrative and visual QA. Scroll Motion (paldom/landing-page-builder-skills) supplies purpose-based native CSS animation, support fallbacks and reduced-motion rules. Choose Scroll Craft for design and Scroll Motion for runtime scroll motion. Shared engine is preserved here for provenance; native CSS avoids a second competing scroll runtime in the React site. Three.js only loads on demand for actual 3D geometry.

First fingerprint: registry empty, no prior rows to compare.
No invented specs, prices or commercial availability. No new generated image assets. WebGL unavailable: retain original photography and report unavailability. Real-phone testing remains outside desktop emulation.
