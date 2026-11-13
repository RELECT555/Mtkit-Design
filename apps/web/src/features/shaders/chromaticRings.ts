export const chromaticRingsFragment = `
void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution)
    / max(1.0, min(u_resolution.x, u_resolution.y));

  // Match the supplied animation's 0.05-per-frame clock at 60 Hz,
  // while using the renderer's elapsed seconds for frame-rate independence.
  float t = (1.0 + u_time * 3.0) * 0.05;
  float radius = length(uv);
  float bands = mod(uv.x + uv.y, 0.2);
  vec3 color = vec3(0.0);

  for (int channel = 0; channel < 3; channel++) {
    for (int ring = 1; ring < 5; ring++) {
      float index = float(ring);
      float wave = fract(t - 0.01 * float(channel) + index * 0.01) * 5.0;
      float distanceToRing = max(abs(wave - radius + bands), 0.0001);
      color[channel] += 0.002 * index * index / distanceToRing;
    }
  }

  // White tints preserve the original RGB-separated rings.
  vec3 tint = mix(u_primary, u_secondary, smoothstep(0.0, 2.0, radius));
  gl_FragColor = vec4(color * tint * u_intensity, 1.0);
}
`;
