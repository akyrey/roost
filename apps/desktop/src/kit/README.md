# Kit

Code that Dunlin shares with Whimbrel. Each folder becomes one package of the Roost repository
(`akyrey/roost`), imported as `@roost/<folder>`. Until then the `@roost/*` alias in
`tsconfig.json` and `vite.config.ts` points here, so the move changes no imports.

Rules (enforced by ESLint):

- Code in `kit/` imports only npm packages and other kit packages (`@roost/*`), never the app.
- The app imports kit code only through `@roost/<folder>`, never by a relative path.
- Kit packages import each other through `@roost/<folder>` too, never `../<folder>`.
