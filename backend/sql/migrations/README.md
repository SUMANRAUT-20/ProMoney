# Database Migrations (`backend/sql/migrations/`)

**Joint Owners:** Arpan Khatiwada & Suman Raut (Coordinated with Roshan Khanal for Phase 3 Bills)

## Rules for Database Changes
1. **Preserve `backend/sql/schema.sql`**: The core 6 tables (`users`, `accounts`, `categories`, `transactions`, `budgets`, `goals`) are defined in `backend/sql/schema.sql`.
2. **Use Numbered SQL Migrations for New Tables**:
   - `001_create_bills_table.sql` (Planned for Phase 3 — Bills & Subscriptions, coordinated between Roshan, Arpan, and Suman).
   - `002_create_promoney_lab_tables.sql` (Planned for Phases 5–6 — ProMoney Lab analysis history & action approval logs).
3. **Review Requirement**: Every migration file must be reviewed and approved by both **Arpan Khatiwada** and **Suman Raut** before merging.
