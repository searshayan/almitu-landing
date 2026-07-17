# Almitu Pilot — Backend setup (one-time, ~10 minutes)

Do these steps once. After this, tutors and students can sign up from any device.

## 1. Create a Supabase project
1. Go to https://supabase.com → sign in → **New project**.
2. Pick a name, a strong database password, and the region closest to your users.
3. Wait ~2 minutes for it to finish provisioning.

## 2. Create the database (run the migration)
1. In the project: left sidebar → **SQL Editor** → **New query**.
2. Open `supabase/migration.sql` from this project, copy the **entire** file, paste it in, and click **Run**.
3. You should see "Success". This creates the tables, security rules, and the signup trigger.

## 3. (Recommended for the pilot) Turn off email confirmation
So testers can sign in immediately without a confirmation email:
- Left sidebar → **Authentication** → **Providers** → **Email** → turn **Confirm email** OFF → Save.
(You can turn it back on later for production.)

## 4. Connect the app to your project
1. Left sidebar → **Project Settings** → **API**.
2. Copy the **Project URL** and the **anon / public** key.
3. Open `js/supabase.js` and paste them into:
   ```js
   const SUPABASE_URL      = 'https://YOUR-REF.supabase.co';
   const SUPABASE_ANON_KEY = 'eyJ...your anon key...';
   ```
4. Reload the app — the "Backend not configured" notice disappears and you can sign up.

## 5. Make yourself the admin
1. In the app, **Create account** with your admin email (e.g. telaacademy022@gmail.com) and a password.
2. Back in Supabase → **SQL Editor** → **New query** → run (use the same email):
   ```sql
   update public.profiles set role = 'admin', status = 'approved'
   where email = 'telaacademy022@gmail.com';
   ```
3. In the app, click **Refresh status** (or sign out and back in). You now land on the **Admin Dashboard**.

## 6. Run the pilot
- Tutors and students **Create account** → they see "Awaiting approval".
- You (admin) go to **Users**, set each person's **Role**, and click **Approve**.
- Go to **Assignments** and link each student to a tutor.
- Tutors now see their assigned students, can plan/generate/save sessions, run them, and write notes.
- Students log in to see their completed sessions, tutor notes, and practice activities.
- (Optional) In **AI Settings**, switch from the Demo engine to the Claude API and paste your key — this applies to all tutors.

## Deploying to your server
The app is a static site. Upload the contents of the `Almitu Pilot Test/` folder to your web host. The only backend is Supabase (already live). Keep `js/supabase.js` with your URL + anon key — both are safe to ship publicly; Row-Level Security protects the data.

## Security note (API key)
For the pilot, the Claude/Custom API key is stored in the database and readable by admins + tutors (so their browsers can call the AI). Students can't read it. For production, move AI calls behind a Supabase **Edge Function** so the key never reaches any browser.
