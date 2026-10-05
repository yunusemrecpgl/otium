import type { FormulaVariable } from '../domain/formula';

const functions = new Map<string, { arity: number; run: (...values: number[]) => number }>([
  ['sqrt', { arity: 1, run: value => { if (value < 0) throw new Error('Square root requires a non-negative value.'); return Math.sqrt(value); } }],
  ['pow', { arity: 2, run: (value, exponent) => Math.pow(value, exponent) }],
  ['log', { arity: 1, run: value => { if (value <= 0) throw new Error('Log requires a positive value.'); return Math.log(value); } }],
  ['mod', { arity: 2, run: (value, divisor) => { if (divisor === 0) throw new Error('Cannot take modulo by zero.'); return value % divisor; } }],
]);

// Recursive descent over an explicit arithmetic/function grammar; no executable expressions.
export function evaluateFormula(expression: string, variables: FormulaVariable[]): string {
  if (!expression.trim()) throw new Error('Enter an expression.');
  if (expression.length > 4096) throw new Error('Expression is too long.');
  const values = new Map<string, number>();
  for (const variable of variables) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(variable.name)) throw new Error('Use letters, numbers and underscores; start with a letter or underscore.');
    if (values.has(variable.name)) throw new Error('Variable names must be unique.');
    if (!Number.isFinite(variable.value)) throw new Error('Enter a valid numeric value.');
    values.set(variable.name, variable.value);
  }
  let position = 0, depth = 0;
  const skip = () => { while (/\s/.test(expression[position] ?? '') && position < expression.length) position++; };
  const take = (symbol: string) => { skip(); if (expression[position] !== symbol) return false; position++; return true; };
  const finite = (value: number) => { if (!Number.isFinite(value)) throw new Error('Result is outside the supported numeric range.'); return value; };
  function primary(): number {
    if (++depth > 100) throw new Error('Expression is too deeply nested.');
    try {
      if (take('+')) return primary();
      if (take('-')) return -primary();
      if (take('(')) {
        const value = sum();
        if (!take(')')) throw new Error('Check expression parentheses.');
        return value;
      }
      skip();
      const remaining = expression.slice(position);
      const number = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(remaining);
      if (number) { position += number[0].length; return finite(Number(number[0])); }
      const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(remaining);
      if (name) {
        position += name[0].length;
        if (take('(')) {
          const operation = functions.get(name[0]);
          if (!operation) throw new Error('Unsupported function.');
          const args: number[] = [];
          if (!take(')')) {
            do {
              if (args.length >= operation.arity) throw new Error('Too many function arguments.');
              args.push(sum());
            } while (take(','));
            if (!take(')')) throw new Error('Check function parentheses.');
          }
          if (args.length !== operation.arity) throw new Error('Check function arguments.');
          return finite(operation.run(...args));
        }
        const value = values.get(name[0]);
        if (value === undefined) throw new Error('Unknown variable.');
        return value;
      }
      throw new Error('Invalid arithmetic expression.');
    } finally { depth--; }
  }
  function product(): number {
    let value = primary();
    while (true) {
      if (take('*')) value = finite(value * primary());
      else if (take('/')) {
        const divisor = primary();
        if (divisor === 0) throw new Error('Cannot divide by zero.');
        value = finite(value / divisor);
      } else return value;
    }
  }
  function sum(): number {
    let value = product();
    while (true) {
      if (take('+')) value = finite(value + product());
      else if (take('-')) value = finite(value - product());
      else return value;
    }
  }
  const result = sum(); skip();
  if (position !== expression.length) throw new Error('Invalid arithmetic expression.');
  return String(Number(result.toPrecision(12)));
}
