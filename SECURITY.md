# Security Policy

We take the security of our software and services seriously. This policy
explains how to report vulnerabilities, what to expect after you report one,
and which repositories and vulnerability types are in scope.

## Reporting a Vulnerability

Please report security vulnerabilities through a private channel. Do **not**
open a public GitHub issue, pull request, or discussion for a security report.

Use one of the following private disclosure channels, in order of preference:

1. **GitHub Security Advisories (recommended).** Open a private report from the
   **Security** tab of the affected repository by selecting **Report a
   vulnerability**. This keeps the report confidential and lets us collaborate
   with you on a fix before any public disclosure.
2. **Dedicated security email.** If GitHub Security Advisories are unavailable,
   email us at `security@example.com`.

When reporting, please include as much of the following as you can:

- A description of the vulnerability and its potential impact.
- The affected repository, product, version, or commit.
- Step-by-step instructions to reproduce the issue.
- Any proof-of-concept code, logs, or screenshots.
- Your name or handle if you would like to be credited.

## What to Expect

After you submit a report through one of the channels above, you will receive a
confirmation that your report was received successfully. The confirmation
includes a reference identifier that both you and we can use to track the report
through to resolution:

- For GitHub Security Advisories, the advisory itself (its `GHSA` identifier and
  URL) serves as the reference identifier.
- For email reports, we reply with a ticket reference identifier you can quote in
  follow-up correspondence.

We aim to meet the following response timelines:

- **Initial acknowledgment:** within **48 hours** of submission.
- **Resolution or mitigation update:** a target of **90 calendar days** from
  submission. If a fix will take longer, we will keep you informed of progress
  and the expected timeline.

## Scope

### Covered repositories and products

This security policy applies to all non-archived repositories owned by the
organization, including:

- This `.github` repository and the organization-wide defaults it provides.
- All actively maintained organization repositories, products, and services.

Archived repositories and third-party dependencies are outside the scope of this
policy. For vulnerabilities in a third-party dependency, please report the issue
to that project's maintainers.

### Accepted vulnerability types

We accept reports for security vulnerabilities including, but not limited to:

- Remote code execution (RCE).
- Data exposure or leakage of sensitive information.
- Authentication or authorization bypass.
- Privilege escalation.
- Injection flaws (for example, SQL, command, or template injection).
- Cross-site scripting (XSS) and cross-site request forgery (CSRF).
- Insecure handling of secrets or credentials.

The following are generally **not** accepted as security vulnerabilities:

- Reports from automated scanners without a demonstrated, exploitable impact.
- Missing security headers or best-practice suggestions without a concrete
  attack scenario.
- Denial of service that requires excessive or unrealistic resources.
- Social engineering, phishing, or physical attacks against staff or users.

## Disclosure

We follow a coordinated disclosure process. We ask that you give us a reasonable
opportunity to resolve the issue before any public disclosure, and we will work
with you to agree on a disclosure timeline.
