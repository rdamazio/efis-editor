You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## Setup commands

- Use `npm run genkeys` once to generate dummy dev-only client ID
- Use `npm install` to install dependencies, whenever `package.json` or `package-lock.json` changes
- Use `npm run genproto` to generate protocol buffer files, once and then again when any `.proto` file is modified

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.
- Use the linter (`npm run lint`) to check for style issues, but only as a last step after everything is done.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

### Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `computed()` for derived state
- Prefer inline templates for small components
- Prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- When using external templates/styles, use paths relative to the component TS file.

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Use the `inject()` function instead of constructor injection

## Testing

- Use the `vitest` framework for unit testing
- Execute tests with `npm run test:headless`
- To run only a specific test, use `npm run test:headless -- --include <test-file-name>`
- Do not use `npm run test`
- Do not invoke vitest directly (e.g. `npx vitest`)
- Code coverage can be checked with `npm run test:coverage`

## Version control

- Use the `jj` version control system.
- jj automatically adds files to the next commit, so you don't need to use `jj add`.
- Create a commit (`jj commit -m "COMMIT MESSAGE"`) after each logical change.
- Use descriptive, semantic commit messages
- Commit messages should be in the format "TYPE(SCOPE): DESCRIPTION"
- Commit message types are "feat", "fix", "refactor", "docs", "lint", "build", "formats", "revert", "test"
- Do not modify existing commits in any way.
