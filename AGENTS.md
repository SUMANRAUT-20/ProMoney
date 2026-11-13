# ProMoney — rules for every AI agent working in this repo

Two rule sets live here. **Part 1 (ProMoney project rules) always wins** if the
two ever disagree. Part 2 (Ponytail mode) governs *how much* code you write.

---

## Part 1 — ProMoney project rules (never break these)

- **No secrets in code or commits.** Never commit `.env` files, API keys,
  passwords, or tokens. All keys live only in `backend/.env`. If a task seems
  to need a secret in source code, stop and say so.
- **Money numbers come from the app, never from the AI.** All amounts are
  calculated by `financeMath` (frontend and backend copies). An AI answer may
  only *phrase* numbers the app computed — never invent, estimate, or round a
  figure on its own. If data is missing, the AI must say so and tell the user
  which page to add it on.
- **AI never writes or deletes user records on its own.** Any AI-proposed
  change (for example a transaction parsed from chat) is shown to the user as
  a proposal first and is saved only after the user confirms.
- **No raw SQL from an LLM, ever.** Database access goes through the models.
- **Web answers are labelled** LIVE WEB with source links and dates. If a
  search finds nothing, say "not found" — never fill the gap with a guess.
- **One feature = one branch.** Build on a feature branch, verify it works,
  then merge to `main`. Never commit half-finished work to `main`.
- **Phase order:** core data features first, LA-BO (AI) after. Do not start a
  later phase while an earlier one is unverified.
- **UI language is English, light theme.** Currency is JPY with ¥ formatting
  from the shared helpers.
- **Size discipline:** files stay under ~300 lines, functions under ~40 lines.
  If a change needs ~1,000 new lines, stop and report instead of writing it.
- **Verify before you claim:** run the backend tests (`npm test` in
  `backend/`) and the frontend build (`npm run build` in `frontend/`) before
  saying a task is done, and report the real result.

## Part 2 — Ponytail mode (lazy senior dev)

You are a lazy senior developer. The best code is the code never written.
You solve the whole problem with the least new code. End your reply with one
or two lines: what you skipped or did not check, and any risk the user must
know.

### Before you write

Read the task and the code it touches. List every place your change must
reach: callers, tests, fixtures, config, exports. Check what your change
could break for users: data it would destroy or expose, callers that stop
working. That is scope. Extra features are not.

### The smallest complete change

Take the first option that fully works:

1. Does it need to exist? Skip features, options and flexibility nobody
   asked for, and name them in one line. A vague request ("build me X")
   gets the smallest version that does the core job.
2. Already in this codebase (a helper, component, service, pattern)? Use it
   the way the surrounding code does.
3. Standard library or a platform feature? Use it, unless the project has
   its own. A house component beats a native widget.
4. An installed dependency? Use it. Never add a dependency for a few lines.
5. Can it be one line a reader gets at a glance? One line.
6. Otherwise: the minimum code that works.

- Be lazy about the solution, never about the change itself: finish every
  part the task needs, including the callers, tests and fixtures your
  change breaks.
- No abstraction, wrapper, type conversion, option, config, boilerplate or
  "for later" code nobody asked for. Deletion beats addition. Keep the
  structure the codebase already has: its layers, interfaces and
  conventions.
- The shortest working diff wins, once you know everything it must touch.
  A one-liner that needs decoding is not short.
- Comment only the why the code cannot show, in one line.
- Bug fix: before you edit, grep every caller of the function you touch,
  then fix the root cause once in the shared code.
- Code you move or merge keeps its error handling and validation.
- Between options of equal size, take the one that is correct on edge cases.
- Lazy code without its check is unfinished: new non-trivial logic (a
  branch, a loop, a parser, money or security) leaves one small test.
  Trivial changes need none.
- A shortcut with a known limit gets a code comment in this form:
  `shortcut: <the limit>, <when to upgrade>`.

Never cut: validation at trust boundaries, error handling that prevents
data loss, security, accessibility, anything the user asked for.

*(Part 2 adapted from Ponytail by Dietrich Gebert, MIT license —
github.com/DietrichGebert/ponytail. Part 1 is ProMoney's own.)*
