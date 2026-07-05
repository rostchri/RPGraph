import { runtimePortValueKey } from '../shared/portRuntime';
import type { CustomNodeDefinition, CustomNodeElement } from './model';

export type CustomNodeRunResult = {
  outputs: Record<string, string>;
  displays: Record<string, string>;
  state: Record<string, unknown>;
};

export type CustomNodeLlmRequest =
  | string
  | {
      prompt: string;
      label?: string;
      maxTokens?: number;
      temperature?: number;
      images?: boolean | string | string[];
    };

export type CustomNodeLlm = (request: CustomNodeLlmRequest) => Promise<string>;

type CustomNodeHelpers = {
  json: (value: unknown, fallback?: unknown) => unknown;
  number: (value: unknown, fallback?: number) => number;
  text: (value: unknown, fallback?: string) => string;
  clamp: (value: unknown, min: number, max: number) => number;
  words: (value: unknown) => string[];
  lines: (value: unknown) => string[];
  llmJson: (request: CustomNodeLlmRequest, fallback?: unknown) => Promise<unknown>;
};

export async function runCustomNodeDefinition(
  definition: CustomNodeDefinition,
  inputs: Record<string, unknown>,
  options: { llm?: CustomNodeLlm } = {},
): Promise<CustomNodeRunResult> {
  if (!definition.code.trim()) {
    return { outputs: {}, displays: {}, state: definition.state };
  }
  const controls = Object.fromEntries(
    definition.controls.map((control) => [control.id, coerceControlValue(control)]),
  );
  const state = cloneRecord(definition.state);
  const result = await runCustomNodeCode(definition.code, {
    inputs,
    controls,
    state,
    llm: options.llm,
    helpers: createCustomNodeHelpers(options.llm),
  });
  const nextState = result.state && typeof result.state === 'object' && !Array.isArray(result.state)
    ? result.state as Record<string, unknown>
    : definition.state;
  return {
    outputs: stringifyRecord(result.outputs),
    displays: stringifyRecord(result.displays),
    state: nextState,
  };
}

export function inputValuesFromRuntimePorts(
  definition: CustomNodeDefinition,
  runtimePortValues: Record<string, string> | undefined,
) {
  return Object.fromEntries(
    definition.inputs.map((port) => [
      port.id,
      coercePortValue(
        runtimePortValues?.[runtimePortValueKey('input', port.id)] ?? '',
        port.valueType,
      ),
    ]),
  );
}

export function coercePortValue(value: string, valueType: string) {
  if (valueType === 'number') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (valueType === 'boolean') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }
  if (valueType === 'json') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

export function outputRuntimePortValues(
  outputs: Record<string, string>,
  existing: Record<string, string> | undefined,
) {
  return Object.entries(outputs).reduce(
    (next, [handle, value]) => ({
      ...next,
      [runtimePortValueKey('output', handle)]: value,
    }),
    { ...(existing ?? {}) },
  );
}

export function assertAllowedCustomNodeCode(code: string) {
  const forbidden: Array<[string, RegExp]> = [
    ['import', /\bimport\b/],
    ['require', /\brequire\s*\(/],
    ['fetch', /\bfetch\s*\(/],
    ['XMLHttpRequest', /\bXMLHttpRequest\b/],
    ['WebSocket', /\bWebSocket\b/],
    ['EventSource', /\bEventSource\b/],
    ['window', /\bwindow\b/],
    ['document', /\bdocument\b/],
    ['globalThis', /\bglobalThis\b/],
    ['self', /\bself\b/],
    ['process', /\bprocess\b/],
    ['eval', /\beval\s*\(/],
    ['Function', /\bFunction\s*\(/],
    ['constructor', /\bconstructor\b/],
  ];
  const scannable = stripStringsAndComments(code);
  const hit = forbidden.find(([, pattern]) => pattern.test(scannable));
  if (hit) {
    throw new Error(`Custom Node code uses a blocked JavaScript API: ${hit[0]}`);
  }
}

// Removes string literal and comment text so the blocked-API scan only sees real
// code — prompt strings may legitimately contain words like "window" or "process".
// Template literal ${...} expressions are code and stay in the scanned output.
function stripStringsAndComments(code: string): string {
  let result = '';
  let i = 0;

  function skipQuoted(quote: string) {
    i += 1;
    while (i < code.length && code[i] !== quote) {
      i += code[i] === '\\' ? 2 : 1;
    }
    i += 1;
  }

  function skipTemplate() {
    i += 1;
    while (i < code.length && code[i] !== '`') {
      if (code[i] === '\\') {
        i += 2;
        continue;
      }
      if (code[i] === '$' && code[i + 1] === '{') {
        i += 2;
        result += ' ';
        scanCode(true);
        continue;
      }
      i += 1;
    }
    i += 1;
  }

  function scanCode(insideTemplateExpression: boolean) {
    let depth = 0;
    while (i < code.length) {
      const char = code[i];
      const next = code[i + 1];
      if (char === '/' && next === '/') {
        while (i < code.length && code[i] !== '\n') i += 1;
        continue;
      }
      if (char === '/' && next === '*') {
        i += 2;
        while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i += 1;
        i += 2;
        continue;
      }
      if (char === '"' || char === "'") {
        skipQuoted(char);
        result += ' ';
        continue;
      }
      if (char === '`') {
        skipTemplate();
        result += ' ';
        continue;
      }
      if (insideTemplateExpression) {
        if (char === '{') depth += 1;
        if (char === '}') {
          if (depth === 0) {
            i += 1;
            return;
          }
          depth -= 1;
        }
      }
      result += char;
      i += 1;
    }
  }

  scanCode(false);
  return result;
}

export function assertCompilableCustomNodeCode(code: string) {
  assertAllowedCustomNodeCode(code);
  if (!code.trim()) {
    return;
  }
  try {
    compileCustomNodeRunner(code);
  } catch (error) {
    const wrapped = new Error(`Custom Node code does not compile: ${error instanceof Error ? error.message : String(error)}`);
    (wrapped as Error & { cause?: unknown }).cause = error;
    throw wrapped;
  }
}

function coerceControlValue(control: CustomNodeElement) {
  if (control.type === 'checkbox') {
    return Boolean(control.value);
  }
  if (control.type === 'slider') {
    const parsed = Number(control.value ?? control.min ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (control.type === 'number-input') {
    const parsed = Number(control.value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (control.type === 'select' || control.type === 'radio') {
    // Match the card UI, which shows the first option as selected when no value is set.
    const value = typeof control.value === 'string' ? control.value : '';
    return value || control.options?.[0] || '';
  }
  return control.value ?? '';
}

function cloneRecord(value: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function stringifyRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      typeof entry === 'string' ? entry : JSON.stringify(entry),
    ]),
  );
}

type CustomNodeRunner = (
  inputs: Record<string, unknown>,
  controls: Record<string, unknown>,
  state: Record<string, unknown>,
  llm: CustomNodeLlm,
  llmJson: CustomNodeHelpers['llmJson'],
  json: CustomNodeHelpers['json'],
  number: CustomNodeHelpers['number'],
  text: CustomNodeHelpers['text'],
  clamp: CustomNodeHelpers['clamp'],
  words: CustomNodeHelpers['words'],
  lines: CustomNodeHelpers['lines'],
) => Promise<unknown>;

const customNodeRunnerArgs = [
  'inputs',
  'controls',
  'state',
  'llm',
  'llmJson',
  'json',
  'number',
  'text',
  'clamp',
  'words',
  'lines',
] as const;

const customNodeRunnerPrelude =
  '"use strict";\n' +
  'const window = undefined, document = undefined, globalThis = undefined, self = undefined, fetch = undefined, XMLHttpRequest = undefined, WebSocket = undefined, EventSource = undefined, require = undefined, process = undefined;\n';

function compileCustomNodeRunner(code: string): CustomNodeRunner {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as FunctionConstructor;
  return new AsyncFunction(...customNodeRunnerArgs, customNodeRunnerPrelude + code) as CustomNodeRunner;
}

async function runCustomNodeCode(
  code: string,
  args: {
    inputs: Record<string, unknown>;
    controls: Record<string, unknown>;
    state: Record<string, unknown>;
    llm?: CustomNodeLlm;
    helpers: CustomNodeHelpers;
  },
) {
  assertAllowedCustomNodeCode(code);
  const runner = compileCustomNodeRunner(code);
  const llm = args.llm ?? (async () => {
    throw new Error('Custom Node LLM helper is not available in this run.');
  });
  const result = await runner(
    args.inputs,
    args.controls,
    args.state,
    llm,
    args.helpers.llmJson,
    args.helpers.json,
    args.helpers.number,
    args.helpers.text,
    args.helpers.clamp,
    args.helpers.words,
    args.helpers.lines,
  );
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('Custom Node code must return an object.');
  }
  return result as {
    outputs?: unknown;
    displays?: unknown;
    state?: unknown;
  };
}

function createCustomNodeHelpers(llm: CustomNodeLlm | undefined): CustomNodeHelpers {
  const json = (value: unknown, fallback: unknown = null) => {
    if (typeof value !== 'string') {
      return value ?? fallback;
    }
    try {
      return JSON.parse(stripJsonFence(value));
    } catch {
      const objectMatch = value.match(/\{[\s\S]*\}/);
      const arrayMatch = value.match(/\[[\s\S]*\]/);
      const candidate = objectMatch?.[0] ?? arrayMatch?.[0];
      if (candidate) {
        try {
          return JSON.parse(candidate);
        } catch {
          return fallback;
        }
      }
      return fallback;
    }
  };
  const number = (value: unknown, fallback = 0) => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const text = (value: unknown, fallback = '') => {
    if (value === undefined || value === null) {
      return fallback;
    }
    return typeof value === 'string' ? value : JSON.stringify(value);
  };
  const clamp = (value: unknown, min: number, max: number) => Math.min(max, Math.max(min, number(value, min)));
  const words = (value: unknown) => text(value).trim().split(/\s+/).filter(Boolean);
  const lines = (value: unknown) => text(value).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const llmJson = async (request: CustomNodeLlmRequest, fallback: unknown = null) => {
    if (!llm) {
      throw new Error('Custom Node LLM helper is not available in this run.');
    }
    const normalized = typeof request === 'string'
      ? { prompt: request }
      : request;
    const response = await llm({
      ...normalized,
      prompt: [
        normalized.prompt,
        '',
        'Return valid JSON only. Do not include markdown, prose, or code fences.',
      ].join('\n'),
    });
    return json(response, fallback);
  };
  return { json, number, text, clamp, words, lines, llmJson };
}

function stripJsonFence(text: string) {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fenced ? fenced[1].trim() : trimmed;
}
