import { Elysia, t } from 'elysia';
import { jwt } from '@elysia/jwt'
import { cors } from '@elysia/cors'
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../generated/prisma/client";
import { encryption } from './utils/encryption';

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const app = new Elysia()
    .use(cors())
    .use(
        jwt({
            name: 'jwt',
            secret: process.env.JWT_SECRET!
        })
    )
    .get('/', async () => 'ok')
    .get('/categories', async () => { return await prisma.category.findMany()})
    .get('/users', async () => { return await prisma.user.findMany() })
    .get('/products', async ({ query }) => {
        return await prisma.product.findMany({
            where:
            {
                name: query.name,
                categories: {
                    some: {
                        name: query.categories
                    }
                },
                price: {
                    gte: query.minPrice ? parseFloat(query.minPrice) : undefined,
                    lte: query.maxPrice ? parseFloat(query.maxPrice) : undefined
                }
            }
        })
    }, {
        query: t.Object({
            name: t.Optional(t.String()),
            categories: t.Optional(t.String()),
            minPrice: t.Optional(t.String()),
            maxPrice: t.Optional(t.String()),
        })
    })
    .group('/auth', (app) => app
        .post('/sign-up', async ({ body }) => {
            try {
                return await prisma.user.create({
                    data:
                    {
                        name: body.name,
                        email: body.email,
                        password: encryption(body.password),
                        address: body.address,
                        phone: body.phone,
                    }
                })
            }
            catch (e) {
                if (e instanceof Prisma.PrismaClientKnownRequestError) {
                    if (e.code === 'P2002') {
                        if ((e.meta?.target as String[]).includes('email')) {
                            return { message: 'Email already registered' }
                        }
                        if ((e.meta?.target as String[]).includes('phone')) {
                            return { message: 'Phone already registered' }
                        }
                    }
                }
            }
        },
            {
                body: t.Object({
                    name: t.String(),
                    email: t.String(),
                    password: t.String(),
                    address: t.String(),
                    phone: t.String()
                })
            })
        .post('/sign-in', async ({ body, jwt, cookie: { auth } }) => {
            const user = await prisma.user.findUnique({
                where:
                {
                    email: body.email,
                }
            })

            if (encryption(body.password) == user?.password) {
                const token = await jwt.sign({
                    id: user.id,
                    email: user.email,
                    isAdmin: user.isAdmin
                })
                auth?.set({ value: token, httpOnly: true, maxAge: 7 * 86400 })
                return token
            }

            return { message: 'Invalid credentials' }
            ;


        },
            {
                body: t.Object({
                    email: t.String(),
                    password: t.String()
                })
            }
        )
    )
    .post('/categories', async ({body}) => {
        return await prisma.category.create({
            data:{
                name: body.name,
                description: body.description
            }
        })
    },{
        body: t.Object({
            name: t.String(),
            description: t.String()      
        })
    })
    .listen(3000)

console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
)