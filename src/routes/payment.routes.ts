import { Elysia, t } from 'elysia'
import { prisma } from '../lib/prisma'
import { pluginAuth } from '../plugin/auth'

class PaymentConflictError extends Error {}

export const paymentRoutes = new Elysia({ prefix: '/payment' })
    .use(pluginAuth)
    .post('/', async ({ user, body, status }) => {
        const order = await prisma.order.findUnique({
            where: { id: body.orderId },
            include: { payment: true, orderItems: true }
        })
        if (!order) return status(404, { message: 'Orden no encontrada' })
        if (order.userId !== user.id) return status(403, 'Forbidden')
        if (!order.payment || order.payment.status !== 'PENDING') {
            return status(409, { message: 'El pago ya fue procesado' })
        }

        await new Promise(resolve => setTimeout(resolve, 1500))
        const paymentStatus = Math.random() < 0.8 ? 'APPROVED' as const : 'REJECTED' as const

        try {
            await prisma.$transaction(async tx => {
                const claimed = await tx.payment.updateMany({
                    where: { id: order.payment!.id, status: 'PENDING' },
                    data: { status: paymentStatus }
                })
                if (claimed.count !== 1) throw new PaymentConflictError()

                await tx.order.update({
                    where: { id: order.id },
                    data: { status: paymentStatus === 'APPROVED' ? 'PROCESSING' : 'CANCELLED' }
                })

                if (paymentStatus === 'REJECTED') {
                    for (const item of order.orderItems) {
                        await tx.product.update({
                            where: { id: item.productId },
                            data: { stock: { increment: item.quantity } }
                        })
                    }
                }
            })
        } catch (error) {
            if (error instanceof PaymentConflictError) {
                return status(409, { message: 'El pago ya fue procesado' })
            }
            throw error
        }

        return paymentStatus === 'APPROVED'
            ? { status: paymentStatus, message: 'Pago aprobado correctamente' }
            : { status: paymentStatus, message: 'Pago rechazado; la orden fue cancelada y el stock restaurado' }
    }, { body: t.Object({ orderId: t.Integer({ minimum: 1 }) }) })
