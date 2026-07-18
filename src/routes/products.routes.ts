import { Elysia, t } from 'elysia'
import { Prisma } from '../../generated/prisma/client'
import { prisma } from '../lib/prisma'
import { pluginAuth } from '../plugin/auth'

const productBody = t.Object({
    name: t.String({ minLength: 1 }),
    description: t.String({ minLength: 1 }),
    price: t.Number({ minimum: 0 }),
    stock: t.Integer({ minimum: 0 }),
    images: t.Array(t.String()),
    categoryIds: t.Array(t.Integer({ minimum: 1 }), { minItems: 1 })
})

export const productRoutes = new Elysia({ prefix: '/products' })
    .get('/', async ({ query }) => {
        const products = await prisma.product.findMany({
            where: {
                isActive: true,
                name: query.name ? { contains: query.name, mode: 'insensitive' } : undefined,
                categories: query.categories ? { some: { name: query.categories } } : undefined,
                price: query.minPrice !== undefined || query.maxPrice !== undefined
                    ? { gte: query.minPrice, lte: query.maxPrice }
                    : undefined
            },
            include: {
                categories: {
                    include: { promotions: { where: { isActive: true }, select: { id: true } } }
                }
            },
            orderBy: { createdAt: 'desc' }
        })

        return products.map(product => ({
            ...product,
            categories: product.categories.map(({ promotions, ...category }) => category),
            hasPromotion: product.categories.some(category => category.promotions.length > 0)
        }))
    }, {
        query: t.Object({
            name: t.Optional(t.String()),
            categories: t.Optional(t.String()),
            minPrice: t.Optional(t.Numeric({ minimum: 0 })),
            maxPrice: t.Optional(t.Numeric({ minimum: 0 }))
        })
    })
    .get('/:id', async ({ params, status }) => {
        const id = Number(params.id)
        const product = await prisma.product.findFirst({
            where: { id, isActive: true },
            include: {
                categories: {
                    include: { promotions: { where: { isActive: true } } }
                }
            }
        })
        if (!product) return status(404, { message: 'Producto no encontrado' })

        const promotions = product.categories.flatMap(category =>
            category.promotions.map(promotion => ({
                categoryId: category.id,
                category: category.name,
                discount: promotion.discount,
                minPrice: promotion.minPrice
            }))
        )
        const relatedFilters = product.categories.map(category => {
            const promotion = category.promotions[0]
            return {
                categories: { some: { id: category.id } },
                price: promotion ? { gte: promotion.minPrice } : undefined
            }
        })
        const relatedProducts = await prisma.product.findMany({
            where: {
                id: { not: id },
                isActive: true,
                stock: { gt: 0 },
                OR: relatedFilters
            },
            include: { categories: true },
            take: 6,
            orderBy: { createdAt: 'desc' }
        })

        return {
            ...product,
            categories: product.categories.map(({ promotions: _promotions, ...category }) => category),
            promotions,
            relatedProducts
        }
    }, { params: t.Object({ id: t.Numeric() }) })
    .use(pluginAuth)
    .post('/', async ({ user, body, status }) => {
        if (!user.isAdmin) return status(403, 'Forbidden')
        return prisma.product.create({
            data: {
                name: body.name,
                description: body.description,
                price: body.price,
                stock: body.stock,
                images: body.images,
                categories: { connect: body.categoryIds.map(id => ({ id })) }
            },
            include: { categories: true }
        })
    }, { body: productBody })
    .patch('/:id', async ({ user, params, body, status }) => {
        if (!user.isAdmin) return status(403, 'Forbidden')
        const { categoryIds, ...data } = body
        try {
            return await prisma.product.update({
                where: { id: Number(params.id) },
                data: {
                    ...data,
                    categories: categoryIds ? { set: categoryIds.map(id => ({ id })) } : undefined
                },
                include: { categories: true }
            })
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                return status(404, { message: 'Producto o categoría no encontrada' })
            }
            throw error
        }
    }, {
        params: t.Object({ id: t.Numeric() }),
        body: t.Partial(productBody)
    })
    .patch('/:id/deactivate', async ({ user, params, status }) => {
        if (!user.isAdmin) return status(403, 'Forbidden')
        try {
            await prisma.product.update({
                where: { id: Number(params.id) },
                data: { isActive: false }
            })
            return { message: 'Producto desactivado correctamente' }
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                return status(404, { message: 'Producto no encontrado' })
            }
            throw error
        }
    }, { params: t.Object({ id: t.Numeric() }) })
