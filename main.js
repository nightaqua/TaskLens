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
  if (task.completed) return "completed" /* Completed */;
  if (task.dueDate) {
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(task.dueDate);
    due.setHours(0, 0, 0, 0);
    if (due < today) return "overdue" /* Overdue */;
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1e3 * 60 * 60 * 24));
    if (diffDays <= 3 && diffDays >= 0) return "urgent" /* Urgent */;
    return "upcoming_week" /* UpcomingWeek */;
  }
  return "no_date" /* NoDate */;
}

// src/services/TaskSanitizer.ts
function hasCompletionMetadata(line) {
  return /\u2705\s*\d{4}-\d{2}-\d{2}/.test(line) || /completion::/i.test(line);
}
function hasRecurrenceMetadata(line) {
  return /[\u{1F501}\u{1F3C1}]/u.test(line) || /repeat::/i.test(line);
}
function stripCompletionMetadata(line) {
  let result = line;
  result = result.replace(/\s*\[?\(?\s*completion::\s*[^\])]+[\])]?/gi, "");
  result = result.replace(/\s*\u2705\s*\d{4}-\d{2}-\d{2}/g, "");
  return result.replace(/\s+/g, " ").trim();
}

// src/services/TaskManager.ts
var TaskManager = class extends import_obsidian.Events {
  constructor(parser, app) {
    super();
    this.parser = parser;
    this.app = app;
    this.tasks = [];
    this.filteredTasks = [];
    this.isInternalChange = false;
    this.currentStatusFilter = "open" /* Open */;
    this.currentCourseFilter = null;
  }
  async loadTasks() {
    this.tasks = await this.parser.findAllTasks();
    this.applyFiltersAndSort();
    this.trigger("tasks-updated");
  }
  getIsInternalChange() {
    return this.isInternalChange;
  }
  /**
   * Identifies manual state changes in a file and applies automation (adds metadata).
   *
   * The lock is set BEFORE the first await so no second modify event can slip
   * through while we are reading the file. We call addCompletionMetadata instead
   * of toggleTaskCompletion because the task is already [x] in the file at this
   * point — calling a toggle would un-check it, causing the flicker.
   */
  async processManualUpdate(file) {
    if (this.isInternalChange) return;
    const cachedTasks = this.tasks.filter((t) => t.filePath === file.path);
    this.isInternalChange = true;
    try {
      const freshTasks = await this.parser.getTasksFromFile(file.path);
      for (const fresh of freshTasks) {
        const cached = cachedTasks.find((c) => c.lineNumber === fresh.lineNumber);
        if (cached && !cached.completed && fresh.completed) {
          await this.addCompletionMetadata(fresh);
          return;
        }
        if (cached && cached.completed && !fresh.completed) {
          await this.removeCompletionMetadata(fresh);
          return;
        }
      }
    } finally {
      this.isInternalChange = false;
    }
    await this.refreshFileTask(file.path);
  }
  /**
   * Builds the cloned line for a recurring task after completion.
   * Handles three date configurations:
   *  - due:: only → advance due:: to next occurrence.
   *  - due:: + start:: → advance both, preserving the original start-to-due window.
   *  - start:: only → use start:: as the scheduling anchor, advance it to next occurrence.
   *    (A recurring task with no due date is ambiguous; start:: is the best available anchor.)
   * In all cases the checkbox is reset to [ ] and the completion metadata is NOT copied.
   */
  buildClonedLine(originalLine, task, completionDate) {
    var _a, _b, _c;
    const anchor = (_b = (_a = task.dueDate) != null ? _a : task.startDate) != null ? _b : null;
    const nextDate = this.calculateNextDueDate(anchor, (_c = task.recurrence) != null ? _c : "", completionDate);
    const dateStr = this.formatDate(nextDate);
    let clonedLine = originalLine;
    if (task.dueDate) {
      const dueRegex = /(\[?due::\s*)(\d{4}-\d{2}-\d{2})([\])]?)/i;
      clonedLine = clonedLine.replace(dueRegex, `$1${dateStr}$3`);
      if (task.startDate) {
        const windowMs = task.dueDate.getTime() - task.startDate.getTime();
        const nextStart = new Date(nextDate.getTime() - windowMs);
        const startRegex = /(\[?start::\s*)(\d{4}-\d{2}-\d{2})([\])]?)/i;
        clonedLine = clonedLine.replace(startRegex, `$1${this.formatDate(nextStart)}$3`);
      }
    } else if (task.startDate) {
      const startRegex = /(\[?start::\s*)(\d{4}-\d{2}-\d{2})([\])]?)/i;
      clonedLine = clonedLine.replace(startRegex, `$1${dateStr}$3`);
    }
    clonedLine = clonedLine.replace(/\[[xX]]/, "[ ]");
    clonedLine = stripCompletionMetadata(clonedLine);
    if (!hasRecurrenceMetadata(clonedLine) && task.recurrence) {
      clonedLine += ` [repeat:: ${task.recurrence}]`;
    }
    return clonedLine;
  }
  /**
   * Inserts a cloned recurring task line immediately after the completed one,
   * unless an open clone of the same task already exists on the next line.
   * Extracted because addCompletionMetadata and toggleTaskCompletion both need
   * exactly this logic.
   */
  spliceCloneIfNeeded(lines, task, clonedLine) {
    var _a;
    const nextLine = (_a = lines[task.lineNumber + 1]) != null ? _a : "";
    const nextIsOpenTask = /\[ ]/.test(nextLine);
    const normalise = (l) => l.replace(/\[(?:completion|repeat|due|start)::[^\]]*]/gi, "").replace(/\s+/g, " ").trim();
    const alreadyCloned = nextIsOpenTask && normalise(nextLine).includes(normalise(task.title));
    if (!alreadyCloned) {
      lines.splice(task.lineNumber + 1, 0, clonedLine);
    }
  }
  /**
   * Adds completion metadata and handles recurrence for a task that was
   * already checked [x] by the user directly in the editor.
   * Unlike toggleTaskCompletion, this method never changes the checkbox state.
   */
  async addCompletionMetadata(task) {
    const file = this.app.vault.getAbstractFileByPath(task.filePath);
    if (!(file instanceof import_obsidian.TFile)) return;
    const content = await this.app.vault.read(file);
    const lines = content.split("\n");
    const originalLine = lines[task.lineNumber];
    if (!/\[[xX]]/.test(originalLine)) return;
    const stripped = hasCompletionMetadata(originalLine) ? stripCompletionMetadata(originalLine) : originalLine;
    const completionDate = /* @__PURE__ */ new Date();
    const compStr = this.formatCompletionDate(completionDate);
    lines[task.lineNumber] = stripped + ` [completion:: ${compStr}]`;
    if (task.recurrence) {
      this.spliceCloneIfNeeded(lines, task, this.buildClonedLine(originalLine, task, completionDate));
    }
    await this.app.vault.modify(file, lines.join("\n"));
    await this.refreshFileTask(task.filePath);
  }
  /**
   * Strips completion metadata from a task that was unchecked directly in the editor.
   * Mirrors addCompletionMetadata: never touches the checkbox state, only the metadata.
   */
  async removeCompletionMetadata(task) {
    const file = this.app.vault.getAbstractFileByPath(task.filePath);
    if (!(file instanceof import_obsidian.TFile)) return;
    const content = await this.app.vault.read(file);
    const lines = content.split("\n");
    const originalLine = lines[task.lineNumber];
    if (/\[[xX]]/.test(originalLine)) return;
    const cleaned = stripCompletionMetadata(originalLine);
    if (cleaned === originalLine) return;
    lines[task.lineNumber] = cleaned;
    await this.app.vault.modify(file, lines.join("\n"));
    await this.refreshFileTask(task.filePath);
  }
  /**
   * Toggle a task's completion state in its file
   */
  async toggleTaskCompletion(task) {
    const file = this.app.vault.getAbstractFileByPath(task.filePath);
    if (!(file instanceof import_obsidian.TFile)) return;
    const content = await this.app.vault.read(file);
    const lines = content.split("\n");
    const originalLine = lines[task.lineNumber];
    const isCurrentlyCompleted = /\[[xX]]/.test(originalLine);
    if (isCurrentlyCompleted) {
      let newLine = originalLine.replace(/\[[xX]]/, "[ ]");
      newLine = stripCompletionMetadata(newLine);
      lines[task.lineNumber] = newLine;
    } else {
      if (!hasCompletionMetadata(originalLine)) {
        const completionDate = /* @__PURE__ */ new Date();
        const compStr = this.formatCompletionDate(completionDate);
        let newLine = originalLine.replace(/\[ ]/, "[x]");
        newLine += ` [completion:: ${compStr}]`;
        lines[task.lineNumber] = newLine;
        if (task.recurrence) {
          this.spliceCloneIfNeeded(lines, task, this.buildClonedLine(originalLine, task, completionDate));
        }
      } else {
        lines[task.lineNumber] = originalLine.replace(/\[ ]/, "[x]");
      }
    }
    await this.app.vault.modify(file, lines.join("\n"));
    await this.refreshFileTask(task.filePath);
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
    if (!(file instanceof import_obsidian.TFile)) return;
    const content = await this.app.vault.read(file);
    const lines = content.split("\n");
    if (!lines[task.lineNumber]) return;
    const originalLine = lines[task.lineNumber];
    const match = originalLine.match(/^(\s*[-*]\s\[.\]\s)(.*)$/);
    if (!match) return;
    const prefix = match[1];
    const body = match[2];
    const metaPattern = /\[?\(?(?:due|start|completion|repeat)::[^\])]*/gi;
    const titleOnly = body.replace(metaPattern, "").replace(/\s+/g, " ").trim();
    let newBody;
    if (titleOnly.length > 0) {
      newBody = body.replace(titleOnly, newTitle);
    } else {
      newBody = newTitle;
    }
    if (newDate) {
      const dateStr = this.formatDate(newDate);
      const dueRegex = /(\[?\(?due::\s*)(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})([\])]?)/i;
      if (dueRegex.test(newBody)) {
        newBody = newBody.replace(dueRegex, `$1${dateStr}$3`);
      } else {
        newBody = `${newBody} [due:: ${dateStr}]`;
      }
    }
    lines[task.lineNumber] = `${prefix}${newBody}`;
    await this.app.vault.modify(file, lines.join("\n"));
    await this.refreshFileTask(task.filePath);
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
  /**
   * Collapses recurring clones into one TaskGroup per series.
   * Non-recurring tasks each become their own group (openCount: 1, isRecurring: false).
   * The representative is the earliest-due open clone, falling back to the latest
   * completed task when all clones in a series are done.
   *
   * allTasks is the unfiltered task list — used to count completed cycles accurately
   * even when the caller passes a filtered subset as `tasks`.
   */
  groupTasks(tasks, allTasks = tasks) {
    var _a;
    const seriesMap = /* @__PURE__ */ new Map();
    const insertionOrder = [];
    for (const task of tasks) {
      const key = task.recurrence ? `${task.filePath}::${task.title}::${task.recurrence}` : task.id;
      let series = seriesMap.get(key);
      if (series === void 0) {
        series = [];
        seriesMap.set(key, series);
        insertionOrder.push(key);
      }
      series.push(task);
    }
    const doneMap = /* @__PURE__ */ new Map();
    for (const task of allTasks) {
      if (!task.completed || !task.recurrence) continue;
      const key = `${task.filePath}::${task.title}::${task.recurrence}`;
      doneMap.set(key, ((_a = doneMap.get(key)) != null ? _a : 0) + 1);
    }
    return insertionOrder.map((key) => {
      var _a2, _b, _c;
      const clones = (_a2 = seriesMap.get(key)) != null ? _a2 : [];
      const open = clones.filter((t) => !t.completed);
      const pool = open.length > 0 ? open : clones;
      const representative = pool.reduce((earliest, t) => {
        var _a3, _b2, _c2, _d;
        const eTime = (_b2 = (_a3 = earliest.dueDate) == null ? void 0 : _a3.getTime()) != null ? _b2 : Infinity;
        const tTime = (_d = (_c2 = t.dueDate) == null ? void 0 : _c2.getTime()) != null ? _d : Infinity;
        return tTime < eTime ? t : earliest;
      });
      return {
        representative,
        openCount: open.length,
        doneCount: (_b = doneMap.get(key)) != null ? _b : 0,
        isRecurring: !!((_c = clones[0]) == null ? void 0 : _c.recurrence)
      };
    });
  }
  /** For the task list view: filtered tasks collapsed into recurring groups. */
  getGroupedFilteredTasks() {
    return this.groupTasks(this.filteredTasks, this.tasks);
  }
  /** For the timeline: all tasks (no status filter) collapsed into recurring groups. */
  getAllGroupedTasks() {
    return this.groupTasks(this.tasks);
  }
  getScannedFiles() {
    return this.parser.getFilesToScan().map((file) => file.path);
  }
  getStatistics() {
    const groups = this.groupTasks(this.tasks);
    const todayStr = this.formatDate(/* @__PURE__ */ new Date());
    return {
      total: groups.length,
      completed: groups.filter((g) => g.representative.completed).length,
      completedToday: this.tasks.filter(
        (t) => t.completed && t.completionDate && this.formatDate(t.completionDate) === todayStr
      ).length,
      overdue: groups.filter((g) => getTaskStatus(g.representative) === "overdue" /* Overdue */).length,
      upcoming: groups.filter((g) => getTaskStatus(g.representative) === "upcoming_week" /* UpcomingWeek */).length,
      urgent: groups.filter((g) => getTaskStatus(g.representative) === "urgent" /* Urgent */).length,
      courses: new Set(this.tasks.map((t) => t.fileName)).size
    };
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
  getCurrentFilters() {
    return {
      status: this.currentStatusFilter,
      course: this.currentCourseFilter
    };
  }
  async addTask(title, date, filePath, recurrence) {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (file instanceof import_obsidian.TFile) {
      const content = await this.app.vault.read(file);
      let taskLine = `
- [ ] ${title}`;
      if (date) taskLine += ` [due:: ${this.formatDate(date)}]`;
      if (recurrence) taskLine += ` [repeat:: ${recurrence}]`;
      await this.app.vault.modify(file, content + taskLine);
      await this.refreshFileTask(filePath);
    }
  }
  formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${String(y)}-${m}-${d}`;
  }
  /** Display format: dd-mm-yyyy. Storage format (formatDate) stays yyyy-mm-dd. */
  static formatDisplayDate(date) {
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const y = date.getFullYear();
    return `${d}-${m}-${String(y)}`;
  }
  formatCompletionDate(date) {
    const pad = (n) => n.toString().padStart(2, "0");
    const dd = pad(date.getDate());
    const mm = pad(date.getMonth() + 1);
    const yyyy = date.getFullYear();
    const hh = pad(date.getHours());
    const min = pad(date.getMinutes());
    return `${dd}-${mm}-${String(yyyy)} ${hh}:${min}`;
  }
  /** Helper to calculate the bumped due date for recurring tasks */
  calculateNextDueDate(dueDate, recurrence, completionDate) {
    const isFlexible = recurrence.endsWith("+");
    const rule = recurrence.replace("+", "").trim().toLowerCase();
    const baseDate = new Date(isFlexible || !dueDate ? completionDate : dueDate);
    const nextDate = new Date(baseDate);
    let amount = 1;
    let unit = "d";
    if (rule === "daily" || rule === "d") {
      unit = "d";
    } else if (rule === "weekly" || rule === "w") {
      unit = "w";
    } else if (rule === "monthly" || rule === "m") {
      unit = "m";
    } else if (rule === "yearly" || rule === "y") {
      unit = "y";
    } else {
      const match = rule.match(/^(\d+)([dwmy])$/);
      if (match) {
        amount = parseInt(match[1], 10);
        unit = match[2];
      }
    }
    switch (unit) {
      case "d":
        nextDate.setDate(nextDate.getDate() + amount);
        break;
      case "w":
        nextDate.setDate(nextDate.getDate() + amount * 7);
        break;
      case "m": {
        const originalDay = nextDate.getDate();
        nextDate.setDate(1);
        nextDate.setMonth(nextDate.getMonth() + amount);
        const lastDayOfMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
        nextDate.setDate(Math.min(originalDay, lastDayOfMonth));
        break;
      }
      case "y": {
        const originalDay = nextDate.getDate();
        nextDate.setDate(1);
        nextDate.setFullYear(nextDate.getFullYear() + amount);
        const lastDayOfMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
        nextDate.setDate(Math.min(originalDay, lastDayOfMonth));
        break;
      }
    }
    return nextDate;
  }
  applyFiltersAndSort() {
    this.filteredTasks = this.tasks.filter((task) => {
      if (this.currentCourseFilter && task.fileName !== this.currentCourseFilter) return false;
      if (this.currentStatusFilter === "all" /* All */) return true;
      if (this.currentStatusFilter === "open" /* Open */) return !task.completed;
      return getTaskStatus(task) === this.currentStatusFilter;
    });
    this.filteredTasks.sort((a, b) => {
      const weightA = this.getStatusWeight(a);
      const weightB = this.getStatusWeight(b);
      if (weightA !== weightB) return weightA - weightB;
      if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
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
var _TaskParser = class _TaskParser {
  // NOTE: All gi-flagged static regexes above (START_REGEX, DUE_REGEX, COMP_REGEX, REPEAT_REGEX)
  // carry lastIndex state between calls because they are shared class-level objects.
  // parseTaskMetadata() resets lastIndex to 0 before every exec() call to prevent
  // a previous match position from skipping characters on the next parse.
  // String.prototype.replace() resets lastIndex internally when called, so the
  // title.replace(REGEX, '') calls after exec() are safe without an extra reset.
  constructor(app, settings) {
    this.app = app;
    this.settings = settings;
  }
  /**
   * RENAMED: Matches TaskManager.loadTasks()
   */
  async findAllTasks() {
    const filesToScan = this.getFilesToScan();
    const taskPromises = filesToScan.map((file) => this.parseTasksFromFile(file));
    const allFileTasks = await Promise.all(taskPromises);
    return allFileTasks.flat();
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
      const taskMatch = line.match(/^(\s*)-\s\[([ xX])]\s(.+)$/);
      if (taskMatch) {
        const completed = taskMatch[2].toLowerCase() === "x";
        const taskText = taskMatch[3];
        const { title, startDate, dueDate, completionDate, recurrence, notes } = this.parseTaskMetadata(taskText);
        const task = {
          id: `${file.path}:${String(i)}`,
          title,
          completed,
          filePath: file.path,
          fileName: courseName,
          lineNumber: i,
          startDate,
          dueDate,
          completionDate,
          // Added
          recurrence,
          // Added
          notes,
          // Added
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
          if (val) return val;
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
    let completionDate;
    let recurrence;
    let notes;
    const parseDate = (raw) => {
      const dmy = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
      const iso = dmy ? `${dmy[3]}-${dmy[2]}-${dmy[1]}` : raw;
      return /* @__PURE__ */ new Date(`${iso}T00:00:00`);
    };
    _TaskParser.START_REGEX.lastIndex = 0;
    const startMatch = _TaskParser.START_REGEX.exec(taskText);
    if (startMatch) {
      startDate = parseDate(startMatch[1]);
      title = title.replace(_TaskParser.START_REGEX, "");
    }
    _TaskParser.DUE_REGEX.lastIndex = 0;
    const dueMatch = _TaskParser.DUE_REGEX.exec(taskText);
    if (dueMatch) {
      dueDate = parseDate(dueMatch[1]);
      title = title.replace(_TaskParser.DUE_REGEX, "");
    }
    _TaskParser.COMP_REGEX.lastIndex = 0;
    const compMatch = _TaskParser.COMP_REGEX.exec(taskText);
    if (compMatch) {
      completionDate = parseDate(compMatch[1]);
      title = title.replace(_TaskParser.COMP_REGEX, "");
    }
    _TaskParser.REPEAT_REGEX.lastIndex = 0;
    const repeatMatch = _TaskParser.REPEAT_REGEX.exec(taskText);
    if (repeatMatch) {
      recurrence = repeatMatch[1].trim().toLowerCase();
      title = title.replace(_TaskParser.REPEAT_REGEX, "");
    }
    _TaskParser.NOTES_REGEX.lastIndex = 0;
    const notesMatch = _TaskParser.NOTES_REGEX.exec(taskText);
    if (notesMatch) {
      notes = notesMatch[1].trim();
      title = title.replace(_TaskParser.NOTES_REGEX, "");
    }
    if (!recurrence) {
      const emojiRecurMatch = taskText.match(_TaskParser.EMOJI_RECUR_MATCH_REGEX);
      if (emojiRecurMatch) {
        recurrence = emojiRecurMatch[1].trim().toLowerCase();
        title = title.replace(_TaskParser.EMOJI_RECUR_REPLACE_REGEX, "").trim();
      }
    }
    if (!dueDate) {
      const emojiMatch = taskText.match(_TaskParser.EMOJI_DATE_MATCH_REGEX);
      if (emojiMatch) {
        dueDate = parseDate(emojiMatch[1]);
        title = title.replace(_TaskParser.EMOJI_DATE_REPLACE_REGEX, "");
      }
    }
    title = title.replace(/\s+/g, " ").trim();
    return { title, startDate, dueDate, completionDate, recurrence, notes };
  }
};
// Matches both yyyy-mm-dd and dd-mm-yyyy after the key
_TaskParser.DATE_PAT = "(\\d{4}-\\d{2}-\\d{2}|\\d{2}-\\d{2}-\\d{4})";
// 1. START DATE
_TaskParser.START_REGEX = new RegExp(`\\[?\\(?start::\\s*${_TaskParser.DATE_PAT}[\\])]?`, "gi");
// 2. DUE DATE
_TaskParser.DUE_REGEX = new RegExp(`\\[?\\(?due::\\s*${_TaskParser.DATE_PAT}[\\])]?`, "gi");
// 3. COMPLETION DATE (also supports HH:mm suffix)
_TaskParser.COMP_REGEX = new RegExp(`\\[?\\(?completion::\\s*(\\d{4}-\\d{2}-\\d{2}|\\d{2}-\\d{2}-\\d{4})(?:\\s\\d{2}:\\d{2})?[\\])]?`, "gi");
// 4. RECURRENCE — TaskLens format: [repeat:: weekly]
_TaskParser.REPEAT_REGEX = /\[?\(?repeat::\s*([^\]]+)[\])]?/gi;
// 5. NOTES — TaskLens format: [notes:: ...]
_TaskParser.NOTES_REGEX = /\[?\(?notes::\s*([^\])]+)[\])]?/gi;
// Fallback emoji regexes
_TaskParser.EMOJI_RECUR_MATCH_REGEX = /[\u{1F501}\u{1F504}]\s*([^[\u{1F4C5}\u2705]+)/u;
_TaskParser.EMOJI_RECUR_REPLACE_REGEX = /[\u{1F501}\u{1F504}]\s*[^[\u{1F4C5}\u2705]+/u;
_TaskParser.EMOJI_DATE_MATCH_REGEX = /\u{1F4C5}\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})/u;
_TaskParser.EMOJI_DATE_REPLACE_REGEX = /\u{1F4C5}\s*(?:\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})\s*/gu;
var TaskParser = _TaskParser;

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
  appWideAutomation: true,
  hasSeenWelcome: false,
  hasClickedRibbonIcon: false,
  settingsTabState: {
    scanOpen: true,
    parserOpen: false,
    uiOpen: true
  },
  savedFocusLayout: null
};
function getTopicColor(topic, settings) {
  if (settings.topicColors[topic]) {
    return settings.topicColors[topic];
  }
  const defaultPalette = ["#4cc9f0", "#f72585", "#7209b7", "#3a0ca3", "#4361ee", "#4caf50"];
  let hash = 0;
  for (let i = 0; i < topic.length; i++) hash = topic.charCodeAt(i) + ((hash << 5) - hash);
  return defaultPalette[Math.abs(hash) % defaultPalette.length];
}

// src/settings/SettingsTab.ts
var import_obsidian4 = require("obsidian");

// src/modals/WelcomeModal.ts
var import_obsidian3 = require("obsidian");

// src/constants.ts
var VIEW_TYPE_DASHBOARD = "tasklens-dashboard-view";
var VIEW_TYPE_TIMELINE = "tasklens-timeline-view";
var VIEW_TYPE_LIST = "tasklens-list-view";
var VIEW_TYPE_STATS = "tasklens-stats-view";
var ICON_NAME = "tasklens-icon";
var ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="11" cy="11" r="8"></circle>
  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  <path d="M8 11.5L10 13.5L14 8.5"></path>
</svg>`;
var CLASS_HIDE_TABS = "tasklens-hide-tabs";
var CLASS_CHROMELESS = "tasklens-chromeless";
var CLASS_DASHBOARD_VIEW = "tasklens-dashboard-content";
var CLASS_SETTINGS = "tasklens-settings";
var CLASS_WELCOME_MODAL = "tasklens-welcome-modal";
var CLASS_FEATURE_HIGHLIGHT = "feature-highlight";
var ALL_VIEW_TYPES = [
  VIEW_TYPE_DASHBOARD,
  VIEW_TYPE_TIMELINE,
  VIEW_TYPE_LIST,
  VIEW_TYPE_STATS
];

// src/modals/WelcomeModal.ts
var WelcomeModal = class extends import_obsidian3.Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass(CLASS_WELCOME_MODAL);
    const header = contentEl.createDiv("welcome-header");
    header.setCssProps({ "text-align": "center", "margin-bottom": "20px" });
    header.createEl("h1", { text: "Welcome to tasklens \u{1F680}" });
    header.createEl("p", { text: "Your command center for tasks, timelines, and projects.", cls: "text-muted" });
    const tutorial = contentEl.createDiv("welcome-tutorial");
    this.createStep(tutorial, "\u{1F4CA}", "The dashboard", "Click the new Dashboard icon in the left ribbon to open your master view. It combines your Timeline, Stats, and Task List.");
    this.createStep(tutorial, "\u{1F5B1}\uFE0F", "Move & resize", 'By default, the layout is locked for a clean look. Click the "Move" icon (arrow cross) in the left ribbon to unlock tabs and arrange widgets.');
    this.createStep(tutorial, "\u2795", "Quick add", 'Click the pulsing "+" icon at the top right of the dashboard to instantly create tasks in any file.');
    this.createStep(tutorial, "\u{1F4DD}", "Inline editing", "Hover over any task in the list to reveal the Pencil (edit) and Trash (delete) icons.");
    this.createStep(tutorial, "\u{1F3AF}", "Smart filters", 'Click any statistic card (like "Urgent") to instantly filter your task list!');
    contentEl.createEl("hr");
    new import_obsidian3.Setting(contentEl).setName("Do not show this window again").setDesc("You can always reopen this from the settings tab.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.hasSeenWelcome).onChange((value) => {
        this.plugin.settings.hasSeenWelcome = value;
        void this.plugin.saveSettings().then(() => {
          this.plugin.refreshViews();
        });
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
    containerEl.addClass(CLASS_SETTINGS);
    new import_obsidian4.Setting(containerEl).setName("Configuration").setHeading().addExtraButton(
      (btn) => btn.setIcon("help-circle").setTooltip("Show tutorial").onClick(() => {
        new WelcomeModal(this.app, this.plugin).open();
      })
    );
    const scanDetails = containerEl.createEl("details");
    scanDetails.open = this.plugin.settings.settingsTabState.scanOpen;
    scanDetails.createEl("summary", { text: "Vault scanning" });
    scanDetails.addEventListener("toggle", () => {
      this.plugin.settings.settingsTabState.scanOpen = scanDetails.open;
      void this.plugin.saveSettings();
    });
    const scanPathsSetting = new import_obsidian4.Setting(scanDetails).setName("Scan paths").setDesc("Folders (e.g. Uni/Math)\nor specific files (e.g. Projects/Todo.md).\n\nOne per line.\nLeave empty to scan entire vault.").addTextArea((text) => {
      text.setPlaceholder("Projects\nUni/History\nTo-Do.md").setValue(this.plugin.settings.scanFolders.join("\n")).onChange((value) => {
        this.plugin.settings.scanFolders = value.split("\n").map((s) => s.trim()).filter((s) => s.length > 0);
        void this.plugin.saveSettings().then(() => {
          void this.plugin.taskManager.loadTasks();
        });
      });
    });
    scanPathsSetting.settingEl.addClass("scan-paths-setting");
    new import_obsidian4.Setting(scanDetails).setName("Recursive scan").setDesc("Scan all subfolders inside the folders specified above?").addToggle((t) => t.setValue(this.plugin.settings.scanRecursively).onChange((v) => {
      this.plugin.settings.scanRecursively = v;
      void this.plugin.saveSettings().then(() => {
        void this.plugin.taskManager.loadTasks();
      });
    }));
    const parserDetails = containerEl.createEl("details");
    parserDetails.open = this.plugin.settings.settingsTabState.parserOpen;
    parserDetails.createEl("summary", { text: "Task parsing & automation" });
    parserDetails.addEventListener("toggle", () => {
      this.plugin.settings.settingsTabState.parserOpen = parserDetails.open;
      void this.plugin.saveSettings();
    });
    new import_obsidian4.Setting(parserDetails).setName("App-wide automation").setDesc("Apply date stamping and recurrence even when editing notes directly.").addToggle((t) => t.setValue(this.plugin.settings.appWideAutomation).onChange((v) => {
      this.plugin.settings.appWideAutomation = v;
      void this.plugin.saveSettings();
    }));
    new import_obsidian4.Setting(parserDetails).setName("Start key").setDesc("Inline text used to find the start date. Example: [start:: 2026-02-02]").addText((t) => t.setValue(this.plugin.settings.startDateKey).onChange((v) => {
      this.plugin.settings.startDateKey = v;
      void this.plugin.saveSettings().then(() => {
        void this.plugin.taskManager.loadTasks();
      });
    }));
    new import_obsidian4.Setting(parserDetails).setName("Due key").setDesc("Inline text used to find the due date. You can combine them in one bracket! Example: [start:: 2026-02-02 due:: 2026-03-03]").addText((t) => t.setValue(this.plugin.settings.dueDateKey).onChange((v) => {
      this.plugin.settings.dueDateKey = v;
      void this.plugin.saveSettings().then(() => {
        void this.plugin.taskManager.loadTasks();
      });
    }));
    const uiDetails = containerEl.createEl("details");
    uiDetails.open = this.plugin.settings.settingsTabState.uiOpen;
    uiDetails.createEl("summary", { text: "Appearance & colors" });
    uiDetails.addEventListener("toggle", () => {
      this.plugin.settings.settingsTabState.uiOpen = uiDetails.open;
      void this.plugin.saveSettings();
    });
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
          void this.plugin.saveSettings().then(() => {
            this.plugin.refreshViews();
          });
        }));
        new import_obsidian4.Setting(colorPickersContainer).setName("Urgent color").addColorPicker((c) => c.setValue(this.plugin.settings.colors.urgent).onChange((v) => {
          this.plugin.settings.colors.urgent = v;
          void this.plugin.saveSettings().then(() => {
            this.plugin.refreshViews();
          });
        }));
        new import_obsidian4.Setting(colorPickersContainer).setName("Active color").addColorPicker((c) => c.setValue(this.plugin.settings.colors.active).onChange((v) => {
          this.plugin.settings.colors.active = v;
          void this.plugin.saveSettings().then(() => {
            this.plugin.refreshViews();
          });
        }));
        new import_obsidian4.Setting(colorPickersContainer).setName("Completed color").addColorPicker((c) => c.setValue(this.plugin.settings.colors.completed).onChange((v) => {
          this.plugin.settings.colors.completed = v;
          void this.plugin.saveSettings().then(() => {
            this.plugin.refreshViews();
          });
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
            void this.plugin.saveSettings().then(() => {
              this.plugin.refreshViews();
            });
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
var import_obsidian6 = require("obsidian");

// src/views/TaskListComponent.ts
var import_obsidian5 = require("obsidian");
async function openTaskInEditor(app, task) {
  const file = app.vault.getAbstractFileByPath(task.filePath);
  if (!(file instanceof import_obsidian5.TFile)) return;
  const leaf = app.workspace.getLeaf(false);
  await leaf.openFile(file);
  const view = app.workspace.getActiveViewOfType(import_obsidian5.MarkdownView);
  if (view) {
    const pos = { line: task.lineNumber, ch: 0 };
    view.editor.setCursor(pos);
    view.editor.scrollIntoView({ from: pos, to: pos }, true);
  }
}
var TaskListComponent = class {
  constructor(container, app, callbacks, settings) {
    this.container = container;
    this.app = app;
    this.callbacks = callbacks;
    this.settings = settings;
  }
  render(groups) {
    this.container.empty();
    if (groups.length === 0) {
      const empty = this.container.createDiv("dashboard-empty-state");
      empty.createEl("p", { text: "No tasks found." });
      return;
    }
    const listContainer = this.container.createDiv("dashboard-task-list");
    groups.forEach((group) => {
      this.renderTaskItem(listContainer, group);
    });
  }
  renderTaskItem(container, group) {
    const task = group.representative;
    const taskEl = container.createDiv({ cls: ["task-item"] });
    if (this.settings.colorMode === "course" && task.fileName) {
      taskEl.setCssProps({ "border-left-color": getTopicColor(task.fileName, this.settings) });
    } else {
      const status = getTaskStatus(task);
      if (status === "overdue" /* Overdue */) taskEl.addClass("status-overdue");
      if (status === "urgent" /* Urgent */) taskEl.addClass("status-urgent");
      if (status === "completed" /* Completed */) taskEl.addClass("status-completed");
      if (status === "upcoming_week" /* UpcomingWeek */) taskEl.addClass("status-active");
    }
    const checkbox = taskEl.createEl("input", { type: "checkbox", cls: "task-checkbox" });
    checkbox.checked = task.completed;
    checkbox.setAttribute("aria-label", `Toggle task: ${task.title}`);
    checkbox.addEventListener("change", () => {
      this.callbacks.onToggle(task);
    });
    const content = taskEl.createDiv("task-content");
    const viewMode = content.createDiv("task-view-mode");
    const titleRow = viewMode.createDiv("task-title-row");
    const titleEl = titleRow.createDiv("task-title");
    titleEl.setText(task.title);
    const meta = viewMode.createDiv("task-meta");
    if (task.fileName) {
      const courseLabel = meta.createDiv("task-course");
      courseLabel.setText(task.fileName);
    }
    if (task.dueDate) {
      const dateLabel = meta.createDiv("task-date");
      dateLabel.setText(TaskManager.formatDisplayDate(task.dueDate));
    }
    if (group.isRecurring) {
      const recurringChip = meta.createDiv("task-recurring-chip");
      const icon = recurringChip.createSpan({ cls: "task-recurring-icon" });
      (0, import_obsidian5.setIcon)(icon, "repeat");
      if (group.doneCount > 0) {
        recurringChip.createSpan({
          text: `\xD7${String(group.doneCount)}`,
          cls: "task-recurrence-count",
          attr: { "aria-label": `Completed ${String(group.doneCount)} time${group.doneCount === 1 ? "" : "s"}` }
        });
      }
    }
    titleEl.addEventListener("click", () => {
      void openTaskInEditor(this.app, task);
    });
  }
};

// src/views/TimelineComponent.ts
var _TimelineComponent = class _TimelineComponent {
  constructor(container, app, groups, daysToShow = 10, settings, viewportStart, onViewportChange) {
    this.scrollContainer = null;
    this.tooltipEl = null;
    // Persists the nav ribbon panel's open state across re-renders triggered by viewport jumps
    this.ribbonNavOpen = false;
    // Stored so it can be removed before re-render
    this.ribbonOutsideHandler = null;
    // Drag-to-scroll state
    this.isDragging = false;
    this.startX = 0;
    this.scrollLeftPos = 0;
    this.container = container;
    this.app = app;
    this.groups = groups;
    this.daysToShow = daysToShow;
    this.settings = settings;
    this.onViewportChange = onViewportChange != null ? onViewportChange : null;
    if (viewportStart) {
      this.viewportStart = new Date(viewportStart);
    } else {
      const defaultStart = /* @__PURE__ */ new Date();
      defaultStart.setMonth(defaultStart.getMonth() - 3);
      defaultStart.setHours(0, 0, 0, 0);
      this.viewportStart = defaultStart;
    }
  }
  getViewportStart() {
    return new Date(this.viewportStart);
  }
  // Commits a new viewport start date, fires the change callback, re-renders, and resets pan
  applyViewportJump(newStart) {
    var _a;
    this.viewportStart = newStart;
    if (this.onViewportChange) this.onViewportChange(new Date(newStart));
    this.render();
    (_a = this.scrollContainer) == null ? void 0 : _a.scrollTo({ left: 0, behavior: "auto" });
  }
  // Shifts the viewport by the given number of months and re-renders
  jumpViewport(monthDelta) {
    const next = new Date(this.viewportStart);
    next.setMonth(next.getMonth() + monthDelta);
    this.applyViewportJump(next);
  }
  // Jumps the viewport so the given date sits near the left edge, then re-renders
  jumpToDate(date) {
    const target = new Date(date);
    target.setDate(target.getDate() - 14);
    target.setHours(0, 0, 0, 0);
    this.applyViewportJump(target);
  }
  // Renders a single month label cell in the month header row
  renderMonthCell(headerRow, day, span, colWidth, startIdx) {
    const monthName = day.toLocaleString("default", { month: "long", year: "numeric" });
    const cell = headerRow.createDiv("timeline-month-cell");
    cell.setText(monthName);
    cell.setCssProps({
      width: `${String(span * colWidth)}%`,
      left: `${String(startIdx * colWidth)}%`
    });
  }
  // Builds the fixed-width day array for the current viewport
  buildViewportDays() {
    const days = [];
    const curr = new Date(this.viewportStart);
    curr.setHours(0, 0, 0, 0);
    for (let i = 0; i < _TimelineComponent.MAX_DAYS; i++) {
      days.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }
    return days;
  }
  createSideRibbon(allDays, validTasks) {
    const ribbon = this.container.createDiv("timeline-ribbon");
    const navSection = ribbon.createDiv("ribbon-section ribbon-section--nav");
    const navHandle = navSection.createDiv("ribbon-handle ribbon-handle--nav");
    navHandle.setAttribute("aria-label", "Navigate timeline");
    const navIconWrap = navHandle.createDiv("ribbon-handle-icon");
    (0, import_obsidian6.setIcon)(navIconWrap, "calendar-range");
    const navHoverLabel = navSection.createDiv("ribbon-hover-label");
    navHoverLabel.setText("Navigate");
    const navPanel = navSection.createDiv("ribbon-panel");
    const openNav = () => {
      this.ribbonNavOpen = true;
      navSection.addClass("is-open");
      if (this.ribbonOutsideHandler) {
        document.removeEventListener("mousedown", this.ribbonOutsideHandler);
        this.ribbonOutsideHandler = null;
      }
      const handler = (e) => {
        const target = e.target;
        if (!(target instanceof Node)) return;
        if (!navSection.contains(target)) {
          this.ribbonNavOpen = false;
          navSection.removeClass("is-open");
          document.removeEventListener("mousedown", handler);
          this.ribbonOutsideHandler = null;
        }
      };
      this.ribbonOutsideHandler = handler;
      document.addEventListener("mousedown", handler);
    };
    const closeNav = () => {
      this.ribbonNavOpen = false;
      navSection.removeClass("is-open");
      if (this.ribbonOutsideHandler) {
        document.removeEventListener("mousedown", this.ribbonOutsideHandler);
        this.ribbonOutsideHandler = null;
      }
    };
    if (this.ribbonNavOpen) openNav();
    const viewportEnd = new Date(this.viewportStart);
    viewportEnd.setDate(viewportEnd.getDate() + _TimelineComponent.MAX_DAYS - 1);
    const startLabel = this.viewportStart.toLocaleString("default", { month: "short", year: "2-digit" });
    const endLabel = viewportEnd.toLocaleString("default", { month: "short", year: "2-digit" });
    const navControls = navPanel.createDiv("ribbon-nav-controls");
    const prevBtn = navControls.createEl("button", { cls: "vp-jump" });
    prevBtn.setText("\u2039\u2039");
    prevBtn.setAttribute("aria-label", "Jump back 6 months");
    prevBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.ribbonNavOpen = true;
      this.jumpViewport(-_TimelineComponent.JUMP_MONTHS);
    });
    const rangeEl = navControls.createDiv("vp-range");
    rangeEl.createSpan().setText(startLabel);
    rangeEl.createEl("em").setText("/");
    rangeEl.createSpan().setText(endLabel);
    const nextBtn = navControls.createEl("button", { cls: "vp-jump" });
    nextBtn.setText("\u203A\u203A");
    nextBtn.setAttribute("aria-label", "Jump forward 6 months");
    nextBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.ribbonNavOpen = true;
      this.jumpViewport(_TimelineComponent.JUMP_MONTHS);
    });
    const windowStart = allDays[0];
    const windowEnd = allDays[allDays.length - 1];
    const outOfRange = validTasks.filter((t) => {
      if (!t.dueDate) return false;
      return t.dueDate < windowStart || t.dueDate > windowEnd;
    });
    if (outOfRange.length > 0) {
      const byMonth = /* @__PURE__ */ new Map();
      outOfRange.forEach((t) => {
        if (!t.dueDate) return;
        const key = t.dueDate.toLocaleString("default", { month: "short", year: "numeric" });
        const existing = byMonth.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          byMonth.set(key, { label: key, date: new Date(t.dueDate), count: 1 });
        }
      });
      const chipsEl = navPanel.createDiv("ribbon-chips");
      byMonth.forEach(({ label, date, count }) => {
        const isPast = date < windowStart;
        const chip = chipsEl.createEl("button", { cls: `chip ${isPast ? "chip--past" : "chip--future"}` });
        const countSuffix = count > 1 ? ` \xD7${String(count)}` : "";
        chip.setText(isPast ? `\u2190 ${label}${countSuffix}` : `${label}${countSuffix} \u2192`);
        chip.setAttribute("aria-label", `Jump to ${label}`);
        chip.addEventListener("click", (e) => {
          e.stopPropagation();
          this.ribbonNavOpen = true;
          this.jumpToDate(date);
        });
      });
    }
    navHandle.addEventListener("click", () => {
      if (navSection.hasClass("is-open")) {
        closeNav();
      } else {
        openNav();
      }
    });
    const syncSection = ribbon.createDiv("ribbon-section ribbon-section--sync");
    const syncHandle = syncSection.createDiv("ribbon-handle ribbon-handle--sync");
    syncHandle.setAttribute("aria-label", "Scroll to today");
    const syncIconWrap = syncHandle.createDiv("ribbon-handle-icon");
    (0, import_obsidian6.setIcon)(syncIconWrap, "rotate-ccw");
    const syncExpand = syncSection.createDiv("ribbon-sync-expand");
    const syncExpandIcon = syncExpand.createDiv("ribbon-sync-expand-icon");
    (0, import_obsidian6.setIcon)(syncExpandIcon, "rotate-ccw");
    syncExpand.createSpan({ cls: "ribbon-sync-expand-label" }).setText("Today");
    syncHandle.addEventListener("click", () => {
      this.scrollToToday();
    });
    syncExpand.addEventListener("click", () => {
      this.scrollToToday();
    });
  }
  render() {
    if (this.ribbonOutsideHandler) {
      document.removeEventListener("mousedown", this.ribbonOutsideHandler);
      this.ribbonOutsideHandler = null;
    }
    this.container.empty();
    this.container.addClass("timeline-wrapper");
    const validGroups = this.groups.filter((g) => {
      const t = g.representative;
      return t.dueDate && !isNaN(t.dueDate.getTime());
    });
    if (validGroups.length === 0) {
      const empty = this.container.createDiv("dashboard-empty-state");
      empty.createEl("p", { text: "No dated tasks to display." });
      return;
    }
    const allDays = this.buildViewportDays();
    this.createSideRibbon(allDays, validGroups.map((g) => g.representative));
    this.createNavigationOverlay("left");
    this.createNavigationOverlay("right");
    this.scrollContainer = this.container.createDiv("timeline-container");
    const scrollContent = this.scrollContainer.createDiv("timeline-scroll-content");
    scrollContent.setCssProps({ width: `${String(allDays.length / this.daysToShow * 100)}%` });
    const colWidthPercent = 100 / allDays.length;
    const monthHeader = scrollContent.createDiv("timeline-month-row");
    let currentMonth = -1;
    let monthStartIdx = 0;
    allDays.forEach((day, idx) => {
      const m = day.getMonth();
      if (m !== currentMonth) {
        if (currentMonth !== -1) {
          this.renderMonthCell(monthHeader, allDays[monthStartIdx], idx - monthStartIdx, colWidthPercent, monthStartIdx);
        }
        currentMonth = m;
        monthStartIdx = idx;
      }
    });
    this.renderMonthCell(monthHeader, allDays[monthStartIdx], allDays.length - monthStartIdx, colWidthPercent, monthStartIdx);
    const grid = scrollContent.createDiv("timeline-grid");
    grid.setCssProps({ "grid-template-columns": `repeat(${String(allDays.length)}, 1fr)` });
    allDays.forEach((day, idx) => {
      const cell = grid.createDiv("timeline-header-cell");
      cell.setText(day.getDate().toString());
      cell.createDiv("timeline-day-name").setText(day.toLocaleString("default", { weekday: "short" }));
      cell.setCssProps({ "grid-column": String(idx + 1), "grid-row": "1" });
      const bgCell = grid.createDiv("timeline-bg-cell");
      bgCell.setCssProps({ "grid-column": String(idx + 1), "grid-row": "2 / -1" });
      if (day.getDate() === 1) {
        cell.addClass("is-month-start");
        bgCell.addClass("is-month-start-bg");
      }
      if (day.toDateString() === (/* @__PURE__ */ new Date()).toDateString()) {
        cell.addClass("is-today");
        bgCell.addClass("is-today-bg");
        const marker = grid.createDiv("timeline-today-marker");
        marker.setCssProps({ "grid-column": String(idx + 1), "grid-row": "1 / -1" });
      }
    });
    const rowEndTimes = [];
    const windowStart = allDays[0];
    const windowEnd = allDays[allDays.length - 1];
    const sortedGroups = [...validGroups].sort((a, b) => {
      var _a, _b, _c, _d, _e, _f, _g, _h;
      const ta = a.representative;
      const tb = b.representative;
      if (ta.fileName !== tb.fileName) {
        return (ta.fileName || "").localeCompare(tb.fileName || "");
      }
      const aStart = (_d = (_c = (_a = ta.startDate) == null ? void 0 : _a.getTime()) != null ? _c : (_b = ta.dueDate) == null ? void 0 : _b.getTime()) != null ? _d : 0;
      const bStart = (_h = (_g = (_e = tb.startDate) == null ? void 0 : _e.getTime()) != null ? _g : (_f = tb.dueDate) == null ? void 0 : _f.getTime()) != null ? _h : 0;
      return aStart - bStart;
    });
    const windowStartMs = windowStart.getTime();
    const windowEndMs = windowEnd.getTime() + 86399999;
    const visibleGroups = sortedGroups.filter((group) => {
      var _a;
      const task = group.representative;
      if (!task.dueDate) return false;
      const dueMs = new Date(task.dueDate).setHours(23, 59, 59, 999);
      const startDate = (_a = task.startDate) != null ? _a : task.dueDate;
      const startMs = new Date(startDate).setHours(0, 0, 0, 0);
      return dueMs >= windowStartMs && startMs <= windowEndMs;
    });
    const dayIndexMap = /* @__PURE__ */ new Map();
    for (let i = 0; i < allDays.length; i++) {
      dayIndexMap.set(allDays[i].toDateString(), i);
    }
    visibleGroups.forEach((group) => {
      var _a, _b, _c;
      const task = group.representative;
      if (!task.dueDate) return;
      const taskStart = new Date((_a = task.startDate) != null ? _a : task.dueDate);
      const taskEnd = new Date(task.dueDate);
      taskStart.setHours(0, 0, 0, 0);
      taskEnd.setHours(0, 0, 0, 0);
      let startIdx = (_b = dayIndexMap.get(taskStart.toDateString())) != null ? _b : -1;
      let dueIdx = (_c = dayIndexMap.get(taskEnd.toDateString())) != null ? _c : -1;
      if (startIdx === -1 && taskStart < allDays[0]) startIdx = 0;
      if (dueIdx === -1 && taskEnd > allDays[allDays.length - 1]) dueIdx = allDays.length - 1;
      if (startIdx === -1 || dueIdx === -1 || startIdx === 0 && dueIdx === 0 && taskEnd < allDays[0]) return;
      let rowIndex = rowEndTimes.findIndex((endTime) => endTime < taskStart.getTime());
      if (rowIndex === -1) {
        rowIndex = rowEndTimes.length;
        rowEndTimes.push(taskEnd.getTime());
        const rowBg = grid.createDiv("timeline-row-bg");
        rowBg.setCssProps({ "grid-column": "1 / -1", "grid-row": String(rowIndex + 2) });
      } else {
        rowEndTimes[rowIndex] = taskEnd.getTime();
      }
      const barLabel = task.title;
      const bar = grid.createDiv("timeline-task-bar");
      bar.setText(barLabel);
      bar.setCssProps({
        "grid-column-start": String(startIdx + 1),
        "grid-column-end": `span ${String(dueIdx - startIdx + 1)}`,
        "grid-row": String(rowIndex + 2)
      });
      if (taskStart < allDays[0]) bar.addClass("is-clamped-left");
      if (taskEnd > allDays[allDays.length - 1]) bar.addClass("is-clamped-right");
      if (this.settings.colorMode === "course" && task.fileName) {
        bar.setCssProps({ "background-color": getTopicColor(task.fileName, this.settings) });
      } else {
        const statusClass = {
          ["overdue" /* Overdue */]: "status-overdue",
          ["urgent" /* Urgent */]: "status-urgent",
          ["completed" /* Completed */]: "status-completed",
          ["upcoming_week" /* UpcomingWeek */]: "status-active"
        };
        const cls = statusClass[getTaskStatus(task)];
        if (cls) bar.addClass(cls);
      }
      bar.addEventListener("mouseenter", (e) => {
        this.showTooltip(e, task, group.isRecurring);
      });
      bar.addEventListener("mouseleave", () => {
        this.hideTooltip();
      });
      bar.addEventListener("mousemove", (e) => {
        this.moveTooltip(e);
      });
      bar.addEventListener("click", (e) => {
        e.stopPropagation();
        void openTaskInEditor(this.app, task);
      });
    });
    this.setupEventListeners(this.scrollContainer);
  }
  getScrollPosition() {
    var _a, _b;
    return (_b = (_a = this.scrollContainer) == null ? void 0 : _a.scrollLeft) != null ? _b : 0;
  }
  setScrollPosition(pos) {
    var _a;
    (_a = this.scrollContainer) == null ? void 0 : _a.scrollTo({ left: pos, behavior: "auto" });
  }
  // Smoothly centres the viewport on today's column.
  // If today is outside the current window, jumps the viewport to bring it in first.
  scrollToToday() {
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    const windowEnd = new Date(this.viewportStart);
    windowEnd.setDate(windowEnd.getDate() + _TimelineComponent.MAX_DAYS - 1);
    if (today < this.viewportStart || today > windowEnd) {
      const newStart = new Date(today);
      newStart.setMonth(newStart.getMonth() - 3);
      newStart.setHours(0, 0, 0, 0);
      this.applyViewportJump(newStart);
      return;
    }
    if (!this.scrollContainer) return;
    const todayCell = this.scrollContainer.querySelector(".timeline-header-cell.is-today");
    if (todayCell instanceof HTMLElement) {
      const scrollPos = todayCell.offsetLeft - this.scrollContainer.clientWidth / 2 + todayCell.clientWidth / 2;
      this.scrollContainer.scrollTo({ left: Math.max(0, scrollPos), behavior: "smooth" });
    }
  }
  scroll(direction) {
    if (!this.scrollContainer) return;
    const amount = this.scrollContainer.clientWidth * 0.8;
    this.scrollContainer.scrollBy({
      left: direction === "left" ? -amount : amount,
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
      if (!this.isDragging) return;
      e.preventDefault();
      const x = e.pageX - container.offsetLeft;
      container.scrollLeft = this.scrollLeftPos - (x - this.startX) * 1.5;
    });
  }
  showTooltip(e, task, isRecurring) {
    if (!this.tooltipEl) {
      this.tooltipEl = document.body.createDiv("dashboard-tooltip");
    }
    this.tooltipEl.empty();
    this.tooltipEl.createDiv("tooltip-title").setText(task.title);
    this.tooltipEl.createDiv("tooltip-meta").setText(`\u{1F4C2} ${task.fileName}`);
    if (task.dueDate) {
      this.tooltipEl.createDiv("tooltip-date").setText(`\u{1F4C5} ${TaskManager.formatDisplayDate(task.dueDate)}`);
    }
    if (isRecurring) {
      this.tooltipEl.createDiv("tooltip-recurrence").setText("\u{1F501} recurring");
    }
    if (task.notes) {
      this.tooltipEl.createDiv("tooltip-notes").setText(task.notes);
    }
    this.tooltipEl.setCssProps({ display: "block" });
    this.moveTooltip(e);
  }
  moveTooltip(e) {
    if (this.tooltipEl) {
      let left = e.clientX + 15;
      let top = e.clientY + 15;
      const width = this.tooltipEl.offsetWidth || 0;
      const height = this.tooltipEl.offsetHeight || 0;
      const maxLeft = window.innerWidth - width - 15;
      const maxTop = window.innerHeight - height - 15;
      if (left > maxLeft) left = Math.max(0, e.clientX - width - 15);
      if (top > maxTop) top = Math.max(0, e.clientY - height - 15);
      this.tooltipEl.setCssProps({
        top: `${String(top)}px`,
        left: `${String(left)}px`
      });
    }
  }
  hideTooltip() {
    var _a;
    (_a = this.tooltipEl) == null ? void 0 : _a.setCssProps({ display: "none" });
  }
  /** Removes DOM nodes owned by this component that live outside its container. */
  destroy() {
    var _a;
    (_a = this.tooltipEl) == null ? void 0 : _a.remove();
    this.tooltipEl = null;
    if (this.ribbonOutsideHandler) {
      document.removeEventListener("mousedown", this.ribbonOutsideHandler);
      this.ribbonOutsideHandler = null;
    }
  }
};
// The viewport always renders exactly MAX_DAYS columns — the DOM size stays constant
_TimelineComponent.MAX_DAYS = 365;
// Jump buttons shift the viewport by this many months
_TimelineComponent.JUMP_MONTHS = 6;
var TimelineComponent = _TimelineComponent;

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
    if (this.sidebarHandleEl) this.sidebarHandleEl.remove();
    this.sidebarHandleEl = this.container.createDiv("dashboard-sidebar-handle is-hidden");
    (0, import_obsidian7.setIcon)(this.sidebarHandleEl, "panel-left-open");
    this.sidebarHandleEl.setAttribute("aria-label", "Show header");
    this.sidebarHandleEl.addEventListener("click", () => {
      this.isCollapsed = false;
      this.updateVisibility();
      this.onStateChange();
    });
  }
  renderHeader() {
    if (this.headerEl) this.headerEl.remove();
    this.headerEl = this.container.createDiv("dashboard-header");
    const leftGroup = this.headerEl.createDiv("header-actions-left");
    if (this.onSettings) {
      const settingsBtn = leftGroup.createEl("button", { cls: "header-icon-btn" });
      (0, import_obsidian7.setIcon)(settingsBtn, "settings");
      settingsBtn.setAttribute("aria-label", "Settings");
      settingsBtn.addEventListener("click", () => {
        var _a;
        (_a = this.onSettings) == null ? void 0 : _a.call(this);
      });
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
      if (this.highlightAddButton) addBtn.addClass(CLASS_FEATURE_HIGHLIGHT);
      (0, import_obsidian7.setIcon)(addBtn, "plus");
      addBtn.setAttribute("aria-label", "Quick add task");
      addBtn.addEventListener("click", () => {
        var _a;
        if (this.highlightAddButton) {
          this.highlightAddButton = false;
          addBtn.removeClass(CLASS_FEATURE_HIGHLIGHT);
          if (this.onHighlightDismiss) this.onHighlightDismiss();
        }
        (_a = this.onAdd) == null ? void 0 : _a.call(this);
      });
    }
    const refreshBtn = rightGroup.createEl("button", { cls: "dashboard-refresh-btn header-icon-btn" });
    (0, import_obsidian7.setIcon)(refreshBtn, "refresh-cw");
    refreshBtn.setAttribute("aria-label", "Refresh data");
    refreshBtn.addEventListener("click", () => {
      refreshBtn.addClass("is-rotating");
      this.onRefresh();
      setTimeout(() => {
        refreshBtn.removeClass("is-rotating");
      }, 1e3);
    });
    const hideBtn = rightGroup.createEl("button", { cls: "header-icon-btn" });
    (0, import_obsidian7.setIcon)(hideBtn, "panel-top-close");
    hideBtn.setAttribute("aria-label", "Hide header");
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
      if (this.isSaving) return;
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
    input.addEventListener("keypress", (e) => {
      e.stopPropagation();
    });
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
    /** Raw text entered by the user for the task title. */
    this.title = "";
    /** ISO date string (YYYY-MM-DD) from the date picker, or empty string. */
    this.date = "";
    this.recurrence = "";
    /**
     * Path of the chosen destination file, or the sentinel value
     * `'__CURSOR__'` when the user wants to insert at the cursor position.
     */
    this.selectedFile = "";
    let view = this.app.workspace.getActiveViewOfType(import_obsidian8.MarkdownView);
    if (!view) {
      const markdownLeaves = this.app.workspace.getLeavesOfType("markdown");
      const visibleMarkdownLeaf = markdownLeaves.find(
        (leaf) => leaf.view instanceof import_obsidian8.MarkdownView && leaf.view.containerEl.isShown()
      );
      if (visibleMarkdownLeaf) {
        view = visibleMarkdownLeaf.view;
      } else if (markdownLeaves.length > 0 && markdownLeaves[0].view instanceof import_obsidian8.MarkdownView) {
        view = markdownLeaves[0].view;
      }
    }
    this.activeViewAtOpen = view;
  }
  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------
  /** Builds and renders the modal UI when it is opened. */
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "Quick add task" });
    new import_obsidian8.Setting(contentEl).setName("Task").addText((text) => {
      text.setPlaceholder("Read chapter 4...").onChange((value) => {
        this.title = value;
      });
      text.inputEl.focus();
    });
    new import_obsidian8.Setting(contentEl).setName("Destination").addDropdown((drop) => {
      drop.addOption("__CURSOR__", "Insert at cursor (active file)");
      const scannedFiles = this.taskManager.getScannedFiles();
      scannedFiles.forEach((path) => {
        var _a;
        const label = ((_a = path.split("/").pop()) == null ? void 0 : _a.replace(".md", "")) || path;
        drop.addOption(path, label);
      });
      if (this.activeViewAtOpen) {
        this.selectedFile = "__CURSOR__";
      } else if (scannedFiles.length > 0) {
        this.selectedFile = scannedFiles[0];
      }
      drop.setValue(this.selectedFile);
      drop.onChange((value) => {
        this.selectedFile = value;
      });
    });
    new import_obsidian8.Setting(contentEl).setName("Due date").addText((text) => {
      text.inputEl.type = "date";
      text.onChange((value) => {
        this.date = value;
      });
    });
    new import_obsidian8.Setting(contentEl).setName("Repeat").setDesc("Example: daily, weekly, every two days").addText((text) => {
      text.setPlaceholder("Optional...");
      text.onChange((value) => {
        this.recurrence = value;
      });
    });
    new import_obsidian8.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Add task").setCta().onClick(async () => {
        if (!this.title || !this.selectedFile) return;
        if (this.selectedFile === "__CURSOR__") {
          if (this.activeViewAtOpen) {
            const dateStr = this.date ? ` [due:: ${this.date}]` : "";
            const repeatStr = this.recurrence ? ` [repeat:: ${this.recurrence}]` : "";
            const taskLine = `- [ ] ${this.title}${dateStr}${repeatStr}
`;
            this.activeViewAtOpen.editor.replaceSelection(taskLine);
            if (this.activeViewAtOpen.file) {
              await this.taskManager.refreshFileTask(this.activeViewAtOpen.file.path);
            }
          } else {
            const fallbackFile = this.taskManager.getScannedFiles()[0];
            if (fallbackFile) {
              const dateObj = this.date ? new Date(this.date) : null;
              await this.taskManager.addTask(this.title, dateObj, fallbackFile);
            }
          }
        } else {
          const dateObj = this.date ? new Date(this.date) : null;
          await this.taskManager.addTask(this.title, dateObj, this.selectedFile, this.recurrence);
        }
        this.close();
      })
    );
  }
  /** Cleans up the modal's DOM when it is closed. */
  onClose() {
    this.contentEl.empty();
  }
};

// src/views/DashboardView.ts
function setupViewDOM(containerEl, isLocked) {
  const leafRootRaw = containerEl.closest(".workspace-leaf-content");
  const tabContainerRaw = containerEl.closest(".workspace-tabs");
  const leafRootEl = leafRootRaw instanceof HTMLElement ? leafRootRaw : null;
  const tabContainer = tabContainerRaw instanceof HTMLElement ? tabContainerRaw : null;
  if (leafRootEl) leafRootEl.classList.add(CLASS_CHROMELESS);
  if (tabContainer && isLocked) tabContainer.classList.add(CLASS_HIDE_TABS);
  return { leafRootEl, tabContainer };
}
function cleanUpViewDOM(leafRootEl, tabContainer) {
  if (tabContainer instanceof HTMLElement) tabContainer.classList.remove(CLASS_HIDE_TABS);
  if (leafRootEl instanceof HTMLElement) leafRootEl.classList.remove(CLASS_CHROMELESS);
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
    // Section visibility toggles — persisted via getState/setState
    this.showControls = true;
    this.showTimeline = true;
    this.showList = true;
    this.showStats = true;
    // Per-view stats display preference — persisted via getState/setState
    // Removed from global Settings so each dashboard widget can have its own value.
    this.statsCompletionFormat = "all";
    this.timelineDaysToShow = 10;
    this.renderTimer = null;
    // Tracks scroll position so re-renders don't jump the timeline,
    // unless a forced scroll-to-today is requested
    this.lastTimelineScroll = null;
    this.lastViewportStart = null;
    this.forceScrollToToday = false;
    this.onTasksUpdated = () => {
      if (this.renderTimer) clearTimeout(this.renderTimer);
      this.renderTimer = setTimeout(() => {
        if (this.timelineComponent && !this.forceScrollToToday) {
          this.lastTimelineScroll = this.timelineComponent.getScrollPosition();
          this.lastViewportStart = this.timelineComponent.getViewportStart();
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
    };
    this.taskManager = this.plugin.taskManager;
    this.taskManager.on("tasks-updated", this.onTasksUpdated);
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file.path.endsWith(".md") && !this.taskManager.getIsInternalChange()) {
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
    return "Tasklens dashboard";
  }
  getIcon() {
    return "layout-dashboard";
  }
  async setState(state, result) {
    await super.setState(state, result);
    if (!state || typeof state !== "object") {
      this.render();
      return;
    }
    let s = state;
    if (s.state && typeof s.state === "object") {
      s = s.state;
    }
    if (Object.keys(s).length > 0) {
      if (Object.prototype.hasOwnProperty.call(s, "showControls")) this.showControls = s.showControls;
      if (Object.prototype.hasOwnProperty.call(s, "showTimeline")) this.showTimeline = s.showTimeline;
      if (Object.prototype.hasOwnProperty.call(s, "showList")) this.showList = s.showList;
      if (Object.prototype.hasOwnProperty.call(s, "showStats")) this.showStats = s.showStats;
      if (Object.prototype.hasOwnProperty.call(s, "zoomLevel")) this.timelineDaysToShow = s.zoomLevel;
      if (Object.prototype.hasOwnProperty.call(s, "statsCompletionFormat")) this.statsCompletionFormat = s.statsCompletionFormat;
      if (s.statusFilter) this.taskManager.setStatusFilter(s.statusFilter);
      if (s.courseFilter) this.taskManager.setCourseFilter(s.courseFilter);
      if (s.headerState) this.headerState = s.headerState;
    }
    this.render();
    setTimeout(() => {
      if (this.timelineComponent) this.timelineComponent.scrollToToday();
    }, 500);
  }
  getState() {
    const filters = this.taskManager.getCurrentFilters();
    return Object.assign(super.getState(), {
      showControls: this.showControls,
      showTimeline: this.showTimeline,
      showList: this.showList,
      showStats: this.showStats,
      zoomLevel: this.timelineDaysToShow,
      statsCompletionFormat: this.statsCompletionFormat,
      statusFilter: filters.status,
      courseFilter: filters.course,
      headerState: this.headerComponent ? this.headerComponent.getState() : this.headerState
    });
  }
  onOpen() {
    const { leafRootEl, tabContainer } = setupViewDOM(this.containerEl, this.plugin.isLayoutLocked);
    this.leafRootEl = leafRootEl;
    this.tabContainer = tabContainer;
    this.contentEl.empty();
    this.contentEl.addClass(CLASS_DASHBOARD_VIEW);
    this.applyColorTheme();
    void this.taskManager.loadTasks().then(() => {
      this.render();
      this.forceScrollToToday = true;
      setTimeout(() => {
        if (this.timelineComponent) {
          this.timelineComponent.scrollToToday();
        }
      }, 500);
    });
    return Promise.resolve();
  }
  onClose() {
    var _a;
    this.taskManager.off("tasks-updated", this.onTasksUpdated);
    (_a = this.timelineComponent) == null ? void 0 : _a.destroy();
    cleanUpViewDOM(this.leafRootEl, this.tabContainer);
    return Promise.resolve();
  }
  render() {
    var _a;
    if (this.timelineComponent && !this.forceScrollToToday) {
      this.lastViewportStart = this.timelineComponent.getViewportStart();
      this.lastTimelineScroll = this.timelineComponent.getScrollPosition();
    }
    (_a = this.timelineComponent) == null ? void 0 : _a.destroy();
    this.contentEl.empty();
    this.headerComponent = new HeaderComponent(
      this.contentEl,
      this.headerState,
      "Tasklens dashboard",
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
        onRefresh: () => {
          this.forceScrollToToday = true;
          void this.taskManager.loadTasks();
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
          void this.plugin.saveSettings().then(() => {
            this.plugin.refreshViews();
          });
        }
      }
    );
    this.headerComponent.render();
    this.renderControls();
    ["stats", "timeline", "list"].forEach((component) => {
      if (component === "stats" && this.showStats) this.renderStatistics();
      if (component === "timeline" && this.showTimeline) this.renderTimeline();
      if (component === "list" && this.showList) this.renderTaskList();
    });
  }
  renderControls() {
    if (!this.showControls) return;
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
      if (opt.value === this.taskManager.getCurrentFilters().status) option.selected = true;
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
      if (course === this.taskManager.getCurrentFilters().course) option.selected = true;
    });
    courseSelect.addEventListener("change", () => {
      this.taskManager.setCourseFilter(courseSelect.value || null);
    });
    const completionGroup = filtersDiv.createDiv("control-group");
    completionGroup.createEl("label", { text: "Completed:" });
    const completionSelect = completionGroup.createEl("select");
    [
      { value: "all", text: "All-time" },
      { value: "today", text: "Today" }
    ].forEach((opt) => {
      const option = completionSelect.createEl("option", { value: opt.value, text: opt.text });
      if (opt.value === this.statsCompletionFormat) option.selected = true;
    });
    completionSelect.addEventListener("change", () => {
      this.statsCompletionFormat = completionSelect.value;
      this.app.workspace.requestSaveLayout();
      this.render();
    });
    const actionsDiv = controls.createDiv("actions-wrapper");
    actionsDiv.setCssProps({ display: "flex", gap: "12px", "align-items": "center" });
    const toggles = [
      { label: "Timeline", getter: () => this.showTimeline, setter: (v) => {
        this.showTimeline = v;
      } },
      { label: "List", getter: () => this.showList, setter: (v) => {
        this.showList = v;
      } },
      { label: "Stats", getter: () => this.showStats, setter: (v) => {
        this.showStats = v;
      } }
    ];
    toggles.forEach(({ label, getter, setter }) => {
      const isActive = getter();
      const btn = actionsDiv.createEl("button", {
        cls: `view-toggle-btn ${isActive ? "is-active" : ""}`,
        text: label
      });
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
      btn.addEventListener("click", () => {
        setter(!getter());
        this.app.workspace.requestSaveLayout();
        this.render();
      });
    });
  }
  renderStatistics() {
    const stats = this.taskManager.getStatistics();
    const container = this.contentEl.createDiv("dashboard-stats");
    const showToday = this.statsCompletionFormat === "today";
    const completionValue = showToday ? stats.completedToday : stats.completed;
    const completionLabel = showToday ? "Done Today" : "Completed";
    const statCards = [
      { label: "Total", value: stats.total, cls: "stat-total", filter: "all" /* All */ },
      { label: "Upcoming", value: stats.upcoming, cls: "stat-upcoming", filter: "upcoming_week" /* UpcomingWeek */ },
      { label: "Urgent", value: stats.urgent, cls: "stat-urgent", filter: "urgent" /* Urgent */ },
      { label: "Overdue", value: stats.overdue, cls: "stat-overdue", filter: "overdue" /* Overdue */ },
      { label: completionLabel, value: completionValue, cls: "stat-completed", filter: "completed" /* Completed */ }
    ];
    statCards.forEach((stat) => {
      const card = container.createDiv({ cls: ["stat-card", stat.cls, "is-clickable"] });
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
      onToggle: (t) => {
        void this.taskManager.toggleTaskCompletion(t);
      },
      onEdit: (t, newTitle, newDate) => {
        void this.taskManager.updateTask(t, newTitle, newDate);
      },
      onDelete: (t) => {
        void this.taskManager.deleteTask(t);
      }
    }, this.plugin.settings);
    list.render(this.taskManager.getGroupedFilteredTasks());
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
    var _a;
    const container = this.contentEl.createDiv("dashboard-timeline-view");
    const controls = container.createDiv("timeline-controls");
    const zoomControls = controls.createDiv("zoom-controls");
    zoomControls.createSpan({ text: "Zoom: " });
    const zoomOut = zoomControls.createEl("button", { text: "-", cls: "view-toggle-btn" });
    zoomOut.setAttribute("aria-label", "Zoom out timeline");
    zoomOut.addEventListener("click", () => {
      this.timelineDaysToShow = Math.min(30, this.timelineDaysToShow + 1);
      this.render();
    });
    zoomControls.createSpan({ text: ` ${String(this.timelineDaysToShow)} days ` });
    const zoomIn = zoomControls.createEl("button", { text: "+", cls: "view-toggle-btn" });
    zoomIn.setAttribute("aria-label", "Zoom in timeline");
    zoomIn.addEventListener("click", () => {
      this.timelineDaysToShow = Math.max(3, this.timelineDaysToShow - 1);
      this.render();
    });
    const navControls = controls.createDiv("nav-controls");
    const scrollLeft = navControls.createEl("button", { cls: "view-toggle-btn" });
    scrollLeft.setAttribute("aria-label", "Scroll left");
    (0, import_obsidian9.setIcon)(scrollLeft, "chevron-left");
    const scrollRight = navControls.createEl("button", { cls: "view-toggle-btn" });
    scrollRight.setAttribute("aria-label", "Scroll right");
    (0, import_obsidian9.setIcon)(scrollRight, "chevron-right");
    this.timelineComponent = new TimelineComponent(
      container,
      this.app,
      this.taskManager.getGroupedFilteredTasks(),
      this.timelineDaysToShow,
      this.plugin.settings,
      (_a = this.lastViewportStart) != null ? _a : void 0,
      (newStart) => {
        this.lastViewportStart = newStart;
      }
    );
    this.timelineComponent.render();
    scrollLeft.addEventListener("click", () => {
      var _a2;
      (_a2 = this.timelineComponent) == null ? void 0 : _a2.scroll("left");
    });
    scrollRight.addEventListener("click", () => {
      var _a2;
      (_a2 = this.timelineComponent) == null ? void 0 : _a2.scroll("right");
    });
  }
};

// src/views/TimelineView.ts
var import_obsidian10 = require("obsidian");
var TimelineView = class extends import_obsidian10.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.leafRootEl = null;
    this.tabContainer = null;
    this.timelineComponent = null;
    this.headerComponent = null;
    this.headerState = { title: null, isCollapsed: false };
    this.timelineDaysToShow = 10;
    this.viewportStart = null;
    this.savedScrollLeft = 0;
    this.hasOpenedOnce = false;
    // Named event handler to prevent listener stacking
    this.onTasksUpdated = () => {
      this.render();
    };
    this.plugin.taskManager.on("tasks-updated", this.onTasksUpdated);
  }
  getViewType() {
    return VIEW_TYPE_TIMELINE;
  }
  getDisplayText() {
    return "Timeline view";
  }
  getIcon() {
    return "clock";
  }
  async setState(state, result) {
    await super.setState(state, result);
    if (state && typeof state === "object") {
      const s = state;
      if (Object.prototype.hasOwnProperty.call(s, "headerState")) this.headerState = s.headerState;
      if (Object.prototype.hasOwnProperty.call(s, "zoomLevel")) this.timelineDaysToShow = s.zoomLevel;
      if (Object.prototype.hasOwnProperty.call(s, "viewportStart")) {
        const raw = s.viewportStart;
        if (typeof raw === "string") {
          const parsed = new Date(raw);
          if (!isNaN(parsed.getTime())) this.viewportStart = parsed;
        }
      }
    }
    this.render();
    const rendered = this.timelineComponent;
    if (!rendered) return;
    if (this.hasOpenedOnce) {
      setTimeout(() => {
        rendered.setScrollPosition(this.savedScrollLeft);
      }, 50);
    } else {
      setTimeout(() => {
        rendered.scrollToToday();
      }, 300);
    }
  }
  getState() {
    var _a, _b, _c;
    const liveViewportStart = (_b = (_a = this.timelineComponent) == null ? void 0 : _a.getViewportStart()) != null ? _b : this.viewportStart;
    return Object.assign(super.getState(), {
      headerState: this.headerComponent ? this.headerComponent.getState() : this.headerState,
      zoomLevel: this.timelineDaysToShow,
      viewportStart: (_c = liveViewportStart == null ? void 0 : liveViewportStart.toISOString()) != null ? _c : null
    });
  }
  onOpen() {
    const { leafRootEl, tabContainer } = setupViewDOM(this.containerEl, this.plugin.isLayoutLocked);
    this.leafRootEl = leafRootEl;
    this.tabContainer = tabContainer;
    this.contentEl.empty();
    this.contentEl.addClass(CLASS_DASHBOARD_VIEW);
    void this.plugin.taskManager.loadTasks().then(() => {
      this.render();
      const rendered = this.timelineComponent;
      if (!rendered) return;
      if (!this.hasOpenedOnce) {
        this.hasOpenedOnce = true;
        setTimeout(() => {
          rendered.scrollToToday();
        }, 500);
      } else {
        setTimeout(() => {
          rendered.setScrollPosition(this.savedScrollLeft);
        }, 50);
      }
    });
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file.path.endsWith(".md") && !this.plugin.taskManager.getIsInternalChange()) {
          void this.plugin.taskManager.refreshFileTask(file.path);
        }
      })
    );
    return Promise.resolve();
  }
  onClose() {
    var _a;
    this.plugin.taskManager.off("tasks-updated", this.onTasksUpdated);
    (_a = this.timelineComponent) == null ? void 0 : _a.destroy();
    this.performCleanup();
    return Promise.resolve();
  }
  performCleanup() {
    cleanUpViewDOM(this.leafRootEl, this.tabContainer);
  }
  render() {
    var _a, _b, _c, _d;
    this.savedScrollLeft = (_b = (_a = this.timelineComponent) == null ? void 0 : _a.getScrollPosition()) != null ? _b : this.savedScrollLeft;
    (_c = this.timelineComponent) == null ? void 0 : _c.destroy();
    this.contentEl.empty();
    this.headerComponent = new HeaderComponent(
      this.contentEl,
      this.headerState,
      "Timeline",
      {
        onStateChange: () => {
          if (this.headerComponent) this.headerState = this.headerComponent.getState();
          this.app.workspace.requestSaveLayout();
          this.render();
        },
        onRefresh: () => {
          void this.plugin.taskManager.loadTasks();
        }
      }
    );
    this.headerComponent.render();
    const container = this.contentEl.createDiv("dashboard-timeline-view");
    this.timelineComponent = new TimelineComponent(
      container,
      this.app,
      this.plugin.taskManager.getAllGroupedTasks(),
      this.timelineDaysToShow,
      this.plugin.settings,
      (_d = this.viewportStart) != null ? _d : void 0,
      // When the user jumps the viewport, persist it immediately so layout saves reflect it
      (newStart) => {
        this.viewportStart = newStart;
        this.app.workspace.requestSaveLayout();
      }
    );
    this.timelineComponent.render();
    const rendered = this.timelineComponent;
    if (this.savedScrollLeft > 0) {
      setTimeout(() => {
        rendered.setScrollPosition(this.savedScrollLeft);
      }, 50);
    }
  }
  refreshFromSettings() {
    this.render();
  }
};

// src/views/TaskListView.ts
var import_obsidian11 = require("obsidian");
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
      if (!this.isOpen || !this.contentEl.isConnected) return;
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
    if (state && typeof state === "object") {
      const s = state;
      if (Object.prototype.hasOwnProperty.call(s, "headerState")) {
        this.headerState = s.headerState;
      }
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
    const { leafRootEl, tabContainer } = setupViewDOM(this.containerEl, true);
    this.leafRootEl = leafRootEl;
    this.tabContainer = tabContainer;
    this.contentEl.empty();
    this.contentEl.addClass(CLASS_DASHBOARD_VIEW);
    this.contentEl.addClass("is-single-view");
    this.isOpen = true;
    this.render();
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file.path.endsWith(".md") && !this.plugin.taskManager.getIsInternalChange()) {
          void this.plugin.taskManager.refreshFileTask(file.path);
        }
      })
    );
    return Promise.resolve();
  }
  onClose() {
    this.isOpen = false;
    this.plugin.taskManager.off("tasks-updated", this.onTasksUpdated);
    cleanUpViewDOM(this.leafRootEl, this.tabContainer);
    return Promise.resolve();
  }
  render() {
    if (!this.isOpen || !this.contentEl.isConnected) return;
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
        onRefresh: () => {
          void this.plugin.taskManager.loadTasks();
        },
        onAdd: () => {
          const modal = new QuickAddModal(this.app, this.plugin.taskManager);
          modal.open();
        }
      },
      {
        highlightAddButton: !this.plugin.settings.hasSeenWelcome,
        onHighlightDismiss: () => {
          this.plugin.settings.hasSeenWelcome = true;
          void this.plugin.saveSettings().then(() => {
            this.plugin.refreshViews();
          });
        }
      }
    );
    this.headerComponent.render();
    const list = new TaskListComponent(this.contentEl, this.app, {
      onToggle: (t) => {
        void this.plugin.taskManager.toggleTaskCompletion(t);
      },
      onEdit: (t, newTitle, newDate) => {
        void this.plugin.taskManager.updateTask(t, newTitle, newDate);
      },
      onDelete: (t) => {
        void this.plugin.taskManager.deleteTask(t);
      }
    }, this.plugin.settings);
    list.render(this.plugin.taskManager.getGroupedFilteredTasks());
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
    const containerDiv = this.container.createDiv("dashboard-stats");
    const statCards = [
      { label: "Total", value: stats.total, cls: "stat-total" },
      { label: "Active", value: stats.upcoming, cls: "stat-active" },
      { label: "Urgent", value: stats.urgent, cls: "stat-urgent" },
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
var StatsView = class extends import_obsidian12.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.leafRootEl = null;
    this.tabContainer = null;
    this.headerComponent = null;
    this.headerState = { title: null, isCollapsed: false };
    this.onTasksUpdated = () => {
      this.render();
    };
    this.plugin.taskManager.on("tasks-updated", this.onTasksUpdated);
  }
  getViewType() {
    return VIEW_TYPE_STATS;
  }
  getDisplayText() {
    return "Dashboard stats";
  }
  getIcon() {
    return "bar-chart-3";
  }
  async setState(state, result) {
    if (state && typeof state === "object") {
      const s = state;
      if (Object.prototype.hasOwnProperty.call(s, "headerState")) {
        this.headerState = s.headerState;
      }
    }
    await super.setState(state, result);
    this.render();
  }
  getState() {
    if (this.headerComponent) {
      this.headerState = this.headerComponent.getState();
    }
    return Object.assign(super.getState(), { headerState: this.headerState });
  }
  onOpen() {
    const { leafRootEl, tabContainer } = setupViewDOM(this.containerEl, true);
    this.leafRootEl = leafRootEl;
    this.tabContainer = tabContainer;
    this.contentEl.empty();
    this.contentEl.addClass(CLASS_DASHBOARD_VIEW);
    this.render();
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file.path.endsWith(".md") && !this.plugin.taskManager.getIsInternalChange()) {
          void this.plugin.taskManager.refreshFileTask(file.path);
        }
      })
    );
    return Promise.resolve();
  }
  onClose() {
    this.plugin.taskManager.off("tasks-updated", this.onTasksUpdated);
    const root = this.leafRootEl instanceof HTMLElement ? this.leafRootEl : null;
    const tabs = this.tabContainer instanceof HTMLElement ? this.tabContainer : null;
    cleanUpViewDOM(root, tabs);
    return Promise.resolve();
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
        onRefresh: () => {
          void this.plugin.taskManager.loadTasks();
        }
      }
    );
    this.headerComponent.render();
    const stats = new StatsComponent(this.contentEl);
    stats.render(this.plugin.taskManager);
  }
};

// src/main.ts
var TaskLensPlugin = class extends import_obsidian13.Plugin {
  constructor() {
    super(...arguments);
    this.isLayoutLocked = true;
    this.isFocusMode = false;
  }
  async onload() {
    await this.loadSettings();
    if (this.settings.savedFocusLayout) {
      this.isFocusMode = true;
    }
    const parser = new TaskParser(this.app, this.settings);
    this.taskManager = new TaskManager(parser, this.app);
    this.registerEvent(
      this.app.vault.on("modify", async (file) => {
        if (!(file instanceof import_obsidian13.TFile)) return;
        const isInternal = this.taskManager.getIsInternalChange();
        if (!this.settings.appWideAutomation || !file.path.endsWith(".md") || isInternal) {
          return;
        }
        await this.taskManager.processManualUpdate(file);
      })
    );
    this.registerView(VIEW_TYPE_DASHBOARD, (leaf) => new DashboardView(leaf, this));
    this.registerView(VIEW_TYPE_TIMELINE, (leaf) => new TimelineView(leaf, this));
    this.registerView(VIEW_TYPE_LIST, (leaf) => new TaskListView(leaf, this));
    this.registerView(VIEW_TYPE_STATS, (leaf) => new StatsView(leaf, this));
    (0, import_obsidian13.addIcon)(ICON_NAME, ICON_SVG);
    this.setupRibbonIcon();
    this.setupCommands();
    if (!this.settings.hasSeenWelcome) {
      setTimeout(() => {
        new WelcomeModal(this.app, this).open();
      }, 1e3);
    }
    this.addSettingTab(new SettingsTab(this.app, this));
    this.app.workspace.onLayoutReady(() => {
      void this.taskManager.loadTasks();
    });
  }
  setupRibbonIcon() {
    const ribbonIconEl = this.addRibbonIcon(ICON_NAME, "Tasklens", async (evt) => {
      ribbonIconEl.removeClass(CLASS_FEATURE_HIGHLIGHT);
      if (!this.settings.hasClickedRibbonIcon) {
        this.settings.hasClickedRibbonIcon = true;
        await this.saveSettings();
      }
      const menu = new import_obsidian13.Menu();
      menu.addItem(
        (item) => item.setTitle("Add widget").setIcon("layout-dashboard").onClick(() => {
          void this.activateView(VIEW_TYPE_DASHBOARD);
        })
      );
      menu.addItem(
        (item) => item.setTitle("Quick add task").setIcon("plus-circle").onClick(() => {
          new QuickAddModal(this.app, this.taskManager).open();
        })
      );
      menu.addSeparator();
      menu.addItem(
        (item) => item.setTitle(this.isLayoutLocked ? "Unlock layout" : "Lock layout").setIcon(this.isLayoutLocked ? "unlock" : "lock").onClick(() => {
          this.toggleLayoutMode();
        })
      );
      menu.addItem(
        (item) => item.setTitle(this.isFocusMode ? "Exit focus mode" : "Enter focus mode").setIcon(this.isFocusMode ? "eye" : "eye-off").onClick(() => {
          void this.toggleFocusMode();
        })
      );
      menu.showAtMouseEvent(evt);
    });
    if (!this.settings.hasSeenWelcome || !this.settings.hasClickedRibbonIcon) {
      ribbonIconEl.addClass(CLASS_FEATURE_HIGHLIGHT);
    }
  }
  setupCommands() {
    const viewCommands = [
      { id: "open-dashboard", name: "Open dashboard (all-in-one)", type: VIEW_TYPE_DASHBOARD },
      { id: "open-timeline", name: "Open timeline view", type: VIEW_TYPE_TIMELINE },
      { id: "open-task-list", name: "Open task list", type: VIEW_TYPE_LIST },
      { id: "open-stats", name: "Open statistics", type: VIEW_TYPE_STATS }
    ];
    viewCommands.forEach(({ id, name, type }) => {
      this.addCommand({ id, name, callback: () => {
        void this.activateView(type);
      } });
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
      callback: () => {
        this.refreshViews();
      }
    });
  }
  toggleLayoutMode() {
    this.isLayoutLocked = !this.isLayoutLocked;
    ALL_VIEW_TYPES.forEach((type) => {
      this.app.workspace.getLeavesOfType(type).forEach((leaf) => {
        const tabContainer = leaf.view.containerEl.closest(".workspace-tabs");
        if (tabContainer) {
          tabContainer.classList.toggle(CLASS_HIDE_TABS, this.isLayoutLocked);
        }
      });
    });
    new import_obsidian13.Notice(this.isLayoutLocked ? "Dashboard layout: locked \u{1F512}" : "Dashboard layout: unlocked \u{1F513}");
  }
  async toggleFocusMode() {
    const workspace = this.app.workspace;
    if (!this.isFocusMode) {
      this.settings.savedFocusLayout = this.app.workspace.getLayout();
      this.isFocusMode = true;
      await this.saveSettings();
      if (typeof workspace.leftSplit.collapse === "function") workspace.leftSplit.collapse();
      if (typeof workspace.rightSplit.collapse === "function") workspace.rightSplit.collapse();
      let closedCount = 0;
      ALL_VIEW_TYPES.forEach((type) => {
        const leaves = this.app.workspace.getLeavesOfType(type);
        closedCount += leaves.length;
        if (leaves.length > 0) this.app.workspace.detachLeavesOfType(type);
      });
      if (closedCount > 0) {
        new import_obsidian13.Notice("Focus mode enabled");
      } else {
        this.isFocusMode = false;
        this.settings.savedFocusLayout = null;
        await this.saveSettings();
        new import_obsidian13.Notice("No task lenses were open");
      }
    } else {
      this.isFocusMode = false;
      if (this.settings.savedFocusLayout) {
        await workspace.setLayout(this.settings.savedFocusLayout);
        this.settings.savedFocusLayout = null;
        await this.saveSettings();
        new import_obsidian13.Notice("Focus mode disabled");
      }
    }
  }
  async activateView(viewType) {
    let leaf = this.app.workspace.getLeaf(false);
    if (leaf.view.getViewType() !== "empty") {
      leaf = this.app.workspace.getLeaf("split");
    }
    await leaf.setViewState({ type: viewType, active: true });
    await this.app.workspace.revealLeaf(leaf);
    if (this.isLayoutLocked) {
      this.toggleLayoutMode();
      new import_obsidian13.Notice("Layout auto-unlocked for placement \u{1F513}");
    } else {
      const tabContainer = leaf.view.containerEl.closest(".workspace-tabs");
      if (tabContainer instanceof HTMLElement) {
        tabContainer.classList.remove(CLASS_HIDE_TABS);
      }
    }
  }
  async loadSettings() {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data || {});
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  refreshViews() {
    ALL_VIEW_TYPES.forEach((type) => {
      this.app.workspace.getLeavesOfType(type).forEach((leaf) => {
        const view = leaf.view;
        if (typeof view.refreshFromSettings === "function") {
          view.refreshFromSettings();
        } else if (typeof view.render === "function") {
          if (typeof view.applyColorTheme === "function") view.applyColorTheme();
          view.render();
        }
      });
    });
  }
};
