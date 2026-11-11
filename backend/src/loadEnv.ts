import { existsSync } from 'fs'
import path from 'path'

// Load backend/.env (if present) before anything reads process.env.
// Works from both src/ (ts-node) and dist/ (built). Real env vars win over the file.
const envFile = path.join(__dirname, '..', '.env')
if (existsSync(envFile)) process.loadEnvFile(envFile)
