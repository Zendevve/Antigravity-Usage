# Contributing to K1 Antigravity Monitor

We love your input! We want to make contributing to this project as easy and transparent as possible.

## Development Setup

1. **Clone the repository.**
2. **Install dependencies:** `npm install`
3. **Run tests:** `npm run test:unit:ci`
4. **Compile extension:** `npm run build:dev`
5. **Open VS Code Extension Host:** Press `F5`

### Architecture Guidelines

* We run a highly decoupled structure utilizing **RxJS**. Never store global state mutably. Always stream data through `BehaviorSubject`s.
* New configurations require strictly typed `Zod` schemas in `src/core/types/config.ts`.
* Native UI modifications must conform to `i18next` localized strings compiled via the script into `keys.ts`.

## Pull Requests
All pull requests must pass the `lint`, `typecheck`, `test:unit:ci`, and `test:all` validation gates before merge. Check the `PULL_REQUEST_TEMPLATE.md` checklist when filing.
