export const cloudAtlasFragment = `
float smokeHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

float smokeNoise(vec3 p) {
  vec3 cell = floor(p);
  vec3 f = fract(p);
  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(
    mix(mix(smokeHash(cell), smokeHash(cell + vec3(1, 0, 0)), f.x),
        mix(smokeHash(cell + vec3(0, 1, 0)), smokeHash(cell + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(smokeHash(cell + vec3(0, 0, 1)), smokeHash(cell + vec3(1, 0, 1)), f.x),
        mix(smokeHash(cell + vec3(0, 1, 1)), smokeHash(cell + vec3(1, 1, 1)), f.x), f.y), f.z);
}

float smokeDensity(vec3 p, float width, float time) {
  // A wide bank and two rising plumes, eroded throughout their depth.
  float x = p.x / width + 0.5;
  float bank = 0.24 + 1.68 * exp(-pow((x - 0.83) / 0.205, 2.0));
  bank += 0.78 * exp(-pow((x - 0.015) / 0.17, 2.0));
  bank += 0.20 * exp(-pow((x - 0.39) / 0.27, 2.0));

  vec3 q = p * 1.9 - vec3(time * 0.055, time * 0.26, -time * 0.11);
  q.xz += vec2(sin(q.y * 0.74 + time * 0.12), cos(q.y * 0.63 - time * 0.10)) * 0.46;
  q.y += sin(q.x * 0.75 + time * 0.18) * sin(q.z * 0.70 - time * 0.13) * 0.32;
  float eddy = smokeNoise(q * 0.58 + vec3(3.7, 0.0, 8.2));
  q += (eddy - 0.5) * vec3(1.5, 0.55, 1.1);
  mat3 turn = mat3(0.0, 0.8, 0.6, -0.8, 0.36, -0.48, -0.6, -0.48, 0.64);
  q = turn * q;
  float turbulent = smokeNoise(q) * 0.56;
  q = turn * q * 2.03 + vec3(17.1, 4.7, 8.3);
  turbulent += smokeNoise(q) * 0.27;
  q = turn * q * 2.02 + vec3(3.2, 13.8, 5.6);
  turbulent += smokeNoise(q) * 0.12;
  turbulent += smokeNoise(turn * q * 2.04 + 7.8) * 0.05;

  float shape = bank - p.y + (turbulent - 0.49) * 3.15;
  float depth = 1.0 - smoothstep(0.8, 1.72, abs(p.z));
  float body = smoothstep(-0.12, 0.76, shape);
  // Density must keep varying inside the bank, otherwise it becomes a solid slab.
  return body * (0.30 + turbulent * turbulent * 1.9) * depth;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float aspect = u_resolution.x / u_resolution.y;
  float width = max(1.12, aspect) * 3.25;
  float time = u_time * 0.36 + 9.0;
  vec3 origin = vec3((uv.x - 0.5) * width, uv.y * 3.25 - 0.24, -1.72);
  vec3 lightDirection = normalize(vec3(-0.55, 0.9, -0.65));
  vec3 shadowColor = u_secondary * 0.19;
  vec3 lightColor = mix(u_primary, vec3(0.82), 0.12) * 1.08;
  vec3 scattered = vec3(0.0);
  float transmission = 1.0;
  const float stride = 3.44 / 38.0;
  // Stable pixel jitter removes marching bands without temporal flicker.
  float jitter = hash(gl_FragCoord.xy + 13.7);

  for (int i = 0; i < 38; i++) {
    vec3 p = origin + vec3(0.06, 0.035, 1.0) * (float(i) + jitter) * stride;
    float density = smokeDensity(p, width, time);
    if (density > 0.004) {
      float nearby = smokeDensity(p + lightDirection * 0.20, width, time);
      float distant = smokeDensity(p + lightDirection * 0.62, width, time);
      float shadow = exp(-(nearby * 1.15 + distant * 1.85));
      float edge = clamp((density - nearby) * 3.0, 0.0, 1.0);
      vec3 lighting = shadowColor + lightColor * (shadow * 0.72 + edge * 0.66);
      float alpha = 1.0 - exp(-density * stride * 3.7);
      scattered += transmission * lighting * alpha;
      transmission *= 1.0 - alpha;
      if (transmission < 0.025) break;
    }
  }

  vec3 background = vec3(0.026, 0.027, 0.032);
  vec3 color = background + scattered * u_intensity;
  gl_FragColor = vec4(finish(color), 1.0);
}
`;

export const glyphEmberFragment = `
uniform vec2 u_cssSize;
uniform vec4 u_pointer;
uniform sampler2D u_glyphs;
uniform float u_glyphCount;

float flameHeight(float x, float time) {
  float tongues = noise(vec2(x * 3.9, 4.3 + time * 0.19));
  tongues = pow(tongues, 1.65);
  return 0.13 + tongues * 0.83 + noise(vec2(x * 4.6, 2.4 - time * 0.21)) * 0.19;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 css = uv * u_cssSize;
  vec2 cellSize = vec2(6.45, 10.25);
  vec2 address = floor(css / cellSize);
  vec2 within = fract(css / cellSize);
  vec2 sampleAt = (address + 0.5) * cellSize / u_cssSize;
  float aspect = u_resolution.x / u_resolution.y;
  float x = (sampleAt.x - 0.5) * max(0.85, aspect);
  float height = sampleAt.y;
  float time = u_time * 0.8;
  x -= height * 0.17 + (noise(vec2(x * 2.4, height * 4.1 - time * 0.46)) - 0.5) * height * 0.38;
  float tip = flameHeight(x, time);
  float channel = noise(vec2(x * 9.0, height * 8.0 - time * 1.55));
  float heat = clamp(1.04 - height / max(0.12, tip) + (channel - 0.48) * height * 0.66, 0.0, 1.0);
  vec2 cursor = (sampleAt - u_pointer.xy) * vec2(aspect, 1.0);
  float nearPointer = exp(-dot(cursor, cursor) * 62.0);
  heat = clamp(heat - nearPointer * u_pointer.z * 0.60 + nearPointer * u_pointer.w * 0.96, 0.0, 1.0);
  float variation = hash(address + floor(time * 9.0 + hash(address) * 12.0) * 13.7);
  float visible = step(0.075 + variation * 0.15, heat);
  float ink = clamp(heat * 0.76 + variation * 0.37 - 0.16, 0.0, 0.999);
  float index = floor(ink * u_glyphCount);
  float glyph = texture2D(u_glyphs, vec2((index + clamp(within.x, 0.02, 0.98)) / u_glyphCount, 1.0 - within.y)).a;
  vec3 flame = mix(u_primary * 0.58, u_secondary * 0.98, pow(heat, 2.7));
  flame = mix(flame, vec3(1.0, 0.91, 0.99), smoothstep(0.91, 1.0, heat) * 0.79);
  float shade = smoothstep(0.065, 0.94, heat);
  vec3 color = vec3(0.027, 0.026, 0.034) + u_primary * shade * shade * 0.084;
  color += flame * glyph * visible * (0.17 + shade * 1.62) * u_intensity;
  color += u_secondary * exp(-uv.y * 17.0) * 0.17 * u_intensity;

  // Follow separate drifting ember cells above the flame front.
  vec2 sparks = vec2(uv.x * aspect + sin(uv.y * 6.0 + time * 0.65) * 0.022, uv.y - time * 0.17) * 13.4;
  vec2 cell = floor(sparks);
  vec2 delta = fract(sparks) - (vec2(hash(cell + 2.1), hash(cell + 17.6)) * 0.64 + 0.18);
  float point = length(delta);
  float spark = (exp(-point * 61.0) * 1.95 + exp(-point * 19.0) * 0.24) * step(0.87, hash(cell));
  spark *= smoothstep(0.075, 0.32, uv.y) * (1.0 - smoothstep(0.59, 0.99, uv.y));
  color += mix(u_secondary, vec3(1.0), 0.53) * spark * u_intensity;
  gl_FragColor = vec4(finish(color), 1.0);
}
`;

export const specterOrbFragment = `
uniform vec4 u_pointer;

float vapor(vec2 p) {
  float bend = noise(p * 1.12 + vec2(3.2, 8.4));
  p += vec2(bend, -bend) * 0.81;
  return noise(p) * 0.66 + noise(p * 2.13 + 7.5) * 0.25 + noise(p * 4.15 - 3.1) * 0.09;
}

void main() {
  vec2 p = plane();
  float aspect = u_resolution.x / u_resolution.y;
  float fit = min(1.0, aspect / 0.83);
  vec2 cursor = (u_pointer.xy - 0.5) * vec2(aspect, 1.0) / fit;
  vec2 reach = cursor * (1.0 / max(0.28, length(cursor)));
  vec2 lean = reach * u_pointer.z;
  vec2 q = p / fit - vec2(0.0, 0.018) - lean * 0.032;
  float distanceToCenter = length(q);
  if (distanceToCenter > 0.45) {
    gl_FragColor = vec4(vec3(0.012, 0.012, 0.016), 1.0);
    return;
  }

  float time = u_time * 0.27;
  vec2 radial = q / max(distanceToCenter, 0.0001);
  float angle = atan(q.y, q.x + 0.00001);
  float radius = 0.270 + sin(angle * 3.0 - time) * 0.011 + cos(angle * 5.0 + time * 0.8) * 0.006;
  radius += (noise(radial * 2.2 + vec2(time * 0.52, 1.4)) - 0.5) * 0.033;
  radius += dot(radial, lean) * 0.012;
  float edge = distanceToCenter - radius;
  float pixel = 1.0 / (fit * u_resolution.y);
  float disc = 1.0 - smoothstep(-pixel, pixel, edge);
  vec2 surface = q / radius;
  float depth = sqrt(max(0.0, 1.0 - dot(surface, surface)));
  vec2 key = mix(vec2(0.57, 0.56), reach * 0.83, u_pointer.z);
  vec2 keyDirection = normalize(key + vec2(0.001, 0.0));
  float light = 0.5 + 0.5 * dot(radial, keyDirection);
  float movingRim = pow(light, 8.0) * smoothstep(0.05, 0.43, length(key)) * u_pointer.z;
  vec3 blue = u_primary * vec3(0.24, 0.37, 1.0);
  vec3 violet = u_secondary * vec3(0.47, 0.23, 1.0);
  vec3 rim = mix(violet, blue, pow(light, 1.7));
  vec3 color = vec3(0.010, 0.010, 0.016);
  float outerGlow = exp(-max(edge, 0.0) * 42.0) * (1.0 - smoothstep(0.04, 0.15, edge));
  color += rim * outerGlow * (0.51 + movingRim * 0.58) * u_intensity;

  float body = 0.0;
  for (int i = 0; i < 3; i++) {
    float layer = float(i);
    vec2 flow = (surface - lean * (0.16 + layer * 0.05)) * (2.45 + layer * 0.71);
    flow += vec2(layer * 2.6 - time * 0.7, depth * (1.1 + layer * 0.8) + time * 0.47);
    body += smoothstep(0.27, 0.79, vapor(flow)) * (0.47 - layer * 0.12);
  }
  vec2 keyOffset = surface - key;
  vec2 fillOffset = surface + mix(vec2(0.60, 0.56), key * 0.8, u_pointer.z);
  float keyLight = exp(-dot(keyOffset, keyOffset) * 4.0);
  float fillLight = exp(-dot(fillOffset, fillOffset) * 5.3);
  float wash = pow(body, 1.8);
  vec3 interior = vec3(0.008, 0.009, 0.033) + blue * wash * 0.24;
  interior += (blue * keyLight + violet * fillLight) * (0.32 + wash * 1.05);
  interior += mix(blue, u_primary, 0.24) * keyLight * u_pointer.z * (0.24 + wash * 0.44);
  interior += rim * pow(1.0 - depth, 2.6) * 0.62;
  color = mix(color, interior * u_intensity, disc);
  color += mix(rim, u_primary, light * 0.29) * exp(-abs(edge) / max(0.0028, pixel)) * (0.67 + light * 0.64 + movingRim * 1.35) * u_intensity;
  gl_FragColor = vec4(finish(color), 1.0);
}
`;
