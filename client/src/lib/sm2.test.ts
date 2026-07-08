import { describe, it, expect } from 'vitest';
import { sm2, createNewCardState, calculateIntervals, Rating } from './sm2';
import type { SM2CardInput } from './sm2';

describe('SM-2 Algorithm', () => {
  // ── createNewCardState ─────────────────────────────────────

  describe('createNewCardState', () => {
    it('should return initial card state with correct defaults', () => {
      const card = createNewCardState();
      expect(card.easeFactor).toBe(2.5);
      expect(card.interval).toBe(0);
      expect(card.repetitions).toBe(0);
      expect(card.lapses).toBe(0);
      expect(card.dueDate).toBeInstanceOf(Date);
    });
  });

  // ── Again rating ──────────────────────────────────────────

  describe('sm2 - Again rating', () => {
    it('should reset repetitions to 0 and set interval to 1 day', () => {
      const card = createNewCardState();
      const result = sm2(card, Rating.Again);
      expect(result.repetitions).toBe(0);
      expect(result.interval).toBe(1);
    });

    it('should increase lapses count', () => {
      const card: SM2CardInput = { easeFactor: 2.5, interval: 10, repetitions: 5, lapses: 0 };
      const result = sm2(card, Rating.Again);
      expect(result.lapses).toBe(1);
    });

    it('should accumulate lapses across multiple Again ratings', () => {
      const card: SM2CardInput = { easeFactor: 2.5, interval: 10, repetitions: 3, lapses: 2 };
      const result = sm2(card, Rating.Again);
      expect(result.lapses).toBe(3);
    });

    it('should not decrease easeFactor below 1.3', () => {
      const card: SM2CardInput = { easeFactor: 1.3, interval: 10, repetitions: 5, lapses: 0 };
      const result = sm2(card, Rating.Again);
      expect(result.easeFactor).toBeGreaterThanOrEqual(1.3);
    });

    it('should decrease easeFactor but clamp at 1.3 for very low EF', () => {
      const card: SM2CardInput = { easeFactor: 1.31, interval: 10, repetitions: 5, lapses: 0 };
      const result = sm2(card, Rating.Again);
      expect(result.easeFactor).toBeGreaterThanOrEqual(1.3);
    });
  });

  // ── Good rating ───────────────────────────────────────────

  describe('sm2 - Good rating', () => {
    it('should increment repetitions for new card', () => {
      const card = createNewCardState();
      const result = sm2(card, Rating.Good);
      expect(result.repetitions).toBe(1);
    });

    it('should set interval to 1 for first correct answer (reps=0)', () => {
      const card = createNewCardState();
      const result = sm2(card, Rating.Good);
      expect(result.interval).toBe(1);
    });

    it('should set interval to 6 for second correct answer (reps=1)', () => {
      const card: SM2CardInput = { ...createNewCardState(), repetitions: 1 };
      const result = sm2(card, Rating.Good);
      expect(result.interval).toBe(6);
      expect(result.repetitions).toBe(2);
    });

    it('should multiply interval by easeFactor for subsequent answers (reps>=2)', () => {
      const card: SM2CardInput = { easeFactor: 2.5, interval: 6, repetitions: 2, lapses: 0 };
      const result = sm2(card, Rating.Good);
      expect(result.interval).toBe(15); // 6 * 2.5
      expect(result.repetitions).toBe(3);
    });

    it('should keep easeFactor stable for Good rating', () => {
      const card: SM2CardInput = { easeFactor: 2.5, interval: 6, repetitions: 2, lapses: 0 };
      const result = sm2(card, Rating.Good);
      // Good → quality=4, EF change = 0.1 - (5-4)*(0.08+(5-4)*0.02) = 0.1 - 1*0.1 = 0
      expect(result.easeFactor).toBeCloseTo(2.5, 5);
    });
  });

  // ── Hard rating ───────────────────────────────────────────

  describe('sm2 - Hard rating', () => {
    it('should reduce interval by 40% for reps>=2', () => {
      const card: SM2CardInput = { easeFactor: 2.5, interval: 10, repetitions: 3, lapses: 0 };
      const result = sm2(card, Rating.Hard);
      // base interval = round(10 * newEF), then * 0.6
      // Hard → quality=3, EF change = 0.1 - (5-3)*(0.08+(5-3)*0.02) = 0.1 - 2*0.12 = -0.14
      // newEF = 2.5 - 0.14 = 2.36
      // base interval = round(10 * 2.36) = 24
      // Hard penalty: round(24 * 0.6) = 14
      expect(result.interval).toBe(14);
    });

    it('should set interval to 1 for first answer (reps=0) with Hard', () => {
      const card = createNewCardState();
      const result = sm2(card, Rating.Hard);
      // reps=0 → interval=1, then Hard: max(1, round(1*0.6)) = max(1,1) = 1
      expect(result.interval).toBe(1);
      expect(result.repetitions).toBe(1);
    });

    it('should set interval to 6 then apply 0.6 for second answer (reps=1)', () => {
      const card: SM2CardInput = { easeFactor: 2.5, interval: 1, repetitions: 1, lapses: 0 };
      const result = sm2(card, Rating.Hard);
      // reps=1 → interval=6, then Hard: max(1, round(6*0.6)) = max(1,4) = 4
      expect(result.interval).toBe(4);
    });

    it('should not let interval go below 1', () => {
      const card: SM2CardInput = { easeFactor: 2.5, interval: 1, repetitions: 2, lapses: 0 };
      const result = sm2(card, Rating.Hard);
      expect(result.interval).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Easy rating ───────────────────────────────────────────

  describe('sm2 - Easy rating', () => {
    it('should increase interval with Easy bonus (1.3x) for reps>=2', () => {
      const card: SM2CardInput = { easeFactor: 2.5, interval: 10, repetitions: 3, lapses: 0 };
      const result = sm2(card, Rating.Easy);
      // Easy → quality=5, EF change = 0.1 - (5-5)*(0.08+0*0.02) = 0.1
      // newEF = 2.6
      // base interval = round(10 * 2.6) = 26
      // Easy bonus: round(26 * 1.3) = 34
      expect(result.interval).toBe(34);
    });

    it('should set interval to 1 for first answer (reps=0) then apply Easy bonus', () => {
      const card = createNewCardState();
      const result = sm2(card, Rating.Easy);
      // reps=0 → interval=1, Easy: round(1*1.3) = 1
      expect(result.interval).toBe(1);
      expect(result.repetitions).toBe(1);
    });

    it('should increase easeFactor for Easy rating', () => {
      const card: SM2CardInput = { easeFactor: 2.5, interval: 6, repetitions: 2, lapses: 0 };
      const result = sm2(card, Rating.Easy);
      expect(result.easeFactor).toBeGreaterThan(2.5);
    });
  });

  // ── Interval cap ──────────────────────────────────────────

  describe('sm2 - interval cap', () => {
    it('should not exceed 1825 days (5 years)', () => {
      const card: SM2CardInput = { easeFactor: 3.0, interval: 1000, repetitions: 10, lapses: 0 };
      const result = sm2(card, Rating.Easy);
      expect(result.interval).toBeLessThanOrEqual(1825);
    });

    it('should cap at 1825 even with extreme values', () => {
      const card: SM2CardInput = { easeFactor: 3.0, interval: 1800, repetitions: 10, lapses: 0 };
      const result = sm2(card, Rating.Easy);
      expect(result.interval).toBe(1825);
    });
  });

  // ── dueDate ───────────────────────────────────────────────

  describe('sm2 - dueDate', () => {
    it('should set dueDate to current date + interval days', () => {
      const before = new Date();
      const card = createNewCardState();
      const result = sm2(card, Rating.Good);
      const after = new Date();

      // interval = 1, so dueDate should be ~tomorrow
      const expectedMin = new Date(before);
      expectedMin.setDate(expectedMin.getDate() + 1);
      const expectedMax = new Date(after);
      expectedMax.setDate(expectedMax.getDate() + 1);

      expect(result.dueDate.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime());
      expect(result.dueDate.getTime()).toBeLessThanOrEqual(expectedMax.getTime());
    });
  });

  // ── calculateIntervals ────────────────────────────────────

  describe('calculateIntervals', () => {
    it('should return intervals for all four ratings', () => {
      const card: SM2CardInput = { easeFactor: 2.5, interval: 6, repetitions: 2, lapses: 0 };
      const intervals = calculateIntervals(card);
      expect(intervals).toHaveProperty('again');
      expect(intervals).toHaveProperty('hard');
      expect(intervals).toHaveProperty('good');
      expect(intervals).toHaveProperty('easy');
    });

    it('should have again=1 for any card state', () => {
      const card: SM2CardInput = { easeFactor: 2.5, interval: 6, repetitions: 2, lapses: 0 };
      const intervals = calculateIntervals(card);
      expect(intervals.again).toBe(1);
    });

    it('should have good=15 for reps=2, interval=6, EF=2.5', () => {
      const card: SM2CardInput = { easeFactor: 2.5, interval: 6, repetitions: 2, lapses: 0 };
      const intervals = calculateIntervals(card);
      expect(intervals.good).toBe(15); // 6 * 2.5
    });

    it('should order intervals: again <= hard <= good <= easy', () => {
      const card: SM2CardInput = { easeFactor: 2.5, interval: 10, repetitions: 3, lapses: 0 };
      const intervals = calculateIntervals(card);
      expect(intervals.again).toBeLessThanOrEqual(intervals.hard);
      expect(intervals.hard).toBeLessThanOrEqual(intervals.good);
      expect(intervals.good).toBeLessThanOrEqual(intervals.easy);
    });
  });
});
