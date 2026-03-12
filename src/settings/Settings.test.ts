import { getTopicColor, SemesterSettings } from './Settings';

describe('getTopicColor', () => {
    let settings: SemesterSettings;

    beforeEach(() => {
        // Create a mocked minimal SemesterSettings object instead of relying on DEFAULT_SETTINGS
        settings = {
            topicColors: {}
        } as SemesterSettings;
    });

    it('should return the custom color if the topic exists in settings.topicColors', () => {
        const testTopic = 'Math';
        const expectedColor = '#ff0000';
        settings.topicColors[testTopic] = expectedColor;

        const result = getTopicColor(testTopic, settings);

        expect(result).toBe(expectedColor);
    });

    it('should return a color from the default palette deterministically based on the topic name', () => {
        const testTopic1 = 'Physics';
        const testTopic2 = 'Physics';
        const testTopic3 = 'History';

        const result1 = getTopicColor(testTopic1, settings);
        const result2 = getTopicColor(testTopic2, settings);
        const result3 = getTopicColor(testTopic3, settings);

        // Deterministic check: same topic returns same color
        expect(result1).toBe(result2);

        // Expect it to be one of the default palette colors
        const defaultPalette = ['#4cc9f0', '#f72585', '#7209b7', '#3a0ca3', '#4361ee', '#4caf50'];
        expect(defaultPalette).toContain(result1);
        expect(defaultPalette).toContain(result3);
    });

    it('should handle empty string correctly', () => {
        const testTopic = '';
        const result = getTopicColor(testTopic, settings);

        const defaultPalette = ['#4cc9f0', '#f72585', '#7209b7', '#3a0ca3', '#4361ee', '#4caf50'];
        expect(defaultPalette).toContain(result);

        // Hash for empty string should be 0, Math.abs(0) % 6 === 0 -> first element
        expect(result).toBe(defaultPalette[0]);
    });

    it('should handle whitespace strings correctly', () => {
        const testTopic1 = ' ';
        const testTopic2 = '   ';

        const result1 = getTopicColor(testTopic1, settings);
        const result2 = getTopicColor(testTopic2, settings);

        const defaultPalette = ['#4cc9f0', '#f72585', '#7209b7', '#3a0ca3', '#4361ee', '#4caf50'];
        expect(defaultPalette).toContain(result1);
        expect(defaultPalette).toContain(result2);
    });

    it('should handle special characters correctly', () => {
        const testTopic = '!@#$%^&*()_+';

        const result = getTopicColor(testTopic, settings);

        const defaultPalette = ['#4cc9f0', '#f72585', '#7209b7', '#3a0ca3', '#4361ee', '#4caf50'];
        expect(defaultPalette).toContain(result);
    });
});