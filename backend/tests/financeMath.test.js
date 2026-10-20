import test from 'node:test';
import assert from 'node:assert/strict';
import { monthBounds, calculateMonthlySummary, calculateBudgetProgress, calculateGoalProgress } from '../src/services/financeMath.js';
const tx=[
{kind:'income',amount:300000,category_id:'1',transaction_date:'2026-10-01'},
{kind:'expense',amount:25000,category_id:'2',transaction_date:'2026-10-19'},
{kind:'expense',amount:5000,category_id:'3',transaction_date:'2026-10-20'},
{kind:'expense',amount:9999,category_id:'2',transaction_date:'2026-09-30'},
];
test('October month boundaries including December rollover',()=>{ assert.deepEqual(monthBounds('2026-10'),{start:'2026-10-01',endExclusive:'2026-11-01'}); assert.equal(monthBounds('2026-12').endExclusive,'2027-01-01'); });
test('Income, expenses, and net use selected period only',()=> assert.deepEqual(calculateMonthlySummary(tx,'2026-10'),{income_amount:300000,expense_amount:30000,net_amount:270000}));
test('Budget includes expense rows only in same category and month',()=> assert.deepEqual(calculateBudgetProgress({category_id:'2',budget_month:'2026-10-01',amount_limit:40000},tx),{spent_amount:25000,remaining_amount:15000,progress_percent:63,bar_percent:63,over_budget:false}));
test('A new food expense changes budget and summary but not other categories',()=>{const more=[...tx,{kind:'expense',amount:2000,category_id:'2',transaction_date:'2026-10-21'}]; assert.equal(calculateMonthlySummary(more,'2026-10').net_amount,268000);assert.equal(calculateBudgetProgress({category_id:'2',budget_month:'2026-10-01',amount_limit:40000},more).remaining_amount,13000);});
test('Goal contribution progress is independent of transactions',()=> assert.deepEqual(calculateGoalProgress({target_amount:100000,saved_amount:65000,monthly_plan:5000}),{saved_amount:65000,remaining_amount:35000,progress_percent:65,bar_percent:65,monthly_plan:5000,completed:false}));
test('Overspent budget remains negative and bar caps at 100',()=> { const result=calculateBudgetProgress({category_id:'2',budget_month:'2026-10-01',amount_limit:20000},tx);assert.equal(result.remaining_amount,-5000);assert.equal(result.bar_percent,100);assert.equal(result.over_budget,true); });
test('Invalid financial inputs fail instead of silently rounding',()=> {assert.throws(()=>calculateMonthlySummary([{kind:'expense',amount:9.5,transaction_date:'2026-10-01'}],'2026-10'));assert.throws(()=>monthBounds('2026-13'));});
