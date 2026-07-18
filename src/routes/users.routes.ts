import { Elysia, t } from 'elysia'
import { Prisma } from '../../generated/prisma/client'
import { prisma } from '../lib/prisma'
import { pluginAuth } from '../plugin/auth'

export const userRoutes = new Elysia({ prefix: '/users' })
    .use(pluginAuth)
    .get('/', async ({ user, status }) => {
        if (!user.isAdmin) return status(403, 'Forbidden')
        return prisma.user.findMany({ omit: { password: true } })
    })
    .get('/:id', async ({ user, params, status }) => {
        const id = Number(params.id)
        if (user.id !== id) return status(403, 'Forbidden')

        const profile = await prisma.user.findUnique({ where: { id }, omit: { password: true } })
        if (!profile) return status(404, { message: 'Usuario no encontrado' })
        return profile
    }, { params: t.Object({ id: t.Numeric() }) })
    .patch('/:id', async ({ user, params, body, status }) => {
        const id = Number(params.id)
        if (user.id !== id) return status(403, 'Forbidden')

        try {
            return await prisma.user.update({
                where: { id },
                data: body,
                omit: { password: true }
            })
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2025') return status(404, { message: 'Usuario no encontrado' })
                if (error.code === 'P2002') {
                    const target = Array.isArray(error.meta?.target) ? error.meta.target.map(String) : []
                    if (target.includes('email')) return status(409, { message: 'Email ya registrado' })
                    if (target.includes('phone')) return status(409, { message: 'Teléfono ya registrado' })
                    return status(409, { message: 'Los datos ingresados ya están registrados' })
                }
            }
            throw error
        }
    }, {
        params: t.Object({ id: t.Numeric() }),
        body: t.Object({
            name: t.Optional(t.String({ minLength: 1 })),
            email: t.Optional(t.String({ format: 'email' })),
            address: t.Optional(t.String({ minLength: 1 })),
            phone: t.Optional(t.String({ minLength: 1 }))
        })
    })

