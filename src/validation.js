export class AppError extends Error {
  constructor(message, status = 400, code = 'invalid_request') {
    super(message); this.status = status; this.code = code;
  }
}
export function assert(condition, message, status = 400, code) {
  if (!condition) throw new AppError(message, status, code);
}
export function object(value, label) {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  return value;
}
export function number(value, min, max, label) {
  assert(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max,
    `${label} must be a finite number in [${min}, ${max}]`);
  return value;
}
export function text(value, label, max = 10000) {
  assert(typeof value === 'string' && value.trim().length > 0 && value.length <= max,
    `${label} must be nonempty text of at most ${max} characters`);
  return value;
}
export function integer(value, min, max, label) {
  number(value, min, max, label); assert(Number.isInteger(value), `${label} must be an integer`); return value;
}
export function knownKeys(value, allowed, label) {
  object(value, label);
  for (const key of Object.keys(value)) assert(allowed.includes(key), `Unknown ${label} field: ${key}`);
}
