import { Elysia } from 'elysia'
import { prisma } from '../lib/prisma'
import { pluginJWT } from './jwt'

export const pluginAuth = new Elysia({ name: 'auth' })
    .use(pluginJWT)
    .resolve(async ({ cookie: { auth }, jwt, status }) => {
        const token = auth?.value
        const payload = typeof token === 'string' ? await jwt.verify(token) : false

        if (!payload || typeof payload.id !== 'number') {
            return status(401, { message: 'Unauthorized' })
        }

        const user = await prisma.user.findUnique({
            where: { id: payload.id },
            omit: { password: true }
        })

        if (!user) return status(401, { message: 'Unauthorized' })

        return { user }
    })
    .as('scoped')
