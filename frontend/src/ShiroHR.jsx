import { useState, useRef, useCallback } from "react";

const API = "https://hr-ai-agent-back.onrender.com";
const WEIGHTS_DEFAULT = { skills: 40, experience: 30, education: 15, certifications: 15 };

const categoryConfig = {
  "Highly Recommended": { color: "#00C896", bg: "#00C89615", icon: "★" },
  "Recommended":        { color: "#4A9EFF", bg: "#4A9EFF15", icon: "◆" },
  "Consider":           { color: "#F5A623", bg: "#F5A62315", icon: "▲" },
  "Not Recommended":    { color: "#FF5C5C", bg: "#FF5C5C15", icon: "✕" },
};

export default function ShiroHR() {
  const [auth, setAuth] = useState({ username: "", password: "", loggedIn: false, error: "" });
  const [jdFile, setJdFile] = useState(null);
  const [resumeFiles, setResumeFiles] = useState([]);
  const [weights, setWeights] = useState(WEIGHTS_DEFAULT);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [dragOver, setDragOver] = useState(null);
  const [scheduled, setScheduled] = useState([]);
  const [scheduleModal, setScheduleModal] = useState(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleEmail, setScheduleEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState("");
  const [mainTab, setMainTab] = useState("screening");

  const jdRef = useRef();
  const resumeRef = useRef();

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

  const handleLogin = async () => {
    try {
      const res = await fetch(`${API}/api/verify-login`, {
        method: "POST",
        headers: {
          "Authorization": "Basic " + btoa(`${auth.username.trim()}:${auth.password.trim()}`),
          "Content-Type": "application/json"
        }
      });
      if (res.ok) {
        setAuth(a => ({ ...a, loggedIn: true, error: "" }));
      } else {
        setAuth(a => ({ ...a, error: "Invalid credentials. Please try again." }));
      }
    } catch {
      setAuth(a => ({ ...a, error: "Connection error. Try again." }));
    }
  };

  const handleJdDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(null);
    const file = e.dataTransfer.files[0];
    if (file) setJdFile(file);
  }, []);

  const handleResumeDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(null);
    setResumeFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
  }, []);

  const handleSubmit = async () => {
    if (!jdFile || resumeFiles.length === 0) { setError("Please upload a JD and at least one resume."); return; }
    if (totalWeight !== 100) { setError("Weights must add up to 100%."); return; }
    setError(null); setLoading(true);
    const formData = new FormData();
    formData.append("jd_file", jdFile);
    resumeFiles.forEach(f => formData.append("resume_files", f));
    formData.append("weights", JSON.stringify(weights));
    try {
      const res = await fetch(`${API}/api/screen`, {
        method: "POST",
        headers: { "Authorization": "Basic " + btoa(`${auth.username.trim()}:${auth.password.trim()}`) },
        body: formData
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      setResults(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSchedule = (candidate) => {
    setScheduleModal(candidate);
    setScheduleDate("");
    setScheduleTime("");
    setScheduleEmail("");
    setEmailStatus("");
  };

  const confirmSchedule = async () => {
    if (!scheduleDate || !scheduleTime) return;
    setScheduled(prev => [...prev, {
      ...scheduleModal,
      interviewDate: scheduleDate,
      interviewTime: scheduleTime,
      email: scheduleEmail,
      scheduledAt: new Date().toLocaleString()
    }]);

    if (scheduleEmail) {
      setEmailStatus("sending");
      try {
        const res = await fetch(`${API}/api/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Basic " + btoa(`${auth.username.trim()}:${auth.password.trim()}`)
          },
          body: JSON.stringify({
            email: scheduleEmail,
            name: scheduleModal.name || scheduleModal.filename,
            job_title: results?.jd_filename || "the position",
            interview_date: scheduleDate,
            interview_time: scheduleTime
          })
        });
        if (res.ok) setEmailStatus("sent");
        else setEmailStatus("failed");
      } catch {
        setEmailStatus("failed");
      }
    }
    setTimeout(() => setScheduleModal(null), emailStatus === "sent" ? 1500 : 0);
  };

  const filteredResults = results?.candidates?.filter(c => activeTab === "all" ? true : c.category === activeTab);
  const categoryCounts = results?.candidates?.reduce((acc, c) => { acc[c.category] = (acc[c.category] || 0) + 1; return acc; }, {});

  if (!auth.loggedIn) {
    return (
      <div style={styles.root}>
        <div style={styles.loginWrap}>
          <div style={styles.loginBox}>
            <div style={styles.loginLogo}>S</div>
            <div style={styles.loginTitle}>Shiro <span style={styles.logoAccent}>AI HR</span></div>
            <div style={styles.loginSub}>Authorized HR Personnel Only</div>
            <div style={styles.loginForm}>
              <div style={styles.inputGroup}>
                <div style={styles.inputLabel}>Username</div>
                <input style={styles.input} type="text" placeholder="Enter HR username"
                  value={auth.username} onChange={e => setAuth(a => ({ ...a, username: e.target.value }))} />
              </div>
              <div style={styles.inputGroup}>
                <div style={styles.inputLabel}>Password</div>
                <input style={styles.input} type="password" placeholder="Enter password"
                  value={auth.password} onChange={e => setAuth(a => ({ ...a, password: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && handleLogin()} />
              </div>
              {auth.error && <div style={styles.loginError}>{auth.error}</div>}
              <button style={styles.loginBtn} onClick={handleLogin}>Login to Shiro HR</button>
            </div>
            <div style={styles.loginFooter}>PixelKliQ Technologies · Internal Use Only</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logoMark}>S</div>
          <div>
            <div style={styles.logoText}>Shiro <span style={styles.logoAccent}>AI HR</span></div>
            <div style={styles.logoSub}>Intelligent Recruitment Agent · PixelKliQ</div>
          </div>
        </div>
        <div style={styles.headerRight}>
          <button style={{ ...styles.mainTabBtn, ...(mainTab === "screening" ? styles.mainTabActive : {}) }} onClick={() => setMainTab("screening")}>🔍 Screening</button>
          <button style={{ ...styles.mainTabBtn, ...(mainTab === "scheduled" ? styles.mainTabActive : {}), position: "relative" }} onClick={() => setMainTab("scheduled")}>
            📅 Interviews
            {scheduled.length > 0 && <span style={styles.badgeCount}>{scheduled.length}</span>}
          </button>
          <div style={styles.headerBadge}>HR Portal</div>
          <button style={styles.logoutBtn} onClick={() => setAuth({ username: "", password: "", loggedIn: false, error: "" })}>Logout</button>
        </div>
      </div>

      <div style={styles.body}>
        {scheduleModal && (
          <div style={styles.modalOverlay}>
            <div style={styles.modal}>
              <div style={styles.modalTitle}>📅 Schedule Interview</div>
              <div style={styles.modalName}>{scheduleModal.name || scheduleModal.filename}</div>
              <div style={styles.modalCategory}>{scheduleModal.category} · {scheduleModal.score}% match</div>
              <div style={styles.inputGroup}>
                <div style={styles.inputLabel}>Interview Date</div>
                <input style={styles.input} type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} />
              </div>
              <div style={styles.inputGroup}>
                <div style={styles.inputLabel}>Interview Time</div>
                <input style={styles.input} type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} />
              </div>
              <div style={styles.inputGroup}>
                <div style={styles.inputLabel}>Candidate Email (optional)</div>
                <input style={styles.input} type="email" placeholder="candidate@email.com" value={scheduleEmail} onChange={e => setScheduleEmail(e.target.value)} />
              </div>
              {emailStatus === "sending" && <div style={styles.emailSending}>📧 Sending email...</div>}
              {emailStatus === "sent" && <div style={styles.emailSent}>✅ Email sent successfully!</div>}
              {emailStatus === "failed" && <div style={styles.emailFailed}>❌ Email failed to send</div>}
              <div style={styles.modalBtns}>
                <button style={styles.cancelBtn} onClick={() => setScheduleModal(null)}>Cancel</button>
                <button style={styles.confirmBtn} onClick={confirmSchedule}>
                  {scheduleEmail ? "✅ Schedule & Send Email" : "✅ Confirm Schedule"}
                </button>
              </div>
            </div>
          </div>
        )}

        {mainTab === "scheduled" && (
          <div>
            <div style={styles.pageTitle}>📅 Scheduled Interviews <span style={styles.totalCount}>{scheduled.length} interviews</span></div>
            {scheduled.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}>📅</div>
                <div style={styles.emptyText}>No interviews scheduled yet</div>
                <div style={styles.emptyHint}>Go to Screening tab and schedule interviews from candidate cards</div>
              </div>
            ) : (
              <div style={styles.scheduledList}>
                {scheduled.map((s, i) => (
                  <div key={i} style={styles.scheduledCard}>
                    <div style={styles.scheduledHeader}>
                      <div style={styles.scheduledName}>{s.name || s.filename}</div>
                      <div style={{ ...styles.categoryBadge, background: categoryConfig[s.category]?.bg, color: categoryConfig[s.category]?.color }}>{s.category}</div>
                    </div>
                    <div style={styles.scheduledDetails}>
                      <div style={styles.scheduledDetail}>📅 <b>{s.interviewDate}</b></div>
                      <div style={styles.scheduledDetail}>⏰ <b>{s.interviewTime}</b></div>
                      <div style={styles.scheduledDetail}>🎯 Match: <b>{s.score}%</b></div>
                      {s.email && <div style={styles.scheduledDetail}>📧 <b>{s.email}</b></div>}
                    </div>
                    <div style={styles.scheduledAt}>Scheduled at: {s.scheduledAt}</div>
                    <button style={styles.removeScheduleBtn} onClick={() => setScheduled(prev => prev.filter((_, j) => j !== i))}>Remove</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {mainTab === "screening" && (
          !results ? (
            <div style={styles.setupPanel}>
              <div style={styles.card}>
                <div style={styles.stepLabel}><span style={styles.stepNum}>01</span> Job Description</div>
                <div style={{ ...styles.dropZone, ...(dragOver === "jd" ? styles.dropZoneActive : {}) }}
                  onDragOver={e => { e.preventDefault(); setDragOver("jd"); }}
                  onDragLeave={() => setDragOver(null)} onDrop={handleJdDrop} onClick={() => jdRef.current.click()}>
                  <input ref={jdRef} type="file" accept=".pdf,.doc,.docx" style={{ display: "none" }} onChange={e => setJdFile(e.target.files[0])} />
                  {jdFile ? (
                    <div style={styles.fileChip}>
                      <span style={styles.fileIcon}>📄</span>
                      <span style={styles.fileName}>{jdFile.name}</span>
                      <button style={styles.removeBtn} onClick={e => { e.stopPropagation(); setJdFile(null); }}>×</button>
                    </div>
                  ) : (
                    <div style={styles.dropPrompt}>
                      <div style={styles.dropIcon}>⬆</div>
                      <div style={styles.dropText}>Drop JD file or click to browse</div>
                      <div style={styles.dropHint}>PDF, DOC, DOCX supported</div>
                    </div>
                  )}
                </div>
              </div>

              <div style={styles.card}>
                <div style={styles.stepLabel}>
                  <span style={styles.stepNum}>02</span> Candidate Resumes
                  {resumeFiles.length > 0 && <span style={styles.countBadge}>{resumeFiles.length} files</span>}
                </div>
                <div style={{ ...styles.dropZone, minHeight: 100, ...(dragOver === "resume" ? styles.dropZoneActive : {}) }}
                  onDragOver={e => { e.preventDefault(); setDragOver("resume"); }}
                  onDragLeave={() => setDragOver(null)} onDrop={handleResumeDrop} onClick={() => resumeRef.current.click()}>
                  <input ref={resumeRef} type="file" accept=".pdf,.doc,.docx" multiple webkitdirectory=""
                    style={{ display: "none" }} onChange={e => setResumeFiles(prev => [...prev, ...Array.from(e.target.files)])} />
                  {resumeFiles.length === 0 ? (
                    <div style={styles.dropPrompt}>
                      <div style={styles.dropIcon}>📂</div>
                      <div style={styles.dropText}>Drop multiple resumes or select folder</div>
                      <div style={styles.dropHint}>Select as many files as needed</div>
                    </div>
                  ) : (
                    <div style={styles.fileGrid}>
                      {resumeFiles.map((f, i) => (
                        <div key={i} style={styles.fileChipSmall}>
                          <span style={styles.fileIconSm}>📄</span>
                          <span style={styles.fileNameSm}>{f.name.length > 20 ? f.name.slice(0, 18) + "…" : f.name}</span>
                          <button style={styles.removeBtn} onClick={e => { e.stopPropagation(); setResumeFiles(prev => prev.filter((_, j) => j !== i)); }}>×</button>
                        </div>
                      ))}
                      <div style={styles.addMoreChip} onClick={e => { e.stopPropagation(); resumeRef.current.click(); }}>+ Add more</div>
                    </div>
                  )}
                </div>
              </div>

              <div style={styles.card}>
                <div style={styles.stepLabel}><span style={styles.stepNum}>03</span> Scoring Weights
                  <span style={{ ...styles.countBadge, background: totalWeight === 100 ? "#00C89620" : "#FF5C5C20", color: totalWeight === 100 ? "#00C896" : "#FF5C5C" }}>
                    {totalWeight}% / 100%
                  </span>
                </div>
                <div style={styles.weightsGrid}>
                  {Object.entries(weights).map(([key, val]) => (
                    <div key={key} style={styles.weightItem}>
                      <div style={styles.weightLabel}>{key.charAt(0).toUpperCase() + key.slice(1)}</div>
                      <div style={styles.weightRow}>
                        <input type="range" min={0} max={100} value={val}
                          onChange={e => setWeights(w => ({ ...w, [key]: Number(e.target.value) }))} style={styles.slider} />
                        <div style={styles.weightVal}>{val}%</div>
                      </div>
                      <div style={styles.weightBar}><div style={{ ...styles.weightBarFill, width: `${val}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>

              {error && <div style={styles.errorBox}>{error}</div>}
              <button style={{ ...styles.runBtn, opacity: loading ? 0.7 : 1 }} onClick={handleSubmit} disabled={loading}>
                {loading ? <span style={styles.loadingRow}><span style={styles.spinner} />Screening Candidates…</span> : "▶  Run AI Screening"}
              </button>
            </div>
          ) : (
            <div style={styles.resultsPanel}>
              <div style={styles.summaryBar}>
                <div style={styles.summaryTitle}>
                  <button style={styles.backBtn} onClick={() => setResults(null)}>← Back</button>
                  <button style={styles.exportBtn} onClick={async () => {
                    const res = await fetch(`${API}/api/export-excel`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json", "Authorization": "Basic " + btoa(`${auth.username.trim()}:${auth.password.trim()}`) },
                      body: JSON.stringify(results)
                    });
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url; a.download = "ShiroHR_Results.xlsx"; a.click();
                  }}>⬇ Export Excel</button>
                  <span style={styles.totalCount}>{results.candidates.length} candidates</span>
                </div>
                <div style={styles.summaryCards}>
                  {Object.entries(categoryConfig).map(([cat, cfg]) => (
                    <div key={cat} style={{ ...styles.summaryCard, borderColor: cfg.color }}
                      onClick={() => setActiveTab(cat === activeTab ? "all" : cat)}>
                      <div style={{ ...styles.summaryIcon, color: cfg.color }}>{cfg.icon}</div>
                      <div style={{ ...styles.summaryCount, color: cfg.color }}>{categoryCounts?.[cat] || 0}</div>
                      <div style={styles.summaryCat}>{cat}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={styles.tabs}>
                {["all", ...Object.keys(categoryConfig)].map(tab => (
                  <button key={tab} style={{ ...styles.tab, ...(activeTab === tab ? styles.tabActive : {}) }} onClick={() => setActiveTab(tab)}>
                    {tab === "all" ? "All Candidates" : tab}
                    {tab !== "all" && <span style={{ ...styles.tabCount, color: categoryConfig[tab].color }}>{categoryCounts?.[tab] || 0}</span>}
                  </button>
                ))}
              </div>

              <div style={styles.candidateList}>
                {filteredResults?.map((c, i) => {
                  const cfg = categoryConfig[c.category] || { color: "#8892A0", bg: "#8892A015", icon: "?" };
                  const isScheduled = scheduled.some(s => s.filename === c.filename);
                  return (
                    <div key={i} style={{ ...styles.candidateCard, borderLeft: `3px solid ${cfg.color}` }}>
                      <div style={styles.candidateHeader}>
                        <div style={styles.candidateName}>{c.name || c.filename}</div>
                        <div style={styles.candidateActions}>
                          <div style={{ ...styles.categoryBadge, background: cfg.bg, color: cfg.color }}>{cfg.icon} {c.category}</div>
                          <button style={{ ...styles.scheduleBtn, background: isScheduled ? "#00C89620" : "#4A9EFF20", color: isScheduled ? "#00C896" : "#4A9EFF" }}
                            onClick={() => !isScheduled && handleSchedule(c)}>
                            {isScheduled ? "✅ Scheduled" : "📅 Schedule"}
                          </button>
                        </div>
                      </div>
                      <div style={styles.scoreBar}>
                        <div style={styles.scoreLabel}>Match Score</div>
                        <div style={styles.scoreTrack}><div style={{ ...styles.scoreFill, width: `${c.score}%`, background: cfg.color }} /></div>
                        <div style={{ ...styles.scoreNum, color: cfg.color }}>{c.score}%</div>
                      </div>
                      <div style={styles.breakdown}>
                        {Object.entries(c.breakdown || {}).map(([k, v]) => (
                          <div key={k} style={styles.breakdownItem}>
                            <span style={styles.breakdownKey}>{k}</span>
                            <span style={styles.breakdownVal}>{v}%</span>
                          </div>
                        ))}
                      </div>
                      {c.summary && <div style={styles.summary}>{c.summary}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

const styles = {
  root: { fontFamily: "'DM Sans', 'Segoe UI', sans-serif", background: "#0D0F14", minHeight: "100vh", color: "#E8EAF0" },
  loginWrap: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" },
  loginBox: { background: "#13151C", border: "1px solid #1E2130", borderRadius: 16, padding: "40px 36px", width: 360, textAlign: "center" },
  loginLogo: { width: 56, height: 56, borderRadius: 14, background: "linear-gradient(135deg, #F5C842, #E8A020)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 26, color: "#0D0F14", margin: "0 auto 12px" },
  loginTitle: { fontSize: 22, fontWeight: 700, marginBottom: 4 },
  loginSub: { fontSize: 12, color: "#5A6070", marginBottom: 28 },
  loginForm: { display: "flex", flexDirection: "column", gap: 16 },
  inputGroup: { textAlign: "left", marginBottom: 8 },
  inputLabel: { fontSize: 12, color: "#6A7080", marginBottom: 6, fontWeight: 500 },
  input: { width: "100%", background: "#1E2130", border: "1px solid #2A3040", borderRadius: 8, padding: "10px 14px", fontSize: 14, color: "#E8EAF0", outline: "none", boxSizing: "border-box" },
  loginError: { background: "#FF5C5C15", border: "1px solid #FF5C5C40", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#FF5C5C" },
  loginBtn: { background: "linear-gradient(135deg, #F5C842, #E8A020)", color: "#0D0F14", border: "none", borderRadius: 10, padding: "13px", fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 4 },
  loginFooter: { fontSize: 11, color: "#3A4050", marginTop: 24 },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 32px", borderBottom: "1px solid #1E2130", background: "#0A0C10" },
  headerLeft: { display: "flex", alignItems: "center", gap: 14 },
  headerRight: { display: "flex", alignItems: "center", gap: 10 },
  logoMark: { width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #F5C842, #E8A020)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 20, color: "#0D0F14" },
  logoText: { fontSize: 18, fontWeight: 700 },
  logoAccent: { color: "#F5C842" },
  logoSub: { fontSize: 11, color: "#5A6070", marginTop: 2 },
  mainTabBtn: { background: "#1E2130", border: "1px solid #2A3040", color: "#6A7080", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", position: "relative" },
  mainTabActive: { background: "#F5C84220", color: "#F5C842", border: "1px solid #F5C84240" },
  badgeCount: { position: "absolute", top: -6, right: -6, background: "#FF5C5C", color: "white", borderRadius: "50%", width: 16, height: 16, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 },
  headerBadge: { fontSize: 11, padding: "4px 12px", borderRadius: 20, background: "#1E2130", color: "#8892A0", border: "1px solid #2A3040" },
  logoutBtn: { fontSize: 11, padding: "4px 12px", borderRadius: 20, background: "#FF5C5C20", color: "#FF5C5C", border: "1px solid #FF5C5C40", cursor: "pointer" },
  body: { padding: "32px", maxWidth: 860, margin: "0 auto" },
  pageTitle: { fontSize: 20, fontWeight: 700, marginBottom: 20, display: "flex", alignItems: "center", gap: 12 },
  totalCount: { marginLeft: "auto", fontSize: 13, color: "#5A6070", fontWeight: 400 },
  emptyState: { textAlign: "center", padding: "60px 20px" },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 16, color: "#6A7080", marginBottom: 8 },
  emptyHint: { fontSize: 13, color: "#3A4050" },
  scheduledList: { display: "flex", flexDirection: "column", gap: 12 },
  scheduledCard: { background: "#13151C", border: "1px solid #1E2130", borderLeft: "3px solid #4A9EFF", borderRadius: 12, padding: "20px 24px" },
  scheduledHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  scheduledName: { fontSize: 15, fontWeight: 600 },
  scheduledDetails: { display: "flex", gap: 20, marginBottom: 8, flexWrap: "wrap" },
  scheduledDetail: { fontSize: 13, color: "#8892A0" },
  scheduledAt: { fontSize: 11, color: "#3A4050", marginBottom: 12 },
  removeScheduleBtn: { background: "#FF5C5C20", border: "1px solid #FF5C5C40", color: "#FF5C5C", borderRadius: 6, padding: "4px 12px", fontSize: 12, cursor: "pointer" },
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#00000080", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modal: { background: "#13151C", border: "1px solid #1E2130", borderRadius: 16, padding: "32px", width: 380 },
  modalTitle: { fontSize: 18, fontWeight: 700, marginBottom: 12 },
  modalName: { fontSize: 15, fontWeight: 600, color: "#E8EAF0", marginBottom: 4 },
  modalCategory: { fontSize: 12, color: "#5A6070", marginBottom: 20 },
  emailSending: { fontSize: 12, color: "#F5C842", marginBottom: 8 },
  emailSent: { fontSize: 12, color: "#00C896", marginBottom: 8 },
  emailFailed: { fontSize: 12, color: "#FF5C5C", marginBottom: 8 },
  modalBtns: { display: "flex", gap: 10, marginTop: 20 },
  cancelBtn: { flex: 1, background: "#1E2130", border: "1px solid #2A3040", color: "#8892A0", borderRadius: 8, padding: "10px", fontSize: 13, cursor: "pointer" },
  confirmBtn: { flex: 2, background: "linear-gradient(135deg, #F5C842, #E8A020)", color: "#0D0F14", border: "none", borderRadius: 8, padding: "10px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  setupPanel: { display: "flex", flexDirection: "column", gap: 20 },
  card: { background: "#13151C", border: "1px solid #1E2130", borderRadius: 14, padding: "24px" },
  stepLabel: { fontSize: 13, fontWeight: 600, color: "#8892A0", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 },
  stepNum: { background: "#F5C84220", color: "#F5C842", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 },
  countBadge: { background: "#4A9EFF20", color: "#4A9EFF", borderRadius: 20, padding: "2px 10px", fontSize: 11 },
  dropZone: { border: "1.5px dashed #2A3040", borderRadius: 10, padding: 28, cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 80 },
  dropZoneActive: { borderColor: "#F5C842", background: "#F5C84208" },
  dropPrompt: { textAlign: "center" },
  dropIcon: { fontSize: 24, marginBottom: 8, color: "#3A4050" },
  dropText: { fontSize: 14, color: "#6A7080", marginBottom: 4 },
  dropHint: { fontSize: 12, color: "#3A4050" },
  fileChip: { display: "flex", alignItems: "center", gap: 10, background: "#1E2130", borderRadius: 8, padding: "10px 14px" },
  fileIcon: { fontSize: 18 },
  fileName: { fontSize: 13, color: "#C8D0DC", flex: 1 },
  removeBtn: { background: "none", border: "none", color: "#5A6070", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 4px" },
  fileGrid: { display: "flex", flexWrap: "wrap", gap: 8, width: "100%" },
  fileChipSmall: { display: "flex", alignItems: "center", gap: 6, background: "#1E2130", borderRadius: 6, padding: "6px 10px" },
  fileIconSm: { fontSize: 14 },
  fileNameSm: { fontSize: 12, color: "#9AA0B0" },
  addMoreChip: { display: "flex", alignItems: "center", padding: "6px 14px", borderRadius: 6, border: "1px dashed #2A3040", fontSize: 12, color: "#5A6070", cursor: "pointer" },
  weightsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 },
  weightItem: {},
  weightLabel: { fontSize: 12, color: "#6A7080", marginBottom: 8, fontWeight: 500, textTransform: "capitalize" },
  weightRow: { display: "flex", alignItems: "center", gap: 12, marginBottom: 6 },
  slider: { flex: 1, accentColor: "#F5C842", height: 4 },
  weightVal: { fontSize: 14, fontWeight: 700, color: "#F5C842", minWidth: 36, textAlign: "right" },
  weightBar: { height: 3, background: "#1E2130", borderRadius: 2 },
  weightBarFill: { height: "100%", background: "#F5C842", borderRadius: 2, transition: "width 0.2s" },
  errorBox: { background: "#FF5C5C15", border: "1px solid #FF5C5C40", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#FF5C5C" },
  runBtn: { background: "linear-gradient(135deg, #F5C842, #E8A020)", color: "#0D0F14", border: "none", borderRadius: 12, padding: "16px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer" },
  loadingRow: { display: "flex", alignItems: "center", gap: 10 },
  spinner: { width: 16, height: 16, border: "2px solid #0D0F1440", borderTop: "2px solid #0D0F14", borderRadius: "50%", display: "inline-block" },
  resultsPanel: {},
  summaryBar: { marginBottom: 24 },
  summaryTitle: { display: "flex", alignItems: "center", gap: 12, marginBottom: 20, fontSize: 18, fontWeight: 700 },
  backBtn: { background: "#1E2130", border: "1px solid #2A3040", color: "#8892A0", borderRadius: 8, padding: "6px 14px", fontSize: 13, cursor: "pointer" },
  exportBtn: { background: "#00C896", border: "none", color: "#0D0F14", borderRadius: 8, padding: "6px 14px", fontSize: 13, cursor: "pointer", fontWeight: 700 },
  summaryCards: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 },
  summaryCard: { background: "#13151C", border: "1px solid #1E2130", borderBottom: "2px solid", borderRadius: 12, padding: "16px", textAlign: "center", cursor: "pointer" },
  summaryIcon: { fontSize: 20, marginBottom: 6 },
  summaryCount: { fontSize: 28, fontWeight: 800 },
  summaryCat: { fontSize: 11, color: "#5A6070", marginTop: 4 },
  tabs: { display: "flex", gap: 4, marginBottom: 20, background: "#13151C", borderRadius: 10, padding: 4, border: "1px solid #1E2130" },
  tab: { flex: 1, background: "none", border: "none", color: "#5A6070", padding: "8px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 },
  tabActive: { background: "#1E2130", color: "#E8EAF0" },
  tabCount: { fontSize: 11, fontWeight: 700 },
  candidateList: { display: "flex", flexDirection: "column", gap: 12 },
  candidateCard: { background: "#13151C", border: "1px solid #1E2130", borderRadius: 12, padding: "20px 24px" },
  candidateHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  candidateName: { fontSize: 15, fontWeight: 600 },
  candidateActions: { display: "flex", alignItems: "center", gap: 8 },
  categoryBadge: { fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 20 },
  scheduleBtn: { fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 20, border: "none", cursor: "pointer" },
  scoreBar: { display: "flex", alignItems: "center", gap: 12, marginBottom: 12 },
  scoreLabel: { fontSize: 11, color: "#5A6070", minWidth: 80 },
  scoreTrack: { flex: 1, height: 6, background: "#1E2130", borderRadius: 3, overflow: "hidden" },
  scoreFill: { height: "100%", borderRadius: 3, transition: "width 0.6s ease" },
  scoreNum: { fontSize: 14, fontWeight: 700, minWidth: 40, textAlign: "right" },
  breakdown: { display: "flex", gap: 20, marginBottom: 12 },
  breakdownItem: { display: "flex", gap: 6, fontSize: 12 },
  breakdownKey: { color: "#5A6070", textTransform: "capitalize" },
  breakdownVal: { color: "#C8D0DC", fontWeight: 600 },
  summary: { fontSize: 13, color: "#6A7080", lineHeight: 1.6, borderTop: "1px solid #1E2130", paddingTop: 12 },
};
