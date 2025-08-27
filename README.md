# **Nova Framework --- Full technical evaluation & detailed developer documentation**

Below is a clean, developer-oriented analysis and exhaustive documentation of the framework.

# **Table of contents**

1.  Module-by-module: responsibilities, config vs runtime, return types

2.  Data contracts (NAS schema)

3.  Pipeline flow (step-by-step with data at each step)

4.  Memory subsystem deep dive: buffer vs summary vs dynamic (nitty-gritty)

5.  Scratchpad: role and usage patterns

6.  PromptBuilder: what it must include and why

7.  ChatLLM: provider adapter expectations & token accounting

8.  Parser & Validation: how to use and failure modes

9.  How to run without the Pipeline (manual assembly) --- step-by-step code patterns

10. Reliability, security, and operational recommendations

11. Quick checklist & prioritized next tasks

---

## **1 --- Module-by-module (detailed)**

> For each file: short purpose, *constructor config*, *runtime call(s)*, returned values, and important behavioral notes.

### **ChatLLM**

**Purpose:** uniform interface to different chat LLM providers (currently Groq implemented).

**Constructor (config):**

- provider --- 'groq'|'anthropic'|'gemini'|'openai' (string)

- model --- provider model ID (string)

- api_key --- provider API key (string)

- temperature --- default sampling temp (number, default 0.7)

- maxOutputTokens --- default maximum output tokens (number, default 1024)

- estCharsPerToken --- heuristic (number, default 4)

- verbose --- log I/O (boolean, default false)

**Runtime call:**

- await chat(userInput, options)
  - userInput = { system: string, user: string }

  - options optional overrides { temperature?, maxOutputTokens?, verbose? }

**Returns:** an object (in current code):

- { text, tokensUsed, raw? }
  - text: extracted content (falls back to several fields)

  - tokensUsed: vendor usage.total_tokens or estimate

  - raw: raw provider response

---

### **Memory**

### Facade & strategies

**Purpose:** central router for conversation persistence; provides multiple strategies.

**Memory facade constructor config:**

- clientId (string), agentId (string)

- memoryType --- 'buffer'|'summary'|'dynamic'|'kv'|'vector'|'nomemory' (string)

- limitTurns --- number: how many turns to keep before summary/trim

- summarizer --- { temperature, maxOutputTokens, totalTokenBudget, reserveForOutput, provider?, model?, api_key? }

- provider --- either LLM/DB handle or provider name (usage varies)

- api_key, model --- used by summarizer LLM if summary/dynamic

**Main runtime methods (facade):**

- await load() → { turns: [{role,content}], summary: string }

- await save(turnOrTurns) → returns tokensUsedByMemory (if summarization ran) or 0

**Strategy implementations**

- NoMemory --- load() → empty; save() no-op.

- BufferMemory(limitTurns) --- in-process Map keyed by clientId:agentId. Keeps last limitTurns turns. save()appends and trims.

- SummaryMemory(summarizerCfg, limitTurns, provider, model, api_key) --- inherits buffer. When turns.length >= limitTurns, it:
  1.  Builds summarizer prompt (system + user) which includes previous summary.

  2.  Calls ChatLLM with summarizer config.

  3.  Stores data.summary = res.text and trims data.turns = last 2.

  4.  Returns { data, tokensUsedByMemory: res.tokensUsed }.

- DynamicMemory --- token budget aware:
  - holds memoryBudgetTokens = totalTokenBudget - reserveForOutput.

  - buildContextMessages() composes [{ role: 'system', content: summary}, ...recentTurns] until token budget is reached (using estimateTokens).

  - saveAndMaybeSummarize() triggers summarization when approximate token use > 95% budget.

- KVMemoryExternal --- requires injected provider with .get(key)/.set(key,val).

- VectorMemory --- requires provider.getContext(clientId,agentId) and provider.insert(...).

**Important nitty-gritty:**

- Summaries keep last **2** turns for recency; this is a design choice (tuneable).

- Summarizer prompt content emphasizes "very concise" and "don't lose info" --- tradeoff: compressiveness vs fidelity.

- save() in facade returns tokens used only when summarizer ran; callers should handle undefined safely.

---

### **Scratchpad**

**Purpose:** ephemeral chain-of-thought store (per client+agent).

**Constructor config:**

- clientId, agentId, useScratchpad (boolean)

**Runtime:**

- build() → null if disabled, else { active: boolean, content: string }

- save(scratchpadContent) → persist string to in-process Map keyed by clientId:agentId

**Notes:**

- Not durable across process restarts.

- Valuable for passing previous reasoning into the LLM without making it part of the persistent memory.

- Pipeline saves parsed.scratchpad back each turn --- LLM can continue reasoning next turn.

---

### **PromptBuilder**

**Purpose:** craft the LLM prompt in NAS style: a system message (schema + rules + systemContext) and a user message (NAS_PROMPT JSON with user text and scratchpad).

**Constructor config:**

- systemPrompt (string): additional synchronous instruction embedded in rules

- useScratchPad (bool)

- tools (object): available tool descriptors

- lastToolResponse (optional): previous result to make context

**Runtime:**

- await build(userPrompt, memoryContext, scratchpad) → { system: string, user: string }

**System content includes:**

- NAS_SCHEMA example

- Rules 0.1--0.7 (enforce JSON, use scratchpad, etc.)

- System Context JSON: tools, lastToolResponse, memory (turns & summary)

**Why this matters:**

- Separates policy/constraints (system role) from user intent (user role).

- Provides tools and memory context in structured form so model can make toolRequest decisions.

---

### **parseNAS**

**Purpose:** Convert raw LLM output (string) to structured NAS object and validate essential shape.

**Runtime:**

- parseNAS(outputText: string):
  - Attempt JSON.parse(outputText).

  - On parse failure, try sanitizing newlines and reparse; if still fails throw an error with formatted raw text for debugging.

  - Enforce data.type === 'NAS_OUTPUT' and return normalized object:

    { content, type, scratchpad, toolRequest, finalAnswer, meta }

**Failure modes & handling:**

- Throwing here breaks pipeline --- pipeline should catch and surface helpful error info to caller.

- Use parser errors to trigger re-prompting strategies (e.g., ask model to re-output valid JSON).

---

### **withNASValidation**

**Purpose:** wrapper that validates inbound NAS input and outbound NAS output using external validators validateNASInput and validateNASOutput.

**Usage:**

```
const safeHandler = withNASValidation(requestBody, async (req) => agentLogic(req));
const result = await safeHandler();
```

**Behavior:**

- Return standardized error objects for invalid input, logic errors, or invalid outputs.

---

### **Pipeline**

**Purpose:** The default orchestrator that wires everything into a consistent runtime flow.

**Constructor config:**

- Identity: clientId, agentId

- LLM config: provider, model, api_key, temperature, maxOutputTokens, estCharsPerToken, verbose

- Prompting: systemPrompt, tools, lastToolResponse, useScratchPad

- Memory: memoryType, limitTurns, summarizer (see memory)

- toolRunner?: (name, args) => Promise<any> optional

- outputType: 'parsed'|'raw'|'text' (defaults to parsed)

**run() behavior (step summary):**

1.  memory.load() → memoryCtx

2.  scratchpad.build() → scratch

3.  promptBuilder.build(userPrompt, memoryCtx, scratch)

4.  llm.chat(prompt) → response

5.  parseNAS(response.text) → parsed

6.  scratchpad.save(parsed.scratchpad) (string or parsed.scratchpad.content)

7.  memory.save([...]) → returns {actualTokensUsed: number} if summarizer triggered directly and {actualTokensUsed: number, estimatedTokensUsed: number} if triggered dynamically \*(see section 4).

8.  If parsed.toolRequest & toolRunner → call tool & attach parsed.toolResponse

9.  Return text | raw | parsed shape which includes token usage + memory snapshot

**Return (parsed):**

- parsed (NAS object) plus:
  - tokenUsage: response.tokensUsed

  - tokensUsedByMemory

  - turns, summary (from memory snapshot)

---

## **2 --- NAS Schema (operational contract)**

- **type** must be "NAS_OUTPUT" --- parser enforces this.

- **content** --- human readable content (string).

- **scratchpad** --- string or object holding reasoning; pipeline persists this back to scratchpad store.

- **toolRequest** --- optional, if model wants to call a tool:
  - { id, name, args, mode: 'sync|async', callback? }

- **finalAnswer** --- optional final human-facing answer

- **meta** --- { traceId, timestamp } recommended

Make sure your LLM prompt forces the JSON shape exactly --- otherwise parser throws error (Logic already baked into promptBuilder).

---

## **3 --- Pipeline data flow (detailed, with shapes)**

**Input:** config + userPrompt

**Memory.ctx**: { turns: [{role,content}], summary: string }

**Scratchpad**: { active: bool, content: string } | null

**PromptBuilder output**:

```
{
  system: "NAS_SCHEMA: {...}\nRULES...\nSystem Context:\n{ tools:..., memory: { turns:..., summary:... } }",
  user: "{ \"type\":\"NAS_PROMPT\", \"user\":\"<userPrompt>\", \"scratchpad\":{...} }"
}
```

**LLM response (text)** → parseNAS → parsed object

**update steps:**

- scratchpad.save(parsed.scratchpad)

- memory.save([{role:'user', content: userPrompt},{role:'assistant', content: parsed.content }])

- if parsed.toolRequest → run tool and attach parsed.toolResponse

**Output**: depends on outputType --- commonly the parsed NAS object enriched with token usage + memory snapshot.

---

## **4 --- Memory subsystem: buffer vs summary vs dynamic (exhaustive)**

### **BufferMemory (exact behavior)**

- **Store:** Array turns of {role,content}

- **Retention:** Keep last limitTurns (e.g., limitTurns = 3).

- **When to use:** When you want raw, uncompressed context for a short conversation. No LLM cost. Fast and predictable.

- **Tradeoffs:** No long-term retention; older facts vanish.

### **SummaryMemory (exact behavior)**

- **Trigger:** When turns.length >= limitTurns.

- **Summary prompt construction:**
  - System: "You compress conversation into a very, very concise factual summary..."

  - User: Summarize this:\n<concat_of_turns>\n\nKeep under X words including previous summary's context "<previous summary>" ...

- **Action:**
  1.  Call LLM summarizer (configurable provider, model, api_key, temperature, maxOutputTokens).

  2.  Set data.summary = res.text.

  3.  Set data.turns = data.turns.slice(-2) (keep last 2 turns).

  4.  Return tokensUsedByMemory = res.tokensUsed.

- **What this achieves:**
  - Keeps a compressed long-term memory string (summary) that preserves key facts.

  - Maintains recency via last 2 turns.

- **Risks & pitfalls:**
  - Summaries can hallucinate or omit details; prompt engineering matters.

  - Summarization cost (LLM calls) must be tracked.

### **DynamicMemory (exact behavior)**

- **Goal:** maximize useful context under a hard token budget.

- **Config keys:** summarizer.totalTokenBudget and reserveForOutput.

- **Memory budget rule:** memoryBudgetTokens = totalTokenBudget - reserveForOutput.

- **Composition algorithm:**
  - Start with used = estimateTokens(summary) (if summary exists); add summary as system message.

  - Iterate recent turns from newest to oldest, compute tokens = estimateTokens(turn.content).

  - If used + tokens > memoryBudgetTokens → stop (do not include older turns).

  - Build messages array containing the summary (if present) and a selection of most-recent turns that fit.

- **Maintenance:** saveAndMaybeSummarize() triggers summarizeIfNeededForDynamic() when approximate token usage > 95% of memoryBudgetTokens.

- **When to use:** long-running sessions where token budget matters (e.g., multi-hour chatbots, or pipelines where outputs + memory must stay under model limits).

- **Tricky details:**
  - Token estimator must be accurate: using a char/4 heuristic is rough; for robust operation use model tokenizers.

  - The decision threshold (95%) is tunable.

  - Summarizer must preserve essential facts reliably; include previous summary in the summarizer prompt.

---

## **5 --- Scratchpad: behavior and patterns**

- **Purpose:** Carry the model's internal reasoning between turns without bloating the main memory.

- **Size & exposure:** Keep it concise; not a log of every micro-thought but a compact chain-of-thought hint.

- **Read & write flow (typical):**
  - Pipeline: scratchpad.build() gives previous scratch (if any). PromptBuilder includes it in the user message.

  - LLM writes an updated scratchpad as part of the NAS output.

  - Pipeline persists parsed.scratchpad into the scratchpad store for next turn.

- **Use cases:**
  - When model needs multi-step internal reasoning across a short sequence of prompts.

  - When you want to trace model chain-of-thought for debugging or to re-insert thoughts into a different model.

---

## **6 --- PromptBuilder: what must be present & why**

**Must-haves in system role:**

- Explicit NAS_SCHEMA example so the model can exactly match the keys/types.

- Firm rule: output JSON only.

- System Context: memory, tools, and last tool outputs.

**User role composition:**

- NAS_PROMPT object with user string and scratchpad.

**Design tips**

- Keep system role short and prescriptive to reduce hallucination.

- Make tool descriptions short precise natural-language sentences; provide example toolRequest if you want the model to call them.

- When memory is long, consider having the PromptBuilder call DynamicMemory.buildContextMessages() and pass those messages directly instead of the full memory.

---

## **7 --- ChatLLM & token accounting expectations**

- **Public contract:** chat({ system, user }, options) => { text, tokensUsed, raw }.

- **Provider adapter tasks:**
  - Translate input to provider payload (messages vs prompt).

  - Handle streaming vs batch responses.

  - Extract text reliably (choices[0].message.content, choices[0].delta, etc.).

  - Map provider token usage into tokensUsed.

- **Tokens & cost**
  - Use vendor usage fields when available.

  - For summaries and dynamic memory, persist and return tokensUsedByMemory so you can attribute cost to memory maintenance.

---

## **8 --- Parser & Validation (practical)**

- **Parser (parseNAS)**
  - Must throw helpful errors on invalid JSON (include raw snippet).

  - If parse fails often, implement a re-prompt strategy: send model the invalid output and ask for corrected JSON.

- **Validation (withNASValidation)**
  - Wrap external endpoints with this to reject invalid inbound requests early.

  - Wrap agents/tools to ensure outputs match expected NAS schema.

---

## **9 --- How to build an agent without the Pipeline (practical manual assembly)**

**Why do this?** Research, debugging, custom control, complex tool orchestration.

**Minimal manual wiring (pattern)**

1.  **Init components**

```
const memory = new Memory({ clientId, agentId, memoryType, limitTurns, summarizer, provider, api_key, model });
const scratchpad = new Scratchpad({ clientId, agentId, useScratchpad: true });
const promptBuilder = new PromptBuilder({ systemPrompt, tools, lastToolResponse, useScratchPad: true });
const llm = new ChatLLM({ provider, model, api_key, temperature, maxOutputTokens, estCharsPerToken });
```

2.  **Load context**

```
const memoryCtx = await memory.load();         // { turns, summary }
const scratch = scratchpad.build();            // {active, content} | null
```

3.  **Build prompt**

```
const prompt = await promptBuilder.build(userPrompt, memoryCtx, scratch);
// prompt.system, prompt.user are strings
```

4.  **Call LLM**

```
const response = await llm.chat(prompt, {});
// response.text, response.tokensUsed, response.raw
```

5.  **Parse & validate**

```
const parsed = parseNAS(response.text);  // throws if invalid
// optionally: withNASValidation(request, () => parsed)...
```

6.  **Persist**

```
scratchpad.save(typeof parsed.scratchpad === 'string' ? parsed.scratchpad : (parsed.scratchpad?.content ?? ''));
await memory.save([{ role: 'user', content: userPrompt }, { role: 'assistant', content: parsed.content }]);
```

7.  **Handle tools manually**

```
if (parsed.toolRequest) {
  const toolRes = await myToolRunner(parsed.toolRequest.name, parsed.toolRequest.args);
  // decide: re-prompt LLM with tool results or return to user
}
```

8.  **Return final result to caller**

    Decide whether to return parsed, response.text, or raw, and include tokensUsed and memory snapshot if you need observability.

**Notes for manual assembly**

- You can mix and match: use Memory from the framework, but your own PromptBuilder.

- When doing custom tool orchestration, prefer to re-prompt the LLM with tool result inserted into lastToolResponse and/or system context, then llm.chat() again --- this keeps NAS output shape consistent.

---
