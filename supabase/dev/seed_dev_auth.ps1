# FloraFlow — Dev Auth Seed
# Run this FIRST after every `bunx supabase db reset`, before seed_dev_user.sql
# Creates admin@floraflow.dev / admin via the GoTrue admin API (reliable, no direct auth.users manipulation)

Invoke-RestMethod `
  -Uri "http://127.0.0.1:54321/auth/v1/admin/users" `
  -Method POST `
  -Headers @{
    "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
    "Content-Type" = "application/json"
  } `
  -Body '{"id":"00000000-0000-0000-0000-000000000001","email":"admin@floraflow.dev","password":"admin","email_confirm":true,"user_metadata":{"display_name":"FloraFlow Admin"}}'
