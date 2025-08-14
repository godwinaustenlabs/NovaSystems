import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import inputSchema from '../nas_schemas/nas-input.schema.json' with { type: 'json' };
import outputSchema from '../nas_schemas/nas-output.schema.json' with { type: 'json' };

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const validateInput = ajv.compile(inputSchema);
const validateOutput = ajv.compile(outputSchema);

/**
 * Validate incoming data against NAS Input Schema
 * @param {Object} data - JSON object to validate
 * @returns {Object} - { valid: boolean, errors: array }
 */
export function validateNASInput(data) {
  const valid = validateInput(data);
  return {
    valid,
    errors: valid ? [] : validateInput.errors,
  };
}

/**
 * Validate outgoing data against NAS Output Schema
 * @param {Object} data - JSON object to validate
 * @returns {Object} - { valid: boolean, errors: array }
 */
export function validateNASOutput(data) {
  const valid = validateOutput(data);
  return {
    valid,
    errors: valid ? [] : validateOutput.errors,
  };
}
