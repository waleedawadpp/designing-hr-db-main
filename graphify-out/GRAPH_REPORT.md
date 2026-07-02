# Knowledge Graph Report — designing-hr-db-main

**Generated:** 2026-06-12  
**Source:** `./` (entire repository)  
**Graph:** 71 nodes · 115 edges · 7 node types

---

## Core Nodes (Highest Connectivity)

| Node | Type | Edges | Why It Matters |
|------|------|-------|----------------|
| **RAF Marketplace** (D2) | Domain | 35 | Hub of the repo — owns 11 modules, implements 8 concepts, uses 7 technologies |
| **Bilingual AR/EN** (C2) | Concept | 5 | Only concept shared across all 3 active domains (Drinks, RAF, ERP) |
| **Python 3.11** (T7) | Technology | 3 | Shared runtime between RAF (FastAPI) and ERP (Flask) |
| **SQLAlchemy 2.0** (T8) | Technology | 4 | ORM used in RAF backend; also planned for ERP — cross-domain reuse |
| **Geographic Hierarchy** (C10) | Concept | 4 | Independently implemented in HR DB (4 tables) and RAF Geography module — unintentional convergence |
| **Employee Lifecycle** (C11) | Concept | 4 | Bridges HR Database → ERP HR & Payroll module; the most explicit cross-domain dependency |
| **Order Lifecycle** (C12) | Concept | 3 | Defines the 7-stage RAF commerce flow: cart→order→payment→shipment→delivery→return→refund |
| **EmployeeStatus** (H10) | Table | 3 | Classic junction table with metadata — named example of the Junction Table pattern |
| **CartContext** (DS1) | Component | 3 | State backbone of the Drinks Store; implements both Context API pattern and Cart Persistence |
| **Identity & Auth (RM1)** | Module | 4 | Owns app_user; implements RBAC + 2FA; most security-dense module in RAF |

---

## Surprises

### 1. Geographic Hierarchy appears in two independent schemas
The HR Database (10-table legacy project) has a 4-level Location→State→City→Address chain. RAF Marketplace independently designed Country→Region→City→Address. **Same depth, same semantics, zero shared code.** A candidate for schema extraction if RAF HR module ever absorbs HR DB data.

### 2. The Drinks Store has no backend — but could be swapped for RAF
The Drinks Store sends orders directly to WhatsApp. RAF Marketplace is a full vendor platform. The `PRODUCTS Data` component (static JSON) and `CartContext` map cleanly onto RAF's `Catalog` + `Cart & Engagement` modules. The gap is a ~5-table bridge: add `vendor` + `customer_order` + `payment` and the Drinks Store becomes a lite RAF node.

### 3. ERP Flask System structurally duplicates HR Database
`ERP HR & Payroll` (E1) has an explicit `evolved-from` edge to HR Database (D3). The ERP plan reuses the same employee/department/salary concepts without referencing the existing SQL DDL. The HR Database DDL files (`DDL_commands.sql`, `DML_commands.sql`) could bootstrap the ERP HR module's Alembic migration.

### 4. RAF has an AI layer but Drinks Store does not use it at all
RAF Marketplace has 5 AI tables (ai_job, ai_recommendation, ai_chat_session, ai_chat_message, ai_forecast), a separate `AI Layer` module, and a dedicated AI router. The Drinks Store — which sells physical beverages — has zero AI. If RAF's recommendation engine were exposed as an API, the Drinks Store's category filter could be replaced with personalized AI recommendations using the same backend.

### 5. WhatsApp Checkout is architecturally unique
`buildWhatsAppUrl()` is the only "payment gateway" in the Drinks Store. There is no payment table, no order record, no webhook. The entire checkout is a stateless URL open. This makes the app zero-infrastructure but means no order history, no analytics, and no cancellation flow — all of which RAF Marketplace implements exhaustively.

### 6. RAF has 71 pytest tests but ERP Flask System has zero
The ERP plan document describes 6 complex modules but contains no test plan. RAF's test suite (auth, orders, payments, AI, shipping, returns) is a model the ERP should copy, especially for the double-entry bookkeeping invariants in the Accounting/GL module.

---

## Suggested Questions for the Graph

**Architecture & Design**
1. Which concepts are implemented by more than one domain, and could they be extracted into a shared library?
2. What would it take to migrate the Drinks Store's static `PRODUCTS` data to the RAF Catalog module?
3. The HR Database has no `Department` FK relationship — which table should reference it?

**Data Modeling**
4. Why does `EmployeeStatus` carry `salary_id` as a FK to a lookup table instead of storing the amount directly? What normalization tradeoff does that represent?
5. RAF uses `NUMERIC(14,3)` for all money fields (OMR has 3 decimal places). If RAF expanded to USD markets, what schema migration would be needed?
6. The HR `Geographic Hierarchy` and RAF `Geography` module both have 4 levels but different root names (Location vs Country). Could they share a single migration?

**Security & Patterns**
7. The `activity_log` table in RAF (C4 — Audit Trail) logs IP + user agent. Does this create GDPR/privacy obligations for the Oman market?
8. `Soft Deletes` (C3) means `deleted_at IS NOT NULL` rows accumulate forever. Is there a retention/purge strategy in the RAF schema?
9. 2FA is implemented in RAF's `security.py` (pyotp). Which user roles are required to enable it, and which can opt out?

**Roadmap & Evolution**
10. The ERP Flask System is the only domain with `status: planned`. What are the minimum tables from RAF Marketplace (e.g., `vendor_wallet`, `payment`) that would need to be reused or reimplemented in the ERP?
11. Both RAF and the ERP plan use SQLAlchemy 2.0. Could they share a `models/` package, or would circular FK references prevent this?
12. If `AI Layer` grew to serve all domains, what would a unified `ai_recommendation` table look like that spans Drinks products, RAF catalog items, and ERP inventory?

---

## Node Type Summary

| Type | Count | Examples |
|------|-------|---------|
| Domain | 4 | Drinks Store App, RAF Marketplace, HR Database, ERP Flask System |
| Technology | 12 | PostgreSQL 16, FastAPI, Expo SDK 52, SQLAlchemy 2.0 |
| Table | 18 | Employee, customer_order, app_user, EmployeeStatus |
| Module | 16 | Identity & Auth, Catalog, Orders, HR & Payroll |
| Concept | 12 | RBAC, Bilingual AR/EN, Order Lifecycle, Geographic Hierarchy |
| Component | 5 | CartContext, WhatsApp Flow, RTL Layout, PRODUCTS Data |
| Pattern | 4 | Junction Table, Service Layer, App Factory, Context API |

---

## Edge Type Summary

| Type | Count | Meaning |
|------|-------|---------|
| contains | 31 | Domain→Module/Component/Table ownership |
| uses | 20 | Technology usage by domains/tech stack |
| implements | 21 | Concept or pattern implementation |
| belongs-to | 8 | RAF table → RAF module |
| FK→ | 13 | Database foreign key references |
| extends/evolved-from | 5 | Lineage and inheritance relationships |
| owns | 5 | RAF module owns a key table |
| other | 12 | tracks, recommends, for-user, manifests-in |
