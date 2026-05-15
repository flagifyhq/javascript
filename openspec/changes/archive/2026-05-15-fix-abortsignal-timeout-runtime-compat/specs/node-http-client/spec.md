## ADDED Requirements

### Requirement: HTTP client SHALL enforce a 10s request timeout on every runtime

The `FlagifyHttpClient` implementation in `@flagify/node` SHALL enforce a 10-second deadline on every `get()` and `post()` call, regardless of whether the host JavaScript runtime implements the static method `AbortSignal.timeout`. When the deadline is reached before the response is received, the in-flight `fetch` SHALL be aborted and the returned promise SHALL reject with an error whose `name` property equals `"TimeoutError"`.

#### Scenario: Native AbortSignal.timeout runtime aborts at the deadline

- **WHEN** the host runtime exposes `AbortSignal.timeout` as a function
- **AND** an HTTP request issued by the client does not receive a response within 10 seconds
- **THEN** the underlying `fetch` is aborted via the signal returned by `AbortSignal.timeout(10_000)`
- **AND** the promise returned by `get()` or `post()` rejects with an error whose `name === "TimeoutError"`

#### Scenario: Runtime without AbortSignal.timeout still aborts at the deadline

- **WHEN** the host runtime does not expose `AbortSignal.timeout` (e.g., Hermes / React Native, Node.js < 17.3)
- **AND** an HTTP request issued by the client does not receive a response within 10 seconds
- **THEN** the client constructs an `AbortController` internally and aborts it after 10 seconds via `setTimeout`
- **AND** the promise returned by `get()` or `post()` rejects with an error whose `name === "TimeoutError"`
- **AND** no `TypeError: AbortSignal.timeout is not a function` is ever thrown

### Requirement: HTTP client SHALL NOT leak timer handles on successful requests

When a request resolves or rejects before the timeout fires, any timer handle scheduled by the fallback path SHALL be cleared so that long-lived processes do not accumulate timers.

#### Scenario: Successful request on fallback path clears the timer

- **WHEN** the host runtime does not expose `AbortSignal.timeout`
- **AND** an HTTP request resolves successfully before the 10-second deadline
- **THEN** the `setTimeout` handle scheduled by the client is cleared via `clearTimeout`
- **AND** the abort controller is not invoked

#### Scenario: Failed request on fallback path clears the timer

- **WHEN** the host runtime does not expose `AbortSignal.timeout`
- **AND** an HTTP request rejects (non-timeout error) before the 10-second deadline
- **THEN** the `setTimeout` handle scheduled by the client is cleared via `clearTimeout`

### Requirement: HTTP client SHALL preserve its existing public API

The exported `FlagifyHttpClient` interface, the `createHttpClient` factory signature, and the `FlagifyAuthError` class SHALL remain unchanged so that no consumer of `@flagify/node`, `@flagify/react`, `@flagify/nestjs`, or `@flagify/astro` needs to update call sites.

#### Scenario: Existing consumer code compiles without modification

- **WHEN** an existing consumer imports `createHttpClient`, calls `client.get(path)`, or catches `FlagifyAuthError`
- **THEN** their code SHALL compile and behave identically to the prior release on runtimes that already supported `AbortSignal.timeout`

### Requirement: Documentation SHALL declare React Native / Hermes support

The README for `@flagify/node` SHALL state that the package runs on React Native (Hermes engine) in addition to Node.js and modern browsers. The README for `@flagify/react` SHALL cross-reference that support statement so React Native users discover it from either entry point.

#### Scenario: User reads either README and confirms RN support

- **WHEN** a user opens `packages/node/README.md` or `packages/react/README.md`
- **THEN** the supported-runtimes section explicitly mentions React Native / Hermes
