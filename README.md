# ResumeVault — Resume Storing Database System

A full stack DBMS capstone built with React, CSS, Node.js/Express and PostgreSQL. ResumeVault stores candidate profiles in a normalized relational model and makes the database concepts visible in the product.

## What is included

- **Talent workspace:** dashboard, searchable candidate directory, status filters, candidate detail cards, add-resume form and CSV export.
- **Relational database:** nine PostgreSQL tables, primary and foreign keys, unique/check constraints, cascading deletes, a many-to-many bridge, and practical secondary/composite indexes.
- **DBMS showcase:** schema explorer, ER relationship map, normalization notes, SQL query lab, reporting views, a stored search function and audit triggers.
- **API:** parameterized resume search and transactional resume intake. Adding a resume writes the candidate, resume, skill dictionary and junction rows in one transaction.
- **Demo mode:** the React interface loads sample profiles if the API or database is offline, so you can explore before configuring PostgreSQL.

## Requirements

- Node.js 18 or newer and npm
- PostgreSQL 14 or newer and pgAdmin 4

## Set up PostgreSQL in pgAdmin 4

1. Open pgAdmin 4 and connect to your local PostgreSQL server. Use the password you created when installing PostgreSQL.
2. Right-click **Databases** and choose **Create → Database**. Name it `resume_vault`, then save.
3. Select the new `resume_vault` database, open **Tools → Query Tool**, open `database/schema.sql`, and execute it. The script creates the tables, indexes, views, trigger function, triggers and sample rows.
4. Copy `.env.example` to `.env` and enter the same PostgreSQL password. For a typical local install, leave host `localhost`, port `5432`, user `postgres` and database `resume_vault` as they are.

## Run the website

Open PowerShell in the project folder and install packages:

```powershell
npm.cmd install
Copy-Item .env.example .env
```

Open two PowerShell windows in the same project folder. Start the API in the first:

```powershell
npm.cmd run server
```

Start the React app in the second:

```powershell
npm.cmd run dev
```

Visit the Vite URL printed in the second window, usually `http://localhost:5173`. The API health check is at `http://localhost:4000/api/health`. To create a production frontend bundle, run `npm.cmd run build`.

## Database design notes

`candidates` stores each person's identity once. Each submitted version lives in `resumes`, so one candidate may have multiple resumes over time. Skills are stored once in `skills` and assigned through `resume_skills`, which models the many-to-many relationship. Work history and education are separate child tables. Jobs and applications extend the model into a hiring workflow.

The schema is in third normal form: non-key attributes describe their table's key, and repeated skill labels are not copied into each resume. `v_resume_directory` composes a useful read model from joins. `v_skill_demand` supports aggregated reporting. `sp_search_resumes` demonstrates a stored search function. Resume triggers append insert/update events to `audit_logs`.

## Main files

- `src/App.jsx` — React views and interactions
- `src/styles.css` — responsive interface styling
- `server/index.js` — REST API and transactional intake
- `server/db.js` — PostgreSQL connection pool
- `database/schema.sql` — complete PostgreSQL schema and demo seed
