# Duty API Evolution: Chores Support in WhoIsOnDutyHandler

## Overview
Update fetchDutyName to return the full duty response (name + optional chores), update WhoIsOnDutyHandler to speak the duty person's name followed by each chore's description, assignee, and deadline, and update DUTY_API.md to reflect the new response format.

## Context
- Files involved: `src/alexa-skill.js`, `DUTY_API.md`
- Related patterns: existing HMAC auth and axios fetch in fetchDutyName, Alexa responseBuilder.speak()
- Dependencies: none new

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**

## Implementation Steps

### Task 1: Update fetch function and handler

**Files:**
- Modify: `src/alexa-skill.js`

- [ ] Rename fetchDutyName to fetchDutyInfo
- [ ] Remove the name-only extraction logic; return the full parsed object `{ name, chores }`
- [ ] Keep backward compat: if response is plain string or old object without chores, return `{ name, chores: [] }`
- [ ] Update WhoIsOnDutyHandler to call fetchDutyInfo
- [ ] Build speech: start with "Today on duty: [name]."
- [ ] If chores present, loop and append per chore: "[description], assigned to [assignee], due [deadline_at]."
- [ ] Write/update tests covering: name-only response, name+chores response, empty chores array, missing assignee/deadline fields
- [ ] Run test suite - must pass before task 2

### Task 2: Update API documentation

**Files:**
- Modify: `DUTY_API.md`

- [ ] Update response format section to show new JSON structure with name and chores array
- [ ] Document chore fields: description, deadline_at, assignee (all optional for robustness)
- [ ] Show example request/response with chores
- [ ] Note backward compatibility: plain text and name-only JSON still accepted
- [ ] No test needed for docs change

### Task 3: Verify acceptance criteria

- [ ] Manual test: invoke handler with a mocked response containing chores, verify spoken output order and content
- [ ] Run full test suite (`npm test`)
- [ ] Run linter if configured
- [ ] Move this plan to `docs/plans/completed/`
