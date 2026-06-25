from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, File, UploadFile, Form, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
import json
import os
import re
import secrets
import httpx
import PyPDF2
import docx2txt
import io
import openpyxl
from openpyxl.styles import PatternFill, Font, Alignment

app = FastAPI(title="Shiro AI HR", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBasic()
HR_USERNAME = os.environ.get("HR_USERNAME", "hr_admin")
HR_PASSWORD = os.environ.get("HR_PASSWORD", "shiro@2026")
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")

def verify_hr(credentials: HTTPBasicCredentials = Depends(security)):
    correct_username = secrets.compare_digest(credentials.username.strip(), HR_USERNAME.strip())
    correct_password = secrets.compare_digest(credentials.password.strip(), HR_PASSWORD.strip())
    if not (correct_username and correct_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid HR credentials",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username

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

async def screen_candidate(jd_text, resume_text, filename, weights):
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
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://shiro-front.onrender.com",
                "X-Title": "Shiro AI HR"
            },
            json={
                "model": "meta-llama/llama-3.3-70b-instruct:free",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3
            }
        )
    data = response.json()
    raw = data["choices"][0]["message"]["content"].strip()
    raw = re.sub(r"```json|```", "", raw).strip()
    result = json.loads(raw)
    result["filename"] = filename
    return result

@app.post("/api/screen")
async def screen_resumes(
    jd_file: UploadFile = File(...),
    resume_files: list[UploadFile] = File(...),
    weights: str = Form('{"skills":40,"experience":30,"education":15,"certifications":15}'),
    username: str = Depends(verify_hr)
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
            result = await screen_candidate(jd_text, resume_text, resume.filename, weights_dict)
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
    return {"total": len(candidates), "candidates": candidates, "jd_filename": jd_file.filename}

@app.post("/api/export-excel")
async def export_excel(data: dict, username: str = Depends(verify_hr)):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Screening Results"
    header_fill = PatternFill(start_color="1E2130", end_color="1E2130", fill_type="solid")
    header_font = Font(color="F5C842", bold=True)
    headers = ["Name", "File", "Score", "Category", "Skills", "Experience", "Education", "Certifications", "Summary"]
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center")
    colors_map = {
        "Highly Recommended": "00C896",
        "Recommended": "4A9EFF",
        "Consider": "F5A623",
        "Not Recommended": "FF5C5C"
    }
    for row, candidate in enumerate(data.get("candidates", []), 2):
        color = colors_map.get(candidate.get("category", ""), "FFFFFF")
        fill = PatternFill(start_color=color, end_color=color, fill_type="solid")
        values = [
            candidate.get("name", ""),
            candidate.get("filename", ""),
            candidate.get("score", 0),
            candidate.get("category", ""),
            candidate.get("breakdown", {}).get("skills", 0),
            candidate.get("breakdown", {}).get("experience", 0),
            candidate.get("breakdown", {}).get("education", 0),
            candidate.get("breakdown", {}).get("certifications", 0),
            candidate.get("summary", "")
        ]
        for col, value in enumerate(values, 1):
            cell = ws.cell(row=row, column=col, value=value)
            if col == 4:
                cell.fill = fill
                cell.font = Font(bold=True)
    for col in ws.columns:
        max_length = max(len(str(cell.value or "")) for cell in col)
        ws.column_dimensions[col[0].column_letter].width = min(max_length + 4, 50)
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=ShiroHR_Results.xlsx"}
    )

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "Shiro AI HR"}

@app.post("/api/verify-login")
async def verify_login(username: str = Depends(verify_hr)):
    return {"status": "ok", "user": username}