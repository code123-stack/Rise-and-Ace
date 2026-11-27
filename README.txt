RISE AND ACE - website starter (version 3)
"Every mistake is a step up."

TWO WAYS TO RUN IT

A) Quick look (no setup)
   Unzip and open index.html in a browser (Chrome works best).
   Everything works as a guest. Accounts, the microphone and the safe AI connection are off.

B) Full version with student accounts (recommended)
   1. Install Node.js 18 or newer from nodejs.org.
   2. In the unzipped folder, run:   node server/server.js
   3. Open http://localhost:3000
   Students can now create an account and log in, and their test history is saved to the account.
   To put it online, use a host that can run Node.js and start it with the same command.
   Use https on the live site so logins are protected.

WHAT IS INCLUDED
- Home page
- Mock tests for 9 exams: JEE Main, NEET, UPSC Prelims, SSC CGL, IBPS PO, CAT, GATE CS, CUET,
  and a university paper (B.Tech first-year Engineering Mathematics).
  Each exam has 11 practice papers: 1 short sample paper and 10 practice papers of 10 questions.
  Total: 99 papers and 982 questions (900 in js/papers/, 82 in js/data.js).
  The Mock tests page shows one card per exam; tap it to see that exam's papers.
  Timer, question palette, mark for review, negative marking, and analysis (score, accuracy,
  topic-wise results, time spent, answer review, past attempts). Search box to find an exam.
- "Show answer" button on every question during a test: shows the correct answer and
  explanation on the spot and locks that question (seen before answering = not attempted).
- Mock interviews: "See a sample answer" button on every interview question.
- Answer key for every paper: an "Answer key" button on each paper in the list and on the
  result page. It shows the question number, the correct option and, on tap, the question and
  explanation. It can be opened without taking the test. It is not shown while a test is running.
- Weak and strong topics: after each test the result page shows "Weak topics to work on"
  (under 50% correct, including not attempted), "Your strong topics" (75% or more correct) and
  "Needs a little more practice" (the rest). Topic results are saved with every attempt, and
  "Your weak and strong topics so far" combines all of a student's tests. It appears on the
  Mock tests page and, for logged-in students, on the account page.
- Tutor > practice with the tutor: 10 questions per round from the chosen subject,
  praises right answers, gives a second try, explains patiently
- Mock interviews: 4 types, written (spoken is hidden until switched on), feedback after each answer
- 3D lab: rotating 3D molecules, projectile motion, simple pendulum
- Student accounts (way B): sign up, log in, log out, history and topic results saved per student

HIDDEN UNTIL SWITCHED ON
Three extras are kept out of sight so that everything a visitor sees works:
- Video search: appears in the menu and on the home page once a YouTube key is in js/config.js.
- "Ask a doubt" (live AI answers): its tab appears on the Tutor page once an AI key is set.
  Until then the page is called "Tutor" and shows guided practice only.
- Spoken interviews: set SPOKEN_INTERVIEWS: true in js/config.js after testing the microphone.

SWITCHING ON LIVE AI ("Ask a doubt" and AI interview feedback)
Start the server with your AI details. Any OpenAI-compatible chat endpoint works:
   AI_API_URL=...  AI_API_KEY=...  AI_MODEL=...  node server/server.js
The key stays on the server and students never see it.
(For a quick test without the server you can put a key in js/config.js, but then it is visible
to visitors, so do not use that on a public site.)

SWITCHING ON VIDEO RESULTS INSIDE THE PAGE
Put a YouTube Data API key in js/config.js. Without it, searches open on YouTube.

IMPORTANT TO KNOW
- All questions are original practice questions written in exam style. They are NOT real
  previous-year papers. The practice papers are shorter and mostly easier than the real exams
  (10 questions each). Answers were checked, but please report any error you find.
- To add papers, copy a paper block in js/papers/<exam>.js (or add a new file and load it in
  tests.html and tutor.html). Give it the same "group" as the exam so it appears under that card.
- Guests' history and topic results are saved only in the browser on that device.
- Spoken interviews need the microphone, which browsers allow on http://localhost and on https
  sites, not on files opened directly.
- Student data is stored in files inside server/data/. Passwords are stored scrambled (hashed),
  never as plain text. This is fine for testing and small numbers of students. Before a large
  launch, move to a proper database and add "forgot password" by email.
- Keep the server/data folder private and back it up.

FILES
index.html, videos.html, tests.html, tutor.html, interview.html, lab.html, account.html
css/style.css        design (lavender glass theme, moving bubbles on every page)
fonts/               Poppins font files (open licence), loaded by css/style.css
js/config.js         YouTube key and optional test AI key
js/data.js           the 9 short sample papers and the interview questions
js/papers/*.js       10 practice papers per exam (one file per exam)
js/common.js         shared menu, accounts and helpers
js/*.js              one file per page
server/server.js     accounts, saved history and the AI connection
