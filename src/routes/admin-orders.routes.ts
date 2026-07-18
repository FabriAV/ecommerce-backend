import { Elysia, t } from 'elysia'
import { prisma } from '../lib/prisma'
import { pluginAuth } from '../plugin/auth'

export const adminOrderRoutes = new Elysia({ prefix: '/admin/orders' })
    .use(pluginAuth)
    .get('/', async ({ user, query, status }) => {
        if (!user.isAdmin) return status(403, 'Forbidden')

        return prisma.order.findMany({
            where: {
                userId: query.userId,
                status: query.status,
                user: query.email
                    ? { email: { contains: query.email, mode: 'insensitive' } }
                    : undefined
            },
            include: {
                user: { omit: { password: true } },
                orderItems: {
                    include: {
                        product: { select: { id: true, name: true, images: true } }
                    }
                },
                payment: true
            },
            orderBy: { createdAt: 'desc' }
        })
    }, {
        query: t.Object({
            userId: t.Optional(t.Numeric({ minimum: 1 })),
            email: t.Optional(t.String()),
            status: t.Optional(t.Union([
                t.Literal('PROCESSING'),
                t.Literal('CANCELLED'),
                t.Literal('SHIPPED'),
                t.Literal('DELIVERED')
            ]))
        })
    })
    .patch('/:id/status', async ({ user, params, body, status }) => {
        if (!user.isAdmin) return status(403, 'Forbidden')

        const order = await prisma.order.findUnique({
            where: { id: Number(params.id) },
            include: { payment: true }
        })
        if (!order) return status(404, { message: 'Orden no encontrada' })

        const validTransition =
            (order.status === 'PROCESSING' && body.status === 'SHIPPED') ||
            (order.status === 'SHIPPED' && body.status === 'DELIVERED')

        if (!validTransition) {
            return status(409, {
                message: `No se puede cambiar una orden de ${order.status} a ${body.status}`
            })
        }
        if (body.status === 'SHIPPED' && order.payment?.status !== 'APPROVED') {
            return status(409, { message: 'La orden solo puede enviarse cuando el pago está aprobado' })
        }

        return prisma.order.update({
            where: { id: order.id },
            data: { status: body.status },
            include: {
                user: { omit: { password: true } },
                orderItems: {
                    include: {
                        product: { select: { id: true, name: true, images: true } }
                    }
                },
                payment: true
            }
        })
    }, {
        params: t.Object({ id: t.Numeric() }),
        body: t.Object({
            status: t.Union([
                t.Literal('SHIPPED'),
                t.Literal('DELIVERED')
            ])
        })
    })