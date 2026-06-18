# Known-Flaky Test Allowlist

Maintainer-maintained list of tests known to be flaky (intermittently failing for reasons unrelated to code under test).

**This is the *only* source of truth for "is this failure flaky?"** An agent (git-manager) may treat a failing CI check as flaky **only if** the failing test's name appears in the table below. Otherwise a red check **always** blocks a merge — no agent judgment calls, no rationalizing a real failure as "probably flaky."

**Maintainer:** add a row when you confirm a test is genuinely flaky. Remove it once fixed.

| Test name (exact) | Suite / file | Reason | Added |
|-------------------|--------------|--------|-------|
| _(none yet)_ | | | |
