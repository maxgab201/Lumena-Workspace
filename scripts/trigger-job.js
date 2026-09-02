import { createClient } from '@supabase/supabase-js'

async function run() {
  // Read service role key from .env.local
  const fs = require('fs')
  const envContent = fs.readFileSync('.env.local', 'utf-8')

  const sbUrlMatch = envContent.match(/PUBLIC_SUPABASE_URL=(.*)/)
  const sbKeyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)

  if (!sbUrlMatch || !sbKeyMatch) throw new Error("Missing env vars")

  const url = sbUrlMatch[1].trim()
  const key = sbKeyMatch[1].trim()

  const jobId = "9f47a24f-e727-4aa8-b128-919b54f63681"
  const docId = "4ea3dfeb-1277-4c42-94c1-d91a472b4ea7"
  const workspaceId = "a943fe37-a8c4-4f47-a71d-ca9ffa126a09"

  console.log("Triggering Edge Function with retry...")
  const res = await fetch(`${url}/functions/v1/process-document`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify({
      type: "INSERT",
      table: "processing_jobs",
      record: {
        id: jobId,
        document_id: docId,
        workspace_id: workspaceId,
        status: "queued"
      }
    })
  })

  // Print results
  const status = res.status
  let data
  try {
    data = await res.json()
  } catch (e) {
    data = await res.text()
  }

  console.log(`HTTP ${status} \n`, JSON.stringify(data, null, 2))
}

run().catch(console.error)
