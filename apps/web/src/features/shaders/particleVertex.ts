// A bounded point grid is animated on the GPU; no per-frame React or CPU particle updates.
export const particleVertex = `
precision highp float;
attribute vec2 a_position;
uniform vec2 u_resolution;
uniform vec2 u_cssSize;
uniform vec2 u_imageSize;
uniform vec4 u_pointer;
uniform vec2 u_pointerMotion;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_imageUv;
varying float v_scatter;

float random(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  float aspect = u_resolution.x / u_resolution.y;
  float imageAspect = u_imageSize.x / u_imageSize.y;
  vec2 fit = vec2(min(aspect, imageAspect), min(1.0, aspect / imageAspect)) * 0.90;
  vec2 home = (a_position - 0.5) * fit;
  float seed = random(a_position);
  vec2 pointer = (u_pointer.xy - 0.5) * vec2(aspect, 1.0);
  vec2 delta = home - pointer;
  float distanceToPointer = length(delta);
  float radius = min(0.22, fit.x * 0.32);
  float force = (1.0 - smoothstep(0.0, radius, distanceToPointer)) * u_pointer.z;
  float t = u_time * 0.32;
  // The settled image stays coherent. Only the active brush separates the grains.
  vec2 current = vec2(sin(home.y * 8.0 + t), cos(home.x * 7.0 - t));
  vec2 offset = current * 0.00035 * u_intensity;
  vec2 radial = delta / max(distanceToPointer, 0.002);
  vec2 tangent = vec2(-radial.y, radial.x);
  // Keep a coherent underlayer while the lighter grains lift into the flow.
  float spread = force * u_intensity * smoothstep(0.62, 1.0, seed);
  offset += (radial * 0.18 + tangent * 0.085
    + u_pointerMotion * 0.07) * spread;
  offset += vec2(sin(seed * 31.0 + t), cos(seed * 27.0 - t)) * spread * 0.012;
  vec2 position = home + offset;
  gl_Position = vec4(position / vec2(aspect, 1.0) * 2.0, 0.0, 1.0);
  // Match the source grid spacing, including portrait and panoramic images.
  float spacing = max(fit.x / 384.0, fit.y / 256.0) * u_resolution.y;
  gl_PointSize = clamp(spacing * (1.65 + force * 0.8 + min(spread, 1.0) * 1.4), 1.0, 16.0);
  v_imageUv = a_position;
  v_scatter = min(spread, 1.0);
}
`;
