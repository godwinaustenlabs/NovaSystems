// core/parser.js
export function parseNAS(output) {
  let data;
  try {
    data = JSON.parse(output);
  } catch (err) {
    throw new Error('Invalid NAS JSON output from LLM');
  }

  // Validate required structure
  if (
    !data ||
    typeof data !== 'object' ||
    !data.type ||
    data.type !== 'NAS_OUTPUT'
  ) {
    throw new Error('Missing or invalid NAS output structure');
  }

  return {
    content: data.content || '',
    type: data.type,
    scratchpad: data.scratchpad || null,
    memory: data.memory || null,
    toolRequest: data.toolRequest || null, // tool name + args if LLM wants tool
    finalAnswer: data.finalAnswer || null,
  };
}
