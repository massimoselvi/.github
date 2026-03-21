(# PR Title: feat: [Brief, one-line description of the change])

### Description

<!--
Provide a clear and concise summary of the changes.
- What is the purpose of this PR?
- What problem does it solve?
- Why is this change necessary?
-->

### Related Issue(s)

<!-- Link to any relevant issues, tickets, or cards. -->
- Closes #[TICKET_NUMBER]
- Addresses #[TICKET_NUMBER]

### Changes Made

<!--
Provide a detailed, technical breakdown of the changes.
- A bulleted list of the specific modifications.
- Mention new functions, classes, or components.
- Highlight any significant architectural decisions.
-->
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

- Added `NewComponent.tsx` to handle user authentication display.
- Refactored `api.service.ts` to use async/await instead of Promises.
- Updated the `Button` component with a new `variant` prop for secondary actions.
- Added unit tests for the new `calculatePrice` utility function.

*(Please delete options that are not relevant.)*

### How to Test

Please describe the tests that you ran to verify your changes. Provide instructions so we can reproduce.

<!--
Provide clear, step-by-step instructions for the reviewer to test your changes.
1. Check out this branch.
2. Run `npm install` to install new dependencies.
3. Run `npm run dev`.
4. Navigate to the `/login` page.
5. You should see the new login form.
6. Attempt to log in with `test@example.com` and password `password`.
7. You should be redirected to the dashboard.
-->

### Screenshots / Recordings

<!-- If your changes affect the UI, add screenshots or a short video/GIF. -->
| Before                                       | After                         |
| -------------------------------------------- | ----------------------------- |
| [Screenshot or description of the old state] | [Screenshot of the new state] |

### Checklist

- [ ] I have tested my changes locally.
- [ ] My changes do not introduce any new warnings or errors.
- [ ] I have updated the documentation, if necessary.
- [ ] I have added tests to cover my changes.
- [ ] All new and existing tests passed.

### Additional Notes

<!-- Anything else you want to mention? e.g., performance considerations, potential follow-up work, etc. -->
