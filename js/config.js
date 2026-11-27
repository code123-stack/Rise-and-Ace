// Rise and Ace settings. The site works without keys. Three extras stay hidden until you switch them on here:
// in-page video search (YouTube key), live AI answers (AI key) and spoken interviews.
window.RA_CONFIG = {
  // Spoken mock interviews (the interviewer speaks, the student answers aloud).
  // Kept off until you have tested the microphone on the real website. Change false to true to show it.
  SPOKEN_INTERVIEWS: false,

  // In-page video results. Get a free "YouTube Data API v3" key from Google Cloud Console.
  // Left empty, the Videos page opens the search on YouTube in a new tab instead.
  YOUTUBE_API_KEY: "",

  // Live AI answers (doubt solving and AI interview feedback).
  // Use any OpenAI-compatible chat completions endpoint.
  // IMPORTANT: a key placed here is visible to every visitor. Use it only for testing on
  // your own device. Before going public, move the AI call to a small backend server.
  AI_API_URL: "",   // e.g. https://api.openai.com/v1/chat/completions
  AI_API_KEY: "",
  AI_MODEL: ""
};
