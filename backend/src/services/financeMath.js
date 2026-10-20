// Pure reference calculations; these functions do not access MySQL.
// API consumers MUST pre-filter rows by authenticated user; money in whole JPY.
function yen(n) { const value=Number(n); if (!Number.isSafeInteger(value) || value < 0) throw new Error('Expected nonnegative integer JPY'); return value; }
function iso(d) { if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error('Expected YYYY-MM-DD'); const x=new Date(d+'T00:00:00Z'); if(Number.isNaN(x.valueOf())||x.toISOString().slice(0,10)!==d) throw new Error('Invalid calendar date'); return d; }
export function monthBounds(month) {
  if (typeof month !== 'string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Expected YYYY-MM');
  const [year,m]=month.split('-').map(Number);
  const start=`${month}-01`;
  const next=m===12?`${year+1}-01-01`:`${year}-${String(m+1).padStart(2,'0')}-01`;
  return {start,endExclusive:next};
}
export function calculateMonthlySummary(transactions,month){
  const {start,endExclusive}=monthBounds(month);
  let income_amount=0,expense_amount=0;
  for(const tx of transactions){ const day=iso(tx.transaction_date); if(day<start||day>=endExclusive) continue;
    const value=yen(tx.amount); if(tx.kind==='income') income_amount+=value; else if(tx.kind==='expense') expense_amount+=value; else throw new Error('Invalid transaction kind'); }
  if(!Number.isSafeInteger(income_amount)||!Number.isSafeInteger(expense_amount)) throw new Error('Unsafe total');
  return {income_amount,expense_amount,net_amount:income_amount-expense_amount};
}
export function calculateBudgetProgress(budget, transactions){
  const limit=yen(budget.amount_limit); if(limit===0) throw new Error('Budget must be positive');
  const month=String(budget.budget_month).slice(0,7); const {start,endExclusive}=monthBounds(month);
  let spent_amount=0;
  for(const tx of transactions){const day=iso(tx.transaction_date);
    if (day>=start && day<endExclusive && tx.kind==='expense' && String(tx.category_id)===String(budget.category_id)) spent_amount+=yen(tx.amount);}
  if(!Number.isSafeInteger(spent_amount)) throw new Error('Unsafe total');
  const remaining_amount=limit-spent_amount;
  const progress_percent=Math.round(spent_amount/limit*100);
  return {spent_amount,remaining_amount,progress_percent,bar_percent:Math.min(progress_percent,100),over_budget:spent_amount>limit};
}
export function calculateGoalProgress(goal){
  const target=yen(goal.target_amount),saved=yen(goal.saved_amount),plan=yen(goal.monthly_plan??0);
  if(target===0) throw new Error('Goal target must be positive');
  const progress_percent=Math.round(saved/target*100);
  return {saved_amount:saved,remaining_amount:Math.max(0,target-saved),progress_percent,bar_percent:Math.min(progress_percent,100),monthly_plan:plan,completed:saved>=target};
}
