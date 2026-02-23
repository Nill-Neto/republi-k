
SELECT cron.schedule(
  'check-notifications-daily',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mqorykrxvqfkifjkveqe.supabase.co/functions/v1/check-notifications',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xb3J5a3J4dnFma2lmamt2ZXFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODI2MDIsImV4cCI6MjA4NzM1ODYwMn0.4RnBDxzOvF3BdLSylkAGWDHgKaID-dnEvpw1f9h4p-g"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
