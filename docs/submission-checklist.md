# Repository submission checklist

Repository: [PA-TA-Hackathon](https://github.com/BalaVigneshKannan/PA-TA-Hackathon).

| Required deliverable | Repository location |
|---|---|
| Source code | `frontend/`, `backend/`, `database/`, launcher scripts and locked dependencies in `package-lock.json`. |
| README and setup instructions | [README](../README.md), [Start here](../START-HERE.md) and [setup guide](setup.md). |
| Technical overview | [Architecture and data/workflow design](technical-overview.md), [API reference](api-reference.md) and [intranet contract](intranet-integration.md). |
| Deployment instructions | [Deployment runbook](deployment.md), [Nginx example](../deploy/nginx.conf.example) and [systemd example](../deploy/pa-ta-portal.service.example). |
| Supporting evidence | [Requirement comparison](problem-statement-review.md), [verification report](verification.md), [demo guide](../DEMO-GUIDE.md) and README screenshots. |

## Reviewer access

The submission image requires a public or approved-access repository. Confirm the repository visibility in GitHub and grant the judges access if it is private. Repository visibility has not been changed by this documentation work.

Reviewers can install dependencies and generate their own local demo credentials using the setup guide. A hosted URL is not included; deployment instructions describe an example deployment rather than an already published service.

## Before presenting

1. Follow the clean-checkout setup and confirm the login page loads.
2. Configure a demo semester and use synthetic records for the role walkthrough.
3. Run `npm test` and `npm run build`; the recorded local result is 58 passing tests and a successful build.
4. Confirm the intended commit is visible on GitHub's `main` branch and reviewers have access.
5. Present the documented university integration and production limits accurately.

Generated access files, `.env`, databases, backups, dependencies and build outputs are intentionally excluded from the repository. No license grant or institution-approved deployment is claimed by this checklist.
