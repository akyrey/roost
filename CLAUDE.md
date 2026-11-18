# Project instructions (Roost)

The kit shared by Dunlin and Whimbrel (see README.md). Rust crates in `crates/`, frontend
packages in `packages/`, the reusable release workflow in `.github/workflows/release-app.yml`.

- No app code. If only one app uses something, it stays in that app.
- Packages import each other as `@roost/<package>`; never by relative path.
- Rust: `thiserror` errors, no `unwrap`/`expect`/`panic!` outside tests, no `unsafe`; never log
  secrets or user data. Errors carry a stable code and a message safe to show.
- TypeScript strict, no `any`, no `console.log`; state is immutable.
- TDD; 80% line coverage per crate and for the frontend.
- A change that breaks an app's use is a minor bump while 0.x; say so in the commit.
- Conventional commits.
