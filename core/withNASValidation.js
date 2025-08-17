import { validateNASInput, validateNASOutput } from '../utils/validateNAS.js';

/**
 * Wraps an agent or tool logic function with NAS input/output validation
 * Works for both Agents and Tools
 * @param {Function} logicFn - async function that takes NAS input and returns NAS output
 * @returns {Function} - async function with validation before & after logic
 */
export function withNASValidation(logicFn) {
  return async function (requestBody) {
    const id = requestBody?.agent_id || requestBody?.id || 'unknown';

    // Validate NAS Input
    const inCheck = validateNASInput(requestBody);
    if (!inCheck.valid) {
      return {
        status: 'error',
        id,
        error: {
          code: 'INVALID_INPUT',
          message: inCheck.errors,
        },
      };
    }

    // Run the logic
    let output;
    try {
      output = await logicFn(requestBody);
    } catch (err) {
      return {
        status: 'error',
        id,
        error: {
          code: 'LOGIC_ERROR',
          message: err.message || 'Unknown error in logic',
        },
      };
    }

    // Validate NAS Output
    const outCheck = validateNASOutput(output);
    if (!outCheck.valid) {
      return {
        status: 'error',
        id: output?.agent_id || output?.id || id,
        error: {
          code: 'INVALID_OUTPUT',
          message: outCheck.errors,
        },
      };
    }

    return output;
  };
}
