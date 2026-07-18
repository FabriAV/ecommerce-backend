import { Elysia } from 'elysia';
import { pluginJWT } from './plugin/jwt'
import { cors } from '@elysia/cors'
import { authRoutes } from './routes/auth.routes';
import { userRoutes } from './routes/users.routes'
import { productRoutes } from './routes/products.routes'
import { categoryRoutes } from './routes/categories.routes'
import { cartRoutes } from './routes/cart.routes'
import { orderRoutes } from './routes/orders.routes'
import { paymentRoutes } from './routes/payment.routes'
import { promotionRoutes } from './routes/promotions.routes'
import { adminOrderRoutes } from './routes/admin-orders.routes'

const app = new Elysia({prefix : '/api' })
    .use(cors({
        origin: process.env.FRONTEND_URL ?? 'http://localhost:4322',
        credentials: true
    }))
    .use(pluginJWT)
    .get('/health', async () => 'ok')
    .use(authRoutes)
    .use(userRoutes)
    .use(productRoutes)
    .use(categoryRoutes)
    .use(cartRoutes)
    .use(orderRoutes)
    .use(paymentRoutes)
    .use(promotionRoutes)
    .use(adminOrderRoutes)
    .listen(3000)

console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
)