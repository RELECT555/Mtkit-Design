import { cloudAtlasFragment, glyphEmberFragment, specterOrbFragment } from "./atmosphericFragments";
import { auroraFragment } from "./aurora";
import { chromaticRingsFragment } from "./chromaticRings";
import { fragmentHeader } from "./fragmentHeader";
import { phosphorShellFragment } from "./phosphorShell";
import type { ShaderRendererOptions } from "./webgl";
import { portalFragment, starBurstFragment, grainWaveFragment, particleImageFragment, glassCursorFragment } from "./effectFragments";

const orbit = `
vec2 rotatePlane(vec2 p, float angle) {
  return mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * p;
}

vec3 comet(vec2 p, float angle, float orbitRadius, float bodyRadius, vec3 tint, float time, float pixel) {
  const float flatten = 0.53;
  const float tau = 6.2831853;
  vec2 ellipse = p / vec2(1.0, flatten);
  float theta = atan(ellipse.y, ellipse.x + 0.00001);
  float behind = mod(angle - theta, tau);
  float wake = exp(-behind * 1.05) * (1.0 - smoothstep(2.35, 3.55, behind));
  wake *= smoothstep(0.0, 0.045, behind);
  float band = length(ellipse) - orbitRadius;
  float turbulence = noise(vec2(theta * 5.0, time * 0.11)) - 0.5;
  float drift = (0.04 + turbulence * 0.025) * (1.0 - exp(-behind * 0.6));
  float tailWidth = 0.012 + 0.024 * (1.0 - exp(-behind));
  float mist = exp(-abs(band + drift) / tailWidth) * wake;
  float thread = exp(-abs(band) / max(0.0024, 1.2 * pixel)) * wake;
  float curl = exp(-abs(band + drift + 0.008 * sin(theta * 19.0 - time)) * 120.0) * wake;
  float debris = stars(p, 128.0, 0.66) * mist * 3.3;
  vec3 light = tint * (mist * 0.67 + curl * 0.35 + debris);
  light += mix(tint, vec3(1.0), 0.46) * thread * 0.94;

  vec2 center = orbitRadius * vec2(cos(angle), flatten * sin(angle));
  vec2 surface = (p - center) / bodyRadius;
  float distanceToCenter = length(surface);
  float edge = pixel / bodyRadius;
  float body = 1.0 - smoothstep(1.0 - edge, 1.0 + edge, distanceToCenter);
  float depth = sqrt(max(0.0, 1.0 - dot(surface, surface)));
  float hot = smoothstep(-0.50, 1.0, dot(vec3(surface, depth), vec3(-0.45, 0.30, 0.84)));
  float texture = noise(surface * 4.8 + vec2(time * 0.23, 1.1) + depth * 2.3);
  float corona = exp(-abs(distanceToCenter - 0.9) * 2.8);
  light += tint * (corona * 0.42 + exp(-distanceToCenter * 1.3) * 0.26);
  vec3 surfaceColor = mix(tint * 0.44, mix(tint, vec3(1.0), 0.72), hot * (0.63 + texture * 0.37));
  return mix(light, surfaceColor * 2.05 + light * 0.25, body);
}

void main() {
  vec2 p = plane();
  float t = u_time;
  float fit = min(1.0, 0.69 * u_resolution.x / u_resolution.y);
  float tilt = 0.34 + sin(t * 0.13) * 0.12;
  vec2 q = rotatePlane(p, tilt) / fit;
  float pixel = 1.0 / (fit * u_resolution.y);
  vec2 field = rotatePlane(p, -0.26) * vec2(2.6, 6.8);
  float cloud = noise(field + vec2(3.2, 4.6)) * 0.7 + noise(field * 2.8 + 2.3) * 0.3;
  float haze = smoothstep(0.27, 0.82, cloud) * exp(-dot(field, field) * 0.29);
  vec3 color = vec3(0.009, 0.012, 0.029) + mix(u_secondary, u_primary, smoothstep(-0.6, 0.6, p.x)) * haze * 0.17;
  color += vec3(0.71, 0.81, 1.0) * stars(p, 154.0, 0.91) * 0.54;
  color += mix(u_secondary, vec3(0.9, 0.94, 1.0), 0.63) * stars(p + 2.7, 29.0, 0.955) * 0.96;
  float angle = t * 0.47 + 0.34;
  color += comet(q, angle, 0.64, 0.025, u_primary, t, pixel) * u_intensity;
  color += comet(q, angle + 3.14159265, 0.53, 0.018, u_secondary, t, pixel) * u_intensity;
  gl_FragColor = vec4(finish(color), 1.0);
}
`;

const grid = `
float ridgeline(float x) {
  return 0.023 + noise(vec2(x * 3.2, 4.0)) * 0.061 + noise(vec2(x * 13.0, 5.2)) * 0.034;
}

void main() {
  vec2 p = plane();
  float t = u_time * 0.36;
  float horizon = p.y + 0.065;
  float pixel = 1.0 / u_resolution.y;
  vec3 deep = vec3(0.019, 0.014, 0.046);
  float air = exp(-abs(horizon) * 7.5 - abs(p.x) * 1.45);
  vec3 sky = deep + mix(u_secondary, u_primary, 0.35) * air * 0.31;
  sky += stars(p + 2.0, 104.0, 0.962) * (1.0 - air) * 0.43;

  float sunX = -0.25 * min(1.0, u_resolution.x / (u_resolution.y * 1.75));
  vec2 sun = p - vec2(sunX, 0.105);
  float limb = length(sun * vec2(1.0, 1.055)) - 0.237;
  float disc = 1.0 - smoothstep(-pixel, pixel, limb);
  float altitude = smoothstep(-0.15, 0.21, sun.y);
  float surfaceNoise = noise(sun * 36.0) * 0.66 + noise(sun * 88.0 + 4.2) * 0.34;
  vec3 sunlight = mix(mix(u_secondary, u_primary, 0.72) * 0.70, mix(u_primary, vec3(1.0, 0.91, 0.69), 0.45) * 2.2, altitude);
  float limbShade = 0.74 + 0.26 * smoothstep(0.0, 0.12, -limb);
  sky += u_primary * exp(-max(limb, 0.0) * 13.0) * 0.27 * u_intensity;
  sky += u_primary * exp(-abs(limb) * 115.0) * (0.10 + altitude * 0.17) * u_intensity;
  sky = mix(sky, sunlight * limbShade * (0.86 + surfaceNoise * 0.28) * u_intensity, disc);

  // Uneven wisps absorb the disc light and pick up a warm edge nearby.
  vec2 breeze = vec2(p.x - t * 0.025, p.y);
  float cloud = noise(breeze * vec2(8.0, 67.0) + vec2(4.0, 6.0)) * 0.76;
  cloud += noise(breeze * vec2(17.0, 122.0) + vec2(2.5, 1.7)) * 0.24;
  float shelf = exp(-abs(p.y - 0.034 - 0.021 * sin(p.x * 7.0)) * 14.0);
  float vapor = smoothstep(0.38, 0.72, cloud) * shelf;
  float backlight = exp(-max(limb, 0.0) * 8.5);
  vec3 cloudLight = deep + mix(u_secondary, u_primary, 0.48) * backlight * (0.16 + 0.10 * cloud);
  sky = mix(sky, cloudLight, vapor * (0.37 + 0.50 * disc));

  float farRidge = ridgeline(p.x);
  float nearRidge = ridgeline(p.x + 2.3) * 0.57;
  sky = mix(deep + u_secondary * 0.12, sky, smoothstep(-pixel, pixel, horizon - farRidge));
  sky = mix(deep + u_secondary * 0.043, sky, smoothstep(-pixel, pixel, horizon - nearRidge));
  sky += u_secondary * exp(-abs(horizon - farRidge) * 142.0) * 0.18;

  float depth = max(0.028, -horizon);
  vec2 surface = vec2((p.x - 0.075) / depth, 0.72 / depth + t);
  vec2 period = abs(fract(surface + 0.5) - 0.5);
  float crossX = pixel * (1.0 / depth + abs(p.x - 0.075) / (depth * depth));
  float crossY = pixel * 0.72 / (depth * depth);
  float column = (1.0 - smoothstep(0.008, 0.022 + crossX, period.x)) * (1.0 - smoothstep(0.15, 0.45, crossX));
  float row = (1.0 - smoothstep(0.006, 0.022 + crossY, period.y)) * (1.0 - smoothstep(0.15, 0.47, crossY));
  float pulse = pow(0.5 + 0.5 * sin(surface.y * 0.93 - t * 3.8), 4.0);
  float glow = exp(-period.x * 31.0) * 0.18 + exp(-period.y * 27.0) * 0.12;
  float falloff = smoothstep(0.04, 0.16, depth) * exp(-abs(p.x) * 0.67);
  float reflectedLight = smoothstep(0.028, 0.12, depth);
  vec3 ground = deep + u_secondary * mix(0.043, air * 0.24, reflectedLight);
  ground += u_primary * exp(-abs(p.x - sunX) * 5.0 - depth * 7.0) * 0.22 * reflectedLight;
  ground += mix(u_secondary, u_primary, pulse * 0.74) * (max(row, column) * (0.47 + pulse * 0.44) + glow) * falloff * u_intensity;
  vec3 color = mix(ground, sky, smoothstep(-pixel, pixel, horizon));
  gl_FragColor = vec4(finish(color), 1.0);
}
`;

const bloom = `
vec3 fold(vec2 p, float t, float shift, vec3 base, vec3 highlight) {
  float bend = sin(p.x * 3.2 + t + shift) * 0.18 + cos(p.x * 6.0 - t * 0.78 + shift) * 0.06;
  float y = p.y - bend - shift * 0.14;
  float scale = 7.8 + sin(p.x * 4.3 + t * 0.55 + shift) * 2.6;
  float f = y * scale;
  float body = exp(-f * f * 0.52);
  float rim = exp(-pow(abs(f + 0.66) * 3.9, 1.32));
  float seam = exp(-abs(f - 0.79) * 9.2) * 0.16;
  float brushed = 0.88 + 0.12 * cos(f * 82.0 + p.x * 29.0 + shift * 4.0);
  float gleam = 0.48 + 0.52 * smoothstep(-0.38, 0.44, sin(p.x * 3.1 - t * 0.7 + shift));
  return base * body * (0.34 + gleam * 0.26) + highlight * (rim * gleam * 0.58 + seam) * brushed;
}

void main() {
  vec2 p = plane();
  float t = u_time * 0.35;
  vec2 q = vec2(p.x + sin(p.y * 4.0 + t * 0.3) * 0.08, p.y - p.x * 0.22);
  float warp = noise(q * 4.5 + vec2(t * 0.1, 3.0));
  q.y += (warp - 0.5) * 0.10;
  vec3 color = vec3(0.019, 0.014, 0.047);
  color += u_secondary * exp(-dot(p + vec2(0.55, 0.26), p + vec2(0.55, 0.26)) * 3.0) * 0.29;
  color += u_primary * exp(-dot(p - vec2(0.56, 0.26), p - vec2(0.56, 0.26)) * 3.5) * 0.21;
  color += fold(q, t, -1.1, u_secondary * 0.77, mix(u_secondary, u_primary, 0.25)) * u_intensity;
  color += fold(vec2(q.x, q.y * 1.2), t * 0.89, 1.2, u_primary, mix(u_primary, vec3(1.0, 0.88, 0.86), 0.54)) * u_intensity;
  color *= 0.58 + 0.42 * exp(-dot(p, p) * 1.05);
  gl_FragColor = vec4(finish(color), 1.0);
}
`;

export type Palette = { name: string; colors: readonly [string, string] };
export type ShaderPreset = {
  id: string;
  componentName: string;
  name: string;
  description: string;
  direction: string;
  group: "Космос" | "Абстракция" | "Атмосфера" | "Изображения";
  fragment: string;
  palettes: readonly Palette[];
  renderer?: ShaderRendererOptions;
  interaction?: string;
};

export const shaderPresets: readonly [ShaderPreset, ...ShaderPreset[]] = [
  {
    id: "phosphor-shell",
    componentName: "PhosphorShell",
    name: "Phosphor Shell",
    description: "Светящаяся оболочка разворачивается и складывается обратно. Огненные и ледяные слои выворачиваются, открывая глубину внутри.",
    direction: "Render a phosphorescent spherical shell whose layers continuously unfold, roll through one another, overlap, and close again. Preserve the Phosphor 30 motion study: a time-varying rotation axis coupled to the preceding ray-march step, eight recursive sine folds at frequencies 2 through 9, and luminous seams constrained by a spherical distance field. The apparent opening must move and change shape as the layers turn. Do not substitute a torus, a fixed central hole, a scale pulse, or a rotating flat ring. Let warm orange and icy cyan colors travel with the folded material, with white highlights and atmospheric light along the creases. Use elapsed seconds, fit to the shorter viewport dimension, and preserve pause, speed, intensity, palette changes, and reduced-motion support.",
    group: "Абстракция",
    fragment: fragmentHeader + phosphorShellFragment,
    renderer: { renderScale: 0.85 },
    palettes: [
      { name: "Огонь и лёд", colors: ["#ff4a08", "#87deff"] },
      { name: "Орхидея и мята", colors: ["#f14d9f", "#86ffdc"] },
      { name: "Янтарь и индиго", colors: ["#ffa440", "#8978ff"] },
    ],
  },
  {
    id: "chromatic-rings",
    componentName: "ChromaticRings",
    name: "Хроматические кольца",
    description: "Расходящиеся световые кольца с разделением RGB-каналов и диагональными полосами на чёрном фоне.",
    direction: "Render expanding concentric light rings on a black background. Stagger the red, green and blue channel phases slightly to create chromatic fringes. Break the radial distance with repeating diagonal bands for a stepped, interference-like texture. Preserve the aspect ratio using the shorter container dimension. Keep the original RGB colors when both palette tints are white; apply other palette colors as a radial tint. Use elapsed seconds for frame-rate-independent motion and guard the inverse-distance glow against division by zero.",
    group: "Абстракция",
    fragment: fragmentHeader + chromaticRingsFragment,
    palettes: [
      { name: "Оригинал RGB", colors: ["#ffffff", "#ffffff"] },
      { name: "Ледяной спектр", colors: ["#b8f4ff", "#8faaff"] },
      { name: "Тёплый спектр", colors: ["#ffe1ba", "#ff9ed5"] },
    ],
  },
  {
    id: "portal", componentName: "Portal", name: "Portal",
    description: "Светящийся портал с потоками света внутри. Нажатие ускоряет движение, указатель слегка смещает сферу.",
    direction: "Create a circular portal with a thin luminous rim and soft halo on a near-black background. Fill its interior with layered horizontal light streaks that bend along the sphere. Track the pointer with a slight tilt and trigger a short warp-speed pulse on press. Keep the whole circle visible on narrow screens.",
    group: "Космос", fragment: fragmentHeader + portalFragment,
    renderer: { pointer: true, boost: true },
    interaction: "Двигайте указателем и нажмите на портал для ускорения.",
    palettes: [
      { name: "Лиловый свет", colors: ["#c084fc", "#f0abfc"] },
      { name: "Ледяной портал", colors: ["#50beff", "#a9ffe6"] },
      { name: "Солнечный портал", colors: ["#ff9865", "#ffdfb0"] },
    ],
  },
  {
    id: "star-burst", componentName: "StarBurst", name: "Star Burst",
    description: "Звёзды летят из центра кадра, вытягиваясь в тонкие световые следы.",
    direction: "Render layered star particles streaming outward from a small central bloom. Accelerate them with distance, keep thin tapered radial trails and subtle twinkling, and fade stars before each cycle resets. Let the pointer move the focal point slightly. Leave dark negative space between the rays.",
    group: "Космос", fragment: fragmentHeader + starBurstFragment,
    renderer: { pointer: true },
    interaction: "Перемещайте указатель, чтобы сместить центр звёздного потока.",
    palettes: [
      { name: "Розовый космос", colors: ["#e3b3ea", "#8878ff"] },
      { name: "Голубой свет", colors: ["#b8f2ff", "#648aff"] },
      { name: "Золотые искры", colors: ["#ffe0a6", "#fc9755"] },
    ],
  },
  {
    id: "particle-image", componentName: "ParticleImage", name: "Particle Image",
    description: "Изображение из тысяч частиц: они расходятся под указателем и возвращаются на свои места.",
    direction: "Sample an image into a bounded GPU point grid. Preserve its aspect ratio and colors. Add a subtle evolving curl field and scatter nearby particles radially and along pointer motion, then smoothly restore the image as the pointer leaves. Use a self-contained demo image by default and support an imageSrc prop. Never fetch an external image by default.",
    group: "Изображения", fragment: fragmentHeader + particleImageFragment,
    renderer: { image: true, particles: true, pointer: true },
    interaction: "Проведите указателем по изображению. Ниже можно выбрать своё фото или логотип.",
    palettes: [
      { name: "Сиреневый оттенок", colors: ["#f5d9ff", "#b5a5ff"] },
      { name: "Тёплый оттенок", colors: ["#fff0d0", "#ffc8a9"] },
      { name: "Холодный оттенок", colors: ["#d0fffa", "#a0caff"] },
    ],
  },
  {
    id: "glass-cursor", componentName: "GlassCursor", name: "Glass Cursor",
    description: "Жидкий стеклянный след преломляет изображение под указателем и мягко растворяется.",
    direction: "Apply a localized liquid glass lens to an image. Track a bounded chain of pointer positions with smooth follow and a fading tail. Merge the points into a metaball field, derive the lens normal, refract the image with subtle RGB separation and add a thin specular rim. Keep the image clear outside the lens and leave the native cursor visible. Use the supplied image texture, never claim to refract arbitrary DOM content.",
    group: "Изображения", fragment: fragmentHeader + glassCursorFragment,
    renderer: { image: true, pointer: true, trail: true },
    interaction: "Проведите указателем по превью: стеклянный след преломляет картинку. На сенсорном экране коснитесь изображения.",
    palettes: [
      { name: "Прозрачное стекло", colors: ["#e8ddff", "#c3e6ff"] },
      { name: "Тёплый блик", colors: ["#ffe1b8", "#ffa9cc"] },
      { name: "Ледяной блик", colors: ["#bdfff5", "#729fff"] },
    ],
  },
  {
    id: "grain-wave", componentName: "GrainWave", name: "Grain Wave",
    description: "Зернистая цветная лента плавно изгибается на тёмном фоне.",
    direction: "Layer fine sinusoidal ribbons into one broad undulating band on a near-black field. Blend the two palette colors through the ribbon thickness. Render luminous edges and visible screenprint-like stochastic grain, leaving ample dark negative space above and below. Animate phase slowly without strobing or layout changes.",
    group: "Абстракция", fragment: fragmentHeader + grainWaveFragment,
    palettes: [
      { name: "Коралл и индиго", colors: ["#ff6666", "#7666ff"] },
      { name: "Мята и океан", colors: ["#86ffd1", "#5484ff"] },
      { name: "Персик и роза", colors: ["#ffd59d", "#ed62aa"] },
    ],
  },
  {
    id: "binary-orbits",
    componentName: "BinaryOrbits",
    name: "Двойная орбита",
    description: "Два светящихся ядра движутся вокруг общего центра и оставляют шлейфы из пыли.",
    direction: "Create a binary system with two luminous bodies on opposite sides of a shared center. Set their paths in the same slowly tilting plane, with slightly different radii. Shade each nucleus as a small sphere with a bright face and a soft corona. Draw only the tapered wakes with luminous threads, turbulence and dust. Use sparse stars and a faint nebula, and fit the full orbit within the frame on mobile.",
    group: "Космос",
    fragment: fragmentHeader + orbit,
    palettes: [
      { name: "Персик и сирень", colors: ["#ffa279", "#9b85ff"] },
      { name: "Лёд и индиго", colors: ["#73e6f1", "#6776fe"] },
      { name: "Медь и янтарь", colors: ["#ff713d", "#ffcd77"] },
    ],
  },
  {
    id: "aurora",
    componentName: "Aurora",
    name: "Аврора",
    description: "Складки северного сияния движутся над силуэтом гор и звёздным небом.",
    direction: "Render three overlapping aurora curtains over a sparse star field and a low, dark mountain silhouette. Give each curtain a fine luminous lower edge, uneven vertical folds and a veil that fades upward. Use the primary color near the lower edges and drift into the secondary color with height. Animate the shape and brightness slowly, with quieter areas between curtains.",
    group: "Космос",
    fragment: auroraFragment,
    palettes: [
      { name: "Мята и синий", colors: ["#62f1ae", "#5d7cfc"] },
      { name: "Розовый и индиго", colors: ["#fc88ae", "#8979fc"] },
      { name: "Лёд и лазурь", colors: ["#a3eeff", "#3a9add"] },
    ],
  },
  {
    id: "horizon-grid",
    componentName: "HorizonGrid",
    name: "Сетка горизонта",
    description: "Световые импульсы бегут по сетке к горному горизонту на фоне заката.",
    direction: "Compose a cinematic synthwave sunset with a low, slightly flattened sun setting behind two dark mountain layers. Shade the disc with a warm gradient, subtle surface grain, a thin bright rim and a diffuse halo. Let irregular clouds drift in front of its lower half, catching light on the edges. Carry the primary sunlight color into a soft reflection over a secondary-colored perspective grid. Fade fine lines toward the vanishing point and send soft pulses toward the foreground.",
    group: "Абстракция",
    fragment: fragmentHeader + grid,
    palettes: [
      { name: "Коралл и пурпур", colors: ["#ff956d", "#bc65ff"] },
      { name: "Лёд и синий", colors: ["#89eee0", "#7282f9"] },
      { name: "Розовый и малиновый", colors: ["#ffabd9", "#da4974"] },
    ],
  },
  {
    id: "chroma-bloom",
    componentName: "ChromaBloom",
    name: "Цветовой поток",
    description: "Переливы цвета по складкам шёлка. Подходит как фон под текст и карточки.",
    direction: "Build a slowly shifting silk surface with two broad diagonal folds. Shape each fold with a soft color body, a sharp specular rim and a much fainter shadow seam. Use low-frequency warping for motion and fine grain in the highlights. Keep pockets of dark negative space so a hero heading or card remains readable.",
    group: "Абстракция",
    fragment: fragmentHeader + bloom,
    palettes: [
      { name: "Роза и ультрамарин", colors: ["#fb78a6", "#636dff"] },
      { name: "Коралл и золото", colors: ["#ed6853", "#eeb570"] },
      { name: "Мята и бирюза", colors: ["#9aedbd", "#2f9fb1"] },
    ],
  },
  {
    id: "cloud-atlas",
    componentName: "CloudAtlas",
    name: "Cloud Atlas",
    description: "Объёмный дым с мягкими клубами, полупрозрачными краями и тенями внутри. Плавно поднимается на тёмном фоне.",
    direction: "Render a three-dimensional smoke volume with front-to-back ray marching, Beer-Lambert absorption and directional self-shadowing. Build a low bank along the bottom with a taller plume on the right and open dark space above. Use advected, domain-warped 3D fractal noise for rising billows and fine wisps; avoid a flat noise mask or stacked opaque silhouettes. Light the translucent edges with a soft violet key light and retain deep internal shadows. Animate continuously at a calm pace. Do not add any mouse, hover, touch or click response. Use reduced rendering resolution and early ray termination to bound GPU cost, preserve the same volume in the paused frame, and respect reduced motion.",
    group: "Атмосфера",
    fragment: fragmentHeader + cloudAtlasFragment,
    renderer: { renderScale: 0.48 },
    palettes: [
      { name: "Сумерки", colors: ["#6d5bc0", "#3a2e7a"] },
      { name: "Лунная дымка", colors: ["#96bddb", "#2c4267"] },
      { name: "Закат", colors: ["#dd8e72", "#573e67"] },
    ],
  },
  {
    id: "glyph-ember",
    componentName: "GlyphEmber",
    name: "Glyph Ember",
    description: "Огонь из ASCII-символов с раскалённым основанием и искрами.",
    direction: "Draw upward tongues of ASCII fire over a near-black background using a texture atlas of real monospace glyphs. Make the lowest rows dense and nearly white, transition through pink and violet, and break the flame tips into sparse characters. Let separate pinprick embers rise above the fire. Locally suppress the heat under the pointer, and send a short burst of heat on press. Keep cell size in CSS pixels so the symbols stay readable on mobile.",
    group: "Атмосфера",
    fragment: fragmentHeader + glyphEmberFragment,
    renderer: { pointer: true, glyphs: true },
    interaction: "Наведите указатель, чтобы приглушить огонь. Нажмите, чтобы разжечь.",
    palettes: [
      { name: "Лиловый огонь", colors: ["#7b3dff", "#ff7ad9"] },
      { name: "Угли", colors: ["#e74220", "#ffb44d"] },
      { name: "Холодное пламя", colors: ["#3376ff", "#67ffec"] },
    ],
  },
  {
    id: "specter-orb",
    componentName: "SpecterOrb",
    name: "Specter Orb",
    description: "Дым движется внутри тёмной сферы с сине-фиолетовым ободом.",
    direction: "Center a smoky ghost orb on a nearly black field with ample negative space. Give it a slowly deforming silhouette, a sharp electric-blue rim with violet on the opposite side, a soft halo, and shadowed vapor drifting inside. Make the bright spot track the pointer across the rim and light up the smoke on the same side. Let the orb lean slightly toward the pointer and return to its resting position when the pointer leaves. Keep the full halo visible on narrow screens.",
    group: "Атмосфера",
    fragment: fragmentHeader + specterOrbFragment,
    renderer: { pointer: true, renderScale: 0.84 },
    interaction: "Двигайте указателем, чтобы смещать свет на сфере.",
    palettes: [
      { name: "Синий и фиолетовый", colors: ["#4da6ff", "#9959ff"] },
      { name: "Бирюза и индиго", colors: ["#3dffdb", "#524df6"] },
      { name: "Розовый и медный", colors: ["#ff6eaf", "#ff7536"] },
    ],
  },
];
