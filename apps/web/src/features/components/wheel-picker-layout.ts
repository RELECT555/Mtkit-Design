export const wheelDefaults = { hours: 9, minutes: 30, label: "Время напоминания" };
export const rowHeight = 36;
export const rowAngle = 20;
export const radius = rowHeight / 2 / Math.tan(Math.PI / 18);
const windowSize = Math.ceil(90 / rowAngle);

export const wrap = (row: number, count: number) => ((row % count) + count) % count;
export const twoDigits = (value: number) => String(value).padStart(2, "0");

export function wheelRows(center: number) {
  return Array.from({ length: windowSize * 2 + 1 }, (_, index) => center + index - windowSize);
}

export function wheelRowTransform(row: number) {
  return `rotateX(${-row * rowAngle}deg) translateZ(${radius}px)`;
}
