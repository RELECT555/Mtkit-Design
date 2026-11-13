// Keep the rotating, recursively folded sphere: a torus cannot reproduce its unfolding.
export const phosphorShellFragment = `
// Motion adapted from Phosphor 30 by XorDev.
// https://21st.dev/@xordev/components/phosphor-30
vec2 phosphorField(vec3 point, float time, float previousStep) {
  vec3 axis = normalize(cos(vec3(5.0, 0.0, 1.0) + time - previousStep * 4.0));
  vec3 folded = axis * dot(axis, point) - cross(axis, point);

  // Each frequency folds the preceding layer. Advancing time turns those
  // layers through one another, revealing and closing the luminous seams.
  for (int octave = 2; octave <= 9; octave++) {
    float frequency = float(octave);
    folded -= sin(folded * frequency + time).zxy / frequency;
  }

  float sphere = abs(length(point) - 3.0);
  float seam = abs(cos(folded.y));
  return vec2(max(0.0008, sphere * 0.1 + seam * 0.07), folded.y);
}

void main() {
  vec2 uv = (2.0 * gl_FragCoord.xy - u_resolution) / max(1.0, min(u_resolution.x, u_resolution.y));
  vec3 ray = normalize(vec3(uv * 1.06, -1.0));
  float time = u_time;
  float distance = 0.0;
  float stride = 0.0;
  vec3 energy = vec3(0.0);

  for (int sampleIndex = 0; sampleIndex < 80; sampleIndex++) {
    vec3 point = vec3(0.0, 0.0, 5.0) + ray * distance;
    vec2 field = phosphorField(point, time, stride);
    stride = field.x;
    distance += stride;

    // The colors travel with the folding material, rather than screen height.
    float warm = 0.5 + 0.5 * cos(field.y);
    float cold = 0.5 + 0.5 * cos(field.y + 8.0);
    float warmth = smoothstep(-0.3, 0.3, warm - cold);
    vec3 radiance = mix(u_secondary, u_primary, warmth) * max(warm, cold) * 1.25;
    energy += radiance * (0.0004 / stride);
  }

  // Bounded HDR response, including bright white creases, in WebGL 1 GLSL.
  vec3 exposure = exp(-energy * 2.0 * u_intensity);
  gl_FragColor = vec4((1.0 - exposure) / (1.0 + exposure), 1.0);
}
`;
