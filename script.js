(function () {
  const { jsPDF } = window.jspdf || {};

  function hasPdfEngine() {
    return Boolean(jsPDF);
  }

  function setStatus(el, msg, isError) {
    if (!el) {
      return;
    }
    el.textContent = msg;
    el.className = 'status ' + (isError ? 'status-error' : 'status-success');
  }

  function safeName(v) {
    return String(v || "document")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "document";
  }

  function makePdf(lines, options) {
    if (!hasPdfEngine()) {
      return null;
    }

    const doc = new jsPDF();
    const margin = 16;
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    const fontSize = Number(options?.fontSize || 11);
    const lineSpacing = Number(options?.lineSpacing || 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);

    let y = 20;
    lines.forEach((line) => {
      const rows = doc.splitTextToSize(String(line), w - margin * 2);
      rows.forEach((row) => {
        if (y > h - margin) {
          doc.addPage();
          y = 20;
        }
        doc.text(row, margin, y);
        y += lineSpacing;
      });
      y += 1.5;
    });

    return doc;
  }

  function downloadPdf(lines, filename, options) {
    const doc = makePdf(lines, options);
    if (!doc) {
      return false;
    }
    doc.save(filename);
    return true;
  }

  function setupMobileMenu() {
    const btn = document.getElementById("mobileMenuBtn");
    const menu = document.getElementById("mobileMenu");

    btn?.addEventListener("click", () => {
      const expanded = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!expanded));
      if (menu) {
        menu.hidden = expanded;
      }
    });

    menu?.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => {
        if (menu) {
          menu.hidden = true;
        }
        btn?.setAttribute("aria-expanded", "false");
      });
    });
  }

  function setupFormAutosave() {
    const forms = document.querySelectorAll("form[data-storage-key]");
    forms.forEach((form) => {
      const key = form.getAttribute("data-storage-key");
      if (!key) {
        return;
      }

      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const obj = JSON.parse(saved);
          Array.from(form.elements).forEach((field) => {
            if (field.name && obj[field.name] !== undefined) {
              field.value = obj[field.name];
            }
          });
        } catch (_e) {
          // Ignore invalid saved state.
        }
      }

      form.addEventListener("input", () => {
        const obj = {};
        Array.from(form.elements).forEach((field) => {
          if (field.name) {
            obj[field.name] = field.value;
          }
        });
        localStorage.setItem(key, JSON.stringify(obj));
      });
    });
  }

  // CSV to PDF conversion function
  function csvToPdf(csvText, filename) {
    if (!hasPdfEngine()) {
      return false;
    }

    const doc = new jsPDF();
    const margin = 16;
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    const fontSize = 10;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);

    // Parse CSV
    const lines = csvText.split(/\r?\n/);
    const rows = lines.map(line => {
      // Simple CSV parsing (handles basic comma-separated values)
      return line.split(",").map(cell => cell.trim());
    }).filter(row => row.some(cell => cell));

    if (rows.length === 0) {
      return false;
    }

    // Draw title
    let y = 20;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("CSV Data Export", margin, y);
    y += 10;
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, margin, y);
    y += 12;

    // Calculate column widths
    const colCount = Math.max(...rows.map(row => row.length));
    const colWidth = (w - margin * 2) / colCount;

    // Draw table
    doc.setFontSize(fontSize);
    
    rows.forEach((row, rowIndex) => {
      // Check if we need a new page
      if (y > h - margin) {
        doc.addPage();
        y = 20;
      }

      // Draw header row with background
      if (rowIndex === 0) {
        doc.setFillColor(10, 122, 115);
        doc.rect(margin, y - 4, w - margin * 2, 8, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        
        row.forEach((cell, colIndex) => {
          const x = margin + colIndex * colWidth;
          const cellText = doc.splitTextToSize(String(cell), colWidth - 2);
          doc.text(cellText[0] || "", x + 2, y + 1);
        });
        
        y += 8;
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "normal");
      } else {
        // Alternate row colors
        if (rowIndex % 2 === 0) {
          doc.setFillColor(245, 250, 248);
          doc.rect(margin, y - 4, w - margin * 2, 6, "F");
        }
        
        row.forEach((cell, colIndex) => {
          const x = margin + colIndex * colWidth;
          const cellText = doc.splitTextToSize(String(cell), colWidth - 2);
          doc.text(cellText[0] || "", x + 2, y);
        });
        
        y += 6;
      }
    });

    doc.save(filename);
    return true;
  }

  function setupPdfConverter() {
    const fileInput = document.getElementById("pdfInput");
    const btn = document.getElementById("convertToPdfBtn");
    const out = document.getElementById("pdfConvertStatus");

    btn?.addEventListener("click", async () => {
      const file = fileInput?.files?.[0];

      if (!file) {
        setStatus(out, "Select a TXT, CSV, or image file first.", true);
        return;
      }

      if (!hasPdfEngine()) {
        setStatus(out, "PDF library failed to load.", true);
        return;
      }

      const base = safeName(file.name.replace(/\.[^.]+$/, ""));

      // Handle image files
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = () => {
          const doc = new jsPDF();
          const img = new Image();
          img.onload = () => {
            const pw = doc.internal.pageSize.getWidth();
            const ph = doc.internal.pageSize.getHeight();
            const ratio = Math.min(pw / img.width, ph / img.height);
            const nw = img.width * ratio;
            const nh = img.height * ratio;
            const x = (pw - nw) / 2;
            const y = (ph - nh) / 2;
            const format = file.type.includes("png") ? "PNG" : "JPEG";
            doc.addImage(img, format, x, y, nw, nh);
            doc.save(base + ".pdf");
            setStatus(out, "Image converted successfully.", false);
          };
          img.src = String(reader.result || "");
        };
        reader.readAsDataURL(file);
        return;
      }

      // Handle CSV files
      if (file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv")) {
        const csvText = await file.text();
        const ok = csvToPdf(csvText, base + ".pdf");
        setStatus(out, ok ? "CSV converted to PDF successfully." : "Could not generate PDF.", !ok);
        return;
      }

      // Handle TXT files
      if (file.type !== "text/plain" && !file.name.toLowerCase().endsWith(".txt")) {
        setStatus(out, "Frontend converter supports TXT, CSV, and image files only.", true);
        return;
      }

      const text = await file.text();
      const ok = downloadPdf([text], base + ".pdf", { fontSize: 11, lineSpacing: 6 });
      setStatus(out, ok ? "Text file converted successfully." : "Could not generate PDF.", !ok);
    });
  }

  function setupResumeBuilder() {
    const form = document.getElementById("resumeForm");
    const out = document.getElementById("resumeStatus");

    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!hasPdfEngine()) {
        setStatus(out, "PDF library failed to load.", true);
        return;
      }

      const data = new FormData(form);
      const skills = String(data.get("skills") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => "- " + s);

      const lines = [
        String(data.get("fullName") || "").toUpperCase(),
        String(data.get("headline") || ""),
        `${data.get("email") || ""} | ${data.get("phone") || ""}`,
        "",
        "SUMMARY",
        String(data.get("summary") || ""),
        "",
        "EDUCATION",
        ...String(data.get("education") || "").split(/\r?\n/),
        "",
        "PROJECTS",
        ...String(data.get("projects") || "").split(/\r?\n/),
        "",
        "SKILLS",
        ...(skills.length ? skills : ["-"])
      ];

      const file = safeName(data.get("fullName") || "resume") + "-resume.pdf";
      const ok = downloadPdf(lines, file, { fontSize: 11, lineSpacing: 6 });
      setStatus(out, ok ? "Resume PDF downloaded." : "Could not generate resume PDF.", !ok);
    });
  }

  function setupNotesToPdf() {
    const title = document.getElementById("notesTitle");
    const topic = document.getElementById("notesTopic");
    const notes = document.getElementById("notesInput");
    const btn = document.getElementById("notesToPdfBtn");
    const out = document.getElementById("notesStatus");

    const key = "notes-draft";
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const obj = JSON.parse(saved);
        if (title) {
          title.value = obj.title || "";
        }
        if (topic) {
          topic.value = obj.topic || "";
        }
        if (notes) {
          notes.value = obj.body || "";
        }
      } catch (_e) {
        // Ignore invalid drafts.
      }
    }

    function saveDraft() {
      localStorage.setItem(
        key,
        JSON.stringify({
          title: title?.value || "",
          topic: topic?.value || "",
          body: notes?.value || ""
        })
      );
    }

    title?.addEventListener("input", saveDraft);
    topic?.addEventListener("input", saveDraft);
    notes?.addEventListener("input", saveDraft);

    btn?.addEventListener("click", () => {
      const body = String(notes?.value || "").trim();
      if (!body) {
        setStatus(out, "Write or paste notes first.", true);
        return;
      }

      const t = String(title?.value || "Class Notes").trim() || "Class Notes";
      const tp = String(topic?.value || "General").trim() || "General";
      const lines = [t.toUpperCase(), `Topic: ${tp}`, `Date: ${new Date().toLocaleDateString()}`, "", body];
      const ok = downloadPdf(lines, safeName(t) + "-notes.pdf", { fontSize: 11, lineSpacing: 6 });
      setStatus(out, ok ? "Notes PDF downloaded." : "Could not export notes PDF.", !ok);
    });
  }

  function setupAttendanceCalculator() {
    const form = document.getElementById("attendanceForm");
    const out = document.getElementById("attendanceResult");

    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const held = Number(data.get("held"));
      const attended = Number(data.get("attended"));
      const target = Number(data.get("target"));

      if ([held, attended, target].some((v) => Number.isNaN(v))) {
        setStatus(out, "Enter valid numeric values.", true);
        return;
      }

      if (held < 0 || attended < 0 || target <= 0 || target >= 100) {
        setStatus(out, "Use held/attended >= 0 and target between 1 and 99.", true);
        return;
      }

      if (attended > held) {
        setStatus(out, "Attended classes cannot exceed classes held.", true);
        return;
      }

      const current = held === 0 ? 0 : (attended / held) * 100;
      if (current >= target) {
        const bunkable = Math.floor((attended * 100) / target - held);
        setStatus(out, `Current: ${current.toFixed(2)}%. You can miss ${Math.max(0, bunkable)} class(es) and remain above ${target}%.`, false);
        return;
      }

      const required = Math.ceil((target * held - 100 * attended) / (100 - target));
      setStatus(out, `Current: ${current.toFixed(2)}%. Attend next ${Math.max(0, required)} class(es) continuously to reach ${target}%.`, false);
    });
  }

  function setupCgpaCalculator() {
    const form = document.getElementById("cgpaForm");
    const out = document.getElementById("cgpaResult");

    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const raw = String(data.get("sgpas") || "");
      const nums = raw.split(",").map((v) => Number(v.trim())).filter((v) => !Number.isNaN(v));

      if (!nums.length) {
        setStatus(out, "Provide SGPA values separated by commas.", true);
        return;
      }

      if (nums.some((n) => n < 0 || n > 10)) {
        setStatus(out, "Each SGPA should be between 0 and 10.", true);
        return;
      }

      const cgpa = nums.reduce((s, n) => s + n, 0) / nums.length;
      const percent = cgpa * 9.5;
      const grade = cgpa >= 8.5 ? "Excellent" : cgpa >= 7 ? "Very Good" : cgpa >= 6 ? "Good" : "Needs improvement";
      setStatus(out, `CGPA: ${cgpa.toFixed(2)} | Estimated %: ${percent.toFixed(2)} | Performance: ${grade}`, false);
    });
  }

  function setupAssignmentFormatter() {
    const form = document.getElementById("assignmentForm");
    const out = document.getElementById("assignmentStatus");

    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!hasPdfEngine()) {
        setStatus(out, "PDF library failed to load.", true);
        return;
      }

      const data = new FormData(form);
      const title = String(data.get("title") || "Assignment").trim();
      const fontSize = Number(data.get("fontSize") || 12);
      const lineSpacing = Number(data.get("lineSpacing") || 7);

      const lines = [
        "ASSIGNMENT SUBMISSION",
        "",
        `Title: ${title}`,
        `Subject: ${data.get("subject") || ""}`,
        `Student Name: ${data.get("studentName") || ""}`,
        `Roll Number: ${data.get("rollNo") || ""}`,
        `Institute: ${data.get("institute") || ""}`,
        `Date: ${new Date().toLocaleDateString()}`,
        "",
        "CONTENT",
        String(data.get("content") || "")
      ];

      const ok = downloadPdf(lines, safeName(title) + "-assignment.pdf", { fontSize, lineSpacing });
      setStatus(out, ok ? "Formatted assignment PDF downloaded." : "Could not generate assignment PDF.", !ok);
    });
  }

  // Check if AdSense is properly configured
  function isAdSenseConfigured() {
    // Check if adsbygoogle loaded successfully
    if (!window.adsbygoogle) {
      return false;
    }
    // Check for placeholder publisher ID
    const adElements = document.querySelectorAll('.adsbygoogle');
    if (adElements.length === 0) {
      return false;
    }
    const firstAd = adElements[0];
    const client = firstAd.getAttribute('data-ad-client');
    // If it's still the placeholder, AdSense isn't configured
    return client && !client.includes('XXXXXXXXXXXXXXXX');
  }

  function setupAds() {
    // Check if AdSense is properly configured
    if (!isAdSenseConfigured()) {
      console.log('AdSense not configured - hiding ad slots');
      // Hide all ad containers
      document.querySelectorAll('.ad-card, .ad-zone, .footer-ad, .sidebar-ad').forEach(el => {
        el.style.display = 'none';
      });
      return;
    }

    // AdSense is configured - initialize ads
    console.log('AdSense configured - loading ads');
    
    function initAds() {
      if (window.adsbygoogle && Array.isArray(window.adsbygoogle)) {
        document.querySelectorAll(".adsbygoogle").forEach(() => {
          try {
            window.adsbygoogle.push({});
          } catch (_e) {
            // Duplicate push prevention.
          }
        });
      }
    }

    // Initialize ads
    initAds();
  }

  function setupAdsConsent() {
    const bar = document.getElementById("consentBar");
    const accept = document.getElementById("acceptAdsBtn");
    const decline = document.getElementById("declineAdsBtn");
    const key = "student-tools-ads-consent";

    // Check if AdSense is configured first
    if (!isAdSenseConfigured()) {
      // Hide consent bar if AdSense isn't configured
      if (bar) {
        bar.style.display = 'none';
      }
      return; // Don't show anything if no valid AdSense
    }

    const stored = localStorage.getItem(key);
    if (!stored && bar) {
      bar.style.display = "flex";
    }

    function initAds() {
      if (window.adsbygoogle && Array.isArray(window.adsbygoogle)) {
        document.querySelectorAll(".adsbygoogle").forEach(() => {
          try {
            window.adsbygoogle.push({});
          } catch (_e) {
            // Duplicate push prevention.
          }
        });
      }
    }

    if (stored === "yes") {
      initAds();
    }

    accept?.addEventListener("click", () => {
      localStorage.setItem(key, "yes");
      if (bar) {
        bar.style.display = "none";
      }
      initAds();
    });

    decline?.addEventListener("click", () => {
      localStorage.setItem(key, "no");
      if (bar) {
        bar.style.display = "none";
      }
    });
  }

  function setupYear() {
    const y = document.getElementById("year");
    if (y) {
      y.textContent = String(new Date().getFullYear());
    }
  }

  // PWA Install Prompt
  function setupPwaInstall() {
    let deferredPrompt;
    const installBanner = document.getElementById('pwaInstallBanner');

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      
      // Show install banner after a delay (don't annoy new visitors)
      setTimeout(() => {
        if (installBanner && !localStorage.getItem('pwa-install-dismissed')) {
          installBanner.hidden = false;
          installBanner.style.display = 'flex';
        }
      }, 10000); // Show after 10 seconds
    });

    if (installBanner) {
      const installBtn = document.getElementById('pwaInstallBtn');
      const dismissBtn = document.getElementById('pwaDismissBtn');

      installBtn?.addEventListener('click', async () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          if (outcome === 'accepted') {
            installBanner.hidden = true;
            installBanner.style.display = 'none';
          }
          deferredPrompt = null;
        }
      });

      dismissBtn?.addEventListener('click', () => {
        installBanner.hidden = true;
        installBanner.style.display = 'none';
        localStorage.setItem('pwa-install-dismissed', 'true');
      });
    }

    // Handle successful installation
    window.addEventListener('appinstalled', () => {
      if (installBanner) {
        installBanner.hidden = true;
        installBanner.style.display = 'none';
      }
      deferredPrompt = null;
    });
  }

  // Auto-update handling for PWA
  function setupAutoUpdate() {
    // Create update banner element if not exists
    let updateBanner = document.getElementById('updateBanner');
    if (!updateBanner) {
      updateBanner = document.createElement('div');
      updateBanner.id = 'updateBanner';
      updateBanner.className = 'update-banner';
      updateBanner.innerHTML = `
        <span>🔄 A new version is available!</span>
        <div class="update-actions">
          <button id="updateNowBtn" class="btn btn-primary btn-small">Update Now</button>
          <button id="updateLaterBtn" class="btn btn-ghost btn-small">Later</button>
        </div>
      `;
      document.body.appendChild(updateBanner);
    }

    // Listen for service worker messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SW_ACTIVATED') {
          console.log('Service Worker activated:', event.data);
          
          // Check if this is an update (not first install)
          const lastVersion = localStorage.getItem('app-version');
          if (lastVersion && lastVersion !== event.data.version) {
            // This is an update - show banner
            updateBanner.style.display = 'flex';
          }
          
          // Save current version
          localStorage.setItem('app-version', event.data.version);
        }
      });
    }

    // Update now button
    const updateNowBtn = document.getElementById('updateNowBtn');
    updateNowBtn?.addEventListener('click', () => {
      // Reload to get new version
      window.location.reload();
    });

    // Update later button
    const updateLaterBtn = document.getElementById('updateLaterBtn');
    updateLaterBtn?.addEventListener('click', () => {
      updateBanner.style.display = 'none';
      localStorage.setItem('update-dismissed', 'true');
    });

    // Check for updates on page load
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        // Check for updates periodically (every 5 minutes)
        setInterval(() => {
          registration.update();
        }, 5 * 60 * 1000);
      });
    }
  }

  // Analytics placeholder (for future Google Analytics integration)
  function setupAnalytics() {
    window.trackEvent = function(category, action, label) {
      console.log('Event tracked:', { category, action, label });
      // Add Google Analytics event tracking here when ready
      // gtag('event', action, { event_category: category, event_label: label });
    };
    
    // Track tool usage
    document.querySelectorAll('.tool-card').forEach(card => {
      const toolName = card.querySelector('h3')?.textContent;
      if (toolName) {
        const buttons = card.querySelectorAll('button');
        buttons.forEach(btn => {
          btn.addEventListener('click', () => {
            window.trackEvent('Tool Usage', 'Click', toolName);
          });
        });
      }
    });
  }

  // Enhanced error handling
  function setupErrorHandling() {
    window.addEventListener('error', (e) => {
      console.error('Global error:', e.error);
    });

    window.addEventListener('unhandledrejection', (e) => {
      console.error('Unhandled promise rejection:', e.reason);
    });
  }

  setupMobileMenu();
  setupFormAutosave();
  setupPdfConverter();
  setupResumeBuilder();
  setupNotesToPdf();
  setupAttendanceCalculator();
  setupCgpaCalculator();
  setupAssignmentFormatter();
  setupAds();
  setupAdsConsent();
  setupYear();
  setupPwaInstall();
  setupAutoUpdate();
  setupAnalytics();
  setupErrorHandling();
})();
