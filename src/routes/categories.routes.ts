import { Elysia, t } from 'elysia'
import { Prisma } from '../../generated/prisma/client'
import { prisma } from '../lib/prisma'
import { pluginAuth } from '../plugin/auth'

export const categoryRoutes = new Elysia({ prefix: '/categories' })
    .get('/', () => prisma.category.findMany({
        include: { promotions: { where: { isActive: true } } },
        orderBy: { name: 'asc' }
    }))
    .use(pluginAuth)
    .post('/', async ({ user, body, status }) => {
        if (!user.isAdmin) return status(403, 'Forbidden')
        try {
            return await prisma.category.create({ data: body })
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                return status(409, { message: 'Ya existe una categoría con ese nombre' })
            }
            throw error
        }
    }, { body: t.Object({ name: t.String({ minLength: 1 }), description: t.String({ minLength: 1 }) }) })
    .patch('/:id', async ({ user, params, body, status }) => {
        if (!user.isAdmin) return status(403, 'Forbidden')
        try {
            return await prisma.category.update({ where: { id: Number(params.id) }, data: body })
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2025') return status(404, { message: 'Categoría no encontrada' })
                if (error.code === 'P2002') return status(409, { message: 'Ya existe una categoría con ese nombre' })
            }
            throw error
        }
    }, {
        params: t.Object({ id: t.Numeric() }),
        body: t.Object({
            name: t.Optional(t.String({ minLength: 1 })),
            description: t.Optional(t.String({ minLength: 1 }))
        })
    })
    .delete('/:id', async ({ user, params, status }) => {
        if (!user.isAdmin) return status(403, 'Forbidden')
        const id = Number(params.id)
        const category = await prisma.category.findUnique({
            where: { id },
            include: { _count: { select: { products: true } } }
        })
        if (!category) return status(404, { message: 'Categoría no encontrada' })
        if (category._count.products > 0) {
            return status(409, { message: 'No se puede eliminar una categoría con productos asociados' })
        }
        await prisma.$transaction([
            prisma.promotion.deleteMany({ where: { categoryId: id } }),
            prisma.category.delete({ where: { id } })
        ])
        return { message: 'Categoría eliminada correctamente' }
    }, { params: t.Object({ id: t.Numeric() }) })

