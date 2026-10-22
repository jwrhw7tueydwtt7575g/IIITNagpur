# Security Policy — CityGraph

CityGraph is an educational prototype for simulated infrastructure risk scenarios. **It is not an emergency response service.**

## Deployment precautions

- Use unique, strong secrets for JWT signing and authentication, and avoid default demo accounts on public deployments.
- Restrict CORS origins and review all API exposure, user registration, and rate limiting before public production use.
- Keep SQLite databases, credentials, tokens and environment files out of commits and logs.
- Keep synthetic infrastructure data clearly marked. Do not publish genuine sensitive facility locations or security vulnerabilities.
- Validate all user inputs and review geospatial/route data imports before use.

## Reporting a vulnerability

Avoid publishing exploitation instructions, credentials or private data in public issues. Contact the maintainer privately through [@rajsalonia](https://github.com/rajsalonia), or use GitHub's private vulnerability reporting option if enabled. Include a reproducible example with synthetic data and relevant environment details.

See [README.md](README.md) for operating limits and [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidance.
