import { Elysia, t } from 'elysia'
import { Prisma } from '../../generated/prisma/client'
import { prisma } from '../lib/prisma'
import { pluginAuth } from '../plugin/auth'

export const promotionRoutes = new Elysia({ prefix: '/promotions' })
    .get('/', () => prisma.promotion.findMany({
        where: { isActive: true },
        include: { category: true },
        orderBy: { createdAt: 'desc' }
    }))
    .use(pluginAuth)
    .get('/admin/all', async ({ user, status }) => {
        if (!user.isAdmin) return status(403, 'Forbidden')

        return prisma.promotion.findMany({
            include: { category: true },
            orderBy: { createdAt: 'desc' }
        })
    })
    .post('/', async ({ user, body, status }) => {
        if (!user.isAdmin) return status(403, 'Forbidden')
        const category = await prisma.category.findUnique({ where: { id: body.categoryId } })
        if (!category) return status(404, { message: 'Categoría no encontrada' })

        const activePromotion = await prisma.promotion.findFirst({
            where: { categoryId: body.categoryId, isActive: true }
        })
        if (activePromotion) return status(409, { message: 'Ya existe una promoción activa para esta categoría' })

        return prisma.promotion.create({ data: body, include: { category: true } })
    }, {
        body: t.Object({
            categoryId: t.Integer({ minimum: 1 }),
            minPrice: t.Number({ minimum: 0 }),
            discount: t.Number({ exclusiveMinimum: 0, maximum: 100 })
        })
    })
    .patch('/:id', async ({ user, params, body, status }) => {
        if (!user.isAdmin) return status(403, 'Forbidden')
        try {
            if (body.isActive) {
                const current = await prisma.promotion.findUnique({ where: { id: Number(params.id) } })
                if (!current) return status(404, { message: 'Promoción no encontrada' })
                const conflicting = await prisma.promotion.findFirst({
                    where: { categoryId: current.categoryId, isActive: true, id: { not: current.id } }
                })
                if (conflicting) return status(409, { message: 'Ya existe una promoción activa para esta categoría' })
            }
            return await prisma.promotion.update({
                where: { id: Number(params.id) },
                data: body,
                include: { category: true }
            })
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                return status(404, { message: 'Promoción no encontrada' })
            }
            throw error
        }
    }, {
        params: t.Object({ id: t.Numeric() }),
        body: t.Object({
            minPrice: t.Optional(t.Number({ minimum: 0 })),
            discount: t.Optional(t.Number({ exclusiveMinimum: 0, maximum: 100 })),
            isActive: t.Optional(t.Boolean())
        })
    })
    .delete('/:id', async ({ user, params, status }) => {
        if (!user.isAdmin) return status(403, 'Forbidden')
        try {
            await prisma.promotion.delete({ where: { id: Number(params.id) } })
            return { message: 'Promoción eliminada correctamente' }
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                return status(404, { message: 'Promoción no encontrada' })
            }
            throw error
        }
    }, { params: t.Object({ id: t.Numeric() }) })
