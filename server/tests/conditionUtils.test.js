const { robustCompare } = require('../services/flow/conditionUtils');

describe('conditionUtils robustCompare', () => {
    // exists & does not exist
    it('handles exists / does not exist', () => {
        expect(robustCompare('value', 'exists', null)).toBe(true);
        expect(robustCompare(null, 'exists', null)).toBe(false);
        expect(robustCompare(undefined, 'exists', null)).toBe(false);

        expect(robustCompare(null, 'does not exist', null)).toBe(true);
        expect(robustCompare('value', 'does not exist', null)).toBe(false);
    });

    // is empty & is not empty
    it('handles is empty / is not empty', () => {
        expect(robustCompare('', 'is empty', null)).toBe(true);
        expect(robustCompare(null, 'is empty', null)).toBe(true);
        expect(robustCompare([], 'is empty', null)).toBe(true);
        expect(robustCompare({}, 'is empty', null)).toBe(true);
        expect(robustCompare('val', 'is empty', null)).toBe(false);
        
        expect(robustCompare('val', 'is not empty', null)).toBe(true);
        expect(robustCompare('', 'is not empty', null)).toBe(false);
    });

    // equality (is, is not, is equal to, is not equal to)
    it('handles equality operators', () => {
        // is
        expect(robustCompare('hello', 'is', 'hello')).toBe(true);
        expect(robustCompare('hello', 'is', 'world')).toBe(false);
        expect(robustCompare(123, 'is', '123')).toBe(true); // string vs num
        
        // is equal to (alias for is)
        expect(robustCompare('hello', 'is equal to', 'hello')).toBe(true);

        // is not
        expect(robustCompare('hello', 'is not', 'world')).toBe(true);
        expect(robustCompare('hello', 'is not', 'hello')).toBe(false);

        // is not equal to
        expect(robustCompare('hello', 'is not equal to', 'world')).toBe(true);
    });

    // contains & does not contain
    it('handles contains / does not contain', () => {
        expect(robustCompare('hello world', 'contains', 'world')).toBe(true);
        expect(robustCompare('hello world', 'contains', 'universe')).toBe(false);
        
        expect(robustCompare('hello world', 'does not contain', 'universe')).toBe(true);
        expect(robustCompare('hello world', 'does not contain', 'world')).toBe(false);
    });

    // starts with & does not start with
    it('handles starts with / does not start with', () => {
        expect(robustCompare('hello world', 'starts with', 'hello')).toBe(true);
        expect(robustCompare('hello world', 'starts with', 'world')).toBe(false);

        expect(robustCompare('hello world', 'does not start with', 'world')).toBe(true);
        expect(robustCompare('hello world', 'does not start with', 'hello')).toBe(false);
    });

    // ends with & does not end with
    it('handles ends with / does not end with', () => {
        expect(robustCompare('hello world', 'ends with', 'world')).toBe(true);
        expect(robustCompare('hello world', 'ends with', 'hello')).toBe(false);

        expect(robustCompare('hello world', 'does not end with', 'hello')).toBe(true);
        expect(robustCompare('hello world', 'does not end with', 'world')).toBe(false);
    });

    // regex
    it('handles matches regex / does not match regex', () => {
        expect(robustCompare('hello123world', 'matches regex', '\\d+')).toBe(true);
        expect(robustCompare('helloworld', 'matches regex', '\\d+')).toBe(false);

        expect(robustCompare('helloworld', 'does not match regex', '\\d+')).toBe(true);
        expect(robustCompare('hello123world', 'does not match regex', '\\d+')).toBe(false);
    });

    // numerical / ordered comparisons
    it('handles numerical comparisons', () => {
        // >
        expect(robustCompare(10, '>', 5)).toBe(true);
        expect(robustCompare(5, '>', 10)).toBe(false);
        expect(robustCompare('10', 'greater than', '5')).toBe(true); // Should parse string numbers

        // <
        expect(robustCompare(5, '<', 10)).toBe(true);
        expect(robustCompare(10, '<', 5)).toBe(false);
        expect(robustCompare(5, 'less than', 10)).toBe(true);

        // >=
        expect(robustCompare(10, '>=', 10)).toBe(true);
        expect(robustCompare(10, '>=', 5)).toBe(true);
        expect(robustCompare(5, '>=', 10)).toBe(false);
        expect(robustCompare(10, 'greater than or equal to', 10)).toBe(true);

        // <=
        expect(robustCompare(10, '<=', 10)).toBe(true);
        expect(robustCompare(5, '<=', 10)).toBe(true);
        expect(robustCompare(10, '<=', 5)).toBe(false);
        expect(robustCompare(10, 'less than or equal to', 10)).toBe(true);
    });

    // date comparisons
    it('handles date comparisons', () => {
        const d1 = '2023-01-01T00:00:00Z';
        const d2 = '2023-12-31T00:00:00Z';
        expect(robustCompare(d2, '>', d1)).toBe(true);
        expect(robustCompare(d1, '<', d2)).toBe(true);
    });
});
