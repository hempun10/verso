## Summary
- Describe what changed and why.

## Verification
- [ ] Backend: `cd backend && uv run ruff check src tests && uv run pyright && uv run pytest -v`
- [ ] Frontend: `cd frontend && pnpm run typecheck && pnpm run build`
- [ ] No secrets, `.env` files, or dev-only UI text introduced

## Screenshots / Notes (if UI changed)
<!-- Add before/after screenshots for visual changes -->
