/**
 * The only file in this project that talks to the network.
 *
 * R2 says Claude calls live in `agents/` and the full test suite passes with no
 * network. Both hold because every module that needs a model takes the caller
 * as an argument — `grader.js` holds the judgement and this holds the socket.
 * Nothing imports this except the code that actually wires up a live game, so
 * `npm test` never loads it and never needs the SDK installed.
 *
 * WHY THE CLIENT IS BUILT LAZILY
 *
 * Constructing it resolves credentials, and most things that import this module
 * never call it — a game played entirely against rule-based policies needs no
 * key at all. Deferring construction to the first call means an unconfigured
 * machine fails only when it actually asks for a model, and never at import.
 */

import Anthropic from '@anthropic-ai/sdk';

/** Anthropic's most capable widely-available model. */
const DEFAULT_MODEL = 'claude-opus-5';

let instance = null;

/**
 * One client, built on first use and reused.
 *
 * The zero-argument constructor resolves credentials itself — ANTHROPIC_API_KEY,
 * then ANTHROPIC_AUTH_TOKEN, then an `ant auth login` profile — so an unset key
 * does not mean unauthenticated, and this does not second-guess it.
 */
function client() {
  if (!instance) instance = new Anthropic();
  return instance;
}

/**
 * A `callModel` function, in the shape `grader.js` and `llmPolicy.js` expect.
 *
 * Takes a fully-formed request and returns the response. It adds nothing and
 * decides nothing: the module that built the request owns the model choice, the
 * tools and the prompt, and this owns only the transport. That split is what
 * keeps every prompt in this project reviewable as data and testable offline.
 *
 * @param {object} [options]
 * @param {string} [options.model] overrides whatever the request names
 * @returns {(request: object) => Promise<object>}
 */
export function claudeCaller({ model } = {}) {
  return async function callModel(request) {
    return client().messages.create({
      model: DEFAULT_MODEL,
      ...request,
      ...(model ? { model } : {}),
    });
  };
}

export { DEFAULT_MODEL };
