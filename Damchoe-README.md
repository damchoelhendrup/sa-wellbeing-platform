# sa-wellbeing-platform
SA Wellbeing Platform v1 - counsellor and supervisor dashboards (synthetic data)
# SA Wellbeing Platform (Bhutan) – Counsellor Flag Board

A prototype for the Pelsung Tech Wing One-Day Build Challenge. It helps school counsellors see which students may need support first, tracks follow-ups, and gives supervisors school-level patterns without exposing any student. **Uses only the provided synthetic dataset (72 fictional students).**

**Live app:** Appscript link:https://script.google.com/macros/s/AKfycbyttYo1YjqC8SnlM3AWPkJnKVTIvZP9Bu9tpbxnlMvaUUncX99TFG04dq1nO6l7pVpB/exec

## How to run it
There is nothing to install. Open the live link above.

To run your own copy: go to script.google.com → New project → create `Code.gs`, `Data.gs` and an HTML file named `Index`, paste in the matching files from this repo → Deploy → New deployment → Web app (Execute as: Me, Access: Anyone).

## What works
- Loads all 72 students from the CSV (embedded in `Data.gs`) and shows ID, school and class. No names exist.
- Flags every student Urgent / High / Review / None with the baseline rules, in order, and shows the reason next to the flag.
- Urgent students are always at the top, in red with a warning badge. The rest are sorted by priority.
- Counsellors set follow-up to Not started / In progress / Closed. Statuses are saved on the server and reload after a refresh.
- Search by student ID; filter by school, class, flag level and follow-up status. Summary cards show totals and follow-up counts.
- Supervisor view: flag counts by school and by class, bar charts and a cross-school comparison of wellbeing patterns. No student IDs or comments are sent to this view.
- Any group under 5 shows as "<5". Mobile-friendly layout.

**Tested:** the flagging, data cleaning, follow-up saving and privacy logic were checked with 27 automated checks against the real CSV (Urgent 2, High 9, Review 17, None 44). **Not tested:** the screen itself was not run through automated browser tests; I checked it by hand.

## What does not work yet
- **No login.** Anyone with the link can see all student records and change follow-ups. Acceptable only because the data is synthetic.
- Follow-ups are stored in Apps Script properties, not a real database. There is no audit trail of who changed what.
- No survey form, no Dzongkha labels, no automated tests included in this repo.

## Rules and assumptions
- Rules are applied in order; the first match wins, so a lower flag never overrides a higher one.
- "Review" = any two of (sleep ≤ 2, sad most days, no trusted adult) **or** wants a counsellor.
- Blank or invalid answers are never guessed: they count as "unknown" and are shown as a warning.
- "often" (lowercase, S-045) is standardised to "Often", and the screen says so.
- "Prefer not to say" on the self-harm question is not treated as "Yes" (the baseline rules say only Yes = Urgent).
- Only flagged students have a follow-up. "Pending" = Not started + In progress.
- Privacy: every supervisor count under 5, including 0, shows as "<5". If hiding one number would let it be worked out by subtraction from a total, a second number is shown as "withheld". The overall Urgent total (2 students) therefore shows as "<5". Classes are shown inside each school, because most classes exist in only one school. The self-harm question is left out of supervisor patterns.

## My extra improvement: "closer look" indicator
It flags students whose answers are missing or "Prefer not to say" **without changing the official flag**. Why it matters: three students (S-051, S-055, S-058) said they are sad most days and chose "Prefer not to say" on the self-harm question, yet the baseline rules flag them None. S-010 has no sleep answer and could be Review. A counsellor would not otherwise see this.

## Gaps I found in the brief
- "Prefer not to say" on self-harm is treated the same as "No". I suggest a counsellor check whenever it appears with other concerns.
- Free-text comments (e.g. S-023: "Sometimes I don't want to go home") are never read by the rules.
- With only 2 Urgent students overall, even totals are risky to show to supervisors.

## AI tools used
- **ChatGPT (OpenAI)** – used first, to help me write the detailed prompt (project goals, dashboards, privacy rules, testing and deliverables) that I then gave to Claude.
- **Claude (Anthropic)** – used second, with that prompt, my challenge brief and the synthetic CSV. It analysed the data, planned the app, and wrote and tested the code (Apps Script: `Code.gs`, `Data.gs`, `Index.html`).
- No real student data was put into either tool. Only the provided synthetic dataset was used.

**Prompt that worked:** [e.g. my long prompt asked Claude to analyse the PDF and CSV before building anything. This exposed problems in the data (a blank sleep answer, "often" in lowercase, eight "Prefer not to say" answers) before any code was written.]

**Prompt that failed:** [e.g. my prompt asked for Python and Streamlit, but I wanted to build in Google Apps Script. I had to ask again, and the first plan was discarded.]

## What I would build next
Real login for counsellors and supervisors; a proper database with an audit trail; reading comments for risk words; Dzongkha labels; the survey form itself.
