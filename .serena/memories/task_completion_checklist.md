# Task Completion Checklist

## Before Marking Task Complete

### Testing
- [ ] Run `npm run test` - all tests must pass
- [ ] For UI changes: verify visually in dev mode (`npm run dev`)
- [ ] For store changes: verify tests exist in `tests/stores/`

### Type Checking
- [ ] Run `npm run check` - should have no new errors
- [ ] Pre-existing errors are OK, but don't add new ones

### Code Quality
- [ ] Follow naming conventions (see style_conventions memory)
- [ ] Use TypeScript strict mode
- [ ] Add JSDoc for public functions

### For Refactoring Tasks
- [ ] All references updated
- [ ] Backward compatibility maintained or documented
- [ ] No orphaned code

### Git Workflow
- [ ] Changes committed with clear message
- [ ] Branch pushed if working on feature branch

## Commands to Run
```powershell
# Full verification
npm run test
npm run check

# Quick test only
npm run test
```

## Current Test Count
- 521 tests passing (as of last check)
- 41 test files
