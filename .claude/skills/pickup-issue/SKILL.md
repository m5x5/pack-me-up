---
name: pickup-issue
version: 1.0.0
description: |
  Find the first open GitHub issue without a "taken" label, claim it by adding
  the label, produce an implementation plan, and — once built — manually test it
  in the running app and push a dated screenshot report to the agent-testing
  branch. Use when the user wants to pick up the next available issue or asks
  /pickup-issue.
allowed-tools:
  - Bash
  - Read
  - Write
  - Glob
  - Grep
  - Agent
  - EnterPlanMode
  - ExitPlanMode
---

# pickup-issue: Claim and Plan a GitHub Issue

You are running the `/pickup-issue` workflow. Find the next unclaimed issue,
label it as taken, understand what it requires, then enter plan mode to produce
an actionable implementation plan. Once the work is built, manually test it in
the running app and publish the report (Step 6) — the issue is not done until
that report is pushed.

**Hard rules:**
- Never claim more than one issue per invocation.
- Never skip the codebase exploration — the plan must reference real files.
- Always follow TDD: the plan must include a red → green → refactor cycle.
- Never enter plan mode without first reading the full issue body and comments.
- **Always manually test the finished change in the running app** (Step 6), and
  push a dated manual test report with screenshots to the `agent-testing`
  branch. Passing unit tests are never the whole story.

---

## Step 1: Find the first unclaimed issue

List all open issues and find the first one without a `taken` label:

```bash
gh issue list \
  --repo timgent/react-packing-app \
  --state open \
  --json number,title,labels \
  --limit 100
```

Parse the JSON output:
- An issue is **unclaimed** if its `labels` array contains no entry with `name == "taken"`.
- Select the **lowest-numbered** unclaimed issue.

If no unclaimed issues exist, print "No unclaimed issues found." and stop.

---

## Step 2: Claim the issue

Ensure the `taken` label exists (this is a no-op if it already does):

```bash
gh label create taken \
  --repo timgent/react-packing-app \
  --color "B60205" \
  --description "Issue is being worked on" \
  --force
```

Add the label to the issue:

```bash
gh issue edit <number> \
  --repo timgent/react-packing-app \
  --add-label taken
```

Print: "Claimed issue #<number>: <title>"

---

## Step 3: Read the full issue

Fetch the issue body and all comments:

```bash
gh issue view <number> \
  --repo timgent/react-packing-app \
  --json title,body,comments
```

Read carefully:
- What problem does it describe?
- Are there reproduction steps, expected vs. actual behaviour, or feature requirements?
- Do any comments add constraints or clarifications?

---

## Step 4: Explore relevant code

Use Glob, Grep, and Read to identify the code areas involved. At minimum:

1. Search for keywords from the issue title/body across `src/`.
2. Read the files most likely to need changes (components, hooks, services, pages).
3. Find the existing test file(s) that cover the affected area — look for `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx` co-located with the source files.
4. Note the patterns and conventions in place (component structure, hook patterns, PouchDB service usage, error handling style, etc.).

---

## Step 5: Produce an implementation plan

Call EnterPlanMode, then write a plan file with these sections:

- **Issue summary** — one paragraph describing the problem or feature.
- **Root cause / approach** — what needs to change and why.
- **Files to modify** — list each file with the specific component, hook, or function to change.
- **TDD steps**:
  1. **Red** — write a failing test (`.test.tsx` / `.test.ts`) that captures the expected behaviour.
  2. **Green** — make the minimal change to pass the test.
  3. **Refactor** — clean up without breaking tests.
- **Verification** — `npm test` to confirm everything passes, plus the manual
  test pass described in Step 6 (include it as a plan step, not an afterthought).

Call ExitPlanMode to present the plan for user approval before writing any code.

---

## Step 6: Always manually test, and publish the report

Automated tests are not enough on their own. Once the implementation is done,
**drive the real app yourself** and see the change working, then write up what
you saw. Never report an issue as finished without this.

### 6a. Run the app and exercise the change

Use the `/run` skill, or the project's own tooling:

- `/solid-dev` starts a local Community Solid Server when the change touches
  sign-in, sync, or sharing — use it so sign-in paths are tested for real
  rather than mocked.
- Otherwise `npm run build && npm run preview` and drive the built app
  (Playwright is available with a pre-installed Chromium; a throwaway spec under
  `e2e/tests/` is a fine way to script the walkthrough and capture screenshots —
  delete it afterwards so it never lands in the committed suite).

Cover, at minimum:
- Every success criterion listed on the issue, one by one.
- **Desktop and mobile viewports** (e.g. 1280×900 and 390×844) for anything with UI.
- The unhappy paths a user will actually hit — dismiss, cancel, reload, back.

**Take a screenshot of each step.** Note anything surprising, including
pre-existing behaviour that shapes the flow.

### 6b. Write the report

A single markdown file, named `README.md`, containing:

- A header table: date, issue link, PR link, branch + commit under test, result.
- **How it was tested** — build, server, viewports, accounts used.
- One section per success criterion, with the embedded screenshots
  (`![…](images/NN-name.png)`) and what they show.
- A success-criteria table with a pass/fail per row.
- The automated-check results alongside (`npm test`, e2e).
- A **Bugs found** section — say "None" explicitly if there were none.

### 6c. Push it to the `agent-testing` branch

Reports live on a dedicated `agent-testing` branch, which is **branched off the
repository's first commit** so it never carries the codebase's history and never
merges into `main`. Each report gets its own dated folder.

```bash
# Create the branch off the first commit if it does not exist yet
git fetch origin agent-testing || \
  git branch agent-testing $(git rev-list --max-parents=0 origin/main | tail -1)

# Work in a separate worktree so the feature branch is left alone
git worktree add /tmp/agent-testing-wt agent-testing   # add -b agent-testing if new

FOLDER=/tmp/agent-testing-wt/$(date +%F)-issue-<number>-<short-slug>
mkdir -p "$FOLDER/images"
# write README.md into $FOLDER, screenshots into $FOLDER/images/

git -C /tmp/agent-testing-wt add -A
git -C /tmp/agent-testing-wt commit -m "Manual test report: issue #<number> (<date>)"
git -C /tmp/agent-testing-wt push -u origin agent-testing
git worktree remove /tmp/agent-testing-wt
```

Folder name: `YYYY-MM-DD-issue-<number>-<short-slug>`, e.g.
`2026-07-31-issue-202-contextual-sign-in`.

### 6d. Link the report from the PR

Update the PR description with a link to the report on the `agent-testing`
branch, so a reviewer can see the evidence without running anything:

```
📋 **[Manual test report — YYYY-MM-DD, with screenshots](https://github.com/timgent/pack-me-up/blob/agent-testing/YYYY-MM-DD-issue-<number>-<slug>/README.md)** (on the `agent-testing` branch)
```
