# Contributing to Wiki.js NG

Thank you for considering a contribution!

## Reporting bugs and requesting features

Use the [GitHub issue tracker](https://github.com/swissmakers/wikijs-ng/issues).
Please include the Wiki.js NG version, the database type and clear reproduction
steps. **Do not report security vulnerabilities in public issues** — see
[SECURITY.md](../SECURITY.md) for the responsible disclosure process.

## Pull requests

- Fork the repository and create a feature branch from `main`.
- Run `yarn install`, make your changes and verify with `yarn test`
  (ESLint + pug-lint + Jest) and `yarn build`.
- Keep changes focused; unrelated refactoring belongs in separate PRs.
- Building and running the project is documented in [dev/BUILD.md](../dev/BUILD.md).

## License

By contributing you agree that your contributions are licensed under the
[AGPL-3.0](../LICENSE), the same license as the project.
