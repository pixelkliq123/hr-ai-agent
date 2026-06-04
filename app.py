import streamlit as st
import PyPDF2
import os
import urllib.parse
import time
import pandas as pd
from dotenv import load_dotenv
from groq import Groq

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

st.set_page_config(page_title="HR AI Agent", layout="wide")

st.title("HR AI Agent 🤖")
st.subheader("Resume Screening Tool")

col1, col2 = st.columns(2)

with col1:
    jd = st.text_area("Paste Job Description here", height=200)

with col2:
    recruiter_email = st.text_input("Recruiter Email")
    uploaded_files = st.file_uploader("Upload Resumes (PDF)", type="pdf", accept_multiple_files=True)

if uploaded_files and jd:
    if st.button("🚀 Screen All Candidates"):
        results = []
        all_candidates = []

        progress = st.progress(0)
        total = len(uploaded_files)

        for i, uploaded_file in enumerate(uploaded_files):
            pdf_reader = PyPDF2.PdfReader(uploaded_file)
            resume_text = ""
            for page in pdf_reader.pages:
                resume_text += page.extract_text()

            with st.spinner(f"Analyzing {uploaded_file.name}..."):
                response = client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=[
                        {"role": "system", "content": "You are an expert HR recruiter."},
                        {"role": "user", "content": f"""
                            Job Description: {jd}
                            Resume: {resume_text}
                            
                            Analyze and return ONLY in this exact format:
                            NAME: candidate full name
                            EMAIL: candidate email if found else write NA
                            PHONE: candidate phone if found else write NA
                            SCORE: number out of 100
                            RATING: Excellent or Good or Average or Poor
                            STRENGTHS: 2-3 key strengths
                            MISSING: 2-3 missing skills
                            DECISION: SHORTLISTED or REJECTED
                        """}
                    ]
                )
                result = response.choices[0].message.content
                results.append({"filename": uploaded_file.name, "result": result})
                progress.progress((i + 1) / total)
                time.sleep(2)

        for r in results:
            lines = r['result'].strip().split('\n')
            data = {}
            for line in lines:
                if ':' in line:
                    key, value = line.split(':', 1)
                    data[key.strip()] = value.strip()

            all_candidates.append({
                "Name": data.get('NAME', 'Unknown'),
                "Email": data.get('EMAIL', 'NA'),
                "Phone": data.get('PHONE', 'NA'),
                "Score": data.get('SCORE', '0'),
                "Rating": data.get('RATING', 'NA'),
                "Strengths": data.get('STRENGTHS', 'NA'),
                "Missing Skills": data.get('MISSING', 'NA'),
                "Decision": data.get('DECISION', 'REJECTED')
            })

        df = pd.DataFrame(all_candidates)

        st.divider()
        st.subheader("📊 Screening Dashboard")

        total_c = len(df)
        shortlisted = len(df[df['Decision'] == 'SHORTLISTED'])
        rejected = total_c - shortlisted

        m1, m2, m3 = st.columns(3)
        m1.metric("Total Candidates", total_c)
        m2.metric("Shortlisted ✅", shortlisted)
        m3.metric("Rejected ❌", rejected)

        st.divider()

        filter_option = st.selectbox("Filter by", ["All", "SHORTLISTED", "REJECTED"])
        if filter_option != "All":
            filtered_df = df[df['Decision'] == filter_option]
        else:
            filtered_df = df

        def color_decision(val):
            if val == 'SHORTLISTED':
                return 'background-color: #d4edda; color: green'
            else:
                return 'background-color: #f8d7da; color: red'

        def color_score(val):
            try:
                score = int(val)
                if score >= 80:
                    return 'background-color: #d4edda'
                elif score >= 50:
                    return 'background-color: #fff3cd'
                else:
                    return 'background-color: #f8d7da'
            except:
                return ''

        styled_df = filtered_df.style.map(
            color_decision, subset=['Decision']
        ).map(
            color_score, subset=['Score']
        )

        st.dataframe(styled_df, use_container_width=True)

        st.divider()

        st.subheader("📬 Send Messages")

        for candidate in all_candidates:
            with st.expander(f"{'✅' if candidate['Decision'] == 'SHORTLISTED' else '❌'} {candidate['Name']} — {candidate['Score']}/100 — {candidate['Rating']}"):
                st.write(f"📧 Email: {candidate['Email']}")
                st.write(f"📱 Phone: {candidate['Phone']}")
                st.write(f"✅ Strengths: {candidate['Strengths']}")
                st.write(f"❌ Missing: {candidate['Missing Skills']}")

                if candidate['Decision'] == 'SHORTLISTED':
                    interview_date = st.text_input("Interview Date", key=f"date_{candidate['Name']}")
                    interview_time = st.text_input("Interview Time", key=f"time_{candidate['Name']}")

                    if interview_date and interview_time:
                        candidate_message = f"""Dear {candidate['Name']},

Congratulations! You have been shortlisted.

Your interview is scheduled on {interview_date} at {interview_time}.

Please confirm your availability.

Best regards,
HR Team"""

                        recruiter_message = f"""Dear Recruiter,

Candidate {candidate['Name']} has been shortlisted.

Interview Date: {interview_date}
Interview Time: {interview_time}
Candidate Email: {candidate['Email']}
Match Score: {candidate['Score']}/100
Rating: {candidate['Rating']}

Best regards,
HR AI Agent"""

                        if candidate['Phone'] != 'NA':
                            whatsapp_url = f"https://wa.me/{candidate['Phone']}?text={urllib.parse.quote(candidate_message)}"
                            st.markdown(f"[📲 WhatsApp {candidate['Name']}]({whatsapp_url})")

                        if candidate['Email'] != 'NA':
                            email_url = f"mailto:{candidate['Email']}?subject=Interview Scheduled&body={urllib.parse.quote(candidate_message)}"
                            st.markdown(f"[📧 Email {candidate['Name']}]({email_url})")

                        recruiter_url = f"mailto:{recruiter_email}?subject=Shortlisted - {candidate['Name']}&body={urllib.parse.quote(recruiter_message)}"
                        st.markdown(f"[📧 Notify Recruiter]({recruiter_url})")

                else:
                    rejection_message = f"""Dear {candidate['Name']},

Thank you for applying. Unfortunately you have not been selected.

We wish you the best in your future endeavors.

Best regards,
HR Team"""

                    if candidate['Phone'] != 'NA':
                        whatsapp_url = f"https://wa.me/{candidate['Phone']}?text={urllib.parse.quote(rejection_message)}"
                        st.markdown(f"[📲 WhatsApp {candidate['Name']}]({whatsapp_url})")

                    if candidate['Email'] != 'NA':
                        email_url = f"mailto:{candidate['Email']}?subject=Application Update&body={urllib.parse.quote(rejection_message)}"
                        st.markdown(f"[📧 Email {candidate['Name']}]({email_url})")

        st.divider()
        st.download_button(
            label="⬇️ Download Full Report (CSV)",
            data=df.to_csv(index=False).encode('utf-8'),
            file_name="candidates_report.csv",
            mime="text/csv"
        )