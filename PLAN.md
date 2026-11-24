# Skill Assessment System - Complete Implementation Plan

## Phase 1: Fix Backend Bugs & Model Issues

### 1.1 Fix SkillTest.model.js
- Remove erroneous `min: 5` and `difficulty: "medium"` from the `difficulty` field
- Change `passingScore` default from 70 to 80

### 1.2 Update skillTest.service.js
- Import `QUESTION_BANK` from `skillQuestions.js`
- Rewrite `generateFallbackQuestions()` to use the full question bank (70+ skills)
- Update `seedDefaultTests()` to create tests for ALL skills using the question bank
- Remove OpenAI dependency for question generation (use static bank)
- Add cooldown logic: prevent retaking within 24 hours

### 1.3 Update skillTest.controller.js
- Add cooldown check in `startTest` (24-hour cooldown instead of 3 attempts/day)
- Auto-save progress endpoint
- Update `submitTest` to update user profile with verified skills/badges

### 1.4 Update skillTest.routes.js
- Add `POST /:testId/save-progress` route for auto-save

## Phase 2: Complete Question Bank (70+ Skills × 20 Questions)

### 2.1 Expand skillQuestions.js
Split into modular files under `backend/src/data/questions/`:
- `javascript.js` (20 questions)
- `typescript.js` (20 questions)
- `react.js` (20 questions)
- `nextjs.js` (20 questions)
- `vuejs.js` (20 questions)
- `angular.js` (20 questions)
- `nodejs.js` (20 questions)
- `expressjs.js` (20 questions)
- `php.js` (20 questions)
- `laravel.js` (20 questions)
- `python.js` (20 questions)
- `django.js` (20 questions)
- `flask.js` (20 questions)
- `java.js` (20 questions)
- `springboot.js` (20 questions)
- `csharp.js` (20 questions)
- `dotnet.js` (20 questions)
- `cpp.js` (20 questions)
- `go.js` (20 questions)
- `rust.js` (20 questions)
- `kotlin.js` (20 questions)
- `swift.js` (20 questions)
- `flutter.js` (20 questions)
- `reactnative.js` (20 questions)
- `html.js` (20 questions)
- `css.js` (20 questions)
- `tailwindcss.js` (20 questions)
- `bootstrap.js` (20 questions)
- `uiuxdesign.js` (20 questions)
- `figma.js` (20 questions)
- `graphicdesign.js` (20 questions)
- `photoshop.js` (20 questions)
- `illustrator.js` (20 questions)
- `videoediting.js` (20 questions)
- `motiongraphics.js` (20 questions)
- `animation.js` (20 questions)
- `digitalmarketing.js` (20 questions)
- `seo.js` (20 questions)
- `contentwriting.js` (20 questions)
- `copywriting.js` (20 questions)
- `translation.js` (20 questions)
- `datascience.js` (20 questions)
- `machinelearning.js` (20 questions)
- `artificialintelligence.js` (20 questions)
- `cybersecurity.js` (20 questions)
- `cloudcomputing.js` (20 questions)
- `aws.js` (20 questions)
- `azure.js` (20 questions)
- `googlecloud.js` (20 questions)
- `docker.js` (20 questions)
- `kubernetes.js` (20 questions)
- `devops.js` (20 questions)
- `sql.js` (20 questions)
- `mongodb.js` (20 questions)
- `postgresql.js` (20 questions)
- `firebase.js` (20 questions)
- `restapi.js` (20 questions)
- `graphql.js` (20 questions)
- `gitgithub.js` (20 questions)
- `businessanalysis.js` (20 questions)
- `projectmanagement.js` (20 questions)
- `accounting.js` (20 questions)
- `finance.js` (20 questions)
- `customersupport.js` (20 questions)
- `sales.js` (20 questions)
- `hr.js` (20 questions)
- `legalservices.js` (20 questions)
- `architecture.js` (20 questions)
- `engineering.js` (20 questions)

### 2.2 Question format (each file exports array of 20):
```js
{
  question: 'string',
  options: [
    { text: 'string', isCorrect: boolean },
    { text: 'string', isCorrect: boolean },
    { text: 'string', isCorrect: boolean },
    { text: 'string', isCorrect: boolean },
  ],
  explanation: 'string',
  difficulty: 'easy' | 'medium' | 'hard',
}
```

### 2.3 Master index file
`backend/src/data/questions/index.js` - imports all and exports `QUESTION_BANK`

## Phase 3: Frontend TakeTestPage Enhancements

### 3.1 Add skip question functionality
- Skip button that marks question as "skipped" and moves to next

### 3.2 Add question number grid
- Visual grid showing answered/skipped/current questions
- Color coding: green=answered, gray=unanswered, yellow=current

### 3.3 Add auto-save progress
- Save answers to localStorage every 30 seconds
- Restore on page reload

### 3.4 Add submit confirmation dialog
- Modal dialog before final submission
- Show count of answered vs skipped questions

### 3.5 Add 30-minute timer
- Already exists but needs to be consistent (all tests use 30min)

## Phase 4: Results Page Enhancements

### 4.1 Enhanced results display
- Final score with percentage
- Pass/Fail visual indicator
- Correct/Incorrect answer counts
- Detailed explanations for each question
- Certificate eligibility (passed with 80%+)
- Verified Skill badge display

### 4.2 Profile auto-update
- On pass: add verified skill to user profile
- Add earned badge to user badges array
- Add completed test to user's test history

## Phase 5: Cooldown & Rate Limiting

### 5.1 Implementation
- 24-hour cooldown per test per user
- One verified attempt per day (can retake for practice but won't override verified status)
- Store `lastAttemptAt` timestamp in SkillTestResult

## Phase 6: Backend API Updates

### 6.1 New endpoints
- `POST /api/v1/skill-tests/:testId/save-progress` - auto-save answers
- `GET /api/v1/skill-tests/:testId/progress` - get saved progress

### 6.2 Updated endpoints
- `GET /:slug` - include cooldown info in response
- `POST /:testId/submit` - update user profile on pass

## Implementation Order

1. Fix SkillTest model bugs
2. Create all 70 question bank files
3. Create master index
4. Update skillTest.service.js to use question bank
5. Update seedDefaultTests for all skills
6. Update controllers for cooldown + profile update
7. Add auto-save routes
8. Update TakeTestPage with all features
9. Update results display
10. Test everything works

## Total Files to Create/Modify

### New files: ~72 question bank files + 1 index
### Modified files: ~10 existing files
