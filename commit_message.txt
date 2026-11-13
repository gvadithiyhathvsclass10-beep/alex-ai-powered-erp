cd /tmp/alex-erp-repair
git add -A
git commit -m "Fix Important Questions: rewrite component, fix file upload, fix JSX parsing

- Rewrite ImportantQuestionsTab component (simplified from 2000+ to ~250 lines)
- Fix conditional rendering issues (replace && with ternary operators)
- Fix file upload to use proper storage client (uploadFile)
- Remove duplicate Step1Subject component definition
- Replace old Important Questions tab with new modular component
- Fix API route to use proper storage client (uploadFile)
- Clean up imports and remove unused code

The ImportantQuestionsTab component now passes typecheck and build.
VoiceAssistant.tsx has separate pre-existing issues (not part of this fix)."