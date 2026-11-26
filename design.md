# Sweety — UI/UX Design Rules

Goal: simple, accessible, professional healthcare tracking interface. This is an assessment, not a medical advice product. Use fictional glucose readings only. No diagnostic labels or treatment recommendations.

## 1. Visual system

| Token | Value |
|---|---|
| Primary / action | #0F766E |
| Primary hover | #115E59 |
| Page background | #F5F8F7 |
| Surface | #FFFFFF |
| Main text | #172B29 |
| Secondary text | #526663 |
| Border | #D4DFDC |
| Error text | #B42318 |
| Error surface | #FEF3F2 |
| Focus outline | #0F766E |

Use system sans-serif fonts (no external font download required), 16px default body text, 14px labels, 24–28px page title, clear heading hierarchy and tabular numbers for statistics. Spacing scale: 4, 8, 12, 16, 24, 32px. Radius: 8–12px. Use subtle borders and minimal shadows. No gradients, glassmorphism, heavy animation, decorative medical images or unnecessary icons. Check text and control contrast rather than assuming color tokens guarantee accessibility.

## 2. Screens

### Login

Centered form with Sweety wordmark, email, password, primary login button and signup link. Inline field errors, generic invalid-credentials error, pending state and password visibility toggle only if simple. Use appropriate autocomplete attributes.

### Signup

Name, email and password fields, password requirement hint, create-account button and login link. On successful signup, redirect to login with a clear success message. Never display submitted password.

### Dashboard

Header: Sweety wordmark, user name and logout. Main: page heading, selected-date control (today by default, no future dates), Add reading button, Daily / Month-to-date / Monthly tabs, visible report date range, and highest/lowest/average/count summary cards. Daily tab lists readings in chronological slot order with Edit and Delete actions; keep Add reading available from the dashboard and return to the relevant daily view after creation. Monthly tabs show report summaries. Use a small friendly empty state with an add action when appropriate. No fake sample metrics in the real interface.

### Add/Edit form

Reuse one form for both actions. Date, one of four allowed slots, glucose value with mg/dl unit and whole-number hint; prefill edit fields. Disable submission while saving. Allow cancellation. Show exact assignment error examples as appropriate; preserve user inputs on error. Do not hide server errors or replace them with vague success notifications. Refresh current readings and report after mutations; if viewing another date, navigate or indicate where the new reading was saved. If using modal, implement keyboard focus, Escape, accessible labeling and restore focus; otherwise use an accessible inline panel.

### Delete confirmation

Show selected slot/date/value, confirm and cancel; clearly distinguish destructive action. On success update readings and report; on failure preserve data and show a clear message.

## 3. Responsive and accessibility rules

- Desktop: centered content, max width about 1100px, four statistic cards in a row when space permits.
- Mobile: fluid width, 16px side padding, cards in two columns or one for very narrow screens, stacked controls as needed. No horizontal scrolling at 320px. Use readable table/list layout.
- Semantic headings and form labels; keyboard access to all controls; visible focus; accessible tab state; descriptive button names. Never communicate an error by color alone. Use aria-live for relevant status messages; link field errors to inputs. Touch targets should be roughly 44px where possible.
- Show loading, success, validation error, server/network error, unauthorized and empty states. Prevent double submissions. If auth expires, redirect to login without leaking another user's data.
- Statistics: show glucose unit, average with one decimal, count without glucose unit. Empty statistics use an em dash, not zero. Report dates must be explicit; Monthly means previous calendar month.

## 4. Implementation restrictions

Plain CSS and reusable React components, no UI framework or external design generation required. Suggested reusable components: AuthForm (only if helpful), ReadingForm, ReportTabs, StatCard, ReadingsList, EmptyState, ConfirmDialog. Do not create components solely to satisfy a list. Do not add landing pages, onboarding, settings, dark mode, admin or doctor role, charts or animation during required-scope work.

Verify browser layouts at approximately 320px, 768px and 1280px and keyboard-only interaction. Test actual API integration, not just static placeholders. Use Chrome for local browser verification; no mobile emulator needed. Any screenshots included in the submission must be from the working app using demo data.
