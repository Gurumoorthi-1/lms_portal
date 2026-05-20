/**
 * Utility to normalize and compare coding assessment outputs.
 */
export class OutputFormatter {
  /**
   * Normalizes output by:
   * 1. Taking the last line of the output (to ignore console.log in loops)
   * 2. Removing extra brackets, quotes, and white spaces.
   * 3. Sorting arrays if the content is a JSON array.
   */
  static cleanOutput(output) {
    if (!output) return '';

    const lines = output.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
    let lastLine = lines.length > 0 ? lines[lines.length - 1].trim() : '';
    
    try {
      const parsed = JSON.parse(lastLine);
      return this.stringifyNormalized(parsed);
    } catch (e) {
      return lastLine.replace(/\s+/g, ' ').trim();
    }
  }

  static stringifyNormalized(val) {
    if (Array.isArray(val)) {
      const normalizedArr = val.map(v => this.stringifyNormalized(v));
      normalizedArr.sort();
      return `[${normalizedArr.join(',')}]`;
    }
    if (typeof val === 'object' && val !== null) {
      const keys = Object.keys(val).sort();
      return '{' + keys.map(k => `"${k}":${this.stringifyNormalized(val[k])}`).join(',') + '}';
    }
    if (typeof val === 'string') {
      return `"${val.trim()}"`;
    }
    return String(val);
  }

  static compareOutputs(actual, expected) {
    const normActual = this.cleanOutput(actual);
    const normExpected = this.cleanOutput(expected);
    
    return normActual.trim() === normExpected.trim();
  }
}
