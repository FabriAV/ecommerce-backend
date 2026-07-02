import { prisma } from '../lib/prisma'
import { Prisma } from '../../generated/prisma/client'
import { Elysia, t } from 'elysia'
import { encryption } from '../utils/encryption'
import { pluginJWT } from '../plugin/jwt'

export const authRoutes = new Elysia({ prefix: '/auth' })
    .use(pluginJWT)
    .post('/sign-up', async ({ body, jwt, cookie: { auth }, status }) => {
        try {
            const user = await prisma.user.create({
                data: {
                    email: body.email,
                    password: await encryption(body.password),
                    address: body.address,
                    phone: body.phone,
                    name: body.name
                }
            })
            const token = await jwt.sign({
                id: user.id,
                email: user.email,
                isAdmin: user.isAdmin
            })
            auth?.set({ value: token, httpOnly: true, maxAge: 7 * 86400 })
            status(201)
            return { message: 'User created successfully' }
        } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError) {
                if (e.code === 'P2002') {
                    if (e.message.includes('email')) {
                        status(409)
                        return { message: 'Email already registered' }
                    }
                    if (e.message.includes('phone')) {
                        status(409)
                        return { message: 'Phone already registered' }
                    }
                }
            }
            throw e
        }
    }, {
        body: t.Object({
            email: t.String(),
            password: t.String(),
            address: t.String(),
            phone: t.String(),
            name: t.String()
        })
    })
    .post('/sign-in', async ({ body, jwt, cookie: { auth } }) => {
        const user = await prisma.user.findUnique({
            where: {
                email: body.email
            }
        })
        if (!user) {
            return { message: 'Invalid email or password' }
        }

        const isMatch = await Bun.password.verify(body.password, user.password);
        if (isMatch) {
            const token = await jwt.sign({
                id: user.id,
                email: user.email,
                isAdmin: user.isAdmin
            })
            auth?.set({ value: token, httpOnly: true, maxAge: 7 * 86400 })
            return { message: 'Login successful' }
        } else {
            return { message: 'Invalid email or password' }
        }
    }, {
        body: t.Object({
            email: t.String(),
            password: t.String()
        })
    }
    )
    .post('/sign-out', async ({ cookie: { auth }, status }) => {
        auth?.remove()
        status(200)
        return { message: 'User signed out successfully' }
    })