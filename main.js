/*
THIS IS A BUNDLED FILE BY ESBUILD
if you want to view the source, please visit the github repository instead
*/

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => TaskLensPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian13 = require("obsidian");

// src/services/TaskManager.ts
var import_obsidian = require("obsidian");

// src/models/Task.ts
function getTaskStatus(task) {
  if (task.completed)
    return "completed" /* Completed */;
  if (task.dueDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(task.dueDate);
    due.setHours(0, 0, 0, 0);
    if (due < today)
      return "overdue" /* Overdue */;
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1e3 * 60 * 60 * 24));
    if (diffDays <= 3 && diffDays >= 0)
      return "urgent" /* Urgent */;
    return "upcoming_week" /* UpcomingWeek */;
  }
  return "no_date" /* NoDate */;
}

// src/services/TaskManager.ts
var TaskManager = class extends import_obsidian.Events {
  constructor(parser, app) {
    super();
    this.parser = parser;
    this.app = app;
    this.tasks = [];
    this.filteredTasks = [];
    this.currentStatusFilter = "open" /* Open */;
    this.currentCourseFilter = null;
    this.currentSortBy = "due-date" /* DueDate */;
  }
  async loadTasks() {
    this.tasks = await this.parser.findAllTasks();
    this.applyFiltersAndSort();
    this.trigger("tasks-updated");
  }
  /**
   * Toggle a task's completion state in its file
   */
  async toggleTaskCompletion(task) {
    const file = this.app.vault.getAbstractFileByPath(task.filePath);
    if (file instanceof import_obsidian.TFile) {
      const content = await this.app.vault.read(file);
      const lines = content.split("\n");
      if (lines[task.lineNumber]) {
        lines[task.lineNumber] = lines[task.lineNumber].includes("[x]") ? lines[task.lineNumber].replace("[x]", "[ ]") : lines[task.lineNumber].replace("[ ]", "[x]");
        await this.app.vault.modify(file, lines.join("\n"));
        await this.refreshFileTask(task.filePath);
      }
    }
  }
  /**
   * Delete a task from its file
   */
  async deleteTask(task) {
    const file = this.app.vault.getAbstractFileByPath(task.filePath);
    if (file instanceof import_obsidian.TFile) {
      const content = await this.app.vault.read(file);
      const lines = content.split("\n");
      if (lines[task.lineNumber] && lines[task.lineNumber].includes(task.title)) {
        lines.splice(task.lineNumber, 1);
        await this.app.vault.modify(file, lines.join("\n"));
        await this.refreshFileTask(task.filePath);
      } else {
        console.warn("Task line mismatch, skipping delete to prevent data loss.");
      }
    }
  }
  /**
   * Update a task's title and/or due date
   */
  async updateTask(task, newTitle, newDate) {
    const file = this.app.vault.getAbstractFileByPath(task.filePath);
    if (file instanceof import_obsidian.TFile) {
      const content = await this.app.vault.read(file);
      const lines = content.split("\n");
      if (lines[task.lineNumber]) {
        const originalLine = lines[task.lineNumber];
        const match = originalLine.match(/^(\s*-\s\[.\]\s)(.*)$/);
        if (match) {
          const prefix = match[1];
          let newLine = `${prefix}${newTitle}`;
          if (newDate) {
            const dateStr = this.formatDate(newDate);
            newLine += ` [due:: ${dateStr}]`;
          }
          lines[task.lineNumber] = newLine;
          await this.app.vault.modify(file, lines.join("\n"));
          await this.refreshFileTask(task.filePath);
        }
      }
    }
  }
  async refreshFileTask(filePath) {
    const fileTasks = await this.parser.getTasksFromFile(filePath);
    this.tasks = this.tasks.filter((t) => t.filePath !== filePath);
    this.tasks.push(...fileTasks);
    this.applyFiltersAndSort();
    this.trigger("tasks-updated");
  }
  getAllTasks() {
    return [...this.tasks];
  }
  getFilteredTasks() {
    return [...this.filteredTasks];
  }
  getScannedFiles() {
    return this.parser.getFilesToScan().map((file) => file.path);
  }
  getStatistics() {
    const total = this.tasks.length;
    const completed = this.tasks.filter((t) => t.completed).length;
    const overdue = this.tasks.filter((t) => getTaskStatus(t) === "overdue" /* Overdue */).length;
    const upcoming = this.tasks.filter((t) => getTaskStatus(t) === "upcoming_week" /* UpcomingWeek */).length;
    const urgent = this.tasks.filter((t) => getTaskStatus(t) === "urgent" /* Urgent */).length;
    const courses = new Set(this.tasks.map((t) => t.fileName)).size;
    return { total, completed, overdue, upcoming, urgent, courses };
  }
  getCourseNames() {
    return Array.from(new Set(this.tasks.map((t) => t.fileName))).sort();
  }
  setStatusFilter(status) {
    this.currentStatusFilter = status;
    this.applyFiltersAndSort();
    this.trigger("tasks-updated");
  }
  setCourseFilter(course) {
    this.currentCourseFilter = course;
    this.applyFiltersAndSort();
    this.trigger("tasks-updated");
  }
  setSortBy(sortBy) {
    this.currentSortBy = sortBy;
    this.applyFiltersAndSort();
    this.trigger("tasks-updated");
  }
  getCurrentFilters() {
    return {
      status: this.currentStatusFilter,
      course: this.currentCourseFilter,
      sortBy: this.currentSortBy
    };
  }
  async addTask(title, date, filePath) {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (file instanceof import_obsidian.TFile) {
      let content = await this.app.vault.read(file);
      let taskLine = `
- [ ] ${title}`;
      if (date) {
        const dateStr = this.formatDate(date);
        taskLine += ` [due:: ${dateStr}]`;
      }
      await this.app.vault.modify(file, content + taskLine);
      await this.refreshFileTask(filePath);
    }
  }
  formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  applyFiltersAndSort() {
    this.filteredTasks = this.tasks.filter((task) => {
      if (this.currentStatusFilter !== "all" /* All */) {
        if (this.currentStatusFilter === "open" /* Open */) {
          if (task.completed)
            return false;
        } else {
          if (getTaskStatus(task) !== this.currentStatusFilter)
            return false;
        }
      }
      if (this.currentCourseFilter && task.fileName !== this.currentCourseFilter)
        return false;
      return true;
    });
    this.filteredTasks.sort((a, b) => {
      const weightA = this.getStatusWeight(a);
      const weightB = this.getStatusWeight(b);
      if (weightA !== weightB)
        return weightA - weightB;
      if (a.dueDate && b.dueDate)
        return a.dueDate.getTime() - b.dueDate.getTime();
      if (a.dueDate)
        return -1;
      if (b.dueDate)
        return 1;
      return 0;
    });
  }
  getStatusWeight(task) {
    const status = getTaskStatus(task);
    switch (status) {
      case "overdue" /* Overdue */:
        return 1;
      case "urgent" /* Urgent */:
        return 2;
      case "upcoming_week" /* UpcomingWeek */:
        return 3;
      case "no_date" /* NoDate */:
        return 4;
      case "completed" /* Completed */:
        return 5;
      default:
        return 3;
    }
  }
};

// src/services/TaskParser.ts
var import_obsidian2 = require("obsidian");
var TaskParser = class {
  constructor(app, settings) {
    this.app = app;
    this.settings = settings;
  }
  /**
   * RENAMED: Matches TaskManager.loadTasks()
   */
  async findAllTasks() {
    const tasks = [];
    const filesToScan = this.getFilesToScan();
    for (const file of filesToScan) {
      const fileTasks = await this.parseTasksFromFile(file);
      tasks.push(...fileTasks);
    }
    return tasks;
  }
  /**
   * RENAMED: Matches TaskManager.refreshFileTask()
   */
  async getTasksFromFile(filePath) {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (file instanceof import_obsidian2.TFile) {
      return this.parseTasksFromFile(file);
    }
    return [];
  }
  // --- Private Helpers ---
  getFilesToScan() {
    const allMarkdownFiles = this.app.vault.getMarkdownFiles();
    if (this.settings.scanFolders.length === 0) {
      return allMarkdownFiles;
    }
    return allMarkdownFiles.filter((file) => {
      return this.settings.scanFolders.some((folder) => {
        var _a, _b;
        const normalizedFolder = folder.replace(/^\/|\/$/g, "");
        const filePath = file.path;
        if (filePath === normalizedFolder || filePath === `${normalizedFolder}.md`) {
          return true;
        }
        if (this.settings.scanRecursively) {
          return filePath.startsWith(normalizedFolder + "/");
        } else {
          const fileFolder = ((_a = file.parent) == null ? void 0 : _a.path) === "/" ? "" : ((_b = file.parent) == null ? void 0 : _b.path) || "";
          return fileFolder === normalizedFolder;
        }
      });
    });
  }
  async parseTasksFromFile(file) {
    const tasks = [];
    const content = await this.app.vault.read(file);
    const lines = content.split("\n");
    const cache = this.app.metadataCache.getFileCache(file);
    const courseName = this.getCourseName(file, cache);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const taskMatch = line.match(/^(\s*)-\s\[([ xX])\]\s(.+)$/);
      if (taskMatch) {
        const completed = taskMatch[2].toLowerCase() === "x";
        const taskText = taskMatch[3];
        const { title, startDate, dueDate } = this.parseTaskMetadata(taskText);
        const task = {
          id: `${file.path}:${i}`,
          title,
          completed,
          filePath: file.path,
          fileName: courseName,
          lineNumber: i,
          startDate,
          dueDate,
          originalText: line
        };
        tasks.push(task);
      }
    }
    return tasks;
  }
  getCourseName(file, cache) {
    var _a;
    switch (this.settings.courseDetection) {
      case "per-file":
        return file.basename;
      case "per-folder":
        return ((_a = file.parent) == null ? void 0 : _a.name) || file.basename;
      case "frontmatter":
        if (cache == null ? void 0 : cache.frontmatter) {
          const val = cache.frontmatter[this.settings.courseFrontmatterKey];
          if (val)
            return String(val);
        }
        return file.basename;
      default:
        return file.basename;
    }
  }
  parseTaskMetadata(taskText) {
    let title = taskText;
    let startDate;
    let dueDate;
    const startRegex = /\[?\(?start::\s*(\d{4}-\d{2}-\d{2})[\])]?/gi;
    const startMatch = startRegex.exec(taskText);
    if (startMatch) {
      startDate = new Date(startMatch[1]);
      title = title.replace(startRegex, "");
    }
    const dueRegex = /\[?\(?due::\s*(\d{4}-\d{2}-\d{2})[\])]?/gi;
    const dueMatch = dueRegex.exec(taskText);
    if (dueMatch) {
      dueDate = new Date(dueMatch[1]);
      title = title.replace(dueRegex, "");
    }
    if (!dueDate) {
      const emojiMatch = taskText.match(/\u{1F4C5}\s*(\d{4}-\d{2}-\d{2})/u);
      if (emojiMatch) {
        dueDate = new Date(emojiMatch[1]);
        title = title.replace(/\u{1F4C5}\s*\d{4}-\d{2}-\d{2}\s*/gu, "");
      }
    }
    title = title.replace(/\s+/g, " ").trim();
    return { title, startDate, dueDate };
  }
};

// src/settings/Settings.ts
var DEFAULT_SETTINGS = {
  scanFolders: [],
  scanRecursively: true,
  courseDetection: "per-file",
  courseFrontmatterKey: "course",
  startDateKey: "start",
  dueDateKey: "due",
  colorScheme: "inherit",
  colorMode: "status",
  colors: {
    overdue: "#e63946",
    urgent: "#fb8500",
    active: "#2a9d8f",
    completed: "#457b9d"
  },
  topicColors: {},
  hasSeenWelcome: false,
  hasClickedRibbonIcon: false
};
function getTopicColor(topic, settings) {
  if ((settings == null ? void 0 : settings.topicColors) && settings.topicColors[topic]) {
    return settings.topicColors[topic];
  }
  const defaultPalette = ["#4cc9f0", "#f72585", "#7209b7", "#3a0ca3", "#4361ee", "#4caf50"];
  let hash = 0;
  for (let i = 0; i < topic.length; i++)
    hash = topic.charCodeAt(i) + ((hash << 5) - hash);
  return defaultPalette[Math.abs(hash) % defaultPalette.length];
}

// src/settings/SettingsTab.ts
var import_obsidian4 = require("obsidian");

// src/modals/WelcomeModal.ts
var import_obsidian3 = require("obsidian");
var WelcomeModal = class extends import_obsidian3.Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("tasklens-welcome-modal");
    const header = contentEl.createDiv("welcome-header");
    header.setCssProps({ "text-align": "center", "margin-bottom": "20px" });
    header.createEl("h1", { text: "Welcome to TaskLens \u{1F680}" });
    header.createEl("p", { text: "Your command center for tasks, timelines, and projects.", cls: "text-muted" });
    const tutorial = contentEl.createDiv("welcome-tutorial");
    this.createStep(tutorial, "\u{1F4CA}", "The dashboard", "Click the new Dashboard icon in the left ribbon to open your master view. It combines your Timeline, Stats, and Task List.");
    this.createStep(tutorial, "\u{1F5B1}\uFE0F", "Move & resize", 'By default, the layout is locked for a clean look. Click the "Move" icon (arrow cross) in the left ribbon to unlock tabs and arrange widgets.');
    this.createStep(tutorial, "\u2795", "Quick add", 'Click the pulsing "+" icon at the top right of the dashboard to instantly create tasks in any file.');
    this.createStep(tutorial, "\u{1F4DD}", "Inline editing", "Hover over any task in the list to reveal the Pencil (edit) and Trash (delete) icons.");
    this.createStep(tutorial, "\u{1F3AF}", "Smart filters", 'Click any statistic card (like "Urgent") to instantly filter your task list!');
    contentEl.createEl("hr");
    new import_obsidian3.Setting(contentEl).setName("Do not show this window again").setDesc("You can always reopen this from the Settings tab.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.hasSeenWelcome).onChange((value) => {
        this.plugin.settings.hasSeenWelcome = value;
        void this.plugin.saveSettings().then(() => this.plugin.refreshViews());
      })
    );
    const btnContainer = contentEl.createDiv();
    btnContainer.setCssProps({ display: "flex", "justify-content": "center", "margin-top": "15px" });
    new import_obsidian3.Setting(btnContainer).addButton((btn) => btn.setButtonText("Got it!").setCta().onClick(() => {
      this.plugin.refreshViews();
      this.close();
    }));
  }
  createStep(container, icon, title, desc) {
    const row = container.createDiv("welcome-step");
    row.setCssProps({ display: "flex", gap: "15px", "margin-bottom": "15px", "align-items": "flex-start", padding: "10px", "background-color": "var(--background-secondary)", "border-radius": "8px" });
    const iconEl = row.createDiv("step-icon");
    iconEl.setText(icon);
    iconEl.setCssProps({ "font-size": "24px", "line-height": "1.2" });
    const textDiv = row.createDiv("step-text");
    const titleEl = textDiv.createEl("h3", { text: title });
    titleEl.setCssProps({ margin: "0 0 4px 0", "font-size": "1.1em" });
    const descEl = textDiv.createEl("span", { text: desc, cls: "text-muted" });
    descEl.setCssProps({ "font-size": "0.9em", "line-height": "1.4" });
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/settings/SettingsTab.ts
var SettingsTab = class extends import_obsidian4.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("tasklens-settings");
    new import_obsidian4.Setting(containerEl).setName("TaskLens settings").setHeading().addExtraButton(
      (btn) => btn.setIcon("help-circle").setTooltip("Show tutorial").onClick(() => {
        new WelcomeModal(this.app, this.plugin).open();
      })
    );
    const scanDetails = containerEl.createEl("details");
    scanDetails.open = true;
    scanDetails.createEl("summary", { text: "Vault scanning" });
    const scanPathsSetting = new import_obsidian4.Setting(scanDetails).setName("Scan paths").setDesc("Folders (e.g. Uni/Math)\nor specific files (e.g. Projects/Todo.md).\n\nOne per line.\nLeave empty to scan entire vault.").addTextArea((text) => {
      text.setPlaceholder("Projects\nUni/History\nTo-Do.md").setValue(this.plugin.settings.scanFolders.join("\n")).onChange((value) => {
        this.plugin.settings.scanFolders = value.split("\n").map((s) => s.trim()).filter((s) => s.length > 0);
        void this.plugin.saveSettings();
      });
    });
    scanPathsSetting.settingEl.addClass("scan-paths-setting");
    new import_obsidian4.Setting(scanDetails).setName("Recursive scan").setDesc("Scan all subfolders inside the folders specified above?").addToggle((t) => t.setValue(this.plugin.settings.scanRecursively).onChange((v) => {
      this.plugin.settings.scanRecursively = v;
      void this.plugin.saveSettings();
    }));
    const parserDetails = containerEl.createEl("details");
    parserDetails.createEl("summary", { text: "Task parsing" });
    new import_obsidian4.Setting(parserDetails).setName("Start key").setDesc("Inline text used to find the start date. Example: [start:: 2026-02-02]").addText((t) => t.setValue(this.plugin.settings.startDateKey).onChange((v) => {
      this.plugin.settings.startDateKey = v;
      void this.plugin.saveSettings();
    }));
    new import_obsidian4.Setting(parserDetails).setName("Due key").setDesc("Inline text used to find the due date. You can combine them in one bracket! Example: [start:: 2026-02-02 due:: 2026-03-03]").addText((t) => t.setValue(this.plugin.settings.dueDateKey).onChange((v) => {
      this.plugin.settings.dueDateKey = v;
      void this.plugin.saveSettings();
    }));
    const uiDetails = containerEl.createEl("details");
    uiDetails.open = true;
    uiDetails.createEl("summary", { text: "Appearance & colors" });
    new import_obsidian4.Setting(uiDetails).setName("Color mode").addDropdown((d) => d.addOption("status", "By urgency (overdue, active)").addOption("course", "By topic (file palette)").setValue(this.plugin.settings.colorMode).onChange((v) => {
      this.plugin.settings.colorMode = v;
      void this.plugin.saveSettings().then(() => {
        this.plugin.refreshViews();
        renderColorPickers();
      });
    }));
    const colorPickersContainer = uiDetails.createDiv();
    const renderColorPickers = () => {
      colorPickersContainer.empty();
      if (this.plugin.settings.colorMode === "status") {
        new import_obsidian4.Setting(colorPickersContainer).setName("Overdue color").addColorPicker((c) => c.setValue(this.plugin.settings.colors.overdue).onChange((v) => {
          this.plugin.settings.colors.overdue = v;
          void this.plugin.saveSettings().then(() => this.plugin.refreshViews());
        }));
        new import_obsidian4.Setting(colorPickersContainer).setName("Urgent color").addColorPicker((c) => c.setValue(this.plugin.settings.colors.urgent).onChange((v) => {
          this.plugin.settings.colors.urgent = v;
          void this.plugin.saveSettings().then(() => this.plugin.refreshViews());
        }));
        new import_obsidian4.Setting(colorPickersContainer).setName("Active color").addColorPicker((c) => c.setValue(this.plugin.settings.colors.active).onChange((v) => {
          this.plugin.settings.colors.active = v;
          void this.plugin.saveSettings().then(() => this.plugin.refreshViews());
        }));
        new import_obsidian4.Setting(colorPickersContainer).setName("Completed color").addColorPicker((c) => c.setValue(this.plugin.settings.colors.completed).onChange((v) => {
          this.plugin.settings.colors.completed = v;
          void this.plugin.saveSettings().then(() => this.plugin.refreshViews());
        }));
      } else {
        const helperText = colorPickersContainer.createEl("p", {
          text: "Assign a custom color to each of your active topics.",
          cls: "text-muted"
        });
        helperText.setCssProps({ "margin-left": "14px", "margin-bottom": "12px", "font-size": "0.9em" });
        const allTasks = this.plugin.taskManager.getAllTasks();
        const uniqueTopics = Array.from(new Set(allTasks.map((t) => t.fileName).filter((t) => Boolean(t))));
        if (uniqueTopics.length === 0) {
          const emptyText = colorPickersContainer.createEl("p", { text: "No active topics found. Add some tasks first!" });
          emptyText.setCssProps({ "margin-left": "14px", "font-style": "italic" });
          return;
        }
        uniqueTopics.forEach((topic) => {
          const savedColor = getTopicColor(topic, this.plugin.settings);
          new import_obsidian4.Setting(colorPickersContainer).setName(`${topic} color`).addColorPicker((c) => c.setValue(savedColor).onChange((v) => {
            this.plugin.settings.topicColors[topic] = v;
            void this.plugin.saveSettings().then(() => this.plugin.refreshViews());
          }));
        });
      }
    };
    renderColorPickers();
    containerEl.createEl("br");
    containerEl.createEl("hr");
    const supportDiv = containerEl.createDiv();
    supportDiv.setCssProps({
      "text-align": "center",
      "margin-top": "20px",
      "margin-bottom": "20px"
    });
    const supportText = supportDiv.createEl("p", {
      text: "If this dashboard helps you stay organized, consider supporting its development!"
    });
    supportText.setCssProps({
      "color": "var(--text-muted)",
      "font-size": "0.9em",
      "margin-bottom": "12px"
    });
    const bmcLink = supportDiv.createEl("a", {
      href: "https://buymeacoffee.com/JoblessDev"
    });
    const bmcImg = bmcLink.createEl("img");
    bmcImg.setAttribute("src", "https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png");
    bmcImg.setAttribute("width", "200");
    bmcImg.setAttribute("alt", "Buy Me A Coffee");
  }
};

// src/views/DashboardView.ts
var import_obsidian9 = require("obsidian");

// src/views/TimelineComponent.ts
var import_obsidian5 = require("obsidian");
var TimelineComponent = class {
  constructor(container, app, tasks, daysToShow = 10, settings) {
    this.scrollContainer = null;
    this.tooltipEl = null;
    // Drag state
    this.isDragging = false;
    this.startX = 0;
    this.scrollLeftPos = 0;
    this.container = container;
    this.app = app;
    this.tasks = tasks;
    this.daysToShow = daysToShow;
    this.settings = settings;
  }
  getCourseColor(courseName) {
    var _a;
    if (((_a = this.settings) == null ? void 0 : _a.topicColors) && this.settings.topicColors[courseName]) {
      return this.settings.topicColors[courseName];
    }
    const defaultPalette = ["#4cc9f0", "#f72585", "#7209b7", "#3a0ca3", "#4361ee", "#4caf50"];
    let hash = 0;
    for (let i = 0; i < courseName.length; i++)
      hash = courseName.charCodeAt(i) + ((hash << 5) - hash);
    return defaultPalette[Math.abs(hash) % defaultPalette.length];
  }
  render() {
    this.container.empty();
    this.container.addClass("timeline-wrapper");
    const validTasks = this.tasks.filter((t) => t.dueDate && !isNaN(t.dueDate.getTime()));
    if (validTasks.length === 0) {
      const empty = this.container.createDiv("dashboard-empty-state");
      empty.createEl("p", { text: "No dated tasks to display." });
      return;
    }
    const dates = validTasks.map((t) => t.dueDate);
    dates.push(new Date());
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));
    minDate.setDate(minDate.getDate() - 2);
    maxDate.setDate(maxDate.getDate() + this.daysToShow + 2);
    const allDays = [];
    const curr = new Date(minDate);
    while (curr <= maxDate) {
      allDays.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }
    this.createNavigationOverlay("left");
    this.createNavigationOverlay("right");
    this.scrollContainer = this.container.createDiv("timeline-container");
    const scrollContent = this.scrollContainer.createDiv("timeline-scroll-content");
    const totalWidthPercent = allDays.length / this.daysToShow * 100;
    scrollContent.style.width = `${totalWidthPercent}%`;
    const colWidthPercent = 100 / allDays.length;
    const monthHeader = scrollContent.createDiv("timeline-month-row");
    let currentMonth = -1;
    let monthStartIdx = 0;
    allDays.forEach((day, idx) => {
      const m = day.getMonth();
      if (m !== currentMonth) {
        if (currentMonth !== -1) {
          const span2 = idx - monthStartIdx;
          const monthName2 = allDays[monthStartIdx].toLocaleString("default", { month: "long", year: "numeric" });
          const mDiv2 = monthHeader.createDiv("timeline-month-cell");
          mDiv2.setText(monthName2);
          mDiv2.style.width = `${span2 * colWidthPercent}%`;
          mDiv2.style.left = `${monthStartIdx * colWidthPercent}%`;
        }
        currentMonth = m;
        monthStartIdx = idx;
      }
    });
    const span = allDays.length - monthStartIdx;
    const monthName = allDays[monthStartIdx].toLocaleString("default", { month: "long", year: "numeric" });
    const mDiv = monthHeader.createDiv("timeline-month-cell");
    mDiv.setText(monthName);
    mDiv.style.width = `${span * colWidthPercent}%`;
    mDiv.style.left = `${monthStartIdx * colWidthPercent}%`;
    const grid = scrollContent.createDiv("timeline-grid");
    grid.style.gridTemplateColumns = `repeat(${allDays.length}, 1fr)`;
    allDays.forEach((day, idx) => {
      const cell = grid.createDiv("timeline-header-cell");
      cell.setText(day.getDate().toString());
      const dayName = day.toLocaleString("default", { weekday: "short" });
      cell.createDiv("timeline-day-name").setText(dayName);
      cell.style.gridColumn = `${idx + 1}`;
      cell.style.gridRow = `1`;
      const bgCell = grid.createDiv("timeline-bg-cell");
      bgCell.style.gridColumn = `${idx + 1}`;
      bgCell.style.gridRow = `2 / -1`;
      if (day.getDate() === 1) {
        cell.addClass("is-month-start");
        bgCell.addClass("is-month-start-bg");
      }
      if (day.toDateString() === new Date().toDateString()) {
        cell.addClass("is-today");
        bgCell.addClass("is-today-bg");
        const marker = grid.createDiv("timeline-today-marker");
        marker.style.gridColumn = `${idx + 1}`;
        marker.style.gridRow = `1 / -1`;
      }
    });
    validTasks.forEach((task, rowIndex) => {
      var _a;
      const rowBg = grid.createDiv("timeline-row-bg");
      rowBg.style.gridColumn = `1 / -1`;
      rowBg.style.gridRow = `${rowIndex + 2}`;
      const taskStart = task.startDate ? new Date(task.startDate) : new Date(task.dueDate);
      const taskEnd = new Date(task.dueDate);
      taskStart.setHours(0, 0, 0, 0);
      taskEnd.setHours(0, 0, 0, 0);
      let startIdx = allDays.findIndex((d) => d.toDateString() === taskStart.toDateString());
      let dueIdx = allDays.findIndex((d) => d.toDateString() === taskEnd.toDateString());
      if (startIdx === -1 && taskStart < allDays[0])
        startIdx = 0;
      if (dueIdx === -1 && taskEnd > allDays[allDays.length - 1])
        dueIdx = allDays.length - 1;
      if (dueIdx >= 0 && startIdx >= 0) {
        const bar = grid.createDiv("timeline-task-bar");
        bar.setText(task.title);
        if (((_a = this.settings) == null ? void 0 : _a.colorMode) === "course" && task.fileName) {
          bar.style.backgroundColor = this.getCourseColor(task.fileName);
        } else {
          const status = getTaskStatus(task);
          if (status === "overdue" /* Overdue */)
            bar.addClass("status-overdue");
          if (status === "urgent" /* Urgent */)
            bar.addClass("status-urgent");
          if (status === "completed" /* Completed */)
            bar.addClass("status-completed");
          if (status === "upcoming_week" /* UpcomingWeek */)
            bar.addClass("status-active");
        }
        const span2 = dueIdx - startIdx + 1;
        bar.style.gridColumnStart = `${startIdx + 1}`;
        bar.style.gridColumnEnd = `span ${span2}`;
        bar.style.gridRow = `${rowIndex + 2}`;
        bar.addEventListener("mouseenter", (e) => this.showTooltip(e, task));
        bar.addEventListener("mouseleave", () => this.hideTooltip());
        bar.addEventListener("mousemove", (e) => this.moveTooltip(e));
        bar.addEventListener("click", (e) => {
          e.stopPropagation();
          this.openTaskFile(task);
        });
      }
    });
    this.setupEventListeners(this.scrollContainer);
  }
  getScrollPosition() {
    return this.scrollContainer ? this.scrollContainer.scrollLeft : 0;
  }
  setScrollPosition(pos) {
    if (this.scrollContainer) {
      this.scrollContainer.scrollTo({ left: pos, behavior: "auto" });
    }
  }
  scrollToToday() {
    setTimeout(() => {
      if (!this.scrollContainer)
        return;
      const todayCell = this.scrollContainer.querySelector(".timeline-header-cell.is-today");
      if (todayCell) {
        const scrollPos = todayCell.offsetLeft - this.scrollContainer.clientWidth / 2 + todayCell.clientWidth / 2;
        this.scrollContainer.scrollTo({ left: scrollPos, behavior: "smooth" });
      }
    }, 100);
  }
  // --- PUBLIC SCROLL METHOD ---
  scroll(direction) {
    if (!this.scrollContainer)
      return;
    const scrollAmount = this.scrollContainer.clientWidth * 0.8;
    this.scrollContainer.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth"
    });
  }
  createNavigationOverlay(direction) {
    const overlay = this.container.createDiv(`timeline-nav-overlay nav-${direction}`);
    overlay.createDiv("nav-arrow").setText(direction === "left" ? "\u2039" : "\u203A");
    overlay.addEventListener("click", (e) => {
      e.stopPropagation();
      this.scroll(direction);
    });
  }
  setupEventListeners(container) {
    container.addEventListener("mousedown", (e) => {
      this.isDragging = true;
      container.addClass("is-dragging");
      this.startX = e.pageX - container.offsetLeft;
      this.scrollLeftPos = container.scrollLeft;
    });
    container.addEventListener("mouseleave", () => {
      this.isDragging = false;
      container.removeClass("is-dragging");
    });
    container.addEventListener("mouseup", () => {
      this.isDragging = false;
      container.removeClass("is-dragging");
    });
    container.addEventListener("mousemove", (e) => {
      if (!this.isDragging)
        return;
      e.preventDefault();
      const x = e.pageX - container.offsetLeft;
      const walk = (x - this.startX) * 1.5;
      container.scrollLeft = this.scrollLeftPos - walk;
    });
  }
  showTooltip(e, task) {
    if (!this.tooltipEl) {
      this.tooltipEl = document.body.createDiv("dashboard-tooltip");
    }
    this.tooltipEl.empty();
    this.tooltipEl.createDiv("tooltip-title").setText(task.title);
    this.tooltipEl.createDiv("tooltip-meta").setText(`\u{1F4C2} ${task.fileName}`);
    if (task.dueDate) {
      this.tooltipEl.createDiv("tooltip-date").setText(`\u{1F4C5} ${task.dueDate.toDateString()}`);
    }
    this.tooltipEl.style.display = "block";
    this.moveTooltip(e);
  }
  moveTooltip(e) {
    if (this.tooltipEl) {
      this.tooltipEl.style.top = `${e.clientY + 15}px`;
      this.tooltipEl.style.left = `${e.clientX + 15}px`;
    }
  }
  hideTooltip() {
    if (this.tooltipEl) {
      this.tooltipEl.style.display = "none";
    }
  }
  async openTaskFile(task) {
    const file = this.app.vault.getAbstractFileByPath(task.filePath);
    if (file instanceof import_obsidian5.TFile) {
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file);
      const view = this.app.workspace.getActiveViewOfType(import_obsidian5.MarkdownView);
      if (view) {
        view.editor.setCursor({ line: task.lineNumber, ch: 0 });
        view.editor.scrollIntoView({ from: { line: task.lineNumber, ch: 0 }, to: { line: task.lineNumber, ch: 0 } }, true);
      }
    }
  }
};

// src/views/TaskListComponent.ts
var import_obsidian6 = require("obsidian");
var TaskListComponent = class {
  constructor(container, app, callbacks, settings) {
    this.container = container;
    this.app = app;
    this.callbacks = callbacks;
    this.settings = settings;
  }
  render(tasks) {
    this.container.empty();
    if (tasks.length === 0) {
      const empty = this.container.createDiv("dashboard-empty-state");
      empty.createEl("p", { text: "No tasks found." });
      return;
    }
    const listContainer = this.container.createDiv("dashboard-task-list");
    tasks.forEach((task) => {
      this.renderTaskItem(listContainer, task);
    });
  }
  renderTaskItem(container, task) {
    var _a;
    const taskEl = container.createDiv({ cls: ["task-item"] });
    if (((_a = this.settings) == null ? void 0 : _a.colorMode) === "course" && task.fileName) {
      taskEl.setCssProps({ "border-left-color": getTopicColor(task.fileName, this.settings) });
    } else {
      const status = getTaskStatus(task);
      if (status === "overdue" /* Overdue */)
        taskEl.addClass("status-overdue");
      if (status === "urgent" /* Urgent */)
        taskEl.addClass("status-urgent");
      if (status === "completed" /* Completed */)
        taskEl.addClass("status-completed");
      if (status === "upcoming_week" /* UpcomingWeek */)
        taskEl.addClass("status-active");
    }
    const checkbox = taskEl.createEl("input", { type: "checkbox", cls: "task-checkbox" });
    checkbox.checked = task.completed;
    checkbox.addEventListener("change", () => this.callbacks.onToggle(task));
    const content = taskEl.createDiv("task-content");
    const viewMode = content.createDiv("task-view-mode");
    const titleEl = viewMode.createDiv("task-title");
    titleEl.setText(task.title);
    const meta = viewMode.createDiv("task-meta");
    if (task.fileName) {
      const courseLabel = meta.createDiv("task-course");
      courseLabel.setText(task.fileName);
    }
    if (task.dueDate) {
      const dateLabel = meta.createDiv("task-date");
      dateLabel.setText(task.dueDate.toDateString());
    }
    titleEl.addEventListener("click", () => {
      void this.openTaskInEditor(task);
    });
  }
  async openTaskInEditor(task) {
    const file = this.app.vault.getAbstractFileByPath(task.filePath);
    if (file) {
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file);
      const view = this.app.workspace.getActiveViewOfType(import_obsidian6.MarkdownView);
      if (view) {
        view.editor.setCursor({ line: task.lineNumber, ch: 0 });
        view.editor.scrollIntoView({ from: { line: task.lineNumber, ch: 0 }, to: { line: task.lineNumber, ch: 0 } }, true);
      }
    }
  }
};

// src/views/HeaderComponent.ts
var import_obsidian7 = require("obsidian");
var HeaderComponent = class {
  constructor(container, initialState, defaultTitle, callbacks, options) {
    this.headerEl = null;
    this.sidebarHandleEl = null;
    this.isSaving = false;
    var _a;
    this.container = container;
    this.defaultTitle = defaultTitle;
    this.title = initialState.title || defaultTitle;
    this.isCollapsed = initialState.isCollapsed || false;
    this.onStateChange = callbacks.onStateChange;
    this.onRefresh = callbacks.onRefresh;
    this.onSettings = callbacks.onSettings || null;
    this.onAdd = callbacks.onAdd || null;
    this.highlightAddButton = (_a = options == null ? void 0 : options.highlightAddButton) != null ? _a : false;
    this.onHighlightDismiss = (options == null ? void 0 : options.onHighlightDismiss) || null;
  }
  render() {
    this.renderSidebarHandle();
    this.renderHeader();
    this.updateVisibility();
  }
  renderSidebarHandle() {
    if (this.sidebarHandleEl)
      this.sidebarHandleEl.remove();
    this.sidebarHandleEl = this.container.createDiv("dashboard-sidebar-handle is-hidden");
    (0, import_obsidian7.setIcon)(this.sidebarHandleEl, "panel-left-open");
    this.sidebarHandleEl.setAttribute("aria-label", "Show Header");
    this.sidebarHandleEl.addEventListener("click", () => {
      this.isCollapsed = false;
      this.updateVisibility();
      this.onStateChange();
    });
  }
  renderHeader() {
    if (this.headerEl)
      this.headerEl.remove();
    this.headerEl = this.container.createDiv("dashboard-header");
    const leftGroup = this.headerEl.createDiv("header-actions-left");
    if (this.onSettings) {
      const settingsBtn = leftGroup.createEl("button", { cls: "header-icon-btn" });
      (0, import_obsidian7.setIcon)(settingsBtn, "settings");
      settingsBtn.addEventListener("click", () => this.onSettings());
    }
    const titleWrapper = this.headerEl.createDiv("dashboard-title-wrapper");
    titleWrapper.setAttribute("aria-label", "Click to rename");
    titleWrapper.createEl("h2", { text: this.title });
    const editIcon = titleWrapper.createDiv("edit-title-icon");
    (0, import_obsidian7.setIcon)(editIcon, "pencil");
    titleWrapper.addEventListener("click", () => {
      this.enterEditMode(titleWrapper);
    });
    const rightGroup = this.headerEl.createDiv("header-actions-right");
    if (this.onAdd) {
      const addBtn = rightGroup.createEl("button", { cls: "header-icon-btn" });
      if (this.highlightAddButton)
        addBtn.addClass("feature-highlight");
      (0, import_obsidian7.setIcon)(addBtn, "plus");
      addBtn.setAttribute("aria-label", "Quick Add Task");
      addBtn.addEventListener("click", () => {
        if (this.highlightAddButton) {
          this.highlightAddButton = false;
          addBtn.removeClass("feature-highlight");
          if (this.onHighlightDismiss)
            this.onHighlightDismiss();
        }
        this.onAdd();
      });
    }
    const refreshBtn = rightGroup.createEl("button", { cls: "dashboard-refresh-btn header-icon-btn" });
    (0, import_obsidian7.setIcon)(refreshBtn, "refresh-cw");
    refreshBtn.setAttribute("aria-label", "Refresh Data");
    refreshBtn.addEventListener("click", () => {
      refreshBtn.addClass("is-rotating");
      this.onRefresh();
      setTimeout(() => refreshBtn.removeClass("is-rotating"), 1e3);
    });
    const hideBtn = rightGroup.createEl("button", { cls: "header-icon-btn" });
    (0, import_obsidian7.setIcon)(hideBtn, "panel-top-close");
    hideBtn.setAttribute("aria-label", "Hide Header");
    hideBtn.addEventListener("click", () => {
      this.isCollapsed = true;
      this.updateVisibility();
      this.onStateChange();
    });
  }
  enterEditMode(wrapper) {
    wrapper.empty();
    const input = wrapper.createEl("input", {
      type: "text",
      value: this.title,
      cls: "dashboard-title-input"
    });
    input.focus();
    input.select();
    this.isSaving = false;
    const save = () => {
      if (this.isSaving)
        return;
      this.isSaving = true;
      const newVal = input.value.trim();
      this.title = newVal.length > 0 ? newVal : this.defaultTitle;
      this.onStateChange();
    };
    input.addEventListener("blur", save);
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        save();
      }
    });
    input.addEventListener("keypress", (e) => e.stopPropagation());
  }
  updateVisibility() {
    var _a, _b, _c, _d;
    if (this.isCollapsed) {
      (_a = this.headerEl) == null ? void 0 : _a.addClass("is-collapsed");
      (_b = this.sidebarHandleEl) == null ? void 0 : _b.removeClass("is-hidden");
    } else {
      (_c = this.headerEl) == null ? void 0 : _c.removeClass("is-collapsed");
      (_d = this.sidebarHandleEl) == null ? void 0 : _d.addClass("is-hidden");
    }
  }
  getState() {
    return {
      title: this.title,
      isCollapsed: this.isCollapsed
    };
  }
};

// src/modals/QuickAddModal.ts
var import_obsidian8 = require("obsidian");
var QuickAddModal = class extends import_obsidian8.Modal {
  constructor(app, taskManager) {
    super(app);
    this.taskManager = taskManager;
    this.title = "";
    this.date = "";
    this.selectedFile = "";
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "Quick Add Task" });
    new import_obsidian8.Setting(contentEl).setName("Task").addText((text) => text.setPlaceholder("Read Chapter 4...").onChange((value) => this.title = value).inputEl.focus());
    new import_obsidian8.Setting(contentEl).setName("Destination");
    new import_obsidian8.Setting(contentEl).setName("Destination").addDropdown((drop) => {
      const activeView = this.app.workspace.getActiveViewOfType(import_obsidian8.MarkdownView);
      drop.addOption("__CURSOR__", "\u{1F4CD} Insert at Cursor (Active File)");
      const allFiles = this.taskManager.getScannedFiles();
      allFiles.forEach((path) => {
        var _a;
        const name = ((_a = path.split("/").pop()) == null ? void 0 : _a.replace(".md", "")) || path;
        drop.addOption(path, name);
      });
      if (activeView) {
        this.selectedFile = "__CURSOR__";
      } else if (allFiles.length > 0) {
        this.selectedFile = allFiles[0];
      }
      drop.setValue(this.selectedFile);
      drop.onChange((value) => this.selectedFile = value);
    });
    new import_obsidian8.Setting(contentEl).setName("Due Date").addText((text) => {
      text.inputEl.type = "date";
      text.onChange((value) => this.date = value);
    });
    new import_obsidian8.Setting(contentEl).addButton((btn) => btn.setButtonText("Add Task").setCta().onClick(async () => {
      if (!this.title || !this.selectedFile)
        return;
      if (this.selectedFile === "__CURSOR__") {
        const view = this.app.workspace.getActiveViewOfType(import_obsidian8.MarkdownView);
        if (view && view.editor) {
          const dateStr = this.date ? ` [due:: ${this.date}]` : "";
          const taskLine = `- [ ] ${this.title}${dateStr}
`;
          view.editor.replaceSelection(taskLine);
          if (view.file) {
            await this.taskManager.refreshFileTask(view.file.path);
          }
        }
      } else {
        const dateObj = this.date ? new Date(this.date) : null;
        await this.taskManager.addTask(this.title, dateObj, this.selectedFile);
      }
      this.close();
    }));
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/views/DashboardView.ts
var VIEW_TYPE_DASHBOARD = "tasklens-dashboard-view";
function setupViewDOM(containerEl, isLocked) {
  const leafRootEl = containerEl.closest(".workspace-leaf-content");
  if (leafRootEl)
    leafRootEl.classList.add("tasklens-chromeless");
  const tabContainer = containerEl.closest(".workspace-tabs");
  if (tabContainer && isLocked)
    tabContainer.classList.add("tasklens-hide-tabs");
  return { leafRootEl, tabContainer };
}
function cleanupViewDOM(leafRootEl, tabContainer) {
  if (tabContainer)
    tabContainer.classList.remove("tasklens-hide-tabs");
  if (leafRootEl)
    leafRootEl.classList.remove("tasklens-chromeless");
}
var DashboardView = class extends import_obsidian9.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.leafRootEl = null;
    this.tabContainer = null;
    this.timelineComponent = null;
    this.headerComponent = null;
    this.headerState = { title: null, isCollapsed: false };
    this.showControls = true;
    this.showTimeline = true;
    this.showList = true;
    this.showStats = true;
    this.timelineDaysToShow = 10;
    this.renderTimer = null;
    this.lastTimelineScroll = null;
    this.forceScrollToToday = false;
    this.taskManager = this.plugin.taskManager;
    this.taskManager.on("tasks-updated", () => {
      if (this.renderTimer)
        clearTimeout(this.renderTimer);
      this.renderTimer = setTimeout(() => {
        if (this.timelineComponent && !this.forceScrollToToday) {
          this.lastTimelineScroll = this.timelineComponent.getScrollPosition();
        }
        this.render();
        if (this.timelineComponent) {
          if (this.forceScrollToToday) {
            this.timelineComponent.scrollToToday();
            this.forceScrollToToday = false;
          } else if (this.lastTimelineScroll !== null) {
            this.timelineComponent.setScrollPosition(this.lastTimelineScroll);
          }
        }
      }, 500);
    });
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file.path.endsWith(".md")) {
          void this.taskManager.refreshFileTask(file.path);
        }
      })
    );
    this.taskManager.setStatusFilter("open" /* Open */);
  }
  getViewType() {
    return VIEW_TYPE_DASHBOARD;
  }
  getDisplayText() {
    return "TaskLens dashboard";
  }
  getIcon() {
    return "layout-dashboard";
  }
  async setState(state, result) {
    var _a, _b, _c, _d, _e;
    if (state) {
      const parsedState = state;
      this.showControls = (_a = parsedState.showControls) != null ? _a : this.showControls;
      this.showTimeline = (_b = parsedState.showTimeline) != null ? _b : this.showTimeline;
      this.showList = (_c = parsedState.showList) != null ? _c : this.showList;
      this.showStats = (_d = parsedState.showStats) != null ? _d : this.showStats;
      this.timelineDaysToShow = (_e = parsedState.zoomLevel) != null ? _e : 10;
      if (parsedState.statusFilter)
        this.taskManager.setStatusFilter(parsedState.statusFilter);
      if (parsedState.courseFilter)
        this.taskManager.setCourseFilter(parsedState.courseFilter);
      if (parsedState.headerState)
        this.headerState = parsedState.headerState;
    }
    await super.setState(state, result);
    this.render();
  }
  getState() {
    const filters = this.taskManager.getCurrentFilters();
    if (this.headerComponent) {
      this.headerState = this.headerComponent.getState();
    }
    return {
      showControls: this.showControls,
      showTimeline: this.showTimeline,
      showList: this.showList,
      showStats: this.showStats,
      zoomLevel: this.timelineDaysToShow,
      statusFilter: filters.status,
      courseFilter: filters.course,
      headerState: this.headerState
    };
  }
  async onOpen() {
    const dom = setupViewDOM(this.containerEl, this.plugin.isLayoutLocked);
    this.leafRootEl = dom.leafRootEl;
    this.tabContainer = dom.tabContainer;
    this.contentEl.empty();
    this.contentEl.addClass("tasklens-dashboard-view");
    this.applyColorTheme();
    await this.taskManager.loadTasks();
    this.render();
    setTimeout(() => {
      if (this.timelineComponent) {
        this.timelineComponent.scrollToToday();
      }
    }, 250);
  }
  onClose() {
    cleanupViewDOM(this.leafRootEl, this.tabContainer);
    return Promise.resolve();
  }
  render() {
    this.contentEl.empty();
    this.headerComponent = new HeaderComponent(
      this.contentEl,
      this.headerState,
      "TaskLens dashboard",
      {
        onStateChange: () => {
          if (this.headerComponent) {
            this.headerState = this.headerComponent.getState();
          }
          if (this.headerState.isCollapsed) {
            this.showControls = false;
          }
          this.app.workspace.requestSaveLayout();
          this.render();
        },
        onRefresh: async () => {
          this.forceScrollToToday = true;
          await this.taskManager.loadTasks();
        },
        onSettings: () => {
          this.showControls = !this.showControls;
          if (this.showControls && this.headerState.isCollapsed) {
            this.headerState.isCollapsed = false;
          }
          this.app.workspace.requestSaveLayout();
          this.render();
        },
        onAdd: () => {
          new QuickAddModal(this.app, this.taskManager).open();
        }
      },
      {
        highlightAddButton: !this.plugin.settings.hasSeenWelcome,
        onHighlightDismiss: () => {
          this.plugin.settings.hasSeenWelcome = true;
          void this.plugin.saveSettings().then(() => this.plugin.refreshViews());
        }
      }
    );
    this.headerComponent.render();
    this.renderControls();
    const layoutOrder = ["stats", "timeline", "list"];
    layoutOrder.forEach((component) => {
      if (component === "stats" && this.showStats)
        this.renderStatistics();
      if (component === "timeline" && this.showTimeline)
        this.renderTimeline();
      if (component === "list" && this.showList)
        this.renderTaskList();
    });
  }
  renderControls() {
    if (!this.showControls)
      return;
    const controls = this.contentEl.createDiv("dashboard-controls");
    const filtersDiv = controls.createDiv("filters-wrapper");
    filtersDiv.setCssProps({ display: "flex", gap: "12px", "flex-wrap": "wrap" });
    const statusGroup = filtersDiv.createDiv("control-group");
    statusGroup.createEl("label", { text: "Show:" });
    const statusSelect = statusGroup.createEl("select");
    const statusOptions = [
      { value: "open" /* Open */, label: "Active" },
      { value: "all" /* All */, label: "All tasks" },
      { value: "completed" /* Completed */, label: "Completed" }
    ];
    statusOptions.forEach((opt) => {
      const option = statusSelect.createEl("option", { value: opt.value, text: opt.label });
      if (opt.value === this.taskManager.getCurrentFilters().status)
        option.selected = true;
    });
    statusSelect.addEventListener("change", () => {
      this.taskManager.setStatusFilter(statusSelect.value);
    });
    const courseGroup = filtersDiv.createDiv("control-group");
    courseGroup.createEl("label", { text: "Topic:" });
    const courseSelect = courseGroup.createEl("select");
    courseSelect.createEl("option", { value: "", text: "All topics" });
    this.taskManager.getCourseNames().forEach((course) => {
      const option = courseSelect.createEl("option", { value: course, text: course });
      if (course === this.taskManager.getCurrentFilters().course)
        option.selected = true;
    });
    courseSelect.addEventListener("change", () => {
      this.taskManager.setCourseFilter(courseSelect.value || null);
    });
    const actionsDiv = controls.createDiv("actions-wrapper");
    actionsDiv.setCssProps({ display: "flex", gap: "12px", "align-items": "center" });
    const toggleTimeline = actionsDiv.createEl("button", {
      cls: `view-toggle-btn ${this.showTimeline ? "is-active" : ""}`,
      text: "Timeline"
    });
    toggleTimeline.addEventListener("click", () => {
      this.showTimeline = !this.showTimeline;
      this.app.workspace.requestSaveLayout();
      this.render();
    });
    const toggleList = actionsDiv.createEl("button", {
      cls: `view-toggle-btn ${this.showList ? "is-active" : ""}`,
      text: "List"
    });
    toggleList.addEventListener("click", () => {
      this.showList = !this.showList;
      this.app.workspace.requestSaveLayout();
      this.render();
    });
    const statsBtn = actionsDiv.createEl("button", {
      cls: `view-toggle-btn ${this.showStats ? "is-active" : ""}`,
      text: "Stats"
    });
    statsBtn.addEventListener("click", () => {
      this.showStats = !this.showStats;
      this.app.workspace.requestSaveLayout();
      this.render();
    });
  }
  renderStatistics() {
    const stats = this.taskManager.getStatistics();
    const container = this.contentEl.createDiv("dashboard-stats");
    const statCards = [
      { label: "Total", value: stats.total, cls: "stat-total", filter: "all" /* All */ },
      { label: "Active", value: stats.upcoming, cls: "stat-active", filter: "upcoming_week" /* UpcomingWeek */ },
      { label: "Urgent", value: stats.urgent, cls: "stat-urgent", filter: "urgent" /* Urgent */ },
      { label: "Overdue", value: stats.overdue, cls: "stat-overdue", filter: "overdue" /* Overdue */ },
      { label: "Completed", value: stats.completed, cls: "stat-completed", filter: "completed" /* Completed */ }
    ];
    statCards.forEach((stat) => {
      const card = container.createDiv({ cls: ["stat-card", stat.cls] });
      card.addClass("is-clickable");
      card.addEventListener("click", () => {
        this.taskManager.setStatusFilter(stat.filter);
      });
      card.createDiv("stat-value").setText(String(stat.value));
      card.createDiv("stat-label").setText(stat.label);
    });
  }
  renderTaskList() {
    const container = this.contentEl.createDiv();
    const list = new TaskListComponent(container, this.app, {
      onToggle: (t) => this.taskManager.toggleTaskCompletion(t),
      onEdit: async (t, newTitle, newDate) => {
        await this.taskManager.updateTask(t, newTitle, newDate);
      },
      onDelete: async (t) => {
        await this.taskManager.deleteTask(t);
      }
    }, this.plugin.settings);
    list.render(this.taskManager.getFilteredTasks());
  }
  applyColorTheme() {
    const cols = this.plugin.settings.colors;
    this.contentEl.setCssProps({
      "--color-red": cols.overdue,
      "--color-orange": cols.urgent,
      "--color-green": cols.active,
      "--color-blue": cols.completed,
      "--color-purple": "#7209b7"
    });
  }
  refreshFromSettings() {
    this.applyColorTheme();
    this.render();
  }
  renderTimeline() {
    const container = this.contentEl.createDiv("dashboard-timeline-view");
    const controls = container.createDiv("timeline-controls");
    const zoomControls = controls.createDiv("zoom-controls");
    zoomControls.createSpan({ text: "Zoom: " });
    const zoomOut = zoomControls.createEl("button", { text: "-", cls: "view-toggle-btn" });
    zoomOut.addEventListener("click", () => {
      this.timelineDaysToShow = Math.min(30, this.timelineDaysToShow + 1);
      this.render();
    });
    zoomControls.createSpan({ text: ` ${this.timelineDaysToShow} Days ` });
    const zoomIn = zoomControls.createEl("button", { text: "+", cls: "view-toggle-btn" });
    zoomIn.addEventListener("click", () => {
      this.timelineDaysToShow = Math.max(3, this.timelineDaysToShow - 1);
      this.render();
    });
    const navControls = controls.createDiv("nav-controls");
    const scrollLeft = navControls.createEl("button", { cls: "view-toggle-btn" });
    (0, import_obsidian9.setIcon)(scrollLeft, "chevron-left");
    const scrollRight = navControls.createEl("button", { cls: "view-toggle-btn" });
    (0, import_obsidian9.setIcon)(scrollRight, "chevron-right");
    this.timelineComponent = new TimelineComponent(
      container,
      this.app,
      this.taskManager.getFilteredTasks(),
      this.timelineDaysToShow,
      this.plugin.settings
    );
    this.timelineComponent.render();
    scrollLeft.addEventListener("click", () => {
      var _a;
      return (_a = this.timelineComponent) == null ? void 0 : _a.scroll("left");
    });
    scrollRight.addEventListener("click", () => {
      var _a;
      return (_a = this.timelineComponent) == null ? void 0 : _a.scroll("right");
    });
  }
};

// src/views/TimelineView.ts
var import_obsidian10 = require("obsidian");
var VIEW_TYPE_TIMELINE = "tasklens-timeline-view";
var TimelineView = class extends import_obsidian10.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.leafRootEl = null;
    this.tabContainer = null;
    this.headerComponent = null;
    this.headerState = { title: null, isCollapsed: false };
    this.plugin.taskManager.on("tasks-updated", () => this.render());
  }
  getViewType() {
    return VIEW_TYPE_TIMELINE;
  }
  getDisplayText() {
    return "Timeline";
  }
  getIcon() {
    return "calendar-range";
  }
  async setState(state, result) {
    const parsedState = state;
    if (parsedState == null ? void 0 : parsedState.headerState) {
      this.headerState = parsedState.headerState;
    }
    await super.setState(state, result);
    this.render();
  }
  getState() {
    if (this.headerComponent) {
      this.headerState = this.headerComponent.getState();
    }
    return { headerState: this.headerState };
  }
  async onOpen() {
    const dom = setupViewDOM(this.containerEl, true);
    this.leafRootEl = dom.leafRootEl;
    this.tabContainer = dom.tabContainer;
    this.contentEl.empty();
    this.contentEl.addClass("tasklens-dashboard-view");
    this.contentEl.addClass("is-single-view");
    await this.plugin.taskManager.loadTasks();
    this.render();
  }
  async onClose() {
    cleanupViewDOM(this.leafRootEl, this.tabContainer);
  }
  render() {
    this.contentEl.empty();
    this.headerComponent = new HeaderComponent(
      this.contentEl,
      this.headerState,
      "Timeline",
      {
        onStateChange: () => {
          if (this.headerComponent) {
            this.headerState = this.headerComponent.getState();
          }
          this.app.workspace.requestSaveLayout();
          this.render();
        },
        onRefresh: async () => {
          await this.plugin.taskManager.loadTasks();
        }
      }
    );
    this.headerComponent.render();
    const timeline = new TimelineComponent(this.contentEl, this.app, this.plugin.taskManager.getFilteredTasks(), 7, this.plugin.settings);
    timeline.render();
  }
};

// src/views/TaskListView.ts
var import_obsidian11 = require("obsidian");
var VIEW_TYPE_LIST = "tasklens-list-view";
var TaskListView = class extends import_obsidian11.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.leafRootEl = null;
    this.tabContainer = null;
    this.isOpen = false;
    this.headerComponent = null;
    this.headerState = { title: null, isCollapsed: false };
    this.onTasksUpdated = () => {
      var _a;
      if (!this.isOpen || !((_a = this.contentEl) == null ? void 0 : _a.isConnected))
        return;
      this.render();
    };
    this.plugin.taskManager.on("tasks-updated", this.onTasksUpdated);
  }
  getViewType() {
    return VIEW_TYPE_LIST;
  }
  getDisplayText() {
    return "Task list";
  }
  getIcon() {
    return "list-todo";
  }
  async setState(state, result) {
    const parsedState = state;
    if (parsedState == null ? void 0 : parsedState.headerState) {
      this.headerState = parsedState.headerState;
    }
    await super.setState(state, result);
    this.render();
  }
  getState() {
    if (this.headerComponent) {
      this.headerState = this.headerComponent.getState();
    }
    return { headerState: this.headerState };
  }
  onOpen() {
    const dom = setupViewDOM(this.containerEl, true);
    this.leafRootEl = dom.leafRootEl;
    this.tabContainer = dom.tabContainer;
    this.contentEl.empty();
    this.contentEl.addClass("tasklens-dashboard-view");
    this.contentEl.addClass("is-single-view");
    this.isOpen = true;
    this.render();
    return Promise.resolve();
  }
  onClose() {
    this.isOpen = false;
    cleanupViewDOM(this.leafRootEl, this.tabContainer);
    return Promise.resolve();
  }
  render() {
    var _a;
    if (!this.isOpen || !((_a = this.contentEl) == null ? void 0 : _a.isConnected))
      return;
    this.contentEl.empty();
    this.headerComponent = new HeaderComponent(
      this.contentEl,
      this.headerState,
      "My tasks",
      {
        onStateChange: () => {
          if (this.headerComponent) {
            this.headerState = this.headerComponent.getState();
          }
          this.app.workspace.requestSaveLayout();
          this.render();
        },
        onRefresh: async () => {
          await this.plugin.taskManager.loadTasks();
        },
        onAdd: () => {
          new QuickAddModal(this.app, this.plugin.taskManager).open();
        }
      },
      {
        highlightAddButton: !this.plugin.settings.hasSeenWelcome,
        onHighlightDismiss: () => {
          this.plugin.settings.hasSeenWelcome = true;
          void this.plugin.saveSettings().then(() => this.plugin.refreshViews());
        }
      }
    );
    this.headerComponent.render();
    const list = new TaskListComponent(this.contentEl, this.app, {
      onToggle: (t) => this.plugin.taskManager.toggleTaskCompletion(t),
      onEdit: async (t, newTitle, newDate) => {
        await this.plugin.taskManager.updateTask(t, newTitle, newDate);
      },
      onDelete: async (t) => {
        await this.plugin.taskManager.deleteTask(t);
      }
    }, this.plugin.settings);
    list.render(this.plugin.taskManager.getFilteredTasks());
  }
};

// src/views/StatsView.ts
var import_obsidian12 = require("obsidian");

// src/views/StatsComponent.ts
var StatsComponent = class {
  constructor(container) {
    this.container = container;
  }
  render(taskManager) {
    this.container.empty();
    const stats = taskManager.getStatistics();
    const tasks = taskManager.getAllTasks();
    const urgentCount = tasks.filter((t) => !t.completed && getTaskStatus(t) === "urgent" /* Urgent */).length;
    const containerDiv = this.container.createDiv("dashboard-stats");
    const statCards = [
      { label: "Total", value: stats.total, cls: "stat-total" },
      { label: "Active", value: stats.upcoming, cls: "stat-active" },
      { label: "Urgent", value: urgentCount, cls: "stat-urgent" },
      { label: "Overdue", value: stats.overdue, cls: "stat-overdue" },
      { label: "Completed", value: stats.completed, cls: "stat-completed" }
    ];
    statCards.forEach((stat) => {
      const card = containerDiv.createDiv({ cls: ["stat-card", stat.cls] });
      card.createDiv("stat-value").setText(String(stat.value));
      card.createDiv("stat-label").setText(stat.label);
    });
  }
};

// src/views/StatsView.ts
var VIEW_TYPE_STATS = "tasklens-stats-view";
var StatsView = class extends import_obsidian12.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.leafRootEl = null;
    this.tabContainer = null;
    this.headerComponent = null;
    this.headerState = { title: null, isCollapsed: false };
    this.plugin.taskManager.on("tasks-updated", () => this.render());
  }
  getViewType() {
    return VIEW_TYPE_STATS;
  }
  getDisplayText() {
    return "Dashboard Stats";
  }
  getIcon() {
    return "bar-chart-3";
  }
  async setState(state, result) {
    const parsedState = state;
    if (parsedState == null ? void 0 : parsedState.headerState) {
      this.headerState = parsedState.headerState;
    }
    await super.setState(state, result);
    this.render();
  }
  getState() {
    if (this.headerComponent) {
      this.headerState = this.headerComponent.getState();
    }
    return { headerState: this.headerState };
  }
  async onOpen() {
    const dom = setupViewDOM(this.containerEl, true);
    this.leafRootEl = dom.leafRootEl;
    this.tabContainer = dom.tabContainer;
    this.contentEl.empty();
    this.contentEl.addClass("tasklens-dashboard-view");
    this.render();
  }
  async onClose() {
    cleanupViewDOM(this.leafRootEl, this.tabContainer);
  }
  render() {
    this.contentEl.empty();
    this.headerComponent = new HeaderComponent(
      this.contentEl,
      this.headerState,
      "Statistics",
      {
        onStateChange: () => {
          if (this.headerComponent) {
            this.headerState = this.headerComponent.getState();
          }
          this.app.workspace.requestSaveLayout();
          this.render();
        },
        onRefresh: async () => {
          await this.plugin.taskManager.loadTasks();
        }
      }
    );
    this.headerComponent.render();
    const stats = new StatsComponent(this.contentEl);
    stats.render(this.plugin.taskManager);
  }
};

// src/main.ts
var TASKLENS_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="11" cy="11" r="8"></circle>
  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  <path d="M8 11.5L10 13.5L14 8.5"></path>
</svg>`;
var TaskLensPlugin = class extends import_obsidian13.Plugin {
  constructor() {
    super(...arguments);
    this.isLayoutLocked = true;
    this.isFocusMode = false;
    this.savedLayout = null;
  }
  async onload() {
    await this.loadSettings();
    const parser = new TaskParser(this.app, this.settings);
    this.taskManager = new TaskManager(parser, this.app);
    this.registerView(VIEW_TYPE_DASHBOARD, (leaf) => new DashboardView(leaf, this));
    this.registerView(VIEW_TYPE_TIMELINE, (leaf) => new TimelineView(leaf, this));
    this.registerView(VIEW_TYPE_LIST, (leaf) => new TaskListView(leaf, this));
    this.registerView(VIEW_TYPE_STATS, (leaf) => new StatsView(leaf, this));
    (0, import_obsidian13.addIcon)("tasklens-icon", TASKLENS_ICON);
    const ribbonIconEl = this.addRibbonIcon("tasklens-icon", "TaskLens", (evt) => {
      ribbonIconEl.removeClass("feature-highlight");
      if (!this.settings.hasClickedRibbonIcon) {
        this.settings.hasClickedRibbonIcon = true;
        void this.saveSettings();
      }
      const menu = new import_obsidian13.Menu();
      menu.addItem(
        (item) => item.setTitle("Open dashboard").setIcon("layout-dashboard").onClick(() => {
          void this.activateView(VIEW_TYPE_DASHBOARD);
        })
      );
      menu.addItem(
        (item) => item.setTitle("Quick add task").setIcon("plus-circle").onClick(() => new QuickAddModal(this.app, this.taskManager).open())
      );
      menu.addSeparator();
      menu.addItem(
        (item) => item.setTitle(this.isLayoutLocked ? "Unlock layout" : "Lock layout").setIcon(this.isLayoutLocked ? "unlock" : "lock").onClick(() => this.toggleLayoutMode())
      );
      menu.addItem(
        (item) => item.setTitle(this.isFocusMode ? "Exit focus mode" : "Enter focus mode").setIcon(this.isFocusMode ? "eye" : "eye-off").onClick(() => {
          void this.toggleFocusMode();
        })
      );
      menu.showAtMouseEvent(evt);
    });
    if (!this.settings.hasSeenWelcome || !this.settings.hasClickedRibbonIcon) {
      ribbonIconEl.addClass("feature-highlight");
    }
    this.addCommand({
      id: "open-dashboard",
      name: "Open dashboard (all-in-one)",
      callback: () => {
        void this.activateView(VIEW_TYPE_DASHBOARD);
      }
    });
    this.addCommand({
      id: "open-timeline",
      name: "Open timeline view",
      callback: () => {
        void this.activateView(VIEW_TYPE_TIMELINE);
      }
    });
    this.addCommand({
      id: "open-task-list",
      name: "Open task list",
      callback: () => {
        void this.activateView(VIEW_TYPE_LIST);
      }
    });
    this.addCommand({
      id: "open-stats",
      name: "Open statistics",
      callback: () => {
        void this.activateView(VIEW_TYPE_STATS);
      }
    });
    this.addCommand({
      id: "quick-add-task",
      name: "Quick add task",
      callback: () => {
        new QuickAddModal(this.app, this.taskManager).open();
      }
    });
    this.addCommand({
      id: "refresh-dashboard-styles",
      name: "Reload dashboard colors/styles",
      callback: () => this.refreshViews()
    });
    if (!this.settings.hasSeenWelcome) {
      setTimeout(() => {
        new WelcomeModal(this.app, this).open();
      }, 1e3);
    }
    this.addSettingTab(new SettingsTab(this.app, this));
  }
  toggleLayoutMode() {
    this.isLayoutLocked = !this.isLayoutLocked;
    const viewTypes = [VIEW_TYPE_DASHBOARD, VIEW_TYPE_TIMELINE, VIEW_TYPE_LIST, VIEW_TYPE_STATS];
    viewTypes.forEach((type) => {
      const leaves = this.app.workspace.getLeavesOfType(type);
      leaves.forEach((leaf) => {
        const tabContainer = leaf.view.containerEl.closest(".workspace-tabs");
        if (tabContainer) {
          if (this.isLayoutLocked) {
            tabContainer.classList.add("tasklens-hide-tabs");
          } else {
            tabContainer.classList.remove("tasklens-hide-tabs");
          }
        }
      });
    });
    new import_obsidian13.Notice(this.isLayoutLocked ? "Dashboard layout: Locked \u{1F512}" : "Dashboard layout: Unlocked \u{1F513}");
  }
  async toggleFocusMode() {
    const workspace = this.app.workspace;
    if (!this.isFocusMode) {
      this.savedLayout = this.app.workspace.getLayout();
      this.isFocusMode = true;
      if (workspace.leftSplit && typeof workspace.leftSplit.collapse === "function") {
        workspace.leftSplit.collapse();
      }
      if (workspace.rightSplit && typeof workspace.rightSplit.collapse === "function") {
        workspace.rightSplit.collapse();
      }
      const viewTypes = [VIEW_TYPE_DASHBOARD, VIEW_TYPE_TIMELINE, VIEW_TYPE_LIST, VIEW_TYPE_STATS];
      let closedCount = 0;
      viewTypes.forEach((type) => {
        this.app.workspace.getLeavesOfType(type).forEach((leaf) => {
          leaf.detach();
          closedCount++;
        });
      });
      if (closedCount > 0) {
        new import_obsidian13.Notice("Focus mode enabled");
      } else {
        this.isFocusMode = false;
        this.savedLayout = null;
        new import_obsidian13.Notice("No TaskLenses were open");
      }
    } else {
      this.isFocusMode = false;
      if (this.savedLayout) {
        await workspace.setLayout(this.savedLayout);
        this.savedLayout = null;
        new import_obsidian13.Notice("Focus mode disabled");
      }
    }
  }
  async activateView(viewType) {
    let leaf = this.app.workspace.getLeaf(false);
    if (leaf && leaf.view.getViewType() !== "empty") {
      leaf = this.app.workspace.getLeaf("split");
    }
    await leaf.setViewState({ type: viewType, active: true });
    await this.app.workspace.revealLeaf(leaf);
    if (this.isLayoutLocked) {
      this.toggleLayoutMode();
      new import_obsidian13.Notice("Layout auto-unlocked for placement \u{1F513}");
    } else {
      const tabContainer = leaf.view.containerEl.closest(".workspace-tabs");
      if (tabContainer)
        tabContainer.classList.remove("tasklens-hide-tabs");
    }
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
    await this.taskManager.loadTasks();
  }
  refreshViews() {
    const viewTypes = [VIEW_TYPE_DASHBOARD, VIEW_TYPE_TIMELINE, VIEW_TYPE_LIST, VIEW_TYPE_STATS];
    viewTypes.forEach((type) => {
      this.app.workspace.getLeavesOfType(type).forEach((leaf) => {
        const view = leaf.view;
        if (typeof view.refreshFromSettings === "function") {
          view.refreshFromSettings();
        } else if (typeof view.render === "function") {
          if (typeof view.applyColorTheme === "function")
            view.applyColorTheme();
          view.render();
        }
      });
    });
  }
};
