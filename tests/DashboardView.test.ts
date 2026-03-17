// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { setupViewDOM, cleanUpViewDOM } from '../src/views/DashboardView';
import { CLASS_CHROMELESS, CLASS_HIDE_TABS } from '../src/constants';

describe('DashboardView DOM Helpers', () => {
    let containerEl: HTMLElement;
    let leafRootEl: HTMLElement;
    let tabContainer: HTMLElement;

    beforeEach(() => {
        // Mock DOM structure mirroring Obsidian's workspace hierarchy:
        // .workspace-tabs > .workspace-leaf-content > #container
        tabContainer = document.createElement('div');
        tabContainer.className = 'workspace-tabs';

        leafRootEl = document.createElement('div');
        leafRootEl.className = 'workspace-leaf-content';
        tabContainer.appendChild(leafRootEl);

        containerEl = document.createElement('div');
        containerEl.id = 'container';
        leafRootEl.appendChild(containerEl);
    });

    describe('setupViewDOM', () => {
        it('adds both classes when isLocked is true and full hierarchy is present', () => {
            const result = setupViewDOM(containerEl, true);

            expect(result.leafRootEl).toBe(leafRootEl);
            expect(result.tabContainer).toBe(tabContainer);
            expect(leafRootEl.classList.contains(CLASS_CHROMELESS)).toBe(true);
            expect(tabContainer.classList.contains(CLASS_HIDE_TABS)).toBe(true);
        });

        it('adds only the chromeless class when isLocked is false', () => {
            const result = setupViewDOM(containerEl, false);

            expect(result.leafRootEl).toBe(leafRootEl);
            expect(result.tabContainer).toBe(tabContainer);
            expect(leafRootEl.classList.contains(CLASS_CHROMELESS)).toBe(true);
            expect(tabContainer.classList.contains(CLASS_HIDE_TABS)).toBe(false);
        });

        it('returns nulls and does not throw when containerEl has no matching ancestors', () => {
            const isolatedEl = document.createElement('div');
            const result = setupViewDOM(isolatedEl, true);

            expect(result.leafRootEl).toBeNull();
            expect(result.tabContainer).toBeNull();
        });

        it('returns leafRootEl but null tabContainer when only workspace-leaf-content is present', () => {
            const loneLeafRoot = document.createElement('div');
            loneLeafRoot.className = 'workspace-leaf-content';
            const isolatedContainer = document.createElement('div');
            loneLeafRoot.appendChild(isolatedContainer);

            const result = setupViewDOM(isolatedContainer, true);

            expect(result.leafRootEl).toBe(loneLeafRoot);
            expect(result.tabContainer).toBeNull();
            expect(loneLeafRoot.classList.contains(CLASS_CHROMELESS)).toBe(true);
        });
    });

    describe('cleanUpViewDOM', () => {
        it('removes both classes from provided elements', () => {
            leafRootEl.classList.add(CLASS_CHROMELESS);
            tabContainer.classList.add(CLASS_HIDE_TABS);

            cleanUpViewDOM(leafRootEl, tabContainer);

            expect(leafRootEl.classList.contains(CLASS_CHROMELESS)).toBe(false);
            expect(tabContainer.classList.contains(CLASS_HIDE_TABS)).toBe(false);
        });

        it('does not throw when both arguments are null', () => {
            expect(() => cleanUpViewDOM(null, null)).not.toThrow();
        });

        it('does not throw when elements do not have the classes', () => {
            expect(() => cleanUpViewDOM(leafRootEl, tabContainer)).not.toThrow();

            expect(leafRootEl.classList.contains(CLASS_CHROMELESS)).toBe(false);
            expect(tabContainer.classList.contains(CLASS_HIDE_TABS)).toBe(false);
        });
    });
});