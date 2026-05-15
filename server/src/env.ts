import { z } from 'zod'

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().default('postgres://postgres:postgres@localhost:5432/specflow'),
  AI_API_KEY: z.string().default(''),
  AI_BASE_URL: z.string().default('https://api.deepseek.com'),
  AI_MODEL: z.string().default('deepseek-chat'),
})

export const env = envSchema.parse(process.env)
