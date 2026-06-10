from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import json
import os
import re
from groq import Groq
import PyPDF2
import docx2txt
import io

app = FastAPI(title="Shiro AI HR", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))


def extract_text(file_bytes: bytes, filename: str) -> str:
    ext = filename.lower().split(".")[-1]
    try:
        if ext == "pdf":
            reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        elif ext in ("doc", "docx"):
            return docx2txt.process(io.BytesIO(file_bytes))
        else:
            return file_bytes.decode("utf-8", errors="ignore")
    except Exception:
        return ""


def screen_candidate(jd_text, resume_text, filename, weights):
    prompt = f"""
You are an expert HR recruiter AI. Evaluate this resume against the job description.

JOB DESCRIPTION:
{jd_text[:3000]}

CANDIDATE RESUME:
{resume_text[:3000]}

SCORING WEIGHTS:
- Skills Match: {weights.get('skills', 40)}%
- Experience: {weights.get('experience', 30)}%
- Education: {weights.get('education', 15)}%
- Certifications: {weights.get('certifications', 15)}%

Return ONLY valid JSON like this:
{{
  "name": "candidate name or filename if not found",
  "score": 75,
  "breakdown": {{
    "skills": 80,
    "experience": 70,
    "education": 75,
    "certifications": 60
  }},
  "category": "Recommended",
  "summary": "2 sentence summary of fit and gaps."
}}

Category rules:
- Highly Recommended: score >= 80
- Recommended: score >= 60
- Consider: score >= 40
- Not Recommended: score < 40
"""
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
    )
    raw = response.choices[0].message.content.strip()
    raw = re.sub(r"```json|```", "", raw).strip()
    result = json.loads(raw)
    result["filename"] = filename
    return result


@app.post("/api/screen")
async def screen_resumes(
    jd_file: UploadFile = File(...),
    resume_files: list[UploadFile] = File(...),
    weights: str = Form('{"skills":40,"experience":30,"education":15,"certifications":15}')
):
    try:
        weights_dict = json.loads(weights)
    except Exception:
        weights_dict = {"skills": 40, "experience": 30, "education": 15, "certifications": 15}

    jd_bytes = await jd_file.read()
    jd_text = extract_text(jd_bytes, jd_file.filename)

    if not jd_text.strip():
        return JSONResponse(status_code=400, content={"error": "Could not extract text from JD file."})

    candidates = []
    for resume in resume_files:
        resume_bytes = await resume.read()
        resume_text = extract_text(resume_bytes, resume.filename)
        if not resume_text.strip():
            candidates.append({
                "filename": resume.filename,
                "name": resume.filename,
                "score": 0,
                "category": "Not Recommended",
                "summary": "Could not extract text from this resume.",
                "breakdown": {"skills": 0, "experience": 0, "education": 0, "certifications": 0}
            })
            continue
        try:
            result = screen_candidate(jd_text, resume_text, resume.filename, weights_dict)
            candidates.append(result)
        except Exception as e:
            candidates.append({
                "filename": resume.filename,
                "name": resume.filename,
                "score": 0,
                "category": "Not Recommended",
                "summary": f"Screening error: {str(e)}",
                "breakdown": {"skills": 0, "experience": 0, "education": 0, "certifications": 0}
            })

    candidates.sort(key=lambda x: x.get("score", 0), reverse=True)

    return {
        "total": len(candidates),
        "candidates": candidates,
        "jd_filename": jd_file.filename
    }


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "Shiro AI HR"}