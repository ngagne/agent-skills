---
name: skill-creator
description: Create, revise, and evaluate skills. Use this skill to scope before drafting, update a skill safely, run or improve evals, compare a candidate against a baseline, or optimize description triggering. Confirm scope explicitly before drafting or revising.
metadata:
  version: "2.0.5"
---

# Skill Creator

Create new skills and improve existing ones.

Follow the workflow below in order. The default behavior is to complete the full loop: scope, write or revise the skill, validate it, create evals, run evals, review results, improve if needed, then deliver. Do not stop after creating `SKILL.md`. Do not stop after creating `evals/evals.json`. Only stop early if the user explicitly opts out or the runtime cannot do the next step.

## Non-negotiable rules

1. Start with scope, not drafting.
2. Ask at most one unresolved design question at a time.
3. Inspect existing files before accepting claims about current behavior.
4. After writing the skill, immediately validate it.
5. After creating evals, immediately execute them unless the user explicitly says not to.
6. If execution is blocked, say exactly what blocked it and what artifacts you already prepared.
7. Do not claim completion until the current requested phase is actually done.

## Terms

- **user** - the human requesting the work
- **agent** - the model using this skill
- **skill** - the target skill folder being created or updated
- **candidate** - the current version being tested
- **baseline** - the comparison version: usually `without_skill` for a new skill or `old_skill` for an update
- **scope contract** - the structured agreement about what the skill should and should not do
- **expectations** - machine-checkable statements used for grading

## Available scripts

Use relative paths from this skill directory root.

- **`scripts/quick_validate.py`** — validates a target skill's `SKILL.md` frontmatter against this repository's local contract
- **`scripts/run_eval.py`** — runs trigger evals for a skill description against a trigger-eval set
- **`scripts/improve_description.py`** — proposes a revised description from trigger-eval results
- **`scripts/run_loop.py`** — runs the full trigger-description optimization loop
- **`scripts/generate_report.py`** — renders a static HTML report from trigger-optimization results
- **`scripts/aggregate_benchmark.py`** — aggregates graded run results into benchmark summaries and deltas
- **`eval-viewer/generate_review.py`** — builds the eval review UI for human review
- **`scripts/copilot_helper.py`** — shared Copilot helper-agent utilities used by the other scripts
- **`scripts/utils.py`** — shared parsing and utility helpers used by the other scripts

## Step-by-step workflow

### Step 1: Identify the job

First decide which of these you are doing:

1. create a new skill
2. update an existing skill
3. repair or continue an eval loop
4. compare a candidate against a baseline
5. optimize a skill description for trigger behavior

Then move to the next step. Do not skip ahead to drafting until scope is confirmed.

### Step 2: Inspect the current state

If the answer might already exist in the skill files, scripts, evals, or workspace artifacts, inspect those first.

For existing skills:

1. read the current `SKILL.md`
2. inspect bundled scripts, references, and assets only as needed
3. identify behavior that must be preserved
4. identify behavior that may change
5. identify unacceptable regressions

If the user's description of current behavior conflicts with the files, surface the contradiction and resolve it before continuing.

### Step 3: Build the scope contract

Do not draft or revise the skill until the scope contract is complete and confirmed.

Track these fields in conversation:

- `goal`
- `problem_statement`
- `in_scope`
- `out_of_scope`
- `primary_user_prompts`
- `expected_outputs`
- `authoring_runtime`
- `eval_backend`
- `success_criteria`
- `open_questions`
- `decision_log`

For updates, also track:

- behavior that must be preserved
- behavior that may change
- unacceptable regressions

When you need clarification, ask exactly one unresolved question at a time. Each question must include:

1. **Decision** - what choice is being made
2. **Recommended answer** - your best default
3. **Rationale** - why that default is reasonable

Before editing the target skill, present the full scope contract and get confirmation.

### Step 4: Write or revise the skill

Once scope is confirmed, write or revise the target skill.

Use this directory shape:

```text
skill-name/
├── SKILL.md
├── scripts/
├── references/
├── assets/
└── ...
```

Apply these frontmatter rules:

- required keys: `name`, `description`, `metadata.version`
- allowed top-level keys: `name`, `description`, `metadata`
- no extra top-level keys
- `name` must exactly match the parent directory name
- `name` must use lowercase letters, numbers, and single hyphens only
- `description` must be 1-1024 characters and explain what the skill does and when to use it
- `metadata` must be a string-to-string mapping and include `version`

Use this minimal pattern:

```yaml
---
name: example-skill
description: Explain what the skill does and when to use it.
metadata:
  version: "1.0.0"
---
```

Versioning rules:

- new skill -> start at `"1.0.0"`
- patch -> fixes, wording improvements, behavior-preserving clarifications
- minor -> backward-compatible capability additions or workflow expansions
- major -> intentionally breaking or significantly narrowing behavior

Writing rules:

- prefer imperative instructions
- explain why a step matters when that helps the agent make better choices
- focus on user intent, not one brittle example
- keep `SKILL.md` under 500 lines and preferably under 5000 tokens
- move overflow detail into `references/`, `scripts/`, or `assets/`
- use relative paths from the skill root
- if the target skill bundles scripts, list them explicitly in its `SKILL.md`

Important: writing the skill is not completion. Continue directly to validation.

### Step 5: Validate the skill

Run the validator before doing anything else:

```bash
python3 scripts/quick_validate.py <skill-dir>
```

Fix every violation before moving on. A skill that fails validation is not ready for evals or delivery.

### Step 6: Create evals

After validation, create the evals immediately.

Default requirements:

1. create 2-3 realistic prompts that sound like real user requests
2. make them representative of the agreed scope
3. avoid toy prompts unless the skill itself is trivial
4. save them to `evals/evals.json`
5. start with prompts and expected outputs
6. add `expectations` once the eval shape is clear

Use this structure:

```json
{
  "skill_name": "example-skill",
  "evals": [
    {
      "id": 1,
      "prompt": "User's task prompt",
      "expected_output": "Description of the expected result",
      "files": [],
      "expectations": []
    }
  ]
}
```

Show the prompts to the user before running them, but do not treat that as completion. The default next step is to run them.

### Step 7: Execute the evals

This step is mandatory by default. After creating evals, run them. Do not stop after `evals/evals.json` exists.

Use this workspace layout beside the target skill directory:

```text
<skill-name>-workspace/
└── iteration-1/
    └── eval-<id>/
        ├── eval_metadata.json
        ├── with_skill/
        │   └── run-1/
        │       └── outputs/
        └── without_skill/ or old_skill/
            └── run-1/
                └── outputs/
```

Even if you run each configuration only once, still create `run-1/`. That is the default layout for this workflow and the one you should produce. `scripts/aggregate_benchmark.py` also accepts a direct `with_skill/outputs/` layout for backward compatibility, but do not use that as your normal output shape.

Execution rules:

1. run the **candidate** skill for every eval
2. run the **baseline** too when a baseline is part of the task
3. if helper agents are available, run candidate and baseline in the same evaluation wave
4. if helper agents are unavailable, run them serially
5. preserve the same directory layout either way

Use these names for compatibility:

- `with_skill/run-1/outputs/` for the candidate
- `without_skill/run-1/outputs/` for a new-skill baseline
- `old_skill/run-1/outputs/` for an update baseline

For each eval, write `eval_metadata.json`:

```json
{
  "eval_id": 0,
  "eval_name": "descriptive-name-here",
  "prompt": "The user's task prompt",
  "expectations": []
}
```

While runs are in progress:

1. draft quantitative expectations
2. prefer expectations that are objectively verifiable
3. use descriptive expectation text
4. avoid expectations that pass on surface-level compliance alone
5. update `eval_metadata.json` and `evals/evals.json` once the expectations are ready

If timing data is available at helper-agent completion time, save it to `timing.json`. If timing is unavailable, leave it absent.

If the runtime truly cannot run the evals, say so explicitly. Do not pretend they ran.

### Step 8: Grade and review the results

Once the runs finish:

1. grade each run with `agents/grader.md`
2. save grading output to `grading.json`
3. make sure each graded expectation has `text`, `passed`, and `evidence`
4. aggregate the iteration with:

```bash
python3 scripts/aggregate_benchmark.py <workspace>/iteration-N \
  --skill-name <skill-name> \
  --skill-path <path-to-skill>
```

5. treat the console summary from `aggregate_benchmark.py` as a quick summary only, not as the final review artifact
6. do an analyst pass using `agents/analyzer.md`
7. build the HTML review UI. Use one of these:

```bash
python3 eval-viewer/generate_review.py <workspace>/iteration-N \
  --skill-name <skill-name> \
  --benchmark <workspace>/iteration-N/benchmark.json
```

```bash
python3 eval-viewer/generate_review.py <workspace>/iteration-N \
  --skill-name <skill-name> \
  --benchmark <workspace>/iteration-N/benchmark.json \
  --static <workspace>/iteration-N/review.html
```

8. when the runtime can open a browser, launch the live viewer so the review page opens in a browser
9. when the runtime is headless or browser launch fails, generate the static HTML file and tell the user its path
10. tell the user what to review: outputs, grades, HTML review page, and benchmark if present

If the runtime can open a browser, the reviewer may run as a live local app. In headless runtimes, generate static output instead.

### Step 9: Read feedback and improve

After review:

1. read `feedback.json` if it exists
2. read the user's direct feedback too
3. improve only where there is concrete negative feedback or clear evidence from outputs and grading
4. generalize from feedback instead of overfitting to one prompt
5. rerun the eval set into a new iteration directory
6. repeat grading and review

Stop iterating when:

- the user says they are happy
- feedback is effectively empty, including explicit "no feedback" or equivalent acceptance
- you are no longer making meaningful progress

### Step 10: Deliver

The default completion state is:

1. the skill has been drafted or revised
2. the skill passes validation
3. eval prompts have been created
4. the evals have been executed or the user explicitly opted out
5. any resulting improvements have been applied
6. the updated skill folder exists on disk

Treat the updated skill folder as the primary deliverable, with eval artifacts and workspace outputs supporting it.

## Optional flow: blind comparison

For stricter A/B comparison between two versions, use:

- `agents/comparator.md` for blind judging
- `agents/analyzer.md` for post-hoc analysis

This is optional and typically requires helper agents.

## Optional flow: description optimization

Use this when the user wants to improve trigger behavior for the target skill's frontmatter description.

1. create about 20 realistic trigger queries split between should-trigger and should-not-trigger
2. let the user review the set with `assets/eval_review.html`
3. run the optimization loop:

```bash
python3 scripts/run_loop.py \
  --eval-set <path-to-trigger-eval.json> \
  --skill-path <path-to-skill> \
  --model <model-id-powering-this-session> \
  --max-iterations 5 \
  --verbose
```

4. if needed, regenerate a static report:

```bash
python3 scripts/generate_report.py <results.json> -o <report.html>
```

5. apply `best_description` from the loop output
6. show the user the before/after description and scores

This automation depends on the local `copilot` CLI because the helper scripts spawn isolated helper-agent sessions and temporarily install the candidate skill into Copilot's personal skill directory. If that runtime is unavailable, prepare the eval set and explain the blocker instead of claiming success.

## Reference files

Read these only when relevant:

- `references/schemas.md` - JSON schemas for eval artifacts
- `agents/grader.md` - grading rules and output format
- `agents/analyzer.md` - benchmark and post-hoc analysis guidance
- `agents/comparator.md` - blind A/B comparison guidance

## Final reminder

Track the major phases in the runtime's todo or task system so you do not skip scope confirmation, validation, eval creation, eval execution, review, feedback handling, or delivery.
