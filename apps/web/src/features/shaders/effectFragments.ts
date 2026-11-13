export const portalFragment = `
uniform vec4 u_pointer;
void main() {
  float aspect = u_resolution.x / u_resolution.y;
  float fit = min(1.0, aspect * 0.88);
  vec2 p = plane() / fit;
  p -= (u_pointer.xy - 0.5) * u_pointer.z * 0.035;
  float r = length(p);
  float radius = 0.345;
  float edge = 1.0 / (u_resolution.y * fit);
  float sphere = sqrt(max(0.0, radius * radius - r * r)) / radius;
  vec3 color = vec3(0.008, 0.006, 0.015);
  vec3 light = mix(u_primary, u_secondary, p.y + 0.5);
  float rim = exp(-abs(r - radius) * 230.0);
  float halo = exp(-abs(r - radius) * 36.0);
  color += light * (rim * 2.9 + halo * 0.28) * u_intensity;
  vec3 streaks = vec3(0.0);
  float t = u_time * 0.40;
  for (int i = 0; i < 4; i++) {
    float layer = float(i);
    float y = p.y + sin(p.x * 3.5 + t * 0.4) * 0.035 + sphere * 0.07 + p.x * 0.18;
    float row = y * (12.0 + layer * 5.0);
    float phase = hash(vec2(floor(row), layer + 2.7)) * 12.0;
    vec2 cell = vec2(p.x * (1.3 + layer * 0.5) - t * (1.1 + layer * 0.3) + phase, row);
    vec2 id = floor(cell);
    float seed = hash(id + layer * 13.0);
    vec2 local = fract(cell) - vec2(0.5, 0.5 + (seed - 0.5) * 0.4);
    float width = 0.28 + seed * 0.18 + u_pointer.w * 0.2;
    float taper = 1.0 - smoothstep(-0.45, 0.50, local.x);
    float thickness = 0.015 + (0.06 + seed * 0.16) * taper;
    float line = exp(-pow(local.x / width, 4.0) - pow(local.y / thickness, 2.0));
    float thin = exp(-pow(local.x / width, 4.0) - pow(local.y / (thickness * 0.32), 2.0));
    vec3 tint = mix(u_primary, u_secondary, seed);
    float envelope = 1.0 - smoothstep(0.30, 0.5, abs(local.x));
    streaks += (tint * line + mix(tint, vec3(1.0), 0.72) * thin) * step(0.52, seed) * envelope;
  }
  float inside = 1.0 - smoothstep(radius - edge, radius + edge, r);
  color += streaks * inside * (0.5 + pow(1.0 - sphere, 2.0) * 2.0) * u_intensity;
  gl_FragColor = vec4(finish(color), 1.0);
}
`;

export const starBurstFragment = `
uniform vec4 u_pointer;
void main() {
  vec2 center = (u_pointer.xy - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0) * u_pointer.z * 0.20;
  vec2 p = plane() - center;
  float radius = length(p);
  float angle = atan(p.y, p.x + 0.000001);
  vec3 color = vec3(0.007, 0.005, 0.018);
  for (int i = 0; i < 3; i++) {
    float layer = float(i);
    float count = 112.0 + layer * 41.0;
    float spoke = (angle / 6.2831853 + 0.5) * count;
    float id = floor(spoke);
    float seed = hash(vec2(id, layer + 7.1));
    float clock = fract(u_time * (0.12 + seed * 0.12) + seed * 23.0);
    float travel = 0.025 + clock * clock * 1.35;
    float drift = sin(u_time * 0.3 + seed * 20.0) * 0.16;
    float across = (fract(spoke) - 0.5 + drift) * radius * 6.2831853 / count;
    float along = radius - travel;
    float head = exp(-abs(across) * 1600.0 - abs(along) * 480.0);
    float tail = exp(-abs(across) * 2100.0) * exp(-abs(along) / (0.008 + clock * 0.09)) * step(along, 0.0);
    float fade = smoothstep(0.0, 0.12, clock) * (1.0 - smoothstep(0.8, 1.0, clock));
    vec3 tint = mix(u_primary, u_secondary, seed);
    color += (mix(tint, vec3(1.0), 0.45) * head + tint * tail * 0.65) * fade * u_intensity;
  }
  float petals = 0.55 + 0.45 * pow(abs(sin(angle * 5.0 + u_time * 0.08)), 2.0);
  color += mix(u_primary, u_secondary, 0.4) * exp(-radius * 20.0) * petals * 0.22 * u_intensity;
  gl_FragColor = vec4(finish(color), 1.0);
}
`;

export const grainWaveFragment = `
void main() {
  vec2 p = plane();
  float t = u_time * 0.33;
  vec3 light = vec3(0.0);
  for (int i = 0; i < 24; i++) {
    float layer = float(i) / 23.0;
    float phase = p.x * 3.8 + t + layer * 0.7;
    float y = sin(phase) * 0.17 + sin(p.x * 6.2 - t * 0.7 + layer) * 0.045;
    y += (layer - 0.5) * (0.12 + 0.13 * (0.5 + 0.5 * cos(p.x * 3.0 + t)));
    float d = abs(p.y - y);
    float ribbon = exp(-d * d * 15000.0) * 0.27 + exp(-d * d * 2000.0) * 0.055;
    vec3 tint = mix(u_primary, u_secondary, layer);
    light += tint * ribbon;
  }
  // Stable grain moves with the ribbon's light, without reseeding the whole frame.
  float paper = hash(floor(gl_FragCoord.xy));
  float density = clamp(max(light.r, max(light.g, light.b)) * 0.85, 0.0, 1.0);
  vec3 ink = light * (0.42 + smoothstep(paper - 0.09, paper + 0.09, density) * 1.32);
  ink *= exp(-abs(p.x) * 0.28) * u_intensity;
  gl_FragColor = vec4(finish(vec3(0.006, 0.005, 0.009) + ink), 1.0);
}
`;

export const particleImageFragment = `
uniform sampler2D u_image;
varying vec2 v_imageUv;
varying float v_scatter;
void main() {
  float disc = 1.0 - smoothstep(mix(0.34, 0.16, v_scatter), 0.50, length(gl_PointCoord - 0.5));
  vec4 source = texture2D(u_image, v_imageUv);
  float opacity = disc * source.a * mix(1.0, 0.90, v_scatter);
  vec3 tint = mix(u_secondary, u_primary, v_imageUv.y);
  vec3 color = source.rgb * mix(vec3(1.0), tint, v_scatter * 0.14);
  gl_FragColor = vec4(color, opacity);
}
`;

export const glassCursorFragment = `
uniform sampler2D u_image;
uniform vec2 u_imageSize;
uniform vec4 u_pointer;
uniform vec3 u_trail[12];

vec2 imageUv(vec2 screen) {
  float aspect = u_resolution.x / u_resolution.y;
  float imageAspect = u_imageSize.x / u_imageSize.y;
  return (screen - 0.5) * vec2(min(1.0, aspect / imageAspect), min(1.0, imageAspect / aspect)) + 0.5;
}
vec3 field(vec2 p) {
  // Value and analytic gradient in one pass. Capsules keep fast sweeps connected.
  vec3 result = vec3(0.0);
  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  for (int i = 0; i < 12; i++) {
    vec2 center = (u_trail[i].xy - 0.5) * aspect;
    vec2 previous = center;
    if (i > 0) previous = (u_trail[i - 1].xy - 0.5) * aspect;
    vec2 segment = previous - center;
    float along = clamp(dot(p - center, segment) / max(dot(segment, segment), 0.00001), 0.0, 1.0);
    center += segment * along;
    float size = (0.065 - float(i) * 0.0042) * u_trail[i].z;
    vec2 d = p - center;
    float distance2 = max(dot(d, d), 0.00005);
    float strength = size * size / distance2;
    result += vec3(strength, -2.0 * strength * d / distance2);
  }
  return result;
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 p = plane();
  vec3 sampleField = field(p);
  float f = sampleField.x;
  float edge = clamp(length(sampleField.yz) / u_resolution.y, 0.025, 0.22);
  float mask = smoothstep(1.0 - edge, 1.0 + edge, f);
  vec2 normal = sampleField.yz / max(length(sampleField.yz), 0.001);
  float lens = mask / sqrt(max(f, 1.0));
  vec2 offset = normal * lens * 0.065 * u_intensity / vec2(u_resolution.x / u_resolution.y, 1.0);
  vec3 original = texture2D(u_image, imageUv(uv)).rgb;
  vec3 glass;
  glass.r = texture2D(u_image, imageUv(uv + offset * 1.035)).r;
  glass.g = texture2D(u_image, imageUv(uv + offset)).g;
  glass.b = texture2D(u_image, imageUv(uv + offset * 0.965)).b;
  float rim = exp(-abs(f - 1.0) / max(edge * 1.5, 0.055)) * u_pointer.z;
  float bevel = exp(-abs(f - 1.12) * 5.0) * mask;
  float lighting = dot(normal, normalize(vec2(-0.5, 0.8)));
  float highlight = pow(max(0.0, lighting), 6.0);
  vec3 tint = mix(u_secondary, u_primary, normal.y * 0.5 + 0.5);
  vec3 color = mix(original, glass, mask);
  color *= 1.0 - bevel * max(0.0, -lighting) * 0.13 * u_intensity;
  color += (tint * 0.08 + highlight * 0.45) * rim * u_intensity;
  color += tint * highlight * bevel * 0.06 * u_intensity;
  gl_FragColor = vec4(color, 1.0);
}
`;
