import { type as textType } from 'https://esm.sh/ot-text-unicode@4.0.0?bundle';

export function normalizeOperation(op = []) {
  return textType.normalize(op);
}

export function applyOperation(snapshot, op = []) {
  return textType.apply(snapshot ?? '', op);
}

export function composeOperations(opA = [], opB = []) {
  return textType.compose(opA, opB);
}

export function transformOperation(op, otherOp, side) {
  return textType.transform(op, otherOp, side);
}

export function transformOperations(opA = [], opB = []) {
  return [
    textType.transform(opA, opB, 'left'),
    textType.transform(opB, opA, 'right'),
  ];
}

export function isEmptyOperation(op = []) {
  return normalizeOperation(op).length === 0;
}

export function cloneOperation(op = []) {
  return JSON.parse(JSON.stringify(op));
}

export function operationLength(op = []) {
  let len = 0;
  for (let component of op) {
    if (typeof component === 'string') len += component.length;
    else if (typeof component === 'number') len += component;
    else if (component?.d != null) len += typeof component.d === 'string' ? component.d.length : component.d;
  }
  return len;
}

export function deleteLength(component) {
  if (!component || component.d == null) return 0;
  return typeof component.d === 'string' ? component.d.length : component.d;
}

export default {
  normalizeOperation,
  applyOperation,
  composeOperations,
  transformOperation,
  transformOperations,
  isEmptyOperation,
  cloneOperation,
  operationLength,
  deleteLength,
};
