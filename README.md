# Project Repository & Hackathon Portal

A web portal for the Centre for Innovation, Sri Eshwar College of Engineering.

- Stores student project spreadsheets batch-wise (2023–27 to 2027–31) and year-wise (I–IV), up to 5 documents per year.
- Reads Design Thinking Excel sheets (one sheet per department/section) into a searchable project list, with filters for department, technology domain and sector.
- Keeps the original files for download at any time.
- For each hackathon, suggests the project teams that can apply, with department, roll numbers, names, project title and mentor, and exports the shortlist as CSV.

© N. Banupriya, AP/CCE, Sri Eshwar College of Engineering.

---

## What you need

| Service | Why | Cost |
|---|---|---|
| GitHub account | Holds the code | Free |
| Vercel account (sign in with GitHub) | Runs the website | Free (Hobby) plan is enough |
| Neon Postgres (added from inside Vercel) | Stores projects and hackathons | Free tier |
| Vercel Blob (added from inside Vercel) | Stores the uploaded files | Free tier |
| Anthropic API key (console.anthropic.com) | AI matching of projects to hackathons | Pay per use, a few rupees per match. Optional: without it, matching uses keywords |

## Deploy in 6 steps

### 1. Put the code on GitHub
1. Go to github.com → **New repository** → name it `sece-project-portal` → **Private** → Create.
2. On the new repository page click **uploading an existing file**, drag in every file and folder from this project (not `node_modules` or `.next`), and click **Commit changes**.

   Or, with Git installed on your computer:
   ```bash
   cd sece-project-portal
   git init
   git add .
   git commit -m "Project portal"
   git branch -M main
   git remote add origin https://github.com/<your-username>/sece-project-portal.git
   git push -u origin main
   ```

### 2. Import it into Vercel
1. Go to vercel.com → **Add New… → Project** → pick the `sece-project-portal` repository → **Import**.
2. Framework is detected as **Next.js**. Do not deploy yet; first open **Environment Variables** (next step). If it already deployed, that's fine; it will just show errors until step 4.

### 3. Add the database and file storage
In the Vercel project, open the **Storage** tab:
1. **Create Database → Neon (Postgres)** → accept the defaults → **Connect** to this project. This adds `DATABASE_URL` automatically.
2. **Create → Blob** → choose **Private** access → **Connect** to this project. This adds `BLOB_READ_WRITE_TOKEN` automatically.

The tables are created automatically the first time the site is used.

### 4. Add the passwords and settings
**Settings → Environment Variables**, add:

| Name | Value |
|---|---|
| `ADMIN_PASSWORD` | Password for the admin (can upload, delete and manage everything) |
| `STAFF_PASSWORD` | Password for other faculty (can view, download, add hackathons and run matching) |
| `SESSION_SECRET` | Any long random text, at least 32 characters |
| `BLOB_ACCESS` | `private` (use `public` only if you created the Blob store as public) |
| `ANTHROPIC_API_KEY` | Your key from console.anthropic.com (optional) |
| `ANTHROPIC_MODEL` | `claude-sonnet-5-5` (optional; change to another Claude model if you prefer) |

### 5. Deploy
**Deployments → Redeploy** (or push any change to GitHub). Open the site address Vercel shows, e.g. `sece-project-portal.vercel.app`.

### 6. Use your college domain (optional)
**Settings → Domains → Add** e.g. `projects.cfi.sece.ac.in`, then ask the college IT team to add the CNAME record Vercel shows.

---

## Using the portal

1. Sign in with the admin password.
2. **Project Repository**: click a batch and year in the grid, then drop the Excel file(s) into **Upload documents**. The project list fills in automatically.
3. The project list stays hidden until you click **Show project list**. Use the department buttons or the Domain / Sector filters to narrow it first. **Download CSV** exports what is filtered.
4. **Hackathons → Add hackathon**: paste the link and press **Read page** (works for simple pages), or paste the themes and problem statements yourself. Choose batches and years, save, then **Find matching projects**.
5. Only **strong** recommendations are shown. **Download Excel** gives one workbook: a *Consolidated* sheet plus one sheet per department, each headed with the hackathon name, with Batch, Year, Track (only when the hackathon has tracks), Roll No., Name, Project Title and Faculty Mentor.

### Many hackathons at once
1. **Hackathons → Add many from Excel → Download the template.** Fill one row per hackathon (name, link, deadline, themes; batches and years optional). Up to 50 per file.
2. Choose the filled file, check the preview, press **Add**. The new hackathons are selected automatically.
3. Press **Match selected**. Two hackathons are matched at a time; keep the page open until the bar finishes.
4. Press **Download Excel (ZIP)**. The ZIP contains one Excel per hackathon (Consolidated + one sheet per department, headed with the hackathon name) and `00_All_Hackathons_Combined.xlsx` (a Summary sheet plus one consolidated sheet per hackathon).

If a row has no themes but has a link, the portal tries to read the themes from the link while matching.

### Spreadsheet format it understands
Each sheet = one department/section, with the heading row `Batch No. | Roll No. | Name of the Student | Name of the Faculty Mentor | Project Title | Technology Domain | Sector`. The department comes from the line "Department of XXX | …" above the heading, the section from "Section: A". Columns after **Sector** are ignored. A new team starts at each new Batch No.; the next rows are its members.

## Changing names, logo and colours
- Names and copyright: `lib/config.js`.
- Logo: put `logo.png` in the `public` folder and set `logo: "/logo.png"` in `lib/config.js`.
- Colours and fonts: the top of `app/globals.css`.
- Batches: the `BATCHES` list in `lib/config.js` (add `2028-2032` etc. later).

## Running on your own computer (for changes)
Needs Node.js 20+ and a Postgres database.
```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL and the passwords
npm run dev                  # open http://localhost:3000
```
Without `BLOB_READ_WRITE_TOKEN`, uploaded files are saved in the `.data` folder.

## Notes
- Matching sends project titles, departments, domains and sectors (not student names or roll numbers) to the AI service.
- Hackathon sites such as Unstop or Devfolio build their pages with JavaScript, so **Read page** may get little text from them. Paste the themes manually in that case.
- Backups: Neon keeps point-in-time history; you can also download every original file from the portal.
