const { Window }  = window.__TAURI__.window;
const { invoke } = window.__TAURI__.core;
const appWindow  = Window.getCurrent();

const STORAGE_KEY = "cherry_tabs_v1";

window.addEventListener("DOMContentLoaded", () => {
  // ─── Window controls ────────────────────────────────────────────────────────
  document.querySelector("#min-btn").addEventListener("click", () => appWindow.minimize());
  document.querySelector("#max-btn").addEventListener("click", () => appWindow.toggleMaximize());
  document.querySelector("#close-btn").addEventListener("click", () => appWindow.close());

  // ─── Tab state ──────────────────────────────────────────────────────────────
  const tabsList   = document.querySelector("#tabs-list");
  const addTabBtn  = document.querySelector("#add-tab-btn");
  let scriptCounter = 1;
  const tabModels   = {};

  // ─── Tabs-list horizontal scroll (mouse-wheel) ────────────────────────────
  tabsList.style.overflowX = "auto";
  tabsList.style.overflowY = "hidden";
  tabsList.style.scrollbarWidth = "none";     // Firefox
  tabsList.style.msOverflowStyle = "none";    // IE/Edge
  const scrollStyle = document.createElement("style");
  scrollStyle.textContent = `#tabs-list::-webkit-scrollbar { display: none; }`;
  document.head.appendChild(scrollStyle);
  document.querySelector(".tabs-container").style.overflow = "hidden";

  tabsList.addEventListener("wheel", (e) => {
    e.preventDefault();
    tabsList.scrollLeft += e.deltaY || e.deltaX;
  }, { passive: false });

  // ─── Status indicator helpers ────────────────────────────────────────────
  const dot        = document.querySelector(".dot");
  const statusText = document.querySelector(".status-text");

  function setConnected(port) {
    dot.className = "dot green";
    dot.style.backgroundColor = "#4dff88";
    dot.style.boxShadow = "0 0 8px #4dff8880";
    statusText.textContent = `Connected(${port})`;
  }

  function setDisconnected() {
    dot.className = "dot red";
    dot.style.backgroundColor = "";
    dot.style.boxShadow = "";
    statusText.textContent = "Disconnected";
  }

  // ─── Monaco init ────────────────────────────────────────────────────────────
  require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });

  require(['vs/editor/editor.main'], function () {
    monaco.editor.defineTheme('cherryTheme', {
      base: 'vs-dark', inherit: true,
      rules: [],
      colors: {
        'editor.background':                '#121213',
        'editor.foreground':                '#d1d1d1',
        'editorLineNumber.foreground':      '#454545',
        'editorLineNumber.activeForeground':'#707070',
        'editorCursor.foreground':          '#aeafad',
      }
    });

    const editor = monaco.editor.create(document.getElementById('monaco-editor-container'), {
      theme: 'cherryTheme',
      automaticLayout: true,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
      fontSize: 13,
      minimap: { enabled: false },
      lineHeight: 1.6,
    });

    // ─── Tab helpers ──────────────────────────────────────────────────────────

    let activeTabId = "1";

    function switchTab(id) {
      document.querySelectorAll(".script-tab").forEach(t =>
        t.classList.toggle("active", t.getAttribute("data-tab-id") === id));
      activeTabId = id;
      editor.setModel(tabModels[id]);
    }

    // ─── Persistence: save all tabs to localStorage ───────────────────────────

    function saveTabs() {
      const tabs = [];
      document.querySelectorAll(".script-tab").forEach(tab => {
        const id   = tab.getAttribute("data-tab-id");
        const name = tab.querySelector(".tab-name").textContent;
        const code = tabModels[id] ? tabModels[id].getValue() : "";
        tabs.push({ id, name, code });
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        tabs,
        activeTabId,
        scriptCounter,
      }));
    }

    // Auto-save on every content change (debounced 500ms)
    let saveTimer = null;
    function scheduleSave() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveTabs, 500);
    }

    // Also save immediately before the window closes
    window.addEventListener("beforeunload", saveTabs);

    // ─── Persistence: restore tabs from localStorage ──────────────────────────

    function restoreTabs() {
      let saved;
      try {
        saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      } catch (_) { saved = null; }

      if (!saved || !Array.isArray(saved.tabs) || saved.tabs.length === 0) {
        // No saved state — boot with a blank Script #1
        tabModels["1"] = monaco.editor.createModel("", "lua");
        editor.setModel(tabModels["1"]);
        return;
      }

      scriptCounter = saved.scriptCounter ?? saved.tabs.length;

      // Restore every saved tab
      saved.tabs.forEach((t, idx) => {
        tabModels[t.id] = monaco.editor.createModel(t.code, "lua");

        if (t.id === "1") {
          // Update the existing DOM tab (already in HTML)
          const existing = document.querySelector(".script-tab[data-tab-id='1'] .tab-name");
          if (existing) existing.textContent = t.name;
          return;
        }

        // Re-create extra tabs in the DOM
        const tab = document.createElement("div");
        tab.className = "script-tab";
        tab.setAttribute("data-tab-id", t.id);
        tab.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path opacity="0.5" fill-rule="evenodd" clip-rule="evenodd" d="M10 22H14C17.7712 22 19.6569 22 20.8284 20.8284C22 19.6569 22 17.7712 22 14V13.5629C22 12.6901 22 12.0344 21.9574 11.5001H18L17.9051 11.5001C16.808 11.5002 15.8385 11.5003 15.0569 11.3952C14.2098 11.2813 13.3628 11.0198 12.6716 10.3285C11.9803 9.63726 11.7188 8.79028 11.6049 7.94316C11.4998 7.16164 11.4999 6.19207 11.5 5.09497L11.5092 2.26057C11.5095 2.17813 11.5166 2.09659 11.53 2.01666C11.1214 2 10.6358 2 10.0298 2C6.23869 2 4.34315 2 3.17157 3.17157C2 4.34315 2 6.22876 2 10V14C2 17.7712 2 19.6569 3.17157 20.8284C4.34315 22 6.22876 22 10 22Z" fill="currentColor"/>
            <path d="M11.5092 2.2601L11.5 5.0945C11.4999 6.1916 11.4998 7.16117 11.6049 7.94269C11.7188 8.78981 11.9803 9.6368 12.6716 10.3281C13.3629 11.0193 14.2098 11.2808 15.057 11.3947C15.8385 11.4998 16.808 11.4997 17.9051 11.4996L21.9574 11.4996C21.9698 11.6552 21.9786 11.821 21.9848 11.9995H22C22 11.732 22 11.5983 21.9901 11.4408C21.9335 10.5463 21.5617 9.52125 21.0315 8.79853C20.9382 8.6713 20.8743 8.59493 20.7467 8.44218C19.9542 7.49359 18.911 6.31193 18 5.49953C17.1892 4.77645 16.0787 3.98536 15.1101 3.3385C14.2781 2.78275 13.862 2.50487 13.2915 2.29834C13.1403 2.24359 12.9408 2.18311 12.7846 2.14466C12.4006 2.05013 12.0268 2.01725 11.5 2.00586L11.5092 2.2601Z" fill="currentColor"/>
          </svg>
          <span class="tab-name">${t.name}</span>
          <div class="tab-close"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></div>
        `;
        tabsList.insertBefore(tab, addTabBtn);
      });

      // Set the model for tab "1" (its DOM node already exists)
      if (!tabModels["1"]) {
        tabModels["1"] = monaco.editor.createModel(saved.tabs.find(t => t.id === "1")?.code ?? "", "lua");
      }
      editor.setModel(tabModels["1"]);

      // Restore the active tab
      const restoredActive = saved.activeTabId && tabModels[saved.activeTabId]
        ? saved.activeTabId : "1";
      switchTab(restoredActive);
    }

    // Boot: restore persisted state
    restoreTabs();

    // Listen for content changes to auto-save
    editor.onDidChangeModelContent(scheduleSave);

    // ─── Tab click/close ──────────────────────────────────────────────────────
    tabsList.addEventListener("click", (e) => {
      const tab   = e.target.closest(".script-tab");
      const close = e.target.closest(".tab-close");

      if (close && tab) {
        const id = tab.getAttribute("data-tab-id");
        if (id === "1") return;

        tab.remove();
        tabModels[id].dispose();
        delete tabModels[id];

        scriptCounter = document.querySelectorAll(".script-tab").length;
        switchTab("1");
        saveTabs();   // persist immediately after close
        return;
      }
      if (tab) {
        switchTab(tab.getAttribute("data-tab-id"));
        saveTabs();
      }
    });

    function createNewTab() {
      scriptCounter++;
      const id = scriptCounter.toString();
      const tab = document.createElement("div");
      tab.className = "script-tab";
      tab.setAttribute("data-tab-id", id);
      tab.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path opacity="0.5" fill-rule="evenodd" clip-rule="evenodd" d="M10 22H14C17.7712 22 19.6569 22 20.8284 20.8284C22 19.6569 22 17.7712 22 14V13.5629C22 12.6901 22 12.0344 21.9574 11.5001H18L17.9051 11.5001C16.808 11.5002 15.8385 11.5003 15.0569 11.3952C14.2098 11.2813 13.3628 11.0198 12.6716 10.3285C11.9803 9.63726 11.7188 8.79028 11.6049 7.94316C11.4998 7.16164 11.4999 6.19207 11.5 5.09497L11.5092 2.26057C11.5095 2.17813 11.5166 2.09659 11.53 2.01666C11.1214 2 10.6358 2 10.0298 2C6.23869 2 4.34315 2 3.17157 3.17157C2 4.34315 2 6.22876 2 10V14C2 17.7712 2 19.6569 3.17157 20.8284C4.34315 22 6.22876 22 10 22Z" fill="currentColor"/>
          <path d="M11.5092 2.2601L11.5 5.0945C11.4999 6.1916 11.4998 7.16117 11.6049 7.94269C11.7188 8.78981 11.9803 9.6368 12.6716 10.3281C13.3629 11.0193 14.2098 11.2808 15.057 11.3947C15.8385 11.4998 16.808 11.4997 17.9051 11.4996L21.9574 11.4996C21.9698 11.6552 21.9786 11.821 21.9848 11.9995H22C22 11.732 22 11.5983 21.9901 11.4408C21.9335 10.5463 21.5617 9.52125 21.0315 8.79853C20.9382 8.6713 20.8743 8.59493 20.7467 8.44218C19.9542 7.49359 18.911 6.31193 18 5.49953C17.1892 4.77645 16.0787 3.98536 15.1101 3.3385C14.2781 2.78275 13.862 2.50487 13.2915 2.29834C13.1403 2.24359 12.9408 2.18311 12.7846 2.14466C12.4006 2.05013 12.0268 2.01725 11.5 2.00586L11.5092 2.2601Z" fill="currentColor"/>
        </svg>
        <span class="tab-name">Script #${scriptCounter}</span>
        <div class="tab-close"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></div>
      `;
      tabModels[id] = monaco.editor.createModel("-- New script...", "lua");
      tabsList.insertBefore(tab, addTabBtn);
      switchTab(id);
      tab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "end" });
      saveTabs();   // persist immediately when a new tab is created
    }

    addTabBtn.addEventListener("click", createNewTab);

    // ─── Attach button ────────────────────────────────────────────────────────
    document.querySelector(".action-btn.attach").addEventListener("click", async () => {
      try {
        const port = await invoke("attach");
        setConnected(port);
      } catch (err) {
        setDisconnected();
        console.warn("Attach failed:", err);
      }
    });

    // ─── Execute button ───────────────────────────────────────────────────────
    // Opiumware requires "OpiumwareScript " prefix on every script — no prefix = no execution.
    document.querySelector(".action-btn.execute").addEventListener("click", async () => {
      const rawCode = editor.getValue();
      const code = "OpiumwareScript " + rawCode;   // official Opiumware API requirement
      try {
        await invoke("execute", { code });
      } catch (err) {
        console.warn("Execute failed:", err);
      }
    });

    // ─── Clear button ─────────────────────────────────────────────────────────
    document.querySelector(".action-btn.clear").addEventListener("click", () => {
      editor.setValue("");
      saveTabs();   // persist the cleared state
    });
  });
});
