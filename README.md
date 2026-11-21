# massimoselvi/.github

Default community health files for repositories owned by the personal GitHub account [@massimoselvi](https://github.com/massimoselvi).

GitHub applies a file from this repository to any repository of the account that has no file with the same name. The profile README is in [massimoselvi/massimoselvi](https://github.com/massimoselvi/massimoselvi), not here.

## Defaults

| File | Applies to |
| --- | --- |
| [ACCESSIBILITY.md](ACCESSIBILITY.md) | Accessibility goals, known barriers, and reporting |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Community conduct |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Issues, pull requests, and review |
| [SECURITY.md](SECURITY.md) | Vulnerability reporting |
| [SUPPORT.md](SUPPORT.md) | Where to get help |
| [.github/pull_request_template.md](.github/pull_request_template.md) | New pull requests |
| [.github/ISSUE_TEMPLATE/](.github/ISSUE_TEMPLATE/) | Bug, feature, and question forms, and the issue chooser |

## Override a default

Add a file with the same name to the root, `.github/`, or `docs/` folder of the target repository. The repository file replaces the default completely. GitHub does not merge the two files.

For issue forms, any file in the `.github/ISSUE_TEMPLATE/` folder of the target repository replaces the whole default folder, including `config.yml`.

## Not inherited

Each repository needs its own `CODEOWNERS`, `LICENSE`, `.gitignore`, workflows, and settings. Labels are applied by a sync, see [docs/label-sync.md](docs/label-sync.md).

## Documentation

- [docs/scope.md](docs/scope.md): scope, boundaries, layout, and audit.
- [docs/adoption.md](docs/adoption.md): adoption matrix, per-repository actions, and sync with the organization repository.
- [docs/security-baseline.md](docs/security-baseline.md): account and repository security settings for a solo owner on GitHub Pro.
- [docs/label-sync.md](docs/label-sync.md): label catalog, targets, and credentials.

## Verify after a change

Use a public repository of the account that has no own community files, for example `aws-cdk-lambda-cron`.

1. Open `https://github.com/massimoselvi/<repository>/issues/new/choose`. The three forms and the two contact links appear, and there is no blank issue option.
2. Open a pull request form. The default template fills the description.
3. Open `https://github.com/massimoselvi/<repository>/community`. Code of conduct, contributing, security policy, support, issue templates, and pull request template show as present.

An issue form applies its labels only when the labels exist in the target repository. Until the label sync runs, create `triage` by hand in a repository where you need it.
