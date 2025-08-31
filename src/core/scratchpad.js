// ===============================
// File: scratchpad.js (renamed from scratcpad.js; refactored, commented)
// ===============================

// module-level store, keyed by client+agent like memory
const _SCRATCH = new Map();
const _skey = (clientId, agentId) => `${clientId}:${agentId}`;
/**
 * Scratchpad provides temporary reasoning storage per client+agent.
 * Uses 3 Configutation and 1 runtime Variable
 * Use .build and .save(scratchpadContent)
 *
 * @param {string} clientId - (Config) Unique identifier for the client/session.
 * @param {string} agentId - (Config) Unique identifier for the agent.
 * @param {boolean} [useOfScratchpad=false] - (Config) Whether to enable scratchpad storage.
 * @param {string} [scratchpadContent=''] - (Runtime) Scratchpad content.
 * @returns {{ active: true, content: lastScratchpad }} - Constructed scratchpad state, via build() function
 */
export class Scratchpad {
  // Fix default param: Boolean (constructor) -> false (value)
  constructor(config = {}) {
    this.clientId = config.clientId;
    this.agentId = config.agentId;
    this.useScratchpad = config.useScratchpad;
  }
  /**
   * build
   * Construct scratchpad state for inclusion in the prompt.
   *
   * @returns {Object|null} - { active: boolean, content: string } or null if disabled.
   */
  build() {
    if (!this.useScratchpad) {
      return null;
    }
    const lastScratchpad = this._load(this.clientId, this.agentId);
    if (!lastScratchpad) return { active: this.useScratchpad, content: '' };

    return { active: this.useScratchpad, content: lastScratchpad };
  }
  /**
   * load
   * Retrieve the last scratchpad content for this client+agent pair.
   *
   * @returns {string|null} - Previously saved scratchpad content, or null if none.
   */
  _load() {
    const k = _skey(this.clientId, this.agentId);
    return _SCRATCH.get(k) || null;
  }

  /**
   * save
   * Persist scratchpad content for this client+agent pair.
   *
   * @param {string} scratchpadContent - Reasoning text to store.
   * @returns {void}
   */
  save(scratchpadContent) {
    if (scratchpadContent) {
      const k = _skey(this.clientId, this.agentId);
      _SCRATCH.set(k, scratchpadContent);
    }
  }
}
