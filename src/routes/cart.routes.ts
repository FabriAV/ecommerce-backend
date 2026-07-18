import { Elysia, t } from 'elysia'
import { prisma } from '../lib/prisma'
import { pluginAuth } from '../plugin/auth'
import { calculatePromotions } from '../utils/promotions'

async function getOrCreateCart(userId: number) {
    return prisma.cart.upsert({
        where: { userId },
        update: {},
        create: { userId }
    })
}

class CartSyncError extends Error {
    constructor(public statusCode: 404 | 409, message: string) {
        super(message)
    }
}

async function getCartResponse(userId: number) {
    const cart = await getOrCreateCart(userId)
    const cartItems = await prisma.cartItem.findMany({
        where: { cartId: cart.id },
        include: { product: { include: { categories: true } } },
        orderBy: { id: 'asc' }
    })
    const calculation = await calculatePromotions(cartItems.map(item => ({
        productId: item.productId,
        name: item.product.name,
        quantity: item.quantity,
        price: item.product.price,
        categories: item.product.categories
    })))

    return {
        ...calculation,
        items: calculation.items.map(item => {
            const source = cartItems.find(cartItem => cartItem.productId === item.productId)!
            return {
                itemId: source.id,
                ...item,
                images: source.product.images,
                isActive: source.product.isActive,
                stock: source.product.stock
            }
        })
    }
}

export const cartRoutes = new Elysia({ prefix: '/cart' })
    .use(pluginAuth)
    .get('/', ({ user }) => getCartResponse(user.id))
    .post('/', async ({ user, body, status }) => {
        if (body.quantity < 1) return status(400, { message: 'La cantidad debe ser mayor o igual a 1' })
        const product = await prisma.product.findFirst({ where: { id: body.productId, isActive: true } })
        if (!product) return status(404, { message: 'Producto no encontrado' })

        const cart = await getOrCreateCart(user.id)
        const currentItem = await prisma.cartItem.findUnique({
            where: { cartId_productId: { cartId: cart.id, productId: body.productId } }
        })
        const newQuantity = (currentItem?.quantity ?? 0) + body.quantity
        if (newQuantity > product.stock) return status(409, { message: 'Stock insuficiente' })

        return prisma.cartItem.upsert({
            where: { cartId_productId: { cartId: cart.id, productId: body.productId } },
            update: { quantity: newQuantity },
            create: { cartId: cart.id, productId: body.productId, quantity: body.quantity },
            include: { product: true }
        })
    }, {
        body: t.Object({
            productId: t.Integer({ minimum: 1 }),
            quantity: t.Integer()
        })
    })
    .post('/sync', async ({ user, body, status }) => {
        const quantities = new Map<number, number>()
        for (const item of body.items) {
            quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity)
        }

        try {
            await prisma.$transaction(async tx => {
                const incomingItems = [...quantities].map(([productId, quantity]) => ({ productId, quantity }))
                const products = await tx.product.findMany({
                    where: { id: { in: incomingItems.map(item => item.productId) }, isActive: true }
                })
                const cart = await tx.cart.upsert({
                    where: { userId: user.id },
                    update: {},
                    create: { userId: user.id }
                })

                for (const item of incomingItems) {
                    const product = products.find(candidate => candidate.id === item.productId)
                    if (!product) throw new CartSyncError(404, `Producto ${item.productId} no encontrado o inactivo`)

                    const syncedItem = await tx.cartItem.upsert({
                        where: { cartId_productId: { cartId: cart.id, productId: item.productId } },
                        update: { quantity: { increment: item.quantity } },
                        create: { cartId: cart.id, productId: item.productId, quantity: item.quantity }
                    })
                    if (syncedItem.quantity > product.stock) {
                        throw new CartSyncError(409, `Stock insuficiente para ${product.name}`)
                    }
                }
            })

            return {
                message: 'Carrito sincronizado correctamente',
                ...(await getCartResponse(user.id))
            }
        } catch (error) {
            if (error instanceof CartSyncError) {
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
    .patch('/:itemId', async ({ user, params, body, status }) => {
        if (body.quantity < 1) return status(400, { message: 'La cantidad debe ser mayor o igual a 1' })
        const item = await prisma.cartItem.findUnique({
            where: { id: Number(params.itemId) },
            include: { cart: true, product: true }
        })
        if (!item || item.cart.userId !== user.id) return status(403, 'Forbidden')
        if (!item.product.isActive) return status(409, { message: 'El producto ya no está disponible' })
        if (body.quantity > item.product.stock) return status(409, { message: 'Stock insuficiente' })

        return prisma.cartItem.update({
            where: { id: item.id },
            data: { quantity: body.quantity },
            include: { product: true }
        })
    }, {
        params: t.Object({ itemId: t.Numeric() }),
        body: t.Object({ quantity: t.Integer() })
    })
    .delete('/:itemId', async ({ user, params, status }) => {
        const item = await prisma.cartItem.findUnique({
            where: { id: Number(params.itemId) },
            include: { cart: true }
        })
        if (!item || item.cart.userId !== user.id) return status(403, 'Forbidden')
        await prisma.cartItem.delete({ where: { id: item.id } })
        return { message: 'Producto eliminado del carrito' }
    }, { params: t.Object({ itemId: t.Numeric() }) })