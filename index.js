/**
 * AI CV Aligner – Single File Version
 * Paste job link + CV → get aligned CV + match score
 */

require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const OpenAI = require("openai");

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/* ------------------ JD FETCHER ------------------ */
async function fetchJD(jobUrl) {
  const { data } = await axios.get(jobUrl);
  const $ = cheerio.load(data);

  return $("body")
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 6000);
}

/* ------------------ RESUME ALIGNER ------------------ */
async function alignResume(cvText, jdText) {
  const prompt = `
You are an ATS resume expert.

RULES:
- Use ONLY existing resume content
- Do NOT add fake skills
- Keep resume concise (1–2 pages)
- Align wording with job description keywords
- ATS-friendly bullets only

RESUME:
${cvText}

JOB DESCRIPTION:
${jdText}

OUTPUT:
Optimized resume text only.
`;

  const res = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }]
  });

  return res.choices[0].message.content;
}

/* ------------------ MATCH SCORER ------------------ */
async function scoreResume(resume, jd) {
  const prompt = `
Compare the resume with the job description.
Return ONLY valid JSON:

{
  "score": number (0-100),
  "matched_skills": [],
  "missing_skills": []
}

RESUME:
${resume}

JOB DESCRIPTION:
${jd}
`;

  const res = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }]
  });

  return JSON.parse(res.choices[0].message.content);
}

/* ------------------ API ENDPOINT ------------------ */
app.post("/align", async (req, res) => {
  try {
    const { jobLink, cvText } = req.body;

    if (!jobLink || !cvText) {
      return res.status(400).json({
        error: "jobLink and cvText are required"
      });
    }

    const jd = await fetchJD(jobLink);
    const optimizedCV = await alignResume(cvText, jd);
    const score = await scoreResume(optimizedCV, jd);

    res.json({
      match_score: score.score,
      matched_skills: score.matched_skills,
      missing_skills: score.missing_skills,
      optimized_resume: optimizedCV
    });

  } catch (err) {
    res.status(500).json({
      error: "Something went wrong",
      details: err.message
    });
  }
});

/* ------------------ START SERVER ------------------ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`AI CV Aligner running on port ${PORT}`)
);
