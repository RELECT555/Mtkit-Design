import { fragmentHeader } from "./fragmentHeader";

export const auroraFragment = fragmentHeader + `
float ridge(float x, float phase) {
  return sin(x * 4.0 + phase) * 0.11 + sin(x * 9.0 - phase * 0.57) * 0.035;
}

void main() {
  vec2 p = plane();
  float t = u_time * 0.32;
  float x = p.x - 0.08 * sin(p.y * 3.8);
  float mist = noise(p * 5.8 + vec2(t * 0.3, 2.4));
  vec3 color = vec3(0.011, 0.024, 0.045) + u_secondary * mist * exp(-dot(p, p) * 2.2) * 0.14;
  color += vec3(0.74, 0.89, 1.0) * stars(p, 123.0, 0.935) * 0.63;
  for (int i = 0; i < 3; i++) {
    float layer = float(i);
    float wave = ridge(x, t + layer * 1.24) + x * (0.23 - layer * 0.12);
    float height = p.y - wave + 0.22 - layer * 0.17;
    float pleatX = x * (126.0 + layer * 14.0) + 9.0 * sin(x * 10.0 + t + layer) + height * 11.0;
    float folds = 0.5 + 0.5 * sin(pleatX) * cos(x * 48.0 - t * 0.4 + layer * 7.0);
    float ridges = pow(folds, 3.0);
    float strength = smoothstep(0.14, 0.78, noise(vec2(x * 4.7 + layer * 3.5, 2.0 + t * 0.3)));
    float lowerEdge = exp(-abs(height) * 78.0) * (0.10 + strength * 0.47);
    float curtain = exp(-max(0.0, height) * (5.8 - layer * 0.6 + 3.0 * folds));
    curtain *= smoothstep(-0.024, 0.08, height) * (0.14 + 0.46 * ridges) * (0.32 + strength);
    vec3 lowerTint = mix(u_primary, u_secondary, layer * 0.28);
    vec3 upperTint = mix(lowerTint, u_secondary, smoothstep(0.02, 0.31, height));
    color += (lowerTint * lowerEdge + upperTint * curtain) * u_intensity;
  }
  float skyline = -0.39 + noise(vec2(p.x * 7.0, 8.0)) * 0.105 + noise(vec2(p.x * 20.0, 2.0)) * 0.025;
  skyline += (1.0 - abs(2.0 * noise(vec2(p.x * 34.0, 6.7)) - 1.0)) * 0.013;
  float land = smoothstep(-0.002, 0.002, p.y - skyline);
  vec3 terrain = vec3(0.009, 0.015, 0.027) + u_secondary * exp(-abs(p.y - skyline) * 34.0) * 0.026;
  color = mix(terrain, color, land);
  gl_FragColor = vec4(finish(color), 1.0);
}
`;
