-- ResumeVault | Realistic Resume Dataset Seed (36+ Profiles, Work History, Education, Jobs & Applications)
-- Safe & idempotent: uses ON CONFLICT and NOT EXISTS guards.

ALTER TABLE candidates ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(255) DEFAULT '';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS github_url VARCHAR(255) DEFAULT '';

INSERT INTO candidates(full_name, email, phone, location, linkedin_url, github_url) VALUES
('Maya Chen','maya.chen@example.com','+1 415 555 0101','San Francisco, CA','linkedin.com/in/mayachen','github.com/mayachen'),
('Jordan Lee','jordan.lee@example.com','+1 212 555 0102','New York, NY','linkedin.com/in/jordanlee','github.com/jordanlee'),
('Aisha Patel','aisha.patel@example.com','+1 206 555 0103','Seattle, WA','linkedin.com/in/aishapatel','github.com/aishapatel'),
('Noah Williams','noah.williams@example.com','+1 512 555 0104','Austin, TX','linkedin.com/in/noahwilliams',''),
('Sofia Garcia','sofia.garcia@example.com','+1 617 555 0105','Boston, MA','linkedin.com/in/sofiagarcia',''),
('Ethan Brooks','ethan.brooks@example.com','+1 312 555 0106','Chicago, IL','linkedin.com/in/ethanbrooks','github.com/ethanbrooks'),
('Amara Okafor','amara.okafor@example.com','+1 917 555 0107','Brooklyn, NY','linkedin.com/in/amaraokafor',''),
('Theo Martin','theo.martin@example.com','+1 503 555 0108','Portland, OR','linkedin.com/in/theomartin','github.com/theomartin'),
('Rohan Sharma','rohan.sharma@example.com','+91 98100 11223','Bengaluru, IN','linkedin.com/in/rohansharma','github.com/rohansharma'),
('Elena Rostova','elena.rostova@example.com','+1 415 555 0110','San Jose, CA','linkedin.com/in/elenarostova','github.com/elenarostova'),
('Marcus Vance','marcus.vance@example.com','+1 303 555 0111','Denver, CO','linkedin.com/in/marcusvance','github.com/marcusvance'),
('Priya Nair','priya.nair@example.com','+91 98200 33445','Mumbai, IN','linkedin.com/in/priyanair','github.com/priyanair'),
('Liam O''Connor','liam.oconnor@example.com','+353 87 555 0113','Dublin, IE','linkedin.com/in/liamoconnor','github.com/liamoconnor'),
('Chloe Kim','chloe.kim@example.com','+1 408 555 0114','Palo Alto, CA','linkedin.com/in/chloekim','github.com/chloekim'),
('Arjun Mehta','arjun.mehta@example.com','+91 98111 44556','Gurugram, IN','linkedin.com/in/arjunmehta','github.com/arjunmehta'),
('Hannah Abbott','hannah.abbott@example.com','+44 7700 900116','London, UK','linkedin.com/in/hannahabbott',''),
('Lucas Meyer','lucas.meyer@example.com','+49 151 555 0117','Berlin, DE','linkedin.com/in/lucasmeyer','github.com/lucasmeyer'),
('Zara Al-Mansoor','zara.almansoor@example.com','+971 50 555 0118','Dubai, UAE','linkedin.com/in/zaraalmansoor','github.com/zaraalmansoor'),
('David Park','david.park@example.com','+1 213 555 0119','Los Angeles, CA','linkedin.com/in/davidpark','github.com/davidpark'),
('Nadia Ivanova','nadia.ivanova@example.com','+1 646 555 0120','New York, NY','linkedin.com/in/nadiaivanova','github.com/nadiaivanova'),
('Carlos Mendez','carlos.mendez@example.com','+1 305 555 0121','Miami, FL','linkedin.com/in/carlosmendez','github.com/carlosmendez'),
('Ananya Verma','ananya.verma@example.com','+91 99100 55667','Hyderabad, IN','linkedin.com/in/ananyaverma','github.com/ananyaverma'),
('Owen Hughes','owen.hughes@example.com','+1 416 555 0123','Toronto, CA','linkedin.com/in/owenhughes','github.com/owenhughes'),
('Mei Lin','mei.lin@example.com','+65 9123 4524','Singapore, SG','linkedin.com/in/meilin','github.com/meilin'),
('Samuel Boateng','samuel.boateng@example.com','+1 404 555 0125','Atlanta, GA','linkedin.com/in/samuelboateng','github.com/samuelboateng'),
('Isabella Rossi','isabella.rossi@example.com','+39 347 555 0126','Milan, IT','linkedin.com/in/isabellarossi',''),
('Kabir Malhotra','kabir.malhotra@example.com','+91 98765 66778','New Delhi, IN','linkedin.com/in/kabirmalhotra','github.com/kabirmalhotra'),
('Grace Lin','grace.lin@example.com','+1 206 555 0128','Bellevue, WA','linkedin.com/in/gracelin','github.com/gracelin'),
('Victor Hugo','victor.hugo@example.com','+33 6 55 55 0129','Paris, FR','linkedin.com/in/victorhugo','github.com/victorhugo'),
('Tanya Kapoor','tanya.kapoor@example.com','+91 97111 77889','Pune, IN','linkedin.com/in/tanyakapoor','github.com/tanyakapoor'),
('Benjamin Cole','benjamin.cole@example.com','+1 619 555 0131','San Diego, CA','linkedin.com/in/benjamincole','github.com/benjamincole'),
('Sora Takahashi','sora.takahashi@example.com','+81 90 5555 0132','Tokyo, JP','linkedin.com/in/soratakahashi','github.com/soratakahashi'),
('Fatima Zahra','fatima.zahra@example.com','+1 703 555 0133','Reston, VA','linkedin.com/in/fatimazahra','github.com/fatimazahra'),
('Daniel Wu','daniel.wu@example.com','+1 650 555 0134','Mountain View, CA','linkedin.com/in/danielwu','github.com/danielwu'),
('Olivia Bennett','olivia.bennett@example.com','+61 412 555 0135','Sydney, AU','linkedin.com/in/oliviabennett',''),
('Siddharth Rao','siddharth.rao@example.com','+91 98450 88990','Bengaluru, IN','linkedin.com/in/siddharthrao','github.com/siddharthrao')
ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone,
  location = EXCLUDED.location,
  linkedin_url = EXCLUDED.linkedin_url,
  github_url = EXCLUDED.github_url;

-- Insert resumes with realistic spread of created_at / updated_at over the last 30 days
INSERT INTO resumes(candidate_id, current_title, summary, experience_years, source, status, created_at, updated_at)
SELECT c.candidate_id, x.title, x.summary, x.years, x.source, x.status,
       CURRENT_TIMESTAMP - (x.days_ago || ' days')::interval,
       CURRENT_TIMESTAMP - (x.days_ago || ' days')::interval
FROM (VALUES
 ('maya.chen@example.com','Senior Product Designer','Product designer focused on accessible, data-informed enterprise design systems.',7.0,'Referral','Active',1),
 ('jordan.lee@example.com','Full-stack Engineer','Builds reliable SaaS products from PostgreSQL schemas to React interfaces.',5.0,'LinkedIn','In review',2),
 ('aisha.patel@example.com','Data Scientist','Turns complex behavioral datasets into predictive ML models and executive decisions.',4.0,'Careers page','Active',2),
 ('noah.williams@example.com','Product Manager','Connects customer insight, B2B product strategy, and cross-functional delivery.',8.0,'Referral','Active',3),
 ('sofia.garcia@example.com','UX Researcher','Mixed-methods researcher making enterprise user workflows measurable.',3.0,'Direct upload','In review',4),
 ('ethan.brooks@example.com','Frontend Engineer','Creates fast, WCAG-compliant React & TypeScript interfaces.',6.0,'LinkedIn','Archived',5),
 ('amara.okafor@example.com','Product Designer','Designs intuitive developer tools and multi-tenant B2B dashboards.',4.5,'Portfolio','Active',5),
 ('theo.martin@example.com','Backend Engineer','Distributed systems engineer specializing in Go, PostgreSQL, and AWS.',9.0,'Referral','Active',6),
 ('rohan.sharma@example.com','Senior Backend Engineer','Architected high-throughput payment microservices handling 15k RPS with PostgreSQL & Kafka.',6.5,'LinkedIn','Active',7),
 ('elena.rostova@example.com','Staff ML Engineer','Specializes in LLM fine-tuning, RAG pipelines, and pgvector semantic search.',7.5,'Referral','Active',8),
 ('marcus.vance@example.com','Cloud & DevOps Architect','Kubernetes, Terraform, and multi-region AWS infrastructure automation.',10.0,'LinkedIn','Active',9),
 ('priya.nair@example.com','Data Engineer','Built petabyte-scale Spark & Snowflake ETL pipelines with dbt and Airflow.',5.5,'Careers page','In review',10),
 ('liam.oconnor@example.com','Site Reliability Engineer','Observability, Prometheus/Grafana, incident response, and 99.99% SLA ownership.',6.0,'Direct upload','Active',11),
 ('chloe.kim@example.com','iOS Mobile Engineer','SwiftUI, CoreData, and offline-first mobile architecture for fintech apps.',4.5,'Portfolio','In review',12),
 ('arjun.mehta@example.com','Full-Stack Developer','React, Next.js, Node.js, and PostgreSQL engineer passionate about clean APIs.',3.5,'Campus / Referral','Active',13),
 ('hannah.abbott@example.com','Technical Product Manager','Leads platform API & developer experience roadmaps across 4 engineering squads.',6.0,'LinkedIn','Active',14),
 ('lucas.meyer@example.com','Systems Engineer','Rust, C++, and high-performance PostgreSQL storage internals contributor.',8.5,'GitHub','Active',15),
 ('zara.almansoor@example.com','Cybersecurity Engineer','Application security, zero-trust IAM, SOC2 compliance, and penetration testing.',5.0,'Referral','In review',16),
 ('david.park@example.com','Senior Frontend Engineer','Design-minded engineer building micro-frontends and real-time collaborative canvas UIs.',7.0,'LinkedIn','Active',17),
 ('nadia.ivanova@example.com','Analytics Engineer','SQL modeling, dbt, Looker, and revenue attribution pipelines.',4.0,'Careers page','Active',18),
 ('carlos.mendez@example.com','QA Automation Lead','Playwright, Cypress, API contract testing, and CI/CD quality gates.',5.5,'Direct upload','Archived',19),
 ('ananya.verma@example.com','AI Research Engineer','Computer vision, PyTorch optimization, and ONNX edge inference.',3.0,'Careers page','Active',20),
 ('owen.hughes@example.com','Platform Engineer','Internal developer portals, Backstage, Docker, and GitHub Actions.',6.5,'LinkedIn','In review',21),
 ('mei.lin@example.com','Database Administrator','PostgreSQL performance tuning, logical replication, partitioning, and HA failover.',9.5,'Referral','Active',22),
 ('samuel.boateng@example.com','Android Engineer','Kotlin, Jetpack Compose, GraphQL, and modular mobile architectures.',4.0,'LinkedIn','Active',23),
 ('isabella.rossi@example.com','Lead UX Designer','Enterprise SaaS workflows, interactive prototyping, and accessibility audits.',7.5,'Portfolio','In review',24),
 ('kabir.malhotra@example.com','Software Engineer II','Node.js, Express, PostgreSQL, Redis caching, and GraphQL APIs.',3.0,'Direct upload','Active',25),
 ('grace.lin@example.com','Machine Learning Scientist','Recommendation systems, ranking models, and A/B experimentation.',5.0,'Referral','Active',26),
 ('victor.hugo@example.com','Security Architect','Cloud security posture, Kubernetes hardening, and cryptography.',11.0,'LinkedIn','Archived',27),
 ('tanya.kapoor@example.com','Business Intelligence Analyst','SQL, PowerBI, Tableau, and executive KPI reporting.',3.5,'Careers page','Active',28),
 ('benjamin.cole@example.com','DevSecOps Engineer','CI/CD security scanning, Vault secrets management, and AWS IAM.',6.0,'Direct upload','In review',28),
 ('sora.takahashi@example.com','Graphics & WebGL Engineer','Three.js, TypeScript, WebGPU, and interactive data visualizations.',5.0,'GitHub','Active',29),
 ('fatima.zahra@example.com','Cloud Solutions Architect','Enterprise cloud migrations, hybrid networking, and cost governance.',8.5,'Referral','Active',29),
 ('daniel.wu@example.com','Staff Software Engineer','Led 25-engineer org building distributed billing ledgers in Go & PostgreSQL.',12.0,'Referral','Active',30),
 ('olivia.bennett@example.com','Product Operations Manager','Release management, customer feedback loops, and analytics enablement.',4.5,'LinkedIn','In review',30),
 ('siddharth.rao@example.com','Backend & Data Engineer','Python, FastAPI, PostgreSQL, and vector search pipelines.',4.0,'Careers page','Active',1)
) AS x(email, title, summary, years, source, status, days_ago)
JOIN candidates c ON c.email = x.email
WHERE NOT EXISTS (
  SELECT 1 FROM resumes r WHERE r.candidate_id = c.candidate_id AND r.current_title = x.title
);

-- Insert canonical skills
INSERT INTO skills(skill_name) VALUES
('Figma'),('Design Systems'),('SQL'),('Python'),('React'),('TypeScript'),('Product Strategy'),
('User Research'),('Machine Learning'),('Node.js'),('Accessibility'),('Go'),('PostgreSQL'),('AWS'),
('Kubernetes'),('Docker'),('Terraform'),('Kafka'),('PyTorch'),('Snowflake'),('dbt'),('Airflow'),
('SwiftUI'),('Rust'),('C++'),('Playwright'),('GraphQL'),('Redis'),('FastAPI'),('Kotlin'),
('Tableau'),('PowerBI'),('Three.js'),('Prototyping'),('Research'),('Next.js'),('Linux'),('Security')
ON CONFLICT (skill_name) DO NOTHING;

-- Map skills to resumes with proficiency levels
INSERT INTO resume_skills(resume_id, skill_id, proficiency)
SELECT r.resume_id, s.skill_id, x.prof
FROM (VALUES
 ('maya.chen@example.com','Figma','Expert'),('maya.chen@example.com','Design Systems','Expert'),('maya.chen@example.com','Accessibility','Advanced'),
 ('jordan.lee@example.com','React','Expert'),('jordan.lee@example.com','TypeScript','Advanced'),('jordan.lee@example.com','Node.js','Advanced'),('jordan.lee@example.com','PostgreSQL','Intermediate'),
 ('aisha.patel@example.com','Python','Expert'),('aisha.patel@example.com','SQL','Expert'),('aisha.patel@example.com','Machine Learning','Advanced'),
 ('noah.williams@example.com','Product Strategy','Expert'),('noah.williams@example.com','SQL','Advanced'),('noah.williams@example.com','User Research','Intermediate'),
 ('sofia.garcia@example.com','User Research','Expert'),('sofia.garcia@example.com','Figma','Advanced'),('sofia.garcia@example.com','Accessibility','Intermediate'),
 ('ethan.brooks@example.com','React','Expert'),('ethan.brooks@example.com','TypeScript','Expert'),('ethan.brooks@example.com','Accessibility','Advanced'),
 ('amara.okafor@example.com','Figma','Expert'),('amara.okafor@example.com','Prototyping','Advanced'),('amara.okafor@example.com','Design Systems','Intermediate'),
 ('theo.martin@example.com','Go','Expert'),('theo.martin@example.com','PostgreSQL','Expert'),('theo.martin@example.com','AWS','Advanced'),('theo.martin@example.com','Docker','Advanced'),
 ('rohan.sharma@example.com','Go','Advanced'),('rohan.sharma@example.com','PostgreSQL','Expert'),('rohan.sharma@example.com','Kafka','Advanced'),('rohan.sharma@example.com','Redis','Advanced'),
 ('elena.rostova@example.com','Python','Expert'),('elena.rostova@example.com','PyTorch','Expert'),('elena.rostova@example.com','Machine Learning','Expert'),('elena.rostova@example.com','PostgreSQL','Advanced'),
 ('marcus.vance@example.com','AWS','Expert'),('marcus.vance@example.com','Kubernetes','Expert'),('marcus.vance@example.com','Terraform','Expert'),('marcus.vance@example.com','Docker','Expert'),
 ('priya.nair@example.com','SQL','Expert'),('priya.nair@example.com','Python','Advanced'),('priya.nair@example.com','Snowflake','Expert'),('priya.nair@example.com','dbt','Advanced'),('priya.nair@example.com','Airflow','Advanced'),
 ('liam.oconnor@example.com','Kubernetes','Expert'),('liam.oconnor@example.com','Linux','Expert'),('liam.oconnor@example.com','Terraform','Advanced'),('liam.oconnor@example.com','AWS','Advanced'),
 ('chloe.kim@example.com','SwiftUI','Expert'),('chloe.kim@example.com','TypeScript','Intermediate'),('chloe.kim@example.com','GraphQL','Advanced'),
 ('arjun.mehta@example.com','React','Advanced'),('arjun.mehta@example.com','Next.js','Advanced'),('arjun.mehta@example.com','Node.js','Advanced'),('arjun.mehta@example.com','PostgreSQL','Advanced'),
 ('hannah.abbott@example.com','Product Strategy','Expert'),('hannah.abbott@example.com','SQL','Advanced'),('hannah.abbott@example.com','GraphQL','Intermediate'),
 ('lucas.meyer@example.com','Rust','Expert'),('lucas.meyer@example.com','C++','Expert'),('lucas.meyer@example.com','PostgreSQL','Expert'),('lucas.meyer@example.com','Linux','Advanced'),
 ('zara.almansoor@example.com','Security','Expert'),('zara.almansoor@example.com','AWS','Advanced'),('zara.almansoor@example.com','Kubernetes','Advanced'),
 ('david.park@example.com','React','Expert'),('david.park@example.com','TypeScript','Expert'),('david.park@example.com','Next.js','Advanced'),('david.park@example.com','Three.js','Intermediate'),
 ('nadia.ivanova@example.com','SQL','Expert'),('nadia.ivanova@example.com','dbt','Expert'),('nadia.ivanova@example.com','Snowflake','Advanced'),('nadia.ivanova@example.com','Python','Intermediate'),
 ('carlos.mendez@example.com','Playwright','Expert'),('carlos.mendez@example.com','TypeScript','Advanced'),('carlos.mendez@example.com','Docker','Intermediate'),
 ('ananya.verma@example.com','Python','Expert'),('ananya.verma@example.com','PyTorch','Advanced'),('ananya.verma@example.com','Machine Learning','Advanced'),
 ('owen.hughes@example.com','Docker','Expert'),('owen.hughes@example.com','Kubernetes','Advanced'),('owen.hughes@example.com','TypeScript','Intermediate'),('owen.hughes@example.com','AWS','Advanced'),
 ('mei.lin@example.com','PostgreSQL','Expert'),('mei.lin@example.com','SQL','Expert'),('mei.lin@example.com','Linux','Expert'),('mei.lin@example.com','Terraform','Intermediate'),
 ('samuel.boateng@example.com','Kotlin','Expert'),('samuel.boateng@example.com','GraphQL','Advanced'),('samuel.boateng@example.com','Docker','Intermediate'),
 ('isabella.rossi@example.com','Figma','Expert'),('isabella.rossi@example.com','Design Systems','Expert'),('isabella.rossi@example.com','Prototyping','Expert'),('isabella.rossi@example.com','Accessibility','Advanced'),
 ('kabir.malhotra@example.com','Node.js','Advanced'),('kabir.malhotra@example.com','PostgreSQL','Advanced'),('kabir.malhotra@example.com','Redis','Advanced'),('kabir.malhotra@example.com','React','Intermediate'),
 ('grace.lin@example.com','Python','Expert'),('grace.lin@example.com','Machine Learning','Expert'),('grace.lin@example.com','SQL','Advanced'),('grace.lin@example.com','PyTorch','Advanced'),
 ('victor.hugo@example.com','Security','Expert'),('victor.hugo@example.com','Kubernetes','Expert'),('victor.hugo@example.com','Linux','Expert'),
 ('tanya.kapoor@example.com','SQL','Expert'),('tanya.kapoor@example.com','Tableau','Expert'),('tanya.kapoor@example.com','PowerBI','Advanced'),('tanya.kapoor@example.com','Python','Intermediate'),
 ('benjamin.cole@example.com','Security','Advanced'),('benjamin.cole@example.com','AWS','Expert'),('benjamin.cole@example.com','Terraform','Advanced'),('benjamin.cole@example.com','Docker','Advanced'),
 ('sora.takahashi@example.com','Three.js','Expert'),('sora.takahashi@example.com','TypeScript','Expert'),('sora.takahashi@example.com','React','Advanced'),
 ('fatima.zahra@example.com','AWS','Expert'),('fatima.zahra@example.com','Terraform','Expert'),('fatima.zahra@example.com','Kubernetes','Advanced'),
 ('daniel.wu@example.com','Go','Expert'),('daniel.wu@example.com','PostgreSQL','Expert'),('daniel.wu@example.com','Kafka','Expert'),('daniel.wu@example.com','Kubernetes','Advanced'),
 ('olivia.bennett@example.com','Product Strategy','Advanced'),('olivia.bennett@example.com','SQL','Intermediate'),('olivia.bennett@example.com','Tableau','Intermediate'),
 ('siddharth.rao@example.com','Python','Expert'),('siddharth.rao@example.com','FastAPI','Expert'),('siddharth.rao@example.com','PostgreSQL','Advanced'),('siddharth.rao@example.com','Docker','Advanced')
) AS x(email, skill_name, prof)
JOIN candidates c ON c.email = x.email
JOIN resumes r ON r.candidate_id = c.candidate_id
JOIN skills s ON s.skill_name = x.skill_name
ON CONFLICT (resume_id, skill_id) DO UPDATE SET proficiency = EXCLUDED.proficiency;

-- Seed work experience for profiles (idempotent check)
INSERT INTO work_experience(resume_id, company_name, job_title, started_on, ended_on, description)
SELECT r.resume_id, x.company, x.job_title, x.start_dt::date, x.end_dt::date, x.descr
FROM (VALUES
 ('maya.chen@example.com','Linear Labs','Senior Product Designer','2022-03-01',NULL,'Led design system architecture across 12 product surfaces and improved WCAG AA compliance to 100%.'),
 ('maya.chen@example.com','Figma Studio','Product Designer','2019-06-01','2022-02-15','Designed collaborative inspection workflows and token-driven component libraries.'),
 ('jordan.lee@example.com','Stripe','Full-Stack Engineer','2021-08-01',NULL,'Built merchant onboarding dashboards in React/TypeScript backed by Node.js and PostgreSQL.'),
 ('aisha.patel@example.com','Databricks','Data Scientist','2022-01-10',NULL,'Developed churn-prediction models reducing enterprise attrition by 14% YoY.'),
 ('noah.williams@example.com','Atlassian','Senior Product Manager','2020-04-01',NULL,'Owned enterprise workflow automation roadmap serving 40k+ B2B organizations.'),
 ('theo.martin@example.com','Cloudflare','Staff Backend Engineer','2021-01-15',NULL,'Scaled distributed telemetry ingestion in Go and PostgreSQL to 2M events/sec.'),
 ('rohan.sharma@example.com','Razorpay','Senior Backend Engineer','2021-07-01',NULL,'Designed idempotent ledger APIs and zero-downtime PostgreSQL partition migrations.'),
 ('elena.rostova@example.com','Scale AI','Staff ML Engineer','2022-05-01',NULL,'Built hybrid semantic + keyword retrieval pipelines using pgvector and PyTorch.'),
 ('marcus.vance@example.com','HashiCorp','Cloud Architect','2019-09-01',NULL,'Authored multi-region Terraform modules and Kubernetes federation standards.'),
 ('mei.lin@example.com','Grab','Principal DBA','2020-02-01',NULL,'Managed 120+ PostgreSQL clusters with Patroni HA and sub-10ms p99 query latency.'),
 ('daniel.wu@example.com','Coinbase','Staff Software Engineer','2019-03-01',NULL,'Architected core settlement services in Go, Kafka, and PostgreSQL.')
) AS x(email, company, job_title, start_dt, end_dt, descr)
JOIN candidates c ON c.email = x.email
JOIN resumes r ON r.candidate_id = c.candidate_id
WHERE NOT EXISTS (
  SELECT 1 FROM work_experience we WHERE we.resume_id = r.resume_id AND we.company_name = x.company
);

-- Seed education for profiles
INSERT INTO education(resume_id, institution, degree, field_of_study, graduation_year)
SELECT r.resume_id, x.inst, x.deg, x.field, x.grad_yr
FROM (VALUES
 ('maya.chen@example.com','UC Berkeley','B.A.','Cognitive Science & Design',2018),
 ('jordan.lee@example.com','NYU Tandon','B.S.','Computer Science',2020),
 ('aisha.patel@example.com','University of Washington','M.S.','Data Science',2021),
 ('noah.williams@example.com','UT Austin','B.B.A.','Management Information Systems',2017),
 ('theo.martin@example.com','Oregon State University','B.S.','Computer Engineering',2016),
 ('rohan.sharma@example.com','IIT Delhi','B.Tech','Computer Science & Engineering',2019),
 ('elena.rostova@example.com','Stanford University','M.S.','Artificial Intelligence',2018),
 ('marcus.vance@example.com','Georgia Tech','B.S.','Computer Science',2015),
 ('mei.lin@example.com','National University of Singapore','B.Comp.','Database Systems',2016),
 ('daniel.wu@example.com','Carnegie Mellon University','M.S.','Distributed Systems',2014),
 ('siddharth.rao@example.com','IIIT Hyderabad','B.Tech','Computer Science',2021)
) AS x(email, inst, deg, field, grad_yr)
JOIN candidates c ON c.email = x.email
JOIN resumes r ON r.candidate_id = c.candidate_id
WHERE NOT EXISTS (
  SELECT 1 FROM education ed WHERE ed.resume_id = r.resume_id AND ed.institution = x.inst
);

-- Seed Job Openings
INSERT INTO job_openings(title, department, location, status)
SELECT x.title, x.dept, x.loc, x.status
FROM (VALUES
 ('Senior Full-Stack Engineer','Engineering','San Francisco / Remote','Open'),
 ('Staff Machine Learning Engineer','AI & Data','Seattle / Hybrid','Open'),
 ('Lead Product Designer','Design','New York, NY','Open'),
 ('Cloud Infrastructure Architect','Platform','Remote','Open'),
 ('Principal PostgreSQL DBA','Data Infrastructure','Singapore / Remote','Open'),
 ('Security Operations Engineer','Security','London / Hybrid','Paused')
) AS x(title, dept, loc, status)
WHERE NOT EXISTS (SELECT 1 FROM job_openings j WHERE j.title = x.title);

-- Seed Applications linking resumes to job openings
INSERT INTO applications(resume_id, job_id, stage)
SELECT r.resume_id, j.job_id, x.stage
FROM (VALUES
 ('jordan.lee@example.com','Senior Full-Stack Engineer','Interview'),
 ('arjun.mehta@example.com','Senior Full-Stack Engineer','Screening'),
 ('kabir.malhotra@example.com','Senior Full-Stack Engineer','New'),
 ('david.park@example.com','Senior Full-Stack Engineer','Offer'),
 ('elena.rostova@example.com','Staff Machine Learning Engineer','Offer'),
 ('aisha.patel@example.com','Staff Machine Learning Engineer','Interview'),
 ('grace.lin@example.com','Staff Machine Learning Engineer','Screening'),
 ('maya.chen@example.com','Lead Product Designer','Hired'),
 ('amara.okafor@example.com','Lead Product Designer','Interview'),
 ('isabella.rossi@example.com','Lead Product Designer','Screening'),
 ('marcus.vance@example.com','Cloud Infrastructure Architect','Interview'),
 ('fatima.zahra@example.com','Cloud Infrastructure Architect','New'),
 ('mei.lin@example.com','Principal PostgreSQL DBA','Offer'),
 ('lucas.meyer@example.com','Principal PostgreSQL DBA','Screening'),
 ('zara.almansoor@example.com','Security Operations Engineer','Screening')
) AS x(email, job_title, stage)
JOIN candidates c ON c.email = x.email
JOIN resumes r ON r.candidate_id = c.candidate_id
JOIN job_openings j ON j.title = x.job_title
ON CONFLICT (resume_id, job_id) DO NOTHING;
