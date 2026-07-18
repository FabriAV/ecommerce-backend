import { Elysia, t } from 'elysia'
import { Prisma } from '../../generated/prisma/client'
import { prisma } from '../lib/prisma'
import { pluginAuth } from '../plugin/auth'
import { calculatePromotions } from '../utils/promotions'

class OrderValidationError extends Error {
    constructor(public statusCode: 404 | 409, message: string) {
        super(message)
    }
}

export const orderRoutes = new Elysia({ prefix: '/orders' })
    .use(pluginAuth)
    .post('/', async ({ user, body, status }) => {
        const quantities = new Map<number, number>()
        for (const item of body.items) {
            quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity)
        }

        try {
            return await prisma.$transaction(async tx => {
                const requestedItems = [...quantities].map(([productId, quantity]) => ({ productId, quantity }))
                const products = await tx.product.findMany({
                    where: { id: { in: requestedItems.map(item => item.productId) } },
                    include: { categories: true }
                })

                for (const item of requestedItems) {
                    const product = products.find(candidate => candidate.id === item.productId)
                    if (!product || !product.isActive) {
                        throw new OrderValidationError(404, `Producto ${item.productId} no encontrado`)
                    }
                    if (product.stock < item.quantity) {
                        throw new OrderValidationError(409, `Stock insuficiente para ${product.name}`)
                    }
                }

                const calculation = await calculatePromotions(requestedItems.map(item => {
                    const product = products.find(candidate => candidate.id === item.productId)!
                    return {
                        productId: product.id,
                        name: product.name,
                        quantity: item.quantity,
                        price: product.price,
                        categories: product.categories
                    }
                }), tx)

                for (const item of requestedItems) {
                    const updated = await tx.product.updateMany({
                        where: { id: item.productId, isActive: true, stock: { gte: item.quantity } },
                        data: { stock: { decrement: item.quantity } }
                    })
                    if (updated.count !== 1) {
                        const product = products.find(candidate => candidate.id === item.productId)!
                        throw new OrderValidationError(409, `Stock insuficiente para ${product.name}`)
                    }
                }

                return tx.order.create({
                    data: {
                        userId: user.id,
                        totalPrice: new Prisma.Decimal(calculation.total.toFixed(2)),
                        status: 'PROCESSING',
                        orderItems: {
                            create: calculation.items.map(item => ({
                                productId: item.productId,
                                quantity: item.quantity,
                                price: new Prisma.Decimal(item.finalPrice.toFixed(2))
                            }))
                        },
                        payment: {
                            create: {
                                status: 'PENDING',
                                amount: new Prisma.Decimal(calculation.total.toFixed(2))
                            }
                        }
                    },
                    include: {
                        orderItems: { include: { product: { select: { id: true, name: true, images: true } } } },
                        payment: true
                    }
                })
            })
        } catch (error) {
            if (error instanceof OrderValidationError) {
                return status(error.statusCode, { message: error.message })
            }
            throw error
        }
    }, {
        body: t.Object({
            items: t.Array(t.Object({
                productId: t.Integer({ minimum: 1 }),
                quantity: t.Integer({ minimum: 1 })
            }), { minItems: 1 })
        })
    })
    .get('/', ({ user }) => prisma.order.findMany({
        where: { userId: user.id },
        include: {
            orderItems: { include: { product: { select: { id: true, name: true, images: true } } } },
            payment: true
        },
        orderBy: { createdAt: 'desc' }
    }))
    .get('/:id', async ({ user, params, status }) => {
        const order = await prisma.order.findUnique({
            where: { id: Number(params.id) },
            include: {
                orderItems: { include: { product: { select: { id: true, name: true, images: true } } } },
                payment: true
            }
        })
        if (!order) return status(404, { message: 'Orden no encontrada' })
        if (order.userId !== user.id) return status(403, 'Forbidden')
        return order
    }, { params: t.Object({ id: t.Numeric() }) })

