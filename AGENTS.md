## Skills

- Use `$qcm-fiche-linking` for phase 1 question to fiche work.
- Use `$qcm-linking-orchestrator` to run phase 1 linking across `cr`, `csp`, and `naturalisation` in parallel, one worker per source, with automatic batch handoff.
- Use `$qcm-answer-batch20` for phase 2 answer drafting work.
- Use `$qcm-answer-orchestrator` to run phase 2 answer drafting across `cr`, `csp`, and `naturalisation` in parallel, one worker per source, with automatic batch handoff.
- Use `$qcm-batch-pool-review` only for manual correction or adjudication of existing answer pools.

## QCM Workflow

- Shared state file: `data-init/suggestions/qcm-workflow-state.json`
- Refresh the state before QCM work:

```bash
node scripts/sync-qcm-workflow-state.mjs
```

- Do not update `data-init/question-bank.json` during linking or drafting unless the user explicitly asks for apply.
- After apply, validate the bank, then bundle runtime data for the frontend.
