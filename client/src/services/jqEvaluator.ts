/**
 * Pure client-side JQ transformation engine for arbitrary JSON payloads.
 * Supports standard JQ filter constructs:
 * - Field access: `.field`, `.foo.bar`, `.["key"]`
 * - Array operations: `.[]`, `.[0]`, `.[0:2]`
 * - Array construction: `[ .[] | ... ]`
 * - Object construction: `{ element: .title, value: .count, ... }`
 * - Pipe chaining: `expr1 | expr2`
 * - Functions: `tostring`, `tonumber`, `length`, `keys`, `map(...)`, `select(...)`
 */

export interface JqEvaluationResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export function evaluateJq(inputJson: unknown, filterStr: string): JqEvaluationResult {
  try {
    const trimmed = filterStr.trim();
    if (!trimmed || trimmed === '.') {
      return { success: true, data: inputJson };
    }

    const result = executeFilter(inputJson, trimmed);
    return { success: true, data: result };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

function executeFilter(input: unknown, filter: string): unknown {
  const trimmed = filter.trim();
  if (trimmed === '.') return input;

  // Handle fallback operator: expr1 // expr2
  const fallbackIdx = findTopLevelFallbackIndex(trimmed);
  if (fallbackIdx !== -1) {
    const left = trimmed.slice(0, fallbackIdx).trim();
    const right = trimmed.slice(fallbackIdx + 2).trim();
    const leftRes = executeFilter(input, left);
    if (leftRes !== null && leftRes !== undefined && leftRes !== false && leftRes !== '') {
      return leftRes;
    }
    return executeFilter(input, right);
  }

  // Handle if-then-elif-else-end conditionals
  if (trimmed.startsWith('if ') && trimmed.endsWith('end')) {
    return evaluateIfElse(input, trimmed);
  }

  // Handle top-level array construction: [ ... ]
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return [];
    const elements = evalMultiExpression(input, inner);
    return Array.isArray(elements) ? elements : [elements];
  }

  // Handle pipe: expr1 | expr2 (taking care of braces and brackets)
  const pipeSegments = splitByTopLevelPipe(trimmed);
  if (pipeSegments.length > 1) {
    let current = input;
    for (const seg of pipeSegments) {
      current = executeFilter(current, seg);
    }
    return current;
  }

  // Handle map(expr)
  if (trimmed.startsWith('map(') && trimmed.endsWith(')')) {
    if (!Array.isArray(input)) throw new Error('Cannot apply map() to non-array');
    const expr = trimmed.slice(4, -1).trim();
    return input.map((item) => executeFilter(item, expr));
  }

  // Handle select(condition)
  if (trimmed.startsWith('select(') && trimmed.endsWith(')')) {
    const condition = trimmed.slice(7, -1).trim();
    const condResult = evaluateCondition(input, condition);
    return condResult ? input : null;
  }

  // Handle built-ins
  if (trimmed === 'tostring') {
    if (input === null || input === undefined) return '';
    if (typeof input === 'object') return JSON.stringify(input);
    return String(input);
  }
  if (trimmed === 'tonumber') {
    return Number(input);
  }
  if (trimmed === 'length') {
    if (Array.isArray(input)) return input.length;
    if (typeof input === 'string') return input.length;
    if (input && typeof input === 'object') return Object.keys(input).length;
    return 0;
  }
  if (trimmed === 'keys') {
    if (input && typeof input === 'object') return Object.keys(input);
    return [];
  }

  // Handle array iterator: .[]
  if (trimmed === '.[]') {
    if (Array.isArray(input)) return input;
    if (input && typeof input === 'object') return Object.values(input);
    throw new Error('Cannot iterate over non-iterable value');
  }

  // Handle object construction: { key: expr, key2: expr }
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return buildObject(input, trimmed.slice(1, -1));
  }

  // Handle field access: .foo or .foo.bar or .["foo"]
  if (trimmed.startsWith('.')) {
    return accessPath(input, trimmed.slice(1));
  }

  // Literal value with interpolation
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    const inner = trimmed.slice(1, -1);
    return interpolateString(input, inner);
  }
  if (!isNaN(Number(trimmed))) {
    return Number(trimmed);
  }
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;

  throw new Error(`Unsupported JQ filter: ${trimmed}`);
}

function interpolateString(input: unknown, str: string): string {
  return str.replace(/\\\((.*?)\)/g, (_, expr) => {
    const res = executeFilter(input, expr.trim());
    return res === null || res === undefined ? '' : String(res);
  });
}

function evaluateIfElse(input: unknown, expr: string): unknown {
  const clauses = parseIfClauses(expr);
  for (const clause of clauses) {
    if (clause.condition === null || evaluateCondition(input, clause.condition)) {
      return executeFilter(input, clause.body);
    }
  }
  return null;
}

interface IfClause {
  condition: string | null;
  body: string;
}

function parseIfClauses(expr: string): IfClause[] {
  const clauses: IfClause[] = [];
  const tokens = tokenizeIfExpr(expr);
  let currentCond: string | null = null;

  for (const tok of tokens) {
    if (tok.type === 'if' || tok.type === 'elif') {
      currentCond = tok.value;
    } else if (tok.type === 'then') {
      clauses.push({ condition: currentCond, body: tok.value });
    } else if (tok.type === 'else') {
      clauses.push({ condition: null, body: tok.value });
    }
  }
  return clauses;
}

function tokenizeIfExpr(expr: string): { type: string; value: string }[] {
  const result: { type: string; value: string }[] = [];
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let currentKeyword = '';
  let start = 0;

  const keywords = ['if', 'then', 'elif', 'else', 'end'];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (inString) {
      if (ch === stringChar && expr[i - 1] !== '\\') inString = false;
      i++;
    } else {
      if (ch === '"' || ch === "'") {
        inString = true;
        stringChar = ch;
        i++;
      } else if (ch === '(' || ch === '{' || ch === '[') {
        depth++;
        i++;
      } else if (ch === ')' || ch === '}' || ch === ']') {
        depth--;
        i++;
      } else if (depth === 0) {
        let matchedKw: string | null = null;
        for (const kw of keywords) {
          const sub = expr.slice(i, i + kw.length);
          const nextChar = expr[i + kw.length];
          const prevChar = i > 0 ? expr[i - 1] : ' ';
          if (sub === kw && (nextChar === undefined || /\s/.test(nextChar)) && (prevChar === undefined || /\s/.test(prevChar))) {
            matchedKw = kw;
            break;
          }
        }
        if (matchedKw) {
          if (currentKeyword) {
            result.push({ type: currentKeyword, value: expr.slice(start, i).trim() });
          }
          currentKeyword = matchedKw;
          i += matchedKw.length;
          start = i;
        } else {
          i++;
        }
      } else {
        i++;
      }
    }
  }
  return result;
}

function findTopLevelFallbackIndex(str: string): number {
  let depth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < str.length - 1; i++) {
    const ch = str[i];
    if (inString) {
      if (ch === stringChar && str[i - 1] !== '\\') inString = false;
    } else {
      if (ch === '"' || ch === "'") {
        inString = true;
        stringChar = ch;
      } else if (ch === '{' || ch === '[' || ch === '(') {
        depth++;
      } else if (ch === '}' || ch === ']' || ch === ')') {
        depth--;
      } else if (ch === '/' && str[i + 1] === '/' && depth === 0) {
        return i;
      }
    }
  }
  return -1;
}

function evalMultiExpression(input: unknown, expr: string): unknown[] {
  // If expression is of form: .[] | { ... } or something | something
  const pipeIdx = findTopLevelPipeIndex(expr);
  if (pipeIdx !== -1) {
    const left = expr.slice(0, pipeIdx).trim();
    const right = expr.slice(pipeIdx + 1).trim();
    const leftRes = executeFilter(input, left);
    if (Array.isArray(leftRes)) {
      return leftRes.map((item) => executeFilter(item, right)).filter((x) => x !== null);
    } else {
      const rightRes = executeFilter(leftRes, right);
      return Array.isArray(rightRes) ? rightRes : [rightRes];
    }
  }

  const res = executeFilter(input, expr);
  return Array.isArray(res) ? res : [res];
}

function accessPath(input: unknown, path: string): unknown {
  if (!path) return input;
  let curr: unknown = input;

  // Tokenize path tokens: e.g. "foo.bar[0]" -> ["foo", "bar", 0]
  const tokens = parsePathTokens(path);
  for (const token of tokens) {
    if (curr === null || curr === undefined) return null;
    if (typeof token === 'number') {
      if (Array.isArray(curr)) {
        curr = curr[token];
      } else {
        return null;
      }
    } else if (token === '[]') {
      if (Array.isArray(curr)) {
        curr = curr.flat();
      }
    } else {
      if (typeof curr === 'object' && curr !== null) {
        curr = (curr as Record<string, unknown>)[token];
      } else {
        return null;
      }
    }
  }
  return curr;
}

function parsePathTokens(path: string): (string | number)[] {
  const tokens: (string | number)[] = [];
  const parts = path.split('.');
  for (const part of parts) {
    if (!part) continue;
    // Check for array index e.g. foo[0] or [0] or []
    const subParts = part.split(/[[\]]/).filter(Boolean);
    for (const sub of subParts) {
      if (/^\d+$/.test(sub)) {
        tokens.push(parseInt(sub, 10));
      } else {
        tokens.push(sub.replace(/^['"]|['"]$/g, ''));
      }
    }
  }
  return tokens;
}

function buildObject(input: unknown, body: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const entries = splitObjectEntries(body);

  for (const entry of entries) {
    const colonIdx = entry.indexOf(':');
    if (colonIdx === -1) {
      // Shortcut e.g. { foo } -> { foo: .foo }
      const key = entry.trim().replace(/^['"]|['"]$/g, '');
      if (key) {
        result[key] = executeFilter(input, `.${key}`);
      }
    } else {
      const rawKey = entry.slice(0, colonIdx).trim().replace(/^['"]|['"]$/g, '');
      const rawVal = entry.slice(colonIdx + 1).trim();
      // If rawVal is parenthesized like `(.upvotes | tostring)`
      const cleanVal = rawVal.startsWith('(') && rawVal.endsWith(')') ? rawVal.slice(1, -1).trim() : rawVal;
      result[rawKey] = executeFilter(input, cleanVal);
    }
  }
  return result;
}

function splitObjectEntries(body: string): string[] {
  const entries: string[] = [];
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let start = 0;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inString) {
      if (ch === stringChar && body[i - 1] !== '\\') inString = false;
    } else {
      if (ch === '"' || ch === "'") {
        inString = true;
        stringChar = ch;
      } else if (ch === '{' || ch === '[' || ch === '(') {
        depth++;
      } else if (ch === '}' || ch === ']' || ch === ')') {
        depth--;
      } else if (ch === ',' && depth === 0) {
        entries.push(body.slice(start, i).trim());
        start = i + 1;
      }
    }
  }
  const last = body.slice(start).trim();
  if (last) entries.push(last);
  return entries;
}

function splitByTopLevelPipe(str: string): string[] {
  const segments: string[] = [];
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let start = 0;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (inString) {
      if (ch === stringChar && str[i - 1] !== '\\') inString = false;
    } else {
      if (ch === '"' || ch === "'") {
        inString = true;
        stringChar = ch;
      } else if (ch === '{' || ch === '[' || ch === '(') {
        depth++;
      } else if (ch === '}' || ch === ']' || ch === ')') {
        depth--;
      } else if (ch === '|' && depth === 0) {
        segments.push(str.slice(start, i).trim());
        start = i + 1;
      }
    }
  }
  const last = str.slice(start).trim();
  if (last) segments.push(last);
  return segments;
}

function findTopLevelPipeIndex(str: string): number {
  let depth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (inString) {
      if (ch === stringChar && str[i - 1] !== '\\') inString = false;
    } else {
      if (ch === '"' || ch === "'") {
        inString = true;
        stringChar = ch;
      } else if (ch === '{' || ch === '[' || ch === '(') {
        depth++;
      } else if (ch === '}' || ch === ']' || ch === ')') {
        depth--;
      } else if (ch === '|' && depth === 0) {
        return i;
      }
    }
  }
  return -1;
}

function evaluateCondition(input: unknown, condition: string): boolean {
  const trimmed = condition.trim();
  if (/\sor\s/i.test(trimmed)) {
    const parts = trimmed.split(/\s+or\s+/i);
    return parts.some((p) => evaluateCondition(input, p));
  }
  if (/\sand\s/i.test(trimmed)) {
    const parts = trimmed.split(/\s+and\s+/i);
    return parts.every((p) => evaluateCondition(input, p));
  }
  if (trimmed.includes('==')) {
    const [left, right] = trimmed.split('==').map((s) => s.trim());
    return executeFilter(input, left) === executeFilter(input, right);
  }
  if (trimmed.includes('!=')) {
    const [left, right] = trimmed.split('!=').map((s) => s.trim());
    return executeFilter(input, left) !== executeFilter(input, right);
  }
  if (trimmed.includes('>=')) {
    const [left, right] = trimmed.split('>=').map((s) => s.trim());
    return Number(executeFilter(input, left)) >= Number(executeFilter(input, right));
  }
  if (trimmed.includes('<=')) {
    const [left, right] = trimmed.split('<=').map((s) => s.trim());
    return Number(executeFilter(input, left)) <= Number(executeFilter(input, right));
  }
  if (trimmed.includes('>')) {
    const [left, right] = trimmed.split('>').map((s) => s.trim());
    return Number(executeFilter(input, left)) > Number(executeFilter(input, right));
  }
  if (trimmed.includes('<')) {
    const [left, right] = trimmed.split('<').map((s) => s.trim());
    return Number(executeFilter(input, left)) < Number(executeFilter(input, right));
  }
  const val = executeFilter(input, trimmed);
  return !!val;
}
