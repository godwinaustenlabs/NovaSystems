// ===============================
// File: parser.js (refactored, verbose formatting)
// ===============================
/**
 * Parse and validate NAS JSON output from LLM.
 * Uses 1 runtime variable
 * Use ...parseNAS(output.text) to get a normalized NAS object.
 *
 * @param {string} output - (Runtime parameter) Raw JSON string returned by LLM, make sure to use .text specifier on llm's output
 * @returns {
 *    content: string,
 *    type: "NAS_OUTPUT",
 *    scratchpad: Object||null,
 *    toolRequest: Object|null,
 *    finalAnswer: string|null,
 *    meta: Object|null
 *  } - Normalized NAS result:
 * @throws {Error} If JSON parsing fails or schema is invalid.
 */

export function parseNAS(output) {
  let data;

  try {
    // Attempt parsing raw output
    data = JSON.parse(output);
  } catch (err) {
    // If parsing fails, print a formatted attempt for debugging
    let formatted;
    try {
      formatted = JSON.stringify(
        JSON.parse(output.replace(/\n/g, '')),
        null,
        2
      );
    } catch {
      formatted = output; // fallback: raw
    }

    throw new Error(
      `Invalid NAS JSON output from LLM.\n\nRaw output:\n${formatted}`
    );
  }

  // Validate required structure
  if (
    !data ||
    typeof data !== 'object' ||
    !data.type ||
    data.type !== 'NAS_OUTPUT'
  ) {
    throw new Error(
      `Missing or invalid NAS output structure.\n\nParsed:\n${JSON.stringify(data, null, 2)}`
    );
  }

  // Return in normalized + formatted shape

  return {
    content: data.content || '',
    type: data.type,
    scratchpad: data.scratchpad.content || null,
    toolRequest: data.toolRequest || null,
    finalAnswer: data.finalAnswer || null,
    meta: data.meta || null,
    // _formatted: JSON.stringify(data, null, 2), // <-- for logging/debugging
  };
}
