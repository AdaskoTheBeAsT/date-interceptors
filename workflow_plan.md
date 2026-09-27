# Shared Nx GitHub Actions workflow plan

Reviewed: 2026-09-25

## Summary

CI orchestration can be shared widely, but build commands and publishing rules
should remain configurable.

The review inventoried 41 Nx workspace configurations under `D:\GitHub` and
compared their workflows and representative resolved targets.
`D:\GitHub\github-actions` currently provides only .NET automation.

This is a proposed plan, not an implemented workflow. The review inspected
configuration and resolved Nx targets; it did not build every repository.

## Components to share

| Shared component | Responsibilities |
| --- | --- |
| Node setup action | Node version, pinned package-manager setup, dependency cache, reproducible installation |
| Reusable Nx CI workflow | Checkout, Node matrix, build/test/typecheck/lint stages, optional extra validation |
| Test and coverage reporting | Configurable JUnit, LCOV and Cobertura paths; upload reports even after failures |
| Optional Sonar scan | Scan on one matrix leg, explicit secret handling, appropriate handling of untrusted PRs |
| Build artifact upload | Configurable output directory and matrix-safe artifact names |

The strongest immediate candidates are:

- [date-interceptors CI](D:/GitHub/date-interceptors/.github/workflows/ci.yml)
- [HttpParamsProcessor CI](D:/GitHub/HttpParamsProcessor/.github/workflows/ci.yml)

They already share almost the same setup, installation, build, test, lint,
Sonar and reporting sequence. Their release workflows duplicate much of that
validation too.

## Recommended structure in github-actions

```text
.github/
  actions/
    node/setup-workspace/action.yml
    reporting/publish-test-results/action.yml
  workflows/
    nx-ci.yml
```

### Reusable workflow inputs

- Workspace directory, including nested workspaces such as
  `NXSamples/ReactVite`.
- Node versions and the version used for Sonar.
- Repository-owned scripts for build, test, lint and optional type checks.
- Optional preflight and package-consumer checks.
- Test, coverage and distribution artifact paths.

Keep individual stages visible rather than accepting one large shell script.
Validation errors should fail the workflow by default.

### Package-manager setup

The setup action should distinguish Yarn Classic, Yarn 4 and npm. Provision
the required package manager explicitly rather than assuming the runner
supplies it.

Use the repository's pinned package-manager version and matching installation
mode: immutable installs for modern Yarn, frozen-lockfile installs for Yarn
Classic, and `npm ci` for npm projects with a lockfile.

### Reporting

Make report paths configurable initially. Upload test and coverage reports
even when validation fails, with artifact names that distinguish matrix jobs
and workspaces.

Keep Sonar project identity, source paths and exclusions in repository-owned
configuration. The shared workflow should handle scanner execution and
credentials, not impose one source layout.

## Project-specific behavior to preserve

| Project | Important difference |
| --- | --- |
| date-interceptors | Version checks, tooling tests, packed consumers, minimum peer dependencies |
| HttpParamsProcessor | Vitest and Angular test executors; custom package generation |
| MetricUnits-TypeScript | `build` runs `package-fix`, plus separate `type-tests` |
| Several NXSamples workspaces | `build` invokes `nx compress ui`, not just `nx build` |
| AngularReactVitest | Different report filenames and mixed framework build targets |
| temp-org | Playwright installation and Nx Cloud distribution |
| Older Nx workspaces | Different supported Node versions and legacy tooling |

Replacing every build with `nx run-many -t build` would silently omit
necessary work in some repositories.

Keep coverage thresholds, compiler settings, package exports and framework
configuration inside each repository.

## Migration issues

### 1. Package-manager mismatch in temp-org

Its [workflow](D:/GitHub/temp-org/.github/workflows/ci.yml#L31) uses npm caching
and `npm ci`, but the workspace declares Yarn 4 and has `yarn.lock`, with no
root npm lockfile found.

Align the workflow with the repository's package manager before migration.

### 2. HttpParamsProcessor ignores lint failures

[Line 35](D:/GitHub/HttpParamsProcessor/.github/workflows/ci.yml#L35) uses
`continue-on-error: true`.

Do not carry this into the shared default.

### 3. Report paths are not standardized

Examples include:

- `test-report.junit.xml`
- `report.junit.xml`
- `test.junit.xml`

Reports appear under both `.reports/libs` and `.reports/packages`.
Make paths configurable initially rather than changing all reporters at once.

### 4. Nx task-cache outputs need attention

Some inspected targets cache only coverage, excluding JUnit and Sonar
reports. `MetricUnits-TypeScript` declares a coverage output location
different from its Jest configuration.

Before sharing task caches, ensure every required generated report is included
in the relevant target's outputs. Otherwise, cache hits can leave reporting
files missing.

### 5. Nx Cloud must remain opt-in

Several workspaces explicitly set `neverConnectToCloud: true`.

Do not make Nx Cloud distribution or remote caching a requirement of the
shared workflow.

## Keep publishing separate initially

Reuse the build-and-validation portion of release workflows, but leave
publishing jobs in the caller repositories.

`date-interceptors` has
[core-first publishing and registry verification](D:/GitHub/date-interceptors/.github/workflows/publish.yml#L64).
`HttpParamsProcessor` publishes packages through a simple matrix.

Combining these prematurely would complicate dependency ordering, retries
and npm trusted-publishing configuration.

The existing .NET workflow's lightweight-tag publishing policy should not
automatically become the policy for npm packages.

## Suggested rollout

1. Implement shared setup and CI using `date-interceptors` and
   `HttpParamsProcessor`.
2. Add `Splines-TypeScript`, `Psychrometrics-TypeScript`,
   `MetricUnits-TypeScript`, and `esbuild-compressor`.
   Splines currently uses Azure Pipelines, so that adoption would also be a
   CI-platform migration.
3. Extend to application samples and older Nx versions separately.

Start with the modern workspaces rather than trying to support the entire
Nx 10–23 range in the first version.
