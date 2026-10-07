import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanupLimit,cleanupRangeError} from '../src/cleanup.mjs';
test('Protected year rolls over at midnight Pakistan time',()=>{
 assert.equal(cleanupLimit(new Date('2026-12-31T18:59:59Z')),'2025-12-31');
 assert.equal(cleanupLimit(new Date('2026-12-31T19:00:00Z')),'2026-12-31');
});
test('Date range is inclusive and rejects current/future years, reversed and invalid dates',()=>{
 assert.equal(cleanupRangeError('2025-12-31','2025-12-31','2025-12-31'),'');
 for(const [from,to] of [['2026-01-01','2026-01-01'],['2025-01-01','2027-01-01'],['2025-06-02','2025-06-01'],['2025-02-30','2025-03-01'],['','2025-01-01']])assert.ok(cleanupRangeError(from,to,'2025-12-31'));
});
