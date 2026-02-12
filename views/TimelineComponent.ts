import { Task, getTaskStatus, TaskStatus } from '../models/Task';

export class TimelineComponent {
    private container: HTMLElement;
    private tasks: Task[];
    private daysToShow: number;

    // Drag state
    private isDragging = false;
    private startX = 0;
    private scrollLeft = 0;

    // The actual horizontally scrollable element (created in render)
    private scrollContainer: HTMLElement | null = null;
    private todayColumnIndex: number = -1;

    constructor(container: HTMLElement, tasks: Task[], daysToShow: number = 7) {
        this.container = container;
        this.tasks = tasks.filter(t => t.dueDate);
        this.daysToShow = daysToShow;
    }

    public render(): void {
        this.container.empty();

        // Wrapper for positioning navigation overlays
        this.container.addClass('timeline-wrapper');
        this.todayColumnIndex = -1;

        const validTasks = this.tasks.filter(t => t.dueDate instanceof Date && !isNaN(t.dueDate.getTime()));

        if (validTasks.length === 0) {
            const scrollContainer = this.container.createDiv('timeline-container');
            const empty = scrollContainer.createDiv('dashboard-empty-state');
            empty.createEl('p', { text: 'No dated tasks to display.' });
            return;
        }

        // 1) Create navigation overlays ("scroll zones")
        this.createNavigationOverlay('left');
        this.createNavigationOverlay('right');

        // 2) Create the scrollable container
        this.scrollContainer = this.container.createDiv('timeline-container');
        this.setupEventListeners(this.scrollContainer);

        // 3) Determine Date Range
        const dates = validTasks
            .map(t => [t.startDate, t.dueDate])
            .flat()
            .filter((d): d is Date => !!d)
            .sort((a, b) => a.getTime() - b.getTime());

        if (dates.length === 0) return;

        // Add broad buffer for scrolling context
        const minDate = new Date(dates[0]);
        minDate.setDate(minDate.getDate() - 14);

        const maxDate = new Date(dates[dates.length - 1]);
        maxDate.setDate(maxDate.getDate() + 14);

        // Generate days
        const allDays: Date[] = [];
        const current = new Date(minDate);
        while (current <= maxDate) {
            allDays.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }

        // 4) Build Grid (append to scrollContainer, not wrapper)
        const grid = this.scrollContainer.createDiv('timeline-grid');
        const colWidthPercent = 100 / this.daysToShow;
        grid.style.gridTemplateColumns = `repeat(${allDays.length}, ${colWidthPercent}%)`;
        // NEW: Background Grid using CSS Gradient (vertical divider at end of each column)
        const borderColor = 'rgba(200, 200, 200, 0.15)';
        grid.style.backgroundImage = `linear-gradient(to right, transparent 0%, transparent calc(100% - 1px), ${borderColor} 100%)`;
        grid.style.backgroundSize = `${colWidthPercent}% 100%`;

        // 5) Render Header & Tasks
        const todayStr = new Date().toDateString();
        let todayColumn = -1;

        allDays.forEach((day, index) => {
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;

            const cell = grid.createDiv('timeline-header-cell');
            if (isWeekend) cell.addClass('weekend');

            const dayName = day.toLocaleDateString(undefined, { weekday: 'short' });
            const dayNum = day.getDate();
            const month = day.toLocaleDateString(undefined, { month: 'short' });

            const label = dayNum === 1 || index === 0 ? `${month} ${dayNum}` : `${dayName} ${dayNum}`;
            cell.setText(label);
            cell.style.gridColumn = `${index + 1}`;
            cell.style.gridRow = '1';

            if (day.toDateString() === todayStr) {
                const marker = grid.createDiv('timeline-today-marker');
                marker.style.gridColumn = `${index + 1}`;
                todayColumn = index;
                this.todayColumnIndex = index;
            }
        });

        validTasks.forEach((task, index) => {
            const taskStart = task.startDate ? task.startDate : task.dueDate!;
            const taskEnd = task.dueDate!;

            // Calculate offsets
            const startIndex = this.getDayDiff(minDate, taskStart) + 1;
            const endIndex = this.getDayDiff(minDate, taskEnd) + 1;
            const visualStart = Math.min(startIndex, endIndex);
            const visualEnd = Math.max(startIndex, endIndex);

            const bar = grid.createDiv('timeline-task-bar');
            bar.setText(task.title);

            const status = getTaskStatus(task);
            if (status === TaskStatus.Overdue) bar.addClass('status-overdue');
            else if (status === TaskStatus.Urgent) bar.addClass('status-urgent');
            else if (status === TaskStatus.Completed) bar.addClass('status-completed');
            else bar.addClass('status-active'); // Default Green/Active

            bar.style.gridColumn = `${visualStart} / ${visualEnd + 1}`;
            bar.style.gridRow = `${index + 2}`;

            const dateStr = task.dueDate ? task.dueDate.toLocaleDateString() : 'No date';
            bar.setAttribute('title', `${task.title}\n${task.fileName}\nDue: ${dateStr}`);
        });

        // 6) Center on Today initially
        this.scrollToToday();
    }

    public scrollToToday(): void {
        if (this.todayColumnIndex !== -1 && this.scrollContainer) {
            setTimeout(() => {
                if (!this.scrollContainer) return;
                const containerWidth = this.scrollContainer.clientWidth;
                const columnWidth = containerWidth / this.daysToShow;
                const scrollPos = (this.todayColumnIndex * columnWidth) - (containerWidth / 2) + (columnWidth / 2);
                this.scrollContainer.scrollTo({ left: scrollPos, behavior: 'smooth' });
            }, 100);
        }
    }

    private createNavigationOverlay(direction: 'left' | 'right'): void {
        const overlay = this.container.createDiv(`timeline-nav-overlay nav-${direction}`);
        const arrow = overlay.createDiv('nav-arrow');

        // Simple chevron text (CSS can style it nicely)
        arrow.setText(direction === 'left' ? '‹' : '›');

        // Scroll on click
        overlay.addEventListener('click', (e) => {
            e.stopPropagation(); // prevent drag interference
            const scroller = this.scrollContainer ?? (this.container.querySelector('.timeline-container') as HTMLElement | null);
            if (!scroller) return;

            const amount = scroller.clientWidth / 2;
            scroller.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
        });
    }

    private setupEventListeners(target: HTMLElement): void {
        target.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            target.addClass('is-dragging');
            this.startX = e.pageX - target.offsetLeft;
            this.scrollLeft = target.scrollLeft;
        });

        target.addEventListener('mouseleave', () => {
            this.isDragging = false;
            target.removeClass('is-dragging');
        });

        target.addEventListener('mouseup', () => {
            this.isDragging = false;
            target.removeClass('is-dragging');
        });

        target.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            e.preventDefault();
            const x = e.pageX - target.offsetLeft;
            const walk = (x - this.startX) * 1.5; // Scroll speed multiplier
            target.scrollLeft = this.scrollLeft - walk;
        });
    }

    public scroll(direction: 'left' | 'right'): void {
        const scroller = this.scrollContainer ?? this.container;
        const scrollAmount = scroller.clientWidth / 2; // Scroll half screen
        const newPos = direction === 'left'
            ? scroller.scrollLeft - scrollAmount
            : scroller.scrollLeft + scrollAmount;

        scroller.scrollTo({ left: newPos, behavior: 'smooth' });
    }

    private getDayDiff(start: Date, end: Date): number {
        const oneDay = 1000 * 60 * 60 * 24;
        const diff = end.getTime() - start.getTime();
        return Math.floor(diff / oneDay);
    }
}
