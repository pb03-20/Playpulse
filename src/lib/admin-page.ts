export function renderAdminPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PlayPulse Admin — Telemetry Controller</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090b10;
      --card-bg: rgba(18, 22, 34, 0.75);
      --card-border: rgba(255, 255, 255, 0.08);
      --primary: #38bdf8;
      --primary-glow: rgba(56, 189, 248, 0.15);
      --text: #f1f5f9;
      --text-muted: #94a3b8;
      --danger: #ef4444;
      --danger-hover: #dc2626;
      --danger-bg: rgba(239, 68, 68, 0.1);
      --danger-border: rgba(239, 68, 68, 0.25);
      --success: #10b981;
      --success-bg: rgba(16, 185, 129, 0.1);
      --success-border: rgba(16, 185, 129, 0.25);
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    body {
      background-color: var(--bg);
      background-image: 
        radial-gradient(at 0% 0%, rgba(56, 189, 248, 0.08) 0px, transparent 50%),
        radial-gradient(at 100% 100%, rgba(239, 68, 68, 0.05) 0px, transparent 50%);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px 20px;
    }
    .container {
      width: 100%;
      max-width: 760px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--card-border);
    }
    .logo-area {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .badge {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 4px 10px;
      border-radius: 9999px;
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid var(--danger-border);
      color: #f87171;
    }
    .title {
      font-size: 22px;
      font-weight: 700;
      color: #fff;
    }
    .subtitle {
      font-size: 13px;
      color: var(--text-muted);
    }
    .back-link {
      font-size: 13px;
      color: var(--primary);
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 8px;
      background: var(--primary-glow);
      border: 1px solid rgba(56, 189, 248, 0.2);
      transition: all 0.2s;
    }
    .back-link:hover {
      background: rgba(56, 189, 248, 0.25);
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 24px;
      backdrop-filter: blur(12px);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 12px;
      margin-top: 14px;
    }
    .kpi-box {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 14px 12px;
      text-align: center;
    }
    .kpi-value {
      font-size: 26px;
      font-weight: 700;
      color: #fff;
    }
    .kpi-label {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .danger-card {
      border-color: var(--danger-border);
      background: linear-gradient(180deg, rgba(239, 68, 68, 0.06) 0%, rgba(18, 22, 34, 0.85) 100%);
    }
    .danger-title {
      font-size: 16px;
      font-weight: 600;
      color: #f87171;
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .danger-desc {
      font-size: 13px;
      color: var(--text-muted);
      line-height: 1.5;
      margin-bottom: 20px;
    }
    .btn-reset {
      background: var(--danger);
      color: white;
      border: none;
      border-radius: 10px;
      padding: 12px 20px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 14px rgba(239, 68, 68, 0.35);
      transition: all 0.2s;
    }
    .btn-reset:hover {
      background: var(--danger-hover);
      transform: translateY(-1px);
    }
    .btn-reset:active {
      transform: translateY(0);
    }
    .alert {
      display: none;
      padding: 14px 16px;
      border-radius: 10px;
      font-size: 13px;
      margin-top: 16px;
      line-height: 1.4;
    }
    .alert.success {
      display: block;
      background: var(--success-bg);
      border: 1px solid var(--success-border);
      color: #34d399;
    }
    .alert.error {
      display: block;
      background: var(--danger-bg);
      border: 1px solid var(--danger-border);
      color: #f87171;
    }
    .footer {
      text-align: center;
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-area">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <h1 class="title">PlayPulse</h1>
            <span class="badge">Admin Controller</span>
          </div>
          <p class="subtitle">Isolated Power BI monitoring & telemetry reset controller</p>
        </div>
      </div>
      <a href="/" class="back-link">
        <span>← User App</span>
      </a>
    </div>

    <!-- Live Telemetry Status -->
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h2 style="font-size: 15px; font-weight: 600; color: #fff;">Live Telemetry Counters</h2>
        <button id="btn-refresh" style="background: none; border: 1px solid var(--card-border); color: var(--text-muted); padding: 4px 10px; border-radius: 6px; font-size: 12px; cursor: pointer;">
          🔄 Refresh
        </button>
      </div>
      <div class="grid">
        <div class="kpi-box">
          <div id="kpi-accounts" class="kpi-value">—</div>
          <div class="kpi-label">Accounts</div>
        </div>
        <div class="kpi-box">
          <div id="kpi-apps" class="kpi-value">—</div>
          <div class="kpi-label">Apps</div>
        </div>
        <div class="kpi-box">
          <div id="kpi-reviews" class="kpi-value">—</div>
          <div class="kpi-label">Reviews</div>
        </div>
        <div class="kpi-box">
          <div id="kpi-analyses" class="kpi-value">—</div>
          <div class="kpi-label">Analyses</div>
        </div>
        <div class="kpi-box">
          <div id="kpi-questions" class="kpi-value">—</div>
          <div class="kpi-label">RAG Questions</div>
        </div>
      </div>
    </div>

    <!-- Danger Zone Reset Card -->
    <div class="card danger-card">
      <div class="danger-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span>Telemetry Reset Zone</span>
      </div>
      <p class="danger-desc">
        Resetting will wipe all telemetry counters, sessions, and scraped reviews back to the clean <strong>0 baseline</strong>.
        Normal website users have no access to this control. After resetting here, click <strong>Home ➔ Refresh</strong> in Power BI Desktop to see the dashboard clear.
      </p>

      <button id="btn-reset" class="btn-reset">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
          <path d="M3 3v5h5"/>
          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
          <path d="M16 16h5v5"/>
        </svg>
        <span>Reset Power BI Counters to 0</span>
      </button>

      <div id="status-alert" class="alert"></div>
    </div>

    <div class="footer">
      PlayPulse Executive Monitoring &bull; Secure Administrative Controller
    </div>
  </div>

  <script>
    async function fetchKPIs() {
      try {
        const res = await fetch('/api/powerbi/kpis?_t=' + Date.now());
        if (res.ok) {
          const data = await res.json();
          const map = {};
          data.forEach(item => {
            if (item.Metric && item.Value !== undefined) map[item.Metric] = item.Value;
          });
          document.getElementById('kpi-accounts').textContent = map['Total Test Accounts'] ?? 0;
          document.getElementById('kpi-apps').textContent = map['Total Apps Analyzed'] ?? 0;
          document.getElementById('kpi-reviews').textContent = map['Total Reviews Collected'] ?? 0;
          document.getElementById('kpi-analyses').textContent = map['Completed Analyses'] ?? 0;
          document.getElementById('kpi-questions').textContent = map['RAG Questions'] ?? 0;
        }
      } catch (e) {
        console.error('Failed to fetch KPIs:', e);
      }
    }

    document.getElementById('btn-refresh').addEventListener('click', fetchKPIs);
    fetchKPIs();

    document.getElementById('btn-reset').addEventListener('click', async () => {
      const alertBox = document.getElementById('status-alert');
      alertBox.className = 'alert';
      alertBox.style.display = 'none';

      if (!confirm("Are you sure you want to reset all Power BI telemetry to 0?")) {
        return;
      }

      try {
        const res = await fetch('/api/powerbi/reset', { method: 'POST' });
        if (res.ok) {
          alertBox.className = 'alert success';
          alertBox.innerHTML = '<strong>Success!</strong> All telemetry counters reset to 0. Now go to <strong>Power BI Desktop</strong> and click <strong>Home ➔ Refresh</strong> to see all cards clear.';
          fetchKPIs();
        } else {
          alertBox.className = 'alert error';
          alertBox.textContent = 'Failed to reset metrics. Server returned status ' + res.status;
        }
      } catch (err) {
        alertBox.className = 'alert error';
        alertBox.textContent = 'Network error while attempting to reset: ' + err.message;
      }
    });
  </script>
</body>
</html>`;
}
