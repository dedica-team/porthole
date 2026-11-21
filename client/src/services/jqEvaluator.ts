/**
 * Pure client-side JQ transformation engine for arbitrary JSON payloads.
 * Supports standard JQ filter constructs with stream and iterator semantics:
 * - Field access: `.field`, `.foo.bar`, `.["key"]`
 * - Nested array iterators: `.groups[].items[].name`
 * - Array operations: `.[]`, `.[0]`
 * - Array construction: `[ .[] | ... ]`
 * - Object construction: `{ element: .title, value: .count, ... }`
 * - Pipe chaining with stream propagation: `expr1 | expr2`
 * - Functions: `tostring`, `tonumber`, `length`, `keys`, `map(...)`, `select(...)`
 * - Conditionals & fallbacks: `if ... then ... elif ... else ... end`, `expr1 // expr2`
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
  const stream = executeFilterStream(input, filter);
  if (stream.length === 1) return stream[0];
  if (stream.length === 0) return null;
  return stream;
}

function executeFilterStream(input: unknown, filter: string): unknown[] {
  const trimmed = filter.trim();
  if (!trimmed || trimmed === '.') return [input];

  // Handle top-level balanced parentheses: ( ... )
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    let depth = 0;
    let inString = false;
    let stringChar = '';
    let isFullyEnclosed = true;
    for (let i = 0; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (inString) {
        if (ch === stringChar && trimmed[i - 1] !== '\\') inString = false;
      } else {
        if (ch === '"' || ch === "'") {
          inString = true;
          stringChar = ch;
        } else if (ch === '(') {
          depth++;
        } else if (ch === ')') {
          depth--;
          if (depth === 0 && i < trimmed.length - 1) {
            isFullyEnclosed = false;
            break;
          }
        }
      }
    }
    if (isFullyEnclosed && depth === 0) {
      return executeFilterStream(input, trimmed.slice(1, -1).trim());
    }
  }

  // Handle fallback operator: expr1 // expr2
  const fallbackIdx = findTopLevelFallbackIndex(trimmed);
  if (fallbackIdx !== -1) {
    const left = trimmed.slice(0, fallbackIdx).trim();
    const right = trimmed.slice(fallbackIdx + 2).trim();
    const leftStream = executeFilterStream(input, left);
    const valid = leftStream.filter((v) => v !== null && v !== undefined && v !== false && v !== '');
    if (valid.length > 0) {
      return valid;
    }
    return executeFilterStream(input, right);
  }

  // Handle if-then-elif-else-end conditionals
  if (trimmed.startsWith('if ') && trimmed.endsWith('end')) {
    return [evaluateIfElse(input, trimmed)];
  }

  // Handle top-level array construction: [ ... ]
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return [[]];
    const elements = executeFilterStream(input, inner);
    return [elements];
  }

  // Handle pipe: expr1 | expr2
  const pipeSegments = splitByTopLevelPipe(trimmed);
  if (pipeSegments.length > 1) {
    let currentStream = [input];
    for (const seg of pipeSegments) {
      currentStream = currentStream.flatMap((item) => executeFilterStream(item, seg));
    }
    return currentStream;
  }

  // Handle map(expr)
  if (trimmed.startsWith('map(') && trimmed.endsWith(')')) {
    if (!Array.isArray(input)) throw new Error('Cannot apply map() to non-array');
    const expr = trimmed.slice(4, -1).trim();
    const mapped = input.flatMap((item) => executeFilterStream(item, expr));
    return [mapped];
  }

  // Handle group_by(expr)
  if (trimmed.startsWith('group_by(') && trimmed.endsWith(')')) {
    if (!Array.isArray(input)) throw new Error('Cannot apply group_by() to non-array');
    const expr = trimmed.slice(9, -1).trim();
    const groupsMap = new Map<string, unknown[]>();
    for (const item of input) {
      const keyVal = executeFilter(item, expr);
      const groupKey =
        typeof keyVal === 'object' && keyVal !== null ? JSON.stringify(keyVal) : String(keyVal);
      let group = groupsMap.get(groupKey);
      if (!group) {
        group = [];
        groupsMap.set(groupKey, group);
      }
      group.push(item);
    }
    return [Array.from(groupsMap.values())];
  }

  // Handle split(delimiter) and split(delimiter)[index]
  if (trimmed.startsWith('split(')) {
    const closeParenIdx = trimmed.indexOf(')');
    if (closeParenIdx !== -1) {
      const rawDelim = trimmed.slice(6, closeParenIdx).trim();
      const delim =
        (rawDelim.startsWith('"') && rawDelim.endsWith('"')) ||
        (rawDelim.startsWith("'") && rawDelim.endsWith("'"))
          ? rawDelim.slice(1, -1)
          : rawDelim;
      if (typeof input !== 'string') {
        throw new Error('Cannot apply split() to non-string');
      }
      const splitArr = input.split(delim);
      const remainder = trimmed.slice(closeParenIdx + 1).trim();
      if (!remainder) {
        return [splitArr];
      }
      return executeFilterStream(splitArr, remainder.startsWith('.') ? remainder : `.${remainder}`);
    }
  }

  // Handle select(condition)
  if (trimmed.startsWith('select(') && trimmed.endsWith(')')) {
    const condition = trimmed.slice(7, -1).trim();
    const condResult = evaluateCondition(input, condition);
    return condResult ? [input] : [];
  }

  // Handle built-ins
  if (trimmed === 'tostring') {
    if (input === null || input === undefined) return [''];
    if (typeof input === 'object') return [JSON.stringify(input)];
    return [String(input)];
  }
  if (trimmed === 'tonumber') {
    return [Number(input)];
  }
  if (trimmed === 'length') {
    if (Array.isArray(input)) return [input.length];
    if (typeof input === 'string') return [input.length];
    if (input && typeof input === 'object') return [Object.keys(input).length];
    return [0];
  }
  if (trimmed === 'keys') {
    if (input && typeof input === 'object') return [Object.keys(input)];
    return [[]];
  }

  // Handle array iterator: .[]
  if (trimmed === '.[]') {
    if (Array.isArray(input)) return [...input];
    if (input && typeof input === 'object') return Object.values(input);
    throw new Error('Cannot iterate over non-iterable value');
  }

  // Handle object construction: { key: expr, key2: expr }
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return [buildObject(input, trimmed.slice(1, -1))];
  }

  // Handle field access: .foo or .foo.bar or .groups[].items[].name
  if (trimmed.startsWith('.')) {
    return evaluatePathStream(input, trimmed.slice(1));
  }

  // Literal value with interpolation
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    const inner = trimmed.slice(1, -1);
    return [interpolateString(input, inner)];
  }
  if (!isNaN(Number(trimmed))) {
    return [Number(trimmed)];
  }
  if (trimmed === 'true') return [true];
  if (trimmed === 'false') return [false];
  if (trimmed === 'null') return [null];

  throw new Error(`Unsupported JQ filter: ${trimmed}`);
}

function evaluatePathStream(input: unknown, path: string): unknown[] {
  if (!path) return [input];
  const tokens = parsePathTokens(path);
  let stream: unknown[] = [input];

  for (const token of tokens) {
    if (token === '[]') {
      stream = stream.flatMap((item) => {
        if (Array.isArray(item)) return item;
        if (item && typeof item === 'object') return Object.values(item);
        return [];
      });
    } else if (typeof token === 'number') {
      stream = stream.map((item) => {
        if (!Array.isArray(item)) return null;
        const idx = token < 0 ? item.length + token : token;
        return item[idx] ?? null;
      });
    } else {
      stream = stream.map((item) => {
        if (item && typeof item === 'object') {
          return (item as Record<string, unknown>)[token] ?? null;
        }
        return null;
      });
    }
  }
  return stream;
}

function parsePathTokens(path: string): (string | number)[] {
  const tokens: (string | number)[] = [];
  let i = 0;
  let curr = '';

  while (i < path.length) {
    const ch = path[i];
    if (ch === '.') {
      if (curr) {
        tokens.push(curr);
        curr = '';
      }
      i++;
    } else if (ch === '[') {
      if (curr) {
        tokens.push(curr);
        curr = '';
      }
      const closeIdx = path.indexOf(']', i);
      if (closeIdx === -1) {
        curr += path.slice(i);
        break;
      }
      const bracketContent = path.slice(i + 1, closeIdx).trim();
      if (bracketContent === '') {
        tokens.push('[]');
      } else if (/^-?\d+$/.test(bracketContent)) {
        tokens.push(parseInt(bracketContent, 10));
      } else if (
        (bracketContent.startsWith('"') && bracketContent.endsWith('"')) ||
        (bracketContent.startsWith("'") && bracketContent.endsWith("'"))
      ) {
        tokens.push(bracketContent.slice(1, -1));
      } else {
        tokens.push(bracketContent);
      }
      i = closeIdx + 1;
    } else {
      curr += ch;
      i++;
    }
  }
  if (curr) {
    tokens.push(curr);
  }
  return tokens;
}

function interpolateString(input: unknown, str: string): string {
  let result = '';
  let i = 0;
  while (i < str.length) {
    if (str[i] === '\\' && str[i + 1] === '(') {
      let depth = 1;
      let inQuote = false;
      let quoteChar = '';
      let j = i + 2;
      while (j < str.length && depth > 0) {
        const ch = str[j];
        if (inQuote) {
          if (ch === quoteChar && str[j - 1] !== '\\') {
            inQuote = false;
          }
        } else {
          if (ch === '"' || ch === "'") {
            inQuote = true;
            quoteChar = ch;
          } else if (ch === '(') {
            depth++;
          } else if (ch === ')') {
            depth--;
            if (depth === 0) {
              break;
            }
          }
        }
        j++;
      }
      const expr = str.slice(i + 2, j).trim();
      const res = executeFilter(input, expr);
      result += res === null || res === undefined ? '' : String(res);
      i = j + 1;
    } else {
      result += str[i];
      i++;
    }
  }
  return result;
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
          if (
            sub === kw &&
            (nextChar === undefined || /\s/.test(nextChar)) &&
            (prevChar === undefined || /\s/.test(prevChar))
          ) {
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
      const cleanVal =
        rawVal.startsWith('(') && rawVal.endsWith(')') ? rawVal.slice(1, -1).trim() : rawVal;
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

  // Handle ==, !=, >=, <=, >, <
  const opMatch = trimmed.match(/^(.*?)\s*(==|!=|>=|<=|>|<)\s*(.*)$/);
  if (opMatch) {
    const leftRaw = opMatch[1].trim();
    const op = opMatch[2];
    const rightRaw = opMatch[3].trim();

    const leftVal = resolveValue(input, leftRaw);
    const rightVal = resolveValue(input, rightRaw);

    if (op === '==') return String(leftVal) === String(rightVal);
    if (op === '!=') return String(leftVal) !== String(rightVal);
    if (op === '>') return Number(leftVal) > Number(rightVal);
    if (op === '<') return Number(leftVal) < Number(rightVal);
    if (op === '>=') return Number(leftVal) >= Number(rightVal);
    if (op === '<=') return Number(leftVal) <= Number(rightVal);
  }

  // Check truthiness of a single path e.g. .hasExploit or .hasExploit == true
  const val = resolveValue(input, trimmed);
  return val !== null && val !== undefined && val !== false && val !== 0 && val !== '';
}

function resolveValue(input: unknown, raw: string): unknown {
  const trimmed = raw.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  if (!isNaN(Number(trimmed))) {
    return Number(trimmed);
  }
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;

  return executeFilter(input, trimmed);
}
