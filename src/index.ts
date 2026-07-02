import { Elysia } from 'elysia';
import { jwt } from '@elysia/jwt'
import { cors } from '@elysia/cors'
import { authRoutes } from './routes/auth';

const app = new Elysia({prefix : '/api' })
    .use(cors())
    .use(
        jwt({
            name: 'jwt',
            secret: process.env.JWT_SECRET!
        })
    )
    .get('/health', async () => 'ok')
    .use(authRoutes)
    .listen(3000)

console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
)