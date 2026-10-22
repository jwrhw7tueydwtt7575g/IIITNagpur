# Contributing to CityGraph

Thanks for helping improve this educational urban infrastructure risk simulator.

## Before you contribute
- Open a focused issue describing the bug, improvement, or documentation gap.
- Use an isolated feature branch and submit a pull request with a short summary and screenshots for interface changes.
- Keep **simulated/reconstructed data clearly labeled**. Never present scenario outputs as real-time evacuation guidance.
- Don't commit API keys, passwords, local databases, or real sensitive geolocation data.

## Development checks
- Backend dependencies: `cd backend && pip install -r requirements.txt`
- Frontend dependencies: `cd frontend && npm install`
- Frontend production build: `cd frontend && npm run build`
- Run any relevant automated checks included in your change, and explain manual testing in your PR.

## Pull request checklist
- [ ] Change has a clear purpose and scope
- [ ] New endpoints include validation and error handling
- [ ] Updated screenshots/docs reflect actual functionality
- [ ] Simulation limits and security implications are documented
- [ ] No secrets, generated data, or credentials are committed

See [README.md](README.md) for architecture and local setup.
