# Code Review To-Dos

Maintained to-do list from code reviews. Completed items are marked ✅ with the
date and a short comment; new noteworthy debt gets a new numbered row.

| # | Status | Item |
|---|--------|------|
| 1 | open | LLM call stage info is stringly typed: `runActionAwarePrompt` encodes the pass in label strings ("Step <name>", "Step <name> replay N", "Action follow-up: …") and `llmCallStageLabel` regex-parses them back for display. Works, but every new pass label must be added in both places or the progress UI silently falls back to the raw label. Consider passing a structured stage object through `llmActiveCallLabel` instead. (2026-07-18, multistep review) |
| 2 | open | Previous-default template migration sets in `promptActions.ts` build their entries from the *current* instruction constants via `.replace(...)`. When a constant is renamed or its text changes, existing set entries silently change meaning and shipped defaults can drop out of the set (this happened to the pre-missing-caption-rule after-reply caption template and was fixed on 2026-07-19). Consider storing previous defaults as literal frozen strings or adding a fixture that pins each shipped default text. (2026-07-19, phone image caption review) |
