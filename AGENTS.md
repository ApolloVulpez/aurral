## Engineering workflow

Use the `ponytail` skill for implementation, debugging, and code-review work. If
the skill is unavailable, say so explicitly and follow the closest applicable
repository workflow instead.

## Documentation synchronization

Treat documentation as part of the definition of done. When adding, removing,
renaming, or changing a feature, update every affected source of documentation in
the same change, including user guides, configuration examples, API documentation,
screenshots, and operational or deployment notes where applicable.

Remove or revise stale documentation when behavior is removed or superseded. Run
the relevant documentation checks or build when documentation is affected. If a
change does not require documentation updates, state why in the final handoff.

## Test integrity

Passing tests is not the objective; establishing correct behavior is.

When a test fails:

1. Determine the intended behavior from the request, specification, documentation,
   history, and surrounding contracts.
2. Classify the failure as an implementation defect, test defect, fixture/environment
   defect, or ambiguous requirement.
3. Do not change expectations, weaken assertions, update snapshots, skip tests,
   add error suppressions, or mock away the failing behavior merely to make the
   suite pass.
4. Change a test only when evidence shows that its expectation is incorrect or the
   requirement has intentionally changed. Explain that evidence.
5. Derive expected results independently from the production implementation.
6. Use discriminating boundary and failure cases, and keep tests independently runnable.
7. If intended behavior cannot be established, stop and surface the ambiguity.

Before finishing, verify that the test would fail under a plausible incorrect
implementation—not only that it passes with the current one.

## Test lifecycle

Tests are maintained product code, not disposable proof that an implementation
once worked.

Keep a new test only when it protects durable behavior, a meaningful boundary or
failure mode, or a confirmed regression that is not already covered at an
equivalent or stronger seam.

Temporary diagnostic tests, probes, fixtures, and instrumentation must be removed
before finishing. Consolidate overlapping cases when one table-driven or
higher-level test provides the same discriminating signal.

Do not remove a regression test merely because the implementation now passes it.
Remove a test only when the protected behavior no longer exists or equivalent
coverage has been demonstrated elsewhere.

Before retaining a new test, verify that it fails under a plausible incorrect
implementation and state what unique regression it prevents.
