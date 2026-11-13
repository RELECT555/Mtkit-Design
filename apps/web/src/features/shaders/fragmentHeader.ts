export const fragmentHeader = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_intensity;
uniform vec3 u_primary;
uniform vec3 u_secondary;

float hash(vec2 point) {
  vec3 p = fract(vec3(point.xyx) * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float noise(vec2 point) {
  vec2 cell = floor(point);
  vec2 blend = fract(point);
  blend = blend * blend * (3.0 - 2.0 * blend);
  return mix(mix(hash(cell), hash(cell + vec2(1.0, 0.0)), blend.x),
    mix(hash(cell + vec2(0.0, 1.0)), hash(cell + 1.0), blend.x), blend.y);
}

vec2 plane() {
  return (gl_FragCoord.xy - 0.5 * u_resolution) / max(1.0, u_resolution.y);
}

float stars(vec2 p, float density, float threshold) {
  vec2 cell = floor(p * density);
  float seed = hash(cell);
  vec2 offset = vec2(hash(cell + 11.4), hash(cell - 23.8)) * 0.58 + 0.21;
  float d = length(fract(p * density) - offset);
  return step(threshold, seed) * exp(-d * 22.0) * (0.4 + 0.6 * hash(cell + 3.0));
}

vec3 finish(vec3 color) {
  float grain = (hash(gl_FragCoord.xy) - 0.5) * 0.009;
  return max(vec3(0.0), 1.0 - exp(-color * 1.27) + grain);
}
`;
